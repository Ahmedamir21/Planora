import { useEffect, useRef, useState } from 'react';

const MAX_HOURS_CHOICES: number[] = [2, 3, 4, 5, 6, 7, 8, 9, 10];

/**
 * A single, normal press opens the hour choices in a compact menu; one normal click
 * selects and closes it. Deliberately NOT a native <select> (OS-picker feel on touch)
 * and never a slider/long-press. Styled with the project's own `.select` + `.panel-soft`.
 */
export function MaxHoursDropdown({ value, onSelect }: { value: number | null; onSelect: (v: number | null) => void }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  // Any press outside closes the menu — real mouse and touch via pointerdown.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: Event) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [open]);

  const pick = (v: number | null) => {
    onSelect(v);
    setOpen(false);
    triggerRef.current?.focus();
  };

  return (
    <div
      ref={wrapRef}
      className="relative"
      onKeyDown={(e) => {
        // Escape closes just this menu — stopPropagation keeps the settings modal open.
        if (e.key === 'Escape' && open) {
          e.stopPropagation();
          setOpen(false);
        }
      }}
    >
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="select btn-tap text-left"
        style={{ fontWeight: 600 }}
      >
        {value == null ? 'Maximum Hours Per Day: No limit' : `Maximum Hours Per Day: ${value} hours`}
      </button>
      {open && (
        <div
          role="listbox"
          aria-label="Maximum hours per day"
          className="panel-soft absolute left-0 right-0 top-[calc(100%+4px)] z-30 max-h-56 overflow-y-auto p-1"
          style={{ boxShadow: '0 12px 32px -12px rgba(0,0,0,0.35)' }}
        >
          <MaxHoursOption label="No limit" selected={value == null} onClick={() => pick(null)} />
          {MAX_HOURS_CHOICES.map((h) => (
            <MaxHoursOption key={h} label={`${h} hours`} selected={value === h} onClick={() => pick(h)} />
          ))}
        </div>
      )}
    </div>
  );
}

function MaxHoursOption({ label, selected, onClick }: { label: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      onClick={onClick}
      className="btn-tap flex w-full items-center justify-between rounded-lg px-3 text-[12.5px] font-semibold transition-colors"
      style={
        selected
          ? { color: 'var(--accent)', background: 'color-mix(in srgb, var(--accent) 12%, var(--paper))' }
          : { color: 'var(--ink)' }
      }
    >
      {label}
      {selected && (
        <span aria-hidden style={{ color: 'var(--accent)' }}>
          ✓
        </span>
      )}
    </button>
  );
}
