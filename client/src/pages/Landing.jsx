import { Link } from "react-router-dom";
import { ArrowRight, Check } from "lucide-react";
import { CATEGORIES } from "../config/categories";
import { getIcon } from "../lib/icons";

export default function Landing() {
  return (
    <div className="min-h-screen bg-canvas">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-brand-800 text-sm font-semibold text-white">
            H
          </span>
          <span className="font-display text-base font-semibold text-ink-900">HR AI Platform</span>
        </div>
        <nav className="flex items-center gap-3">
          <Link
            to="/login"
            className="rounded-lg px-4 py-2 text-sm font-medium text-ink-700 hover:bg-ink-50"
          >
            Log in
          </Link>
          <Link
            to="/signup"
            className="rounded-lg bg-brand-800 px-4 py-2 text-sm font-medium text-white hover:bg-brand-900"
          >
            Get started
          </Link>
        </nav>
      </header>

      <section className="mx-auto max-w-4xl px-6 pb-16 pt-12 text-center">
        <span className="inline-flex items-center rounded-full bg-brand-100 px-3 py-1 text-xs font-medium text-brand-800">
          One subscription. Every HR problem, in one place.
        </span>
        <h1 className="mt-6 font-display text-4xl font-semibold leading-tight text-ink-950 sm:text-5xl">
          Every unresolved HR problem,
          <br className="hidden sm:block" /> mapped to a real tool.
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-ink-600">
          HR AI Platform isn't another generic HRMS. It's a growing library of focused tools —
          each one built against a specific, documented HR problem — organized into 14
          categories your team already thinks in. Subscribe once, and your whole organization
          gets access.
        </p>
        <div className="mt-8 flex items-center justify-center gap-3">
          <Link
            to="/signup"
            className="flex items-center gap-2 rounded-lg bg-brand-800 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-900"
          >
            Start your organization
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            to="/login"
            className="rounded-lg border border-ink-200 px-5 py-2.5 text-sm font-medium text-ink-700 hover:bg-ink-50"
          >
            I already have an account
          </Link>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-24">
        <div className="mb-8 flex items-end justify-between">
          <div>
            <h2 className="font-display text-xl font-semibold text-ink-900">
              14 categories. One directory.
            </h2>
            <p className="mt-1 text-sm text-ink-500">
              Every tool on the platform lives inside one of these — including a complete
              payroll suite under Administrative HR.
            </p>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {CATEGORIES.map((category) => {
            const Icon = getIcon(category.icon);
            return (
              <div key={category.id} className="card flex items-start gap-3 p-4">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
                  <Icon className="h-4.5 w-4.5" strokeWidth={1.75} />
                </span>
                <div>
                  <h3 className="text-sm font-semibold text-ink-900">{category.name}</h3>
                  <p className="mt-0.5 text-xs leading-relaxed text-ink-500">{category.tagline}</p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="border-t border-ink-100 bg-surface">
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-8 px-6 py-16 sm:grid-cols-3">
          {[
            "One subscription unlocks every category — no per-tool pricing.",
            "Every tool traces back to a documented, real HR problem.",
            "Built to add AI-powered tools without ever rebuilding the app.",
          ].map((point) => (
            <div key={point} className="flex items-start gap-3">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-700">
                <Check className="h-3 w-3" strokeWidth={2.5} />
              </span>
              <p className="text-sm leading-relaxed text-ink-700">{point}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="mx-auto max-w-6xl px-6 py-8 text-xs text-ink-400">
        © {new Date().getFullYear()} HR AI Platform. All rights reserved.
      </footer>
    </div>
  );
}
