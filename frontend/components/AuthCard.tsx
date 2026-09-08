export function AuthCard({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center gap-7 px-5 py-12 sm:py-16">
      {/*
        The form sits in a white card on the alabaster ground, the way the
        design frames every data-entry surface. Without it the inputs float
        with nothing holding them together, which on a page whose only content
        is a form reads as an unfinished screen.
      */}
      <div className="rounded-2xl border border-border bg-card p-6 shadow-[0_18px_50px_-32px_rgba(20,32,72,0.3)] sm:p-10">
        <div className="mb-9 flex flex-col gap-3">
          <h1 className="text-2xl font-bold">{title}</h1>
          {subtitle && <p className="text-sm leading-relaxed text-muted">{subtitle}</p>}
        </div>

        {children}
      </div>

      {footer && <div className="text-center text-sm text-muted">{footer}</div>}
    </main>
  );
}
