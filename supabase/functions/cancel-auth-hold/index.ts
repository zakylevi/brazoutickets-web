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
      .select("*")
      .eq("id", requestId)
      .single();

    if (reqErr || !ticketReq) throw new Error("Request not found");
    if (ticketReq.status !== "pending") throw new Error("Request has already been reviewed");

    // Cancel Stripe hold if one exists
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (stripeKey && ticketReq.payment_intent_id) {
      const stripe = new Stripe(stripeKey, { apiVersion: "2024-06-20" });
      await stripe.paymentIntents.cancel(ticketReq.payment_intent_id);
    }

    await supabase
      .from("ticket_requests")
      .update({ status: "rejected", reviewed_at: new Date().toISOString() })
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
