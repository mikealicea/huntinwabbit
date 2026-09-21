export type HelloResponse = { message: string };

export function isHelloResponse(value: unknown): value is HelloResponse {
  return (
    typeof value === 'object' &&
    value !== null &&
    'message' in value &&
    value.message === 'Hello, world!'
  );
}
