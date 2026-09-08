import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { stripe } from "@/lib/stripe";
import { getSubscription } from "@/lib/subscription";

export async function POST(request: Request) {
  if (!stripe) {
    return NextResponse.json({ error: "Billing isn't configured yet." }, { status: 503 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const subscription = await getSubscription(supabase, user.id);
  if (!subscription.stripe_customer_id) {
    return NextResponse.json({ error: "No billing account found for this user." }, { status: 404 });
  }

  const { origin } = new URL(request.url);
  const session = await stripe.billingPortal.sessions.create({
    customer: subscription.stripe_customer_id,
    return_url: `${origin}/dashboard`,
  });

  return NextResponse.json({ url: session.url });
}
