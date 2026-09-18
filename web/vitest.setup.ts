import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

// jsdom does not lay out elements. This adapter lets component tests mount the
// board; actual geometry and drag interactions are verified in Playwright.
if (typeof window !== 'undefined') {
  vi.stubGlobal(
    'ResizeObserver',
    class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
}

afterEach(() => {
  cleanup();
});
