import "server-only";
import Anthropic from "@anthropic-ai/sdk";

const apiKey = process.env.ANTHROPIC_API_KEY;

if (!apiKey) {
  throw new Error("Missing ANTHROPIC_API_KEY env var. Set it in .env.local.");
}

export const anthropic = new Anthropic({ apiKey });

export const EXTRACTION_MODEL = "claude-sonnet-5";

// Documented for DPA/compliance purposes. This flag doesn't itself control
// anything - Anthropic's API does not train on customer API data by
// default under its commercial terms, with or without this flag. It exists
// so the app has an explicit, auditable statement of that fact rather than
// relying on an unwritten assumption. If this is ever set to a truthy
// value, no code path in this app currently uses conversation data for
// training anything - there is no training pipeline in this codebase.
export const TRAINING_ENABLED = process.env.TRAINING_ENABLED === "true";
