import type { ReactNode } from 'react';

export function EmptyState({
  icon,
  title,
  message,
  tone = 'neutral',
  children,
}: {
  icon: ReactNode;
  title: string;
  message: string;
  tone?: 'neutral' | 'warn';
  children?: ReactNode;
}) {
  const warn = tone === 'warn';
  return (
    <div
      className="panel fade-up flex flex-col items-center gap-3 px-6 py-12 text-center"
      style={warn ? { borderColor: 'var(--warn-line)' } : undefined}
      role={warn ? 'alert' : 'status'}
    >
      <div
        className="flex h-12 w-12 items-center justify-center rounded-2xl text-[20px]"
        style={{
          background: warn ? 'var(--warn-bg)' : 'var(--surface)',
          border: `1px solid ${warn ? 'var(--warn-line)' : 'var(--line)'}`,
          color: warn ? 'var(--warn)' : 'var(--muted)',
        }}
        aria-hidden
      >
        {icon}
      </div>
      <h3 className="text-[15px] font-bold tracking-tight">{title}</h3>
      <p className="max-w-[52ch] text-[12.5px] leading-relaxed" style={{ color: 'var(--muted)' }}>
        {message}
      </p>
      {children && <div className="mt-1 flex flex-wrap items-center justify-center gap-2">{children}</div>}
    </div>
  );
}
