'use client';

import { type ReactNode, useState } from 'react';
import { Provider } from 'react-redux';
import { makeStore, type RootState } from './state.store';

export function StoreProvider({
  children,
  preloadedState,
}: {
  children: ReactNode;
  preloadedState?: Partial<RootState>;
}) {
  // The application layout's verified account key controls the store lifetime.
  const [store] = useState(() => makeStore(preloadedState));
  return <Provider store={store}>{children}</Provider>;
}
