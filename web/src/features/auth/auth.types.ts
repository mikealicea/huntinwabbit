export type AuthMode =
  | 'login'
  | 'signup'
  | 'forgot-password'
  | 'reset-password';
export type AuthOperation = AuthMode | 'resend' | 'confirm' | 'signout';
export type AuthField = 'email' | 'password' | 'confirmPassword';
export type AuthState = {
  status: 'idle' | 'error' | 'success';
  message: string;
  errors?: Partial<Record<AuthField, string>>;
};
export type AuthAction = (
  previous: AuthState,
  form: FormData,
) => Promise<AuthState>;
export const initialAuthState: AuthState = { status: 'idle', message: '' };
