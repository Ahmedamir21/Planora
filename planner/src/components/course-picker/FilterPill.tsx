export function FilterPill({ label, active, locked, onClick }: { label: string; active: boolean; locked?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      title={locked ? 'Different instructor is fixed by your current picks — pick a section from this group to switch' : undefined}
      className="btn-tap rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors"
      style={{
        border: `1px solid ${active ? 'var(--accent)' : 'var(--line)'}`,
        background: active ? 'color-mix(in srgb, var(--accent) 14%, var(--paper))' : 'var(--surface)',
        color: active ? 'var(--accent)' : locked ? 'var(--muted-2)' : 'var(--muted)',
        opacity: locked && !active ? 0.65 : 1,
        maxWidth: 170,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </button>
  );
}
