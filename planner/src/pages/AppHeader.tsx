/** The top bar: logo, title, theme switch, install and share buttons. */
import { ThemeToggle } from '../components/ThemeToggle';
import { TERM_SESSION_LABEL } from '../config/semester';
import { Icon } from '../components/Icon';
import type { PlannerState } from './planner-state/plannerState';

export function AppHeader({ planner }: { planner: PlannerState }) {
  const { theme, major, showAbout, closeAbout, openAbout, setFeedbackOpen, setCommandOpen, setTheme } = planner;

  return (
    <header className="panel mb-3 flex flex-col gap-4 p-4 sm:flex-row sm:items-start sm:justify-between sm:p-5">
      <div>
        <p
          className="text-[10.5px] font-bold uppercase tracking-[0.09em]"
          style={{ color: 'var(--accent)' }}
        >
          {TERM_SESSION_LABEL}
        </p>

        <div className="mt-1 flex items-center gap-2.5">
          <img src={theme === 'dark' ? '/icons/planner-icon.svg' : '/icons/planner-icon-light.svg'} alt="" className="h-10 w-10 rounded-[12px]" />
          <div>
            <h1 className="text-[23px] font-extrabold tracking-[-0.03em] sm:text-[27px]">Planora</h1>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: 'var(--brand-soft)' }}>
              Build · Compare · Share
            </p>
          </div>
        </div>

        <p
          className="mt-1.5 max-w-[72ch] text-[12.5px] leading-relaxed"
          style={{ color: 'var(--muted)' }}
        >
          Tick the courses you are registering, then choose the lecture and lab/tutorial
          times you prefer — each component may come from a different instructor; every
          published section pairing is fair game. Real time intervals decide conflicts — a
          2:00–2:59 session next to a 3:00–3:59 session is fine, clashing ones are not.
        </p>
      </div>

      <div className="flex flex-none flex-wrap items-center gap-2">
        {major && !showAbout && (
          <span className="pill hidden sm:inline-flex" style={{ color: 'var(--accent)' }}>
            {major.title}
          </span>
        )}

        <button
          type="button"
          className="btn btn-tap"
          onClick={showAbout ? closeAbout : openAbout}
        >
          {showAbout ? '‹ Planner' : 'ℹ️ About'}
        </button>

        <a className="btn btn-tap" href="/admin.html" aria-label="Open Planora admin panel">
          <Icon name="lock" size="md" /> Admin
        </a>

        <button type="button" className="btn btn-accent btn-tap" onClick={() => setFeedbackOpen(true)}>
          <Icon name="message" size="md" /> Feedback
        </button>

        {major && !showAbout && (
          <button
            type="button"
            className="btn btn-tap"
            onClick={() => setCommandOpen(true)}
            title="Search courses and actions (Ctrl/Cmd + K)"
          >
            ⌕ Search
            <span className="pill hidden lg:inline-flex">⌘K</span>
          </button>
        )}

        <ThemeToggle theme={theme} onChange={setTheme} />
      </div>
    </header>
  );
}
