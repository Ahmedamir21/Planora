export interface ToastState {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  tone?: 'default' | 'info' | 'warning' | 'danger';
}

export function Toast({ toast, onClose }: { toast: ToastState | null; onClose: () => void }) {
  if (!toast) return null;
  const tone = toast.tone ?? 'default';
  const icon = tone === 'danger' ? '!' : tone === 'warning' ? '!' : tone === 'info' ? 'i' : '✓';

  return (
    <div className="toast-shell no-print" role="status" aria-live="polite">
      <div className={`toast-card toast-${tone}`}>
        <span className="toast-icon" aria-hidden>{icon}</span>
        <span className="min-w-0 flex-1">{toast.message}</span>
        {toast.onAction && toast.actionLabel && (
          <button type="button" className="toast-action" onClick={toast.onAction}>
            {toast.actionLabel}
          </button>
        )}
        <button type="button" className="toast-close" onClick={onClose} aria-label="Dismiss notification">×</button>
      </div>
    </div>
  );
}
