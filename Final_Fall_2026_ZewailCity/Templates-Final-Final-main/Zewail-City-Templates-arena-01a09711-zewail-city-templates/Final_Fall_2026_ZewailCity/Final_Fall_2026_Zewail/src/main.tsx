import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { hydrateCatalog } from './data/courses';

async function start() {
  try {
    const response = await fetch('/api/catalog', { cache: 'no-store' });
    if (!response.ok) throw new Error('Catalog unavailable');
    const catalog = await response.json();
    if (!hydrateCatalog(catalog.courses, catalog.sch)) throw new Error('Catalog incompatible with this version');
  } catch {
    const notice = document.createElement('p');
    notice.setAttribute('role', 'alert');
    notice.textContent = 'Live course updates are temporarily unavailable. Showing the built-in timetable; check again before relying on its times and rooms.';
    notice.style.cssText = 'padding:12px;background:#854d0e;color:white;text-align:center';
    document.body.prepend(notice);
  }
  createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
}
void start();

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
