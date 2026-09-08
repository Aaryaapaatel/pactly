import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service — Pactly",
  description: "The terms for using Pactly.",
};

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <Link href="/" className="text-sm font-medium text-slate-600 hover:text-slate-900">
        ← Back
      </Link>
      <h1 className="mb-2 mt-6 text-2xl font-bold text-slate-900">Terms of Service</h1>
      <p className="mb-8 text-sm text-slate-400">Last updated {new Date().toLocaleDateString("en-US")}</p>

      <div className="space-y-6 text-sm leading-6 text-slate-700">
        <p>
          This is a plain-language starting point, not a substitute for legal advice — have a
          lawyer review and adapt this before relying on it for a real product.
        </p>

        <section>
          <h2 className="mb-2 font-semibold text-slate-900">What Pactly does</h2>
          <p>
            Pactly extracts promises from conversation transcripts using an AI model and checks
            them against policy rules you configure. It is a decision-support tool — it does not
            guarantee that every promise is correctly identified or every flag is accurate. Review
            flagged items before acting on them.
          </p>
        </section>

        <section>
          <h2 className="mb-2 font-semibold text-slate-900">Your responsibilities</h2>
          <ul className="list-disc space-y-1 pl-5">
            <li>Keep your account credentials and API keys confidential.</li>
            <li>
              Only submit conversation data you&apos;re authorized to process, including any
              required customer consent or notice.
            </li>
            <li>Don&apos;t use the service for anything unlawful.</li>
          </ul>
        </section>

        <section>
          <h2 className="mb-2 font-semibold text-slate-900">No warranty</h2>
          <p>
            The service is provided &ldquo;as is,&rdquo; without warranty of any kind. Extraction
            and risk-flagging are AI-assisted and can be wrong.
          </p>
        </section>

        <section>
          <h2 className="mb-2 font-semibold text-slate-900">Changes</h2>
          <p>These terms may be updated from time to time.</p>
        </section>
      </div>
    </div>
  );
}
