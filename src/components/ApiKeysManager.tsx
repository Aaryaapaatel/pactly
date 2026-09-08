"use client";

import { useState } from "react";
import Link from "next/link";
import type { ApiKey } from "@/types";

export function ApiKeysManager({ initialKeys }: { initialKeys: ApiKey[] }) {
  const [keys, setKeys] = useState(initialKeys);
  const [newKeyName, setNewKeyName] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revealedKey, setRevealedKey] = useState<string | null>(null);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError(null);
    setRevealedKey(null);

    try {
      const res = await fetch("/api/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newKeyName.trim() || "API Key" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to create API key.");

      setKeys((prev) => [data.key, ...prev]);
      setRevealedKey(data.full_key);
      setNewKeyName("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create API key.");
    } finally {
      setCreating(false);
    }
  }

  async function handleRevoke(id: string) {
    setError(null);
    try {
      const res = await fetch(`/api/keys/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to revoke key.");
      setKeys((prev) => prev.filter((k) => k.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to revoke key.");
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">API keys</h1>
          <p className="mt-1 text-sm text-slate-500">
            Send conversations to Pactly automatically from your own backend, instead of pasting
            them in by hand.
          </p>
        </div>
        <Link href="/dashboard" className="text-sm font-medium text-slate-600 hover:text-slate-900">
          ← Back to dashboard
        </Link>
      </div>

      <div className="mb-6 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
        <p className="mb-2 font-medium text-slate-800">How to use it</p>
        <p className="mb-2">
          The moment a conversation with your AI agent ends, have your backend send it here:
        </p>
        <pre className="overflow-x-auto rounded-md bg-slate-900 p-3 text-xs text-slate-100">
{`curl -X POST https://<your-pactly-domain>/api/ingest \\
  -H "Authorization: Bearer pk_live_..." \\
  -H "Content-Type: application/json" \\
  -d '{"conversation_text": "Agent: ...\\nCustomer: ..."}'`}
        </pre>
        <p className="mt-2">
          It&apos;s checked against your policy and shows up in the audit log exactly like a
          pasted conversation would.
        </p>
      </div>

      {revealedKey && (
        <div className="mb-6 rounded-lg border border-amber-300 bg-amber-50 p-4">
          <p className="mb-2 text-sm font-semibold text-amber-900">
            Copy this key now — it won&apos;t be shown again.
          </p>
          <code className="block break-all rounded-md bg-white px-3 py-2 text-sm text-slate-900">
            {revealedKey}
          </code>
        </div>
      )}

      <form onSubmit={handleCreate} className="mb-8 flex items-center gap-3">
        <input
          type="text"
          value={newKeyName}
          onChange={(e) => setNewKeyName(e.target.value)}
          placeholder="Key name, e.g. Production backend"
          className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
        />
        <button
          type="submit"
          disabled={creating}
          className="shrink-0 rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-700 disabled:opacity-50"
        >
          {creating ? "Creating..." : "Create key"}
        </button>
      </form>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      {keys.length === 0 ? (
        <p className="text-sm text-slate-400">No API keys yet.</p>
      ) : (
        <ul className="divide-y divide-slate-200 overflow-hidden rounded-lg border border-slate-200 bg-white">
          {keys.map((key) => (
            <li key={key.id} className="flex items-center justify-between px-4 py-3 text-sm">
              <div>
                <p className="font-medium text-slate-800">{key.name}</p>
                <p className="text-xs text-slate-400">
                  {key.key_prefix}… · created{" "}
                  {new Date(key.created_at).toLocaleDateString("en-US")}
                  {key.last_used_at &&
                    ` · last used ${new Date(key.last_used_at).toLocaleDateString("en-US")}`}
                </p>
              </div>
              <button
                onClick={() => handleRevoke(key.id)}
                className="text-sm font-medium text-red-500 hover:text-red-700"
              >
                Revoke
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
