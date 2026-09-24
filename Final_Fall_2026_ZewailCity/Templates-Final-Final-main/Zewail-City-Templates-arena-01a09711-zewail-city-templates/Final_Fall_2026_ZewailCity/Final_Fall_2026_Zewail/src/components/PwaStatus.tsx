import { useEffect, useState } from 'react';

declare global {
  interface WindowEventMap {
    'planora:update-ready': CustomEvent<ServiceWorkerRegistration>;
  }
}

export function PwaStatus() {
  const [online, setOnline] = useState(() => typeof navigator === 'undefined' ? true : navigator.onLine);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const [reloading, setReloading] = useState(false);

  useEffect(() => {
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    const onUpdate = (event: CustomEvent<ServiceWorkerRegistration>) => setRegistration(event.detail);

    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    window.addEventListener('planora:update-ready', onUpdate as EventListener);

    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      window.removeEventListener('planora:update-ready', onUpdate as EventListener);
    };
  }, []);

  const refresh = () => {
    const waiting = registration?.waiting;
    if (!waiting) {
      window.location.reload();
      return;
    }

    setReloading(true);
    let refreshed = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (refreshed) return;
      refreshed = true;
      window.location.reload();
    });
    waiting.postMessage({ type: 'SKIP_WAITING' });
  };

  if (online && !registration) return null;

  return (
    <div className="planora-status-stack no-print" aria-live="polite">
      {!online && (
        <div className="planora-status-card is-offline" role="status">
          <span className="planora-status-dot" aria-hidden />
          <span><strong>Offline</strong> · Planner still works · AI unavailable</span>
        </div>
      )}

      {registration && (
        <div className="planora-status-card is-update" role="status">
          <span>New version available</span>
          <button type="button" onClick={refresh} disabled={reloading}>
            {reloading ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
      )}
    </div>
  );
}
