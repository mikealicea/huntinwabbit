import Link from 'next/link';
export function RoleNotFound() {
  return (
    <section className="mx-auto max-w-xl py-16">
      <h1 className="text-3xl font-bold">Role not found</h1>
      <p className="my-5 leading-relaxed">
        This saved role could not be found in your account. Return to the board
        to see your saved opportunities.
      </p>
      <Link href="/app" className="btn btn-primary min-h-11">
        Return to search board
      </Link>
    </section>
  );
}
