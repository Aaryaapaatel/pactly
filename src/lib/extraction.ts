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

// Claude occasionally serializes the promises array as a JSON string instead
// of returning it as native tool_use input - sometimes as a stringified
// array, sometimes as a stringified copy of the whole {promises: [...]}
// wrapper nested inside the promises field itself. Normalize all of these
// to a plain array before validating.
const extractionResultSchema = z.object({
  promises: z.preprocess((value) => {
    let normalized = value;
    if (typeof normalized === "string") {
      try {
        normalized = JSON.parse(normalized);
      } catch {
        return value;
      }
    }
    if (
      normalized &&
      typeof normalized === "object" &&
      !Array.isArray(normalized) &&
      "promises" in normalized
    ) {
      normalized = (normalized as { promises: unknown }).promises;
    }
    return normalized;
  }, z.array(extractedPromiseSchema)),
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
                "true if this promise conflicts with the company policies provided in the prompt, INCLUDING if it promises a product, feature, plan, or guarantee that is not on the approved offerings list (when one is provided).",
            },
            risk_reason: {
              type: ["string", "null"],
              description:
                "If risk_flag is true, a short (one sentence) explanation of which policy or missing approved-offerings match caused the flag. Null if risk_flag is false.",
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

  if (policy.approved_offerings.length > 0) {
    lines.push("");
    lines.push(
      "Approved company offerings (the ONLY products, plans, features, and guarantees the company actually provides):"
    );
    for (const offering of policy.approved_offerings) {
      lines.push(`- ${offering.name}: ${offering.description}`);
    }
    lines.push(
      "If the agent promises a feature, plan, product, or guarantee that is not on this list (or is a stronger version of something on this list, e.g. promising it for free when the list says it's paid), treat that as a policy risk even though no numeric rule is broken."
    );
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
      "You are a compliance auditor for an AI sales agent accountability platform. You read sales conversations between an AI sales agent and a customer, and extract every promise, commitment, price quote, delivery timeline, discount, and feature guarantee that the AGENT made. You never invent promises that were not actually made, and you never attribute the customer's statements to the agent. When an approved offerings list is provided, you treat it as the exhaustive source of truth for what the company sells or supports: any agent promise that isn't covered by that list (a feature, plan, product, or guarantee the company doesn't actually offer, or a stronger version of one it does) is a policy risk, even if no numeric rule is violated. You always respond by calling the record_promises tool.",
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
