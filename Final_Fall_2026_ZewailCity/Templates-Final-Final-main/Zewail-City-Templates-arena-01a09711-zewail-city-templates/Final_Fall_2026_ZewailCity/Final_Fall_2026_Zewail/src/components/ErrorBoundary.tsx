import { Component, type ErrorInfo, type ReactNode } from 'react';
import { clearPlannerState } from '../lib/recovery';

interface Props {
  children: ReactNode;
}

interface State {
  failed: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Planner UI crashed', error, info);
  }

  private reset = () => {
    clearPlannerState();
    window.location.assign(window.location.pathname);
  };

  render() {
    if (!this.state.failed) return this.props.children;

    return (
      <main className="min-h-screen p-4 sm:p-8" style={{ background: 'var(--bg)', color: 'var(--ink)' }}>
        <section className="panel mx-auto mt-[12vh] max-w-[560px] p-6 sm:p-8" role="alert">
          <p className="text-[11px] font-bold uppercase tracking-[0.1em]" style={{ color: 'var(--warn)' }}>
            Recovery mode
          </p>
          <h1 className="mt-2 text-[22px] font-extrabold">Something went wrong</h1>
          <p className="mt-2 text-[13px] leading-relaxed" style={{ color: 'var(--muted)' }}>
            Your browser hit an unexpected planner error. Reload first. If it keeps happening, reset only the saved
            planner state on this device and start with a clean schedule.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <button type="button" className="btn btn-accent btn-tap" onClick={() => window.location.reload()}>
              Reload
            </button>
            <button type="button" className="btn btn-tap" onClick={this.reset}>
              Reset local planner state
            </button>
          </div>
          <p className="mt-3 text-[10.5px]" style={{ color: 'var(--muted-2)' }}>
            Theme settings are kept. No account or university data is deleted.
          </p>
        </section>
      </main>
    );
  }
}
