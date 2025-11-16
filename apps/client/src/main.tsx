import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import './index.css';
import App from './App.tsx';

registerSW({
  immediate: true,
  onNeedRefresh() {
    console.log('A new version of the dashboard is available. Reload to update.');
  },
  onOfflineReady() {
    console.log('The dashboard is ready to work offline.');
  },
  onRegisterError(error: Error) {
    console.error('Service worker registration failed:', error);
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
