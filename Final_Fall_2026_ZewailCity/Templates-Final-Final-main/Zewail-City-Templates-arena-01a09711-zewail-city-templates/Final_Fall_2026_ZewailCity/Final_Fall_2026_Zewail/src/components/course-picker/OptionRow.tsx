import type { Course } from '../../types';
import { DAY_LABEL, formatRange } from '../../lib/time';
import { hiddenReasons, isOptionDisabled, type OptionState } from '../../lib/picks';
import { Icon } from '../Icon';

export function OptionRow({
  option,
  course,
  groupLabel,
  onSelect,
  showReasons,
  locked,
  onToggleLock,
}: {
  option: OptionState;
  course: Course;
  groupLabel?: string;
  onSelect: () => void;
  showReasons?: boolean;
  locked?: boolean;
  onToggleLock?: () => void;
}) {
  const active = option.picked;
  const disabled = isOptionDisabled(option);
  const reasons = hiddenReasons(option, groupLabel);
  const kind = option.meeting.type;

  return (
    <div
      title={reasons.length ? `Hidden because:\n${reasons.map((r) => `• ${r}`).join('\n')}` : undefined}
      className="tap-row flex items-start gap-2 rounded-lg px-2 py-2 text-[12px] font-semibold transition-colors sm:text-[11.5px]"
      style={{
        background: active ? `var(--c${course.c}-bg)` : 'transparent',
        border: `1px solid ${active ? `var(--c${course.c})` : disabled || option.hiddenByInstructor ? 'var(--warn-line)' : 'transparent'}`,
        color: active ? `var(--c${course.c})` : disabled ? 'var(--muted-2)' : 'var(--ink)',
        opacity: disabled ? 0.65 : 1,
      }}
    >
      <label className="flex min-w-0 flex-1 cursor-pointer items-start gap-2" style={{ cursor: disabled ? 'not-allowed' : 'pointer' }}>
        <input
          type="radio"
          name={`${course.id}-${kind}`}
          className="tap-radio mt-0.5 accent-[var(--accent)]"
          checked={active}
          disabled={disabled}
          onChange={() => !disabled && onSelect()}
        />
        <span className="min-w-0 flex-1">
          <span className="mono block" style={{ textDecoration: disabled ? 'line-through' : 'none' }}>
            {DAY_LABEL[option.meeting.day].slice(0, 3)} · {formatRange(option.meeting.start, option.meeting.end)}
          </span>
          <span className="block text-[11px] font-medium sm:text-[10.5px]" style={{ color: reasons.length && !option.picked ? 'var(--warn)' : 'var(--muted)' }}>
            Sec {option.meeting.sec} · {option.meeting.room} · {option.instructor.name}
          </span>
          {showReasons && reasons.length > 0 && (
            <span className="mt-1 block space-y-0.5">
              {reasons.map((reason) => (
                <span key={reason} className="block text-[10px] font-medium leading-snug" style={{ color: 'var(--warn)' }}>
                  {reason}
                </span>
              ))}
            </span>
          )}
        </span>
      </label>
      {active && onToggleLock && (
        <button
          type="button"
          className="btn-tap flex-none rounded-lg px-1.5 py-1 text-[10px] font-bold hover:bg-(--surface-2)"
          onClick={onToggleLock}
          aria-pressed={Boolean(locked)}
          title={locked ? 'Unlock this section for AI and Best Schedule' : 'Keep this section unchanged by AI and Best Schedule'}
          style={{
            border: '1px solid transparent',
            color: locked ? 'var(--accent)' : 'var(--muted)',
          }}
        >
          <Icon name={locked ? 'lock' : 'unlock'} bare />
        </button>
      )}
    </div>
  );
}
