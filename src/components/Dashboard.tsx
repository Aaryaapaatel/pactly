"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AuditLog } from "./AuditLog";
import { createClient } from "@/lib/supabase/client";
import type { ConversationWithPromises, Policy } from "@/types";

interface ConversationSummary {
  id: string;
  title: string | null;
  raw_text: string;
  created_at: string;
  promise_count: number;
  risk_count: number;
}

export function Dashboard({
  initialPolicy,
  initialConversations,
  userEmail,
}: {
  initialPolicy: Policy;
  initialConversations: ConversationSummary[];
  userEmail: string;
}) {
  const router = useRouter();
  const [conversationText, setConversationText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ConversationWithPromises | null>(null);
  const [history, setHistory] = useState(initialConversations);

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  async function handleAnalyze(e: React.FormEvent) {
    e.preventDefault();
    if (!conversationText.trim()) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversation_text: conversationText }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error ?? "Something went wrong.");
      }

      setResult(data.conversation);
      setHistory((prev) => [
        {
          id: data.conversation.id,
          title: data.conversation.title,
          raw_text: data.conversation.raw_text,
          created_at: data.conversation.created_at,
          promise_count: data.conversation.promises.length,
          risk_count: data.conversation.promises.filter((p: { risk_flag: boolean }) => p.risk_flag)
            .length,
        },
        ...prev,
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  async function loadConversation(id: string) {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/conversations/${id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load conversation.");
      setResult(data.conversation);
      setConversationText(data.conversation.raw_text);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load conversation.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <header className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Pactly</h1>
          <p className="mt-1 text-sm text-slate-500">
            AI sales agent accountability. Paste a conversation to audit every promise made.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-slate-500">{userEmail}</span>
          <Link
            href="/policy"
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
          >
            Company policy
          </Link>
          <Link
            href="/settings/api-keys"
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
          >
            API keys
          </Link>
          <button
            onClick={handleSignOut}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
          >
            Sign out
          </button>
        </div>
      </header>

      <div className="mb-8 flex flex-wrap gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
        <span>
          Max discount: <strong className="text-slate-900">{initialPolicy.max_discount_percent}%</strong>
        </span>
        <span className="text-slate-300">|</span>
        <span>
          Standard delivery:{" "}
          <strong className="text-slate-900">{initialPolicy.standard_delivery_weeks} weeks</strong>
        </span>
        {initialPolicy.custom_rules.length > 0 && (
          <>
            <span className="text-slate-300">|</span>
            <span>{initialPolicy.custom_rules.length} custom rule(s)</span>
          </>
        )}
        {initialPolicy.approved_offerings.length > 0 && (
          <>
            <span className="text-slate-300">|</span>
            <span>{initialPolicy.approved_offerings.length} approved offering(s)</span>
          </>
        )}
      </div>

      <form onSubmit={handleAnalyze} className="mb-10">
        <label htmlFor="conversation" className="mb-2 block text-sm font-medium text-slate-700">
          Conversation transcript
        </label>
        <textarea
          id="conversation"
          value={conversationText}
          onChange={(e) => setConversationText(e.target.value)}
          rows={12}
          placeholder={
            "Paste the AI sales agent's conversation with the customer here...\n\nAgent: We can offer you 15% off if you sign today.\nCustomer: That sounds great, when would it ship?\nAgent: You'll have it within 2 weeks."
          }
          className="w-full rounded-lg border border-slate-300 bg-white p-4 text-sm text-slate-900 shadow-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
        />
        <div className="mt-3 flex items-center gap-3">
          <button
            type="submit"
            disabled={loading || !conversationText.trim()}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Analyzing..." : "Analyze conversation"}
          </button>
          {error && <span className="text-sm text-red-600">{error}</span>}
        </div>
      </form>

      {result && (
        <section className="mb-12">
          <h2 className="mb-3 text-lg font-semibold text-slate-900">Audit log</h2>
          <AuditLog promises={result.promises} />
        </section>
      )}

      {history.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-semibold text-slate-900">History</h2>
          <ul className="divide-y divide-slate-200 overflow-hidden rounded-lg border border-slate-200 bg-white">
            {history.map((c) => (
              <li key={c.id}>
                <button
                  onClick={() => loadConversation(c.id)}
                  className="flex w-full items-center justify-between px-4 py-3 text-left text-sm hover:bg-slate-50"
                >
                  <span className="truncate text-slate-700">
                    {c.raw_text.slice(0, 80)}
                    {c.raw_text.length > 80 ? "…" : ""}
                  </span>
                  <span className="ml-4 flex shrink-0 items-center gap-3 text-xs text-slate-500">
                    <span>{c.promise_count} promises</span>
                    {c.risk_count > 0 && (
                      <span className="font-semibold text-red-600">{c.risk_count} risks</span>
                    )}
                    <span>{new Date(c.created_at).toLocaleDateString("en-US")}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
