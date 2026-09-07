import { z } from "zod";
import type Anthropic from "@anthropic-ai/sdk";
import { anthropic, EXTRACTION_MODEL } from "./anthropic";
import type { Policy } from "@/types";

const extractedPromiseSchema = z.object({
  promise_text: z.string(),
  category: z.enum(["pricing", "discount", "timeline", "feature", "other"]),
  extracted_value: z.string().nullable(),
  risk_flag: z.boolean(),
  risk_reason: z.string().nullable(),
});

const extractionResultSchema = z.object({
  promises: z.array(extractedPromiseSchema),
});

export type ExtractedPromise = z.infer<typeof extractedPromiseSchema>;

const RECORD_PROMISES_TOOL = {
  name: "record_promises",
  description:
    "Record every promise, commitment, price quote, delivery timeline, discount, or feature guarantee that the AI SALES AGENT (not the customer) made during the conversation.",
  input_schema: {
    type: "object" as const,
    properties: {
      promises: {
        type: "array",
        description: "One entry per distinct promise or commitment made by the agent. Empty array if the agent made none.",
        items: {
          type: "object",
          properties: {
            promise_text: {
              type: "string",
              description:
                "The promise, quoted or closely paraphrased from the agent's own words. Keep it self-contained and specific.",
            },
            category: {
              type: "string",
              enum: ["pricing", "discount", "timeline", "feature", "other"],
              description:
                "pricing = a price/cost quote, discount = a percentage or dollar discount, timeline = a delivery/completion date or duration, feature = a product capability or SLA guarantee, other = any other commitment.",
            },
            extracted_value: {
              type: ["string", "null"],
              description:
                "The concrete value if the promise has one, e.g. '15%', '$99/month', '2 weeks', 'unlimited API calls'. Null if there isn't a discrete value.",
            },
            risk_flag: {
              type: "boolean",
              description:
                "true if this promise appears to conflict with the company policies provided in the prompt.",
            },
            risk_reason: {
              type: ["string", "null"],
              description:
                "If risk_flag is true, a short (one sentence) explanation of which policy it conflicts with and why. Null if risk_flag is false.",
            },
          },
          required: ["promise_text", "category", "extracted_value", "risk_flag", "risk_reason"],
        },
      },
    },
    required: ["promises"],
  },
};

function formatPolicyForPrompt(policy: Policy): string {
  const lines = [
    `- Maximum discount allowed: ${policy.max_discount_percent}%`,
    `- Standard delivery timeline: ${policy.standard_delivery_weeks} weeks`,
  ];
  for (const rule of policy.custom_rules) {
    lines.push(`- ${rule.label}: ${rule.description}`);
  }
  return lines.join("\n");
}

export async function extractPromises(
  conversationText: string,
  policy: Policy
): Promise<ExtractedPromise[]> {
  const message = await anthropic.messages.create({
    model: EXTRACTION_MODEL,
    max_tokens: 4096,
    system:
      "You are a compliance auditor for an AI sales agent accountability platform. You read sales conversations between an AI sales agent and a customer, and extract every promise, commitment, price quote, delivery timeline, discount, and feature guarantee that the AGENT made. You never invent promises that were not actually made, and you never attribute the customer's statements to the agent. You always respond by calling the record_promises tool.",
    tools: [RECORD_PROMISES_TOOL],
    tool_choice: { type: "tool", name: "record_promises" },
    messages: [
      {
        role: "user",
        content: `Company policies to check every promise against:\n${formatPolicyForPrompt(
          policy
        )}\n\nConversation transcript:\n"""\n${conversationText}\n"""\n\nExtract every promise the AI sales agent made and record it with the record_promises tool.`,
      },
    ],
  });

  const toolUse = message.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === "tool_use"
  );

  if (!toolUse) {
    throw new Error("Claude did not return a tool_use block for record_promises.");
  }

  const parsed = extractionResultSchema.parse(toolUse.input);
  return parsed.promises.map((p) => applyDeterministicPolicyCheck(p, policy));
}

// Parses a percentage like "15%" or "up to 20 percent" out of free text.
function parsePercent(text: string): number | null {
  const match = text.match(/(\d+(?:\.\d+)?)\s*(?:%|percent)/i);
  return match ? parseFloat(match[1]) : null;
}

// Parses a duration and converts it to weeks. Handles day/week/month units.
function parseWeeks(text: string): number | null {
  const match = text.match(/(\d+(?:\.\d+)?)\s*(day|week|month)s?/i);
  if (!match) return null;
  const value = parseFloat(match[1]);
  const unit = match[2].toLowerCase();
  if (unit === "day") return value / 7;
  if (unit === "month") return value * 4.345;
  return value;
}

// Deterministic overlay: numeric policy checks (discount %, delivery weeks)
// are re-verified in code so the risk flag doesn't depend solely on the
// model's arithmetic. This only ever strengthens a flag to true; it never
// clears a risk flag the model raised for qualitative reasons.
function applyDeterministicPolicyCheck(
  promise: ExtractedPromise,
  policy: Policy
): ExtractedPromise {
  const searchText = `${promise.extracted_value ?? ""} ${promise.promise_text}`;

  if (promise.category === "discount") {
    const percent = parsePercent(searchText);
    if (percent !== null && percent > policy.max_discount_percent) {
      return {
        ...promise,
        risk_flag: true,
        risk_reason: `Discount of ${percent}% exceeds the maximum allowed discount of ${policy.max_discount_percent}%.`,
      };
    }
  }

  if (promise.category === "timeline") {
    const weeks = parseWeeks(searchText);
    if (weeks !== null && weeks > policy.standard_delivery_weeks) {
      return {
        ...promise,
        risk_flag: true,
        risk_reason: `Promised timeline of ${searchText.match(
          /\d+(?:\.\d+)?\s*(?:day|week|month)s?/i
        )?.[0]} exceeds the standard delivery window of ${policy.standard_delivery_weeks} weeks.`,
      };
    }
  }

  return promise;
}
