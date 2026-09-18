'use client';

import { useTheme } from 'next-themes';
import { useSyncExternalStore } from 'react';
import { THEME_NAMES } from './theme.utils';

function subscribe() {
  return () => undefined;
}

function useIsHydrated() {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}

export function ThemeSwitch() {
  const isHydrated = useIsHydrated();
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme === THEME_NAMES.dark;
  const nextTheme = isDark ? THEME_NAMES.light : THEME_NAMES.dark;

  return (
    <button
      type="button"
      className="btn btn-ghost min-h-11"
      disabled={!isHydrated}
      aria-label={isHydrated ? `Switch to ${nextTheme} theme` : 'Theme loading'}
      onClick={() => setTheme(nextTheme)}
    >
      {isHydrated ? `${isDark ? 'Light' : 'Dark'} mode` : 'Theme'}
    </button>
  );
}
