import type { CreditCap } from '../lib/appState';

/**
 * Manual planning-limit chooser. It only opens when the student asks to change
 * the limit; the planner never asks for or stores GPA.
 */
export function CreditLimitNote({
  onChoose,
  onDismiss,
}: {
  onChoose: (cap: CreditCap) => void;
  onDismiss: () => void;
}) {
  return (
    <div className="panel-soft fade-up flex flex-wrap items-start gap-3 px-3.5 py-3" role="status">
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-bold uppercase tracking-[0.06em]" style={{ color: 'var(--accent)' }}>
          Planning credit limit
        </p>
        <p className="mt-1 text-[12px] leading-relaxed" style={{ color: 'var(--muted)' }}>
          Choose the credit limit you want the planner to use. Your GPA is never requested or stored.
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <button type="button" className="btn btn-tap px-2.5 py-1.5 text-[11px]" onClick={() => onChoose(13)}>
            13 credits
          </button>
          <button type="button" className="btn btn-tap px-2.5 py-1.5 text-[11px]" onClick={() => onChoose(18)}>
            18 credits
          </button>
          <button type="button" className="btn btn-tap px-2.5 py-1.5 text-[11px]" onClick={() => onChoose(21)}>
            Over Load · 21 credits
          </button>
        </div>
      </div>
      <button type="button" className="btn btn-tap flex-none px-2.5 py-1.5 text-[11px]" onClick={onDismiss} aria-label="Close credit limit chooser">
        ✕
      </button>
    </div>
  );
}
