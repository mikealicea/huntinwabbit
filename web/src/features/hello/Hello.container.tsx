'use client';
import { Hello } from './Hello.component';
import { helloApi } from './hello.client';

export function HelloContainer() {
  const [request, result] = helloApi.useLazyHelloQuery();
  const unauthorized =
    result.error && 'status' in result.error && result.error.status === 401;
  return (
    <Hello
      pending={result.isFetching}
      message={result.data?.message}
      error={
        result.isError
          ? unauthorized
            ? 'Your session has expired. Please log in again.'
            : 'Unable to reach the API. Please try again.'
          : undefined
      }
      onRequest={() => {
        void request();
      }}
    />
  );
}
