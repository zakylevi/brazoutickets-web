import { useState } from "react";
import {
  CheckCircle, XCircle, AlertTriangle, ExternalLink, CreditCard,
  Building2, Clock, DollarSign, ArrowUpRight, ArrowDownRight,
  Shield, ChevronRight, RefreshCw, Banknote, Plus, X, Eye, MessageSquare,
  ArrowLeft,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface OrgPayoutsTabProps {
  orgSlug: string;
}

/* ── Mock data ── */
const STRIPE_CONNECTED = true;

const accountStatus = {
  connected: STRIPE_CONNECTED,
  chargesEnabled: STRIPE_CONNECTED,
  payoutsEnabled: STRIPE_CONNECTED,
  detailsSubmitted: STRIPE_CONNECTED,
  country: "US",
  currency: "usd",
};

const pendingBalance = 4_820.50;
const availableBalance = 12_340.00;

const recentPayouts = [
  { id: "po_1", amount: 3_200.00, status: "paid", date: "2026-03-22", arrival: "2026-03-24", method: "Bank ••4829" },
  { id: "po_2", amount: 5_640.00, status: "paid", date: "2026-03-15", arrival: "2026-03-17", method: "Bank ••4829" },
  { id: "po_3", amount: 2_100.00, status: "in_transit", date: "2026-03-24", arrival: "2026-03-26", method: "Bank ••4829" },
  { id: "po_4", amount: 8_900.00, status: "paid", date: "2026-03-08", arrival: "2026-03-10", method: "Bank ••4829" },
];

interface PayoutMethod {
  id: string;
  type: "bank" | "card";
  label: string;
  default: boolean;
}

const initialPayoutMethods: PayoutMethod[] = [
  { id: "ba_1", type: "bank", label: "Chase ••4829", default: true },
];

interface Dispute {
  id: string;
  customerName: string;
  amount: number;
  status: "needs_response" | "under_review" | "won" | "lost" | "expired";
  reason: string;
  deadline: string;
  outcome: string;
  created: string;
  event: string;
}

const allDisputes: Dispute[] = [
  { id: "dp_1", customerName: "Arielle Coulibaly", amount: 55.14, status: "lost", reason: "Credit Not Processed", deadline: "2026-03-25", outcome: "Lost", created: "2026-03-20", event: "Summer Bash" },
  { id: "dp_2", customerName: "Marcus Johnson", amount: 120.00, status: "needs_response", reason: "Fraudulent", deadline: "2026-04-01", outcome: "Pending", created: "2026-03-22", event: "Neon Nights" },
  { id: "dp_3", customerName: "Sofia Martinez", amount: 85.50, status: "under_review", reason: "Product Not Received", deadline: "2026-04-05", outcome: "Under Review", created: "2026-03-18", event: "Summer Bash" },
  { id: "dp_4", customerName: "James Wright", amount: 45.00, status: "won", reason: "Duplicate", deadline: "2026-03-15", outcome: "Won", created: "2026-03-10", event: "Afro House Collective" },
  { id: "dp_5", customerName: "Lena Park", amount: 200.00, status: "expired", reason: "Subscription Canceled", deadline: "2026-03-12", outcome: "Expired", created: "2026-03-01", event: "Neon Nights" },
  { id: "dp_6", customerName: "David Chen", amount: 65.00, status: "needs_response", reason: "General", deadline: "2026-04-03", outcome: "Pending", created: "2026-03-23", event: "Summer Bash" },
];

/* ── Helpers ── */
const fmt = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD" });

const statusColor: Record<string, string> = {
  paid: "bg-[hsl(var(--brand-lime))]/15 text-[hsl(var(--brand-lime))] dark:text-[hsl(72,100%,50%)]",
  in_transit: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  pending: "bg-muted text-muted-foreground",
  failed: "bg-destructive/15 text-destructive",
};

const disputeStatusColor: Record<string, string> = {
  needs_response: "bg-destructive/15 text-destructive",
  under_review: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  won: "bg-[hsl(var(--brand-lime))]/15 text-[hsl(var(--brand-lime))] dark:text-[hsl(72,100%,50%)]",
  lost: "bg-muted text-muted-foreground",
  expired: "bg-muted text-muted-foreground",
};

const disputeStatusLabel: Record<string, string> = {
  needs_response: "Needs Response",
  under_review: "Under Review",
  won: "Won",
  lost: "Lost",
  expired: "Expired",
};

const outcomeIcon: Record<string, React.ReactNode> = {
  Won: <CheckCircle className="w-3.5 h-3.5 text-[hsl(var(--brand-lime))]" />,
  Lost: <XCircle className="w-3.5 h-3.5 text-destructive" />,
  Expired: <Clock className="w-3.5 h-3.5 text-muted-foreground" />,
  "Under Review": <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />,
  Pending: <Clock className="w-3.5 h-3.5 text-amber-500" />,
};

type DisputeFilter = "all" | "needs_response" | "under_review" | "won" | "lost" | "expired";

const OrgPayoutsTab = ({ orgSlug }: OrgPayoutsTabProps) => {
  const [connecting, setConnecting] = useState(false);
  const [payoutMethods, setPayoutMethods] = useState<PayoutMethod[]>(initialPayoutMethods);
  const [addMethodOpen, setAddMethodOpen] = useState(false);
  const [newMethodLabel, setNewMethodLabel] = useState("");
  const [newMethodAccount, setNewMethodAccount] = useState("");
  const [newMethodRouting, setNewMethodRouting] = useState("");

  // Disputes screen
  const [showDisputes, setShowDisputes] = useState(false);
  const [disputeFilter, setDisputeFilter] = useState<DisputeFilter>("all");

  const handleConnect = () => {
    setConnecting(true);
    setTimeout(() => setConnecting(false), 2000);
  };

  const handleAddMethod = () => {
    if (!newMethodLabel.trim()) return;
    const last4 = newMethodAccount.slice(-4) || "0000";
    const method: PayoutMethod = {
      id: `ba_${Date.now()}`,
      type: "bank",
      label: `${newMethodLabel} ••${last4}`,
      default: payoutMethods.length === 0,
    };
    setPayoutMethods((prev) => [...prev, method]);
    setNewMethodLabel("");
    setNewMethodAccount("");
    setNewMethodRouting("");
    setAddMethodOpen(false);
  };

  const setDefault = (id: string) => {
    setPayoutMethods((prev) =>
      prev.map((m) => ({ ...m, default: m.id === id }))
    );
  };

  const removeMethod = (id: string) => {
    setPayoutMethods((prev) => {
      const filtered = prev.filter((m) => m.id !== id);
      if (filtered.length > 0 && !filtered.some((m) => m.default)) {
        filtered[0].default = true;
      }
      return filtered;
    });
  };

  const filteredDisputes = disputeFilter === "all"
    ? allDisputes
    : allDisputes.filter((d) => d.status === disputeFilter);

  const disputeCounts = {
    all: allDisputes.length,
    needs_response: allDisputes.filter((d) => d.status === "needs_response").length,
    under_review: allDisputes.filter((d) => d.status === "under_review").length,
    won: allDisputes.filter((d) => d.status === "won").length,
    lost: allDisputes.filter((d) => d.status === "lost").length,
    expired: allDisputes.filter((d) => d.status === "expired").length,
  };

  /* ── DISPUTES FULL SCREEN ── */
  if (showDisputes) {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => setShowDisputes(false)}
            className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center hover:bg-accent transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-foreground" />
          </button>
          <div>
            <h1 className="text-3xl md:text-4xl font-black tracking-tighter text-foreground">Disputes</h1>
            <p className="text-muted-foreground text-sm">Review and manage all payment disputes.</p>
          </div>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {([
            { key: "needs_response" as const, label: "Needs Response", color: "text-destructive" },
            { key: "under_review" as const, label: "Under Review", color: "text-amber-500" },
            { key: "won" as const, label: "Won", color: "text-[hsl(var(--brand-lime))] dark:text-[hsl(72,100%,50%)]" },
            { key: "lost" as const, label: "Lost", color: "text-muted-foreground" },
            { key: "expired" as const, label: "Expired", color: "text-muted-foreground" },
          ]).map((s) => (
            <div key={s.key} className="p-4 bg-card rounded-2xl border border-border text-center">
              <p className={`text-3xl font-black ${s.color}`}>{disputeCounts[s.key]}</p>
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mt-1">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Filter pills */}
        <div className="flex flex-wrap gap-2">
          {([
            { key: "all" as const, label: "All" },
            { key: "needs_response" as const, label: "Needs Response" },
            { key: "under_review" as const, label: "Under Review" },
            { key: "won" as const, label: "Won" },
            { key: "lost" as const, label: "Lost" },
            { key: "expired" as const, label: "Expired" },
          ]).map((f) => (
            <button
              key={f.key}
              onClick={() => setDisputeFilter(f.key)}
              className={`px-4 py-2 rounded-full text-xs font-bold transition-all ${
                disputeFilter === f.key
                  ? "bg-[hsl(var(--brand-pink))] text-primary-foreground"
                  : "bg-secondary text-muted-foreground hover:text-foreground hover:bg-accent"
              }`}
            >
              {f.label} ({disputeCounts[f.key]})
            </button>
          ))}
        </div>

        {/* Disputes Table */}
        <div className="bg-card rounded-3xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-secondary/50">
                  <th className="text-left px-6 py-4 font-bold text-xs uppercase tracking-widest text-muted-foreground">Name</th>
                  <th className="text-left px-4 py-4 font-bold text-xs uppercase tracking-widest text-muted-foreground">Amount</th>
                  <th className="text-left px-4 py-4 font-bold text-xs uppercase tracking-widest text-muted-foreground">Status</th>
                  <th className="text-left px-4 py-4 font-bold text-xs uppercase tracking-widest text-muted-foreground">Deadline</th>
                  <th className="text-left px-4 py-4 font-bold text-xs uppercase tracking-widest text-muted-foreground">Reason</th>
                  <th className="text-left px-4 py-4 font-bold text-xs uppercase tracking-widest text-muted-foreground">Outcome</th>
                  <th className="text-right px-6 py-4 font-bold text-xs uppercase tracking-widest text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredDisputes.map((d) => (
                  <tr key={d.id} className="hover:bg-secondary/40 transition-colors">
                    <td className="px-6 py-4">
                      <p className="font-bold text-foreground">{d.customerName}</p>
                    </td>
                    <td className="px-4 py-4 font-bold text-foreground">{fmt(d.amount)}</td>
                    <td className="px-4 py-4">
                      <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${disputeStatusColor[d.status]}`}>
                        {disputeStatusLabel[d.status]}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-muted-foreground">
                      <span className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5" />
                        {new Date(d.deadline).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-foreground">{d.reason}</td>
                    <td className="px-4 py-4">
                      <span className="flex items-center gap-1.5 font-bold text-foreground">
                        {outcomeIcon[d.outcome]} {d.outcome}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <button className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary text-xs font-bold text-foreground hover:bg-accent transition-colors border border-border">
                          <Eye className="w-3.5 h-3.5" /> View
                        </button>
                        {(d.status === "needs_response") && (
                          <button className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary text-xs font-bold text-foreground hover:bg-accent transition-colors border border-border">
                            <MessageSquare className="w-3.5 h-3.5" /> Respond
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredDisputes.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center">
                      <CheckCircle className="w-8 h-8 text-[hsl(var(--brand-lime))] mx-auto mb-2" />
                      <p className="text-sm font-bold text-foreground">No disputes found</p>
                      <p className="text-xs text-muted-foreground">No disputes match this filter.</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  /* ── Not connected state ── */
  if (!accountStatus.connected) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl md:text-4xl font-black tracking-tighter text-foreground mb-1">Payouts</h1>
          <p className="text-muted-foreground text-sm">Connect your payment account to start receiving payouts.</p>
        </div>
        <div className="max-w-xl mx-auto text-center py-16 space-y-6">
          <div className="w-20 h-20 rounded-3xl bg-[hsl(var(--brand-pink))]/10 mx-auto flex items-center justify-center">
            <CreditCard className="w-10 h-10 text-[hsl(var(--brand-pink))]" />
          </div>
          <div>
            <h2 className="text-2xl font-black tracking-tight text-foreground mb-2">Connect Stripe</h2>
            <p className="text-muted-foreground text-sm max-w-md mx-auto leading-relaxed">
              To sell tickets and receive payouts, your organization must complete the Stripe onboarding process.
              This verifies your identity and sets up your payout method.
            </p>
          </div>
          <button
            onClick={handleConnect}
            disabled={connecting}
            className="inline-flex items-center gap-2.5 px-8 py-4 rounded-full bg-[hsl(var(--brand-pink))] text-primary-foreground font-black text-sm hover:scale-105 active:scale-95 transition-all shadow-xl shadow-[hsl(var(--brand-pink))]/20 disabled:opacity-60"
          >
            {connecting ? <RefreshCw className="w-5 h-5 animate-spin" /> : <ExternalLink className="w-5 h-5" />}
            {connecting ? "Redirecting…" : "Start Stripe Onboarding"}
          </button>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-6 text-xs text-muted-foreground pt-4">
            <span className="flex items-center gap-1.5"><Shield className="w-3.5 h-3.5" /> Secure & Encrypted</span>
            <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> Takes ~5 minutes</span>
            <span className="flex items-center gap-1.5"><Banknote className="w-3.5 h-3.5" /> Payouts in 2 days</span>
          </div>
        </div>
      </div>
    );
  }

  /* ── Connected state ── */
  const openDisputeCount = allDisputes.filter((d) => d.status === "needs_response" || d.status === "under_review").length;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between md:items-end gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-black tracking-tighter text-foreground mb-1">Payouts</h1>
          <p className="text-muted-foreground text-sm">Manage your payment account, balances, and disputes.</p>
        </div>
        <button className="px-5 py-2.5 rounded-full bg-secondary text-sm font-bold border border-border hover:bg-accent transition-colors flex items-center gap-2">
          <ExternalLink className="w-4 h-4" />
          Stripe Dashboard
        </button>
      </div>

      {/* Account Status */}
      <div className="p-6 bg-card rounded-3xl border border-border">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-black text-sm uppercase tracking-widest text-muted-foreground">Account Status</h3>
          <Badge className="bg-[hsl(var(--brand-lime))]/15 text-[hsl(var(--brand-lime))] dark:text-[hsl(72,100%,50%)] border-[hsl(var(--brand-lime))]/20 font-bold text-xs">
            <CheckCircle className="w-3 h-3 mr-1" /> Active
          </Badge>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Charges Enabled", ok: accountStatus.chargesEnabled },
            { label: "Payouts Enabled", ok: accountStatus.payoutsEnabled },
            { label: "Details Submitted", ok: accountStatus.detailsSubmitted },
            { label: "Country", value: accountStatus.country.toUpperCase() },
          ].map((item) => (
            <div key={item.label} className="p-4 rounded-2xl bg-secondary/60">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">{item.label}</p>
              {item.value ? (
                <p className="text-sm font-black text-foreground">{item.value}</p>
              ) : (
                <span className="flex items-center gap-1.5 text-sm font-bold">
                  {item.ok ? (
                    <><CheckCircle className="w-4 h-4 text-[hsl(var(--brand-lime))]" /> <span className="text-foreground">Yes</span></>
                  ) : (
                    <><XCircle className="w-4 h-4 text-destructive" /> <span className="text-destructive">No</span></>
                  )}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Balance Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="p-8 bg-card rounded-3xl border border-border relative overflow-hidden group hover:shadow-lg hover:shadow-[hsl(var(--brand-lime))]/5 transition-all">
          <div className="flex items-center gap-2 mb-4">
            <DollarSign className="w-4 h-4 text-muted-foreground" />
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Available Balance</p>
          </div>
          <div className="flex items-end gap-3">
            <h2 className="text-4xl font-black text-[hsl(var(--brand-lime))] dark:text-[hsl(72,100%,50%)]">{fmt(availableBalance)}</h2>
            <span className="flex items-center text-[hsl(var(--brand-lime))] dark:text-[hsl(72,100%,50%)] text-xs font-bold mb-1.5">
              <ArrowUpRight className="w-3.5 h-3.5" /> Ready
            </span>
          </div>
        </div>
        <div className="p-8 bg-card rounded-3xl border border-border relative overflow-hidden group hover:shadow-lg hover:shadow-amber-500/5 transition-all">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="w-4 h-4 text-muted-foreground" />
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Pending Balance</p>
          </div>
          <div className="flex items-end gap-3">
            <h2 className="text-4xl font-black text-amber-500">{fmt(pendingBalance)}</h2>
            <span className="flex items-center text-amber-500 text-xs font-bold mb-1.5">
              <ArrowDownRight className="w-3.5 h-3.5" /> In transit
            </span>
          </div>
        </div>
      </div>

      {/* Recent Payouts */}
      <div className="bg-card rounded-3xl border border-border overflow-hidden">
        <div className="flex items-center justify-between px-6 py-5 border-b border-border">
          <h3 className="font-black text-sm uppercase tracking-widest text-muted-foreground">Recent Payouts</h3>
          <button className="text-xs font-bold text-[hsl(var(--brand-pink))] hover:underline flex items-center gap-1">
            View All <ChevronRight className="w-3 h-3" />
          </button>
        </div>
        <div className="divide-y divide-border">
          {recentPayouts.map((p) => (
            <div key={p.id} className="flex items-center justify-between px-6 py-4 hover:bg-secondary/40 transition-colors">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center">
                  <Banknote className="w-5 h-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-bold text-foreground">{fmt(p.amount)}</p>
                  <p className="text-[11px] text-muted-foreground">{p.method} · Arrival {new Date(p.arrival).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${statusColor[p.status] || statusColor.pending}`}>
                  {p.status === "in_transit" ? "In Transit" : p.status.charAt(0).toUpperCase() + p.status.slice(1)}
                </span>
                <span className="text-xs text-muted-foreground hidden sm:block">
                  {new Date(p.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Payout Methods & Disputes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Payout Methods */}
        <div className="bg-card rounded-3xl border border-border overflow-hidden">
          <div className="flex items-center justify-between px-6 py-5 border-b border-border">
            <h3 className="font-black text-sm uppercase tracking-widest text-muted-foreground">Payout Methods</h3>
            <button
              onClick={() => setAddMethodOpen(true)}
              className="text-xs font-bold text-[hsl(var(--brand-pink))] hover:underline flex items-center gap-1"
            >
              <Plus className="w-3 h-3" /> Add Method
            </button>
          </div>
          <div className="divide-y divide-border">
            {payoutMethods.map((m) => (
              <div key={m.id} className="flex items-center justify-between px-6 py-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center">
                    {m.type === "bank" ? <Building2 className="w-5 h-5 text-muted-foreground" /> : <CreditCard className="w-5 h-5 text-muted-foreground" />}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-foreground">{m.label}</p>
                    <p className="text-[11px] text-muted-foreground capitalize">{m.type} account</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {m.default ? (
                    <Badge variant="secondary" className="text-[10px] font-bold uppercase tracking-wider">Default</Badge>
                  ) : (
                    <button onClick={() => setDefault(m.id)} className="text-[10px] font-bold text-muted-foreground hover:text-foreground transition-colors">
                      Set Default
                    </button>
                  )}
                  <button onClick={() => removeMethod(m.id)} className="text-muted-foreground hover:text-destructive transition-colors p-1">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
            {payoutMethods.length === 0 && (
              <div className="px-6 py-8 text-center">
                <Building2 className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm font-bold text-foreground">No payout methods</p>
                <p className="text-xs text-muted-foreground">Add a bank account or card to receive payouts.</p>
              </div>
            )}
          </div>
        </div>

        {/* Disputes Preview */}
        <div className="bg-card rounded-3xl border border-border overflow-hidden">
          <div className="flex items-center justify-between px-6 py-5 border-b border-border">
            <h3 className="font-black text-sm uppercase tracking-widest text-muted-foreground">Disputes</h3>
            <div className="flex items-center gap-3">
              {openDisputeCount > 0 && (
                <Badge className="bg-destructive/15 text-destructive border-destructive/20 font-bold text-xs">
                  <AlertTriangle className="w-3 h-3 mr-1" /> {openDisputeCount} Open
                </Badge>
              )}
              <button
                onClick={() => setShowDisputes(true)}
                className="text-xs font-bold text-[hsl(var(--brand-pink))] hover:underline flex items-center gap-1"
              >
                View All <ChevronRight className="w-3 h-3" />
              </button>
            </div>
          </div>
          <div className="divide-y divide-border">
            {allDisputes.slice(0, 3).map((d) => (
              <div key={d.id} className="flex items-center justify-between px-6 py-4 hover:bg-secondary/40 transition-colors">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                    d.status === "won" ? "bg-[hsl(var(--brand-lime))]/10" :
                    d.status === "needs_response" ? "bg-destructive/10" :
                    "bg-secondary"
                  }`}>
                    {d.status === "won" ? <CheckCircle className="w-5 h-5 text-[hsl(var(--brand-lime))]" /> :
                     d.status === "needs_response" ? <AlertTriangle className="w-5 h-5 text-destructive" /> :
                     <AlertTriangle className="w-5 h-5 text-amber-500" />}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-foreground">{d.customerName} — {fmt(d.amount)}</p>
                    <p className="text-[11px] text-muted-foreground">{d.reason} · {d.event}</p>
                  </div>
                </div>
                <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${disputeStatusColor[d.status]}`}>
                  {disputeStatusLabel[d.status]}
                </span>
              </div>
            ))}
            {allDisputes.length === 0 && (
              <div className="px-6 py-8 text-center">
                <CheckCircle className="w-8 h-8 text-[hsl(var(--brand-lime))] mx-auto mb-2" />
                <p className="text-sm font-bold text-foreground">No disputes</p>
                <p className="text-xs text-muted-foreground">You're all clear!</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Add Payout Method Modal */}
      <Dialog open={addMethodOpen} onOpenChange={setAddMethodOpen}>
        <DialogContent className="sm:max-w-md rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-black tracking-tight">Add Bank Account</DialogTitle>
            <p className="text-sm text-muted-foreground">Add a bank account to receive payouts.</p>
          </DialogHeader>
          <div className="space-y-5 pt-2">
            {/* Warning */}
            <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm text-foreground space-y-2">
              <ul className="list-disc list-outside pl-4 space-y-1.5">
                <li><span className="font-bold">If you onboarded as an individual:</span> Ensure the account name matches the organization owner's name.</li>
                <li><span className="font-bold">If you onboarded as a business:</span> Ensure the account name matches the business name.</li>
              </ul>
            </div>

            <div className="space-y-3">
              <div>
                <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Account Holder Name</Label>
                <Input
                  value={newMethodLabel}
                  onChange={(e) => setNewMethodLabel(e.target.value)}
                  placeholder="Account Holder Name"
                  className="mt-1.5 rounded-xl"
                />
              </div>
              <div>
                <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Routing Number</Label>
                <Input
                  value={newMethodRouting}
                  onChange={(e) => setNewMethodRouting(e.target.value.replace(/\D/g, ""))}
                  placeholder="Routing Number"
                  className="mt-1.5 rounded-xl"
                  maxLength={9}
                />
              </div>
              <div>
                <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Account Number</Label>
                <Input
                  value={newMethodAccount}
                  onChange={(e) => setNewMethodAccount(e.target.value.replace(/\D/g, ""))}
                  placeholder="Account Number"
                  className="mt-1.5 rounded-xl"
                />
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setAddMethodOpen(false)}
                className="flex-1 py-3.5 rounded-full bg-secondary text-foreground font-black text-sm border border-border hover:bg-accent transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAddMethod}
                disabled={!newMethodLabel.trim()}
                className="flex-1 py-3.5 rounded-full bg-[hsl(var(--brand-pink))] text-primary-foreground font-black text-sm hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50"
              >
                Add Bank Account
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default OrgPayoutsTab;
