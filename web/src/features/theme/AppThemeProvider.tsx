'use client';

import { ThemeProvider } from 'next-themes';
import type { ReactNode } from 'react';
import { DAISY_THEME_MAP, THEME_NAMES } from './theme.utils';

export function AppThemeProvider({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider
      attribute="data-theme"
      defaultTheme="system"
      enableSystem
      themes={Object.values(THEME_NAMES)}
      value={DAISY_THEME_MAP}
    >
      {children}
    </ThemeProvider>
  );
}
