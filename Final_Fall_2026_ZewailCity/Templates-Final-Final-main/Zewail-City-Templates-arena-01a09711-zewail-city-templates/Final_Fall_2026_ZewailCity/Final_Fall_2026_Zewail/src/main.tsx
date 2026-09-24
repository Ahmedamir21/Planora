import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";
import { ErrorBoundary } from "./components/ErrorBoundary";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js').then((registration) => {
      const announceUpdate = () => {
        if (!registration.waiting) return;
        window.dispatchEvent(new CustomEvent('planora:update-ready', { detail: registration }));
      };

      announceUpdate();

      registration.addEventListener('updatefound', () => {
        const worker = registration.installing;
        if (!worker) return;
        worker.addEventListener('statechange', () => {
          if (worker.state === 'installed' && navigator.serviceWorker.controller) {
            announceUpdate();
          }
        });
      });

      window.setInterval(() => registration.update().catch(() => {}), 60 * 60 * 1000);
    }).catch((error) => {
      console.warn('Service worker registration failed', error);
    });
  });
}
