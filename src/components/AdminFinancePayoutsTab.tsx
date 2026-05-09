import { useState } from "react";
import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  CreditCard,
  Building2,
  DollarSign,
  Clock,
  ArrowUpRight,
  ExternalLink,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const mockStripeConnection = {
  connected: true,
  accountId: "acct_1PxR4kLm9N2vQw",
  chargesEnabled: true,
  payoutsEnabled: true,
  detailsSubmitted: true,
  businessName: "Brazou Inc.",
  email: "finance@brazou.com",
  createdAt: "2024-08-15",
};

const mockPayoutMethod = {
  type: "bank_account" as const,
  bankName: "Chase",
  last4: "4829",
  routingLast4: "6789",
  holderName: "Brazou Inc.",
  currency: "USD",
};

const mockBalances = {
  available: 12450.67,
  pending: 3289.45,
};

const mockRecentPayouts = [
  { id: "po_1", amount: 4520.30, status: "paid", arrival: "2026-03-27", initiated: "2026-03-25", method: "Chase •••4829" },
  { id: "po_2", amount: 3100.00, status: "paid", arrival: "2026-03-20", initiated: "2026-03-18", method: "Chase •••4829" },
  { id: "po_3", amount: 2890.50, status: "paid", arrival: "2026-03-13", initiated: "2026-03-11", method: "Chase •••4829" },
  { id: "po_4", amount: 5200.00, status: "in_transit", arrival: "2026-03-29", initiated: "2026-03-27", method: "Chase •••4829" },
  { id: "po_5", amount: 1940.17, status: "paid", arrival: "2026-03-06", initiated: "2026-03-04", method: "Chase •••4829" },
  { id: "po_6", amount: 3380.90, status: "paid", arrival: "2026-02-27", initiated: "2026-02-25", method: "Chase •••4829" },
];

const fmt = (v: number) =>
  v.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });

const AdminFinancePayoutsTab = () => {
  const conn = mockStripeConnection;

  const StatusDot = ({ ok }: { ok: boolean }) => (
    <span className={cn("inline-block w-2 h-2 rounded-full", ok ? "bg-green-500" : "bg-red-500")} />
  );

  return (
    <div className="space-y-10">
      {/* Header */}
      <div>
        <span className="font-bold uppercase tracking-[0.2em] text-[10px] text-brand-pink mb-1 block">Platform Finance</span>
        <h2 className="text-5xl font-black tracking-tighter text-on-background">PAYOUTS</h2>
        <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mt-2">
          Manage platform Stripe connection, balances & payouts
        </p>
      </div>

      {/* Stripe Connection */}
      <div className="bg-secondary/50 rounded-[2rem] p-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <span className="font-bold uppercase tracking-[0.2em] text-[10px] text-brand-pink mb-1 block">Integration</span>
            <h3 className="text-xl font-black tracking-tighter text-on-background">Stripe Connection</h3>
          </div>
          <Button variant="outline" size="sm" className="text-xs font-bold uppercase tracking-widest gap-2">
            <ExternalLink className="w-3.5 h-3.5" />
            Open Stripe Dashboard
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Connection Status */}
          <div className="bg-background/50 rounded-2xl p-6 space-y-4">
            <p className="font-bold uppercase tracking-[0.15em] text-[9px] text-muted-foreground">Connection Status</p>
            <div className="flex items-center gap-3">
              {conn.connected ? (
                <CheckCircle className="w-8 h-8 text-green-500" />
              ) : (
                <XCircle className="w-8 h-8 text-red-500" />
              )}
              <div>
                <p className="text-sm font-black text-on-background">{conn.connected ? "Connected" : "Not Connected"}</p>
                <p className="text-[10px] text-muted-foreground font-bold">{conn.accountId}</p>
              </div>
            </div>
          </div>

          {/* Charges */}
          <div className="bg-background/50 rounded-2xl p-6 space-y-4">
            <p className="font-bold uppercase tracking-[0.15em] text-[9px] text-muted-foreground">Charges Enabled</p>
            <div className="flex items-center gap-3">
              <StatusDot ok={conn.chargesEnabled} />
              <p className="text-sm font-black text-on-background">{conn.chargesEnabled ? "Active" : "Disabled"}</p>
            </div>
          </div>

          {/* Payouts */}
          <div className="bg-background/50 rounded-2xl p-6 space-y-4">
            <p className="font-bold uppercase tracking-[0.15em] text-[9px] text-muted-foreground">Payouts Enabled</p>
            <div className="flex items-center gap-3">
              <StatusDot ok={conn.payoutsEnabled} />
              <p className="text-sm font-black text-on-background">{conn.payoutsEnabled ? "Active" : "Disabled"}</p>
            </div>
          </div>

          {/* Identity */}
          <div className="bg-background/50 rounded-2xl p-6 space-y-4">
            <p className="font-bold uppercase tracking-[0.15em] text-[9px] text-muted-foreground">Identity Verified</p>
            <div className="flex items-center gap-3">
              <StatusDot ok={conn.detailsSubmitted} />
              <p className="text-sm font-black text-on-background">{conn.detailsSubmitted ? "Verified" : "Pending"}</p>
            </div>
          </div>
        </div>

        <div className="mt-6 flex items-center gap-6 text-xs font-bold text-muted-foreground">
          <span>Business: <span className="text-on-background">{conn.businessName}</span></span>
          <span>Email: <span className="text-on-background">{conn.email}</span></span>
          <span>Since: <span className="text-on-background">{conn.createdAt}</span></span>
        </div>
      </div>

      {/* Balances + Payout Method */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Available Balance */}
        <div className="bg-[#CDFF00] rounded-[2rem] p-10">
          <DollarSign className="w-6 h-6 text-black/60 mb-4" />
          <p className="font-bold uppercase tracking-[0.2em] text-[10px] text-black/60 mb-1">Total Balance Available</p>
          <p className="text-4xl font-black tracking-tighter text-black tabular-nums">{fmt(mockBalances.available)}</p>
          <p className="text-[10px] font-bold uppercase tracking-widest text-black/50 mt-2">Ready for payout</p>
        </div>

        {/* In Transit Balance */}
        <div className="bg-secondary/50 rounded-[2rem] p-10">
          <Clock className="w-6 h-6 text-amber-500 mb-4" />
          <p className="font-bold uppercase tracking-[0.2em] text-[10px] text-muted-foreground mb-1">Total Balance In Transit</p>
          <p className="text-4xl font-black tracking-tighter text-on-background tabular-nums">{fmt(mockBalances.pending)}</p>
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mt-2">Expected within 2-3 business days</p>
        </div>

        {/* Payout Method */}
        <div className="bg-secondary/50 rounded-[2rem] p-10">
          <Building2 className="w-6 h-6 text-brand-pink mb-4" />
          <p className="font-bold uppercase tracking-[0.2em] text-[10px] text-muted-foreground mb-1">Payout Method</p>
          <div className="flex items-center gap-3 mt-3">
            <div className="w-12 h-12 rounded-xl bg-background/80 flex items-center justify-center">
              <CreditCard className="w-6 h-6 text-on-background" />
            </div>
            <div>
              <p className="text-sm font-black text-on-background">{mockPayoutMethod.bankName} •••{mockPayoutMethod.last4}</p>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Bank Account · {mockPayoutMethod.currency}</p>
            </div>
          </div>
          <p className="text-[10px] font-bold text-muted-foreground mt-4">
            Holder: <span className="text-on-background">{mockPayoutMethod.holderName}</span>
          </p>
          <div className="mt-4 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
              <p className="text-[10px] font-bold text-amber-600 dark:text-amber-400 leading-relaxed">
                Bank account name must match the business name used during Stripe onboarding.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Payouts */}
      <div className="bg-secondary/50 rounded-[2rem] p-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <span className="font-bold uppercase tracking-[0.2em] text-[10px] text-brand-pink mb-1 block">History</span>
            <h3 className="text-xl font-black tracking-tighter text-on-background">Recent Payouts</h3>
          </div>
          <Button variant="outline" size="sm" className="text-xs font-bold uppercase tracking-widest gap-2">
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </Button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-border">
                {["Status", "Amount", "Initiated", "Expected Arrival", "Method"].map((h) => (
                  <th key={h} className="py-3 px-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {mockRecentPayouts.map((p) => (
                <tr key={p.id} className="border-b border-border/50 hover:bg-secondary/50 transition-colors">
                  <td className="py-4 px-3">
                    <span className={cn(
                      "text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full inline-flex items-center gap-1.5",
                      p.status === "paid"
                        ? "bg-green-500/10 text-green-500"
                        : p.status === "in_transit"
                        ? "bg-amber-500/10 text-amber-500"
                        : "bg-red-500/10 text-red-500"
                    )}>
                      {p.status === "paid" && <CheckCircle className="w-3 h-3" />}
                      {p.status === "in_transit" && <Clock className="w-3 h-3" />}
                      {p.status === "paid" ? "Paid" : p.status === "in_transit" ? "In Transit" : p.status}
                    </span>
                  </td>
                  <td className="py-4 px-3 text-sm font-black text-on-background tabular-nums">{fmt(p.amount)}</td>
                  <td className="py-4 px-3 text-xs font-bold text-muted-foreground tabular-nums whitespace-nowrap">{p.initiated}</td>
                  <td className="py-4 px-3 text-xs font-bold text-on-background tabular-nums whitespace-nowrap">{p.arrival}</td>
                  <td className="py-4 px-3 text-xs font-bold text-muted-foreground">{p.method}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdminFinancePayoutsTab;
