import { useState } from "react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { X, Ticket, CreditCard, Apple, ChevronLeft, Tag, Check, CheckCircle2, Mail, Lock, User, Eye, EyeOff, Wallet, Plus } from "lucide-react";
import PhoneInput from "@/components/PhoneInput";
import { calculateServiceFee } from "@/lib/orderPricing";

interface CartItem {
  ticketTypeId?: string;
  name: string;
  price: string;
  quantity: number;
  maxPerOrder?: number;
  seatIds?: string[];
  isSeated?: boolean;
}

interface CheckoutModalProps {
  open: boolean;
  onClose: () => void;
  cart: CartItem[];
  eventTitle: string;
  eventId: string;
  refSource?: string;
}

const parsePrice = (price: string | number) => {
  if (typeof price === "number") return Number.isFinite(price) ? price : 0;
  const normalized = price.trim().replace(/\$/g, "").replace(/,/g, "");
  return parseFloat(normalized) || 0;
};

const normalizeCodeValue = (value?: string | null) =>
  (value || "").trim().toUpperCase();

const formatPrice = (value: number) =>
  `$${value.toFixed(2)}`;

const getUnitPriceWithFee = (unitPrice: number) =>
  unitPrice + calculateServiceFee(unitPrice, 1);

const PayPalIcon = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
    <path d="M7.076 21.337H2.47a.641.641 0 0 1-.633-.74L4.944.901C5.026.382 5.474 0 5.998 0h7.46c2.57 0 4.578.543 5.69 1.81 1.01 1.15 1.304 2.42 1.012 4.287-.023.143-.047.288-.077.437-.983 5.05-4.349 6.797-8.647 6.797H9.603c-.564 0-1.04.408-1.13.964L7.076 21.337z"/>
  </svg>
);

const KlarnaIcon = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
    <path d="M4.592 2H1v20h3.592V2zm11.344 0H12.48c0 3.488-1.56 6.636-4.028 8.744L6.468 12.6 12.84 22h4.308l-5.916-8.68A15.96 15.96 0 0 0 15.936 2zM21 17.334a2.665 2.665 0 1 0 0 5.332 2.665 2.665 0 0 0 0-5.332z"/>
  </svg>
);

type PaymentMethod = "wallet" | "card" | "apple" | "paypal" | "klarna";

const CheckoutModal = ({ open, onClose, cart, eventTitle, eventId, refSource = "direct" }: CheckoutModalProps) => {
  const [purchasing, setPurchasing] = useState(false);
  const [step, setStep] = useState<"summary" | "auth" | "payment" | "confirmation">("summary");
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>("wallet");
  const navigate = useNavigate();
  const { user, session, login, signup } = useAuth();
  const [cardForm, setCardForm] = useState({ number: "", expiry: "", cvc: "", name: "", address: "", city: "", state: "", zip: "", country: "" });
  const [promoCode, setPromoCode] = useState("");
  const [appliedPromo, setAppliedPromo] = useState<{ code: string; discount: number } | null>(null);
  const [promoError, setPromoError] = useState("");
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [authForm, setAuthForm] = useState({ name: "", email: "", phone: "", password: "", confirmPassword: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [authSubmitting, setAuthSubmitting] = useState(false);
  const [authError, setAuthError] = useState("");
  const [savedCards] = useState([
    { id: "1", brand: "Visa", last4: "4242", expiry: "12/26", holder: "ISAAC LEVI", isDefault: true },
  ]);
  const [addingNewCard, setAddingNewCard] = useState(false);
  if (!open) return null;

  const activeItems = cart.filter((item) => item.quantity > 0);
  const totalTickets = activeItems.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = activeItems.reduce(
    (sum, item) => sum + parsePrice(item.price) * item.quantity,
    0
  );
  const discount = appliedPromo ? appliedPromo.discount : 0;
  const discountedSubtotal = Math.max(0, subtotal - discount);
  const serviceFee = calculateServiceFee(discountedSubtotal, totalTickets);
  const total = Math.max(0, discountedSubtotal + serviceFee);

  const handleClose = () => {
    setStep("summary");
    setSelectedMethod("wallet");
    setCardForm({ number: "", expiry: "", cvc: "", name: "", address: "", city: "", state: "", zip: "", country: "" });
    setPromoCode("");
    setAppliedPromo(null);
    setPromoError("");
    setAuthForm({ name: "", email: "", phone: "", password: "", confirmPassword: "" });
    setAuthMode("login");
    setAuthError("");
    onClose();
  };

  const handleApplyPromo = async () => {
    setPromoError("");
    if (!promoCode.trim()) return;
    const code = promoCode.trim().toUpperCase();

    const { data, error } = await supabase
      .from("promo_codes")
      .select("code, discount_type, discount_value, max_uses, used, ticket_type")
      .eq("event_id", eventId)
      .ilike("code", code);

    if (error || !data || data.length === 0) {
      setPromoError("Invalid promo code");
      return;
    }

    const promo = data.find((p) => normalizeCodeValue(p.code) === code) || data[0];

    // Count actual usage from orders table (source of truth)
    const { count: actualUsed } = await supabase
      .from("orders")
      .select("*", { count: "exact", head: true })
      .eq("event_id", eventId)
      .eq("promo_code", promo.code);

    if ((actualUsed ?? 0) >= promo.max_uses) {
      setPromoError("This promo code has reached its usage limit");
      return;
    }

    const promoTicketType = normalizeCodeValue(promo.ticket_type);
    const appliesToAll = promoTicketType === "" || promoTicketType === "ALL";
    const eligibleItems = appliesToAll
      ? activeItems
      : activeItems.filter((item) => {
          const matchesById = normalizeCodeValue(item.ticketTypeId) === promoTicketType;
          const matchesByName = normalizeCodeValue(item.name) === promoTicketType;
          return matchesById || matchesByName;
        });

    if (eligibleItems.length === 0) {
      setPromoError("This promo code is not valid for the selected ticket");
      return;
    }

    const eligibleSubtotal = eligibleItems.reduce(
      (sum, item) => sum + parsePrice(item.price) * item.quantity,
      0
    );

    const discountValue = parseFloat(promo.discount_value) || 0;
    const discountAmount =
      promo.discount_type === "percentage"
        ? eligibleSubtotal * (discountValue / 100)
        : discountValue;

    setAppliedPromo({ code, discount: Math.max(0, discountAmount) });
  };

  const handleRemovePromo = () => {
    setAppliedPromo(null);
    setPromoCode("");
    setPromoError("");
  };


  const paymentMethods: { id: PaymentMethod; label: string; icon: React.ReactNode }[] = [
    { id: "wallet", label: "My Wallet", icon: <Wallet className="w-5 h-5" /> },
    { id: "card", label: "Credit Card", icon: <CreditCard className="w-5 h-5" /> },
    { id: "apple", label: "Apple Pay", icon: <Apple className="w-5 h-5" /> },
    { id: "paypal", label: "PayPal", icon: <PayPalIcon /> },
    { id: "klarna", label: "Klarna", icon: <KlarnaIcon /> },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={handleClose}
      />

      <div className="relative bg-surface border border-border rounded-4xl w-full max-w-lg p-8 shadow-2xl animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
        <button
          onClick={handleClose}
          className="absolute top-6 right-6 w-10 h-10 rounded-full bg-secondary flex items-center justify-center text-muted-foreground hover:text-on-background transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {step === "summary" ? (
          <>
            <div className="flex items-center gap-3 mb-2">
              <Ticket className="w-5 h-5 text-brand-pink" />
              <p className="text-brand-pink font-bold tracking-wider text-xs uppercase">
                Checkout
              </p>
            </div>
            <h2 className="text-2xl font-black tracking-tight text-on-background mb-1">
              Order Summary
            </h2>
            <p className="text-sm text-muted-foreground font-medium mb-8">
              {eventTitle}
            </p>

            {/* Ticket breakdown */}
            <div className="space-y-1 mb-6">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">
                Tickets
              </p>
              {activeItems.map((item, i) => {
                const unitPrice = parsePrice(item.price);
                const lineTotal = unitPrice * item.quantity;
                return (
                  <div
                    key={i}
                    className="flex items-center justify-between py-3 border-b border-border last:border-0"
                  >
                    <div>
                      <p className="font-black text-on-background">{item.name}</p>
                      <p className="text-sm text-muted-foreground font-medium">
                        {item.quantity} × {formatPrice(unitPrice)}
                      </p>
                    </div>
                    <p className="font-black text-on-background tabular-nums">
                      {formatPrice(lineTotal)}
                    </p>
                  </div>
                );
              })}
            </div>

            {/* Cost breakdown */}
            <div className="space-y-3 py-4 border-t border-border">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground font-medium">Ticket Price</span>
                <span className="font-bold text-on-background tabular-nums">{formatPrice(subtotal)}</span>
              </div>
              {appliedPromo && (
                <>
                  <div className="flex justify-between text-sm">
                    <span className="text-brand-lime font-bold flex items-center gap-1.5">
                      <Tag className="w-3.5 h-3.5" />
                      Promo Code: {appliedPromo.code}
                      <button onClick={handleRemovePromo} className="ml-1 text-muted-foreground hover:text-destructive transition-colors">
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                    <span className="font-bold text-brand-lime tabular-nums">-{formatPrice(discount)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground font-medium">Subtotal after promo</span>
                    <span className="font-bold text-on-background tabular-nums">{formatPrice(discountedSubtotal)}</span>
                  </div>
                </>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground font-medium">Service Fee</span>
                <span className="font-bold text-on-background tabular-nums">{formatPrice(serviceFee)}</span>
              </div>
            </div>

            {/* Promo code input */}
            {!appliedPromo && (
              <div className="py-4 border-t border-border">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">
                  Promo Code
                </p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Enter code"
                    value={promoCode}
                    onChange={(e) => { setPromoCode(e.target.value.toUpperCase()); setPromoError(""); }}
                    onKeyDown={(e) => e.key === "Enter" && handleApplyPromo()}
                    className="flex-1 bg-secondary border border-border rounded-xl px-4 py-2.5 text-sm text-on-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand-pink/50 transition-all font-bold uppercase tracking-wider"
                  />
                  <button
                    onClick={handleApplyPromo}
                    className="px-5 py-2.5 rounded-xl bg-foreground text-background text-xs font-black uppercase tracking-widest hover:opacity-80 transition-opacity"
                  >
                    Apply
                  </button>
                </div>
                {promoError && (
                  <p className="text-xs text-destructive font-bold mt-2">{promoError}</p>
                )}
              </div>
            )}

            {/* Total */}
            <div className="flex items-center justify-between py-4 border-t border-border mb-8">
              <div>
                <p className="font-black text-on-background text-lg">Total</p>
                <p className="text-sm text-muted-foreground font-medium">
                  {totalTickets} ticket{totalTickets !== 1 ? "s" : ""}
                </p>
              </div>
              <p className="text-3xl font-black text-brand-pink tabular-nums">
                {formatPrice(total)}
              </p>
            </div>

            <button
              onClick={() => {
                if (!session) {
                  setStep("auth");
                } else {
                  setStep("payment");
                }
              }}
              className="w-full bg-brand-pink text-primary-foreground py-4 rounded-full font-black tracking-tight text-base hover:scale-[1.02] transition-all shadow-xl flex items-center justify-center gap-2"
            >
              <Ticket className="w-5 h-5" />
              Complete Purchase
            </button>

            <p className="text-center text-xs text-muted-foreground font-medium mt-4">
              You won't be charged yet. This is a demo.
            </p>
          </>
        ) : step === "auth" ? (
          <>
            <button
              onClick={() => setStep("summary")}
              className="flex items-center gap-1 text-sm text-muted-foreground hover:text-on-background transition-colors mb-6 font-medium"
            >
              <ChevronLeft className="w-4 h-4" />
              Back to summary
            </button>

            <div className="flex items-center gap-3 mb-2">
              <User className="w-5 h-5 text-brand-pink" />
              <p className="text-brand-pink font-bold tracking-wider text-xs uppercase">
                Account
              </p>
            </div>
            <h2 className="text-2xl font-black tracking-tight text-on-background mb-1">
              {authMode === "login" ? "Sign in" : "Create account"}
            </h2>
            <p className="text-sm text-muted-foreground font-medium mb-6">
              {authMode === "login"
                ? "Sign in to complete your purchase."
                : "Create an account to purchase tickets."}
            </p>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setAuthSubmitting(true);
                setAuthError("");
                try {
                  if (authMode === "login") {
                    const { error } = await login(authForm.email, authForm.password);
                    if (error) {
                      setAuthError(error);
                    } else {
                      setStep("payment");
                    }
                  } else {
                    if (authForm.password !== authForm.confirmPassword) {
                      setAuthError("Passwords do not match");
                      return;
                    }
                    const { error } = await signup(authForm.email, authForm.password, authForm.name, authForm.phone);
                    if (error) {
                      setAuthError(error);
                    } else {
                      toast.success("Account created! Check your email to verify.");
                      setAuthMode("login");
                      setAuthError("");
                    }
                  }
                } catch {
                  setAuthError("Something went wrong. Please try again.");
                } finally {
                  setAuthSubmitting(false);
                }
              }}
              className="space-y-4"
            >
              {authMode === "signup" && (
                <>
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                      type="text"
                      placeholder="Full name"
                      value={authForm.name}
                      onChange={(e) => setAuthForm({ ...authForm, name: e.target.value })}
                      className="w-full bg-secondary border border-border rounded-xl py-3.5 pl-11 pr-4 text-on-background placeholder:text-muted-foreground font-medium focus:outline-none focus:ring-2 focus:ring-brand-pink focus:border-transparent transition-all"
                      required
                    />
                  </div>
                  <PhoneInput
                    value={authForm.phone}
                    onChange={(val) => setAuthForm({ ...authForm, phone: val })}
                  />
                </>
              )}

              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="email"
                  placeholder="Email address"
                  value={authForm.email}
                  onChange={(e) => setAuthForm({ ...authForm, email: e.target.value })}
                  className="w-full bg-secondary border border-border rounded-xl py-3.5 pl-11 pr-4 text-on-background placeholder:text-muted-foreground font-medium focus:outline-none focus:ring-2 focus:ring-brand-pink focus:border-transparent transition-all"
                  required
                />
              </div>

              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Password"
                  value={authForm.password}
                  onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })}
                  className="w-full bg-secondary border border-border rounded-xl py-3.5 pl-11 pr-11 text-on-background placeholder:text-muted-foreground font-medium focus:outline-none focus:ring-2 focus:ring-brand-pink focus:border-transparent transition-all"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-on-background transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {authMode === "signup" && (
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type="password"
                    placeholder="Confirm password"
                    value={authForm.confirmPassword}
                    onChange={(e) => setAuthForm({ ...authForm, confirmPassword: e.target.value })}
                    className="w-full bg-secondary border border-border rounded-xl py-3.5 pl-11 pr-4 text-on-background placeholder:text-muted-foreground font-medium focus:outline-none focus:ring-2 focus:ring-brand-pink focus:border-transparent transition-all"
                    required
                  />
                </div>
              )}

              {authError && (
                <p className="text-sm text-destructive font-bold">{authError}</p>
              )}

              <button
                type="submit"
                disabled={authSubmitting}
                className="w-full bg-brand-pink text-primary-foreground py-4 rounded-full font-black tracking-tight text-base hover:scale-[1.02] transition-all shadow-xl disabled:opacity-50 disabled:hover:scale-100"
              >
                {authSubmitting ? "Please wait..." : authMode === "login" ? "Sign In & Continue" : "Create Account"}
              </button>
            </form>

            <p className="text-center text-sm text-muted-foreground font-medium mt-6">
              {authMode === "login" ? "Don't have an account?" : "Already have an account?"}{" "}
              <button
                onClick={() => { setAuthMode(authMode === "login" ? "signup" : "login"); setAuthError(""); }}
                className="text-brand-pink font-bold hover:underline"
              >
                {authMode === "login" ? "Sign up" : "Sign in"}
              </button>
            </p>
          </>
        ) : step === "payment" ? (
          <>
            <button
              onClick={() => setStep("summary")}
              className="flex items-center gap-1 text-sm text-muted-foreground hover:text-on-background transition-colors mb-6 font-medium"
            >
              <ChevronLeft className="w-4 h-4" />
              Back to summary
            </button>

            <div className="flex items-center gap-3 mb-2">
              <CreditCard className="w-5 h-5 text-brand-pink" />
              <p className="text-brand-pink font-bold tracking-wider text-xs uppercase">
                Payment
              </p>
            </div>
            <h2 className="text-2xl font-black tracking-tight text-on-background mb-1">
              Choose Payment
            </h2>
            <p className="text-sm text-muted-foreground font-medium mb-6">
              Total: <span className="text-brand-pink font-black">{formatPrice(total)}</span>
              {appliedPromo && <span className="ml-2 text-brand-lime text-xs font-bold">({appliedPromo.code} applied)</span>}
            </p>

            {/* Payment method tabs */}
            <div className="grid grid-cols-5 gap-2 mb-8">
              {paymentMethods.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setSelectedMethod(m.id)}
                  className={`flex flex-col items-center gap-2 py-4 px-2 rounded-2xl border-2 transition-all text-xs font-bold ${
                    selectedMethod === m.id
                      ? "border-brand-pink bg-brand-pink/10 text-brand-pink"
                      : "border-border text-muted-foreground hover:border-muted-foreground/50"
                  }`}
                >
                  {m.icon}
                  {m.label}
                </button>
              ))}
            </div>

            {/* Wallet payment */}
            {selectedMethod === "wallet" && (
              <div className="space-y-4 mb-8">
                {savedCards.length > 0 && !addingNewCard ? (
                  <div className="space-y-3">
                    {savedCards.map((card) => (
                      <div
                        key={card.id}
                        className="flex items-center justify-between p-4 bg-secondary rounded-2xl border-2 border-brand-pink"
                      >
                        <div className="flex items-center gap-3">
                          <CreditCard className="w-5 h-5 text-brand-pink" />
                          <div>
                            <p className="text-sm font-bold text-on-background">
                              {card.brand} •••• {card.last4}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {card.holder} · Exp {card.expiry}
                            </p>
                          </div>
                        </div>
                        {card.isDefault && (
                          <span className="bg-[#CDFF00] text-black px-2 py-0.5 rounded-full text-[10px] font-black uppercase">
                            Default
                          </span>
                        )}
                      </div>
                    ))}
                    <button
                      onClick={() => setAddingNewCard(true)}
                      className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl border-2 border-dashed border-border text-muted-foreground hover:border-muted-foreground/50 hover:text-on-background transition-all text-xs font-bold"
                    >
                      <Plus className="w-4 h-4" />
                      Add New Card
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {savedCards.length > 0 && (
                      <button
                        onClick={() => setAddingNewCard(false)}
                        className="text-xs font-bold text-brand-pink hover:opacity-70 transition-opacity flex items-center gap-1"
                      >
                        <ChevronLeft className="w-3 h-3" /> Back to saved cards
                      </button>
                    )}
                    <p className="text-sm text-muted-foreground">
                      {savedCards.length === 0 ? "No saved payment methods. Add a card to your wallet." : "Add a new card to your wallet."}
                    </p>
                    <div>
                      <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 block">Card Number</label>
                      <input type="text" placeholder="4242 4242 4242 4242" className="w-full bg-secondary border border-border rounded-xl px-4 py-3 text-sm text-on-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand-pink/50 transition-all" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 block">Expiry</label>
                        <input type="text" placeholder="MM/YY" className="w-full bg-secondary border border-border rounded-xl px-4 py-3 text-sm text-on-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand-pink/50 transition-all" />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 block">CVC</label>
                        <input type="text" placeholder="123" className="w-full bg-secondary border border-border rounded-xl px-4 py-3 text-sm text-on-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand-pink/50 transition-all" />
                      </div>
                    </div>
                    <button className="w-full py-3 bg-brand-pink text-white font-black uppercase tracking-widest text-xs rounded-xl hover:opacity-90 transition-opacity">
                      Save Card
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Payment form area */}
            {selectedMethod === "card" && (
              <div className="space-y-4 mb-8">
                <div>
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 block">
                    Cardholder Name
                  </label>
                  <input
                    type="text"
                    placeholder="John Doe"
                    value={cardForm.name}
                    onChange={(e) => setCardForm({ ...cardForm, name: e.target.value })}
                    className="w-full bg-secondary border border-border rounded-xl px-4 py-3 text-sm text-on-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand-pink/50 transition-all"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 block">
                    Card Number
                  </label>
                  <input
                    type="text"
                    placeholder="4242 4242 4242 4242"
                    value={cardForm.number}
                    onChange={(e) => setCardForm({ ...cardForm, number: e.target.value })}
                    className="w-full bg-secondary border border-border rounded-xl px-4 py-3 text-sm text-on-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand-pink/50 transition-all"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 block">
                      Expiry
                    </label>
                    <input
                      type="text"
                      placeholder="MM / YY"
                      value={cardForm.expiry}
                      onChange={(e) => setCardForm({ ...cardForm, expiry: e.target.value })}
                      className="w-full bg-secondary border border-border rounded-xl px-4 py-3 text-sm text-on-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand-pink/50 transition-all"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 block">
                      CVC
                    </label>
                    <input
                      type="text"
                      placeholder="123"
                      value={cardForm.cvc}
                      onChange={(e) => setCardForm({ ...cardForm, cvc: e.target.value })}
                      className="w-full bg-secondary border border-border rounded-xl px-4 py-3 text-sm text-on-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand-pink/50 transition-all"
                    />
                  </div>
                </div>

                {/* Billing Address */}
                <div className="pt-4 border-t border-border">
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-4">
                    Billing Address
                  </p>
                  <div className="space-y-4">
                    <input
                      type="text"
                      placeholder="Street Address"
                      value={cardForm.address}
                      onChange={(e) => setCardForm({ ...cardForm, address: e.target.value })}
                      className="w-full bg-secondary border border-border rounded-xl px-4 py-3 text-sm text-on-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand-pink/50 transition-all"
                    />
                    <div className="grid grid-cols-2 gap-3">
                      <input
                        type="text"
                        placeholder="City"
                        value={cardForm.city}
                        onChange={(e) => setCardForm({ ...cardForm, city: e.target.value })}
                        className="w-full bg-secondary border border-border rounded-xl px-4 py-3 text-sm text-on-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand-pink/50 transition-all"
                      />
                      <input
                        type="text"
                        placeholder="State / Province"
                        value={cardForm.state}
                        onChange={(e) => setCardForm({ ...cardForm, state: e.target.value })}
                        className="w-full bg-secondary border border-border rounded-xl px-4 py-3 text-sm text-on-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand-pink/50 transition-all"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <input
                        type="text"
                        placeholder="ZIP / Postal Code"
                        value={cardForm.zip}
                        onChange={(e) => setCardForm({ ...cardForm, zip: e.target.value })}
                        className="w-full bg-secondary border border-border rounded-xl px-4 py-3 text-sm text-on-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand-pink/50 transition-all"
                      />
                      <input
                        type="text"
                        placeholder="Country"
                        value={cardForm.country}
                        onChange={(e) => setCardForm({ ...cardForm, country: e.target.value })}
                        className="w-full bg-secondary border border-border rounded-xl px-4 py-3 text-sm text-on-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand-pink/50 transition-all"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {selectedMethod === "apple" && (
              <div className="flex flex-col items-center justify-center py-12 mb-8 rounded-2xl border border-border bg-secondary/50">
                <Apple className="w-10 h-10 text-on-background mb-3" />
                <p className="font-black text-on-background">Apple Pay</p>
                <p className="text-sm text-muted-foreground font-medium mt-1">
                  You'll be redirected to Apple Pay
                </p>
              </div>
            )}

            {selectedMethod === "paypal" && (
              <div className="flex flex-col items-center justify-center py-12 mb-8 rounded-2xl border border-border bg-secondary/50">
                <div className="text-on-background mb-3"><PayPalIcon /></div>
                <p className="font-black text-on-background">PayPal</p>
                <p className="text-sm text-muted-foreground font-medium mt-1">
                  You'll be redirected to PayPal
                </p>
              </div>
            )}

            {selectedMethod === "klarna" && (
              <div className="flex flex-col items-center justify-center py-12 mb-8 rounded-2xl border border-border bg-secondary/50">
                <div className="text-on-background mb-3"><KlarnaIcon /></div>
                <p className="font-black text-on-background">Klarna</p>
                <p className="text-sm text-muted-foreground font-medium mt-1">
                  Pay in installments with Klarna
                </p>
              </div>
            )}

            <button
              disabled={purchasing}
              onClick={async () => {
                setPurchasing(true);
                try {
                  const { data: { user: currentUser } } = await supabase.auth.getUser();
                  if (!currentUser) {
                    toast.error("Please sign in to purchase tickets");
                    setPurchasing(false);
                    return;
                  }
                  // Check if user is blocked by this event's organization
                  const { data: eventData } = await supabase.from("events").select("organization_id").eq("id", eventId).single();
                  if (eventData?.organization_id) {
                    const { data: blocked } = await supabase.rpc("is_user_blocked_by_org", {
                      _user_id: currentUser.id,
                      _org_id: eventData.organization_id,
                    });
                    if (blocked) {
                      toast.error("You are unable to purchase tickets for this event");
                      setPurchasing(false);
                      return;
                    }
                  }
                  const quantityLimitExceeded = activeItems.find((item) => item.quantity > Math.max(1, item.maxPerOrder || 10));
                  if (quantityLimitExceeded) {
                    const limit = Math.max(1, quantityLimitExceeded.maxPerOrder || 10);
                    toast.error(`You can only purchase ${limit} ${quantityLimitExceeded.name} ticket${limit === 1 ? "" : "s"} per order`);
                    setPurchasing(false);
                    return;
                  }
                  // Save each cart item as an order and increment sold count
                  // Generate a shared group ID for this checkout transaction
                  const sharedGroupId = crypto.randomUUID();
                  // Distribute discount proportionally across items
                  const totalSubtotal = activeItems.reduce((s, item) => s + parsePrice(item.price) * item.quantity, 0);
                  for (const item of activeItems) {
                    const originalUnitPrice = parsePrice(item.price);
                    const itemSubtotal = originalUnitPrice * item.quantity;
                    // Proportional discount for this item
                    const itemDiscount = totalSubtotal > 0 && appliedPromo
                      ? (itemSubtotal / totalSubtotal) * discount
                      : 0;
                    const discountedItemSubtotal = Math.max(0, itemSubtotal - itemDiscount);
                    const itemServiceFee = calculateServiceFee(discountedItemSubtotal, item.quantity);
                    const itemTotal = discountedItemSubtotal + itemServiceFee;

                    // For seated events without a ticket_type, find or create one via RPC
                    let resolvedTicketTypeId = item.ticketTypeId;
                    if (!resolvedTicketTypeId && item.isSeated) {
                      const { data: ttId, error: ttErr } = await supabase.rpc("resolve_seated_ticket_type", {
                        _event_id: eventId,
                        _name: item.name,
                        _price: item.price,
                      });
                      if (ttErr) throw new Error("Failed to resolve ticket type: " + ttErr.message);
                      resolvedTicketTypeId = ttId;
                    }

                    if (!resolvedTicketTypeId) {
                      throw new Error("Could not resolve ticket type for " + item.name);
                    }

                    const { data: orderData, error: orderErr } = await supabase.from("orders").insert({
                      event_id: eventId,
                      user_id: currentUser.id,
                      ticket_type_id: resolvedTicketTypeId,
                      ticket_name: item.name,
                      quantity: item.quantity,
                      unit_price: +originalUnitPrice.toFixed(2),
                      service_fee: +itemServiceFee.toFixed(2),
                      total: +itemTotal.toFixed(2),
                      discount: +itemDiscount.toFixed(2),
                      promo_code: appliedPromo?.code || null,
                      ref_source: refSource,
                      billing_city: cardForm.city.trim(),
                      billing_state: cardForm.state.trim().toUpperCase().slice(0, 2),
                      billing_country: cardForm.country.trim().toUpperCase().slice(0, 3),
                      order_group_id: sharedGroupId,
                    }).select("id").single();

                    if (orderErr) throw new Error("Failed to create order: " + orderErr.message);

                    // For seated events, mark seats as sold with the order_id
                    if (item.seatIds && item.seatIds.length > 0 && orderData) {
                      await supabase
                        .from("seats")
                        .update({ status: "sold", order_id: orderData.id })
                        .in("id", item.seatIds);
                    }

                    // Increment sold count atomically
                    if (resolvedTicketTypeId) {
                      await supabase.rpc("purchase_tickets", {
                        _ticket_type_id: resolvedTicketTypeId,
                        _quantity: item.quantity,
                      });
                    }
                  }
                  setStep("confirmation");
                } catch (err: any) {
                  toast.error(err.message || "Purchase failed");
                } finally {
                  setPurchasing(false);
                }
              }}
              className="w-full bg-brand-pink text-primary-foreground py-4 rounded-full font-black tracking-tight text-base hover:scale-[1.02] transition-all shadow-xl flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {purchasing ? "Processing..." : `Pay ${formatPrice(total)}`}
            </button>

            <p className="text-center text-xs text-muted-foreground font-medium mt-4">
              Payments will be processed via Stripe. This is a demo.
            </p>
          </>
        ) : (
          <>
            {/* Purchase Confirmation */}
            <div className="flex flex-col items-center text-center py-8">
              <div className="w-20 h-20 rounded-full bg-[hsl(var(--brand-lime))]/15 flex items-center justify-center mb-6">
                <CheckCircle2 className="w-10 h-10 text-[hsl(var(--brand-lime))]" />
              </div>
              <h2 className="text-2xl font-black tracking-tight text-on-background mb-2">
                Purchase Confirmed!
              </h2>
              <p className="text-muted-foreground font-medium mb-2">
                Your tickets for <span className="font-bold text-on-background">{eventTitle}</span> have been confirmed.
              </p>
              <p className="text-sm text-muted-foreground font-medium mb-8">
                {totalTickets} ticket{totalTickets !== 1 ? "s" : ""} • {formatPrice(total)}
              </p>

              <div className="w-full space-y-3">
                <button
                  onClick={() => {
                    handleClose();
                    navigate("/profile");
                  }}
                  className="w-full bg-brand-pink text-primary-foreground py-4 rounded-full font-black tracking-tight text-base hover:scale-[1.02] transition-all shadow-xl flex items-center justify-center gap-2"
                >
                  <Ticket className="w-5 h-5" />
                  My Tickets
                </button>
                <button
                  onClick={handleClose}
                  className="w-full bg-secondary text-on-background py-4 rounded-full font-bold tracking-tight text-base hover:bg-accent transition-all"
                >
                  Close
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default CheckoutModal;
