import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabase/admin";

// Stripe calls this directly - there is no logged-in user, no session, no
// cookies. The only thing that proves a request is genuinely from Stripe is
// the signature check below. Never trust this endpoint's body without it.
export async function POST(request: Request) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !webhookSecret) {
    console.error("Stripe billing is not configured; rejecting webhook.");
    return NextResponse.json({ error: "Webhook not configured." }, { status: 503 });
  }

  const signature = request.headers.get("stripe-signature");
  const body = await request.text();

  let event: Stripe.Event;
  try {
    if (!signature) throw new Error("Missing stripe-signature header.");
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    console.error("Stripe webhook signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.client_reference_id;
      if (!userId || !session.customer || !session.subscription) break;

      const subscription = await stripe.subscriptions.retrieve(session.subscription as string);

      await supabaseAdmin.from("subscriptions").upsert(
        {
          user_id: userId,
          plan: "pro",
          status: "active",
          stripe_customer_id: session.customer as string,
          stripe_subscription_id: subscription.id,
          current_period_end: new Date(subscription.items.data[0].current_period_end * 1000).toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );
      break;
    }

    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      const status =
        subscription.status === "active" || subscription.status === "trialing"
          ? "active"
          : subscription.status === "past_due"
            ? "past_due"
            : "canceled";
      const plan = status === "canceled" ? "free" : "pro";

      await supabaseAdmin
        .from("subscriptions")
        .update({
          plan,
          status,
          current_period_end: new Date(
            subscription.items.data[0].current_period_end * 1000
          ).toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("stripe_subscription_id", subscription.id);
      break;
    }

    default:
      break;
  }

  return NextResponse.json({ received: true });
}
