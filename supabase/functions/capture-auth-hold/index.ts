import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { requestId } = await req.json();

    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: ticketReq, error: reqErr } = await supabase
      .from("ticket_requests")
      .select("*, ticket_types(name, price)")
      .eq("id", requestId)
      .single();

    if (reqErr || !ticketReq) throw new Error("Request not found");
    if (ticketReq.status !== "pending") throw new Error("Request has already been reviewed");

    // Capture Stripe hold if payment was collected
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (stripeKey && ticketReq.payment_intent_id) {
      const stripe = new Stripe(stripeKey, { apiVersion: "2024-06-20" });
      await stripe.paymentIntents.capture(ticketReq.payment_intent_id);
    }

    const unitPrice = parseFloat(ticketReq.ticket_types?.price || "0");
    const quantity = ticketReq.quantity || 1;
    const subtotal = unitPrice * quantity;
    const total = ticketReq.amount_cents ? (ticketReq.amount_cents / 100) : subtotal;
    const serviceFee = Math.round((total - subtotal) * 100) / 100;

    await supabase.from("orders").insert({
      event_id: ticketReq.event_id,
      user_id: ticketReq.user_id,
      ticket_type_id: ticketReq.ticket_type_id,
      ticket_name: ticketReq.ticket_types?.name || "Ticket",
      quantity,
      unit_price: unitPrice,
      service_fee: serviceFee,
      total,
      status: "completed",
      ref_source: "approval",
    });

    await supabase.rpc("purchase_tickets", {
      _ticket_type_id: ticketReq.ticket_type_id,
      _quantity: quantity,
    });

    await supabase
      .from("ticket_requests")
      .update({ status: "approved", reviewed_at: new Date().toISOString() })
      .eq("id", requestId);

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: (e as any).message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
