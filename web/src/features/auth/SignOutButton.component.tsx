export function SignOutButton({
  dispatch,
  pending,
  message,
}: {
  dispatch: (form: FormData) => void;
  pending: boolean;
  message: string;
}) {
  return (
    <form action={dispatch} className="max-w-xs">
      <button
        type="submit"
        disabled={pending}
        className="btn btn-ghost min-h-11"
      >
        {pending ? 'Signing out…' : 'Sign out'}
      </button>
      <p role="status" className="text-sm">
        {message}
      </p>
    </form>
  );
}
