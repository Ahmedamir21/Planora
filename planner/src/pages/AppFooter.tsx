/** The bottom bar: links, data verification date and report buttons. */
import { COURSE_DATA_LAST_VERIFIED } from '../data/meta';
import type { PlannerState } from './planner-state/plannerState';

export function AppFooter({ planner }: { planner: PlannerState }) {
  const { showAbout, closeAbout, openAbout, reportGeneralIssue, setFeedbackOpen } = planner;

  return (
    <footer
      className="mt-6 flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 text-center text-[11px]"
      style={{ color: 'var(--muted-2)' }}
    >
      <span>Planora · Version 2.1</span>

      <span aria-hidden>·</span>

      <button
        type="button"
        className="underline decoration-dotted underline-offset-2"
        onClick={showAbout ? closeAbout : openAbout}
      >
        About &amp; GitHub
      </button>

      <span aria-hidden>·</span>

      <span>
        Course data verified:{' '}
        {new Date(`${COURSE_DATA_LAST_VERIFIED}T12:00:00`).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        })}
      </span>

      <span aria-hidden>·</span>

      <button
        type="button"
        className="underline decoration-dotted underline-offset-2"
        onClick={reportGeneralIssue}
      >
        Report an issue
      </button>
      <span aria-hidden>·</span>
      <button type="button" className="underline decoration-dotted underline-offset-2" onClick={() => setFeedbackOpen(true)}>Feedback</button>
    </footer>
  );
}
