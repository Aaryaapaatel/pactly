import { NextResponse } from "next/server";

// STUB - deliberately not wired up to the ingest pipeline yet.
//
// Intercom's actual webhook payload shape (conversation.admin.closed /
// conversation.admin.replied topics, the nested conversation_parts
// structure, how to pull out the full transcript vs. a single reply) needs
// to be verified against Intercom's real webhook documentation and a real
// sample payload before this can safely map into runIngestPipeline().
// Writing that mapping from guesswork would silently produce wrong or
// broken extraction the first time a real webhook arrived - worse than
// leaving it as an honest stub.
//
// To finish this: subscribe to the relevant topic in the Intercom Developer
// Hub, capture one real payload, and map its transcript field(s) into
// { transcript_text, platform: "intercom", conversation_id, agent_flow }
// before calling runIngestPipeline() the same way src/app/api/webhooks/
// generic/route.ts does.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  console.warn("Received Intercom webhook payload (not yet processed):", JSON.stringify(body)?.slice(0, 2000));

  return NextResponse.json(
    {
      error:
        "Intercom webhook integration is not implemented yet - the payload shape needs to be verified against real Intercom webhook docs first. Use POST /api/webhooks/generic or /api/v1/ingest in the meantime.",
    },
    { status: 501 }
  );
}
