
export function DayChip({ label, active, onClick, tone = 'accent' }: { label: string; active: boolean; onClick: () => void; tone?: 'accent' | 'warn' }) {
  const color = tone === 'warn' ? 'var(--warn)' : 'var(--accent)';
  const bg = tone === 'warn' ? 'var(--warn-bg)' : 'color-mix(in srgb, var(--accent) 14%, var(--paper))';
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className="btn-tap rounded-full px-3 py-1.5 text-[12px] font-semibold transition-colors"
      style={{
        border: `1px solid ${active ? color : 'var(--line)'}`,
        background: active ? bg : 'var(--surface)',
        color: active ? color : 'var(--muted)',
      }}
    >
      {label.slice(0, 3)}
    </button>
  );
}
