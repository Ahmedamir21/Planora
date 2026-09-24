import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import type { MeetingType } from '../types';

export interface AssistantMessage {
  role: 'user' | 'assistant';
  text: string;
}

export type AssistantProposalChange =
  | {
      type: 'set_meeting';
      courseId: string;
      meetingType: MeetingType;
      meetingId: string;
      label?: string;
      reason?: string;
    }
  | {
      type: 'add_course';
      courseId: string;
      label?: string;
      reason?: string;
    }
  | {
      type: 'remove_course';
      courseId: string;
      label?: string;
      reason?: string;
    };

export interface AssistantProposal {
  title?: string;
  summary?: string;
  changes: AssistantProposalChange[];
}

export interface AssistantLockAction {
  action: 'lock_course' | 'unlock_course' | 'lock_component' | 'unlock_component';
  courseId: string;
  meetingType?: MeetingType;
}

export interface AssistantProposalPreview {
  ok: boolean;
  message?: string;
  stats?: {
    campusDays: string;
    gaps: string;
    credits: string;
    conflicts: string;
  };
  changes?: Array<{
    title: string;
    before?: string;
    after?: string;
    reason?: string;
  }>;
  conflict?: {
    title: string;
    details: string[];
  };
}

interface Props {
  context: Record<string, unknown>;
  onPreviewProposal?: (proposal: AssistantProposal) => AssistantProposalPreview;
  onApplyProposal?: (proposal: AssistantProposal) => { ok: boolean; message: string };
  constraints?: string[];
  onAddConstraints?: (constraints: string[]) => void;
  onRemoveConstraint?: (constraint: string) => void;
  onLockActions?: (actions: AssistantLockAction[]) => void;
}

const QUICK_PROMPTS = [
  'Reduce gaps',
  'Fewer campus days',
  'Finish earlier',
  'Avoid 8 AM',
  'Suggest another course',
];

export function ScheduleAssistant({ context, onPreviewProposal, onApplyProposal, constraints = [], onAddConstraints, onRemoveConstraint, onLockActions }: Props) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [proposal, setProposal] = useState<AssistantProposal | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!open) return;
    const id = window.setTimeout(() => inputRef.current?.focus(), 100);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.clearTimeout(id);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, sending, open, proposal]);

  const sendMessage = async (message: string) => {
    const clean = message.trim();
    if (!clean || sending) return;

    const previous = messages.slice(-6);
    setMessages((m) => [...m, { role: 'user', text: clean }]);
    setInput('');
    setError(null);
    setProposal(null);
    setSending(true);

    try {
      const response = await fetch('/api/assistant?v=3', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: clean, history: previous, context }),
      });

      const raw = await response.text();
      let data: { text?: string; error?: string; proposal?: AssistantProposal | null; constraintsAdd?: string[]; lockActions?: AssistantLockAction[] } = {};

      try {
        data = raw ? JSON.parse(raw) : {};
      } catch {
        throw new Error(
          response.status === 404
            ? 'The AI endpoint is not available on this deployment yet.'
            : 'The assistant service returned an unexpected response.',
        );
      }

      if (!response.ok) throw new Error(data.error || 'The assistant could not answer right now.');
      if (!data.text) throw new Error('The assistant returned an empty response.');

      setMessages((m) => [...m, { role: 'assistant', text: data.text! }]);
      if (Array.isArray(data.constraintsAdd) && data.constraintsAdd.length > 0) {
        onAddConstraints?.(data.constraintsAdd);
      }
      if (Array.isArray(data.lockActions) && data.lockActions.length > 0) {
        onLockActions?.(data.lockActions);
      }

      if (
        data.proposal &&
        Array.isArray(data.proposal.changes) &&
        data.proposal.changes.length > 0
      ) {
        setProposal(data.proposal);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The assistant could not answer right now.');
    } finally {
      setSending(false);
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    void sendMessage(input);
  };

  const proposalPreview = proposal && onPreviewProposal ? onPreviewProposal(proposal) : null;

  const askAlternative = () => {
    const blocked = proposalPreview?.ok === false;
    const detail = blocked && proposalPreview?.message ? ` The previous proposal was blocked because: ${proposalPreview.message}` : '';
    void sendMessage(`Show me another valid conflict-free option for my last scheduling request. Do not repeat the same proposal.${detail}`);
  };

  const repairConflict = () => {
    const detail = proposalPreview?.message ? ` Current validator result: ${proposalPreview.message}` : '';
    void sendMessage(`Repair the last requested change so the final schedule is conflict-free. Keep my requested change if possible, modify only unlocked meetings, and use the fewest extra changes.${detail}`);
  };

  const applyProposal = () => {
    if (!proposal || !onApplyProposal) return;
    const result = onApplyProposal(proposal);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setProposal(null);
    setMessages((m) => [...m, { role: 'assistant', text: result.message }]);
  };

  return (
    <>
      <button
        type="button"
        className={`assistant-fab no-print ${open ? 'is-open' : ''}`}
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? 'Close Schedule Assistant' : 'Open Schedule Assistant'}
        aria-expanded={open}
      >
        <span className="assistant-fab-icon" aria-hidden>✦</span>
        <span className="assistant-fab-label">Ask Assistant</span>
      </button>

      {open && (
        <div className="assistant-layer no-print" role="presentation" onClick={(e) => e.target === e.currentTarget && setOpen(false)}>
          <section className="assistant-panel" role="dialog" aria-modal="true" aria-label="Schedule Assistant">
            <header className="assistant-header">
              <div>
                <div className="flex items-center gap-2">
                  <span className="assistant-mark" aria-hidden>✦</span>
                  <h2 className="text-[14px] font-extrabold tracking-tight">Schedule Assistant</h2>
                  <span className="pill">Beta · v3</span>
                </div>
                <p className="mt-0.5 text-[10.5px]" style={{ color: 'var(--muted)' }}>
                  Arabic · English · Franco — grounded in your current planner
                </p>
              </div>
              <button type="button" className="btn btn-tap px-3" onClick={() => setOpen(false)} aria-label="Close assistant">✕</button>
            </header>

            {constraints.length > 0 && (
              <div className="assistant-constraints" aria-label="Persistent assistant constraints">
                {constraints.map((constraint) => (
                  <span key={constraint} className="assistant-constraint-chip">
                    <span>{constraint}</span>
                    <button type="button" onClick={() => onRemoveConstraint?.(constraint)} aria-label={`Remove constraint ${constraint}`}>×</button>
                  </span>
                ))}
              </div>
            )}

            <div ref={listRef} className="assistant-messages">
              {messages.length === 0 && (
                <div className="assistant-empty">
                  <span className="assistant-empty-icon" aria-hidden>✦</span>
                  <p className="font-bold">Ask naturally.</p>
                  <p className="mt-1 text-[11.5px]" style={{ color: 'var(--muted)' }}>
                    Ask about your schedule or tell me what you want changed. Nothing changes until you confirm it.
                  </p>
                  <div className="mt-3 flex flex-wrap justify-center gap-1.5">
                    {QUICK_PROMPTS.map((prompt) => (
                      <button
                        key={prompt}
                        type="button"
                        className="btn btn-tap px-2.5 py-1.5 text-[10.5px]"
                        onClick={() => void sendMessage(prompt)}
                        disabled={sending}
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((message, index) => (
                <div key={index} className={`assistant-message ${message.role}`}>
                  <p>{message.text}</p>
                </div>
              ))}

              {proposal && (
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
                      onClick={applyProposal}
                      disabled={proposalPreview?.ok === false}
                    >
                      {proposalPreview?.ok === false ? 'Can’t apply — blocked' : 'Apply changes'}
                    </button>
                    {proposalPreview?.ok === false && (
                      <button type="button" className="btn btn-tap" onClick={repairConflict} disabled={sending}>
                        Repair conflict
                      </button>
                    )}
                    <button type="button" className="btn btn-tap" onClick={askAlternative} disabled={sending}>
                      Show another option
                    </button>
                    <button type="button" className="btn btn-tap" onClick={() => setProposal(null)}>
                      Cancel
                    </button>
                  </div>
                  <p className="mt-2 text-[9.5px]" style={{ color: 'var(--muted-2)' }}>
                    The planner validates every course, section, conflict and credit limit again before applying.
                  </p>
                </div>
              )}

              {sending && (
                <div className="assistant-message assistant">
                  <span className="assistant-typing" aria-label="Assistant is thinking"><i /><i /><i /></span>
                </div>
              )}

              {error && <div className="assistant-error" role="alert">{error}</div>}
            </div>

            <form className="assistant-compose" onSubmit={submit}>
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value.slice(0, 900))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    e.currentTarget.form?.requestSubmit();
                  }
                }}
                rows={1}
                placeholder="Ask or tell me what to change..."
                aria-label="Message Schedule Assistant"
                disabled={sending}
              />
              <button type="submit" className="assistant-send" disabled={!input.trim() || sending} aria-label="Send message">↑</button>
            </form>
            <p className="assistant-disclaimer">AI suggestions use the planner's current data. Confirm final registration details on Self-Service.</p>
          </section>
        </div>
      )}
    </>
  );
}
