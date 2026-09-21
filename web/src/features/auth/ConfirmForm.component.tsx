import Link from 'next/link';
export function ConfirmForm({
  dispatch,
  pending,
  message,
  token,
  type,
  isRecovery,
}: {
  dispatch: (form: FormData) => void;
  pending: boolean;
  message: string;
  token: string;
  type: string;
  isRecovery: boolean;
}) {
  return (
    <form action={dispatch} className="space-y-5">
      <input type="hidden" name="token_hash" value={token} />
      <input type="hidden" name="type" value={type} />
      <button
        type="submit"
        disabled={pending}
        className="btn btn-primary min-h-11 w-full"
      >
        {pending
          ? 'Verifying…'
          : isRecovery
            ? 'Continue to reset password'
            : 'Confirm email'}
      </button>
      <p role="status" className="text-sm">
        {message}
      </p>
      <Link
        className="link block text-center text-sm"
        href={isRecovery ? '/forgot-password' : '/login'}
      >
        Request a new email
      </Link>
    </form>
  );
}
