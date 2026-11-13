import type { AssistantProposal, AssistantProposalPreview } from './types';

/** The "Preview changes" box: shows what the assistant wants to change and the apply / cancel buttons. */
export function ProposalCard({
  proposal,
  proposalPreview,
  sending,
  onApply,
  onRepair,
  onAskAlternative,
  onCancel,
}: {
  proposal: AssistantProposal;
  proposalPreview: AssistantProposalPreview | null;
  sending: boolean;
  onApply: () => void;
  onRepair: () => void;
  onAskAlternative: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="assistant-proposal" aria-label="Proposed schedule changes">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[11px] font-extrabold uppercase tracking-[0.06em]" style={{ color: 'var(--accent)' }}>
            Preview changes
          </p>
          {proposal.title && <p className="mt-1 text-[12.5px] font-bold">{proposal.title}</p>}
          {proposal.summary && (
            <p className="mt-1 text-[11.5px] leading-relaxed" style={{ color: 'var(--muted)' }}>
              {proposal.summary}
            </p>
          )}
        </div>
        <span className="pill">{proposal.changes.length} change{proposal.changes.length === 1 ? '' : 's'}</span>
      </div>

      <div className="mt-2.5 space-y-1.5">
        {(proposalPreview?.changes ?? proposal.changes.map((change) => ({
          title: change.label || (
            change.type === 'set_meeting'
              ? `${change.courseId} · ${change.meetingType}`
              : change.type === 'add_course'
                ? `Add ${change.courseId}`
                : `Remove ${change.courseId}`
          ),
          before: undefined,
          after: undefined,
          reason: change.reason,
        }))).map((change, index) => (
          <div key={index} className="assistant-proposal-row assistant-proposal-diff">
            <div className="min-w-0 flex-1">
              <strong>{change.title}</strong>
              {(change.before || change.after) && (
                <div className="assistant-before-after">
                  <span><small>Before</small>{change.before || '—'}</span>
                  <b aria-hidden>→</b>
                  <span><small>After</small>{change.after || '—'}</span>
                </div>
              )}
              {change.reason && <p className="assistant-change-reason">{change.reason}</p>}
            </div>
          </div>
        ))}
      </div>

      {proposalPreview?.stats && (
        <div className="assistant-proposal-stats mt-3">
          <span><strong>Campus days</strong><small>{proposalPreview.stats.campusDays}</small></span>
          <span><strong>Gaps</strong><small>{proposalPreview.stats.gaps}</small></span>
          <span><strong>Credits</strong><small>{proposalPreview.stats.credits}</small></span>
          <span><strong>Conflicts</strong><small>{proposalPreview.stats.conflicts}</small></span>
        </div>
      )}

      {proposalPreview && !proposalPreview.ok && (
        <div className="assistant-error mt-3" role="alert">
          <div>{proposalPreview.message || 'This proposal cannot be applied safely.'}</div>
          {proposalPreview.conflict && (
            <details className="assistant-conflict-details">
              <summary>Explain conflict</summary>
              <strong>{proposalPreview.conflict.title}</strong>
              {proposalPreview.conflict.details.map((detail) => <span key={detail}>{detail}</span>)}
            </details>
          )}
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          className="btn btn-accent btn-tap flex-1"
          onClick={onApply}
          disabled={proposalPreview?.ok === false}
        >
          {proposalPreview?.ok === false ? 'Can’t apply — blocked' : 'Apply changes'}
        </button>
        {proposalPreview?.ok === false && (
          <button type="button" className="btn btn-tap" onClick={onRepair} disabled={sending}>
            Repair conflict
          </button>
        )}
        <button type="button" className="btn btn-tap" onClick={onAskAlternative} disabled={sending}>
          Show another option
        </button>
        <button type="button" className="btn btn-tap" onClick={onCancel}>
          Cancel
        </button>
      </div>
      <p className="mt-2 text-[9.5px]" style={{ color: 'var(--muted-2)' }}>
        The planner validates every course, section, conflict and credit limit again before applying.
      </p>
    </div>
  );
}
