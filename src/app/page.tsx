import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Pactly: Catch what your AI sales agent promises",
  description:
    "Pactly reads every conversation your AI sales agent has with customers, extracts every price quote, discount, timeline, and feature promise, and flags anything that breaks company policy.",
};

const STEPS = [
  {
    title: "Send it a conversation",
    body: "Paste a transcript by hand, or connect your agent's backend to the API so every conversation is sent the moment it ends.",
  },
  {
    title: "Claude extracts every promise",
    body: "Every price quote, discount, delivery date, and feature guarantee your agent made, pulled out automatically. Nothing gets skipped.",
  },
  {
    title: "Checked against your policy",
    body: "Max discount, delivery window, custom rules, and the products you actually offer. Set it once and it's checked every time after.",
  },
  {
    title: "Risks land in your audit log",
    body: "See exactly what was promised, what broke policy, and why. Searchable, filterable, exportable.",
  },
];

const FEATURES = [
  {
    title: "Automatic ingestion",
    body: "A single API endpoint your agent's backend calls the moment a conversation ends. No one has to remember to check.",
  },
  {
    title: "Policy from a document",
    body: "Paste your existing policy doc and Claude fills in the discount limit, delivery window, and rules for you to review.",
  },
  {
    title: "Approved offerings check",
    body: "List what you actually sell. Anything promised that isn't on the list gets flagged, even if no number was broken.",
  },
  {
    title: "A real audit trail",
    body: "Every conversation and every flag stays on record, searchable, and exportable as CSV. It doesn't just disappear into a chat log.",
  },
];

export default async function LandingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/dashboard");

  return (
    <div className="bg-white">
      <nav className="mx-auto flex max-w-5xl items-center justify-between px-6 py-6">
        <span className="text-lg font-bold text-slate-900">Pactly</span>
        <Link
          href="/login"
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-700"
        >
          Sign in
        </Link>
      </nav>

      <header className="mx-auto max-w-3xl px-6 pb-16 pt-8 text-center sm:pb-24 sm:pt-16">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-5xl">
          Your AI sales agent makes promises. <br className="hidden sm:block" />
          Someone should check them.
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-base text-slate-600 sm:text-lg">
          Pactly reads every conversation your agent has with a customer, extracts every price
          quote, discount, timeline, and feature promise, and flags anything that breaks your
          company&apos;s policy.
        </p>
        <div className="mt-8 flex justify-center">
          <Link
            href="/login"
            className="rounded-md bg-slate-900 px-6 py-3 text-base font-semibold text-white shadow-sm hover:bg-slate-700"
          >
            Start auditing, free
          </Link>
        </div>
      </header>

      <section className="border-t border-slate-100 bg-slate-50 py-16 sm:py-24">
        <div className="mx-auto max-w-2xl px-6">
          <h2 className="text-2xl font-bold text-slate-900 sm:text-3xl">How it works</h2>
          <ol className="mt-10 space-y-8">
            {STEPS.map((step, i) => (
              <li key={step.title} className="flex gap-4">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-900 text-sm font-bold text-white">
                  {i + 1}
                </span>
                <div>
                  <h3 className="font-semibold text-slate-900">{step.title}</h3>
                  <p className="mt-1 text-sm text-slate-600">{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="py-16 sm:py-24">
        <div className="mx-auto max-w-5xl px-6">
          <h2 className="text-2xl font-bold text-slate-900 sm:text-3xl">What you get</h2>
          <div className="mt-10 grid gap-6 sm:grid-cols-2">
            {FEATURES.map((feature) => (
              <div key={feature.title} className="rounded-lg border border-slate-200 p-6">
                <h3 className="mb-2 font-semibold text-slate-900">{feature.title}</h3>
                <p className="text-sm text-slate-600">{feature.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-slate-100 bg-slate-900 py-16 sm:py-24">
        <div className="mx-auto max-w-2xl px-6 text-center">
          <h2 className="text-2xl font-bold text-white sm:text-3xl">
            Catch a bad promise before it becomes a broken one.
          </h2>
          <div className="mt-8 flex justify-center">
            <Link
              href="/login"
              className="rounded-md bg-white px-6 py-3 text-base font-semibold text-slate-900 shadow-sm hover:bg-slate-100"
            >
              Start auditing, free
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-100 py-8">
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-3 px-6 text-sm text-slate-500 sm:flex-row">
          <span>© {new Date().getFullYear()} Pactly</span>
          <div className="flex gap-4">
            <Link href="/privacy" className="hover:text-slate-600">
              Privacy
            </Link>
            <Link href="/terms" className="hover:text-slate-600">
              Terms
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
