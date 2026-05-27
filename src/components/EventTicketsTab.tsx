import { useState, useEffect, useCallback } from "react";
import { StoredEvent, EventTicketTier, saveEvent } from "@/stores/eventStore";
import SeatingManager from "@/components/SeatingManager";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { calculateServiceFee } from "@/lib/orderPricing";
import { toast } from "sonner";
import {
  Plus, Ticket, CalendarIcon, Eye, EyeOff, Ban, Clock,
  Trash2, Edit2, Gift, Tag, Send, MoreHorizontal, ShieldCheck,
  CheckCircle2, XCircle, UserCheck, MessageSquare, ScanLine, Copy, RefreshCw, Loader2,
} from "lucide-react";

/* ──────────── Types ──────────── */

interface DashboardTicket {
  id: string;
  name: string;
  price: string;
  quantity: number;
  maxPerOrder: number;
  sold: number;
  soldOut: boolean;
  hidden: boolean;
  availableSoon: boolean;
  availableDate: string | null;
  approvalRequired: boolean;
}

interface TicketRequest {
  id: string;
  eventId: string;
  ticketTypeId: string;
  userId: string;
  status: string;
  quantity: number;
  message: string;
  createdAt: string;
  userName?: string;
  userEmail?: string;
  ticketName?: string;
}

const grossPrice = (price: string) => {
  const p = parseFloat(price) || 0;
  return p;
};

const displayPrice = (price: string) => {
  const p = parseFloat(price) || 0;
  return p + calculateServiceFee(p, 1);
};

const serviceFeePreview = (price: string) => calculateServiceFee(grossPrice(price), 1);

const formatCurrency = (v: number) => v > 0 ? `$${v.toFixed(2)}` : "Free";

interface CompTicket {
  id: string;
  email: string;
  ticketType: string;
  sentAt: string;
}

interface PromoCode {
  id: string;
  code: string;
  ticketType: string; // "all" or ticket id
  discountType: "percentage" | "fixed";
  discountValue: string;
  maxUses: number;
  used: number;
}

interface ScannerPin {
  id: string;
  pin: string;
  label: string;
  createdAt: string;
}

/* ──────────── Component ──────────── */

interface Props {
  event: StoredEvent;
  onEventUpdate: (e: StoredEvent) => void;
  showTicketManagement?: boolean;
  showCompTickets?: boolean;
}

const EventTicketsTab = ({ event, showTicketManagement = true, showCompTickets = true }: Props) => {
  const [tickets, setTickets] = useState<DashboardTicket[]>([]);
  const [compTickets, setCompTickets] = useState<CompTicket[]>([]);
  const [promoCodes, setPromoCodes] = useState<PromoCode[]>([]);
  const [ticketRequests, setTicketRequests] = useState<TicketRequest[]>([]);
  const [_loading, setLoading] = useState(true);
  const salesDisabled = !!event.salesDisabled;
  
  const [scannerPins, setScannerPins] = useState<ScannerPin[]>([]);
  const [generatingPins, setGeneratingPins] = useState(false);

  // Modals
  const [showAddTicket, setShowAddTicket] = useState(false);
  const [editingTicket, setEditingTicket] = useState<DashboardTicket | null>(null);
  const [editForm, setEditForm] = useState({ name: "", price: "", quantity: "", maxPerOrder: "10" });
  const [showCompModal, setShowCompModal] = useState(false);
  const [showPromoModal, setShowPromoModal] = useState(false);
  const [editingPromo, setEditingPromo] = useState<PromoCode | null>(null);
  const [editPromoForm, setEditPromoForm] = useState({
    code: "",
    ticketType: "all",
    discountType: "percentage" as "percentage" | "fixed",
    discountValue: "",
    maxUses: "50",
  });

  // Add ticket form
  const [newTicket, setNewTicket] = useState({ name: "", price: "", quantity: "100", maxPerOrder: "10", approvalRequired: false });

  // Comp form
  const [compForm, setCompForm] = useState({ email: "", ticketType: "" });

  // Promo form
  const [promoForm, setPromoForm] = useState({
    code: "",
    ticketType: "all",
    discountType: "percentage" as "percentage" | "fixed",
    discountValue: "",
    maxUses: "50",
  });

  // Date picker for available soon
  const [datePickerOpen, setDatePickerOpen] = useState<string | null>(null);

  // ── Load all data from DB ──
  const loadData = useCallback(async () => {
    const [ticketsRes, compRes, promoRes, ordersRes, requestsRes] = await Promise.all([
      supabase.from("ticket_types").select("*").eq("event_id", event.id).order("created_at"),
      supabase.from("comp_tickets").select("*").eq("event_id", event.id).order("sent_at", { ascending: false }),
      supabase.from("promo_codes").select("*").eq("event_id", event.id).order("created_at"),
      supabase.from("orders").select("promo_code").eq("event_id", event.id).not("promo_code", "is", null),
      supabase.from("ticket_requests" as any).select("*").eq("event_id", event.id).order("created_at", { ascending: false }),
    ]);

    // Count actual promo code usage from orders
    const promoUsageMap: Record<string, number> = {};
    (ordersRes.data || []).forEach((o: any) => {
      const code = (o.promo_code || "").toUpperCase();
      if (code) promoUsageMap[code] = (promoUsageMap[code] || 0) + 1;
    });

    if (ticketsRes.data) {
      setTickets(ticketsRes.data.map((r: any) => ({
        id: r.id,
        name: r.name,
        price: r.price,
        quantity: r.quantity,
        maxPerOrder: r.max_per_order ?? 10,
        sold: r.sold,
        soldOut: r.sold_out,
        hidden: r.hidden,
        availableSoon: r.available_soon,
        availableDate: r.available_date,
        approvalRequired: !!r.approval_required,
      })));
    }
    if (compRes.data) {
      setCompTickets(compRes.data.map((r: any) => ({
        id: r.id,
        email: r.email,
        ticketType: r.ticket_type,
        sentAt: r.sent_at,
      })));
    }
    if (promoRes.data) {
      setPromoCodes(promoRes.data.map((r: any) => ({
        id: r.id,
        code: r.code,
        ticketType: r.ticket_type,
        discountType: r.discount_type as "percentage" | "fixed",
        discountValue: r.discount_value,
        maxUses: r.max_uses,
        used: promoUsageMap[(r.code || "").toUpperCase()] || 0,
      })));
    }

    // Load requests with user profiles
    if (requestsRes.data) {
      const requests = requestsRes.data as any[];
      const userIds = [...new Set(requests.map((r: any) => r.user_id))];
      let profileMap: Record<string, { name: string; email: string }> = {};
      if (userIds.length > 0) {
        const { data: profiles } = await supabase.from("profiles").select("user_id, name, email").in("user_id", userIds);
        if (profiles) {
          profiles.forEach((p: any) => { profileMap[p.user_id] = { name: p.name, email: p.email }; });
        }
      }
      setTicketRequests(requests.map((r: any) => ({
        id: r.id,
        eventId: r.event_id,
        ticketTypeId: r.ticket_type_id,
        userId: r.user_id,
        status: r.status,
        quantity: r.quantity,
        message: r.message || "",
        createdAt: r.created_at,
        userName: profileMap[r.user_id]?.name || "Unknown",
        userEmail: profileMap[r.user_id]?.email || "",
      })));
    }

    // Load scanner pins
    const { data: pinsData } = await supabase
      .from("scanner_pins" as any)
      .select("*")
      .eq("event_id", event.id)
      .order("created_at");
    if (pinsData) {
      setScannerPins((pinsData as any[]).map((r: any) => ({
        id: r.id,
        pin: r.pin,
        label: r.label || "",
        createdAt: r.created_at,
      })));
    }

    setLoading(false);
  }, [event.id]);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Ticket CRUD ──
  const addTicket = async () => {
    if (!newTicket.name.trim()) return;
    const { data, error } = await supabase.from("ticket_types").insert({
      event_id: event.id,
      name: newTicket.name,
      price: newTicket.price,
      quantity: parseInt(newTicket.quantity) || 100,
      max_per_order: parseInt(newTicket.maxPerOrder) || 10,
      approval_required: newTicket.approvalRequired,
    } as any).select().single();

    if (error) { console.error(error); return; }
    setTickets((prev) => [...prev, {
      id: (data as any).id,
      name: (data as any).name,
      price: (data as any).price,
      quantity: (data as any).quantity,
      maxPerOrder: (data as any).max_per_order ?? 10,
      sold: 0, soldOut: false, hidden: false, availableSoon: false, availableDate: null,
      approvalRequired: !!(data as any).approval_required,
    }]);
    setNewTicket({ name: "", price: "", quantity: "100", maxPerOrder: "10", approvalRequired: false });
    setShowAddTicket(false);
  };

  const updateTicket = async (id: string, patch: Partial<DashboardTicket>) => {
    setTickets((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
    const dbPatch: any = {};
    if (patch.name !== undefined) dbPatch.name = patch.name;
    if (patch.price !== undefined) dbPatch.price = patch.price;
    if (patch.quantity !== undefined) dbPatch.quantity = patch.quantity;
    if (patch.maxPerOrder !== undefined) dbPatch.max_per_order = patch.maxPerOrder;
    if (patch.soldOut !== undefined) dbPatch.sold_out = patch.soldOut;
    if (patch.hidden !== undefined) dbPatch.hidden = patch.hidden;
    if (patch.availableSoon !== undefined) dbPatch.available_soon = patch.availableSoon;
    if (patch.availableDate !== undefined) dbPatch.available_date = patch.availableDate;
    if (patch.approvalRequired !== undefined) dbPatch.approval_required = patch.approvalRequired;
    if (Object.keys(dbPatch).length > 0) {
      await supabase.from("ticket_types").update(dbPatch).eq("id", id);
    }
  };

  const deleteTicket = async (id: string) => {
    setTickets((prev) => prev.filter((t) => t.id !== id));
    await supabase.from("ticket_types").delete().eq("id", id);
  };

  // ── Ticket Requests ──
  const handleRequestAction = async (requestId: string, action: "approved" | "rejected") => {
    const fnName = action === "approved" ? "capture-auth-hold" : "cancel-auth-hold";
    const { error } = await supabase.functions.invoke(fnName, { body: { requestId } });
    if (error) { console.error(error); toast.error(`Failed to ${action} request`); return; }
    setTicketRequests((prev) => prev.map((r) => r.id === requestId ? { ...r, status: action } : r));
    toast.success(action === "approved" ? "Approved — payment captured" : "Request rejected — hold released");
  };

  const pendingRequests = ticketRequests.filter((r) => r.status === "pending");


  // ── Comp tickets ──
  const sendCompTicket = async () => {
    if (!compForm.email.trim() || !compForm.ticketType) return;
    const { data, error } = await supabase.from("comp_tickets").insert({
      event_id: event.id,
      email: compForm.email,
      ticket_type: compForm.ticketType,
    } as any).select().single();

    if (error) { console.error(error); return; }
    setCompTickets((prev) => [{
      id: (data as any).id,
      email: (data as any).email,
      ticketType: (data as any).ticket_type,
      sentAt: (data as any).sent_at,
    }, ...prev]);
    setCompForm({ email: "", ticketType: "" });
    setShowCompModal(false);
  };

  // ── Promo codes ──
  const addPromoCode = async () => {
    if (!promoForm.code.trim() || !promoForm.discountValue) return;
    const { data, error } = await supabase.from("promo_codes").insert({
      event_id: event.id,
      code: promoForm.code.toUpperCase(),
      ticket_type: promoForm.ticketType,
      discount_type: promoForm.discountType,
      discount_value: promoForm.discountValue,
      max_uses: parseInt(promoForm.maxUses) || 50,
    } as any).select().single();

    if (error) { console.error(error); return; }
    setPromoCodes((prev) => [...prev, {
      id: (data as any).id,
      code: (data as any).code,
      ticketType: (data as any).ticket_type,
      discountType: (data as any).discount_type,
      discountValue: (data as any).discount_value,
      maxUses: (data as any).max_uses,
      used: 0,
    }]);
    setPromoForm({ code: "", ticketType: "all", discountType: "percentage", discountValue: "", maxUses: "50" });
    setShowPromoModal(false);
  };

  const updatePromo = async () => {
    if (!editingPromo || !editPromoForm.code.trim() || !editPromoForm.discountValue) return;
    const updated = {
      code: editPromoForm.code.toUpperCase(),
      ticket_type: editPromoForm.ticketType,
      discount_type: editPromoForm.discountType,
      discount_value: editPromoForm.discountValue,
      max_uses: parseInt(editPromoForm.maxUses) || 50,
    };
    const { error } = await supabase.from("promo_codes").update(updated).eq("id", editingPromo.id);
    if (error) { console.error(error); return; }
    setPromoCodes((prev) => prev.map((p) => p.id === editingPromo.id ? {
      ...p,
      code: updated.code,
      ticketType: updated.ticket_type,
      discountType: updated.discount_type as "percentage" | "fixed",
      discountValue: updated.discount_value,
      maxUses: updated.max_uses,
    } : p));
    setEditingPromo(null);
  };

  const openEditPromo = (p: PromoCode) => {
    setEditPromoForm({
      code: p.code,
      ticketType: p.ticketType,
      discountType: p.discountType as "percentage" | "fixed",
      discountValue: p.discountValue,
      maxUses: String(p.maxUses),
    });
    setEditingPromo(p);
  };

  const deletePromo = async (id: string) => {
    setPromoCodes((prev) => prev.filter((p) => p.id !== id));
    await supabase.from("promo_codes").delete().eq("id", id);
  };

  // ── Scanner PINs ──
  const generateScannerPins = async () => {
    setGeneratingPins(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      const userId = session?.session?.user?.id;
      if (!userId) { toast.error("Not authenticated"); return; }

      // Generate 6 unique 6-digit PINs, checking against all existing PINs
      const { data: existingPins } = await supabase
        .from("scanner_pins" as any)
        .select("pin");
      const usedPins = new Set((existingPins as any[] || []).map((p: any) => p.pin));

      let pin = "";
      do {
        pin = String(Math.floor(100000 + Math.random() * 900000));
      } while (usedPins.has(pin));

      const rows = [{
        event_id: event.id,
        pin,
        label: `Scanner PIN`,
        created_by: userId,
      }];

      const { data, error } = await supabase
        .from("scanner_pins" as any)
        .insert(rows)
        .select();

      if (error) { toast.error("Failed to generate PINs"); console.error(error); return; }
      setScannerPins((prev) => [
        ...prev,
        ...(data as any[]).map((r: any) => ({
          id: r.id,
          pin: r.pin,
          label: r.label || "",
          createdAt: r.created_at,
        })),
      ]);
      toast.success("Scanner PINs generated!");
    } finally {
      setGeneratingPins(false);
    }
  };

  const deleteScannerPin = async (id: string) => {
    setScannerPins((prev) => prev.filter((p) => p.id !== id));
    await supabase.from("scanner_pins" as any).delete().eq("id", id);
  };

  const copyPin = (pin: string) => {
    navigator.clipboard.writeText(pin);
    toast.success(`PIN ${pin} copied!`);
  };

  return (
    <div className="space-y-8">
      {salesDisabled && (
        <div className="p-5 rounded-2xl bg-orange-500/10 border border-orange-500/30 flex items-center gap-3">
          <Ban className="w-5 h-5 text-orange-500 shrink-0" />
          <div>
            <p className="text-orange-500 font-black uppercase tracking-widest text-xs">Sales Disabled by Admin</p>
            <p className="text-muted-foreground text-xs mt-1">Ticket editing is locked and all tickets are hidden from the event page until sales are re-enabled.</p>
          </div>
        </div>
      )}
      {/* ──────────── SEATING MAP (for seated events) ──────────── */}
      {event.eventType === "seated" && (
        <div className="bg-card rounded-3xl border border-border overflow-hidden p-6">
          <SeatingManager eventId={event.id} />
        </div>
      )}

      {/* ──────────── TICKET TYPES ──────────── */}
      {showTicketManagement && event.eventType !== "seated" && <div className={`bg-card rounded-3xl border border-border overflow-hidden ${salesDisabled ? "opacity-60 pointer-events-none" : ""}`}>
        <div className="px-6 py-5 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Ticket className="w-5 h-5 text-[hsl(var(--brand-pink))]" />
            <h2 className="text-lg font-black tracking-tight">Ticket Types</h2>
          </div>
          <Button
            onClick={() => setShowAddTicket(true)}
            size="sm"
            disabled={salesDisabled}
            className="rounded-full bg-[hsl(var(--brand-pink))] hover:bg-[hsl(var(--brand-pink))]/90 text-white font-bold gap-2"
          >
            <Plus className="w-4 h-4" /> Add Ticket
          </Button>
        </div>

        {tickets.length === 0 ? (
          <div className="p-12 text-center">
            <Ticket className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-40" />
            <p className="text-sm text-muted-foreground font-medium">No ticket types yet. Add your first ticket type.</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {tickets.map((ticket) => (
              <div
                key={ticket.id}
                className={cn(
                  "px-6 py-5 flex flex-col sm:flex-row items-start sm:items-center gap-4 transition-all",
                  ticket.hidden && "opacity-50",
                  ticket.soldOut && "opacity-70"
                )}
              >
                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-bold text-foreground truncate">{ticket.name}</h4>
                    {ticket.soldOut && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-destructive/10 text-destructive">
                        Sold Out
                      </span>
                    )}
                    {ticket.hidden && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-muted text-muted-foreground">
                        Hidden
                      </span>
                    )}
                    {ticket.approvalRequired && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary/10 text-primary">
                        <ShieldCheck className="w-3 h-3 inline mr-0.5" />
                        Approval
                      </span>
                    )}
                    {ticket.availableSoon && !ticket.soldOut && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[hsl(var(--brand-lime))]/10 text-[hsl(var(--brand-lime))]">
                        <Clock className="w-3 h-3 inline mr-0.5" />
                        {ticket.availableDate
                          ? format(new Date(ticket.availableDate), "MMM d")
                          : "Soon"}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span className="font-bold text-foreground">
                      {ticket.price ? formatCurrency(grossPrice(ticket.price)) : "Free"}
                    </span>
                    {ticket.price && parseFloat(ticket.price) > 0 && (
                      <>
                        <span>·</span>
                        <span className="text-xs">
                          Display: <span className="font-bold text-foreground">{formatCurrency(displayPrice(ticket.price))}</span>
                        </span>
                      </>
                    )}
                    <span>·</span>
                    <span>
                      {ticket.sold}/{ticket.quantity} sold
                    </span>
                    <span>·</span>
                    <span>
                      Limit {ticket.maxPerOrder}/order
                    </span>
                  </div>
                  {/* Progress bar */}
                  <div className="mt-2 h-1.5 w-full max-w-xs rounded-full bg-secondary overflow-hidden">
                    <div
                      className="h-full rounded-full bg-[hsl(var(--brand-pink))] transition-all"
                      style={{ width: `${ticket.quantity > 0 ? (ticket.sold / ticket.quantity) * 100 : 0}%` }}
                    />
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="ghost" size="icon" className="rounded-full h-9 w-9">
                        <MoreHorizontal className="w-4 h-4" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-56 p-2 rounded-2xl" align="end">
                      <div className="space-y-1">
                        <button
                          onClick={() => {
                            setEditForm({ name: ticket.name, price: ticket.price, quantity: String(ticket.quantity), maxPerOrder: String(ticket.maxPerOrder) });
                            setEditingTicket(ticket);
                          }}
                          className="flex items-center gap-3 w-full px-3 py-2.5 text-sm font-medium rounded-xl hover:bg-secondary transition-colors text-left"
                        >
                          <Edit2 className="w-4 h-4 text-muted-foreground" />
                          Edit Ticket
                        </button>
                        <button
                          onClick={() => updateTicket(ticket.id, { soldOut: !ticket.soldOut })}
                          className="flex items-center gap-3 w-full px-3 py-2.5 text-sm font-medium rounded-xl hover:bg-secondary transition-colors text-left"
                        >
                          <Ban className="w-4 h-4 text-muted-foreground" />
                          {ticket.soldOut ? "Remove Sold Out" : "Mark as Sold Out"}
                        </button>
                        <button
                          onClick={() => updateTicket(ticket.id, { hidden: !ticket.hidden })}
                          className="flex items-center gap-3 w-full px-3 py-2.5 text-sm font-medium rounded-xl hover:bg-secondary transition-colors text-left"
                        >
                          {ticket.hidden ? <Eye className="w-4 h-4 text-muted-foreground" /> : <EyeOff className="w-4 h-4 text-muted-foreground" />}
                          {ticket.hidden ? "Show Ticket" : "Hide Ticket"}
                        </button>
                        <button
                          onClick={() => updateTicket(ticket.id, { approvalRequired: !ticket.approvalRequired })}
                          className="flex items-center gap-3 w-full px-3 py-2.5 text-sm font-medium rounded-xl hover:bg-secondary transition-colors text-left"
                        >
                          <ShieldCheck className="w-4 h-4 text-muted-foreground" />
                          {ticket.approvalRequired ? "Remove Approval Req." : "Require Approval"}
                        </button>
                        <button
                          onClick={() => {
                            if (ticket.availableSoon) {
                              updateTicket(ticket.id, { availableSoon: false, availableDate: null });
                            } else {
                              setDatePickerOpen(ticket.id);
                            }
                          }}
                          className="flex items-center gap-3 w-full px-3 py-2.5 text-sm font-medium rounded-xl hover:bg-secondary transition-colors text-left"
                        >
                          <Clock className="w-4 h-4 text-muted-foreground" />
                          {ticket.availableSoon ? "Remove Available Soon" : "Make Available Soon"}
                        </button>
                        <div className="h-px bg-border my-1" />
                        <button
                          onClick={() => deleteTicket(ticket.id)}
                          className="flex items-center gap-3 w-full px-3 py-2.5 text-sm font-medium rounded-xl hover:bg-destructive/10 transition-colors text-left text-destructive"
                        >
                          <Trash2 className="w-4 h-4" />
                          Delete Ticket
                        </button>
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>}

      {/* ──────────── TICKET REQUESTS ──────────── */}
      {showTicketManagement && ticketRequests.length > 0 && (
        <div className="bg-card rounded-3xl border border-border overflow-hidden">
          <div className="px-6 py-5 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-3">
              <UserCheck className="w-5 h-5 text-primary" />
              <h2 className="text-lg font-black tracking-tight">Ticket Requests</h2>
              {pendingRequests.length > 0 && (
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-primary/10 text-primary">
                  {pendingRequests.length} pending
                </span>
              )}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="text-left px-6 py-3 font-bold text-[10px] uppercase tracking-[0.15em]">User</th>
                  <th className="text-left px-6 py-3 font-bold text-[10px] uppercase tracking-[0.15em]">Ticket</th>
                  <th className="text-left px-6 py-3 font-bold text-[10px] uppercase tracking-[0.15em]">Qty</th>
                  <th className="text-left px-6 py-3 font-bold text-[10px] uppercase tracking-[0.15em]">Message</th>
                  <th className="text-left px-6 py-3 font-bold text-[10px] uppercase tracking-[0.15em]">Status</th>
                  <th className="text-left px-6 py-3 font-bold text-[10px] uppercase tracking-[0.15em]">Date</th>
                  <th className="text-left px-6 py-3 font-bold text-[10px] uppercase tracking-[0.15em]"></th>
                </tr>
              </thead>
              <tbody>
                {ticketRequests.map((req) => {
                  const ticketName = tickets.find((t) => t.id === req.ticketTypeId)?.name || "—";
                  return (
                    <tr key={req.id} className="border-b border-border last:border-0 hover:bg-secondary/50 transition-colors">
                      <td className="px-6 py-4">
                        <div>
                          <p className="font-bold text-foreground">{req.userName}</p>
                          <p className="text-xs text-muted-foreground">{req.userEmail}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-primary/10 text-primary">
                          {ticketName}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-bold tabular-nums">{req.quantity}</td>
                      <td className="px-6 py-4 text-muted-foreground max-w-[200px] truncate">
                        {req.message || <span className="text-muted-foreground/50 italic">No message</span>}
                      </td>
                      <td className="px-6 py-4">
                        {req.status === "pending" && (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-amber-500/10 text-amber-500 uppercase tracking-widest">Pending</span>
                        )}
                        {req.status === "approved" && (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-[hsl(var(--brand-lime))]/10 text-[hsl(var(--brand-lime))] uppercase tracking-widest">Approved</span>
                        )}
                        {req.status === "rejected" && (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-destructive/10 text-destructive uppercase tracking-widest">Rejected</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-muted-foreground text-xs">
                        {format(new Date(req.createdAt), "MMM d, yyyy")}
                      </td>
                      <td className="px-6 py-4">
                        {req.status === "pending" && (
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="rounded-full h-8 px-3 text-xs font-bold bg-[hsl(var(--brand-lime))]/10 text-[hsl(var(--brand-lime))] hover:bg-[hsl(var(--brand-lime))]/20"
                              onClick={() => handleRequestAction(req.id, "approved")}
                            >
                              Approve
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="rounded-full h-8 px-3 text-xs font-bold text-destructive hover:bg-destructive/10"
                              onClick={() => handleRequestAction(req.id, "rejected")}
                            >
                              Reject
                            </Button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ──────────── COMPLIMENTARY TICKETS ──────────── */}
      {showCompTickets && event.eventType !== "seated" && <div className="bg-card rounded-3xl border border-border overflow-hidden">
        <div className="px-6 py-5 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Gift className="w-5 h-5 text-[hsl(var(--brand-lime))]" />
            <h2 className="text-lg font-black tracking-tight">Complimentary Tickets</h2>
          </div>
          <Button
            onClick={() => setShowCompModal(true)}
            size="sm"
            variant="outline"
            className="rounded-full font-bold gap-2"
          >
            <Send className="w-4 h-4" /> Send Comp
          </Button>
        </div>

        {compTickets.length === 0 ? (
          <div className="p-12 text-center">
            <Gift className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-40" />
            <p className="text-sm text-muted-foreground font-medium">No complimentary tickets sent yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="text-left px-6 py-3 font-bold text-[10px] uppercase tracking-[0.15em]">Email</th>
                  <th className="text-left px-6 py-3 font-bold text-[10px] uppercase tracking-[0.15em]">Ticket Type</th>
                  <th className="text-left px-6 py-3 font-bold text-[10px] uppercase tracking-[0.15em]">Sent</th>
                </tr>
              </thead>
              <tbody>
                {compTickets.map((c) => (
                  <tr key={c.id} className="border-b border-border last:border-0 hover:bg-secondary/50 transition-colors">
                    <td className="px-6 py-4 font-medium">{c.email}</td>
                    <td className="px-6 py-4">
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-[hsl(var(--brand-lime))]/10 text-[hsl(var(--brand-lime))]">
                        {c.ticketType}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-muted-foreground">
                      {format(new Date(c.sentAt), "MMM d, yyyy")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>}

      {/* ──────────── PROMO CODES ──────────── */}
      {showTicketManagement && <div className="bg-card rounded-3xl border border-border overflow-hidden">
        <div className="px-6 py-5 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Tag className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-black tracking-tight">Promo Codes</h2>
          </div>
          <Button
            onClick={() => setShowPromoModal(true)}
            size="sm"
            variant="outline"
            className="rounded-full font-bold gap-2"
          >
            <Plus className="w-4 h-4" /> Add Code
          </Button>
        </div>

        {promoCodes.length === 0 ? (
          <div className="p-12 text-center">
            <Tag className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-40" />
            <p className="text-sm text-muted-foreground font-medium">No promo codes created yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="text-left px-6 py-3 font-bold text-[10px] uppercase tracking-[0.15em]">Code</th>
                  <th className="text-left px-6 py-3 font-bold text-[10px] uppercase tracking-[0.15em]">Ticket</th>
                  <th className="text-left px-6 py-3 font-bold text-[10px] uppercase tracking-[0.15em]">Discount</th>
                  <th className="text-left px-6 py-3 font-bold text-[10px] uppercase tracking-[0.15em]">Usage</th>
                  <th className="text-left px-6 py-3 font-bold text-[10px] uppercase tracking-[0.15em]"></th>
                </tr>
              </thead>
              <tbody>
                {promoCodes.map((p) => (
                  <tr key={p.id} className="border-b border-border last:border-0 hover:bg-secondary/50 transition-colors">
                    <td className="px-6 py-4">
                      <span className="font-mono font-bold text-foreground bg-secondary px-2.5 py-1 rounded-lg text-xs">
                        {p.code}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-medium">
                      {p.ticketType === "all"
                        ? "All Tickets"
                        : tickets.find((t) => t.id === p.ticketType)?.name || p.ticketType}
                    </td>
                    <td className="px-6 py-4 font-bold text-foreground">
                      {p.discountType === "percentage" ? `${p.discountValue}%` : `$${p.discountValue}`}
                    </td>
                    <td className="px-6 py-4 text-muted-foreground">
                      {p.used}/{p.maxUses}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="rounded-full h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-secondary"
                          onClick={() => openEditPromo(p)}
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="rounded-full h-8 w-8 text-destructive hover:bg-destructive/10"
                          onClick={() => deletePromo(p.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>}

      {/* ──────────── SCANNER PINS ──────────── */}
      {showTicketManagement && <div className="bg-card rounded-3xl border border-border overflow-hidden">
        <div className="px-6 py-5 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ScanLine className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-black tracking-tight">Scanner PINs</h2>
          </div>
          {scannerPins.length < 5 && (
            <Button
              onClick={generateScannerPins}
              size="sm"
              disabled={generatingPins}
              variant="outline"
              className="rounded-full font-bold gap-2"
            >
              {generatingPins ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Generate PIN
            </Button>
          )}
        </div>

        {scannerPins.length === 0 ? (
          <div className="p-12 text-center">
            <ScanLine className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-40" />
            <p className="text-sm text-muted-foreground font-medium">No scanner PINs generated yet.</p>
            <p className="text-xs text-muted-foreground mt-1">Generate PINs so team members can scan tickets on the app.</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {scannerPins.map((pin) => (
              <div key={pin.id} className="px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <span className="font-mono font-black text-lg tracking-[0.3em] text-foreground bg-secondary px-4 py-2 rounded-xl">
                    {pin.pin}
                  </span>
                  <span className="text-sm text-muted-foreground font-medium">{pin.label}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="rounded-full h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-secondary"
                    onClick={() => copyPin(pin.pin)}
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="rounded-full h-8 w-8 text-destructive hover:bg-destructive/10"
                    onClick={() => deleteScannerPin(pin.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>}

      <Dialog open={showAddTicket} onOpenChange={setShowAddTicket}>
        <DialogContent className="sm:max-w-md rounded-3xl">
          <DialogHeader>
            <DialogTitle className="font-black text-xl">Add Ticket Type</DialogTitle>
            <DialogDescription>Create a new ticket tier for your event.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label className="font-bold text-xs uppercase tracking-wider">Ticket Name</Label>
              <Input
                placeholder="e.g. General Admission, VIP"
                value={newTicket.name}
                onChange={(e) => setNewTicket((p) => ({ ...p, name: e.target.value }))}
                className="rounded-xl"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label className="font-bold text-xs uppercase tracking-wider">Price ($)</Label>
                <Input
                  placeholder="0.00"
                  type="number"
                  min="0"
                  step="0.01"
                  value={newTicket.price}
                  onChange={(e) => setNewTicket((p) => ({ ...p, price: e.target.value }))}
                  className="rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <Label className="font-bold text-xs uppercase tracking-wider">Limit Per Order</Label>
                <Input
                  placeholder="10"
                  type="number"
                  min="1"
                  value={newTicket.maxPerOrder}
                  onChange={(e) => setNewTicket((p) => ({ ...p, maxPerOrder: e.target.value }))}
                  className="rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <Label className="font-bold text-xs uppercase tracking-wider">Quantity</Label>
                <Input
                  placeholder="100"
                  type="number"
                  min="1"
                  value={newTicket.quantity}
                  onChange={(e) => setNewTicket((p) => ({ ...p, quantity: e.target.value }))}
                  className="rounded-xl"
                />
              </div>
            </div>

            {/* Pricing breakdown */}
            {newTicket.price && parseFloat(newTicket.price) > 0 && (
              <div className="rounded-2xl bg-secondary p-4 space-y-3">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Pricing Breakdown</p>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground font-medium">Gross Ticket Price</span>
                  <span className="font-black text-foreground tabular-nums">{formatCurrency(grossPrice(newTicket.price))}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground font-medium">Service Fee</span>
                  <span className="font-medium text-muted-foreground tabular-nums">{formatCurrency(serviceFeePreview(newTicket.price))}</span>
                </div>
                <div className="h-px bg-border" />
                <div className="flex justify-between text-sm">
                  <span className="font-bold text-foreground">Display Price <span className="text-muted-foreground font-normal text-xs">(customer pays)</span></span>
                  <span className="font-black text-[hsl(var(--brand-pink))] tabular-nums">{formatCurrency(displayPrice(newTicket.price))}</span>
                </div>
              </div>
            )}

            {/* Approval Required Toggle */}
            <div className="flex items-center justify-between rounded-2xl bg-secondary p-4">
              <div>
                <p className="font-bold text-sm text-foreground">Require Approval</p>
                <p className="text-xs text-muted-foreground">Users must request access. You approve before they can purchase.</p>
              </div>
              <Switch
                checked={newTicket.approvalRequired}
                onCheckedChange={(v) => setNewTicket((p) => ({ ...p, approvalRequired: v }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowAddTicket(false)} className="rounded-full">
              Cancel
            </Button>
            <Button
              onClick={addTicket}
              disabled={!newTicket.name.trim()}
              className="rounded-full bg-[hsl(var(--brand-pink))] hover:bg-[hsl(var(--brand-pink))]/90 text-white font-bold"
            >
              Add Ticket
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ──────────── EDIT TICKET MODAL ──────────── */}
      <Dialog open={!!editingTicket} onOpenChange={(o) => !o && setEditingTicket(null)}>
        <DialogContent className="sm:max-w-md rounded-3xl">
          <DialogHeader>
            <DialogTitle className="font-black text-xl">Edit Ticket</DialogTitle>
            <DialogDescription>Update ticket details and pricing.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label className="font-bold text-xs uppercase tracking-wider">Ticket Name</Label>
              <Input
                value={editForm.name}
                onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))}
                className="rounded-xl"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label className="font-bold text-xs uppercase tracking-wider">Price ($)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={editForm.price}
                  onChange={(e) => setEditForm((p) => ({ ...p, price: e.target.value }))}
                  className="rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <Label className="font-bold text-xs uppercase tracking-wider">Limit Per Order</Label>
                <Input
                  type="number"
                  min="1"
                  value={editForm.maxPerOrder}
                  onChange={(e) => setEditForm((p) => ({ ...p, maxPerOrder: e.target.value }))}
                  className="rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <Label className="font-bold text-xs uppercase tracking-wider">Quantity</Label>
                <Input
                  type="number"
                  min="1"
                  value={editForm.quantity}
                  onChange={(e) => setEditForm((p) => ({ ...p, quantity: e.target.value }))}
                  className="rounded-xl"
                />
              </div>
            </div>

            {/* Pricing breakdown */}
            <div className="rounded-2xl bg-secondary p-4 space-y-3">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Pricing Breakdown</p>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground font-medium">Gross Ticket Price</span>
                <span className="font-black text-foreground tabular-nums">
                  {formatCurrency(grossPrice(editForm.price))}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground font-medium">Service Fee</span>
                <span className="font-medium text-muted-foreground tabular-nums">
                  {formatCurrency(serviceFeePreview(editForm.price))}
                </span>
              </div>
              <div className="h-px bg-border" />
              <div className="flex justify-between text-sm">
                <span className="font-bold text-foreground">Display Price <span className="text-muted-foreground font-normal text-xs">(customer pays)</span></span>
                <span className="font-black text-[hsl(var(--brand-pink))] tabular-nums">
                  {formatCurrency(displayPrice(editForm.price))}
                </span>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditingTicket(null)} className="rounded-full">
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (editingTicket) {
                  updateTicket(editingTicket.id, {
                    name: editForm.name,
                    price: editForm.price,
                    maxPerOrder: parseInt(editForm.maxPerOrder) || editingTicket.maxPerOrder,
                    quantity: parseInt(editForm.quantity) || editingTicket.quantity,
                  });
                  setEditingTicket(null);
                }
              }}
              disabled={!editForm.name.trim()}
              className="rounded-full bg-[hsl(var(--brand-pink))] hover:bg-[hsl(var(--brand-pink))]/90 text-white font-bold"
            >
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!datePickerOpen} onOpenChange={(o) => !o && setDatePickerOpen(null)}>
        <DialogContent className="sm:max-w-sm rounded-3xl">
          <DialogHeader>
            <DialogTitle className="font-black text-xl">Choose Available Date & Time</DialogTitle>
            <DialogDescription>Select when this ticket becomes available for purchase.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 py-2">
            <Calendar
              mode="single"
              selected={
                datePickerOpen
                  ? tickets.find((t) => t.id === datePickerOpen)?.availableDate
                    ? new Date(tickets.find((t) => t.id === datePickerOpen)!.availableDate!)
                    : undefined
                  : undefined
              }
              onSelect={(date) => {
                if (datePickerOpen && date) {
                  // Preserve existing time if set
                  const existing = tickets.find((t) => t.id === datePickerOpen)?.availableDate;
                  if (existing) {
                    const prev = new Date(existing);
                    date.setHours(prev.getHours(), prev.getMinutes());
                  }
                  updateTicket(datePickerOpen, {
                    availableSoon: true,
                    availableDate: date.toISOString(),
                  });
                }
              }}
              disabled={(date) => date < new Date(new Date().toDateString())}
              className={cn("p-3 pointer-events-auto")}
            />
            <div className="flex items-center gap-3 w-full max-w-xs">
              <Label className="text-sm font-bold whitespace-nowrap">Time:</Label>
              <Select
                value={
                  datePickerOpen && tickets.find((t) => t.id === datePickerOpen)?.availableDate
                    ? (() => {
                        const d = new Date(tickets.find((t) => t.id === datePickerOpen)!.availableDate!);
                        return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
                      })()
                    : "00:00"
                }
                onValueChange={(time) => {
                  if (!datePickerOpen) return;
                  const ticket = tickets.find((t) => t.id === datePickerOpen);
                  const base = ticket?.availableDate ? new Date(ticket.availableDate) : new Date();
                  const [h, m] = time.split(":").map(Number);
                  base.setHours(h, m, 0, 0);
                  updateTicket(datePickerOpen, {
                    availableSoon: true,
                    availableDate: base.toISOString(),
                  });
                }}
              >
                <SelectTrigger className="rounded-xl flex-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  {Array.from({ length: 48 }, (_, i) => {
                    const h = Math.floor(i / 2);
                    const m = (i % 2) * 30;
                    const val = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
                    const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
                    const ampm = h < 12 ? "AM" : "PM";
                    const label = `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
                    return (
                      <SelectItem key={val} value={val}>{label}</SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
            <Button
              className="rounded-full font-bold w-full max-w-xs"
              onClick={() => setDatePickerOpen(null)}
              disabled={!datePickerOpen || !tickets.find((t) => t.id === datePickerOpen)?.availableDate}
            >
              Confirm
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ──────────── SEND COMP MODAL ──────────── */}
      <Dialog open={showCompModal} onOpenChange={setShowCompModal}>
        <DialogContent className="sm:max-w-md rounded-3xl">
          <DialogHeader>
            <DialogTitle className="font-black text-xl">Send Complimentary Ticket</DialogTitle>
            <DialogDescription>Send a free ticket to a guest by email.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label className="font-bold text-xs uppercase tracking-wider">Ticket Type</Label>
              <Select value={compForm.ticketType} onValueChange={(v) => setCompForm((p) => ({ ...p, ticketType: v }))}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Select ticket type" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  {tickets.map((t) => (
                    <SelectItem key={t.id} value={t.name}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="font-bold text-xs uppercase tracking-wider">Recipient Email</Label>
              <Input
                placeholder="guest@email.com"
                type="email"
                value={compForm.email}
                onChange={(e) => setCompForm((p) => ({ ...p, email: e.target.value }))}
                className="rounded-xl"
              />
              <p className="text-[10px] text-muted-foreground">
                User name will auto-populate from the database when available.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowCompModal(false)} className="rounded-full">
              Cancel
            </Button>
            <Button
              onClick={sendCompTicket}
              disabled={!compForm.email.trim() || !compForm.ticketType}
              className="rounded-full bg-[hsl(var(--brand-lime))] hover:bg-[hsl(var(--brand-lime))]/90 text-background font-bold gap-2"
            >
              <Send className="w-4 h-4" /> Send Ticket
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ──────────── ADD PROMO CODE MODAL ──────────── */}
      <Dialog open={showPromoModal} onOpenChange={setShowPromoModal}>
        <DialogContent className="sm:max-w-md rounded-3xl">
          <DialogHeader>
            <DialogTitle className="font-black text-xl">Create Promo Code</DialogTitle>
            <DialogDescription>Add a discount code for your event tickets.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label className="font-bold text-xs uppercase tracking-wider">Promo Code</Label>
              <Input
                placeholder="e.g. EARLYBIRD"
                value={promoForm.code}
                onChange={(e) => setPromoForm((p) => ({ ...p, code: e.target.value }))}
                className="rounded-xl font-mono uppercase"
              />
            </div>
            {event.eventType !== "seated" && (
            <div className="space-y-2">
              <Label className="font-bold text-xs uppercase tracking-wider">Apply To</Label>
              <Select value={promoForm.ticketType} onValueChange={(v) => setPromoForm((p) => ({ ...p, ticketType: v }))}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Select ticket type" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="all">All Tickets</SelectItem>
                  {tickets.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="font-bold text-xs uppercase tracking-wider">Discount Type</Label>
                <Select
                  value={promoForm.discountType}
                  onValueChange={(v: "percentage" | "fixed") => setPromoForm((p) => ({ ...p, discountType: v }))}
                >
                  <SelectTrigger className="rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="percentage">Percentage (%)</SelectItem>
                    <SelectItem value="fixed">Fixed ($)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="font-bold text-xs uppercase tracking-wider">Value</Label>
                <Input
                  placeholder={promoForm.discountType === "percentage" ? "10" : "5.00"}
                  type="number"
                  min="0"
                  value={promoForm.discountValue}
                  onChange={(e) => setPromoForm((p) => ({ ...p, discountValue: e.target.value }))}
                  className="rounded-xl"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="font-bold text-xs uppercase tracking-wider">Max Uses</Label>
              <Input
                placeholder="50"
                type="number"
                min="1"
                value={promoForm.maxUses}
                onChange={(e) => setPromoForm((p) => ({ ...p, maxUses: e.target.value }))}
                className="rounded-xl"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowPromoModal(false)} className="rounded-full">
              Cancel
            </Button>
            <Button
              onClick={addPromoCode}
              disabled={!promoForm.code.trim() || !promoForm.discountValue}
              className="rounded-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold"
            >
              Create Code
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* ──────────── EDIT PROMO CODE MODAL ──────────── */}
      <Dialog open={!!editingPromo} onOpenChange={(o) => !o && setEditingPromo(null)}>
        <DialogContent className="sm:max-w-md rounded-3xl">
          <DialogHeader>
            <DialogTitle className="font-black text-xl">Edit Promo Code</DialogTitle>
            <DialogDescription>Update the promo code details.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label className="font-bold text-xs uppercase tracking-wider">Promo Code</Label>
              <Input
                value={editPromoForm.code}
                onChange={(e) => setEditPromoForm((p) => ({ ...p, code: e.target.value }))}
                className="rounded-xl font-mono uppercase"
              />
            </div>
            <div className="space-y-2">
              <Label className="font-bold text-xs uppercase tracking-wider">Apply To</Label>
              <Select value={editPromoForm.ticketType} onValueChange={(v) => setEditPromoForm((p) => ({ ...p, ticketType: v }))}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Select ticket type" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="all">All Tickets</SelectItem>
                  {tickets.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="font-bold text-xs uppercase tracking-wider">Discount Type</Label>
                <Select
                  value={editPromoForm.discountType}
                  onValueChange={(v: "percentage" | "fixed") => setEditPromoForm((p) => ({ ...p, discountType: v }))}
                >
                  <SelectTrigger className="rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="percentage">Percentage (%)</SelectItem>
                    <SelectItem value="fixed">Fixed ($)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="font-bold text-xs uppercase tracking-wider">Value</Label>
                <Input
                  placeholder={editPromoForm.discountType === "percentage" ? "10" : "5.00"}
                  type="number"
                  min="0"
                  value={editPromoForm.discountValue}
                  onChange={(e) => setEditPromoForm((p) => ({ ...p, discountValue: e.target.value }))}
                  className="rounded-xl"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="font-bold text-xs uppercase tracking-wider">Max Uses</Label>
              <Input
                type="number"
                min="1"
                value={editPromoForm.maxUses}
                onChange={(e) => setEditPromoForm((p) => ({ ...p, maxUses: e.target.value }))}
                className="rounded-xl"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditingPromo(null)} className="rounded-full">
              Cancel
            </Button>
            <Button
              onClick={updatePromo}
              disabled={!editPromoForm.code.trim() || !editPromoForm.discountValue}
              className="rounded-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold"
            >
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default EventTicketsTab;
