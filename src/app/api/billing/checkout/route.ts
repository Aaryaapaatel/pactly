import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { stripe, PRO_PLAN_PRICE_ID } from "@/lib/stripe";
import { getSubscription } from "@/lib/subscription";

export async function POST(request: Request) {
  if (!stripe || !PRO_PLAN_PRICE_ID) {
    return NextResponse.json(
      { error: "Billing isn't configured yet." },
      { status: 503 }
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { origin } = new URL(request.url);
  const subscription = await getSubscription(supabase, user.id);

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: PRO_PLAN_PRICE_ID, quantity: 1 }],
    // Ties the Stripe customer back to this user - the webhook reads this,
    // never anything from the client, to decide whose subscription to update.
    client_reference_id: user.id,
    customer: subscription.stripe_customer_id ?? undefined,
    customer_email: subscription.stripe_customer_id ? undefined : (user.email ?? undefined),
    success_url: `${origin}/dashboard?upgraded=1`,
    cancel_url: `${origin}/pricing`,
  });

  if (!session.url) {
    return NextResponse.json({ error: "Failed to create checkout session." }, { status: 500 });
  }

  return NextResponse.json({ url: session.url });
}
