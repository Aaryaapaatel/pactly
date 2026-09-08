import "server-only";
import Stripe from "stripe";

// Billing is optional - the core product works without Stripe configured,
// so this does NOT throw at import time like the Supabase/Anthropic
// clients do. Every route that actually calls Stripe checks for null and
// returns a clear "billing not configured" error instead of crashing.
export const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null;

export const PRO_PLAN_PRICE_ID = process.env.STRIPE_PRO_PRICE_ID;
