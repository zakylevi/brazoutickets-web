import { useState, useEffect, useMemo } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useOrganizations } from "@/contexts/OrganizationContext";
import { getEventById, saveEvent, deleteEvent, StoredEvent } from "@/stores/eventStore";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import DonutChart from "@/components/DonutChart";
import EventTicketsTab from "@/components/EventTicketsTab";
import EventTeamTab from "@/components/EventTeamTab";
import AnimatedNumber from "@/components/AnimatedNumber";

import {
  LayoutDashboard, Ticket, Users, Settings, Link2,
  Search, Bell, Sun, Moon, ArrowLeft, TrendingUp,
  MousePointerClick, PercentCircle, Eye, Pencil, Rocket, ExternalLink, Trash2,
  Instagram, Mail, Phone, CalendarCheck, DollarSign, RotateCcw, Send, Ban, ChevronRight,
  Download, Check, LogOut, UserCircle, Building2, HelpCircle, ShieldCheck,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { resolveOrderPricing } from "@/lib/orderPricing";
import { applyRefundToOrder, applyRefundToOrders, getNetOrderRevenue, isOrderRefunded, refundOrder } from "@/lib/refunds";
import PromoterEventDashboard from "@/components/PromoterEventDashboard";

type EventTab = "Overview" | "Tickets" | "Attendees" | "Team and Tracking" | "Settings";

const tabs: { id: EventTab; icon: React.ReactNode }[] = [
  { id: "Overview", icon: <LayoutDashboard className="w-5 h-5" /> },
  { id: "Tickets", icon: <Ticket className="w-5 h-5" /> },
  { id: "Attendees", icon: <Users className="w-5 h-5" /> },
  { id: "Team and Tracking", icon: <Link2 className="w-5 h-5" /> },
  { id: "Settings", icon: <Settings className="w-5 h-5" /> },
];

/* Mock data helpers */
interface MockCustomer {
  isBlocked?: boolean;
  userId: string;
  name: string;
  email: string;
  phone: string;
  instagram: string;
  avatarUrl: string;
  eventsAttended: number;
  totalSpent: string;
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
    date: string;
    refunded?: boolean;
    discount?: number;
    promoCode?: string | null;
    refundedAmount?: number;
    refundedAt?: string | null;
    status?: string;
  }[];
}

interface SelectedOrder {
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
  refunded?: boolean;
  refundedAmount?: number;
  refundedAt?: string | null;
  status?: string;
  customerName: string;
}

interface MockAttendee {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  billingCity: string;
  billingState: string;
  billingZip: string;
  instagram: string;
  avatarUrl: string;
  purchaseDate: string;
  ticket: string;
}

const buildMockData = (_ticketNames: string[]) => {
  const customers: Record<string, MockCustomer> = {};
  const orders: { id: string; name: string; ticket: string; qty: number; total: string; date: string }[] = [];
  const attendees: MockAttendee[] = [];
  return { customers, orders, attendees };
};

interface DbOrder {
  id: string;
  ticket_name: string;
  quantity: number;
  unit_price: number;
  service_fee: number;
  total: number;
  discount: number;
  promo_code: string | null;
  created_at: string;
  user_id: string;
  ref_source: string;
  refunded_amount?: number;
  refunded_at?: string | null;
  status?: string;
  checked_in?: boolean;
  checked_in_at?: string | null;
  profiles?: { name: string; email: string; phone: string | null; avatar_url: string | null } | null;
}

// Gender detection via common first names
const MALE_NAMES = new Set(["hugo","isaac","james","john","robert","michael","david","william","richard","joseph","thomas","charles","christopher","daniel","matthew","anthony","mark","donald","steven","paul","andrew","joshua","kenneth","kevin","brian","george","timothy","ronald","edward","jason","jeffrey","ryan","jacob","gary","nicholas","eric","jonathan","stephen","larry","justin","scott","brandon","benjamin","samuel","raymond","gregory","frank","alexander","patrick","jack","dennis","jerry","tyler","aaron","jose","adam","nathan","henry","peter","zachary","douglas","harold","gabriel","carl","arthur","bruce","logan","albert","eugene","gerald","roger","keith","lawrence","terry","sean","jesse","austin","noah","ethan","dylan","lucas","liam","mason","aiden","elijah","oliver","owen","carter","connor","luke","caleb","hunter","isaiah","christian","landon","jordan","cameron","evan","leo","mateo","thiago","pedro","rafael","diego","bruno","felipe","gustavo","henrique","caio","vinicius","bernardo","enzo","davi","miguel","arthur","heitor","theo","murilo","pietro","luan","gabriel","lucas","guilherme","eduardo","fernando","marcelo","rodrigo","andre","fabio","sergio","paulo","carlos","marcos","jorge","antonio","luis","leandro","renato","alessandro","danilo","renan","igor","artur"]);
const FEMALE_NAMES = new Set(["mary","patricia","jennifer","linda","barbara","elizabeth","susan","jessica","sarah","karen","lisa","nancy","betty","margaret","sandra","ashley","emily","donna","michelle","dorothy","carol","amanda","melissa","deborah","stephanie","rebecca","sharon","laura","cynthia","kathleen","amy","angela","shirley","anna","brenda","pamela","emma","nicole","helen","samantha","katherine","christine","debra","rachel","carolyn","janet","catherine","maria","heather","diane","ruth","julia","olivia","grace","victoria","rose","mia","sophia","isabella","ava","charlotte","amelia","harper","abigail","ella","madison","chloe","scarlett","aria","riley","zoey","lily","eleanor","hannah","natalie","lillian","savannah","brooklyn","leah","stella","hazel","aurora","ana","juliana","larissa","camila","fernanda","beatriz","carolina","mariana","gabriela","rafaela","isabela","leticia","bruna","amanda","bianca","jessica","tatiana","vanessa","daniela","priscila","renata","aline","patricia","adriana","cristina","natalia"]);

const guessGender = (name: string): "male" | "female" | "other" => {
  const first = (name || "").trim().split(/\s+/)[0].toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (MALE_NAMES.has(first)) return "male";
  if (FEMALE_NAMES.has(first)) return "female";
  return "other";
};

const CHART_COLORS = [
  "hsl(var(--brand-pink))",
  "hsl(var(--brand-lime))",
  "hsl(210, 80%, 60%)",
  "hsl(40, 90%, 55%)",
  "hsl(280, 60%, 55%)",
  "hsl(var(--muted-foreground))",
];

const EventDashboard = () => {
  const { orgSlug, eventId } = useParams<{ orgSlug: string; eventId: string }>();
  const { user, logout, session } = useAuth();
  const navigate = useNavigate();
  const { getOrgBySlug, isPromoterForOrg, loading: orgsLoading } = useOrganizations();
  const org = getOrgBySlug(orgSlug || "");
  const isPromoterUser = org ? isPromoterForOrg(org.id) : false;
  const [promoterPermissions, setPromoterPermissions] = useState<string[]>([]);
  const [promoterEventAccess, setPromoterEventAccess] = useState<boolean | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [activeTab, setActiveTab] = useState<EventTab>("Overview");
  const isMobile = useIsMobile();
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains("dark"));
  const [event, setEvent] = useState<StoredEvent | null>(null);
  const [eventLoading, setEventLoading] = useState(true);
  const [chartPeriod, setChartPeriod] = useState<"Week" | "Month" | "Year">("Week");
  const [chartKey, setChartKey] = useState(0);
  const [selectedCustomer, setSelectedCustomer] = useState<MockCustomer | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<SelectedOrder | null>(null);
  const [showPartialRefund, setShowPartialRefund] = useState(false);
  const [partialRefundAmount, setPartialRefundAmount] = useState("");
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportColumns, setExportColumns] = useState<Set<string>>(new Set(["firstName", "lastName", "email"]));
  const [attendeeSearch, setAttendeeSearch] = useState("");
  const [showAllOrders, setShowAllOrders] = useState(false);
  const [ordersSearch, setOrdersSearch] = useState("");
  const [ticketNames, setTicketNames] = useState<string[]>(["General"]);
  const [realClicks, setRealClicks] = useState(0);
  const [realTicketsSold, setRealTicketsSold] = useState(0);
  const [dbOrders, setDbOrders] = useState<DbOrder[]>([]);
  const [ticketTypesData, setTicketTypesData] = useState<{name: string; sold: number; price: string}[]>([]);
  const [orgOrders, setOrgOrders] = useState<{user_id: string; event_id: string}[]>([]);
  const [trackingLinksData, setTrackingLinksData] = useState<{slug: string; label: string; created_by_admin: boolean}[]>([]);
  const handlePeriodChange = (p: "Week" | "Month" | "Year") => { setChartPeriod(p); setChartKey(k => k + 1); };

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
    if (!session?.user) { setIsAdmin(false); return; }
    supabase.rpc("has_role", { _user_id: session.user.id, _role: "admin" as const })
      .then(({ data }) => setIsAdmin(!!data));
  }, [session]);

  const getOrderRevenue = (order: { unit_price: number | string | null; quantity: number | null; discount?: number | string | null; refunded_amount?: number | string | null; refundedAmount?: number | string | null }) => getNetOrderRevenue(order);
  const realRevenue = useMemo(() => dbOrders.reduce((sum, order) => sum + getOrderRevenue(order), 0), [dbOrders]);
  const realConversion = realClicks > 0 ? (realTicketsSold / realClicks) * 100 : 0;

  // Computed analytics charts
  const genderData = useMemo(() => {
    const uniqueUsers = new Map<string, string>();
    dbOrders.forEach(o => {
      if (o.profiles?.name && !uniqueUsers.has(o.user_id)) uniqueUsers.set(o.user_id, o.profiles.name);
    });
    let male = 0, female = 0, other = 0;
    uniqueUsers.forEach(name => {
      const g = guessGender(name);
      if (g === "male") male++; else if (g === "female") female++; else other++;
    });
    return [
      { label: "Male", value: male, color: "hsl(var(--brand-pink))" },
      { label: "Female", value: female, color: "hsl(var(--brand-lime))" },
      { label: "Other", value: other, color: "hsl(var(--muted-foreground))" },
    ];
  }, [dbOrders]);

  const customerTypeData = useMemo(() => {
    if (!eventId) return [{ label: "New", value: 0, color: "hsl(var(--brand-pink))" }, { label: "Returning", value: 0, color: "hsl(var(--brand-lime))" }];
    const uniqueUsers = new Set(dbOrders.map(o => o.user_id));
    let newCount = 0, returningCount = 0;
    uniqueUsers.forEach(uid => {
      const hasPriorOrg = orgOrders.some(o => o.user_id === uid && o.event_id !== eventId);
      if (hasPriorOrg) returningCount++; else newCount++;
    });
    return [
      { label: "New", value: newCount, color: "hsl(var(--brand-pink))" },
      { label: "Returning", value: returningCount, color: "hsl(var(--brand-lime))" },
    ];
  }, [dbOrders, orgOrders, eventId]);

  const salesSourceData = useMemo(() => {
    const sourceMap: Record<string, number> = {};
    const builtInRefs = new Set(["direct", "explore", "instagram"]);
    const labelMap: Record<string, string> = { direct: "Event Link", explore: "Brazou", instagram: "Instagram" };
    // Build a map of main link slugs (created_by_admin) to their labels
    const mainLinkSlugs = new Map<string, string>();
    trackingLinksData.forEach(tl => {
      if (tl.created_by_admin) mainLinkSlugs.set(tl.slug, tl.label);
    });
    dbOrders.forEach(o => {
      const ref = o.ref_source || "direct";
      const revenue = getOrderRevenue(o);
      if (builtInRefs.has(ref)) {
        const label = labelMap[ref];
        sourceMap[label] = (sourceMap[label] || 0) + revenue;
      } else if (mainLinkSlugs.has(ref)) {
        // Main links shown individually by their label
        const label = mainLinkSlugs.get(ref)!;
        sourceMap[label] = (sourceMap[label] || 0) + revenue;
      } else {
        sourceMap["Tracking Links"] = (sourceMap["Tracking Links"] || 0) + revenue;
      }
    });
    const entries = Object.entries(sourceMap);
    return entries.map(([label, value], i) => ({
      label,
      value,
      color: CHART_COLORS[i % CHART_COLORS.length],
    }));
  }, [dbOrders, trackingLinksData]);

  const ticketTypeData = useMemo(() => {
    const revenueBySection = new Map<string, number>();
    dbOrders.forEach((order) => {
      const name = order.ticket_name || "Standard";
      // Extract section name from "Section X · Row Y · Seat Z" format
      const sectionMatch = name.match(/^(.+?)\s*·\s*Row/);
      const key = sectionMatch ? sectionMatch[1].trim() : name;
      revenueBySection.set(key, (revenueBySection.get(key) || 0) + getOrderRevenue(order));
    });
    return Array.from(revenueBySection.entries()).map(([label, value], i) => ({
      label,
      value,
      color: CHART_COLORS[i % CHART_COLORS.length],
    }));
  }, [dbOrders]);

  const exportColumnOptions = [
    { key: "firstName", label: "First Name" },
    { key: "lastName", label: "Last Name" },
    { key: "email", label: "Email" },
    { key: "phone", label: "Phone Number" },
    { key: "billingCity", label: "Billing Address City" },
    { key: "billingState", label: "Billing Address State" },
    { key: "billingZip", label: "Billing Address Zip" },
    { key: "instagram", label: "Instagram Tag" },
  ];

  const toggleExportColumn = (key: string) => {
    setExportColumns(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const handleExportCSV = () => {
    const cols = exportColumnOptions.filter(c => exportColumns.has(c.key));
    const header = cols.map(c => c.label).join(",");
    const rows = dbOrders.map(o => {
      const p = o.profiles;
      return cols.map(c => {
        if (c.key === "firstName") return `"${(p?.name || "").split(" ")[0]}"`;
        if (c.key === "lastName") return `"${(p?.name || "").split(" ").slice(1).join(" ")}"`;
        if (c.key === "email") return `"${p?.email || ""}"`;
        if (c.key === "phone") return `"${p?.phone || ""}"`;
        return `""`;
      }).join(",");
    });
    const csv = [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `attendees-${event?.title?.replace(/\s+/g, "-").toLowerCase() || "event"}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    setShowExportModal(false);
    toast.success("Attendee list exported!");
  };

  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDark);
  }, [isDark]);

  useEffect(() => {
    if (eventId) {
      setEventLoading(true);
      getEventById(eventId).then((found) => {
        if (found) setEvent(found);
        setEventLoading(false);
      });
    } else {
      setEventLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    if (eventId) {
      supabase.from("ticket_types").select("name, sold, price").eq("event_id", eventId).then(({ data }) => {
        if (data && data.length > 0) {
          setTicketNames(data.map(t => t.name));
          setTicketTypesData(data.map(t => ({ name: t.name, sold: t.sold || 0, price: t.price || "0" })));
          const totalSold = data.reduce((s, t) => s + (t.sold || 0), 0);
          setRealTicketsSold(totalSold);
        }
      });
      // Fetch clicks (event + explore + instagram)
      supabase.from("events").select("clicks, explore_clicks, instagram_clicks").eq("id", eventId).single().then(({ data }) => {
        if (data) setRealClicks(((data as any).clicks || 0) + ((data as any).explore_clicks || 0) + ((data as any).instagram_clicks || 0));
      });
      // Fetch real orders then attach profile info
      supabase.from("orders").select("id, ticket_name, quantity, unit_price, service_fee, total, discount, promo_code, created_at, user_id, ref_source, refunded_amount, refunded_at, status, checked_in, checked_in_at").eq("event_id", eventId).order("created_at", { ascending: false }).then(async ({ data: ordersData }) => {
        if (ordersData && ordersData.length > 0) {
          const userIds = [...new Set(ordersData.map(o => o.user_id))];
          const { data: profilesData } = await supabase.from("profiles").select("user_id, name, email, phone, avatar_url").in("user_id", userIds);
          const profileMap: Record<string, any> = {};
          (profilesData || []).forEach(p => { profileMap[p.user_id] = p; });
          const enriched = ordersData.map(o => ({ ...o, profiles: profileMap[o.user_id] || null }));
          setDbOrders(enriched as any);
        }
      });
      // Fetch tracking links for sales source chart
      supabase.from("tracking_links").select("slug, label, created_by_admin").eq("event_id", eventId).then(({ data }) => {
        setTrackingLinksData((data || []).map(d => ({ slug: d.slug, label: d.label, created_by_admin: d.created_by_admin })));
      });
    }
  }, [eventId]);

  // Realtime: listen for order updates (e.g. ticket scans from mobile app)
  useEffect(() => {
    if (!eventId) return;
    const channel = supabase
      .channel(`orders-event-${eventId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'orders', filter: `event_id=eq.${eventId}` },
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
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [eventId]);

  // Fetch all org orders for new vs returning detection
  useEffect(() => {
    if (org?.id) {
      supabase.from("events").select("id").eq("organization_id", org.id).then(async ({ data: orgEvents }) => {
        if (orgEvents && orgEvents.length > 0) {
          const eventIds = orgEvents.map(e => e.id);
          const { data } = await supabase.from("orders").select("user_id, event_id").in("event_id", eventIds);
          setOrgOrders(data || []);
        }
      });
    }
  }, [org?.id]);

  // Fetch promoter permissions
  useEffect(() => {
    if (!isPromoterUser || !session?.user?.id || !eventId) {
      if (isPromoterUser) setPromoterEventAccess(false);
      return;
    }
    (async () => {
      const { data } = await supabase
        .from("team_invitations")
        .select("permissions")
        .eq("accepted_by", session.user.id)
        .eq("event_id", eventId)
        .eq("status", "accepted")
        .limit(1)
        .maybeSingle();
      if (data) {
        setPromoterEventAccess(true);
        setPromoterPermissions(Array.isArray(data.permissions) ? data.permissions as string[] : []);
      } else {
        setPromoterEventAccess(false);
      }
    })();
  }, [isPromoterUser, session?.user?.id, eventId]);

  if (!user) { navigate("/auth"); return null; }
  if (eventLoading || orgsLoading || (isPromoterUser && promoterEventAccess === null)) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[hsl(var(--brand-pink))] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (!event) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-4xl mb-4">📊</p>
          <h1 className="text-2xl font-black text-foreground mb-2">Event not found</h1>
          <Link to={`/dashboard/${orgSlug}`} className="text-primary font-bold text-sm underline">Back to dashboard</Link>
        </div>
      </div>
    );
  }

  if (isPromoterUser && promoterEventAccess === false) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-4xl mb-4">🔒</p>
          <h1 className="text-2xl font-black text-foreground mb-2">Access Denied</h1>
          <p className="text-muted-foreground mb-4">You are not a team member for this event.</p>
          <Link to={`/dashboard/${orgSlug}`} className="text-primary font-bold text-sm underline">Back to dashboard</Link>
        </div>
      </div>
    );
  }

  if (isPromoterUser && promoterEventAccess) {
    return <PromoterEventDashboard event={event} orgSlug={orgSlug || ""} permissions={promoterPermissions} />;
  }

const parseTimeToHHMM = (timeStr: string): string => {
  const match = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
  if (!match) return "23:59";
  let hours = parseInt(match[1], 10);
  const minutes = match[2];
  const period = match[3]?.toUpperCase();
  if (period === "PM" && hours < 12) hours += 12;
  if (period === "AM" && hours === 12) hours = 0;
  return `${String(hours).padStart(2, "0")}:${minutes}`;
};


  const getInitials = (name: string) =>
    name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      {/* Sidebar */}
      <aside className="hidden lg:flex w-64 fixed left-0 top-0 h-screen border-r border-border bg-background z-50 flex-col p-6 gap-8">
        <div className="flex flex-col gap-1">
          <button onClick={() => navigate(`/dashboard/${orgSlug}`)} className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors font-bold mb-3">
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Org
          </button>
          <div className="flex items-center gap-3">
            {event.flyer ? (
              <img src={event.flyer} alt="" className="w-9 h-9 rounded-xl object-cover border border-border" />
            ) : (
              <div className="w-9 h-9 rounded-xl bg-secondary flex items-center justify-center text-sm font-black text-muted-foreground border border-border">
                {event.title?.[0] || "E"}
              </div>
            )}
            <div className="min-w-0">
              <p className="text-sm font-black text-foreground truncate">{event.title || "Untitled Event"}</p>
              <span className="text-[10px] opacity-50 tracking-widest uppercase font-bold">Event Dashboard</span>
            </div>
          </div>
        </div>

        <nav className="flex flex-col gap-1.5">
          {tabs.map((item) => (
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
      </aside>

      {/* Main Content */}
      <main className="lg:ml-64 flex-1 min-h-screen">
        {/* Top Nav */}
        <header className="sticky top-0 z-40 bg-background/60 backdrop-blur-xl flex justify-between items-center px-4 md:px-8 h-16 md:h-20 border-b border-border">
          <div className="flex items-center gap-4 flex-1">
            <Link to={`/dashboard/${orgSlug}`} className="lg:hidden text-muted-foreground hover:text-foreground transition-colors mr-2">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="relative w-full max-w-md hidden lg:block">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search orders, attendees..."
                className="w-full bg-secondary border-none rounded-full py-2.5 pl-12 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--brand-pink))] transition-all placeholder:text-muted-foreground"
              />
            </div>
          </div>
          <div className="flex items-center gap-6 font-medium">
            <div className="flex items-center gap-4 text-muted-foreground">
              <Bell className="w-5 h-5 cursor-pointer hover:text-[hsl(var(--brand-pink))] transition-colors" />
              <button onClick={() => setIsDark(!isDark)} className="text-muted-foreground cursor-pointer hover:text-[hsl(var(--brand-pink))] transition-colors">
                {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </button>
            </div>
            <div className="h-8 w-px bg-border" />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-3 group cursor-pointer focus:outline-none">
                  <div className="text-right hidden sm:block">
                    <p className="text-sm font-bold">{user.name}</p>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Organizer</p>
                  </div>
                  <Avatar className="w-10 h-10 border-2 border-[hsl(var(--brand-pink))]/20 group-hover:border-[hsl(var(--brand-pink))] transition-colors cursor-pointer">
                    <AvatarImage src={user.avatarUrl || ""} alt={user.name} />
                    <AvatarFallback className="bg-secondary text-foreground font-black text-sm">{getInitials(user.name)}</AvatarFallback>
                  </Avatar>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 rounded-xl border-border bg-surface shadow-xl">
                <div className="px-3 py-3">
                  <p className="text-sm font-bold text-foreground truncate">{user.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                </div>
                <DropdownMenuSeparator className="bg-border" />
                <DropdownMenuLabel className="text-[11px] uppercase tracking-widest text-muted-foreground font-bold px-3 py-1.5">
                  As Organizer
                </DropdownMenuLabel>
                <DropdownMenuItem onClick={() => navigate(`/dashboard/${orgSlug}`)} className="gap-3 px-3 py-2.5 cursor-pointer rounded-lg mx-1 focus:bg-secondary">
                  <Building2 className="w-4 h-4 text-muted-foreground" />
                  <span className="font-medium">Org Dashboard</span>
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
        <div className="lg:hidden overflow-x-auto border-b border-border bg-background sticky top-16 z-30">
          <div className="flex px-4 gap-1 min-w-max">
            {tabs.map((item) => (
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

        {/* Content */}
        <div className="px-4 md:px-8 py-8 space-y-8">
          {/* Header */}
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-3xl md:text-4xl font-black tracking-tighter text-foreground mb-1">
                {event.title || "Untitled Event"}
              </h1>
              <p className="text-muted-foreground text-sm">
                {event.date ? `${event.month} ${event.date}, ${event.year}` : "No date set"} · {event.venue || "No venue"}
              </p>
            </div>
            {activeTab === "Overview" && (
              <div className="flex items-center gap-3 flex-shrink-0">
                {event.status === "Draft" && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="outline"
                        className="gap-2 rounded-full font-bold text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Trash2 className="w-4 h-4" />
                        Delete
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent className="rounded-3xl">
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete this event?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will permanently delete <strong>{event.title || "this event"}</strong> and all its tickets, promo codes, and comp tickets. This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel className="rounded-full">Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          className="rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          onClick={async () => {
                            try {
                              await deleteEvent(event.id);
                              toast.success("Event deleted");
                              navigate(`/dashboard/${orgSlug}`);
                            } catch (err) {
                              toast.error("Failed to delete event");
                            }
                          }}
                        >
                          Delete Event
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
                <Button
                  variant="outline"
                  onClick={() => navigate(`/dashboard/${orgSlug}/edit-event/${event.id}`)}
                  className="gap-2 rounded-full font-bold"
                >
                  <Pencil className="w-4 h-4" />
                  Edit Event
                </Button>
                {event.status === "Live" ? (
                  <Button
                    onClick={() => navigate(`/event/${event.id}`)}
                    className="gap-2 rounded-full font-bold bg-[hsl(var(--brand-lime))] text-[#000000] hover:bg-[hsl(var(--brand-lime))]/90"
                  >
                    <ExternalLink className="w-4 h-4" />
                    View Event Page
                  </Button>
                ) : (
                  <Button
                    onClick={async () => {
                      try {
                        const updated = { ...event, status: "Live" as const };
                        await saveEvent(updated);
                        setEvent(updated);
                        toast.success("Event is now live! 🚀");
                      } catch (err) {
                        toast.error("Failed to launch event");
                      }
                    }}
                    className="gap-2 rounded-full font-bold bg-primary text-primary-foreground"
                  >
                    <Rocket className="w-4 h-4" />
                    Launch Event
                  </Button>
                )}
              </div>
            )}
          </div>

          {activeTab === "Overview" && (
            <>
              {/* Metrics */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                  { label: "Revenue", value: realRevenue, prefix: "$", suffix: "", decimals: 2, change: "0%", icon: <TrendingUp className="w-4 h-4" /> },
                  { label: "Total Clicks", value: realClicks, prefix: "", suffix: "", decimals: 0, change: "0%", icon: <MousePointerClick className="w-4 h-4" /> },
                  { label: "Tickets Sold", value: realTicketsSold, prefix: "", suffix: "", decimals: 0, change: "0%", icon: <Ticket className="w-4 h-4" /> },
                  { label: "Conversion", value: realConversion, prefix: "", suffix: "%", decimals: 1, change: "0%", icon: <PercentCircle className="w-4 h-4" /> },
                ].map((m) => (
                  <div key={m.label} className="p-6 bg-card rounded-3xl border border-border hover:shadow-lg hover:shadow-[hsl(var(--brand-pink))]/5 transition-all">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-muted-foreground">{m.icon}</span>
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">{m.label}</p>
                    </div>
                    <div className="flex items-end gap-2">
                      <h2 className="text-3xl font-black text-foreground">
                        <AnimatedNumber value={m.value} prefix={m.prefix} suffix={m.suffix} decimals={m.decimals} />
                      </h2>
                      <span className="text-[hsl(var(--brand-lime))] text-xs font-bold mb-1">{m.change}</span>
                    </div>
                  </div>
                ))}
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
                <div className="flex items-center gap-6 mb-6">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-[3px] rounded-full bg-[hsl(343,94%,55%)]" />
                    <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Revenue</span>
                  </div>
                </div>
                {(() => {
                  const now = new Date();
                  // Compute event end datetime
                  const monthIdx = (m: string) => ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"].indexOf(m.toUpperCase());
                  const buildEndRef = () => {
                    const endDateStr = event.endDate && event.endMonth && event.endYear
                      ? `${event.endYear}-${String(monthIdx(event.endMonth) + 1).padStart(2, "0")}-${String(event.endDate).padStart(2, "0")}`
                      : event.date && event.month && event.year
                        ? `${event.year}-${String(monthIdx(event.month) + 1).padStart(2, "0")}-${String(event.date).padStart(2, "0")}`
                        : null;
                    if (!endDateStr) return now;
                    // doors = end_time e.g. "3:00 AM"
                    const endTime = event.doors || "23:59";
                    const endDt = new Date(`${endDateStr}T${parseTimeToHHMM(endTime)}`);
                    return isNaN(endDt.getTime()) ? now : endDt;
                  };
                  const eventEndRef = buildEndRef();
                  // Cap at now if event hasn't ended yet
                  const chartEnd = eventEndRef < now ? eventEndRef : now;

                  let bucketCount: number;
                  let labels: string[];
                  let pointLabels: string[];
                  let getBucket: (date: Date) => number;
                  if (chartPeriod === "Week") {
                    bucketCount = 7;
                    labels = Array.from({ length: 7 }, (_, i) => { const d = new Date(chartEnd); d.setDate(d.getDate() - (6 - i)); return d.toLocaleDateString('default', { weekday: 'short' }); });
                    pointLabels = Array.from({ length: 7 }, (_, i) => { const d = new Date(chartEnd); d.setDate(d.getDate() - (6 - i)); return d.toLocaleDateString('default', { weekday: 'long', month: 'short', day: 'numeric' }); });
                    getBucket = (date: Date) => {
                      const diff = Math.floor((chartEnd.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
                      return diff >= 0 && diff < 7 ? 6 - diff : -1;
                    };
                  } else if (chartPeriod === "Month") {
                    bucketCount = 30;
                    labels = Array.from({ length: 6 }, (_, i) => { const d = new Date(chartEnd); d.setDate(d.getDate() - 30 + Math.round(i * 6)); return d.toLocaleDateString('default', { month: 'short', day: 'numeric' }); });
                    pointLabels = Array.from({ length: 30 }, (_, i) => { const d = new Date(chartEnd); d.setDate(d.getDate() - (29 - i)); return d.toLocaleDateString('default', { month: 'long', day: 'numeric' }); });
                    getBucket = (date: Date) => {
                      const diff = Math.floor((chartEnd.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
                      return diff >= 0 && diff < 30 ? 29 - diff : -1;
                    };
                  } else {
                    bucketCount = 12;
                    labels = Array.from({ length: 12 }, (_, i) => { const d = new Date(chartEnd.getFullYear(), chartEnd.getMonth() - (11 - i), 1); return d.toLocaleDateString('default', { month: 'short' }); });
                    pointLabels = Array.from({ length: 12 }, (_, i) => { const d = new Date(chartEnd.getFullYear(), chartEnd.getMonth() - (11 - i), 1); return d.toLocaleDateString('default', { month: 'long', year: 'numeric' }); });
                    getBucket = (date: Date) => {
                      const monthDiff = (chartEnd.getFullYear() - date.getFullYear()) * 12 + (chartEnd.getMonth() - date.getMonth());
                      return monthDiff >= 0 && monthDiff < 12 ? 11 - monthDiff : -1;
                    };
                  }
                  const revenueData = new Array(bucketCount).fill(0);
                  dbOrders.forEach(o => {
                    const orderDate = new Date(o.created_at);
                    const bucket = getBucket(orderDate);
                    if (bucket >= 0) {
                      revenueData[bucket] += getOrderRevenue(o);
                    }
                  });
                  const maxVal = Math.max(...revenueData, 1);
                  const n = revenueData.length;
                  const toPath = (data: number[], maxV: number) => {
                    const points = data.map((v, i) => ({ x: (i / (n - 1)) * 1000, y: 280 - (v / maxV) * 260 }));
                    let d = `M${points[0].x},${points[0].y}`;
                    for (let i = 1; i < points.length; i++) {
                      const cp1x = points[i - 1].x + (points[i].x - points[i - 1].x) / 3;
                      const cp2x = points[i].x - (points[i].x - points[i - 1].x) / 3;
                      d += ` C${cp1x},${points[i - 1].y} ${cp2x},${points[i].y} ${points[i].x},${points[i].y}`;
                    }
                    return d;
                  };
                  const revenuePath = toPath(revenueData, maxVal);
                  const points = revenueData.map((v, i) => ({
                    x: (i / (n - 1)) * 1000,
                    y: 280 - (v / maxVal) * 260,
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
                        {[0, 1, 2, 3, 4].map((i) => (<div key={i} className="border-b border-border/50 w-full h-0" />))}
                      </div>
                      <svg className="absolute inset-0 h-full w-full" preserveAspectRatio="none" viewBox="0 0 1000 300">
                        <defs>
                          <linearGradient id="ev-grad-pink" x1="0%" y1="0%" x2="0%" y2="100%">
                            <stop offset="0%" style={{ stopColor: "hsl(343, 94%, 55%)", stopOpacity: 0.3 }} />
                            <stop offset="100%" style={{ stopColor: "hsl(343, 94%, 55%)", stopOpacity: 0 }} />
                          </linearGradient>
                        </defs>
                        <path d={`${revenuePath} V300 H0 Z`} fill="url(#ev-grad-pink)" />
                        <path d={revenuePath} fill="none" stroke="hsl(343, 94%, 55%)" strokeWidth="4" strokeLinecap="round" style={{ strokeDasharray: 2500, strokeDashoffset: 2500, animation: 'ev-chart-draw 1.5s ease-out 0.4s forwards' }} />
                      </svg>
                      {/* Hover vertical line */}
                      <div data-chart-line className="absolute top-0 bottom-0 w-px bg-foreground/20 pointer-events-none transition-opacity duration-150" style={{ opacity: 0 }} />
                      {/* Hover dot */}
                      <div data-chart-dot className="absolute w-[10px] h-[10px] rounded-full bg-[hsl(343,94%,55%)] border-2 border-background pointer-events-none transition-opacity duration-150 shadow-md" style={{ opacity: 0 }} />
                      {/* Hover tooltip */}
                      <div data-chart-tooltip className="absolute pointer-events-none -translate-x-1/2 bg-foreground text-background px-3 py-2 rounded-xl text-center whitespace-nowrap transition-opacity duration-150 shadow-lg z-10" style={{ opacity: 0 }} />
                      <style>{`@keyframes ev-chart-draw { to { stroke-dashoffset: 0; } }`}</style>
                    </div>
                  );
                })()}
                <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  {(() => {
                    const now2 = new Date();
                    const monthIdx2 = (m: string) => ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"].indexOf(m.toUpperCase());
                    const buildEndRef2 = () => {
                      const endDateStr = event.endDate && event.endMonth && event.endYear
                        ? `${event.endYear}-${String(monthIdx2(event.endMonth) + 1).padStart(2, "0")}-${String(event.endDate).padStart(2, "0")}`
                        : event.date && event.month && event.year
                          ? `${event.year}-${String(monthIdx2(event.month) + 1).padStart(2, "0")}-${String(event.date).padStart(2, "0")}`
                          : null;
                      if (!endDateStr) return now2;
                      const endTime = event.doors || "23:59";
                      const endDt = new Date(`${endDateStr}T${parseTimeToHHMM(endTime)}`);
                      return isNaN(endDt.getTime()) ? now2 : endDt;
                    };
                    const eventEndRef2 = buildEndRef2();
                    const chartEnd2 = eventEndRef2 < now2 ? eventEndRef2 : now2;
                    if (chartPeriod === "Week") {
                      return Array.from({ length: 7 }, (_, i) => { const d = new Date(chartEnd2); d.setDate(d.getDate() - (6 - i)); return <span key={i}>{d.toLocaleDateString('default', { weekday: 'short' })}</span>; });
                    } else if (chartPeriod === "Month") {
                      return Array.from({ length: 6 }, (_, i) => { const d = new Date(chartEnd2); d.setDate(d.getDate() - 30 + Math.round(i * 6)); return <span key={i}>{d.toLocaleDateString('default', { month: 'short', day: 'numeric' })}</span>; });
                    } else {
                      return Array.from({ length: 12 }, (_, i) => { const d = new Date(chartEnd2.getFullYear(), chartEnd2.getMonth() - (11 - i), 1); return <span key={i}>{d.toLocaleDateString('default', { month: 'short' })}</span>; });
                    }
                  })()}
                </div>
              </div>

              {/* Recent Orders */}
              <div className="bg-card rounded-3xl border border-border overflow-hidden">
                <div className="px-6 py-5 border-b border-border">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-black tracking-tight">{showAllOrders ? "All Orders" : "Recent Orders"}</h2>
                    <div className="flex items-center gap-3">
                      {showAllOrders && (
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                          <input
                            type="text"
                            placeholder="Search orders..."
                            value={ordersSearch}
                            onChange={(e) => setOrdersSearch(e.target.value)}
                            className="pl-8 pr-3 py-1.5 bg-secondary border border-border rounded-full text-xs font-medium text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[hsl(var(--brand-pink))] w-48"
                          />
                        </div>
                      )}
                      <button
                        onClick={() => { setShowAllOrders(!showAllOrders); setOrdersSearch(""); }}
                        className="text-xs font-bold uppercase tracking-widest text-muted-foreground hover:text-[hsl(var(--brand-pink))] transition-colors"
                      >
                        {showAllOrders ? "Show Less" : "See All"}
                      </button>
                    </div>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-muted-foreground">
                        <th className="text-left px-6 py-3 font-bold text-[10px] uppercase tracking-[0.15em]">Order</th>
                        <th className="text-left px-6 py-3 font-bold text-[10px] uppercase tracking-[0.15em]">Customer</th>
                        <th className="text-left px-6 py-3 font-bold text-[10px] uppercase tracking-[0.15em]">Ticket</th>
                        <th className="text-left px-6 py-3 font-bold text-[10px] uppercase tracking-[0.15em]">Qty</th>
                        <th className="text-left px-6 py-3 font-bold text-[10px] uppercase tracking-[0.15em]">Total</th>
                        <th className="text-left px-6 py-3 font-bold text-[10px] uppercase tracking-[0.15em]">Date</th>
                        <th className="text-left px-6 py-3 font-bold text-[10px] uppercase tracking-[0.15em]">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(showAllOrders
                        ? dbOrders.filter((o) => {
                            if (!ordersSearch) return true;
                            const q = ordersSearch.toLowerCase();
                            const name = o.profiles?.name?.toLowerCase() || "";
                            const email = o.profiles?.email?.toLowerCase() || "";
                            return o.id.toLowerCase().includes(q) || name.includes(q) || email.includes(q) || o.ticket_name.toLowerCase().includes(q);
                          })
                        : dbOrders.slice(0, 10)
                      ).map((o) => {
                        const p = o.profiles;
                        const customerName = p?.name || "Unknown";
                        const orderDate = new Date(o.created_at).toLocaleDateString();
                        const totalAmount = Number(o.total);
                        const discountNum = Number(o.discount || 0);
                        const unitPriceNum = Number(o.unit_price);
                        const pricing = resolveOrderPricing({
                          unitPrice: unitPriceNum,
                          quantity: o.quantity,
                          discount: discountNum,
                          total: totalAmount,
                        });
                        const totalStr = `$${pricing.subtotalAfterPromo.toFixed(2)}`;
                        return (
                        <tr key={o.id} className="border-b border-border last:border-0 hover:bg-secondary/50 transition-colors">
                          <td className="px-6 py-4 font-bold text-foreground">
                            <button
                              onClick={() => setSelectedOrder({
                                id: o.id,
                                orderId: o.id.slice(0, 8),
                                event: event?.title || "",
                                ticket: o.ticket_name,
                                qty: o.quantity,
                                total: `$${pricing.totalPaid.toFixed(2)}`,
                                totalAmount: pricing.totalPaid,
                                unitPrice: unitPriceNum,
                                serviceFee: pricing.serviceFee,
                                discount: discountNum,
                                promoCode: o.promo_code || null,
                                date: orderDate,
                                refunded: isOrderRefunded(o),
                                refundedAmount: Number(o.refunded_amount || 0),
                                refundedAt: o.refunded_at || null,
                                status: o.status,
                                customerName,
                              })}
                              className="hover:text-[hsl(var(--brand-pink))] hover:underline transition-colors cursor-pointer"
                            >
                              #{o.id.slice(0,8)}
                            </button>
                          </td>
                          <td className="px-6 py-4 font-medium">
                            <button
                              onClick={async () => {
                                // Fetch ALL orders for this user across the organization
                                const orgEventIds = orgOrders.map(oo => oo.event_id);
                                const uniqueEventIds = [...new Set(orgEventIds)];
                                const { data: allUserOrgOrders } = await supabase
                                  .from("orders")
                                  .select("*, events!inner(title)")
                                  .eq("user_id", o.user_id)
                                  .in("event_id", uniqueEventIds.length > 0 ? uniqueEventIds : [eventId]);
                                const userOrgOrders = allUserOrgOrders || [];
                                const userTotal = userOrgOrders.reduce((s, uo) => {
                                  const pricing = resolveOrderPricing({
                                    unitPrice: Number(uo.unit_price),
                                    quantity: uo.quantity,
                                    discount: Number(uo.discount || 0),
                                    total: Number(uo.total),
                                  });
                                  return s + Math.max(0, pricing.totalPaid - Number(uo.refunded_amount || 0));
                                }, 0);
                                const allOrders = userOrgOrders.map((uo: any) => {
                                  const orderUnitPrice = Number(uo.unit_price);
                                  const orderDiscount = Number(uo.discount || 0);
                                  const pricing = resolveOrderPricing({
                                    unitPrice: orderUnitPrice,
                                    quantity: uo.quantity,
                                    discount: orderDiscount,
                                    total: Number(uo.total),
                                  });
                                  return {
                                    id: uo.id,
                                    orderId: uo.id.slice(0, 8),
                                    event: uo.events?.title || event?.title || "",
                                    ticket: uo.ticket_name,
                                    qty: uo.quantity,
                                    total: `$${pricing.totalPaid.toFixed(2)}`,
                                    totalAmount: pricing.totalPaid,
                                    unitPrice: orderUnitPrice,
                                    serviceFee: pricing.serviceFee,
                                    discount: orderDiscount,
                                    promoCode: uo.promo_code || null,
                                    refundedAmount: Number(uo.refunded_amount || 0),
                                    refundedAt: uo.refunded_at || null,
                                    status: uo.status,
                                    date: new Date(uo.created_at).toLocaleDateString() + ' ' + new Date(uo.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                                  };
                                });
                                const userOrgEvents = new Set(userOrgOrders.map((uo: any) => uo.event_id));
                                const { data: isBlocked } = await supabase.rpc("is_user_blocked_by_org" as any, { _user_id: o.user_id, _org_id: org?.id });
                                setSelectedCustomer({ userId: o.user_id, name: customerName, email: p?.email || "", phone: p?.phone || "", instagram: "", avatarUrl: p?.avatar_url || "", eventsAttended: userOrgEvents.size || 1, totalSpent: `$${userTotal.toFixed(2)}`, orders: allOrders, isBlocked: !!isBlocked });
                              }}
                              className="hover:text-[hsl(var(--brand-pink))] hover:underline transition-colors cursor-pointer"
                            >
                              {customerName}
                            </button>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                              o.ticket_name === "VIP"
                                ? "bg-[hsl(var(--brand-pink))]/10 text-[hsl(var(--brand-pink))]"
                                : "bg-secondary text-muted-foreground"
                            }`}>
                              {o.ticket_name}
                            </span>
                          </td>
                          <td className="px-6 py-4 font-medium">{o.quantity}</td>
                          <td className="px-6 py-4 font-bold text-foreground">{totalStr}</td>
                          <td className="px-6 py-4 text-muted-foreground">{orderDate}</td>
                          <td className="px-6 py-4">
                            {o.status === "refunded" ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest bg-red-500/20 text-red-400">Refunded</span>
                            ) : o.status === "disputed" ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest bg-yellow-500/20 text-yellow-400">Disputed</span>
                            ) : o.checked_in ? (
                              <div>
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest bg-green-500/20 text-green-400">Scanned</span>
                                {o.checked_in_at && (
                                  <p className="text-[9px] text-muted-foreground mt-1">
                                    {new Date(o.checked_in_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })} {new Date(o.checked_in_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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
              </div>

              {/* Analytics Donut Charts */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">
                <div className="bg-card rounded-3xl border border-border p-3 md:p-6 flex flex-col items-center">
                  <h3 className="text-[10px] md:text-xs font-black uppercase tracking-[0.15em] text-muted-foreground mb-2 md:mb-4">Gender Ratio</h3>
                  <DonutChart data={genderData} size={isMobile ? 100 : 160} thickness={isMobile ? 16 : 24} centerLabel="Total" isCurrency={false} />
                </div>
                <div className="bg-card rounded-3xl border border-border p-3 md:p-6 flex flex-col items-center">
                  <h3 className="text-[10px] md:text-xs font-black uppercase tracking-[0.15em] text-muted-foreground mb-2 md:mb-4">New vs Returning</h3>
                  <DonutChart data={customerTypeData} size={isMobile ? 100 : 160} thickness={isMobile ? 16 : 24} centerLabel="Customers" isCurrency={false} />
                </div>
                <div className="bg-card rounded-3xl border border-border p-3 md:p-6 flex flex-col items-center">
                  <h3 className="text-[10px] md:text-xs font-black uppercase tracking-[0.15em] text-muted-foreground mb-2 md:mb-4">Sales Source</h3>
                  <DonutChart data={salesSourceData} size={isMobile ? 100 : 160} thickness={isMobile ? 16 : 24} centerLabel="Revenue" />
                </div>
                <div className="bg-card rounded-3xl border border-border p-3 md:p-6 flex flex-col items-center">
                  <h3 className="text-[10px] md:text-xs font-black uppercase tracking-[0.15em] text-muted-foreground mb-2 md:mb-4">Ticket Types</h3>
                  <DonutChart data={ticketTypeData} size={isMobile ? 100 : 160} thickness={isMobile ? 16 : 24} centerLabel="Revenue" />
                </div>
              </div>
            </>
          )}

          {activeTab === "Tickets" && (
            <EventTicketsTab event={event} onEventUpdate={(e) => setEvent(e)} />
          )}

          {activeTab === "Attendees" && (() => {
            // Deduplicate attendees by user_id
            const attendeeMap = new Map<string, { userId: string; profile: DbOrder["profiles"]; orders: DbOrder[]; totalSpent: number; firstPurchase: string }>();
            dbOrders.forEach(o => {
                const pricing = resolveOrderPricing({
                  unitPrice: Number(o.unit_price),
                  quantity: o.quantity,
                  discount: Number(o.discount || 0),
                  total: Number(o.total),
                });
              const existing = attendeeMap.get(o.user_id);
              if (existing) {
                existing.orders.push(o);
                  existing.totalSpent += pricing.totalPaid;
                if (o.created_at < existing.firstPurchase) existing.firstPurchase = o.created_at;
              } else {
                  attendeeMap.set(o.user_id, { userId: o.user_id, profile: o.profiles, orders: [o], totalSpent: pricing.totalPaid, firstPurchase: o.created_at });
              }
            });
            const uniqueAttendees = Array.from(attendeeMap.values());
            const filteredAttendees = uniqueAttendees.filter(a => {
              if (!attendeeSearch) return true;
              const q = attendeeSearch.toLowerCase();
              const name = a.profile?.name || "";
              const email = a.profile?.email || "";
              return name.toLowerCase().includes(q) || email.toLowerCase().includes(q);
            });
            const openCustomerDetail = async (a: typeof uniqueAttendees[0]) => {
              const name = a.profile?.name || "Unknown";
              // Fetch ALL orders for this user across the organization
              const orgEventIds = orgOrders.map(oo => oo.event_id);
              const uniqueEventIds = [...new Set(orgEventIds)];
              const { data: allUserOrgOrders } = await supabase
                .from("orders")
                .select("*, events!inner(title)")
                .eq("user_id", a.userId)
                .in("event_id", uniqueEventIds.length > 0 ? uniqueEventIds : [eventId]);
              const userOrgOrders = allUserOrgOrders || [];
              const userTotal = userOrgOrders.reduce((s, uo) => {
                const pricing = resolveOrderPricing({
                  unitPrice: Number(uo.unit_price),
                  quantity: uo.quantity,
                  discount: Number(uo.discount || 0),
                  total: Number(uo.total),
                });
                return s + Math.max(0, pricing.totalPaid - Number(uo.refunded_amount || 0));
              }, 0);
              const allOrders = userOrgOrders.map((uo: any) => {
                const orderUnitPrice = Number(uo.unit_price);
                const orderDiscount = Number(uo.discount || 0);
                const pricing = resolveOrderPricing({
                  unitPrice: orderUnitPrice,
                  quantity: uo.quantity,
                  discount: orderDiscount,
                  total: Number(uo.total),
                });
                return {
                  id: uo.id,
                  orderId: uo.id.slice(0, 8),
                  event: uo.events?.title || event?.title || "",
                  ticket: uo.ticket_name,
                  qty: uo.quantity,
                  total: `$${pricing.totalPaid.toFixed(2)}`,
                  totalAmount: pricing.totalPaid,
                  unitPrice: orderUnitPrice,
                  serviceFee: pricing.serviceFee,
                  discount: orderDiscount,
                  promoCode: uo.promo_code || null,
                  refundedAmount: Number(uo.refunded_amount || 0),
                  refundedAt: uo.refunded_at || null,
                  status: uo.status,
                  date: new Date(uo.created_at).toLocaleDateString() + ' ' + new Date(uo.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                };
              });
              const userOrgEvents = new Set(userOrgOrders.map((uo: any) => uo.event_id));
              const { data: isBlocked } = await supabase.rpc("is_user_blocked_by_org" as any, { _user_id: a.userId, _org_id: org?.id });
              setSelectedCustomer({
                userId: a.userId,
                name,
                email: a.profile?.email || "",
                phone: a.profile?.phone || "",
                instagram: "",
                avatarUrl: a.profile?.avatar_url || "",
                eventsAttended: userOrgEvents.size || 1,
                totalSpent: `$${userTotal.toFixed(2)}`,
                orders: allOrders,
                isBlocked: !!isBlocked,
              });
            };
            return (
            <>
              <div className="bg-card rounded-3xl border border-border overflow-hidden">
                <div className="px-6 py-5 border-b border-border flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div>
                    <h2 className="text-lg font-black tracking-tight">Attendees</h2>
                    <p className="text-xs text-muted-foreground mt-0.5">{uniqueAttendees.length} attendees for this event</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                      <input
                        type="text"
                        placeholder="Search attendees..."
                        value={attendeeSearch}
                        onChange={(e) => setAttendeeSearch(e.target.value)}
                        className="bg-secondary border-none rounded-full py-2 pl-9 pr-4 text-sm w-56 focus:outline-none focus:ring-2 focus:ring-[hsl(var(--brand-pink))] transition-all placeholder:text-muted-foreground"
                      />
                    </div>
                    <Button onClick={() => setShowExportModal(true)} className="gap-2 rounded-full font-bold bg-[hsl(var(--brand-pink))] text-primary-foreground hover:bg-[hsl(var(--brand-pink))]/90">
                      <Download className="w-4 h-4" />
                      Export
                    </Button>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-muted-foreground">
                        <th className="text-left px-6 py-3 font-bold text-[10px] uppercase tracking-[0.15em]">Attendee</th>
                        <th className="text-left px-6 py-3 font-bold text-[10px] uppercase tracking-[0.15em]">Email</th>
                        <th className="text-left px-6 py-3 font-bold text-[10px] uppercase tracking-[0.15em]">Orders</th>
                        <th className="text-left px-6 py-3 font-bold text-[10px] uppercase tracking-[0.15em]">Total Spent</th>
                        <th className="text-left px-6 py-3 font-bold text-[10px] uppercase tracking-[0.15em]">Order Date</th>
                        <th className="text-left px-6 py-3 font-bold text-[10px] uppercase tracking-[0.15em]">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredAttendees.map((a) => {
                          const p = a.profile;
                          const name = p?.name || "Unknown";
                          const initials = name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0,2);
                          return (
                        <tr key={a.userId} className="border-b border-border last:border-0 hover:bg-secondary/50 transition-colors">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <Avatar className="w-9 h-9 border border-border">
                                {p?.avatar_url && <AvatarImage src={p.avatar_url} />}
                                <AvatarFallback className="bg-secondary text-foreground font-bold text-xs">
                                  {initials}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <button
                                  onClick={() => openCustomerDetail(a)}
                                  className="font-bold text-foreground hover:text-[hsl(var(--brand-pink))] hover:underline transition-colors cursor-pointer text-left"
                                >
                                  {name}
                                </button>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-muted-foreground">{p?.email}</td>
                          <td className="px-6 py-4 font-medium">{a.orders.length}</td>
                          <td className="px-6 py-4 font-bold text-foreground">${a.totalSpent.toFixed(2)}</td>
                          <td className="px-6 py-4 text-muted-foreground">{new Date(a.firstPurchase).toLocaleDateString()} {new Date(a.firstPurchase).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                          <td className="px-6 py-4">
                            {(() => {
                              const scannedOrder = a.orders.find(o => o.checked_in);
                              const refundedOrder = a.orders.find(o => o.status === "refunded");
                              if (refundedOrder) return <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest bg-red-500/20 text-red-400">Refunded</span>;
                              if (scannedOrder) return (
                                <div>
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest bg-green-500/20 text-green-400">Scanned</span>
                                  {scannedOrder.checked_in_at && (
                                    <p className="text-[9px] text-muted-foreground mt-1">
                                      {new Date(scannedOrder.checked_in_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })} {new Date(scannedOrder.checked_in_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </p>
                                  )}
                                </div>
                              );
                              return <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest bg-secondary text-muted-foreground">Completed</span>;
                            })()}
                          </td>
                        </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Export Column Selection Modal */}
              <Dialog open={showExportModal} onOpenChange={setShowExportModal}>
                <DialogContent className="sm:max-w-md rounded-3xl">
                  <DialogHeader>
                    <DialogTitle className="text-lg font-black tracking-tight">Export Attendees</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <p className="text-sm text-muted-foreground">Select which columns to include in your export:</p>
                    <div className="space-y-3">
                      {exportColumnOptions.map((col) => (
                        <label key={col.key} className="flex items-center gap-3 cursor-pointer group">
                          <Checkbox
                            checked={exportColumns.has(col.key)}
                            onCheckedChange={() => toggleExportColumn(col.key)}
                          />
                          <span className="text-sm font-medium text-foreground group-hover:text-[hsl(var(--brand-pink))] transition-colors">{col.label}</span>
                        </label>
                      ))}
                    </div>
                    <div className="flex gap-2 pt-2">
                      <Button variant="ghost" className="flex-1 rounded-full" onClick={() => setShowExportModal(false)}>
                        Cancel
                      </Button>
                      <Button
                        className="flex-1 rounded-full font-bold bg-[hsl(var(--brand-pink))] text-primary-foreground hover:bg-[hsl(var(--brand-pink))]/90 gap-2"
                        disabled={exportColumns.size === 0}
                        onClick={handleExportCSV}
                      >
                        <Download className="w-4 h-4" />
                        Export CSV
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </>
          );})()}

          {activeTab === "Team and Tracking" && (
            <EventTeamTab eventId={eventId} organizationId={org?.id} />
          )}

          {activeTab === "Settings" && (
            <div className="bg-card rounded-3xl border border-border p-8">
              <h2 className="text-xl font-black tracking-tight mb-4">Event Settings</h2>
              <p className="text-muted-foreground text-sm">Event settings coming soon.</p>
            </div>
          )}
        </div>

        {/* Customer Detail Dialog */}
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
                  {selectedCustomer.isBlocked ? (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className="rounded-full font-bold gap-2 text-xs bg-green-500/10 text-green-600 border-green-500/20 hover:bg-green-500/20"
                        >
                          <ShieldCheck className="w-3.5 h-3.5" />
                          UNBLOCK USER
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="rounded-2xl">
                        <AlertDialogHeader>
                          <AlertDialogTitle>Unblock {selectedCustomer.name}?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This user will be able to purchase tickets for your organization's events again.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel className="rounded-full">Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            className="rounded-full"
                            onClick={async () => {
                              if (!org?.id || !selectedCustomer.userId) return;
                              const { error } = await supabase.from("blocked_users" as any).delete().eq("organization_id", org.id).eq("user_id", selectedCustomer.userId);
                              if (error) {
                                toast.error("Failed to unblock user");
                              } else {
                                toast.success(`${selectedCustomer.name} has been unblocked`);
                                setSelectedCustomer((prev) => prev ? { ...prev, isBlocked: false } : prev);
                              }
                            }}
                          >
                            Unblock User
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  ) : (
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
                                setSelectedCustomer((prev) => prev ? { ...prev, isBlocked: true } : prev);
                              }
                            }}
                          >
                            Block User
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>
              )}
            </DialogHeader>
            {selectedCustomer && (
              <div className="flex flex-col md:flex-row gap-0 md:gap-0">
                {/* Left side - Profile info */}
                <div className="md:w-[280px] flex-shrink-0 px-8 py-6 md:border-r border-border flex flex-col items-center text-center gap-4">
                  <Avatar className="w-20 h-20 border-2 border-border">
                    {selectedCustomer.avatarUrl && <AvatarImage src={selectedCustomer.avatarUrl} />}
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
                    {selectedCustomer.orders.map((order) => {
                      const isRefunded = isOrderRefunded(order);
                      return (
                      <button
                        key={order.id}
                        onClick={() => setSelectedOrder({ ...order, discount: (order as any).discount || 0, promoCode: (order as any).promoCode || null, refunded: isRefunded, customerName: selectedCustomer.name })}
                        className="w-full text-left p-4 bg-secondary/50 rounded-2xl border border-border/50 hover:border-[hsl(var(--brand-pink))]/40 hover:bg-secondary/80 transition-all group"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-bold text-foreground group-hover:text-[hsl(var(--brand-pink))] transition-colors">{order.orderId}</span>
                          <div className="flex items-center gap-2">
                            {isRefunded && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-destructive/10 text-destructive">Refunded</span>
                            )}
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
                          <span className={`text-sm font-bold ${isRefunded ? "line-through text-muted-foreground" : "text-foreground"}`}>{order.total}</span>
                        </div>
                      </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Order Detail Modal */}
        <Dialog open={!!selectedOrder} onOpenChange={(open) => { if (!open) setSelectedOrder(null); }}>
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

                      {/* Partial Refund inline panel */}
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
      </main>
    </div>
  );
};

export default EventDashboard;
