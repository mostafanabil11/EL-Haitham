import Link from 'next/link';

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
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-5 py-10">
      <Link href="/" className="text-sm text-muted transition hover:text-foreground">
        &#8594; العودة للرئيسية
      </Link>

      <div className="flex flex-col gap-1.5">
        <h1 className="text-2xl font-bold">{title}</h1>
        {subtitle && <p className="text-sm text-muted">{subtitle}</p>}
      </div>

      {children}

      {footer && <div className="text-center text-sm text-muted">{footer}</div>}
    </main>
  );
}
