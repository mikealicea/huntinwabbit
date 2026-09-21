import { combineReducers, configureStore } from '@reduxjs/toolkit';
import { helloApi } from '@/features/hello/hello.index';

const rootReducer = combineReducers({
  [helloApi.reducerPath]: helloApi.reducer,
});
export type RootState = ReturnType<typeof rootReducer>;

export function makeStore(preloadedState?: Partial<RootState>) {
  return configureStore({
    reducer: rootReducer,
    preloadedState,
    middleware: (defaults) => defaults().concat(helloApi.middleware),
    devTools: process.env.NODE_ENV !== 'production',
  });
}
export type AppStore = ReturnType<typeof makeStore>;
export type AppDispatch = AppStore['dispatch'];
