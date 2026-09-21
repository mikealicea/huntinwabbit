import type { SupabaseClient } from '@supabase/supabase-js';

export type AuthClient = Pick<SupabaseClient, 'auth'>;
export type AuthIdentity =
  | { status: 'authenticated'; userId: string }
  | { status: 'anonymous' }
  | { status: 'unavailable' };

export async function readIdentity(client: AuthClient): Promise<AuthIdentity> {
  try {
    const { data, error } = await client.auth.getUser();
    if (error) {
      if (
        error.name === 'AuthSessionMissingError' ||
        error.status === 400 ||
        error.status === 401 ||
        error.status === 403
      )
        return { status: 'anonymous' };
      return { status: 'unavailable' };
    }
    if (!data.user?.id) return { status: 'anonymous' };
    return { status: 'authenticated', userId: data.user.id };
  } catch {
    return { status: 'unavailable' };
  }
}
