import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate, useParams, Link } from "react-router-dom";
import { useOrganizations } from "@/contexts/OrganizationContext";
import { getEventsByOrg, type StoredEvent } from "@/stores/eventStore";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, isBefore, startOfDay } from "date-fns";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  LayoutDashboard, CalendarDays, Users, BarChart3, Wallet, Settings,
  PlusCircle, Search, Bell, Sun, Moon, ArrowLeft, ExternalLink, Pencil,
  TrendingUp, Ticket, Activity, Megaphone, UserCircle, Building2, LogOut,
  Mail, Phone, X, Calendar, Instagram, CalendarCheck, DollarSign, ChevronRight,
  RotateCcw, Send, Ban, ShieldCheck, MousePointerClick, PercentCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import OrganizationSelectorModal from "@/components/OrganizationSelectorModal";
import CreateOrganizationModal from "@/components/CreateOrganizationModal";
import OrgEventsTab from "@/components/OrgEventsTab";
import EventMarketingTab from "@/components/EventMarketingTab";
import OrgAnalyticsTab from "@/components/OrgAnalyticsTab";
import OrgPayoutsTab from "@/components/OrgPayoutsTab";
import OrgTeamTab from "@/components/OrgTeamTab";
import AnimatedNumber from "@/components/AnimatedNumber";
import { resolveOrderPricing } from "@/lib/orderPricing";
import { applyRefundToOrder, applyRefundToOrders, getNetOrderRevenue, isOrderRefunded, refundOrder } from "@/lib/refunds";

type SidebarTab = "Overview" | "Events" | "Orders" | "Marketing" | "Analytics" | "Team" | "Payouts" | "Settings";

const sidebarItems: { id: SidebarTab; icon: React.ReactNode }[] = [
  { id: "Overview", icon: <LayoutDashboard className="w-5 h-5" /> },
  { id: "Events", icon: <CalendarDays className="w-5 h-5" /> },
  { id: "Orders", icon: <Ticket className="w-5 h-5" /> },
  { id: "Marketing", icon: <Megaphone className="w-5 h-5" /> },
  
  { id: "Analytics", icon: <BarChart3 className="w-5 h-5" /> },
  { id: "Team", icon: <Users className="w-5 h-5" /> },
  { id: "Payouts", icon: <Wallet className="w-5 h-5" /> },
  { id: "Settings", icon: <Settings className="w-5 h-5" /> },
];



const statusStyles: Record<string, string> = {
  Live: "bg-[hsl(var(--brand-lime))]/10 text-[hsl(var(--brand-lime))] border-[hsl(var(--brand-lime))]/20",
  "Sold Out": "bg-[hsl(var(--brand-pink))]/10 text-[hsl(var(--brand-pink))] border-[hsl(var(--brand-pink))]/20",
  Draft: "bg-muted text-muted-foreground border-border",
};

const OrganizerDashboard = () => {
  const { user, logout, session } = useAuth();
  const navigate = useNavigate();
  const [orgSelectorOpen, setOrgSelectorOpen] = useState(false);
  const [editOrgOpen, setEditOrgOpen] = useState(false);
  const { orgSlug } = useParams<{ orgSlug: string }>();
  const { getOrgBySlug, isPromoterForOrg } = useOrganizations();
  const org = getOrgBySlug(orgSlug || "");
  const isPromoter = org ? isPromoterForOrg(org.id) : false;
  const [isAdmin, setIsAdmin] = useState(false);
  const [memberRole, setMemberRole] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<SidebarTab>("Overview");
  const [chartPeriod, setChartPeriod] = useState<"Week" | "Month" | "Year">("Week");
  const [chartKey, setChartKey] = useState(0);
  const [dbEvents, setDbEvents] = useState<StoredEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [eventRevenue, setEventRevenue] = useState<Record<string, number>>({});
  const [selectedCustomer, setSelectedCustomer] = useState<{
    userId: string; name: string; email: string; phone: string; instagram: string; avatarUrl: string;
    eventsAttended: number; totalSpent: string;
    orders: {
      id: string;
      orderId: string;
      event: string;
      ticket: string;
      qty: number;
      total: string;
      totalAmount: number;
      unitPrice: number;
      serviceFee: number;
      discount?: number;
      promoCode?: string | null;
      date: string;
      refundedAmount?: number;
      refundedAt?: string | null;
      status?: string;
    }[];
  } | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<{
    id: string;
    orderId: string;
    event: string;
    ticket: string;
    qty: number;
    total: string;
    totalAmount: number;
    unitPrice: number;
    serviceFee: number;
    discount: number;
    promoCode: string | null;
    date: string;
    customerName: string;
    refunded?: boolean;
    refundedAmount?: number;
    refundedAt?: string | null;
    status?: string;
  } | null>(null);
  const [showPartialRefund, setShowPartialRefund] = useState(false);
  const [partialRefundAmount, setPartialRefundAmount] = useState("");
  const [dbOrders, setDbOrders] = useState<any[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [ordersTabSearch, setOrdersTabSearch] = useState("");
  const [ordersStatusFilter, setOrdersStatusFilter] = useState<"all" | "refunded" | "disputed" | "scanned">("all");

  const syncRefundState = (orderId: string, refundAmount: number, refundedAt: string) => {
    setDbOrders((prev) => applyRefundToOrders(prev, orderId, refundAmount, refundedAt));
    setSelectedOrder((prev) => (prev?.id === orderId ? applyRefundToOrder(prev, refundAmount, refundedAt) ?? prev : prev));
    setSelectedCustomer((prev) => {
      if (!prev) return prev;
      const updatedOrders = applyRefundToOrders(prev.orders, orderId, refundAmount, refundedAt);
      const totalSpent = updatedOrders.reduce(
        (sum, order) => sum + Math.max(0, Number(order.totalAmount || 0) - Number(order.refundedAmount || 0)),
        0
      );

      return {
        ...prev,
        orders: updatedOrders,
        totalSpent: `$${totalSpent.toFixed(2)}`,
      };
    });
  };

  useEffect(() => {
    if (!session?.user) { setIsAdmin(false); setMemberRole(null); return; }
    supabase.rpc("has_role", { _user_id: session.user.id, _role: "admin" as const })
      .then(({ data }) => setIsAdmin(!!data));
    if (org?.id) {
      supabase
        .from("organization_members")
        .select("role")
        .eq("user_id", session.user.id)
        .eq("organization_id", org.id)
        .single()
        .then(({ data }) => setMemberRole(data?.role || null));
    }
  }, [session, org?.id]);

  useEffect(() => {
    if (orgSlug) {
      setEventsLoading(true);
      setOrdersLoading(true);
      getEventsByOrg(orgSlug).then(async (events) => {
        setDbEvents(events);
        const eventIds = events.map((e) => e.id);
        if (eventIds.length > 0) {
          const [_, ordersRes] = await Promise.all([
            supabase.from("ticket_types").select("event_id, sold, price").in("event_id", eventIds),
            supabase.from("orders").select("*").in("event_id", eventIds).order("created_at", { ascending: false }),
          ]);
          // Build revenue map from actual orders (accounts for promo discounts)
          const orders = ordersRes.data || [];
          const revenueMap: Record<string, number> = {};
          orders.forEach((o) => {
            const revenue = getNetOrderRevenue(o);
            revenueMap[o.event_id] = (revenueMap[o.event_id] || 0) + revenue;
          });
          setEventRevenue(revenueMap);
          
          // Fetch profiles for order users
          const userIds = [...new Set(orders.map((o) => o.user_id))];
          if (userIds.length > 0) {
            const { data: profiles } = await supabase.from("profiles").select("user_id, name, email, phone, avatar_url").in("user_id", userIds);
            const profileMap = new Map((profiles || []).map((p) => [p.user_id, p]));
            const enriched = orders.map((o) => ({ ...o, profiles: profileMap.get(o.user_id) || null }));
            setDbOrders(enriched);
          } else {
            setDbOrders(orders);
          }
        }
        setEventsLoading(false);
        setOrdersLoading(false);
      });
    }
  }, [orgSlug]);

  // Realtime: listen for order updates (e.g. ticket scans from mobile app)
  useEffect(() => {
    if (!orgSlug || dbEvents.length === 0) return;
    const eventIds = dbEvents.map((e) => e.id);
    const channels = eventIds.map((eid) =>
      supabase
        .channel(`orders-org-${eid}`)
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'orders', filter: `event_id=eq.${eid}` },
          (payload) => {
            const updated = payload.new as any;
            setDbOrders((prev) =>
              prev.map((o) =>
                o.id === updated.id
                  ? { ...o, checked_in: updated.checked_in, checked_in_at: updated.checked_in_at, status: updated.status, refunded_amount: updated.refunded_amount, refunded_at: updated.refunded_at }
                  : o
              )
            );
          }
        )
        .subscribe()
    );
    return () => { channels.forEach((ch) => supabase.removeChannel(ch)); };
  }, [dbEvents]);

  const getOrderOrganizerRevenue = (order: { unit_price: number | string | null; quantity: number | null; discount?: number | string | null; refunded_amount?: number | string | null; refundedAmount?: number | string | null }) => getNetOrderRevenue(order);

  // Computed metrics from real orders
  const totalRevenue = useMemo(() => {
    return dbOrders.reduce((sum, o) => sum + getOrderOrganizerRevenue(o), 0);
  }, [dbOrders]);

  const totalTicketsSold = useMemo(() => {
    return dbOrders.reduce((sum, o) => sum + (o.quantity || 1), 0);
  }, [dbOrders]);

  const totalAttendees = useMemo(() => {
    const unique = new Set(dbOrders.map((o) => o.user_id));
    return unique.size;
  }, [dbOrders]);

  const lastMonthRevenue = useMemo(() => {
    const now = new Date();
    const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return dbOrders
      .filter((o) => { const d = new Date(o.created_at); return d >= startOfLastMonth && d < startOfThisMonth; })
      .reduce((sum, o) => sum + getOrderOrganizerRevenue(o), 0);
  }, [dbOrders]);

  const thisMonthRevenue = useMemo(() => {
    const now = new Date();
    const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    return dbOrders
      .filter((o) => new Date(o.created_at) >= startOfThisMonth)
      .reduce((sum, o) => sum + getOrderOrganizerRevenue(o), 0);
  }, [dbOrders]);

  const growthPct = lastMonthRevenue === 0 ? (thisMonthRevenue > 0 ? 100 : 0) : Math.round(((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100);

  const totalCapacity = useMemo(() => {
    return Object.values(eventRevenue).length > 0 ? totalTicketsSold : 0;
  }, [totalTicketsSold, eventRevenue]);

  const today = startOfDay(new Date());

  const monthMap: Record<string, number> = {
    Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
    Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11,
    JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, JUN: 5,
    JUL: 6, AUG: 7, SEP: 8, OCT: 9, NOV: 10, DEC: 11,
  };

  const parseDate = (ev: StoredEvent): Date | null => {
    const m = monthMap[ev.month];
    if (m === undefined || !ev.date || !ev.year) return null;
    return new Date(Number(ev.year), m, Number(ev.date));
  };

  const upcomingEvents = useMemo(() => {
    return dbEvents
      .filter((ev) => {
        // Use end date if available, otherwise start date
        const endMonth = ev.endMonth ? monthMap[ev.endMonth] : undefined;
        const endD = endMonth !== undefined && ev.endDate && ev.endYear
          ? new Date(Number(ev.endYear), endMonth, Number(ev.endDate))
          : null;
        const startD = parseDate(ev);
        const effectiveEnd = endD || startD;
        return effectiveEnd && !isBefore(effectiveEnd, today);
      })
      .sort((a, b) => {
        const da = parseDate(a);
        const db = parseDate(b);
        return (da?.getTime() ?? 0) - (db?.getTime() ?? 0);
      });
  }, [dbEvents, today]);

  const handlePeriodChange = (p: "Week" | "Month" | "Year") => {
    setChartPeriod(p);
    setChartKey(k => k + 1);
  };
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains("dark"));

  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDark);
  }, [isDark]);

  // Promoter-specific data
  const [promoterLinks, setPromoterLinks] = useState<{slug: string; label: string; clicks: number; event_id: string}[]>([]);
  const [promoterOrders, setPromoterOrders] = useState<typeof dbOrders>([]);
  const [promoterEventIds, setPromoterEventIds] = useState<string[]>([]);

  useEffect(() => {
    if (!isPromoter || !session?.user || !org?.id) return;
    (async () => {
      const { data: invites } = await supabase
        .from("team_invitations")
        .select("event_id")
        .eq("accepted_by", session.user.id)
        .eq("organization_id", org.id)
        .eq("status", "accepted");
      const eventIds = (invites || []).map((i) => i.event_id);
      setPromoterEventIds(eventIds);
      if (eventIds.length === 0) return;

      // Fetch event details so the table can render them
      const { data: eventsData } = await supabase
        .from("events")
        .select("id, title, date, flyer_url")
        .in("id", eventIds);
      if (eventsData && eventsData.length > 0) {
        const mapped = eventsData.map((e: any) => {
          const d = e.date ? new Date(e.date + "T00:00:00") : null;
          return {
            id: e.id,
            title: e.title || "",
            flyer: e.flyer_url || "",
            month: d ? d.toLocaleString("en-US", { month: "short" }) : "",
            date: d ? String(d.getDate()) : "",
            year: d ? String(d.getFullYear()) : "",
            rawDate: e.date,
          };
        });
        setDbEvents((prev) => {
          const existingIds = new Set(prev.map((p) => p.id));
          const newOnes = mapped.filter((m: any) => !existingIds.has(m.id));
          return newOnes.length > 0 ? [...prev, ...newOnes as any] : prev;
        });
      }

      const { data: links } = await supabase
        .from("tracking_links")
        .select("slug, label, clicks, event_id")
        .eq("created_by", session.user.id)
        .in("event_id", eventIds);
      setPromoterLinks(links || []);

      const slugs = (links || []).map((l) => l.slug);
      if (slugs.length > 0) {
        const { data: orders } = await supabase
          .from("orders")
          .select("*")
          .in("event_id", eventIds)
          .in("ref_source", slugs)
          .eq("status", "completed");
        setPromoterOrders(orders || []);
      }
    })();
  }, [isPromoter, session?.user?.id, org?.id]);

  const promoterTotalClicks = useMemo(() => promoterLinks.reduce((s, l) => s + l.clicks, 0), [promoterLinks]);
  const promoterTotalSales = useMemo(() => promoterOrders.reduce((s, o) => s + (o.quantity || 1), 0), [promoterOrders]);
  const promoterTotalRevenue = useMemo(() => promoterOrders.reduce((s, o) => s + getNetOrderRevenue(o), 0), [promoterOrders]);
  const promoterConversion = promoterTotalClicks > 0 ? ((promoterTotalSales / promoterTotalClicks) * 100).toFixed(1) : "0.0";

  const isOwner = memberRole === "owner";

  const visibleSidebarItems = isPromoter
    ? sidebarItems.filter((item) => item.id === "Overview" || item.id === "Events")
    : sidebarItems.filter((item) => item.id !== "Payouts" || isOwner);

  useEffect(() => {
    if (isPromoter && activeTab !== "Overview" && activeTab !== "Events") {
      setActiveTab("Overview");
    }
  }, [isPromoter, activeTab]);

  if (!user) {
    navigate("/auth");
    return null;
  }

  if (!org) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-4xl mb-4">😢</p>
          <h1 className="text-2xl font-black text-foreground mb-2">Organization not found</h1>
          <p className="text-muted-foreground mb-6">This organization doesn't exist.</p>
          <Link to="/" className="bg-[hsl(var(--brand-pink))] text-primary-foreground px-8 py-3 rounded-full font-bold text-sm hover:scale-105 transition-all">
            Go Home
          </Link>
        </div>
      </div>
    );
  }

  const getInitials = (name: string) =>
    name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);

  return (
    <>
    <div className="flex min-h-screen bg-background text-foreground">
      {/* Sidebar */}
      <aside className="hidden lg:flex w-64 fixed left-0 top-0 h-screen border-r border-border bg-background z-50 flex-col p-6 gap-8">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full overflow-hidden border-2 border-[hsl(var(--brand-pink))]/30 bg-secondary flex-shrink-0">
              {org.avatarUrl ? (
                <img src={org.avatarUrl} alt={org.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-sm font-black text-muted-foreground">
                  {org.name[0]}
                </div>
              )}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-black text-foreground truncate">{org.name}</p>
              <span className="text-[10px] opacity-50 tracking-widest uppercase font-bold">{isPromoter ? "Promoter Hub" : "Organizer Hub"}</span>
            </div>
          </div>
        </div>

        <nav className="flex flex-col gap-1.5">
          {visibleSidebarItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex items-center gap-3 px-4 py-3 rounded-full transition-all duration-200 font-bold tracking-tight text-sm hover:scale-[1.02] active:scale-95 ${
                activeTab === item.id
                  ? "text-[hsl(var(--brand-pink))] bg-secondary"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              }`}
            >
              {item.icon}
              <span>{item.id}</span>
            </button>
          ))}
        </nav>

        {!isPromoter && (
          <div className="mt-auto">
            <button
              onClick={() => navigate(`/dashboard/${orgSlug}/create-event`)}
              className="w-full py-4 bg-[hsl(var(--brand-pink))] text-primary-foreground rounded-full font-black flex items-center justify-center gap-2 hover:scale-[1.02] transition-transform active:scale-95 shadow-xl shadow-[hsl(var(--brand-pink))]/20"
            >
              <PlusCircle className="w-5 h-5" />
              Create Event
            </button>
          </div>
        )}
      </aside>

      {/* Main Content */}
      <main className="lg:ml-64 flex-1 min-h-screen">
        {/* Top Nav */}
        <header className="sticky top-0 z-40 bg-background/60 backdrop-blur-xl flex justify-between items-center px-8 h-20 border-b border-border">
          <div className="flex items-center gap-4 flex-1">
            <Link to="/" className="lg:hidden text-muted-foreground hover:text-foreground transition-colors mr-2">
              <ArrowLeft className="w-5 h-5" />
            </Link>
          </div>
          <div className="flex items-center gap-6 font-medium">
            <div className="flex items-center gap-4 text-muted-foreground">
              <Bell className="w-5 h-5 cursor-pointer hover:text-[hsl(var(--brand-pink))] transition-colors" />
              <button
                onClick={() => setIsDark(!isDark)}
                className="text-muted-foreground cursor-pointer hover:text-[hsl(var(--brand-pink))] transition-colors"
                aria-label="Toggle dark mode"
              >
                {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </button>
            </div>
            <div className="h-8 w-px bg-border" />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-3 group outline-none">
                  <div className="text-right hidden sm:block">
                    <p className="text-sm font-bold">{user.name}</p>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{isPromoter ? "Promoter" : "Organizer"}</p>
                  </div>
                  <Avatar className="w-10 h-10 border-2 border-[hsl(var(--brand-pink))]/20 group-hover:border-[hsl(var(--brand-pink))] transition-colors cursor-pointer">
                    <AvatarImage src={user.avatarUrl} alt={user.name} />
                    <AvatarFallback className="bg-secondary text-foreground font-black text-sm">{getInitials(user.name)}</AvatarFallback>
                  </Avatar>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 rounded-xl border-border bg-surface shadow-xl">
                <div className="px-3 py-3">
                  <p className="text-sm font-bold text-on-background truncate">{user.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                </div>
                <DropdownMenuSeparator className="bg-border" />
                <DropdownMenuLabel className="text-[11px] uppercase tracking-widest text-muted-foreground font-bold px-3 py-1.5">
                  As Organizer
                </DropdownMenuLabel>
                <DropdownMenuItem onClick={() => setOrgSelectorOpen(true)} className="gap-3 px-3 py-2.5 cursor-pointer rounded-lg mx-1 focus:bg-secondary">
                  <Building2 className="w-4 h-4 text-muted-foreground" />
                  <span className="font-medium">My Organizations</span>
                </DropdownMenuItem>
                {isAdmin && (
                  <>
                    <DropdownMenuSeparator className="bg-border" />
                    <DropdownMenuItem onClick={() => navigate("/admin")} className="gap-3 px-3 py-2.5 cursor-pointer rounded-lg mx-1 focus:bg-secondary">
                      <ShieldCheck className="w-4 h-4 text-[hsl(var(--brand-pink))]" />
                      <span className="font-medium text-[hsl(var(--brand-pink))]">Admin Panel</span>
                    </DropdownMenuItem>
                  </>
                )}
                <DropdownMenuSeparator className="bg-border" />
                <DropdownMenuLabel className="text-[11px] uppercase tracking-widest text-muted-foreground font-bold px-3 py-1.5">
                  As Attendee
                </DropdownMenuLabel>
                <DropdownMenuItem onClick={() => navigate("/profile")} className="gap-3 px-3 py-2.5 cursor-pointer rounded-lg mx-1 focus:bg-secondary">
                  <UserCircle className="w-4 h-4 text-muted-foreground" />
                  <span className="font-medium">Profile</span>
                </DropdownMenuItem>
                <DropdownMenuItem className="gap-3 px-3 py-2.5 cursor-pointer rounded-lg mx-1 focus:bg-secondary">
                  <Ticket className="w-4 h-4 text-muted-foreground" />
                  <span className="font-medium">My Tickets</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-border" />
                <DropdownMenuItem
                  onClick={async () => { await logout(); navigate("/"); }}
                  className="gap-3 px-3 py-2.5 cursor-pointer rounded-lg mx-1 text-destructive focus:bg-destructive/10 focus:text-destructive"
                >
                  <LogOut className="w-4 h-4" />
                  <span className="font-medium">Sign Out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Mobile Tab Bar */}
        <div className="lg:hidden overflow-x-auto border-b border-border bg-background sticky top-20 z-30">
          <div className="flex px-4 gap-1 min-w-max">
            {visibleSidebarItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center gap-2 px-4 py-3 text-xs font-bold tracking-tight whitespace-nowrap transition-colors border-b-2 ${
                  activeTab === item.id
                    ? "text-[hsl(var(--brand-pink))] border-[hsl(var(--brand-pink))]"
                    : "text-muted-foreground border-transparent hover:text-foreground"
                }`}
              >
                {item.icon}
                <span>{item.id}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Dashboard Canvas */}
        <div className="px-4 md:px-8 py-8 space-y-8">
          {activeTab === "Events" ? (
            <OrgEventsTab orgSlug={orgSlug || ""} events={dbEvents} isPromoter={isPromoter} />
          ) : activeTab === "Orders" ? (
            <div className="space-y-6">
              <div className="flex flex-col md:flex-row justify-between md:items-end gap-4">
                <div>
                  <h1 className="text-3xl md:text-4xl font-black tracking-tighter text-foreground mb-1">Orders</h1>
                  <p className="text-muted-foreground text-sm">All orders across your events.</p>
                </div>
              </div>
              <div className="relative max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search by name, email, order ID, or ticket..."
                  value={ordersTabSearch}
                  onChange={(e) => setOrdersTabSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-secondary border border-border rounded-2xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[hsl(var(--brand-pink))]"
                />
              </div>
              <div className="flex gap-2">
                {(["all", "refunded", "disputed", "scanned"] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setOrdersStatusFilter(f)}
                    className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-colors ${
                      ordersStatusFilter === f
                        ? "bg-foreground text-background"
                        : "bg-secondary text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {f === "all" ? "All" : f === "scanned" ? "Scanned" : f === "refunded" ? "Refunded" : "Disputed"}
                  </button>
                ))}
              </div>
              <div className="bg-card rounded-3xl border border-border overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-muted-foreground">
                        <th className="text-left px-6 py-3 font-bold text-[10px] uppercase tracking-[0.15em]">Order</th>
                        <th className="text-left px-6 py-3 font-bold text-[10px] uppercase tracking-[0.15em]">Customer</th>
                        <th className="text-left px-6 py-3 font-bold text-[10px] uppercase tracking-[0.15em]">Event</th>
                        <th className="text-left px-6 py-3 font-bold text-[10px] uppercase tracking-[0.15em]">Ticket</th>
                        <th className="text-left px-6 py-3 font-bold text-[10px] uppercase tracking-[0.15em]">Qty</th>
                        <th className="py-3 font-bold text-[10px] uppercase tracking-[0.15em] text-left px-[15px]">TOTAL SPENT</th>
                        <th className="text-left px-6 py-3 font-bold text-[10px] uppercase tracking-[0.15em]">Status</th>
                        <th className="text-left px-6 py-3 font-bold text-[10px] uppercase tracking-[0.15em]">Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        const q = ordersTabSearch.toLowerCase();
                        const filtered = dbOrders.filter((o) => {
                          // Status filter
                          if (ordersStatusFilter === "refunded" && o.status !== "refunded") return false;
                          if (ordersStatusFilter === "disputed" && o.status !== "disputed") return false;
                          if (ordersStatusFilter === "scanned" && !o.checked_in) return false;
                          // Search filter
                          if (!q) return true;
                          const p = o.profiles as any;
                          const name = p?.name?.toLowerCase() || "";
                          const email = p?.email?.toLowerCase() || "";
                          const ev = dbEvents.find((e) => e.id === o.event_id);
                          const eventTitle = ev?.title?.toLowerCase() || "";
                          return o.id.toLowerCase().includes(q) || name.includes(q) || email.includes(q) || o.ticket_name.toLowerCase().includes(q) || eventTitle.includes(q);
                        }).slice(0, 30);
                        if (filtered.length === 0) return (
                          <tr><td colSpan={8} className="px-6 py-12 text-center text-muted-foreground">No orders found</td></tr>
                        );
                        return filtered.map((o) => {
                          const p = o.profiles as any;
                          const customerName = p?.name || "Unknown";
                          const eventObj = dbEvents.find((e) => e.id === o.event_id);
                          const eventName = eventObj?.title || "Event";
                          const unitPriceNum = Number(o.unit_price) || 0;
                          const discountNum = Number(o.discount || 0);
                          const pricing = resolveOrderPricing({
                            unitPrice: unitPriceNum,
                            quantity: o.quantity || 1,
                            discount: discountNum,
                            total: Number(o.total) || 0,
                          });
                          const totalAmount = pricing.totalPaid;
                          const orderDate = format(new Date(o.created_at), "MMM dd, yyyy") + ' ' + new Date(o.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                          return (
                            <tr key={o.id} className="border-b border-border last:border-0 hover:bg-secondary/50 transition-colors">
                              <td className="px-6 py-4 font-bold text-foreground">
                                <button
                                  onClick={() => setSelectedOrder({
                                    id: o.id,
                                    orderId: o.id.slice(0, 8),
                                    event: eventName,
                                    ticket: o.ticket_name,
                                    qty: o.quantity,
                                    total: `$${totalAmount.toFixed(2)}`,
                                    totalAmount,
                                    unitPrice: unitPriceNum,
                                    serviceFee: pricing.serviceFee,
                                    discount: discountNum,
                                    promoCode: o.promo_code || null,
                                    date: orderDate,
                                    customerName,
                                    refundedAmount: Number(o.refunded_amount || 0),
                                    refundedAt: o.refunded_at || null,
                                    status: o.status,
                                  })}
                                  className="hover:text-[hsl(var(--brand-pink))] hover:underline transition-colors cursor-pointer"
                                >
                                  #{o.id.slice(0, 8)}
                                </button>
                              </td>
                              <td className="px-6 py-4 font-medium">
                                <button
                                  onClick={() => {
                                    const userOrders = dbOrders.filter((ord) => ord.user_id === o.user_id);
                                    const customerProfile = p || {} as any;
                                    const customerEvents = new Set(userOrders.map((ord) => ord.event_id));
                                    const customerTotalSpent = userOrders.reduce((sum, ord) => {
                                      const pricing = resolveOrderPricing({
                                        unitPrice: Number(ord.unit_price) || 0,
                                        quantity: ord.quantity || 1,
                                        discount: Number(ord.discount || 0),
                                        total: Number(ord.total) || 0,
                                      });
                                      return sum + Math.max(0, pricing.totalPaid - Number(ord.refunded_amount || 0));
                                    }, 0);
                                    setSelectedCustomer({
                                      userId: o.user_id,
                                      name: customerName,
                                      email: customerProfile.email || "",
                                      phone: customerProfile.phone || "N/A",
                                      instagram: "",
                                      avatarUrl: customerProfile.avatar_url || "",
                                      eventsAttended: customerEvents.size,
                                      totalSpent: `$${customerTotalSpent.toFixed(2)}`,
                                      orders: userOrders.map((ord) => {
                                        const ev = dbEvents.find((e) => e.id === ord.event_id);
                                        const up = Number(ord.unit_price) || 0;
                                        const pricing = resolveOrderPricing({
                                          unitPrice: up,
                                          quantity: ord.quantity || 1,
                                          discount: Number(ord.discount || 0),
                                          total: Number(ord.total) || 0,
                                        });
                                        return {
                                          id: ord.id,
                                          orderId: ord.id.slice(0, 8),
                                          event: ev?.title || "Event",
                                          ticket: ord.ticket_name,
                                          qty: ord.quantity,
                                          total: `$${pricing.totalPaid.toFixed(2)}`,
                                          totalAmount: pricing.totalPaid,
                                          unitPrice: up,
                                          serviceFee: pricing.serviceFee,
                                          discount: Number(ord.discount || 0),
                                          promoCode: ord.promo_code || null,
                                          date: format(new Date(ord.created_at), "MMM dd, yyyy") + ' ' + new Date(ord.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                                          refundedAmount: Number(ord.refunded_amount || 0),
                                          refundedAt: ord.refunded_at || null,
                                          status: ord.status,
                                        };
                                      }),
                                    });
                                  }}
                                  className="hover:text-[hsl(var(--brand-pink))] hover:underline transition-colors cursor-pointer"
                                >
                                  {customerName}
                                </button>
                              </td>
                              <td className="px-6 py-4 text-muted-foreground">{eventName}</td>
                              <td className="px-6 py-4">
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-secondary text-muted-foreground">{o.ticket_name}</span>
                              </td>
                              <td className="px-6 py-4 tabular-nums">{o.quantity}</td>
                              <td className="px-6 py-4 font-bold text-foreground tabular-nums">${pricing.subtotalAfterPromo.toFixed(2)}</td>
                              <td className="px-6 py-4">
                                {o.status === "refunded" ? (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest bg-red-500/20 text-red-400">Refunded</span>
                                ) : o.status === "disputed" ? (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest bg-yellow-500/20 text-yellow-400">Disputed</span>
                                ) : o.checked_in ? (
                                  <div>
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest bg-green-500/20 text-green-400">Scanned</span>
                                    {(o as any).checked_in_at && (
                                      <p className="text-[9px] text-muted-foreground mt-1">
                                        {new Date((o as any).checked_in_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })} {new Date((o as any).checked_in_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                      </p>
                                    )}
                                  </div>
                                ) : (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest bg-secondary text-muted-foreground">Completed</span>
                                )}
                              </td>
                              <td className="px-6 py-4 text-muted-foreground">{orderDate}</td>
                            </tr>
                          );
                        });
                      })()}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : activeTab === "Marketing" ? (
            <EventMarketingTab orgSlug={orgSlug || ""} />
          ) : activeTab === "Analytics" ? (
            <OrgAnalyticsTab orgSlug={orgSlug || ""} dbOrders={dbOrders} dbEvents={dbEvents} />
          ) : activeTab === "Team" ? (
            <OrgTeamTab orgSlug={orgSlug || ""} />
          ) : activeTab === "Payouts" ? (
            <OrgPayoutsTab orgSlug={orgSlug || ""} />
          ) : isPromoter ? (
          <>
            {/* Promoter Overview */}
            <div className="flex flex-col md:flex-row justify-between md:items-end gap-4">
              <div>
                <h1 className="text-3xl md:text-4xl font-black tracking-tighter text-foreground mb-1">
                  My Performance
                </h1>
                <p className="text-muted-foreground text-sm">
                  Welcome back, {user.name.split(" ")[0]}. Here are your promoter metrics for {org.name}.
                </p>
              </div>
            </div>

            {/* Promoter Metrics Grid */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="p-6 bg-card rounded-3xl border border-border">
                <div className="flex items-center gap-2 mb-3">
                  <MousePointerClick className="w-4 h-4 text-muted-foreground" />
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Total Clicks</p>
                </div>
                <h2 className="text-3xl font-black text-foreground"><AnimatedNumber value={promoterTotalClicks} /></h2>
              </div>
              <div className="p-6 bg-card rounded-3xl border border-border">
                <div className="flex items-center gap-2 mb-3">
                  <Ticket className="w-4 h-4 text-muted-foreground" />
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Sales</p>
                </div>
                <h2 className="text-3xl font-black text-foreground"><AnimatedNumber value={promoterTotalSales} /></h2>
              </div>
              <div className="p-6 bg-card rounded-3xl border border-border">
                <div className="flex items-center gap-2 mb-3">
                  <PercentCircle className="w-4 h-4 text-muted-foreground" />
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Conversion</p>
                </div>
                <h2 className="text-3xl font-black text-foreground">{promoterConversion}%</h2>
              </div>
              <div className="p-6 bg-card rounded-3xl border border-border">
                <div className="flex items-center gap-2 mb-3">
                  <DollarSign className="w-4 h-4 text-muted-foreground" />
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Revenue</p>
                </div>
                <h2 className="text-3xl font-black text-[hsl(var(--brand-pink))]"><AnimatedNumber value={promoterTotalRevenue} prefix="$ " /></h2>
              </div>
            </div>

            {/* Promoter Events Performance */}
            <div className="bg-card rounded-3xl border border-border overflow-hidden">
              <div className="px-6 py-4 border-b border-border">
                <h3 className="text-lg font-black text-foreground">Upcoming Events</h3>
                <p className="text-xs text-muted-foreground">Your performance per event</p>
              </div>
              {(() => {
                // Use all invited event IDs, not just ones with links
                const promoterEventRows = promoterEventIds
                  .map((eid) => {
                    const ev = dbEvents.find((e) => e.id === eid);
                    const evLinks = promoterLinks.filter((l) => l.event_id === eid);
                    const evSlugs = evLinks.map((l) => l.slug);
                    const evOrders = promoterOrders.filter((o) => o.event_id === eid && evSlugs.includes(o.ref_source));
                    const clicks = evLinks.reduce((s, l) => s + l.clicks, 0);
                    const sales = evOrders.reduce((s, o) => s + (o.quantity || 1), 0);
                    const revenue = evOrders.reduce((s, o) => s + getNetOrderRevenue(o), 0);
                    const conversion = clicks > 0 ? ((sales / clicks) * 100).toFixed(1) : "0.0";
                    return { eid, ev, clicks, sales, revenue, conversion };
                  })
                  .filter((row) => {
                    if (!row.ev) return false;

                    const endMonth = row.ev.endMonth ? monthMap[row.ev.endMonth] : undefined;
                    const fallbackMonth = row.ev.month ? monthMap[row.ev.month] : undefined;
                    const monthValue = endMonth ?? fallbackMonth;
                    const dayValue = row.ev.endDate || row.ev.date;
                    const yearValue = row.ev.endYear || row.ev.year;

                    if (monthValue === undefined || !dayValue || !yearValue) return false;

                    const effectiveEnd = new Date(Number(yearValue), monthValue, Number(dayValue), 23, 59, 59, 999);
                    const timeValue = row.ev.doors?.trim();
                    const timeMatch = timeValue?.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)$/i);

                    if (timeMatch) {
                      let hours = Number(timeMatch[1]) % 12;
                      const minutes = Number(timeMatch[2] || "0");
                      if (timeMatch[3].toUpperCase() === "PM") hours += 12;
                      effectiveEnd.setHours(hours, minutes, 0, 0);
                    }

                    return effectiveEnd.getTime() > Date.now();
                  });
                if (promoterEventRows.length === 0) {
                  return (
                    <div className="px-6 py-12 text-center text-muted-foreground text-sm">
                      No events yet.
                    </div>
                  );
                }
                return (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border text-muted-foreground">
                          <th className="text-left px-6 py-3 font-bold text-[10px] uppercase tracking-[0.15em]">Event</th>
                          <th className="text-left px-6 py-3 font-bold text-[10px] uppercase tracking-[0.15em]">Date</th>
                          <th className="text-right px-6 py-3 font-bold text-[10px] uppercase tracking-[0.15em]">Clicks</th>
                          <th className="text-right px-6 py-3 font-bold text-[10px] uppercase tracking-[0.15em]">Sales</th>
                          <th className="text-right px-6 py-3 font-bold text-[10px] uppercase tracking-[0.15em]">Conversion</th>
                          <th className="text-right px-6 py-3 font-bold text-[10px] uppercase tracking-[0.15em]">Revenue</th>
                        </tr>
                      </thead>
                      <tbody>
                        {promoterEventRows.map((row) => (
                          <tr
                            key={row.eid}
                            onClick={() => navigate(`/dashboard/${orgSlug}/event/${row.eid}`)}
                            className="border-b border-border last:border-0 hover:bg-secondary/30 cursor-pointer transition-colors"
                          >
                            <td className="px-6 py-4 font-bold text-foreground flex items-center gap-3">
                              {row.ev?.flyer ? (
                                <img src={row.ev.flyer} alt="" className="w-8 h-8 rounded-lg object-cover border border-border" />
                              ) : (
                                <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center text-xs font-black border border-border">
                                  {row.ev?.title?.[0] || "E"}
                                </div>
                              )}
                              <span className="truncate max-w-[200px]">{row.ev?.title || "Untitled"}</span>
                            </td>
                            <td className="px-6 py-4 text-muted-foreground whitespace-nowrap">
                              {row.ev?.month && row.ev?.date ? `${row.ev.month} ${row.ev.date}, ${row.ev.year}` : "—"}
                            </td>
                            <td className="px-6 py-4 text-right font-bold tabular-nums">{row.clicks}</td>
                            <td className="px-6 py-4 text-right font-bold tabular-nums">{row.sales}</td>
                            <td className="px-6 py-4 text-right font-bold tabular-nums">{row.conversion}%</td>
                            <td className="px-6 py-4 text-right font-bold text-[hsl(var(--brand-pink))] tabular-nums">${row.revenue.toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              })()}
            </div>

            {/* Recent Orders */}
            <div className="bg-card rounded-3xl border border-border overflow-hidden">
              <div className="px-6 py-4 border-b border-border">
                <h3 className="text-lg font-black text-foreground">Recent Orders</h3>
                <p className="text-xs text-muted-foreground">Latest sales from your tracking links</p>
              </div>
              {promoterOrders.length === 0 ? (
                <div className="px-6 py-12 text-center text-muted-foreground text-sm">
                  No orders yet.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-muted-foreground">
                        <th className="text-left px-6 py-3 font-bold text-[10px] uppercase tracking-[0.15em]">Order ID</th>
                        <th className="text-left px-6 py-3 font-bold text-[10px] uppercase tracking-[0.15em]">Event</th>
                        <th className="text-left px-6 py-3 font-bold text-[10px] uppercase tracking-[0.15em]">Ticket</th>
                        <th className="text-right px-6 py-3 font-bold text-[10px] uppercase tracking-[0.15em]">Qty</th>
                        <th className="text-right px-6 py-3 font-bold text-[10px] uppercase tracking-[0.15em]">Revenue</th>
                        <th className="text-left px-6 py-3 font-bold text-[10px] uppercase tracking-[0.15em]">Date</th>
                        <th className="text-left px-6 py-3 font-bold text-[10px] uppercase tracking-[0.15em]">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {promoterOrders.slice(0, 10).map((order) => {
                        const ev = dbEvents.find((e) => e.id === order.event_id);
                        const revenue = getNetOrderRevenue(order);
                        return (
                          <tr key={order.id} className="border-b border-border last:border-0 hover:bg-secondary/30 transition-colors">
                            <td className="px-6 py-4 font-mono text-xs text-muted-foreground">{order.id.slice(0, 8)}…</td>
                            <td className="px-6 py-4 font-bold text-foreground truncate max-w-[180px]">{ev?.title || "Event"}</td>
                            <td className="px-6 py-4 text-muted-foreground">{order.ticket_name}</td>
                            <td className="px-6 py-4 text-right font-bold tabular-nums">{order.quantity}</td>
                            <td className="px-6 py-4 text-right font-bold text-[hsl(var(--brand-pink))] tabular-nums">${revenue.toFixed(2)}</td>
                            <td className="px-6 py-4 text-muted-foreground whitespace-nowrap text-xs">
                              {new Date(order.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}{" "}
                              {new Date(order.created_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                            </td>
                            <td className="px-6 py-4">
                              {order.status === "refunded" ? (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest bg-red-500/20 text-red-400">Refunded</span>
                              ) : order.status === "disputed" ? (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest bg-yellow-500/20 text-yellow-400">Disputed</span>
                              ) : order.checked_in ? (
                                <div>
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest bg-green-500/20 text-green-400">Scanned</span>
                                  {order.checked_in_at && (
                                    <p className="text-[9px] text-muted-foreground mt-1">
                                      {new Date(order.checked_in_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })} {new Date(order.checked_in_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </p>
                                  )}
                                </div>
                              ) : (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest bg-secondary text-muted-foreground">Completed</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
          ) : (
          <>
          {/* Page Header */}
          <div className="flex flex-col md:flex-row justify-between md:items-end gap-4">
            <div>
              <h1 className="text-3xl md:text-4xl font-black tracking-tighter text-foreground mb-1">
                Dashboard Overview
              </h1>
              <p className="text-muted-foreground text-sm">
                Welcome back, {user.name.split(" ")[0]}. Here's how your events are performing.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => navigate(`/org/${orgSlug}`)}
                className="px-5 py-2.5 rounded-full bg-secondary text-sm font-bold border border-border hover:bg-accent transition-colors flex items-center gap-2 max-lg:p-3 max-lg:rounded-full"
              >
                <ExternalLink className="w-4 h-4" />
                <span className="hidden lg:inline">See Organization Page</span>
              </button>
              <button
                onClick={() => setEditOrgOpen(true)}
                className="px-5 py-2.5 rounded-full bg-[hsl(var(--brand-lime))] text-black text-sm font-bold flex items-center gap-2 hover:scale-105 transition-transform active:scale-95 max-lg:p-3 max-lg:rounded-full"
              >
                <Pencil className="w-4 h-4" />
                <span className="hidden lg:inline">Edit Organization Profile</span>
              </button>
            </div>
          </div>

          {/* Metrics Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Total Revenue */}
            <div className="p-8 bg-card rounded-3xl border border-border relative overflow-hidden group hover:shadow-lg hover:shadow-[hsl(var(--brand-pink))]/5 transition-all">
              <div className="relative z-10">
                <div className="flex items-center gap-2 mb-4">
                  <TrendingUp className="w-4 h-4 text-muted-foreground" />
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Total Revenue</p>
                </div>
                <div className="flex items-end gap-3 mb-6">
                  <h2 className="text-4xl md:text-5xl font-black text-[hsl(var(--brand-pink))]"><AnimatedNumber value={totalRevenue} prefix="$ " /></h2>
                  <span className={`text-sm font-bold mb-2 ${growthPct >= 0 ? "text-[hsl(var(--brand-lime))]" : "text-destructive"}`}>{growthPct >= 0 ? "+" : ""}{growthPct}%</span>
                </div>
                <div className="h-16 w-full flex items-end gap-1">
                  {(() => {
                    const now = new Date();
                    const monthsData = Array.from({ length: 7 }, (_, i) => {
                      const d = new Date(now.getFullYear(), now.getMonth() - (6 - i), 1);
                      const nextMonth = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
                      const monthRevenue = dbOrders
                        .filter((o) => { const od = new Date(o.created_at); return od >= d && od < nextMonth; })
                        .reduce((sum, o) => sum + getOrderOrganizerRevenue(o), 0);
                      return { label: d.toLocaleString('default', { month: 'short' }), value: monthRevenue };
                    });
                    const maxVal = Math.max(...monthsData.map(m => m.value), 1);
                    return monthsData.map((m, i) => {
                      const isCurrent = i === 6;
                      const heightPct = (m.value / maxVal) * 100;
                      return (
                        <div key={i} className="flex-1 relative group/bar" style={{ height: '100%' }}>
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1.5 bg-popover border border-border rounded-lg text-[10px] font-bold whitespace-nowrap opacity-0 group-hover/bar:opacity-100 transition-opacity pointer-events-none z-20 shadow-lg">
                            <span className="text-[hsl(var(--brand-pink))]">
                              {m.label}: ${m.value >= 1000 ? `${(m.value / 1000).toFixed(1)}K` : m.value.toFixed(0)}
                            </span>
                          </div>
                          <div
                            className={`w-full rounded-t-sm transition-all duration-300 absolute bottom-0 ${
                              isCurrent
                                ? "bg-[hsl(var(--brand-pink))] shadow-lg shadow-[hsl(var(--brand-pink))]/30"
                                : "bg-[hsl(var(--brand-pink))]/20 group-hover/bar:bg-[hsl(var(--brand-pink))]/50"
                            }`}
                            style={{ height: `${heightPct}%` }}
                          />
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>
              <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-[hsl(var(--brand-pink))]/5 rounded-full blur-3xl group-hover:bg-[hsl(var(--brand-pink))]/10 transition-colors" />
            </div>

            {/* Tickets Sold */}
            <div className="p-8 bg-card rounded-3xl border border-border relative overflow-hidden group hover:shadow-lg transition-all">
              <div className="relative z-10 h-full flex flex-col">
                <div className="flex items-center gap-2 mb-4">
                  <Ticket className="w-4 h-4 text-muted-foreground" />
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Tickets Sold</p>
                </div>
                <div className="flex items-end gap-3 mb-auto">
                  <h2 className="text-4xl md:text-5xl font-black text-foreground"><AnimatedNumber value={totalTicketsSold} /></h2>
                </div>
                <div className="mt-8">
                  {(() => {
                    const now = new Date();
                    const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
                    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                    const thisMonthTickets = dbOrders.filter((o) => new Date(o.created_at) >= startOfThisMonth).reduce((s, o) => s + (o.quantity || 1), 0);
                    const lastMonthTickets = dbOrders.filter((o) => { const d = new Date(o.created_at); return d >= startOfLastMonth && d < startOfThisMonth; }).reduce((s, o) => s + (o.quantity || 1), 0);
                    const ticketGrowth = lastMonthTickets === 0 ? (thisMonthTickets > 0 ? 100 : 0) : Math.round(((thisMonthTickets - lastMonthTickets) / lastMonthTickets) * 100);
                    const isPositive = ticketGrowth >= 0;
                    return (
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-black ${isPositive ? "text-[hsl(var(--brand-lime))]" : "text-destructive"}`}>
                          {isPositive ? "+" : ""}{ticketGrowth}%
                        </span>
                        <span className="text-[10px] font-bold uppercase text-muted-foreground">Growth from last month</span>
                      </div>
                    );
                  })()}
                </div>
              </div>
            </div>

            {/* Total Attendees */}
            <div className="p-8 bg-card rounded-3xl border border-border relative overflow-hidden group hover:shadow-lg transition-all">
              <div className="relative z-10">
                <div className="flex items-center gap-2 mb-4">
                  <Users className="w-4 h-4 text-muted-foreground" />
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Total Attendees</p>
                </div>
                <div className="flex items-center gap-4 mb-4">
                  <h2 className="text-4xl md:text-5xl font-black text-foreground"><AnimatedNumber value={totalAttendees} /></h2>
                </div>
                <p className="text-sm text-muted-foreground font-medium">Across all events</p>
                <div className="mt-6 flex gap-2">
                  <div className="flex -space-x-3">
                    {(() => {
                      const uniqueUsers = Array.from(new Map(dbOrders.map((o) => [o.user_id, o.profiles as any])).entries()).slice(0, 3);
                      return uniqueUsers.map(([uid, profile], i) => (
                        <Avatar key={uid} className="w-8 h-8 border-2 border-card">
                          <AvatarImage src={profile?.avatar_url || ""} />
                          <AvatarFallback className="bg-secondary text-foreground font-black text-[10px]">
                            {(profile?.name || "?").split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)}
                          </AvatarFallback>
                        </Avatar>
                      ));
                    })()}
                    {totalAttendees > 3 && (
                      <div className="w-8 h-8 rounded-full border-2 border-card bg-secondary flex items-center justify-center text-[10px] font-bold text-muted-foreground">
                        +{totalAttendees - 3}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Sales Performance Chart */}
          <div className="p-8 bg-card rounded-3xl border border-border">
            <div className="flex flex-col sm:flex-row justify-between items-start gap-4 mb-4">
              <div>
                <h3 className="text-xl font-black text-foreground mb-1">Sales Performance</h3>
                <p className="text-sm text-muted-foreground">
                  {chartPeriod === "Week" && "Ticket sales over the last 7 days"}
                  {chartPeriod === "Month" && "Ticket sales over the last 30 days"}
                  {chartPeriod === "Year" && "Ticket sales over the last 12 months"}
                </p>
              </div>
              <div className="flex bg-secondary rounded-full p-1">
                {(["Week", "Month", "Year"] as const).map((p) => (
                  <button
                    key={p}
                    onClick={() => handlePeriodChange(p)}
                    className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${
                      chartPeriod === p
                        ? "bg-accent text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            {/* Legend */}
            <div className="flex items-center gap-6 mb-6">
              <div className="flex items-center gap-2">
                <div className="w-3 h-[3px] rounded-full bg-[hsl(343,94%,55%)]" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">TOTAL REVENUE</span>
              </div>
            </div>

            {/* Chart */}
            {(() => {
              const now = new Date();
              let revenueData: number[];
              let pointLabels: string[];

              if (chartPeriod === "Week") {
                revenueData = Array.from({ length: 7 }, (_, i) => {
                  const day = new Date(now);
                  day.setDate(day.getDate() - (6 - i));
                  const dayStart = new Date(day.getFullYear(), day.getMonth(), day.getDate());
                  const dayEnd = new Date(dayStart);
                  dayEnd.setDate(dayEnd.getDate() + 1);
                  return dbOrders
                    .filter((o) => { const d = new Date(o.created_at); return d >= dayStart && d < dayEnd; })
                    .reduce((sum, o) => sum + (Number(o.total) - Number(o.service_fee)), 0);
                });
                pointLabels = Array.from({ length: 7 }, (_, i) => {
                  const d = new Date(now);
                  d.setDate(d.getDate() - (6 - i));
                  return d.toLocaleDateString('default', { weekday: 'short', month: 'short', day: 'numeric' });
                });
              } else if (chartPeriod === "Month") {
                revenueData = Array.from({ length: 30 }, (_, i) => {
                  const day = new Date(now);
                  day.setDate(day.getDate() - (29 - i));
                  const dayStart = new Date(day.getFullYear(), day.getMonth(), day.getDate());
                  const dayEnd = new Date(dayStart);
                  dayEnd.setDate(dayEnd.getDate() + 1);
                  return dbOrders
                    .filter((o) => { const d = new Date(o.created_at); return d >= dayStart && d < dayEnd; })
                    .reduce((sum, o) => sum + (Number(o.total) - Number(o.service_fee)), 0);
                });
                pointLabels = Array.from({ length: 30 }, (_, i) => {
                  const d = new Date(now);
                  d.setDate(d.getDate() - (29 - i));
                  return d.toLocaleDateString('default', { month: 'short', day: 'numeric' });
                });
              } else {
                revenueData = Array.from({ length: 12 }, (_, i) => {
                  const mStart = new Date(now.getFullYear(), now.getMonth() - (11 - i), 1);
                  const mEnd = new Date(now.getFullYear(), now.getMonth() - (10 - i), 1);
                  return dbOrders
                    .filter((o) => { const d = new Date(o.created_at); return d >= mStart && d < mEnd; })
                    .reduce((sum, o) => sum + (Number(o.total) - Number(o.service_fee)), 0);
                });
                pointLabels = Array.from({ length: 12 }, (_, i) => {
                  const d = new Date(now.getFullYear(), now.getMonth() - (11 - i), 1);
                  return d.toLocaleDateString('default', { month: 'long', year: 'numeric' });
                });
              }

              const maxRevenue = Math.max(...revenueData, 1);
              const n = revenueData.length;

              const toPath = (data: number[], maxVal: number) => {
                const points = data.map((v, i) => ({
                  x: (i / (n - 1)) * 1000,
                  y: 280 - (v / maxVal) * 260,
                }));
                let d = `M${points[0].x},${points[0].y}`;
                for (let i = 1; i < points.length; i++) {
                  const cp1x = points[i - 1].x + (points[i].x - points[i - 1].x) / 3;
                  const cp2x = points[i].x - (points[i].x - points[i - 1].x) / 3;
                  d += ` C${cp1x},${points[i - 1].y} ${cp2x},${points[i].y} ${points[i].x},${points[i].y}`;
                }
                return d;
              };

              const revenuePath = toPath(revenueData, maxRevenue);
              const points = revenueData.map((v, i) => ({
                x: (i / (n - 1)) * 1000,
                y: 280 - (v / maxRevenue) * 260,
              }));

              return (
                <div
                  className="h-80 w-full relative group/chart"
                  key={chartKey}
                  onMouseMove={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const x = e.clientX - rect.left;
                    const pct = x / rect.width;
                    const idx = Math.round(pct * (n - 1));
                    const clamped = Math.max(0, Math.min(n - 1, idx));
                    const tooltip = e.currentTarget.querySelector('[data-chart-tooltip]') as HTMLElement;
                    const line = e.currentTarget.querySelector('[data-chart-line]') as HTMLElement;
                    const dot = e.currentTarget.querySelector('[data-chart-dot]') as HTMLElement;
                    if (tooltip && line && dot) {
                      const ptX = points[clamped].x / 1000 * rect.width;
                      const ptY = points[clamped].y / 300 * rect.height;
                      line.style.left = `${ptX}px`;
                      line.style.opacity = '1';
                      dot.style.left = `${ptX - 5}px`;
                      dot.style.top = `${ptY - 5}px`;
                      dot.style.opacity = '1';
                      tooltip.style.opacity = '1';
                      tooltip.style.left = `${Math.min(Math.max(ptX, 60), rect.width - 60)}px`;
                      tooltip.style.top = `${Math.max(ptY - 60, 0)}px`;
                      tooltip.innerHTML = `<span style="font-weight:900;font-size:13px;">$${revenueData[clamped].toLocaleString('en-US', { minimumFractionDigits: 2 })}</span><br/><span style="font-size:10px;opacity:0.6;text-transform:uppercase;letter-spacing:0.1em;">${pointLabels[clamped]}</span>`;
                    }
                  }}
                  onMouseLeave={(e) => {
                    const tooltip = e.currentTarget.querySelector('[data-chart-tooltip]') as HTMLElement;
                    const line = e.currentTarget.querySelector('[data-chart-line]') as HTMLElement;
                    const dot = e.currentTarget.querySelector('[data-chart-dot]') as HTMLElement;
                    if (tooltip) tooltip.style.opacity = '0';
                    if (line) line.style.opacity = '0';
                    if (dot) dot.style.opacity = '0';
                  }}
                >
                  <div className="absolute inset-0 flex flex-col justify-between">
                    {[0, 1, 2, 3, 4].map((i) => (
                      <div key={i} className="border-b border-border/50 w-full h-0" />
                    ))}
                  </div>
                  <svg className="absolute inset-0 h-full w-full" preserveAspectRatio="none" viewBox="0 0 1000 300">
                    <defs>
                      <linearGradient id="grad-pink" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" style={{ stopColor: "hsl(343, 94%, 55%)", stopOpacity: 0.3 }} />
                        <stop offset="100%" style={{ stopColor: "hsl(343, 94%, 55%)", stopOpacity: 0 }} />
                      </linearGradient>
                    </defs>
                    <path d={`${revenuePath} V300 H0 Z`} fill="url(#grad-pink)" />
                    <path
                      d={revenuePath}
                      fill="none" stroke="hsl(343, 94%, 55%)" strokeWidth="4" strokeLinecap="round"
                      style={{ strokeDasharray: 2500, strokeDashoffset: 2500, animation: 'chart-draw 1.5s ease-out 0.4s forwards' }}
                    />
                  </svg>
                  {/* Hover vertical line */}
                  <div data-chart-line className="absolute top-0 bottom-0 w-px bg-foreground/20 pointer-events-none transition-opacity duration-150" style={{ opacity: 0 }} />
                  {/* Hover dot */}
                  <div data-chart-dot className="absolute w-[10px] h-[10px] rounded-full bg-[hsl(343,94%,55%)] border-2 border-background pointer-events-none transition-opacity duration-150 shadow-md" style={{ opacity: 0 }} />
                  {/* Hover tooltip */}
                  <div data-chart-tooltip className="absolute pointer-events-none -translate-x-1/2 bg-foreground text-background px-3 py-2 rounded-xl text-center whitespace-nowrap transition-opacity duration-150 shadow-lg z-10" style={{ opacity: 0 }} />
                  <style>{`@keyframes chart-draw { to { stroke-dashoffset: 0; } }`}</style>
                </div>
              );
            })()}
            <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              {(() => {
                const now = new Date();
                if (chartPeriod === "Week") {
                  return Array.from({ length: 7 }, (_, i) => {
                    const d = new Date(now);
                    d.setDate(d.getDate() - (6 - i));
                    return <span key={i}>{d.toLocaleDateString('default', { weekday: 'short' })}</span>;
                  });
                } else if (chartPeriod === "Month") {
                  return Array.from({ length: 6 }, (_, i) => {
                    const d = new Date(now);
                    d.setDate(d.getDate() - 30 + Math.round(i * 6));
                    return <span key={i}>{d.toLocaleDateString('default', { month: 'short', day: 'numeric' })}</span>;
                  });
                } else {
                  return Array.from({ length: 12 }, (_, i) => {
                    const d = new Date(now.getFullYear(), now.getMonth() - (11 - i), 1);
                    return <span key={i}>{d.toLocaleDateString('default', { month: 'short' })}</span>;
                  });
                }
              })()}
            </div>
          </div>

          {/* Bottom: Event Table & Recent Orders */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
            {/* Upcoming Events Table */}
            <div className="xl:col-span-2 bg-card rounded-3xl border border-border overflow-hidden">
              <div className="p-8 pb-4 flex justify-between items-center">
                <h3 className="text-xl font-black text-foreground">Upcoming Events</h3>
                <button onClick={() => setActiveTab("Events")} className="text-[hsl(var(--brand-pink))] text-xs font-black uppercase tracking-widest hover:underline">
                  View All Events
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="px-8 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Event Name</th>
                      <th className="px-8 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Date</th>
                      <th className="px-8 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Status</th>
                      <th className="px-8 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground text-right">Revenue</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {eventsLoading ? (
                      [1, 2, 3].map((i) => (
                        <tr key={i}>
                          <td className="px-8 py-5" colSpan={4}>
                            <div className="flex items-center gap-4">
                              <div className="w-12 h-12 rounded-xl bg-secondary animate-pulse" />
                              <div className="flex-1 space-y-2">
                                <div className="h-4 w-40 bg-secondary rounded-lg animate-pulse" />
                                <div className="h-3 w-24 bg-secondary rounded-lg animate-pulse" />
                              </div>
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : upcomingEvents.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-8 py-12 text-center text-muted-foreground text-sm">
                          No upcoming events.
                        </td>
                      </tr>
                    ) : null}
                    {!eventsLoading && upcomingEvents.map((ev) => {
                      const d = parseDate(ev);
                      const dateStr = d ? format(d, "MMM dd, yyyy") : "—";
                      return (
                        <tr key={ev.id} className="group hover:bg-secondary/50 transition-colors cursor-pointer" onClick={() => navigate(`/dashboard/${orgSlug}/event/${ev.id}`)}>
                          <td className="px-8 py-5">
                            <div className="flex items-center gap-4">
                              <div className="w-12 h-12 rounded-xl overflow-hidden flex-shrink-0 bg-secondary">
                                {ev.flyer ? (
                                  <img src={ev.flyer} alt={ev.title} className="w-full h-full object-cover" />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                                    <CalendarDays className="w-5 h-5" />
                                  </div>
                                )}
                              </div>
                              <div>
                                <p className="font-bold text-foreground group-hover:text-[hsl(var(--brand-pink))] transition-colors">{ev.title || "Untitled Event"}</p>
                                <p className="text-xs text-muted-foreground">{ev.venue || ev.city || "—"}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-8 py-5 text-sm font-medium">{dateStr}</td>
                          <td className="px-8 py-5">
                            <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${statusStyles[ev.status] || statusStyles.Draft}`}>
                              {ev.status}
                            </span>
                          </td>
                          <td className="px-8 py-5 text-right font-black text-foreground">
                            {eventRevenue[ev.id] ? `$${eventRevenue[ev.id].toLocaleString("en-US", { minimumFractionDigits: 2 })}` : "$0.00"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Recent Orders */}
            <div className="bg-card rounded-3xl border border-border overflow-hidden">
              <div className="p-8 pb-4 flex justify-between items-center">
                <h3 className="text-xl font-black text-foreground">Recent Orders</h3>
                <button onClick={() => setActiveTab("Orders")} className="text-[hsl(var(--brand-pink))] text-xs font-black uppercase tracking-widest hover:underline">
                  See All
                </button>
              </div>
              <div className="px-4 pb-6 space-y-2">
                {dbOrders.length === 0 && !ordersLoading && (
                  <p className="text-sm text-muted-foreground text-center py-8">No orders yet</p>
                )}
                {dbOrders.slice(0, 8).map((order) => {
                  const profile = order.profiles as any;
                  const name = profile?.name || order.user_id.slice(0, 8);
                  const avatarUrl = profile?.avatar_url || "";
                  const eventObj = dbEvents.find((e) => e.id === order.event_id);
                  const eventName = eventObj?.title || "Event";
                  const unitPriceNum = Number(order.unit_price) || 0;
                  const discountNum = Number(order.discount || 0);
                  const pricing = resolveOrderPricing({
                    unitPrice: unitPriceNum,
                    quantity: order.quantity || 1,
                    discount: discountNum,
                    total: Number(order.total) || 0,
                  });
                  const totalAmount = pricing.totalPaid;
                  const orderDate = format(new Date(order.created_at), "MMM dd, yyyy") + ' ' + new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                  const orderId = order.id.slice(0, 8);

                  // Open order detail directly on click
                  const handleClick = () => {
                    setSelectedOrder({
                      id: order.id,
                      orderId,
                      event: eventName,
                      ticket: order.ticket_name || "Standard",
                      qty: order.quantity || 1,
                      total: `$${totalAmount.toFixed(2)}`,
                      totalAmount,
                      unitPrice: unitPriceNum,
                      serviceFee: pricing.serviceFee,
                      discount: discountNum,
                      promoCode: order.promo_code || null,
                      date: orderDate,
                      customerName: name,
                      refundedAmount: Number(order.refunded_amount || 0),
                      refundedAt: order.refunded_at || null,
                      status: order.status,
                    });
                  };

                  return (
                    <div key={order.id} className="flex items-center gap-3 px-4 py-3 rounded-2xl hover:bg-secondary/50 transition-colors cursor-pointer"
                      onClick={handleClick}
                    >
                      <Avatar className="w-10 h-10 flex-shrink-0">
                        <AvatarImage src={avatarUrl} />
                        <AvatarFallback className="bg-secondary text-foreground font-black text-xs">
                          {name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-foreground truncate hover:text-[hsl(var(--brand-pink))] transition-colors">{name}</p>
                        <p className="text-[10px] text-muted-foreground truncate">{eventName} · <span className="font-mono">{orderId}</span></p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-sm font-black text-[hsl(var(--brand-pink))] tabular-nums">${pricing.subtotalAfterPromo.toFixed(2)}</p>
                        <p className="text-[10px] text-muted-foreground">{orderDate}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
          </>
          )}
        </div>
      </main>
    </div>

    {/* Customer Detail Dialog - same style as Event Dashboard */}
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
                  const slug = selectedCustomer.name.toLowerCase().replace(/\s+/g, "-");
                  navigate(`/user/${slug}`, { state: { customer: selectedCustomer } });
                }}
              >
                <ExternalLink className="w-3.5 h-3.5" />
                VIEW PROFILE PAGE
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-full font-bold gap-2 text-xs bg-destructive/10 text-destructive border-destructive/20 hover:bg-destructive/20"
                  >
                    <Ban className="w-3.5 h-3.5" />
                    BLOCK USER
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="rounded-2xl">
                  <AlertDialogHeader>
                    <AlertDialogTitle>Block {selectedCustomer.name}?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This user will no longer be able to purchase tickets for any of your organization's events. You can unblock them anytime.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel className="rounded-full">Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      className="rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      onClick={async () => {
                        if (!org?.id || !selectedCustomer.userId) return;
                        const { error } = await supabase.from("blocked_users" as any).insert({
                          organization_id: org.id,
                          user_id: selectedCustomer.userId,
                          blocked_by: session?.user?.id || "",
                        } as any);
                        if (error) {
                          if (error.code === "23505") {
                            toast.info("This user is already blocked");
                          } else {
                            toast.error("Failed to block user");
                          }
                        } else {
                          toast.success(`${selectedCustomer.name} has been blocked`);
                          setSelectedCustomer(null);
                        }
                      }}
                    >
                      Block User
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          )}
        </DialogHeader>
        {selectedCustomer && (
          <div className="flex flex-col md:flex-row gap-0">
            {/* Left side - Profile info */}
            <div className="md:w-[280px] flex-shrink-0 px-8 py-6 md:border-r border-border flex flex-col items-center text-center gap-4">
              <Avatar className="w-20 h-20 border-2 border-border">
                <AvatarImage src={selectedCustomer.avatarUrl} />
                <AvatarFallback className="bg-secondary text-foreground font-black text-xl">
                  {selectedCustomer.name.split(" ").map((n) => n[0]).join("").toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <h3 className="text-lg font-black text-foreground">{selectedCustomer.name}</h3>

              <div className="flex flex-col gap-3 w-full text-left">
                <a href={`https://instagram.com/${selectedCustomer.instagram.replace("@", "")}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 text-sm text-muted-foreground hover:text-[hsl(var(--brand-pink))] transition-colors">
                  <Instagram className="w-4 h-4 flex-shrink-0" />
                  <span className="truncate">{selectedCustomer.instagram}</span>
                </a>
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  <Mail className="w-4 h-4 flex-shrink-0" />
                  <span className="truncate">{selectedCustomer.email}</span>
                </div>
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  <Phone className="w-4 h-4 flex-shrink-0" />
                  <span>{selectedCustomer.phone}</span>
                </div>
              </div>

              <div className="w-full border-t border-border pt-4 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <CalendarCheck className="w-4 h-4" />
                    <span>Events Attended</span>
                  </div>
                  <span className="text-sm font-black text-foreground">{selectedCustomer.eventsAttended}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <DollarSign className="w-4 h-4" />
                    <span>Total Spent</span>
                  </div>
                  <span className="text-sm font-black text-[hsl(var(--brand-pink))]">{selectedCustomer.totalSpent}</span>
                </div>
              </div>
            </div>

            {/* Right side - Last Orders */}
            <div className="flex-1 px-6 py-6 min-w-0">
              <h4 className="text-xs font-black uppercase tracking-[0.15em] text-muted-foreground mb-4">Last Orders</h4>
              <div className="space-y-3 max-h-[340px] overflow-y-auto pr-2">
                {selectedCustomer.orders.map((order) => (
                  <button
                    key={order.id}
                    onClick={() => setSelectedOrder({ ...order, discount: (order as any).discount || 0, promoCode: (order as any).promoCode || null, customerName: selectedCustomer.name })}
                    className="w-full text-left p-4 bg-secondary/50 rounded-2xl border border-border/50 hover:border-[hsl(var(--brand-pink))]/40 hover:bg-secondary/80 transition-all group"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-bold text-foreground group-hover:text-[hsl(var(--brand-pink))] transition-colors">{order.id}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-muted-foreground">{order.date}</span>
                        <ChevronRight className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </div>
                    <p className="text-sm text-foreground font-medium mb-1">{order.event}</p>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          order.ticket === "VIP"
                            ? "bg-[hsl(var(--brand-pink))]/10 text-[hsl(var(--brand-pink))]"
                            : "bg-secondary text-muted-foreground"
                        }`}>
                          {order.ticket}
                        </span>
                        <span className="text-xs text-muted-foreground">× {order.qty}</span>
                      </div>
                      <span className="text-sm font-bold text-foreground">{order.total}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>

    {/* Order Detail Modal */}
    <Dialog open={!!selectedOrder} onOpenChange={(open) => { if (!open) { setSelectedOrder(null); setShowPartialRefund(false); } }}>
      <DialogContent className="sm:max-w-md rounded-3xl p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-0">
          <DialogTitle className="text-lg font-black">Order {selectedOrder?.orderId}</DialogTitle>
        </DialogHeader>
        {selectedOrder && (() => {
          const isRefunded = isOrderRefunded(selectedOrder);
          const unitPrice = selectedOrder.unitPrice;
          const discount = selectedOrder.discount || 0;
          const promoCode = selectedOrder.promoCode;
          const pricing = resolveOrderPricing({
            unitPrice,
            quantity: selectedOrder.qty,
            discount,
            total: selectedOrder.totalAmount,
          });

          return (
            <div className="px-6 pb-6 space-y-5">
              {isRefunded && (
                <div className="flex items-center gap-2 px-3 py-2 bg-destructive/10 rounded-xl border border-destructive/20">
                  <Ban className="w-4 h-4 text-destructive" />
                  <span className="text-sm font-bold text-destructive">This order has been refunded — ticket canceled</span>
                </div>
              )}

              {/* Breakdown */}
              <div className="space-y-2">
                <h4 className="text-xs font-black uppercase tracking-[0.15em] text-muted-foreground">Spend Breakdown</h4>
                <div className="bg-secondary/50 rounded-2xl border border-border/50 p-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Ticket Price ({selectedOrder.ticket} × {selectedOrder.qty})</span>
                    <span className="font-medium text-foreground">${pricing.ticketPrice.toFixed(2)}</span>
                  </div>
                  {discount > 0 && (
                    <>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Promo Code{promoCode ? ` (${promoCode})` : ""}</span>
                        <span className="font-medium text-green-400">-${pricing.promoDiscount.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Subtotal after promo</span>
                        <span className="font-medium text-foreground">${pricing.subtotalAfterPromo.toFixed(2)}</span>
                      </div>
                    </>
                  )}
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Service fee (non-refundable)</span>
                    <span className="font-medium text-foreground">${pricing.serviceFee.toFixed(2)}</span>
                  </div>
                  <div className="border-t border-border pt-2 flex justify-between text-sm">
                    <span className="font-bold text-foreground">Total</span>
                    <span className="font-black text-[hsl(var(--brand-pink))]">${pricing.totalPaid.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* Customer & Event */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Customer</span>
                  <span className="font-medium text-foreground">{selectedOrder.customerName}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Event</span>
                  <span className="font-medium text-foreground">{selectedOrder.event}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Date</span>
                  <span className="font-medium text-foreground">{selectedOrder.date}</span>
                </div>
              </div>

              {/* Actions */}
              <div className="space-y-2">
                <h4 className="text-xs font-black uppercase tracking-[0.15em] text-muted-foreground">Actions</h4>
                <div className="flex flex-col gap-2">
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" className="w-full justify-start gap-2 rounded-xl" disabled={isRefunded}>
                        <RotateCcw className="w-4 h-4" />
                        Full Refund
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent className="rounded-3xl">
                      <AlertDialogHeader>
                        <AlertDialogTitle>Confirm Full Refund</AlertDialogTitle>
                        <AlertDialogDescription>
                          Refund ${pricing.subtotalAfterPromo.toFixed(2)} (ticket price) to {selectedOrder.customerName}? Service fees are non-refundable. This will cancel their ticket and cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
                        <AlertDialogAction className="rounded-xl" onClick={async () => {
                          try {
                            const refundAmount = pricing.subtotalAfterPromo;
                            const refundedOrder = await refundOrder(selectedOrder.id, refundAmount);
                            const refundedAt = refundedOrder?.refunded_at || new Date().toISOString();
                            syncRefundState(selectedOrder.id, refundAmount, refundedAt);
                            setShowPartialRefund(false);
                            toast.success(`Full refund of $${refundAmount.toFixed(2)} issued to ${selectedOrder.customerName}`);
                          } catch (error: any) {
                            toast.error(error?.message || "Failed to refund order");
                          }
                        }}>Confirm Refund</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>

                  <Button variant="outline" className="w-full justify-start gap-2 rounded-xl" disabled={isRefunded}
                    onClick={() => { setPartialRefundAmount(""); setShowPartialRefund(true); }}>
                    <DollarSign className="w-4 h-4" />
                    Partial Refund
                  </Button>

                  {showPartialRefund && !isRefunded && (
                    <div className="bg-secondary/50 rounded-2xl border border-border/50 p-4 space-y-3">
                      <p className="text-sm text-muted-foreground">
                        Enter refund amount (max ${pricing.subtotalAfterPromo.toFixed(2)} — ticket price only). Service fees are non-refundable.
                      </p>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
                        <input
                          type="number"
                          min="0.01"
                          max={pricing.subtotalAfterPromo}
                          step="0.01"
                          value={partialRefundAmount}
                          onChange={(e) => setPartialRefundAmount(e.target.value)}
                          placeholder="0.00"
                          className="w-full pl-7 pr-3 py-2 bg-background border border-border rounded-xl text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[hsl(var(--brand-pink))] tabular-nums"
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button variant="ghost" size="sm" className="flex-1 rounded-xl" onClick={() => setShowPartialRefund(false)}>
                          Cancel
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="destructive" size="sm" className="flex-1 rounded-xl"
                              disabled={!partialRefundAmount || parseFloat(partialRefundAmount) <= 0 || parseFloat(partialRefundAmount) > pricing.subtotalAfterPromo}>
                              Refund ${partialRefundAmount || "0.00"}
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent className="rounded-3xl">
                            <AlertDialogHeader>
                              <AlertDialogTitle>Confirm Partial Refund</AlertDialogTitle>
                              <AlertDialogDescription>
                                Refund ${parseFloat(partialRefundAmount || "0").toFixed(2)} of {selectedOrder.total} to {selectedOrder.customerName}? This will cancel their ticket and cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
                              <AlertDialogAction className="rounded-xl" onClick={async () => {
                                try {
                                  const refundAmount = parseFloat(partialRefundAmount);
                                  const refundedOrder = await refundOrder(selectedOrder.id, refundAmount);
                                  const refundedAt = refundedOrder?.refunded_at || new Date().toISOString();
                                  syncRefundState(selectedOrder.id, refundAmount, refundedAt);
                                  setShowPartialRefund(false);
                                  toast.success(`Partial refund of $${refundAmount.toFixed(2)} issued to ${selectedOrder.customerName}`);
                                } catch (error: any) {
                                  toast.error(error?.message || "Failed to refund order");
                                }
                              }}>Confirm Refund</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  )}

                  <Button variant="secondary" className="w-full justify-start gap-2 rounded-xl" disabled={isRefunded}
                    onClick={() => toast.success(`Ticket resent to ${selectedOrder.customerName}`)}>
                    <Send className="w-4 h-4" />
                    Resend Ticket
                  </Button>
                </div>
              </div>
            </div>
          );
        })()}
      </DialogContent>
    </Dialog>

    <OrganizationSelectorModal open={orgSelectorOpen} onClose={() => setOrgSelectorOpen(false)} />
    {org && (
      <CreateOrganizationModal
        open={editOrgOpen}
        onClose={() => setEditOrgOpen(false)}
        editOrganization={org}
      />
    )}
    </>
  );
};

export default OrganizerDashboard;
