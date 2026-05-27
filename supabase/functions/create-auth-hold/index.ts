import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SERVICE_FEE_RATE = 0.10;
const SERVICE_FEE_FLAT = 0.99;

function calculateServiceFee(subtotal: number, quantity: number): number {
  if (subtotal <= 0) return 0;
  return Math.round((subtotal * SERVICE_FEE_RATE + Math.max(1, quantity) * SERVICE_FEE_FLAT) * 100) / 100;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { eventId, ticketTypeId, quantity, message, paymentMethodId } = await req.json();

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("Stripe is not configured yet.");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get caller user ID from JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Not authenticated");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) throw new Error("Invalid session");

    // Get ticket price
    const { data: ticketType } = await supabase
      .from("ticket_types")
      .select("name, price")
      .eq("id", ticketTypeId)
      .single();

    if (!ticketType) throw new Error("Ticket type not found");

    const unitPrice = parseFloat(ticketType.price || "0");
    const subtotal = unitPrice * quantity;
    const serviceFee = calculateServiceFee(subtotal, quantity);
    const total = Math.round((subtotal + serviceFee) * 100); // cents

    // Create ticket_request in DB
    const { data: request, error: reqErr } = await supabase
      .from("ticket_requests")
      .upsert({
        event_id: eventId,
        ticket_type_id: ticketTypeId,
        user_id: user.id,
        quantity,
        message: message || null,
        status: "pending",
        amount_cents: total,
        currency: "usd",
      }, { onConflict: "event_id,ticket_type_id,user_id" })
      .select("id")
      .single();

    if (reqErr || !request) throw new Error("Failed to create request: " + reqErr?.message);

    const stripe = new Stripe(stripeKey, { apiVersion: "2024-06-20" });

    // Create PaymentIntent with capture_method: manual (authorization hold only)
    const paymentIntent = await stripe.paymentIntents.create({
      amount: total,
      currency: "usd",
      payment_method: paymentMethodId,
      capture_method: "manual",
      confirm: true,
      return_url: `${req.headers.get("origin") || "https://brazou.com"}/profile?tab=tickets`,
      metadata: {
        request_id: request.id,
        event_id: eventId,
        ticket_type_id: ticketTypeId,
        user_id: user.id,
      },
    });

    // Save payment intent ID to the request
    await supabase
      .from("ticket_requests")
      .update({ payment_intent_id: paymentIntent.id })
      .eq("id", request.id);

    return new Response(
      JSON.stringify({
        requestId: request.id,
        paymentIntentStatus: paymentIntent.status,
        amountCents: total,
        requiresAction: paymentIntent.status === "requires_action",
        clientSecret: paymentIntent.status === "requires_action" ? paymentIntent.client_secret : null,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
