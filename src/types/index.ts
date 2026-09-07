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
  created_at: string;
  updated_at: string;
}

export interface Conversation {
  id: string;
  title: string | null;
  raw_text: string;
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
