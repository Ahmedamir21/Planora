
export function HardToggle({
  label,
  hint,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label
      className="mt-2 flex items-start gap-2 rounded-lg px-2.5 py-2 text-[11.5px] leading-relaxed"
      style={{
        background: checked ? 'var(--accent-soft, var(--surface-2))' : 'var(--surface)',
        border: `1px solid ${checked ? 'var(--accent)' : 'var(--line-soft)'}`,
        color: disabled ? 'var(--muted-2)' : 'var(--muted)',
        opacity: disabled ? 0.55 : 1,
      }}
    >
      <input
        type="checkbox"
        className="tap-checkbox mt-0.5 accent-[var(--accent)]"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>
        <strong style={{ color: disabled ? 'var(--muted-2)' : 'var(--ink)' }}>{label}</strong> — {hint}
      </span>
    </label>
  );
}
