import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy — Pactly",
  description: "How Pactly collects, stores, and uses your data.",
};

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <Link href="/" className="text-sm font-medium text-slate-600 hover:text-slate-900">
        ← Back
      </Link>
      <h1 className="mb-2 mt-6 text-2xl font-bold text-slate-900">Privacy Policy</h1>
      <p className="mb-8 text-sm text-slate-400">Last updated {new Date().toLocaleDateString("en-US")}</p>

      <div className="space-y-6 text-sm leading-6 text-slate-700">
        <p>
          This is a plain-language description of what Pactly collects and how it&apos;s used. It
          is not a substitute for legal advice — have a lawyer review and adapt this before
          relying on it for a real product.
        </p>

        <section>
          <h2 className="mb-2 font-semibold text-slate-900">What we collect</h2>
          <ul className="list-disc space-y-1 pl-5">
            <li>Your email address and password, when you create an account.</li>
            <li>
              The conversation transcripts you paste or send via the API, and the promises,
              categories, and risk flags extracted from them.
            </li>
            <li>Your company policy settings (discount limits, rules, approved offerings).</li>
            <li>API keys you create (only a hash is stored — the key itself is shown once).</li>
          </ul>
        </section>

        <section>
          <h2 className="mb-2 font-semibold text-slate-900">How it&apos;s used</h2>
          <p>
            Conversation text is sent to Anthropic&apos;s Claude API to extract promises and check
            them against your policy. It is not used to train models. All other data is used only
            to run the product for your account.
          </p>
        </section>

        <section>
          <h2 className="mb-2 font-semibold text-slate-900">Who can see your data</h2>
          <p>
            Only you. Every conversation, policy, and API key is isolated to your account with
            database-level access controls (row level security) — no other user of Pactly can
            read it.
          </p>
        </section>

        <section>
          <h2 className="mb-2 font-semibold text-slate-900">Where it&apos;s stored</h2>
          <p>Supabase (Postgres), for as long as your account exists.</p>
        </section>

        <section>
          <h2 className="mb-2 font-semibold text-slate-900">Deleting your data</h2>
          <p>
            You can delete individual conversations from your dashboard. To delete your account
            and all associated data, contact us.
          </p>
        </section>
      </div>
    </div>
  );
}
