import { useEffect, useRef, useState } from 'react';
import { buildShareUrl, type ShareExtras } from '../lib/share';
import type { Course } from '../types';
import type { PickState } from '../lib/picks';
import { SHARE_TEXT, SHARE_TITLE } from '../config/semester';

interface Props {
  majorId: string;
  courses: Course[];
  picks: PickState;
  disabled?: boolean;
  className?: string;
  label?: string;
  extras?: ShareExtras;
  shareTitle?: string;
  /** Marks the page's primary share trigger so keyboard/command actions can invoke it. */
  dataSharePrimary?: boolean;
  /** Optional state summary shown inside the modal (Version B's clearer share sheet). */
  summary?: { majorName: string; selectedCount: number; totalCredits: number; conflictFree: boolean };
}

export function ShareSchedule({ majorId, courses, picks, disabled, className, label, extras, shareTitle, dataSharePrimary, summary }: Props) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const canShare = typeof navigator !== 'undefined' && !!navigator.share;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const openPanel = () => {
    setUrl(buildShareUrl(majorId, courses, picks, extras));
    setCopied(false);
    setOpen(true);
  };

  const copyLink = async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        inputRef.current?.select();
        document.execCommand('copy');
      }
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      inputRef.current?.select();
    }
  };

  const nativeShare = async () => {
    if (!navigator.share) return;
    try {
      await navigator.share({ title: shareTitle ?? SHARE_TITLE, text: SHARE_TEXT, url });
    } catch {
      /* user cancelled the native share sheet — nothing to do */
    }
  };

  return (
    <>
      <button
        type="button"
        className={className ?? 'btn btn-accent'}
        onClick={openPanel}
        disabled={disabled}
        title="Generate a link that restores this exact schedule for anyone who opens it"
        data-share-primary={dataSharePrimary ? 'true' : undefined}
      >
        {label ?? '🔗 Share Schedule'}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[100] flex items-end justify-center bg-black/55 p-0 sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Share schedule"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div className="panel max-h-[85vh] w-full max-w-[480px] overflow-y-auto rounded-b-none p-4 sm:rounded-2xl sm:p-5">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-[14.5px] font-bold tracking-tight">Share Schedule</h2>
              <button
                type="button"
                className="btn px-2.5 py-1.5"
                onClick={() => setOpen(false)}
                aria-label="Close share dialog"
              >
                ✕
              </button>
            </div>
            <p className="mt-1.5 text-[12px] leading-relaxed" style={{ color: 'var(--muted)' }}>
              Anyone who opens this link sees the exact lecture, lab and tutorial times you picked — no login needed, and
              nothing but course/section choices (plus any filters or preferences you set) is stored in the URL.
            </p>

            {summary && (
              <div
                className="mt-3 rounded-xl border px-3.5 py-2.5"
                style={{ background: 'var(--surface)', borderColor: 'var(--line-soft)' }}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-[12.5px] font-bold">{summary.majorName}</p>
                    <p className="text-[11px]" style={{ color: 'var(--muted)' }}>
                      {summary.selectedCount} course{summary.selectedCount === 1 ? '' : 's'} · {summary.totalCredits} credits
                    </p>
                  </div>
                  <span
                    className="pill"
                    style={
                      summary.conflictFree
                        ? { color: 'var(--ok)', borderColor: 'color-mix(in srgb, var(--ok) 40%, var(--line))' }
                        : { color: 'var(--warn)', borderColor: 'var(--warn-line)' }
                    }
                  >
                    {summary.conflictFree ? '✓ Conflict-free' : '⚠ Has conflicts'}
                  </span>
                </div>
              </div>
            )}

            <div className="mt-3.5 flex flex-col gap-2">
              <input
                ref={inputRef}
                readOnly
                value={url}
                onFocus={(e) => e.currentTarget.select()}
                className="select cursor-text text-[12.5px]"
                style={{ fontFamily: "'IBM Plex Mono', ui-monospace, 'SFMono-Regular', Menlo, monospace" }}
                aria-label="Shareable schedule link"
              />
              <div className="flex flex-col gap-2 sm:flex-row">
                <button type="button" className="btn btn-accent flex-1 btn-tap" onClick={copyLink}>
                  {copied ? '✓ Copied' : 'Copy Link'}
                </button>
                {canShare && (
                  <button type="button" className="btn flex-1 btn-tap" onClick={nativeShare}>
                    Share…
                  </button>
                )}
              </div>
            </div>

            {copied && (
              <p className="mt-2.5 text-center text-[12.5px] font-bold" style={{ color: 'var(--ok)' }} role="status" aria-live="polite">
                Schedule link copied!
              </p>
            )}
          </div>
        </div>
      )}
    </>
  );
}
