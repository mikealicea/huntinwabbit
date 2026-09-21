export function UnavailableSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="card border border-base-300 bg-base-100 shadow-sm">
      <div className="card-body p-5 sm:p-6">
        <h2 className="card-title">{title}</h2>
        <p className="text-sm text-base-content/75">{children}</p>
        <span className="badge badge-outline">Not available yet</span>
      </div>
    </section>
  );
}
