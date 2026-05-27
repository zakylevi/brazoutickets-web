import { useState, useEffect, useRef } from "react";
import { loadStripe, Stripe, StripeCardElement } from "@stripe/stripe-js";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Minus, Plus, CreditCard, ShieldCheck } from "lucide-react";
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

const RequestAccessModal = ({ open, onOpenChange, ticket, eventId, onSubmitted }: Props) => {
  const [qty, setQty] = useState(1);
  const [message, setMessage] = useState("");
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

  // Fetch saved card when modal opens
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

  // Load Stripe and mount card element when card input is needed
  useEffect(() => {
    if (!open || !showCardInput || !cardMountRef.current) return;

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
  }, [open, showCardInput]);

  const handleClose = () => {
    setQty(1);
    setMessage("");
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

        // Call edge function: creates ticket_request + Stripe auth hold
        const { data, error } = await supabase.functions.invoke("create-auth-hold", {
          body: {
            eventId,
            ticketTypeId: ticket.id,
            quantity: qty,
            message: message.trim() || null,
            paymentMethodId,
            customerId: savedCardCustomerId || undefined,
          },
        });

        if (error || data?.error) {
          toast.error(data?.error || "Failed to authorize card. Please try again.");
          setSubmitting(false);
          return;
        }

        // Handle 3D Secure if required
        if (data?.requiresAction && data?.clientSecret && stripeRef.current) {
          const { error: confirmErr } = await stripeRef.current.confirmCardPayment(data.clientSecret);
          if (confirmErr) {
            toast.error("Card authentication failed: " + confirmErr.message);
            setSubmitting(false);
            return;
          }
        }

        const heldAmount = (data?.amountCents / 100).toFixed(2);
        toast.success(`Request submitted! $${heldAmount} has been held on your card. You'll be notified when approved.`);
      } else {
        // No Stripe (free ticket or Stripe not configured) — submit request only
        const { error } = await supabase.from("ticket_requests" as any).insert({
          event_id: eventId,
          ticket_type_id: ticket.id,
          user_id: session.user.id,
          quantity: qty,
          message: message.trim() || null,
          status: "pending",
        });

        if (error) {
          toast.error("Failed to submit request. You may have already submitted one.");
          setSubmitting(false);
          return;
        }

        toast.success("Request submitted! You'll be notified when the organizer responds.");
      }

      onSubmitted(ticket.id);
      handleClose();
    } catch (err: any) {
      toast.error(err.message || "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!ticket) return null;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <DialogContent className="sm:max-w-md rounded-3xl">
        <DialogHeader>
          <DialogTitle className="font-black text-xl">Request Access</DialogTitle>
          <DialogDescription>
            Request access to <span className="font-bold">{ticket.name}</span>. Your card will be authorized but not charged until the organizer approves.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Quantity */}
          <div className="space-y-2">
            <label className="font-bold text-xs uppercase tracking-wider text-foreground">Quantity</label>
            <p className="text-xs text-muted-foreground">Limit {Math.max(1, ticket.max_per_order)} per order</p>
            <div className="flex items-center gap-3">
              <button onClick={() => setQty((q) => Math.max(1, q - 1))} className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center hover:bg-accent transition-colors">
                <Minus className="w-4 h-4" />
              </button>
              <span className="font-black tabular-nums text-lg w-8 text-center">{qty}</span>
              <button onClick={() => setQty((q) => Math.min(Math.max(1, ticket.max_per_order), q + 1))} className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center hover:bg-accent transition-colors">
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Message */}
          <div className="space-y-2">
            <label className="font-bold text-xs uppercase tracking-wider text-foreground">Message (optional)</label>
            <Textarea
              placeholder="Tell the organizer why you'd like to attend..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="rounded-xl resize-none"
              rows={3}
            />
          </div>

          {/* Card section */}
          {stripeEnabled && (
            <div className="space-y-2">
              <label className="font-bold text-xs uppercase tracking-wider text-foreground flex items-center gap-1.5">
                <CreditCard className="w-3.5 h-3.5" /> Payment
              </label>

              {savedCard && useSavedCard ? (
                <div className="border border-border rounded-xl px-4 py-3 bg-secondary flex items-center justify-between">
                  <span className="text-sm font-bold capitalize text-foreground">
                    {savedCard.brand} •••• {savedCard.last4} &nbsp;
                    <span className="text-muted-foreground font-normal text-xs">
                      {String(savedCard.expMonth).padStart(2, "0")}/{String(savedCard.expYear).slice(-2)}
                    </span>
                  </span>
                  <button
                    onClick={() => setUseSavedCard(false)}
                    className="text-xs text-muted-foreground hover:text-foreground underline"
                  >
                    Use different card
                  </button>
                </div>
              ) : (
                <>
                  <div
                    ref={cardMountRef}
                    className="border border-border rounded-xl px-4 py-3.5 bg-secondary min-h-[44px]"
                  />
                  {!stripeReady && (
                    <p className="text-xs text-muted-foreground">Loading secure card input…</p>
                  )}
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
                <span>Card authorized only — not charged until approved. Hold releases automatically if denied.</span>
              </div>
            </div>
          )}

          {/* Amount summary */}
          {!isFree && (
            <div className="rounded-xl border border-border bg-secondary/50 p-3 space-y-1 text-xs">
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
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={handleClose} className="rounded-full">Cancel</Button>
          <Button
            disabled={submitting || (stripeEnabled && showCardInput && !stripeReady)}
            onClick={handleSubmit}
            className="rounded-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold"
          >
            {submitting
              ? "Processing..."
              : stripeEnabled
              ? `Authorize $${totalPaid.toFixed(2)} & Request`
              : "Submit Request"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default RequestAccessModal;
