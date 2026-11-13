import { useEffect, useState } from 'react';

export type Theme = 'dark' | 'light';

const STORAGE_KEY = 'tsp-theme';

export function useTheme(): [Theme, (t: Theme) => void] {
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window === 'undefined') return 'dark';
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored === 'light' || stored === 'dark' ? stored : 'dark';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    document.body.setAttribute('data-theme', theme);
    try {
      window.localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      /* storage unavailable — theme simply won't persist */
    }
  }, [theme]);

  return [theme, setTheme];
}

export function ThemeToggle({ theme, onChange }: { theme: Theme; onChange: (t: Theme) => void }) {
  return (
    <div
      className="flex items-center gap-1 rounded-full border p-1"
      style={{ borderColor: 'var(--line)', background: 'var(--surface)' }}
      role="group"
      aria-label="Theme"
    >
      <button
        type="button"
        onClick={() => onChange('dark')}
        aria-pressed={theme === 'dark'}
        className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12.5px] font-semibold transition-colors"
        style={{
          background: theme === 'dark' ? 'var(--surface-2)' : 'transparent',
          color: theme === 'dark' ? 'var(--ink)' : 'var(--muted)',
        }}
      >
        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor" aria-hidden>
          <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
        </svg>
        Dark
      </button>
      <button
        type="button"
        onClick={() => onChange('light')}
        aria-pressed={theme === 'light'}
        className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12.5px] font-semibold transition-colors"
        style={{
          background: theme === 'light' ? 'var(--surface-2)' : 'transparent',
          color: theme === 'light' ? 'var(--ink)' : 'var(--muted)',
        }}
      >
        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </svg>
        Light
      </button>
    </div>
  );
}
