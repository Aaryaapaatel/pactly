import { NextResponse } from "next/server";

// STUB - see src/app/api/webhooks/intercom/route.ts for why. Zendesk's
// webhook payload shape (which event types carry the full conversation
// transcript vs. just a ticket-updated notification requiring a follow-up
// API call to fetch the transcript) needs verifying against Zendesk's real
// docs and a real sample payload before this maps into runIngestPipeline().
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  console.warn("Received Zendesk webhook payload (not yet processed):", JSON.stringify(body)?.slice(0, 2000));

  return NextResponse.json(
    {
      error:
        "Zendesk webhook integration is not implemented yet - the payload shape needs to be verified against real Zendesk webhook docs first. Use POST /api/webhooks/generic or /api/v1/ingest in the meantime.",
    },
    { status: 501 }
  );
}
