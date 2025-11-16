import { useCallback, useEffect, useMemo, useState } from 'react';

const isBrowser = typeof window !== 'undefined';

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return outputArray;
}

export function usePushNotifications() {
  const [permission, setPermission] = useState<NotificationPermission>(() => {
    if (isBrowser && 'Notification' in window) {
      return Notification.permission;
    }
    return 'default';
  });
  const [isSupported, setIsSupported] = useState(false);
  const [subscription, setSubscription] = useState<PushSubscription | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY?.trim() ?? '';
  const applicationServerKey = useMemo(() => {
    if (!vapidPublicKey || !isBrowser) return null;

    try {
      return urlBase64ToUint8Array(vapidPublicKey);
    } catch (err) {
      console.error('Invalid VAPID public key', err);
      return null;
    }
  }, [vapidPublicKey]);

  const syncSubscriptionWithServer = useCallback(async (subscription: PushSubscription) => {
    const json = subscription.toJSON();

    if (!json.keys?.p256dh || !json.keys?.auth) {
      throw new Error('Push subscription is missing encryption keys.');
    }

    const response = await fetch('/api/notifications/subscribe', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        endpoint: json.endpoint,
        expirationTime: json.expirationTime ?? null,
        keys: {
          p256dh: json.keys.p256dh,
          auth: json.keys.auth,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || 'Failed to register push subscription with the server.');
    }
  }, []);

  const removeSubscriptionFromServer = useCallback(async (endpoint: string) => {
    const response = await fetch('/api/notifications/subscribe', {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ endpoint }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || 'Failed to remove push subscription from the server.');
    }
  }, []);

  useEffect(() => {
    const supported =
      isBrowser && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
    setIsSupported(supported);
    if (!supported) return;

    let isMounted = true;

    navigator.serviceWorker.ready
      .then((registration) => registration.pushManager.getSubscription())
      .then((existing) => {
        if (isMounted && existing) {
          setSubscription(existing);
          setPermission(Notification.permission);
          syncSubscriptionWithServer(existing).catch((err) =>
            console.error('Failed to sync existing push subscription:', err)
          );
        }
      })
      .catch((err) => console.error('Failed to read push subscription', err));

    return () => {
      isMounted = false;
    };
  }, [syncSubscriptionWithServer]);

  const requestPermission = useCallback(async () => {
    if (!isBrowser || !('Notification' in window)) {
      return 'denied';
    }

    if (Notification.permission !== 'default') {
      setPermission(Notification.permission);
      return Notification.permission;
    }

    const result = await Notification.requestPermission();
    setPermission(result);
    return result;
  }, []);

  const subscribeToPush = useCallback(async () => {
    if (!isSupported) {
      throw new Error('Push notifications are not supported in this browser.');
    }

    if (!applicationServerKey) {
      throw new Error(
        'VITE_VAPID_PUBLIC_KEY is not configured. Provide a VAPID key to enable push notifications.'
      );
    }

    setIsProcessing(true);
    setError(null);

    try {
      const permissionResult = await requestPermission();

      if (permissionResult !== 'granted') {
        throw new Error('Notification permission was not granted.');
      }

      const registration = await navigator.serviceWorker.ready;
      const existing = await registration.pushManager.getSubscription();

      if (existing) {
        setSubscription(existing);
        return existing;
      }

      const newSubscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey,
      });

      await syncSubscriptionWithServer(newSubscription);
      setSubscription(newSubscription);
      return newSubscription;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to subscribe to push notifications.';
      setError(message);
      throw err;
    } finally {
      setIsProcessing(false);
    }
  }, [applicationServerKey, isSupported, requestPermission, syncSubscriptionWithServer]);

  const unsubscribeFromPush = useCallback(async () => {
    if (!subscription) {
      return false;
    }

    setIsProcessing(true);
    setError(null);

    try {
      const successful = await subscription.unsubscribe();

      if (successful && subscription.endpoint) {
        await removeSubscriptionFromServer(subscription.endpoint);
        setSubscription(null);
      }

      return successful;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to unsubscribe from push notifications.';
      setError(message);
      throw err;
    } finally {
      setIsProcessing(false);
    }
  }, [subscription, removeSubscriptionFromServer]);

  const subscriptionJSON = useMemo(() => subscription?.toJSON() ?? null, [subscription]);

  return {
    isSupported,
    permission,
    subscription,
    subscriptionJSON,
    isSubscribed: Boolean(subscription),
    isProcessing,
    error,
    subscribeToPush,
    unsubscribeFromPush,
    requestPermission,
  };
}
