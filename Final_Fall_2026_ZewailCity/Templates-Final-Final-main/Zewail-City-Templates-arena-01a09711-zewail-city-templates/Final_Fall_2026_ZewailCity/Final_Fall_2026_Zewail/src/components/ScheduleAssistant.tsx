import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import type { AssistantLockAction, AssistantMessage, AssistantProposal, AssistantProposalPreview } from './schedule-assistant/types';
import { ProposalCard } from './schedule-assistant/ProposalCard';

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

    if (/^(?:where(?: is (?:it|the preview))?|feen|fen|فين)[?.!؟]*$/i.test(clean)) {
      setMessages((current) => [...current,
        { role: 'user', text: clean },
        { role: 'assistant', text: proposal
          ? `The preview for ${proposal.title || 'your change'} is directly below this message. Check it and press “Apply changes” if it is valid; nothing changes before you confirm.`
          : 'There is no pending preview in this chat. Select the course and its current section, then ask for the change again.' },
      ]);
      setInput('');
      setError(null);
      window.setTimeout(() => document.querySelector('.assistant-proposal')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 50);
      return;
    }

    const previous = messages.slice(-6);
    setMessages((m) => [...m, { role: 'user', text: clean }]);
    setInput('');
    setError(null);
    setSending(true);

    try {
      const requestBody = JSON.stringify({ message: clean, history: previous, context });
      let response: Response | undefined;
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          response = await fetch('/api/assistant', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: requestBody,
          });
          if (response.status !== 504 || attempt === 1) break;
        } catch (requestError) {
          if (attempt === 1 || !navigator.onLine) throw requestError;
        }
        await new Promise((resolve) => window.setTimeout(resolve, 700));
      }
      if (!response) throw new Error('Could not connect to the assistant. Check your connection and try again.');

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

      const validation = data.proposal?.changes?.length ? onPreviewProposal?.(data.proposal) : null;
      if (validation?.ok === false) {
        setMessages((m) => [...m, { role: 'assistant', text: `I found the requested section, but the planner blocked this preview: ${validation.message ?? 'The change cannot be applied safely.'}` }]);
        if (data.proposal) setProposal(data.proposal);
        return;
      }
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
      } else if (/\b(?:change|switch|swap|replace|move)\b|غي[ّرر]|بد[ّلل]/i.test(clean)) {
        setProposal(null);
      }
    } catch (err) {
      setMessages((current) => current.at(-1)?.role === 'user' && current.at(-1)?.text === clean
        ? current.slice(0, -1) : current);
      setInput((current) => current || clean);
      setError(err instanceof TypeError
        ? 'Could not connect to the assistant. Check your connection and try again.'
        : err instanceof Error ? err.message : 'The assistant could not answer right now.');
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
                  <span className="pill">Beta</span>
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
                <ProposalCard
                  proposal={proposal}
                  proposalPreview={proposalPreview}
                  sending={sending}
                  onApply={applyProposal}
                  onRepair={repairConflict}
                  onAskAlternative={askAlternative}
                  onCancel={() => setProposal(null)}
                />
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
