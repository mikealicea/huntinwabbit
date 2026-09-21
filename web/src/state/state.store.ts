import { combineReducers, configureStore } from '@reduxjs/toolkit';
import { postingApi } from '@/features/job-api/job-api.index';
import { clockReducer } from './state.clock';

const rootReducer = combineReducers({
  clock: clockReducer,
  [postingApi.reducerPath]: postingApi.reducer,
});
export type RootState = ReturnType<typeof rootReducer>;

export function makeStore(preloadedState?: Partial<RootState>) {
  return configureStore({
    reducer: rootReducer,
    preloadedState,
    middleware: (defaults) => defaults().concat(postingApi.middleware),
    devTools: process.env.NODE_ENV !== 'production',
  });
}

export type AppStore = ReturnType<typeof makeStore>;
export type AppDispatch = AppStore['dispatch'];
