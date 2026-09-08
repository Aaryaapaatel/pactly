export type PromiseCategory = "pricing" | "discount" | "timeline" | "feature" | "other";

export interface CustomRule {
  label: string;
  description: string;
}

export interface ApprovedOffering {
  name: string;
  description: string;
}

export interface Policy {
  id: string;
  max_discount_percent: number;
  standard_delivery_weeks: number;
  custom_rules: CustomRule[];
  approved_offerings: ApprovedOffering[];
  avg_order_value: number | null;
  created_at: string;
  updated_at: string;
}

export interface Conversation {
  id: string;
  title: string | null;
  // null after the 24h auto-purge cron removes it (src/app/api/cron/
  // purge-transcripts) - the conversation and its promises are unaffected,
  // only the original transcript text is gone.
  raw_text: string | null;
  transcript_purged_at: string | null;
  created_at: string;
}

export interface PromiseRecord {
  id: string;
  conversation_id: string;
  category: PromiseCategory;
  promise_text: string;
  extracted_value: string | null;
  risk_flag: boolean;
  risk_reason: string | null;
  created_at: string;
}

export interface ConversationWithPromises extends Conversation {
  promises: PromiseRecord[];
}

export interface ApiKey {
  id: string;
  name: string;
  key_prefix: string;
  created_at: string;
  last_used_at: string | null;
}
