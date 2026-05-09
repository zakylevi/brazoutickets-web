import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Search, X, ReceiptText, RotateCcw, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAdminGuard } from "@/hooks/useAdminGuard";
import { format } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { resolveOrderPricing } from "@/lib/orderPricing";
import { computeOrderFinancials, aggregateFinancials } from "@/lib/orderFinancials";
import { refundOrder, isOrderRefunded, getRefundableTicketAmount, applyRefundToOrders } from "@/lib/refunds";
import { toast } from "sonner";

interface Order {
  id: string;
  created_at: string;
  event_id: string;
  user_id: string;
  quantity: number;
  unit_price: number;
  service_fee: number;
  total: number;
  discount: number;
  ticket_name: string;
  status: string;
  ref_source: string;
  promo_code: string | null;
  refunded_amount?: number;
  refunded_at?: string | null;
  order_group_id?: string | null;
  checked_in?: boolean;
  checked_in_at?: string | null;
}

interface EventInfo {
  id: string;
  title: string;
}

interface ProfileInfo {
  user_id: string;
  name: string;
  email: string;
}

const AdminAllOrders = () => {
  const navigate = useNavigate();
  const { isAdmin, checking } = useAdminGuard();
  const [orders, setOrders] = useState<Order[]>([]);
  const [events, setEvents] = useState<EventInfo[]>([]);
  const [profiles, setProfiles] = useState<ProfileInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showPartialRefund, setShowPartialRefund] = useState(false);
  const [partialRefundAmount, setPartialRefundAmount] = useState("");
  const [refunding, setRefunding] = useState(false);

  useEffect(() => {
    if (!isAdmin && !checking) {
      navigate("/");
      return;
    }
    if (!isAdmin) return;
    const fetchData = async () => {
      const [ordersRes, eventsRes, profilesRes] = await Promise.all([
        supabase.from("orders").select("*").order("created_at", { ascending: false }),
        supabase.from("events").select("id, title"),
        supabase.from("profiles").select("user_id, name, email"),
      ]);
      setOrders((ordersRes.data as Order[]) || []);
      setEvents((eventsRes.data as EventInfo[]) || []);
      setProfiles((profilesRes.data as ProfileInfo[]) || []);
      setLoading(false);
    };
    fetchData();
  }, [isAdmin, checking, navigate]);

  const fmt = (v: number) =>
    v.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const filtered = useMemo(() => {
    if (!search.trim()) return orders;
    const q = search.toLowerCase();
    return orders.filter((o) => {
      const ev = events.find((e) => e.id === o.event_id);
      const profile = profiles.find((p) => p.user_id === o.user_id);
      return (
        o.id.toLowerCase().includes(q) ||
        o.ticket_name.toLowerCase().includes(q) ||
        (ev?.title || "").toLowerCase().includes(q) ||
        (profile?.name || "").toLowerCase().includes(q) ||
        (profile?.email || "").toLowerCase().includes(q) ||
        o.status.toLowerCase().includes(q)
      );
    });
  }, [orders, events, profiles, search]);

  const handleFullRefund = async () => {
    if (!selectedOrder) return;
    const refundable = getRefundableTicketAmount(selectedOrder);
    if (refundable <= 0) {
      toast.error("Nothing to refund");
      return;
    }
    setRefunding(true);
    try {
      await refundOrder(selectedOrder.id, refundable);
      const now = new Date().toISOString();
      setOrders((prev) => applyRefundToOrders(prev, selectedOrder.id, refundable, now));
      setSelectedOrder((prev) => prev ? { ...prev, status: "refunded", refunded_amount: refundable, refunded_at: now } : prev);
      toast.success(`Full refund of ${fmt(refundable)} processed`);
    } catch (err: any) {
      toast.error(err.message || "Refund failed");
    } finally {
      setRefunding(false);
    }
  };

  const handlePartialRefund = async () => {
    if (!selectedOrder) return;
    const amount = parseFloat(partialRefundAmount);
    const refundable = getRefundableTicketAmount(selectedOrder);
    if (isNaN(amount) || amount <= 0) {
      toast.error("Enter a valid refund amount");
      return;
    }
    if (amount > refundable) {
      toast.error(`Max refundable amount is ${fmt(refundable)}`);
      return;
    }
    setRefunding(true);
    try {
      await refundOrder(selectedOrder.id, amount);
      const now = new Date().toISOString();
      setOrders((prev) => applyRefundToOrders(prev, selectedOrder.id, amount, now));
      setSelectedOrder((prev) => prev ? { ...prev, status: "refunded", refunded_amount: amount, refunded_at: now } : prev);
      toast.success(`Partial refund of ${fmt(amount)} processed`);
      setShowPartialRefund(false);
      setPartialRefundAmount("");
    } catch (err: any) {
      toast.error(err.message || "Refund failed");
    } finally {
      setRefunding(false);
    }
  };

  if (checking || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-brand-pink border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const selectedEvent = selectedOrder ? events.find((e) => e.id === selectedOrder.event_id) : null;
  const selectedProfile = selectedOrder ? profiles.find((p) => p.user_id === selectedOrder.user_id) : null;
  const selectedPricing = selectedOrder
    ? resolveOrderPricing({ unitPrice: selectedOrder.unit_price, quantity: selectedOrder.quantity, discount: selectedOrder.discount, total: selectedOrder.total })
    : null;
  const selectedRefunded = isOrderRefunded(selectedOrder);
  const selectedRefundableAmount = selectedOrder ? getRefundableTicketAmount(selectedOrder) : 0;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-7xl mx-auto px-6 py-10">
        <Button variant="ghost" onClick={() => navigate("/admin")} className="mb-6 gap-2">
          <ArrowLeft className="w-4 h-4" /> Back to Admin
        </Button>

        <h1 className="text-3xl font-black tracking-tighter text-on-background mb-2">All Orders</h1>
        <p className="text-sm text-muted-foreground mb-8">All orders across all events</p>

        {/* Summary Cards */}
        {(() => {
          const finAgg = aggregateFinancials(filtered);
          const totalRefunded = filtered.reduce((s, o) => s + Number((o as any).refunded_amount || 0), 0);
          const totalProcessingValue = finAgg.totalProcessing;
          return (
            <div className="grid grid-cols-3 md:grid-cols-6 gap-4 mb-8">
              {[
                { label: "Gross Ticket Revenue", value: finAgg.grossTicketRevenue - totalRefunded },
                { label: "Total Service Fees", value: finAgg.totalServiceFees },
                { label: "Total Processing Value", value: totalProcessingValue },
                { label: "Total Refunded", value: totalRefunded, color: "text-red-400" },
                { label: "Total Stripe Fees", value: finAgg.totalStripeFees, color: "text-red-400" },
                { label: "Platform Revenue", value: finAgg.netPlatformRevenue, color: "text-brand-pink" },
              ].map((c) => (
                <div key={c.label} className="rounded-2xl p-6 bg-secondary/50">
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] mb-2 text-muted-foreground">{c.label}</p>
                  <p className={`text-2xl font-black tabular-nums ${"color" in c && c.color ? c.color : "text-on-background"}`}>{fmt(c.value)}</p>
                </div>
              ))}
            </div>
          );
        })()}


        <div className="flex items-center gap-4 mb-8">
          <div className="relative max-w-md flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by order ID, customer, email, event, ticket..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <Button
            variant="outline"
            className="gap-2 shrink-0"
            onClick={() => {
              const headers = ["Order ID","Date","Customer","Email","Event","Ticket","Qty","Unit Price","Discount","Subtotal","Service Fee","Total","Stripe Fee","Platform Revenue","Status","Source","Promo Code"];
               const rows = filtered.map((o) => {
                const ev = events.find((e) => e.id === o.event_id);
                const profile = profiles.find((p) => p.user_id === o.user_id);
                const f = computeOrderFinancials(o);
                return [
                  o.id.slice(0, 8).toUpperCase(),
                  format(new Date(o.created_at), "MMM d, yyyy"),
                  profile?.name || "",
                  profile?.email || "",
                  ev?.title || "",
                  o.ticket_name,
                  o.quantity,
                  Number(o.unit_price).toFixed(2),
                  Number(o.discount).toFixed(2),
                  f.subtotal.toFixed(2),
                  f.serviceFee.toFixed(2),
                  f.processingValue.toFixed(2),
                  f.stripeFee.toFixed(2),
                  f.platformRevenue.toFixed(2),
                  o.status,
                  o.ref_source,
                  o.promo_code || "",
                ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",");
              });
              const csv = [headers.join(","), ...rows].join("\n");
              const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = `orders_export_${format(new Date(), "yyyy-MM-dd")}.csv`;
              a.click();
              URL.revokeObjectURL(url);
              toast.success("CSV exported — open it in Google Sheets");
            }}
          >
            <Download className="w-4 h-4" />
            Export CSV
          </Button>
        </div>

        {/* Table */}
        <div className="bg-secondary/50 rounded-[2rem] p-8 overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-border">
                {["Order ID", "Date", "Customer", "Email", "Event", "Ticket", "Qty", "Unit Price", "Discount", "Subtotal", "Service Fee", "Total", "Stripe Fee", "Platform Revenue", "Status", "Source"].map((h) => (
                  <th key={h} className="py-3 px-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((o) => {
                const ev = events.find((e) => e.id === o.event_id);
                const profile = profiles.find((p) => p.user_id === o.user_id);
                return (
                  <tr
                    key={o.id}
                    className="border-b border-border/50 hover:bg-secondary/50 transition-colors cursor-pointer"
                    onClick={() => {
                      setSelectedOrder(o);
                      setShowPartialRefund(false);
                      setPartialRefundAmount("");
                    }}
                  >
                    <td className="py-3 px-3 text-[10px] font-mono font-bold text-brand-pink tabular-nums whitespace-nowrap underline">
                      {o.id.slice(0, 8).toUpperCase()}
                    </td>
                    <td className="py-3 px-3 text-xs font-bold text-on-background tabular-nums whitespace-nowrap">
                      {format(new Date(o.created_at), "MMM d, yyyy")}
                    </td>
                    <td className="py-3 px-3 text-xs font-bold text-on-background truncate max-w-[120px]">
                      {profile?.name || "—"}
                    </td>
                    <td className="py-3 px-3 text-xs text-muted-foreground truncate max-w-[150px]">
                      {profile?.email || "—"}
                    </td>
                    <td className="py-3 px-3 text-xs font-bold text-on-background truncate max-w-[150px]">
                      {ev?.title || "—"}
                    </td>
                    <td className="py-3 px-3 text-xs text-muted-foreground">{o.ticket_name}</td>
                    <td className="py-3 px-3 text-xs font-bold text-on-background tabular-nums">{o.quantity}</td>
                    <td className="py-3 px-3 text-xs font-bold text-on-background tabular-nums">{fmt(Number(o.unit_price))}</td>
                    <td className="py-3 px-3 text-xs text-red-500 tabular-nums">
                      {Number(o.discount) > 0 ? `-${fmt(Number(o.discount))}` : "—"}
                    </td>
                    <td className="py-3 px-3 text-xs font-bold text-on-background tabular-nums">
                      {fmt(Number(o.unit_price) * o.quantity - Number(o.discount))}
                    </td>
                    <td className="py-3 px-3 text-xs text-muted-foreground tabular-nums">{fmt(Number(o.service_fee))}</td>
                    <td className="py-3 px-3 text-xs font-black text-on-background tabular-nums">{fmt(Number(o.total))}</td>
                    {(() => {
                      const f = computeOrderFinancials(o);
                      return (
                        <>
                          <td className="py-3 px-3 text-xs font-bold text-red-400 tabular-nums">{fmt(f.stripeFee)}</td>
                          <td className="py-3 px-3 text-xs font-black text-brand-pink tabular-nums">{fmt(f.platformRevenue)}</td>
                        </>
                      );
                    })()}
                    <td className="py-3 px-3">
                      {o.checked_in ? (
                        <div>
                          <span className="text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-full bg-green-500/20 text-green-400">Scanned</span>
                          {o.checked_in_at && (
                            <p className="text-[9px] text-muted-foreground mt-1">
                              {new Date(o.checked_in_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })} {new Date(o.checked_in_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </p>
                          )}
                        </div>
                      ) : (
                        <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-full ${
                          o.status === "completed" ? "bg-green-500/20 text-green-400" :
                          o.status === "refunded" ? "bg-red-500/20 text-red-400" :
                          "bg-secondary text-muted-foreground"
                        }`}>
                          {o.status}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3">
                      <span className="text-[9px] font-black uppercase tracking-widest bg-secondary px-2 py-1 rounded-full text-muted-foreground">
                        {o.ref_source === "direct" ? "Event Link" : o.ref_source === "explore" ? "Brazou" : o.ref_source}
                      </span>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={16} className="text-center text-muted-foreground py-12 text-xs">
                    {search ? "No orders match your search" : "No orders found"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          {filtered.length > 0 && (
            <p className="text-center text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-4">
              Showing {filtered.length} of {orders.length} orders
            </p>
          )}
        </div>
      </div>

      {/* Order Details Modal */}
      <Dialog open={!!selectedOrder} onOpenChange={(open) => { if (!open) setSelectedOrder(null); }}>
        <DialogContent className="max-w-lg rounded-2xl border-border bg-surface p-0 overflow-hidden">
          <DialogHeader className="p-6 pb-0">
            <DialogTitle className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-brand-pink/10 flex items-center justify-center">
                <ReceiptText className="w-5 h-5 text-brand-pink" />
              </div>
              <div>
                <p className="text-lg font-black tracking-tight text-on-background">Order Details</p>
                <p className="text-[10px] font-mono font-bold text-muted-foreground">{selectedOrder?.id.toUpperCase()}</p>
              </div>
            </DialogTitle>
          </DialogHeader>

          {selectedOrder && selectedPricing && (
            <div className="p-6 space-y-5">
              {/* Order Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Customer</p>
                  <p className="text-sm font-bold text-on-background">{selectedProfile?.name || "—"}</p>
                  <p className="text-xs text-muted-foreground">{selectedProfile?.email || "—"}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Event</p>
                  <p className="text-sm font-bold text-on-background">{selectedEvent?.title || "—"}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Ticket</p>
                  <p className="text-sm font-bold text-on-background">{selectedOrder.ticket_name}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Date</p>
                  <p className="text-sm font-bold text-on-background">{format(new Date(selectedOrder.created_at), "MMM d, yyyy h:mm a")}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Source</p>
                  <span className="text-[9px] font-black uppercase tracking-widest bg-secondary px-2 py-1 rounded-full text-muted-foreground">
                    {selectedOrder.ref_source === "direct" ? "Event Link" : selectedOrder.ref_source === "explore" ? "Brazou" : selectedOrder.ref_source}
                  </span>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Status</p>
                  <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-full ${
                    selectedOrder.status === "completed" ? "bg-green-500/20 text-green-400" :
                    selectedOrder.status === "refunded" ? "bg-red-500/20 text-red-400" :
                    "bg-secondary text-muted-foreground"
                  }`}>
                    {selectedOrder.status}
                  </span>
                </div>
              </div>

              {/* Pricing Breakdown */}
              <div className="rounded-xl border border-border p-4 space-y-2">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-3">Spend Breakdown</p>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Original Ticket Price ({selectedOrder.quantity} × {fmt(Number(selectedOrder.unit_price))})</span>
                  <span className="font-bold text-on-background tabular-nums">{fmt(selectedPricing.ticketPrice)}</span>
                </div>
                {selectedPricing.promoDiscount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Promo Code{selectedOrder.promo_code ? ` (${selectedOrder.promo_code})` : ""}</span>
                    <span className="font-bold text-red-500 tabular-nums">-{fmt(selectedPricing.promoDiscount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm border-t border-border pt-2">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="font-bold text-on-background tabular-nums">{fmt(selectedPricing.subtotalAfterPromo)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Platform Service Fee <span className="text-[10px]">(non-refundable)</span></span>
                  <span className="font-bold text-on-background tabular-nums">{fmt(Number(selectedOrder.service_fee))}</span>
                </div>
                <div className="flex justify-between text-sm font-black border-t border-border pt-2">
                  <span className="text-on-background">Total Paid</span>
                  <span className="text-on-background tabular-nums">{fmt(Number(selectedOrder.total))}</span>
                </div>
                {selectedRefunded && (
                  <div className="flex justify-between text-sm border-t border-border pt-2">
                    <span className="text-red-400 font-bold">Refunded</span>
                    <span className="font-black text-red-400 tabular-nums">-{fmt(Number(selectedOrder.refunded_amount || 0))}</span>
                  </div>
                )}
              </div>

              {/* Refund Actions */}
              {!selectedRefunded && (
                <div className="space-y-3">
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Refund Actions</p>
                  <p className="text-[11px] text-muted-foreground">
                    Refund is deducted from organizer revenue. Service fees are non-refundable. Max refundable: <span className="font-bold text-on-background">{fmt(selectedRefundableAmount)}</span>
                  </p>

                  {!showPartialRefund ? (
                    <div className="flex gap-3">
                      <Button
                        onClick={handleFullRefund}
                        disabled={refunding}
                        className="flex-1 gap-2 bg-red-500 hover:bg-red-600 text-white font-bold"
                      >
                        <RotateCcw className="w-4 h-4" />
                        {refunding ? "Processing..." : `Full Refund (${fmt(selectedRefundableAmount)})`}
                      </Button>
                      <Button
                        onClick={() => setShowPartialRefund(true)}
                        disabled={refunding}
                        variant="outline"
                        className="flex-1 gap-2 font-bold"
                      >
                        Partial Refund
                      </Button>
                    </div>
                  ) : (
                    <div className="flex gap-3 items-end">
                      <div className="flex-1 space-y-1">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Refund Amount ($)</label>
                        <Input
                          type="number"
                          min="0.01"
                          max={selectedRefundableAmount}
                          step="0.01"
                          value={partialRefundAmount}
                          onChange={(e) => setPartialRefundAmount(e.target.value)}
                          placeholder={`Max ${fmt(selectedRefundableAmount)}`}
                          className="font-mono"
                        />
                      </div>
                      <Button
                        onClick={handlePartialRefund}
                        disabled={refunding || !partialRefundAmount}
                        className="gap-2 bg-red-500 hover:bg-red-600 text-white font-bold"
                      >
                        <RotateCcw className="w-4 h-4" />
                        {refunding ? "..." : "Refund"}
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => { setShowPartialRefund(false); setPartialRefundAmount(""); }}>
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {selectedRefunded && (
                <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-4 text-center">
                  <p className="text-sm font-bold text-red-400">This order has been refunded</p>
                  {selectedOrder.refunded_at && (
                    <p className="text-[10px] text-red-400/70 mt-1">
                      on {format(new Date(selectedOrder.refunded_at), "MMM d, yyyy h:mm a")}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminAllOrders;
