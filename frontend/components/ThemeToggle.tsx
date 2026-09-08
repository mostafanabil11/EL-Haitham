'use client';

import { useSyncExternalStore } from 'react';

export type Theme = 'light' | 'dark' | 'system';

export const THEME_STORAGE_KEY = 'theme';

// Fired on the window after a change, so every mounted toggle re-reads. The
// browser's own 'storage' event only fires in *other* tabs, never the one that
// wrote the value.
const THEME_EVENT = 'themechange';

const ORDER: Theme[] = ['light', 'dark', 'system'];

const LABEL: Record<Theme, string> = {
  light: 'فاتح',
  dark: 'داكن',
  system: 'حسب النظام',
};

function readStored(): Theme {
  try {
    const value = localStorage.getItem(THEME_STORAGE_KEY);
    if (value === 'light' || value === 'dark') return value;
  } catch {
    /* private windows and blocked site data both throw; treat as no preference */
  }
  return 'system';
}

/**
 * Applies a choice to the document and remembers it.
 *
 * 'system' removes the attribute rather than writing a value, which hands
 * control back to the `prefers-color-scheme` rule in globals.css. Resolving
 * "system" to a concrete light/dark here and storing that instead would freeze
 * the palette at whatever the OS happened to be on the day it was chosen.
 */
function apply(theme: Theme) {
  const root = document.documentElement;
  if (theme === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', theme);

  try {
    if (theme === 'system') localStorage.removeItem(THEME_STORAGE_KEY);
    else localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // The theme still applies to this page view; it just is not remembered.
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener('storage', onChange);
  window.addEventListener(THEME_EVENT, onChange);
  return () => {
    window.removeEventListener('storage', onChange);
    window.removeEventListener(THEME_EVENT, onChange);
  };
}

// The server has no way to know the reader's preference, so it renders the
// placeholder. useSyncExternalStore hydrates with this value and then swaps to
// the real one, which is exactly the handoff this hook exists for — and is why
// this is not a useEffect that sets state.
const serverSnapshot = () => null;

export function ThemeToggle({ className = '' }: { className?: string }) {
  const theme = useSyncExternalStore<Theme | null>(subscribe, readStored, serverSnapshot);

  if (theme === null) {
    // Same box as the real button, so the layout does not shift on hydration.
    return <span aria-hidden className={`inline-block size-11 ${className}`} />;
  }

  const next = ORDER[(ORDER.indexOf(theme) + 1) % ORDER.length];

  return (
    <button
      type="button"
      onClick={() => {
        apply(next);
        window.dispatchEvent(new Event(THEME_EVENT));
      }}
      title={`المظهر: ${LABEL[theme]} — اضغط للتبديل إلى ${LABEL[next]}`}
      aria-label={`المظهر الحالي ${LABEL[theme]}. اضغط للتبديل إلى ${LABEL[next]}`}
      className={`inline-flex size-11 items-center justify-center rounded-xl
        text-muted transition hover:bg-trough hover:text-foreground ${className}`}
    >
      <ThemeIcon theme={theme} />
    </button>
  );
}

function ThemeIcon({ theme }: { theme: Theme }) {
  const common = {
    width: 16,
    height: 16,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  };

  if (theme === 'light') {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
      </svg>
    );
  }

  if (theme === 'dark') {
    return (
      <svg {...common}>
        <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
      </svg>
    );
  }

  // 'system' — a monitor, the conventional way to say "whatever the device says".
  return (
    <svg {...common}>
      <rect x="2" y="4" width="20" height="13" rx="2" />
      <path d="M8 21h8M12 17v4" />
    </svg>
  );
}
