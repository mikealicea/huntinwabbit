'use client';

import { useTheme } from 'next-themes';
import { useSyncExternalStore } from 'react';
import { ThemeSwitch } from './ThemeSwitch.component';
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

export function ThemeSwitchContainer() {
  const isHydrated = useIsHydrated();
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme === THEME_NAMES.dark;
  const nextTheme = isDark ? THEME_NAMES.light : THEME_NAMES.dark;
  return (
    <ThemeSwitch
      isHydrated={isHydrated}
      isDark={isDark}
      nextTheme={nextTheme}
      onToggle={() => setTheme(nextTheme)}
    />
  );
}
