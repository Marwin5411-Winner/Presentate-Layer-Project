import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';
import { Kafka, Consumer, logLevel } from 'kafkajs';
import webpush from 'web-push';
import { sql } from './db';
import { broadcast } from './websocket';
import type {
  NotificationPayload,
  NotificationSeverity,
  PushSubscriptionRequest,
  PushSubscriptionRecord,
} from './types';

type NotificationSource = NotificationPayload['source'];

interface NotificationInput {
  type: string;
  title: string;
  message: string;
  severity?: NotificationSeverity;
  data?: Record<string, any>;
}

interface PushSubscriptionRow {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  expirationTime?: number | null;
  userAgent?: string | null;
}

class NotificationCenter extends EventEmitter {
  private kafkaConsumer: Consumer | null = null;
  private pushConfigured = false;
  private kafkaInitialized = false;

  constructor() {
    super();
    this.setMaxListeners(50);

    this.on('notification', (payload: NotificationPayload) => {
      this.handleNotification(payload);
    });
  }

  async initialize() {
    this.configureWebPush();
    await this.initializeKafka();
  }

  /**
   * Configure Web Push using VAPID credentials if provided
   */
  private configureWebPush() {
    const publicKey = Bun.env.VAPID_PUBLIC_KEY;
    const privateKey = Bun.env.VAPID_PRIVATE_KEY;
    const subject = Bun.env.VAPID_SUBJECT || 'mailto:ops@example.com';

    if (!publicKey || !privateKey) {
      console.warn('⚠️  VAPID keys are not configured. Push notifications are disabled.');
      this.pushConfigured = false;
      return;
    }

    webpush.setVapidDetails(subject, publicKey, privateKey);
    this.pushConfigured = true;
    console.log('📬 Web Push configured successfully');
  }

  /**
   * Initialize Kafka consumer (if configured)
   */
  private async initializeKafka() {
    const brokerList = Bun.env.KAFKA_BROKERS;
    if (!brokerList) {
      console.log('ℹ️  Kafka brokers not configured. Skipping Kafka listener.');
      return;
    }

    const brokers = brokerList.split(',').map((b) => b.trim()).filter(Boolean);
    if (brokers.length === 0) {
      console.warn('⚠️  No valid Kafka brokers found. Skipping Kafka listener.');
      return;
    }

    try {
      const kafka = new Kafka({
        clientId: Bun.env.KAFKA_CLIENT_ID || 'geospatial-dashboard',
        brokers,
        logLevel: logLevel.ERROR,
      });

      this.kafkaConsumer = kafka.consumer({
        groupId: Bun.env.KAFKA_GROUP_ID || 'notification-center',
      });

      await this.kafkaConsumer.connect();

      const topic = Bun.env.KAFKA_TOPIC_NOTIFICATIONS || 'notifications';
      await this.kafkaConsumer.subscribe({ topic, fromBeginning: false });

      await this.kafkaConsumer.run({
        eachMessage: async ({ message, topic: messageTopic, partition }) => {
          if (!message.value) return;
          try {
            const parsed = JSON.parse(message.value.toString()) as Partial<NotificationInput> & {
              source?: NotificationSource;
            };

            this.publish(
              {
                type: parsed.type || messageTopic,
                title: parsed.title || 'Kafka event received',
                message: parsed.message || `Message received on ${messageTopic}:${partition}`,
                severity: parsed.severity || 'info',
                data: parsed.data || parsed,
              },
              parsed.source || 'kafka'
            );
          } catch (error) {
            console.error('❌ Failed to parse Kafka notification payload:', error);
          }
        },
      });

      this.kafkaInitialized = true;
      console.log(`📡 Kafka notification listener started on topic "${topic}"`);
    } catch (error) {
      console.error('❌ Failed to initialize Kafka consumer:', error);
    }
  }

  /**
   * Publish a notification into the center
   */
  publish(input: NotificationInput, source: NotificationSource = 'system') {
    const payload: NotificationPayload = {
      id: randomUUID(),
      source,
      type: input.type,
      severity: input.severity || 'info',
      title: input.title,
      message: input.message,
      data: input.data,
      createdAt: new Date().toISOString(),
    };

    this.emit('notification', payload);
  }

  /**
   * Handle notification fan-out to WebSocket + push subscribers
   */
  private handleNotification(payload: NotificationPayload) {
    broadcast({
      type: 'notification',
      data: payload,
      timestamp: payload.createdAt,
    });

    if (this.pushConfigured) {
      this.dispatchPush(payload).catch((error) => {
        console.error('❌ Failed to dispatch push notification:', error);
      });
    }
  }

  /**
   * Send push notifications to all subscribers
   */
  private async dispatchPush(payload: NotificationPayload) {
    const subscriptions = await this.getPushSubscriptions();
    if (subscriptions.length === 0) {
      return;
    }

    const body = JSON.stringify({
      title: payload.title,
      body: payload.message,
      data: {
        ...payload.data,
        notificationId: payload.id,
        severity: payload.severity,
        type: payload.type,
        source: payload.source,
      },
    });

    await Promise.all(
      subscriptions.map(async (sub) => {
        const pushSubscription = {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh,
            auth: sub.auth,
          },
        };

        try {
          await webpush.sendNotification(pushSubscription, body);
        } catch (error: any) {
          const status = error?.statusCode;
          if (status === 404 || status === 410) {
            console.warn('⚠️  Removing expired push subscription:', sub.endpoint);
            await sql`DELETE FROM push_subscriptions WHERE id = ${sub.id}`;
          } else {
            console.error('❌ Error sending push notification:', error);
          }
        }
      })
    );
  }

  private async getPushSubscriptions(): Promise<PushSubscriptionRow[]> {
    const result = await sql<PushSubscriptionRow[]>`
      SELECT id, endpoint, p256dh, auth, expiration_time, user_agent
      FROM push_subscriptions
    `;

    return result;
  }

  async shutdown() {
    if (this.kafkaConsumer && this.kafkaInitialized) {
      try {
        await this.kafkaConsumer.disconnect();
        console.log('📴 Kafka consumer disconnected');
      } catch (error) {
        console.error('❌ Error disconnecting Kafka consumer:', error);
      } finally {
        this.kafkaConsumer = null;
        this.kafkaInitialized = false;
      }
    }
  }
}

export const notificationCenter = new NotificationCenter();

export async function initNotificationCenter() {
  await notificationCenter.initialize();
}

export async function shutdownNotificationCenter() {
  await notificationCenter.shutdown();
}

export async function savePushSubscription(
  payload: PushSubscriptionRequest,
  userAgent?: string | null
): Promise<PushSubscriptionRecord> {
  const expiration = payload.expirationTime ?? null;

  const result = await sql<PushSubscriptionRecord[]>`
    INSERT INTO push_subscriptions (endpoint, p256dh, auth, expiration_time, user_agent)
    VALUES (
      ${payload.endpoint},
      ${payload.keys.p256dh},
      ${payload.keys.auth},
      ${expiration},
      ${userAgent || null}
    )
    ON CONFLICT (endpoint) DO UPDATE SET
      p256dh = EXCLUDED.p256dh,
      auth = EXCLUDED.auth,
      expiration_time = EXCLUDED.expiration_time,
      user_agent = EXCLUDED.user_agent,
      updated_at = CURRENT_TIMESTAMP
    RETURNING
      id,
      endpoint,
      p256dh,
      auth,
      expiration_time as expirationTime,
      user_agent as userAgent,
      created_at as createdAt,
      updated_at as updatedAt
  `;

  return result[0];
}

export async function deletePushSubscription(endpoint: string) {
  await sql`
    DELETE FROM push_subscriptions
    WHERE endpoint = ${endpoint}
  `;
}

export function emitAssetNotification({
  action,
  assetName,
  severity = 'info',
  data,
}: {
  action: 'created' | 'updated' | 'deleted' | 'geometry_updated';
  assetName: string;
  severity?: NotificationSeverity;
  data?: Record<string, any>;
}) {
  const titleMap: Record<string, string> = {
    created: 'Asset created',
    updated: 'Asset updated',
    deleted: 'Asset deleted',
    geometry_updated: 'Asset geometry updated',
  };

  notificationCenter.publish(
    {
      type: `asset.${action}`,
      title: titleMap[action],
      message: `${assetName} was ${action.replace('_', ' ')}.`,
      severity,
      data,
    },
    'api'
  );
}
