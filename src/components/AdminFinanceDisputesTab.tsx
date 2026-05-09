import { useState, useMemo, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { AlertTriangle, Clock, CheckCircle2, XCircle, Eye, MessageSquare, Filter, X, ExternalLink, User, Mail, Phone, CalendarCheck, DollarSign, Lock, Save, Ticket, Ban } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

type DisputeStatus = "open" | "in_review" | "won" | "lost";

interface Dispute {
  id: string;
  orderId: string;
  orderNumber: string;
  customer: string;
  customerEmail: string;
  customerPhone: string;
  customerJoined: string;
  customerTotalSpent: number;
  event: string;
  organizer: string;
  reason: string;
  amount: number;
  status: DisputeStatus;
  deadline: string;
  createdAt: string;
  disputeFee: number;
  resolvedAt: string | null;
  ticketName: string;
  quantity: number;
  serviceFee: number;
}

const mockDisputes: Dispute[] = [
  { id: "d1", orderId: "ORD-4821", orderNumber: "#22889001", customer: "Arielle Coulibaly", customerEmail: "arielle@email.com", customerPhone: "+1 (305) 555-0101", customerJoined: "2025-08-12", customerTotalSpent: 435.50, event: "Summer Beats Festival", organizer: "Vibe Productions", reason: "credit_not_processed", amount: 89.99, status: "open", deadline: "2026-04-05", createdAt: "2026-03-25", disputeFee: 15.00, resolvedAt: null, ticketName: "General Admission", quantity: 1, serviceFee: 11.99 },
  { id: "d2", orderId: "ORD-3190", orderNumber: "#22889022", customer: "Marcus Johnson", customerEmail: "marcus.j@email.com", customerPhone: "+1 (786) 555-0202", customerJoined: "2025-11-03", customerTotalSpent: 210.00, event: "Neon Nights", organizer: "Night Owl Events", reason: "duplicate", amount: 45.00, status: "in_review", deadline: "2026-04-02", createdAt: "2026-03-20", disputeFee: 15.00, resolvedAt: null, ticketName: "VIP", quantity: 1, serviceFee: 5.99 },
  { id: "d3", orderId: "ORD-7745", orderNumber: "#22889033", customer: "Sofia Martinez", customerEmail: "sofia.m@email.com", customerPhone: "+1 (954) 555-0303", customerJoined: "2025-06-20", customerTotalSpent: 890.00, event: "Bass Drop 2026", organizer: "Vibe Productions", reason: "product_not_received", amount: 120.00, status: "won", deadline: "2026-03-28", createdAt: "2026-03-10", disputeFee: 15.00, resolvedAt: "2026-03-26T14:30:00", ticketName: "Early Bird", quantity: 2, serviceFee: 15.98 },
  { id: "d4", orderId: "ORD-5512", orderNumber: "#22889044", customer: "David Chen", customerEmail: "david.c@email.com", customerPhone: "+1 (407) 555-0404", customerJoined: "2026-01-15", customerTotalSpent: 65.50, event: "Sunset Rooftop Party", organizer: "Rooftop Collective", reason: "fraudulent", amount: 65.50, status: "lost", deadline: "2026-03-22", createdAt: "2026-03-05", disputeFee: 15.00, resolvedAt: "2026-03-20T10:15:00", ticketName: "General Admission", quantity: 1, serviceFee: 8.69 },
  { id: "d5", orderId: "ORD-9923", orderNumber: "#22889055", customer: "Jasmine Williams", customerEmail: "jasmine.w@email.com", customerPhone: "+1 (561) 555-0505", customerJoined: "2025-09-01", customerTotalSpent: 320.00, event: "Underground Beats", organizer: "Night Owl Events", reason: "product_not_received", amount: 35.00, status: "open", deadline: "2026-04-08", createdAt: "2026-03-27", disputeFee: 15.00, resolvedAt: null, ticketName: "Standard", quantity: 1, serviceFee: 4.66 },
  { id: "d6", orderId: "ORD-1134", orderNumber: "#22889066", customer: "Tyler Robinson", customerEmail: "tyler.r@email.com", customerPhone: "+1 (239) 555-0606", customerJoined: "2025-12-10", customerTotalSpent: 178.00, event: "Summer Beats Festival", organizer: "Vibe Productions", reason: "duplicate", amount: 89.99, status: "in_review", deadline: "2026-04-01", createdAt: "2026-03-18", disputeFee: 15.00, resolvedAt: null, ticketName: "General Admission", quantity: 1, serviceFee: 11.99 },
  { id: "d7", orderId: "ORD-6678", orderNumber: "#22889077", customer: "Nina Patel", customerEmail: "nina.p@email.com", customerPhone: "+1 (813) 555-0707", customerJoined: "2025-07-28", customerTotalSpent: 550.00, event: "Neon Nights", organizer: "Night Owl Events", reason: "product_not_received", amount: 55.00, status: "won", deadline: "2026-03-30", createdAt: "2026-03-12", disputeFee: 15.00, resolvedAt: "2026-03-28T16:45:00", ticketName: "VIP", quantity: 1, serviceFee: 7.31 },
  { id: "d8", orderId: "ORD-2290", orderNumber: "#22889088", customer: "Carlos Rivera", customerEmail: "carlos.r@email.com", customerPhone: "+1 (321) 555-0808", customerJoined: "2025-10-05", customerTotalSpent: 720.00, event: "Bass Drop 2026", organizer: "Vibe Productions", reason: "product_not_received", amount: 150.00, status: "lost", deadline: "2026-03-19", createdAt: "2026-03-01", disputeFee: 15.00, resolvedAt: "2026-03-17T09:20:00", ticketName: "VIP Table", quantity: 1, serviceFee: 19.95 },
];

const statusConfig: Record<DisputeStatus, { label: string; color: string; icon: React.ReactNode }> = {
  open: { label: "Open", color: "bg-amber-500/15 text-amber-400 border-amber-500/30", icon: <AlertTriangle className="w-3 h-3" /> },
  in_review: { label: "In Review", color: "bg-blue-500/15 text-blue-400 border-blue-500/30", icon: <Clock className="w-3 h-3" /> },
  won: { label: "Won", color: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30", icon: <CheckCircle2 className="w-3 h-3" /> },
  lost: { label: "Lost", color: "bg-red-500/15 text-red-400 border-red-500/30", icon: <XCircle className="w-3 h-3" /> },
};

type FilterStatus = "all" | "won" | "lost" | "in_review";

const reasonLabels: Record<string, string> = {
  credit_not_processed: "Credit not processed",
  duplicate: "Duplicate charge",
  fraudulent: "Unauthorized transaction",
  product_not_received: "Product not received",
  not_as_described: "Not as described",
};

export default function AdminFinanceDisputesTab() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<FilterStatus>("all");
  const [adminEditEmail, setAdminEditEmail] = useState("");
  const [adminEditPassword, setAdminEditPassword] = useState("");
  const [selectedDispute, setSelectedDispute] = useState<Dispute | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<Dispute | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<Dispute | null>(null);
  const [totalRefunded, setTotalRefunded] = useState(0);

  useEffect(() => {
    supabase.from("orders").select("refunded_amount").gt("refunded_amount", 0).then(({ data }) => {
      if (data) setTotalRefunded(data.reduce((s, o) => s + Number(o.refunded_amount), 0));
    });
  }, []);

  const counts = useMemo(() => ({
    open: mockDisputes.filter(d => d.status === "open").length,
    in_review: mockDisputes.filter(d => d.status === "in_review").length,
    closed: mockDisputes.filter(d => d.status === "won" || d.status === "lost").length,
  }), []);

  const filtered = useMemo(() => {
    if (filter === "all") return mockDisputes;
    return mockDisputes.filter(d => d.status === filter);
  }, [filter]);

  const fmt = (v: number) => v.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const filters: { key: FilterStatus; label: string }[] = [
    { key: "all", label: "All" },
    { key: "in_review", label: "In Review" },
    { key: "won", label: "Won" },
    { key: "lost", label: "Lost" },
  ];

  const formatDate = (d: string) => {
    const date = new Date(d);
    return date.toLocaleDateString("en-US", { month: "numeric", day: "numeric", year: "numeric" });
  };

  const formatDateTime = (d: string) => {
    const date = new Date(d);
    return date.toLocaleDateString("en-US", { month: "numeric", day: "numeric", year: "numeric" }) + ", " + date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", second: "2-digit", hour12: true });
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <span className="font-bold uppercase tracking-[0.2em] text-[10px] text-brand-pink mb-1 block">Dispute Management</span>
        <h2 className="text-5xl font-black tracking-tighter text-foreground">DISPUTES</h2>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="rounded-2xl bg-card border border-border p-6 space-y-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Open Disputes</span>
          </div>
          <p className="text-4xl font-black text-foreground tabular-nums">{counts.open}</p>
        </div>
        <div className="rounded-2xl bg-card border border-border p-6 space-y-2">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-blue-400" />
            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">In Review</span>
          </div>
          <p className="text-4xl font-black text-foreground tabular-nums">{counts.in_review}</p>
        </div>
        <div className="rounded-2xl bg-card border border-border p-6 space-y-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Closed Disputes</span>
          </div>
          <p className="text-4xl font-black text-foreground tabular-nums">{counts.closed}</p>
        </div>
        <div className="rounded-2xl bg-card border border-border p-6 space-y-2">
          <div className="flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-red-400" />
            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Total Refunded</span>
          </div>
          <p className="text-4xl font-black text-red-400 tabular-nums">{fmt(totalRefunded)}</p>
        </div>
      </div>

      {/* Filter Pills */}
      <div className="flex items-center gap-2">
        <Filter className="w-4 h-4 text-muted-foreground" />
        {filters.map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={cn(
              "px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all",
              filter === f.key
                ? "bg-brand-pink text-white"
                : "bg-secondary text-muted-foreground hover:bg-brand-pink/10 hover:text-brand-pink"
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Disputes Table */}
      <div className="rounded-2xl bg-card border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-border">
              <TableHead className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Order ID</TableHead>
              <TableHead className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Customer</TableHead>
              <TableHead className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Event</TableHead>
              <TableHead className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Organizer</TableHead>
              <TableHead className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Reason</TableHead>
              <TableHead className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Amount</TableHead>
              <TableHead className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Status</TableHead>
              <TableHead className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Deadline</TableHead>
              <TableHead className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map(d => {
              const sc = statusConfig[d.status];
              return (
                <TableRow key={d.id} className="border-border">
                  <TableCell>
                    <button
                      onClick={() => setSelectedOrder(d)}
                      className="font-mono text-xs font-bold text-brand-pink hover:underline cursor-pointer"
                    >
                      {d.orderId}
                    </button>
                  </TableCell>
                  <TableCell>
                    <button
                      onClick={() => setSelectedCustomer(d)}
                      className="text-xs font-semibold text-foreground hover:text-brand-pink hover:underline cursor-pointer"
                    >
                      {d.customer}
                    </button>
                  </TableCell>
                  <TableCell className="text-xs font-semibold text-foreground">{d.event}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{d.organizer}</TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-[180px] truncate">{d.reason}</TableCell>
                  <TableCell className="text-xs font-bold text-foreground tabular-nums">{fmt(d.amount)}</TableCell>
                  <TableCell>
                    <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border", sc.color)}>
                      {sc.icon}
                      {sc.label}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground tabular-nums">{d.deadline}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-foreground"
                        onClick={() => setSelectedDispute(d)}
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground">
                        <MessageSquare className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-12 text-muted-foreground text-sm">
                  No disputes found for this filter.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* ── Dispute Details Modal ── */}
      <Dialog open={!!selectedDispute} onOpenChange={(open) => !open && setSelectedDispute(null)}>
        <DialogContent className="sm:max-w-[550px] rounded-3xl p-0 overflow-hidden">
          <DialogHeader className="px-8 pt-8 pb-0">
            <DialogTitle className="text-xl font-black tracking-tight">Dispute Details</DialogTitle>
            <p className="text-sm text-muted-foreground">Review dispute details and provide supporting evidence</p>
          </DialogHeader>
          {selectedDispute && (() => {
            const sc = statusConfig[selectedDispute.status];
            const totalCharged = selectedDispute.amount + selectedDispute.disputeFee;
            return (
              <div className="px-8 pb-8 space-y-6">
                {/* Info Grid */}
                <div className="grid grid-cols-3 gap-6 pt-4">
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground block mb-1">Disputor</span>
                    <span className="text-sm font-bold text-foreground">{selectedDispute.customer}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground block mb-1">Amount</span>
                    <span className="text-sm font-bold text-foreground">{fmt(selectedDispute.amount)}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground block mb-1">Order Number</span>
                    <button
                      onClick={() => { setSelectedDispute(null); setTimeout(() => setSelectedOrder(selectedDispute), 200); }}
                      className="text-sm font-bold text-brand-pink hover:underline cursor-pointer"
                    >
                      {selectedDispute.orderNumber}
                    </button>
                  </div>
                </div>

                <div className="border-t border-border" />

                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground block mb-1">Reason</span>
                    <span className="text-sm font-semibold text-foreground">{reasonLabels[selectedDispute.reason] || selectedDispute.reason}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground block mb-1">Date Filed</span>
                    <span className="text-sm font-semibold text-foreground">{formatDate(selectedDispute.createdAt)}</span>
                  </div>
                </div>

                <div className="border-t border-border" />

                <div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground block mb-1">Status</span>
                  <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border", sc.color)}>
                    {sc.icon}
                    {sc.label}
                  </span>
                </div>

                {/* Dispute Resolution Fee */}
                <div className="rounded-xl bg-red-500/10 border border-red-500/20 overflow-hidden">
                  <div className="px-5 py-3 border-b border-red-500/20">
                    <h3 className="text-sm font-black text-red-400">Dispute Resolution Fee</h3>
                  </div>
                  <div className="px-5 py-3 space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Transaction Amount:</span>
                      <span className="text-sm font-bold text-foreground tabular-nums">{fmt(selectedDispute.amount)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Dispute Fee Processing Fee:</span>
                      <span className="text-sm font-bold text-foreground tabular-nums">{fmt(selectedDispute.disputeFee)}</span>
                    </div>
                    <div className="border-t border-red-500/20 pt-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-bold text-foreground">Total Charged:</span>
                        <span className="text-sm font-black text-foreground tabular-nums">{fmt(totalCharged)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Timeline */}
                <div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground block mb-3">Timeline</span>
                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="w-3 h-3 rounded-full bg-blue-500 mt-1 shrink-0" />
                      <div>
                        <p className="text-sm font-bold text-foreground">Dispute Received</p>
                        <p className="text-xs text-muted-foreground">{formatDateTime(selectedDispute.createdAt)}</p>
                      </div>
                    </div>
                    {selectedDispute.resolvedAt && (
                      <div className="flex items-start gap-3">
                        <div className={cn("w-3 h-3 rounded-full mt-1 shrink-0", selectedDispute.status === "won" ? "bg-emerald-500" : "bg-red-500")} />
                        <div>
                          <p className="text-sm font-bold text-foreground">
                            Dispute {selectedDispute.status === "won" ? "Won" : "Lost"}
                          </p>
                          <p className="text-xs text-muted-foreground">{formatDateTime(selectedDispute.resolvedAt)}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* ── Customer Details Modal (exact same as Attendees tab) ── */}
      <Dialog open={!!selectedCustomer} onOpenChange={(open) => !open && setSelectedCustomer(null)}>
        <DialogContent className="sm:max-w-[750px] rounded-3xl p-0 overflow-hidden">
          <DialogHeader className="px-8 pt-8 pb-0 flex flex-row items-center justify-between">
            <DialogTitle className="text-xl font-black tracking-tight">Customer Details</DialogTitle>
            {selectedCustomer && (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-full font-bold gap-2 text-xs bg-[hsl(var(--brand-lime))] text-black hover:bg-[hsl(var(--brand-lime))]/90 border-none"
                  onClick={() => {
                    const slug = selectedCustomer.customer.toLowerCase().replace(/\s+/g, "-");
                    navigate(`/user/${slug}`);
                  }}
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  VIEW PROFILE PAGE
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-full font-bold gap-2 text-xs bg-destructive/10 text-destructive border-destructive/20 hover:bg-destructive/20"
                >
                  <Ban className="w-3.5 h-3.5" />
                  BLOCK USER
                </Button>
              </div>
            )}
          </DialogHeader>
          {selectedCustomer && (
            <div className="flex flex-col md:flex-row gap-0 md:gap-0">
              {/* Left side - Profile info */}
              <div className="md:w-[280px] flex-shrink-0 px-8 py-6 md:border-r border-border flex flex-col items-center text-center gap-4">
                <Avatar className="w-20 h-20 border-2 border-border">
                  <AvatarFallback className="bg-secondary text-foreground font-black text-xl">
                    {selectedCustomer.customer.split(" ").map((n: string) => n[0]).join("").toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <h3 className="text-lg font-black text-foreground">{selectedCustomer.customer}</h3>

                <div className="flex flex-col gap-3 w-full text-left">
                  <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    <Mail className="w-4 h-4 flex-shrink-0" />
                    <span className="truncate">{selectedCustomer.customerEmail}</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    <Phone className="w-4 h-4 flex-shrink-0" />
                    <span>{selectedCustomer.customerPhone}</span>
                  </div>
                </div>

                <div className="w-full border-t border-border pt-4 flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <CalendarCheck className="w-4 h-4" />
                      <span>Member Since</span>
                    </div>
                    <span className="text-sm font-black text-foreground">{new Date(selectedCustomer.customerJoined).toLocaleDateString("en-US", { month: "short", year: "numeric" })}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <CalendarCheck className="w-4 h-4" />
                      <span>Events Attended</span>
                    </div>
                    <span className="text-sm font-black text-foreground">0</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <DollarSign className="w-4 h-4" />
                      <span>Total Spent</span>
                    </div>
                    <span className="text-sm font-black text-[hsl(var(--brand-pink))]">{fmt(selectedCustomer.customerTotalSpent)}</span>
                  </div>
                </div>
              </div>

              {/* Right side - Account Management & Last Orders */}
              <div className="flex-1 px-6 py-6 min-w-0">
                {/* Account Management */}
                <h4 className="text-xs font-black uppercase tracking-[0.15em] text-muted-foreground mb-4">Account Management</h4>
                <div className="space-y-4 mb-6">
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground mb-1.5 block">Change Email</label>
                    <div className="flex gap-2">
                      <div className="flex-1 relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <input
                          type="email"
                          placeholder={selectedCustomer.customerEmail}
                          value={adminEditEmail}
                          onChange={e => setAdminEditEmail(e.target.value)}
                          className="w-full pl-10 pr-3 py-2.5 rounded-xl bg-secondary/50 border border-border text-sm font-bold text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-[hsl(var(--brand-pink))]/40"
                        />
                      </div>
                      <Button
                        size="sm"
                        disabled={!adminEditEmail.trim()}
                        className="rounded-xl bg-[hsl(var(--brand-pink))] hover:bg-[hsl(var(--brand-pink))]/90 text-white font-black text-[10px] uppercase tracking-widest px-4"
                      >
                        <Save className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground mb-1.5 block">Change Password</label>
                    <div className="flex gap-2">
                      <div className="flex-1 relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <input
                          type="password"
                          placeholder="New password (min 6 chars)"
                          value={adminEditPassword}
                          onChange={e => setAdminEditPassword(e.target.value)}
                          className="w-full pl-10 pr-3 py-2.5 rounded-xl bg-secondary/50 border border-border text-sm font-bold text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-[hsl(var(--brand-pink))]/40"
                        />
                      </div>
                      <Button
                        size="sm"
                        disabled={!adminEditPassword}
                        className="rounded-xl bg-[hsl(var(--brand-pink))] hover:bg-[hsl(var(--brand-pink))]/90 text-white font-black text-[10px] uppercase tracking-widest px-4"
                      >
                        <Save className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Last Orders */}
                <h4 className="text-xs font-black uppercase tracking-[0.15em] text-muted-foreground mb-4 pt-4 border-t border-border">Last Orders</h4>
                <div className="space-y-3 max-h-[180px] overflow-y-auto pr-2">
                  <div className="flex flex-col items-center justify-center py-8 text-center gap-2">
                    <Ticket className="w-6 h-6 text-muted-foreground/30" />
                    <p className="text-xs text-muted-foreground">No purchase history yet</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Order Details Modal ── */}
      <Dialog open={!!selectedOrder} onOpenChange={(open) => !open && setSelectedOrder(null)}>
        <DialogContent className="sm:max-w-[550px] rounded-3xl p-0 overflow-hidden">
          <DialogHeader className="px-8 pt-8 pb-0">
            <DialogTitle className="text-xl font-black tracking-tight">Order Details</DialogTitle>
          </DialogHeader>
          {selectedOrder && (() => {
            const totalProcessing = selectedOrder.amount + selectedOrder.serviceFee;
            const stripeFee = totalProcessing * 0.029 + 0.30;
            return (
              <div className="px-8 pb-8 space-y-6">
                <div className="grid grid-cols-2 gap-6 pt-4">
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground block mb-1">Order ID</span>
                    <span className="text-sm font-bold font-mono text-foreground">{selectedOrder.orderId}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground block mb-1">Order Number</span>
                    <span className="text-sm font-bold text-foreground">{selectedOrder.orderNumber}</span>
                  </div>
                </div>

                <div className="border-t border-border" />

                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground block mb-1">Customer</span>
                    <button
                      onClick={() => { setSelectedOrder(null); setTimeout(() => setSelectedCustomer(selectedOrder), 200); }}
                      className="text-sm font-bold text-brand-pink hover:underline cursor-pointer"
                    >
                      {selectedOrder.customer}
                    </button>
                  </div>
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground block mb-1">Event</span>
                    <span className="text-sm font-semibold text-foreground">{selectedOrder.event}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground block mb-1">Ticket</span>
                    <span className="text-sm font-semibold text-foreground">{selectedOrder.ticketName} × {selectedOrder.quantity}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground block mb-1">Date</span>
                    <span className="text-sm font-semibold text-foreground">{formatDate(selectedOrder.createdAt)}</span>
                  </div>
                </div>

                <div className="border-t border-border" />

                {/* Financial Breakdown */}
                <div className="rounded-xl bg-secondary/50 border border-border overflow-hidden">
                  <div className="px-5 py-3 border-b border-border">
                    <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Financial Breakdown</h3>
                  </div>
                  <div className="px-5 py-3 space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Ticket Price</span>
                      <span className="text-sm font-bold text-foreground tabular-nums">{fmt(selectedOrder.amount)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Service Fee</span>
                      <span className="text-sm font-bold text-foreground tabular-nums">{fmt(selectedOrder.serviceFee)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Total Processing</span>
                      <span className="text-sm font-bold text-foreground tabular-nums">{fmt(totalProcessing)}</span>
                    </div>
                    <div className="border-t border-border pt-2">
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Stripe Fee</span>
                        <span className="text-sm font-bold text-foreground tabular-nums">{fmt(stripeFee)}</span>
                      </div>
                    </div>
                    <div className="border-t border-border pt-2">
                      <div className="flex justify-between">
                        <span className="text-sm font-bold text-foreground">Platform Revenue</span>
                        <span className="text-sm font-black text-brand-pink tabular-nums">{fmt(selectedOrder.serviceFee - stripeFee)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
