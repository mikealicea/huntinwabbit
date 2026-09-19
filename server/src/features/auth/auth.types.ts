export interface AuthIdentity {
  userId: string;
}

export type VerifyAccessToken = (token: string) => Promise<AuthIdentity>;

export interface AuthLocals {
  identity: AuthIdentity;
}
