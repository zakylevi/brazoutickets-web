import { useState, useEffect, useRef } from "react";
import { loadStripe, Stripe, StripeCardElement } from "@stripe/stripe-js";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Minus, Plus, CreditCard, ShieldCheck, CheckCircle2, ChevronLeft, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { resolveOrderPricing } from "@/lib/orderPricing";

interface TicketType {
  id: string;
  name: string;
  price: string;
  max_per_order: number;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ticket: TicketType | null;
  eventId: string;
  onSubmitted: (ticketTypeId: string) => void;
}

const STRIPE_KEY = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string | undefined;

interface SavedCard {
  id: string;
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
}

type Step = "summary" | "payment" | "confirmation";

const RequestAccessModal = ({ open, onOpenChange, ticket, eventId, onSubmitted }: Props) => {
  const [step, setStep] = useState<Step>("summary");
  const [qty, setQty] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [stripeReady, setStripeReady] = useState(false);
  const [savedCard, setSavedCard] = useState<SavedCard | null>(null);
  const [savedCardCustomerId, setSavedCardCustomerId] = useState<string | null>(null);
  const [useSavedCard, setUseSavedCard] = useState(true);
  const stripeRef = useRef<Stripe | null>(null);
  const cardElementRef = useRef<StripeCardElement | null>(null);
  const cardMountRef = useRef<HTMLDivElement>(null);

  const unitPrice = parseFloat(ticket?.price || "0");
  const { totalPaid, serviceFee } = resolveOrderPricing({ unitPrice, quantity: qty });
  const isFree = unitPrice <= 0;
  const stripeEnabled = !!STRIPE_KEY && !isFree;
  const showCardInput = stripeEnabled && (!savedCard || !useSavedCard);

  // Fetch saved card when modal opens and stripe is enabled
  useEffect(() => {
    if (!open || !stripeEnabled) return;
    supabase.functions.invoke("get-payment-methods").then(({ data }) => {
      if (data?.paymentMethods?.length > 0) {
        setSavedCard(data.paymentMethods[0]);
        setSavedCardCustomerId(data.customerId || null);
        setUseSavedCard(true);
      } else {
        setSavedCard(null);
        setSavedCardCustomerId(null);
      }
    });
  }, [open, stripeEnabled]);

  // Load Stripe and mount card element when on payment step with card input
  useEffect(() => {
    if (!open || step !== "payment" || !showCardInput || !cardMountRef.current) return;

    let mounted = true;
    let cardEl: StripeCardElement | null = null;

    (async () => {
      const stripe = await loadStripe(STRIPE_KEY!);
      if (!stripe || !mounted) return;
      stripeRef.current = stripe;

      const elements = stripe.elements();
      cardEl = elements.create("card", {
        style: {
          base: {
            fontSize: "15px",
            fontFamily: "inherit",
            color: "#f0f0f0",
            "::placeholder": { color: "#6b7280" },
          },
        },
        hidePostalCode: true,
      });
      cardEl.mount(cardMountRef.current!);
      cardElementRef.current = cardEl;
      setStripeReady(true);
    })();

    return () => {
      mounted = false;
      cardEl?.unmount();
      cardElementRef.current = null;
      setStripeReady(false);
    };
  }, [open, step, showCardInput]);

  const handleClose = () => {
    setStep("summary");
    setQty(1);
    setSavedCard(null);
    setSavedCardCustomerId(null);
    setUseSavedCard(true);
    onOpenChange(false);
  };

  const handleSubmit = async () => {
    if (!ticket || !eventId) return;
    const { data: sess } = await supabase.auth.getSession();
    const session = sess?.session;
    if (!session?.user) { toast.error("Please log in first"); return; }

    setSubmitting(true);
    try {
      if (stripeEnabled) {
        let paymentMethodId: string;

        if (savedCard && useSavedCard) {
          paymentMethodId = savedCard.id;
        } else {
          if (!stripeRef.current || !cardElementRef.current) {
            toast.error("Card input not ready");
            setSubmitting(false);
            return;
          }
          const { paymentMethod, error: pmError } = await stripeRef.current.createPaymentMethod({
            type: "card",
            card: cardElementRef.current,
          });
          if (pmError || !paymentMethod) {
            toast.error(pmError?.message || "Card error. Please check your card details.");
            setSubmitting(false);
            return;
          }
          paymentMethodId = paymentMethod.id;
        }

        const { data, error } = await supabase.functions.invoke("create-auth-hold", {
          body: {
            eventId,
            ticketTypeId: ticket.id,
            quantity: qty,
            paymentMethodId,
            customerId: savedCardCustomerId || undefined,
          },
        });

        if (error || data?.error) {
          toast.error(data?.error || "Failed to authorize card. Please try again.");
          setSubmitting(false);
          return;
        }

        if (data?.requiresAction && data?.clientSecret && stripeRef.current) {
          const { error: confirmErr } = await stripeRef.current.confirmCardPayment(data.clientSecret);
          if (confirmErr) {
            toast.error("Card authentication failed: " + confirmErr.message);
            setSubmitting(false);
            return;
          }
        }
      } else {
        const { error } = await supabase.from("ticket_requests" as any).insert({
          event_id: eventId,
          ticket_type_id: ticket.id,
          user_id: session.user.id,
          quantity: qty,
          status: "pending",
        });

        if (error) {
          toast.error("Failed to submit request. You may have already submitted one.");
          setSubmitting(false);
          return;
        }
      }

      onSubmitted(ticket.id);
      setStep("confirmation");
    } catch (err: any) {
      toast.error(err.message || "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!ticket) return null;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <DialogContent className="sm:max-w-md rounded-3xl p-6">

        {step === "summary" && (
          <>
            <div className="mb-1">
              <p className="text-xs font-bold uppercase tracking-widest text-primary mb-1">Request Access</p>
              <h2 className="text-xl font-black tracking-tight">{ticket.name}</h2>
            </div>

            {/* Quantity controls */}
            <div className="space-y-2 py-4 border-t border-border">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Quantity</p>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setQty((q) => Math.max(1, q - 1))}
                  className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center hover:bg-accent transition-colors"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <span className="font-black tabular-nums text-lg w-8 text-center">{qty}</span>
                <button
                  onClick={() => setQty((q) => Math.min(Math.max(1, ticket.max_per_order), q + 1))}
                  className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center hover:bg-accent transition-colors"
                >
                  <Plus className="w-4 h-4" />
                </button>
                <span className="text-xs text-muted-foreground">max {Math.max(1, ticket.max_per_order)}</span>
              </div>
            </div>

            {/* Price breakdown */}
            {!isFree && (
              <div className="rounded-xl border border-border bg-secondary/50 p-3 space-y-1 text-xs mb-4">
                <div className="flex justify-between text-muted-foreground">
                  <span>{ticket.name} × {qty}</span>
                  <span>${(unitPrice * qty).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Service fee</span>
                  <span>${serviceFee.toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-black text-foreground border-t border-border pt-1 mt-1">
                  <span>Authorization hold</span>
                  <span>${totalPaid.toFixed(2)}</span>
                </div>
              </div>
            )}

            <p className="text-xs text-muted-foreground mb-4">
              No payment now — you'll only be charged if the organizer approves your request.
            </p>

            <div className="flex gap-3">
              <button
                onClick={handleClose}
                className="flex-1 py-3 rounded-full bg-secondary text-foreground font-bold text-sm hover:bg-accent transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => setStep("payment")}
                className="flex-1 py-3 rounded-full bg-primary text-primary-foreground font-bold text-sm hover:bg-primary/90 transition-colors"
              >
                Continue
              </button>
            </div>
          </>
        )}

        {step === "payment" && (
          <>
            <button
              onClick={() => setStep("summary")}
              className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4 font-medium"
            >
              <ChevronLeft className="w-4 h-4" />
              Back
            </button>

            <div className="mb-4">
              <p className="text-xs font-bold uppercase tracking-widest text-primary mb-1">Payment</p>
              <h2 className="text-xl font-black tracking-tight">Confirm Request</h2>
              <p className="text-sm text-muted-foreground mt-1">
                {ticket.name} · {qty} ticket{qty !== 1 ? "s" : ""}
                {!isFree && <span className="font-bold text-foreground"> · ${totalPaid.toFixed(2)}</span>}
              </p>
            </div>

            {stripeEnabled ? (
              <div className="space-y-3 mb-6">
                {savedCard && useSavedCard ? (
                  <div className="border border-border rounded-xl px-4 py-3 bg-secondary flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CreditCard className="w-4 h-4 text-primary" />
                      <span className="text-sm font-bold capitalize text-foreground">
                        {savedCard.brand} •••• {savedCard.last4}
                      </span>
                      <span className="text-muted-foreground text-xs">
                        {String(savedCard.expMonth).padStart(2, "0")}/{String(savedCard.expYear).slice(-2)}
                      </span>
                    </div>
                    <button
                      onClick={() => setUseSavedCard(false)}
                      className="text-xs text-muted-foreground hover:text-foreground underline"
                    >
                      Change
                    </button>
                  </div>
                ) : (
                  <>
                    <div ref={cardMountRef} className="border border-border rounded-xl px-4 py-3.5 bg-secondary min-h-[44px]" />
                    {!stripeReady && <p className="text-xs text-muted-foreground">Loading secure card input…</p>}
                    {savedCard && (
                      <button
                        onClick={() => setUseSavedCard(true)}
                        className="text-xs text-muted-foreground hover:text-foreground underline"
                      >
                        Use saved card (•••• {savedCard.last4})
                      </button>
                    )}
                  </>
                )}
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <ShieldCheck className="w-3.5 h-3.5 text-green-500" />
                  <span>Card held — not charged until the organizer approves.</span>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-3 p-4 rounded-xl bg-primary/5 border border-primary/20 mb-6">
                <Lock className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                <p className="text-sm text-muted-foreground">
                  No payment required. You'll only be charged if the organizer approves.
                </p>
              </div>
            )}

            <button
              disabled={submitting || (stripeEnabled && showCardInput && !stripeReady)}
              onClick={handleSubmit}
              className="w-full py-3.5 rounded-full bg-primary text-primary-foreground font-black text-sm hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {submitting
                ? "Submitting..."
                : stripeEnabled
                ? `Request & Authorize $${totalPaid.toFixed(2)}`
                : "Submit Request"}
            </button>
          </>
        )}

        {step === "confirmation" && (
          <div className="flex flex-col items-center text-center py-4">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-5">
              <CheckCircle2 className="w-8 h-8 text-primary" />
            </div>
            <h2 className="text-xl font-black tracking-tight mb-2">Request Submitted!</h2>
            <p className="text-sm text-muted-foreground mb-6">
              You'll be notified when the organizer approves your request for{" "}
              <span className="font-bold text-foreground">{ticket.name}</span>.
            </p>
            <button
              onClick={handleClose}
              className="w-full py-3.5 rounded-full bg-primary text-primary-foreground font-black text-sm hover:bg-primary/90 transition-colors"
            >
              Done
            </button>
          </div>
        )}

      </DialogContent>
    </Dialog>
  );
};

export default RequestAccessModal;
