'use client';

import {
  createContext,
  type Dispatch,
  type ReactNode,
  useContext,
  useEffect,
  useReducer,
  useState,
} from 'react';
import { createSampleState } from './job-search.fixtures';
import { toLocalDate } from './job-search.selectors';
import { jobSearchReducer } from './job-search.state';
import type { JobSearchAction, JobSearchState } from './job-search.types';

const JobSearchContext = createContext<{
  state: JobSearchState;
  dispatch: Dispatch<JobSearchAction>;
  today: string;
} | null>(null);

export function JobSearchProvider({
  children,
  initialState,
}: {
  children: ReactNode;
  initialState?: JobSearchState;
}) {
  const [state, dispatch] = useReducer(
    jobSearchReducer,
    initialState,
    (seed) => seed ?? createSampleState(),
  );
  const [today, setToday] = useState('');
  useEffect(() => {
    function updateDate() {
      setToday(toLocalDate(new Date()));
    }
    updateDate();
    const timer = window.setInterval(updateDate, 60000);
    document.addEventListener('visibilitychange', updateDate);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', updateDate);
    };
  }, []);
  return (
    <JobSearchContext value={{ state, dispatch, today }}>
      {children}
    </JobSearchContext>
  );
}

export function useJobSearch() {
  const context = useContext(JobSearchContext);
  if (!context)
    throw new Error('Job-search features require JobSearchProvider.');
  return context;
}
