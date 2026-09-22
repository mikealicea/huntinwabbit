import { describe, expect, it, vi } from 'vitest';

const { identity } = vi.hoisted(() => ({ identity: vi.fn() }));
vi.mock('@/features/auth/auth.server.index', () => ({
  serverIdentity: identity,
}));
vi.mock('next/navigation', () => ({
  redirect: (path: string): never => {
    throw new Error(`REDIRECT:${path}`);
  },
}));

import { HomePageContainer } from './HomePage.container';

describe('home redirect', () => {
  it.each([
    ['anonymous', '/login'],
    ['authenticated', '/app'],
    ['unavailable', '/auth/unavailable?next=%2Fapp'],
  ])('routes %s visitors to %s', async (status, destination) => {
    identity.mockResolvedValue({ status, userId: 'fictional' });
    await expect(HomePageContainer()).rejects.toThrow(
      `REDIRECT:${destination}`,
    );
  });
});
