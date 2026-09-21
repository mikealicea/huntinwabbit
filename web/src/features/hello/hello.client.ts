import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import type { HelloResponse } from './hello.types';

export const helloApi = createApi({
  reducerPath: 'helloApi',
  baseQuery: fetchBaseQuery({ baseUrl: '/api/', timeout: 15000 }),
  endpoints: (builder) => ({
    hello: builder.query<HelloResponse, void>({ query: () => 'hello' }),
  }),
});
