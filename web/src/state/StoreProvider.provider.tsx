'use client';

import { type ReactNode, useEffect, useState } from 'react';
import { Provider } from 'react-redux';
import { toLocalDate } from '@/features/job-search/job-search.index';
import { dateChanged } from './state.clock';
import { makeStore, type RootState } from './state.store';

export function StoreProvider({
  children,
  preloadedState,
}: {
  children: ReactNode;
  preloadedState?: Partial<RootState>;
}) {
  // One store per mounted workspace, retained on rerender and replaced by an account key change.
  const [store] = useState(() => makeStore(preloadedState));
  useEffect(() => {
    function updateDate() {
      store.dispatch(dateChanged(toLocalDate(new Date())));
    }
    updateDate();
    const timer = window.setInterval(updateDate, 60000);
    document.addEventListener('visibilitychange', updateDate);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', updateDate);
    };
  }, [store]);
  return <Provider store={store}>{children}</Provider>;
}
