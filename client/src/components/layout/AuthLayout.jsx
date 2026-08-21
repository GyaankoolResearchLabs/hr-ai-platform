import { Link } from "react-router-dom";

export default function AuthLayout({ title, subtitle, children, footer }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <Link to="/" className="flex h-9 w-9 items-center justify-center rounded-md bg-brand-800 text-sm font-semibold text-white">
            H
          </Link>
          <div>
            <h1 className="font-display text-xl font-semibold text-ink-900">{title}</h1>
            {subtitle && <p className="mt-1 text-sm text-ink-500">{subtitle}</p>}
          </div>
        </div>
        <div className="card p-6">{children}</div>
        {footer && <div className="mt-5 text-center text-sm text-ink-500">{footer}</div>}
      </div>
    </div>
  );
}
