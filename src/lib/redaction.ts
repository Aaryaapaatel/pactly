import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

// Regex-based PII redaction, applied to raw_text before it's stored (not
// before extraction - Claude still sees the original text so promise
// extraction stays accurate; only what's persisted to disk is redacted).
// These are pattern-based, not exhaustive PII detection - a determined
// adversarial format can slip through. Good enough for the common cases
// this spec asks for: emails, phone numbers, credit card numbers.

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
// Phone: matches common US/international formats with 7-15 digits,
// optional country code, separators of space/dot/dash/parens.
const PHONE_RE = /(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4,6}\b/g;
// Credit card: 13-19 digits, optionally grouped in 4s with space/dash.
const CREDIT_CARD_RE = /\b(?:\d[ -]?){13,19}\b/g;

export function redactBuiltInPII(text: string): string {
  return text
    .replace(EMAIL_RE, "[redacted-email]")
    .replace(CREDIT_CARD_RE, "[redacted-card]")
    .replace(PHONE_RE, "[redacted-phone]");
}

export interface CustomRedactionRule {
  label: string;
  pattern: string;
}

// Applies a user's custom regex patterns in addition to the built-in ones.
// A malformed pattern is skipped (logged, not thrown) rather than failing
// the whole request - a bad regex from one rule shouldn't block ingestion.
export async function getCustomRedactionRules(
  supabase: SupabaseClient,
  userId: string
): Promise<CustomRedactionRule[]> {
  const { data, error } = await supabase
    .from("redaction_rules")
    .select("label, pattern")
    .eq("user_id", userId);

  if (error) throw error;
  return data ?? [];
}

export function redactPII(text: string, customRules: CustomRedactionRule[] = []): string {
  let result = redactBuiltInPII(text);

  for (const rule of customRules) {
    try {
      const re = new RegExp(rule.pattern, "g");
      result = result.replace(re, `[redacted-${rule.label}]`);
    } catch (err) {
      console.error(`Skipping invalid redaction pattern "${rule.label}":`, err);
    }
  }

  return result;
}
