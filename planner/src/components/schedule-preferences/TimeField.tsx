import { parseHHMM, toHHMM } from '../../lib/time';

export function TimeField({ label, value, onChange }: { label: string; value: number | null; onChange: (v: number | null) => void }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-semibold" style={{ color: 'var(--muted)' }}>
        {label}
      </span>
      <input
        type="time"
        className="select"
        value={value != null ? toHHMM(value) : ''}
        onChange={(e) => {
          const v = e.target.value;
          onChange(v ? parseHHMM(v) : null);
        }}
      />
    </label>
  );
}
