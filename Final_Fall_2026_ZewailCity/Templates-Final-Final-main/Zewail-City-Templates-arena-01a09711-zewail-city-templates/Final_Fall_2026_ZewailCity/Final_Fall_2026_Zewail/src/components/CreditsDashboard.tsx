import type { DayFreeTime } from '../lib/freeTime';
import { DAY_LABEL, formatDuration, to12h } from '../lib/time';

interface Props {
  selectedCount: number;
  /** Courses offered by the active major (for the "2 / 5" figure). */
  courseCount: number;
  totalCredits: number;
  /** Free hours with one decimal — real minutes, never rounded up to a whole hour. */
  freeHours: number;
  freeDays: number;
  /** Total class minutes currently on the plan (interval union), used by the free-time note. */
  occupiedMinutes: number;
  /** Daily availability window boundaries in minutes since midnight. */
  windowStart: number;
  windowEnd: number;
  /** Diagnostic: minutes where two selected classes overlap. */
  overlapMinutes: number;
  hiddenTotal: number;
  conflictTotal: number;
  /** Per-day occupied/free minutes from the actual picks — powers the day strip. */
  perDay: DayFreeTime[];
  onOpenBestSchedule?: () => void;
  onOpenPreferences?: () => void;
  /** Active credit cap (13/18/21 — never above 21). */
  creditCap: number;
  /** Reopens the credit-limit tier choice at any time. */
  onChangeLimit?: () => void;
}

export function CreditsDashboard({
  selectedCount,
  courseCount,
  totalCredits,
  freeHours,
  freeDays,
  occupiedMinutes,
  windowStart,
  windowEnd,
  overlapMinutes,
  hiddenTotal,
  conflictTotal,
  perDay,
  onOpenBestSchedule,
  onOpenPreferences,
  creditCap,
  onChangeLimit,
}: Props) {
  const creditsLeft = Math.max(0, creditCap - totalCredits);
  const creditTone =
    totalCredits >= 18 ? 'var(--warn)' :
    totalCredits >= 17 ? 'var(--accent)' :
    'var(--ink)';
  const tiles = [
    {
      label: 'Selected Courses',
      value: (
        <>
          {selectedCount} <span className="text-[12px] font-semibold" style={{ color: 'var(--muted-2)' }}>/ {courseCount}</span>
        </>
      ),
      icon: '📚',
    },
    {
      label: 'Total Credits',
      value: (
        <>
          <span style={{ color: creditTone }}>{totalCredits}</span>{' '}
          <span className="text-[12px] font-semibold" style={{ color: totalCredits >= 18 ? 'var(--warn)' : 'var(--muted-2)' }}>
            / {creditCap} cr
          </span>
        </>
      ),
      icon: '🎓',
    },
    {
      label: 'Free Time',
      value: (
        <span style={{ color: 'var(--ok)' }} title={`Free Time = the ${to12h(windowStart)}–${to12h(windowEnd)} Sunday–Thursday window minus actual class time`}>
          {freeHours} h
        </span>
      ),
      icon: '🕒',
    },
    {
      label: 'Schedule Status',
      value: (
        <span className="text-[13px]">
          {selectedCount === 0 ? (
            <span style={{ color: 'var(--muted)' }}>No courses selected</span>
          ) : selectedCount < courseCount ? (
            <span style={{ color: 'var(--muted)' }}>
              {selectedCount} of {courseCount} chosen
            </span>
          ) : (
            <span style={{ color: 'var(--ok)' }}>✓ Full term load</span>
          )}
        </span>
      ),
      icon: '📋',
    },
  ];

  return (
    <section className="panel p-3.5 sm:p-4" aria-label="Schedule dashboard">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-[13px] font-bold tracking-tight">
          <span className="live-dot" aria-hidden />
          Live Schedule &amp; Credits Dashboard
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          {hiddenTotal > 0 && (
            <span
              className="pill"
              style={{
                color: conflictTotal > 0 ? 'var(--warn)' : 'var(--muted)',
                borderColor: conflictTotal > 0 ? 'var(--warn-line)' : 'var(--line)',
                background: conflictTotal > 0 ? 'var(--warn-bg)' : 'var(--surface)',
              }}
              title="Options currently hidden by your instructor filter, time conflicts, or enforced limits"
            >
              {hiddenTotal} hidden{conflictTotal > 0 ? ` • ${conflictTotal} conflict${conflictTotal > 1 ? 's' : ''}` : ''}
            </span>
          )}
          {onOpenPreferences && (
            <button type="button" className="btn btn-tap px-2.5 py-1.5 text-[11px]" onClick={onOpenPreferences}>
              ⚙ Preferences
            </button>
          )}
          {onOpenBestSchedule && (
            <button type="button" className="btn btn-accent btn-tap px-2.5 py-1.5 text-[11px]" onClick={onOpenBestSchedule}>
              ✦ Best Schedule
            </button>
          )}
        </div>
      </div>

      <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11.5px]" style={{ color: 'var(--muted)' }} aria-live="polite">
        <span>
          <strong className="mono" style={{ color: 'var(--ink)' }}>{totalCredits}</strong> credit{totalCredits === 1 ? '' : 's'} registered ·{' '}
          <strong className="mono" style={{ color: creditsLeft === 0 ? 'var(--warn)' : 'var(--ok)' }}>{creditsLeft}</strong> credit
          {creditsLeft === 1 ? '' : 's'} left of your {creditCap}-credit limit
        </span>
        {onChangeLimit && (
          <button
            type="button"
            className="underline decoration-dotted underline-offset-2"
            style={{ color: 'var(--accent)' }}
            onClick={onChangeLimit}
            title="Reopen the credit-limit choice"
          >
            change limit
          </button>
        )}
      </p>

      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
        {tiles.map((it) => (
          <div key={it.label} className="panel-soft flex items-center gap-3 px-3.5 py-3">
            <span className="text-[20px] leading-none" aria-hidden>
              {it.icon}
            </span>
            <div className="min-w-0">
              <p className="truncate text-[10.5px] font-bold uppercase tracking-[0.06em]" style={{ color: 'var(--muted-2)' }}>
                {it.label}
              </p>
              <p className="mono truncate text-[17px] font-extrabold leading-tight">{it.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Per-day free time — exact occupied minutes from the actual picks (interval union). */}
      <div className="mt-3 grid grid-cols-5 gap-1.5 sm:gap-2" aria-label="Free time per day">
        {perDay.map((d) => {
          const load = Math.min(1, d.occupied / (windowEnd - windowStart || 1));
          return (
            <div
              key={d.day}
              className="rounded-lg px-1.5 py-1.5 text-center"
              style={{ background: 'var(--surface)', border: `1px solid ${d.hasClass ? 'var(--line)' : 'var(--line-soft)'}` }}
              title={`${DAY_LABEL[d.day]}: ${formatDuration(d.occupied)} of class · ${formatDuration(d.freeMinutes)} free within the window`}
            >
              <p className="text-[9.5px] font-bold uppercase tracking-[0.06em]" style={{ color: 'var(--muted-2)' }}>
                {d.day}
              </p>
              <p className="mono mt-0.5 text-[11px] font-bold" style={{ color: d.hasClass ? 'var(--ink)' : 'var(--ok)' }}>
                {d.hasClass ? formatDuration(d.occupied) : 'free'}
              </p>
              <div className="mt-1 h-1 overflow-hidden rounded-full" style={{ background: 'var(--line-soft)' }} aria-hidden>
                <div
                  className="h-full rounded-full"
                  style={{ width: `${Math.round(load * 100)}%`, background: load >= 1 ? 'var(--warn)' : 'var(--accent)' }}
                />
              </div>
            </div>
          );
        })}
      </div>

      <p className="mt-2.5 text-[11px] leading-relaxed" style={{ color: 'var(--muted-2)' }}>
        Free Time = the teaching window ({to12h(windowStart)}–{to12h(windowEnd)}, Sunday–Thursday) minus your actual
        class time ({formatDuration(occupiedMinutes)}). Classes count by their real start and end times, and overlapping
        classes are only counted once.
        {freeDays > 0 && <> {freeDays} day{freeDays === 1 ? '' : 's'} have no classes at all.</>}
        {overlapMinutes > 0 && (
          <span style={{ color: 'var(--warn)' }}> {overlapMinutes} min of double-booked time detected.</span>
        )}
      </p>
    </section>
  );
}
