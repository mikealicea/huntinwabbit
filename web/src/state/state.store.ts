import { combineReducers, configureStore } from '@reduxjs/toolkit';
import { jobSearchReducer } from '@/features/job-search/job-search.index';
import { clockReducer } from './state.clock';

const rootReducer = combineReducers({
  jobSearch: jobSearchReducer,
  clock: clockReducer,
});
export type RootState = ReturnType<typeof rootReducer>;

export function makeStore(preloadedState?: Partial<RootState>) {
  return configureStore({
    reducer: rootReducer,
    preloadedState,
    devTools: process.env.NODE_ENV !== 'production',
  });
}

export type AppStore = ReturnType<typeof makeStore>;
export type AppDispatch = AppStore['dispatch'];
