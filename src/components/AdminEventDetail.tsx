import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  ArrowLeft, DollarSign, Ticket, Users, MapPin, CalendarDays,
  TrendingUp, BarChart3, ArrowUpDown, ArrowUp, ArrowDown,
  Link2, Copy, Check, Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import AnimatedNumber from "@/components/AnimatedNumber";
import DonutChart from "@/components/DonutChart";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip as RechartsTooltip, CartesianGrid } from "recharts";
import { eachDayOfInterval, format, parseISO } from "date-fns";
import { resolveOrderPricing } from "@/lib/orderPricing";
import { computeOrderFinancials } from "@/lib/orderFinancials";
import { getNetOrderRevenue } from "@/lib/refunds";

interface EventStat {
  id: string;
  title: string;
  flyer_url: string | null;
  category: string;
  ticketsSold: number;
  totalTickets: number;
  revenue: number;
  orgName: string;
  orgAvatarUrl: string | null;
  orgSlug: string;
  status: string;
  date: string | null;
  city: string;
  salesDisabled: boolean;
}

interface AdminEventDetailProps {
  event: EventStat;
  onBack: () => void;
}

interface OrderRow {
  id: string;
  created_at: string;
  user_id: string;
  unit_price: number;
  quantity: number;
  discount: number;
  refunded_amount: number;
  service_fee: number;
  total: number;
  ticket_name: string;
  status: string;
  ref_source: string;
  checked_in: boolean;
  checked_in_at: string | null;
}

interface ProfileRow {
  user_id: string;
  name: string;
  email: string;
  avatar_url: string | null;
}

const formatCurrency = (val: number) =>
  val.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 });

const getOrderPricing = (order: Pick<OrderRow, "unit_price" | "quantity" | "discount" | "total">) =>
  resolveOrderPricing({
    unitPrice: order.unit_price,
    quantity: order.quantity,
    discount: order.discount,
    total: order.total,
  });

const getOrderStripeFee = (order: Pick<OrderRow, "unit_price" | "quantity" | "discount" | "total">) => {
  const f = computeOrderFinancials(order);
  return f.stripeFee;
};

const MALE_NAMES = new Set(["hugo","isaac","james","john","robert","michael","david","william","richard","joseph","thomas","charles","christopher","daniel","matthew","anthony","mark","donald","steven","paul","andrew","joshua","kenneth","kevin","brian","george","timothy","ronald","edward","jason","jeffrey","ryan","jacob","gary","nicholas","eric","jonathan","stephen","larry","justin","scott","brandon","benjamin","samuel","raymond","gregory","frank","alexander","patrick","jack","dennis","jerry","tyler","aaron","jose","adam","nathan","henry","peter","zachary","douglas","harold","gabriel","carl","arthur","bruce","logan","albert","eugene","gerald","roger","keith","lawrence","terry","sean","jesse","austin","noah","ethan","dylan","lucas","liam","mason","aiden","elijah","oliver","owen","carter","connor","luke","caleb","hunter","isaiah","christian","landon","jordan","cameron","evan","leo","mateo","thiago","pedro","rafael","diego","bruno","felipe","gustavo","henrique","caio","vinicius","bernardo","enzo","davi","miguel","arthur","heitor","theo","murilo","pietro","luan","gabriel","lucas","guilherme","eduardo","fernando","marcelo","rodrigo","andre","fabio","sergio","paulo","carlos","marcos","jorge","antonio","luis","leandro","renato","alessandro","danilo","renan","igor","artur"]);
const FEMALE_NAMES = new Set(["mary","patricia","jennifer","linda","barbara","elizabeth","susan","jessica","sarah","karen","lisa","nancy","betty","margaret","sandra","ashley","emily","donna","michelle","dorothy","carol","amanda","melissa","deborah","stephanie","rebecca","sharon","laura","cynthia","kathleen","amy","angela","shirley","anna","brenda","pamela","emma","nicole","helen","samantha","katherine","christine","debra","rachel","carolyn","janet","catherine","maria","heather","diane","ruth","julia","olivia","grace","victoria","rose","mia","sophia","isabella","ava","charlotte","amelia","harper","abigail","ella","madison","chloe","scarlett","aria","riley","zoey","lily","eleanor","hannah","natalie","lillian","savannah","brooklyn","leah","stella","hazel","aurora","ana","juliana","larissa","camila","fernanda","beatriz","carolina","mariana","gabriela","rafaela","isabela","leticia","bruna","amanda","bianca","jessica","tatiana","vanessa","daniela","priscila","renata","aline","patricia","adriana","cristina","natalia"]);

const guessGender = (name: string): "male" | "female" | "other" => {
  const first = (name || "").trim().split(/\s+/)[0].toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (MALE_NAMES.has(first)) return "male";
  if (FEMALE_NAMES.has(first)) return "female";
  return "other";
};

const AdminEventDetail = ({ event, onBack }: AdminEventDetailProps) => {
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [profiles, setProfiles] = useState<Map<string, ProfileRow>>(new Map());
  const [loading, setLoading] = useState(true);
  const [attendeeSortCol, setAttendeeSortCol] = useState<"name" | "tickets" | "spent" | null>(null);
  const [attendeeSortDir, setAttendeeSortDir] = useState<"asc" | "desc">("desc");

  // Tracking links state
  interface TrackingLinkData { id: string; label: string; url: string; clicks: number; sales: number; revenue: string; createdBy?: string; }
  const [mainLinks, setMainLinks] = useState<TrackingLinkData[]>([]);
  const [customLinks, setCustomLinks] = useState<TrackingLinkData[]>([]);
  const [showCreateLinkModal, setShowCreateLinkModal] = useState(false);
  const [newLinkLabel, setNewLinkLabel] = useState("");
  const [newLinkSlug, setNewLinkSlug] = useState("");
  const [copiedLink, setCopiedLink] = useState<string | null>(null);
  const [eventCreatedAt, setEventCreatedAt] = useState<string | null>(null);
  const [eventEndDate, setEventEndDate] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const [{ data: ordersData }, { data: eventRow }] = await Promise.all([
        supabase
          .from("orders")
          .select("id, created_at, user_id, unit_price, quantity, discount, refunded_amount, service_fee, total, ticket_name, status, ref_source, checked_in, checked_in_at")
          .eq("event_id", event.id),
        supabase
          .from("events")
          .select("created_at, end_date, end_time, date, time")
          .eq("id", event.id)
          .single(),
      ]);

      if (eventRow) {
        setEventCreatedAt(eventRow.created_at);
        // Build end date string from end_date or fallback to date
        const endDateStr = eventRow.end_date || eventRow.date;
        setEventEndDate(endDateStr || null);
      }

      const eventOrders = (ordersData || []) as OrderRow[];
      setOrders(eventOrders);

      const userIds = [...new Set(eventOrders.map(o => o.user_id))];
      if (userIds.length > 0) {
        const { data: profilesData } = await supabase
          .from("profiles")
          .select("user_id, name, email, avatar_url")
          .in("user_id", userIds);
        const map = new Map<string, ProfileRow>();
        (profilesData || []).forEach(p => map.set(p.user_id, p));
        setProfiles(map);
      }
      setLoading(false);
    };
    fetchData();
  }, [event.id]);

  // Fetch tracking links data
  useEffect(() => {
    const fetchTrackingData = async () => {
      const [{ data: eventData }, { data: orderData }, { data: dbLinks }] = await Promise.all([
        supabase.from("events").select("clicks, explore_clicks, instagram_clicks").eq("id", event.id).single(),
        supabase.from("orders").select("ref_source, quantity, total").eq("event_id", event.id),
        supabase.from("tracking_links").select("*").eq("event_id", event.id),
      ]);

      const filterOrders = (ref: string) => (orderData || []).filter(o => o.ref_source === ref);
      const directOrders = (orderData || []).filter(o => !["explore", "instagram"].includes(o.ref_source));
      const sumSales = (arr: typeof directOrders) => arr.reduce((s, o) => s + (o.quantity || 0), 0);
      const sumRevenue = (arr: typeof directOrders) => arr.reduce((s, o) => s + Number(o.total || 0), 0);

      const exploreOrders = filterOrders("explore");
      const igOrders = filterOrders("instagram");

      const origin = window.location.host;

      // Load persisted tracking links from DB with real order data
      const persistedLinks = (dbLinks || []).map((tl: any) => {
        const srcOrders = filterOrders(tl.slug);
        return {
          id: tl.id,
          label: tl.label,
          url: `${origin}/${tl.slug}`,
          clicks: tl.clicks || 0,
          sales: sumSales(srcOrders),
          revenue: formatCurrency(sumRevenue(srcOrders)),
          createdBy: tl.created_by_admin ? "Admin" : "Organizer",
          createdByAdmin: !!tl.created_by_admin,
        };
      });

      const adminDbLinks = persistedLinks.filter(l => l.createdByAdmin);
      const orgDbLinks = persistedLinks.filter(l => !l.createdByAdmin);

      // Also exclude admin tracking link slugs from "direct" orders
      const allTrackingSlugs = (dbLinks || []).map((tl: any) => tl.slug);
      const trueDirectOrders = (orderData || []).filter(o => !["explore", "instagram", ...allTrackingSlugs].includes(o.ref_source));

      setMainLinks([
        { id: "main-event-link", label: "Event Link", url: `${origin}/event/${event.id}`, clicks: (eventData as any)?.clicks || 0, sales: sumSales(trueDirectOrders), revenue: formatCurrency(sumRevenue(trueDirectOrders)) },
        { id: "main-brazou", label: "Brazou", url: `${origin}/event/${event.id}?ref=explore`, clicks: (eventData as any)?.explore_clicks || 0, sales: sumSales(exploreOrders), revenue: formatCurrency(sumRevenue(exploreOrders)) },
        { id: "main-instagram", label: "Instagram", url: `${origin}/event/${event.id}?ref=instagram`, clicks: (eventData as any)?.instagram_clicks || 0, sales: sumSales(igOrders), revenue: formatCurrency(sumRevenue(igOrders)) },
        ...adminDbLinks,
      ]);
      setCustomLinks(orgDbLinks);
    };
    fetchTrackingData();
  }, [event.id]);

  const handleCopyLink = (url: string, id: string) => {
    navigator.clipboard.writeText(`https://${url}`);
    setCopiedLink(id);
    setTimeout(() => setCopiedLink(null), 2000);
    toast.success("Link copied!");
  };

  const orderFinancials = useMemo(() => {
    return orders.map((order) => {
      const pricing = getOrderPricing(order);
      const f = computeOrderFinancials(order);

      return {
        order,
        pricing,
        organizerRevenue: getNetOrderRevenue(order),
        serviceFee: f.serviceFee,
        processingRevenue: f.processingValue,
        stripeFee: f.stripeFee,
      };
    });
  }, [orders]);

  const totalServiceFees = orderFinancials.reduce((sum, f) => sum + f.serviceFee, 0);
  const totalProcessingRevenue = orderFinancials.reduce((sum, f) => sum + f.processingRevenue, 0);
  const totalStripeFees = orderFinancials.reduce((sum, f) => sum + f.stripeFee, 0);
  const organizerRevenue = orderFinancials.reduce((sum, f) => sum + f.organizerRevenue, 0);
  const totalRefunded = orders.reduce((sum, o) => sum + Math.max(0, Number(o.refunded_amount || 0)), 0);
  const platformRevenue = totalServiceFees - totalStripeFees;
  const totalAttendees = new Set(orders.map(o => o.user_id)).size;

  // Gender ratio
  const genderData = useMemo(() => {
    const counts = { male: 0, female: 0, other: 0 };
    const seen = new Set<string>();
    orders.forEach(o => {
      if (seen.has(o.user_id)) return;
      seen.add(o.user_id);
      const p = profiles.get(o.user_id);
      if (p) counts[guessGender(p.name)]++;
    });
    const total = counts.male + counts.female + counts.other || 1;
    return [
      { label: "Male", pct: Math.round((counts.male / total) * 100), color: "bg-[hsl(210,80%,55%)]" },
      { label: "Female", pct: Math.round((counts.female / total) * 100), color: "bg-[hsl(343,94%,55%)]" },
      { label: "Other", pct: Math.round((counts.other / total) * 100), color: "bg-[hsl(48,96%,53%)]" },
    ];
  }, [orders, profiles]);

  // Sales source
  const salesSource = useMemo(() => {
    const counts: Record<string, number> = {};
    orders.forEach(o => {
      const src = o.ref_source === "explore" ? "Brazou" : o.ref_source === "instagram" ? "Instagram" : o.ref_source === "direct" ? "Direct" : "Tracking Links";
      counts[src] = (counts[src] || 0) + o.quantity;
    });
    const total = Object.values(counts).reduce((s, v) => s + v, 0) || 1;
    return Object.entries(counts).map(([label, count]) => ({ label, pct: Math.round((count / total) * 100) }));
  }, [orders]);

  // Location data
  const locationLabel = event.city || "Unknown";

  // Revenue over time (line chart) — from event creation to event end date
  const revenueOverTime = useMemo(() => {
    if (!eventCreatedAt) return [];
    const start = parseISO(eventCreatedAt.slice(0, 10));
    const end = eventEndDate ? parseISO(eventEndDate) : new Date();
    if (end < start) return [];
    const days = eachDayOfInterval({ start, end });
    const dayMap = new Map<string, number>();
    orderFinancials.forEach(({ order, pricing, stripeFee }) => {
      const day = order.created_at.slice(0, 10);
      dayMap.set(day, (dayMap.get(day) || 0) + (pricing.serviceFee - stripeFee));
    });
    return days.map(d => {
      const key = format(d, "yyyy-MM-dd");
      return { date: format(d, "MMM dd"), revenue: parseFloat((dayMap.get(key) || 0).toFixed(2)) };
    });
  }, [orders, orderFinancials, eventCreatedAt, eventEndDate]);

  // Attendee list (unique users)
  const attendees = useMemo(() => {
    const userMap = new Map<string, { userId: string; name: string; email: string; avatar_url: string | null; tickets: number; spent: number }>();
    orders.forEach(o => {
      const existing = userMap.get(o.user_id);
      const p = profiles.get(o.user_id);
      if (existing) {
        existing.tickets += o.quantity;
        existing.spent += Number(o.total);
      } else {
        userMap.set(o.user_id, {
          userId: o.user_id,
          name: p?.name || "Unknown",
          email: p?.email || "",
          avatar_url: p?.avatar_url || null,
          tickets: o.quantity,
          spent: Number(o.total),
        });
      }
    });
    let list = [...userMap.values()];
    if (attendeeSortCol) {
      list.sort((a, b) => {
        let av: any, bv: any;
        if (attendeeSortCol === "name") { av = a.name.toLowerCase(); bv = b.name.toLowerCase(); }
        else if (attendeeSortCol === "tickets") { av = a.tickets; bv = b.tickets; }
        else { av = a.spent; bv = b.spent; }
        if (av < bv) return attendeeSortDir === "asc" ? -1 : 1;
        if (av > bv) return attendeeSortDir === "asc" ? 1 : -1;
        return 0;
      });
    }
    return list;
  }, [orders, profiles, attendeeSortCol, attendeeSortDir]);

  const handleSort = (col: "name" | "tickets" | "spent") => {
    if (attendeeSortCol === col) setAttendeeSortDir(d => d === "asc" ? "desc" : "asc");
    else { setAttendeeSortCol(col); setAttendeeSortDir("desc"); }
  };

  const SortIcon = ({ col }: { col: "name" | "tickets" | "spent" }) => {
    if (attendeeSortCol !== col) return <ArrowUpDown className="w-3 h-3 ml-1 opacity-40 inline" />;
    return attendeeSortDir === "asc" ? <ArrowUp className="w-3 h-3 ml-1 inline" /> : <ArrowDown className="w-3 h-3 ml-1 inline" />;
  };

  const eventDate = event.date ? new Date(event.date + "T00:00:00") : null;

  return (
    <div className="space-y-8">
      {/* Back */}
      <button onClick={onBack} className="flex items-center gap-2 text-gray-400 hover:text-on-background transition-colors group">
        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
        <span className="text-xs font-black uppercase tracking-[0.2em]">Back to Events</span>
      </button>

      {/* Header */}
      <div className="flex items-start gap-6">
        <div className="w-24 h-24 rounded-2xl overflow-hidden flex-shrink-0 bg-gray-100 dark:bg-surface-container ring-2 ring-gray-200 dark:ring-gray-700">
          {event.flyer_url ? (
            <img src={event.flyer_url} alt={event.title} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <CalendarDays className="w-8 h-8 text-gray-300" />
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-3xl md:text-4xl font-black tracking-tighter text-on-background uppercase">{event.title}</h1>
          <div className="flex flex-wrap items-center gap-4 mt-2">
            <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-[0.15em] ${
              event.status === "live" ? "bg-brand-lime/20 text-brand-lime" :
              event.status === "draft" ? "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600" :
              event.status === "sold_out" ? "bg-brand-pink/10 text-brand-pink" :
              "bg-gray-100 dark:bg-gray-800 text-gray-400"
            }`}>
              {event.status.replace("_", " ")}
            </span>
            {eventDate && (
              <span className="flex items-center gap-1.5 text-[11px] font-bold text-gray-500">
                <CalendarDays className="w-3.5 h-3.5" />
                {eventDate.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
              </span>
            )}
            {event.city && (
              <span className="flex items-center gap-1.5 text-[11px] font-bold text-gray-500">
                <MapPin className="w-3.5 h-3.5" />
                {event.city}
              </span>
            )}
          </div>
          <div className="mt-2 flex items-center gap-2">
            {event.orgAvatarUrl && (
              <img src={event.orgAvatarUrl} alt={event.orgName} className="w-5 h-5 rounded-full object-cover ring-1 ring-gray-200 dark:ring-gray-700" />
            )}
            <span className="text-xs font-bold text-gray-500">by <span className="text-brand-pink">{event.orgName}</span></span>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-pulse text-gray-400 text-xs font-black uppercase tracking-widest">Loading event data...</div>
        </div>
      ) : (
        <>
          {/* Financial KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { icon: DollarSign, label: "Organizer Revenue", value: formatCurrency(organizerRevenue), color: "text-on-background" },
              { icon: DollarSign, label: "Total Fees Collected", value: formatCurrency(totalServiceFees), color: "text-on-background" },
              { icon: DollarSign, label: "Total Processing Revenue", value: formatCurrency(totalProcessingRevenue), color: "text-on-background" },
              { icon: TrendingUp, label: "Total Stripe Fees", value: formatCurrency(totalStripeFees), color: "text-orange-500" },
              { icon: TrendingUp, label: "Net Platform Revenue", value: formatCurrency(platformRevenue), color: "text-brand-pink" },
              { icon: Users, label: "Total Attendees", value: totalAttendees.toString(), color: "text-on-background" },
            ].map((kpi, i) => (
              <div key={i} className="p-6 bg-white dark:bg-surface rounded-[2rem] border border-gray-100 dark:border-gray-800">
                <div className="flex items-center gap-2 mb-3">
                  <kpi.icon className="w-4 h-4 text-gray-400" />
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">{kpi.label}</p>
                </div>
                <h2 className={`text-2xl font-black ${kpi.color}`}>{kpi.value}</h2>
              </div>
            ))}
          </div>

          {/* Platform Revenue Over Time */}
          {revenueOverTime.length > 0 && (
            <div className="bg-white dark:bg-surface rounded-[2rem] border border-gray-100 dark:border-gray-800 p-8">
              <h3 className="text-xl font-black text-on-background mb-6">Platform Revenue Over Time</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={revenueOverTime}>
                    <defs>
                      <linearGradient id="eventRevGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#F82268" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="#F82268" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 50% / 0.1)" />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fontWeight: 700, fill: "#999" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fontWeight: 700, fill: "#999" }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v}`} />
                    <RechartsTooltip
                      contentStyle={{ background: "#111", border: "none", borderRadius: 16, padding: "12px 16px", fontSize: 12, fontWeight: 800 }}
                      labelStyle={{ color: "#888", fontWeight: 700, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.1em" }}
                      formatter={(value: number) => [formatCurrency(value), "Platform Revenue"]}
                    />
                    <Line type="monotone" dataKey="revenue" stroke="#F82268" strokeWidth={2.5} dot={false} fill="url(#eventRevGrad)" fillOpacity={1} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Analytics Row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Gender Ratio */}
            <div className="bg-white dark:bg-surface rounded-[2rem] border border-gray-100 dark:border-gray-800 p-8">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mb-6">Gender Ratio</p>
              <div className="space-y-3">
                {genderData.map(g => (
                  <div key={g.label}>
                    <div className="flex justify-between text-xs font-bold mb-1">
                      <span className="text-on-background">{g.label}</span>
                      <span className="text-gray-400 tabular-nums">{g.pct}%</span>
                    </div>
                    <div className="h-2 w-full bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${g.color}`} style={{ width: `${g.pct}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Sales Source */}
            <div className="bg-white dark:bg-surface rounded-[2rem] border border-gray-100 dark:border-gray-800 p-8">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mb-6">Sales Source</p>
              <div className="space-y-3">
                {salesSource.map(s => (
                  <div key={s.label}>
                    <div className="flex justify-between text-xs font-bold mb-1">
                      <span className="text-on-background">{s.label}</span>
                      <span className="text-gray-400 tabular-nums">{s.pct}%</span>
                    </div>
                    <div className="h-2 w-full bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                      <div className="h-full rounded-full bg-brand-pink" style={{ width: `${s.pct}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Attendee Location */}
            <div className="bg-white dark:bg-surface rounded-[2rem] border border-gray-100 dark:border-gray-800 p-8">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mb-6">Attendee Location</p>
              <div className="flex items-center gap-3">
                <MapPin className="w-5 h-5 text-brand-pink" />
                <div>
                  <p className="text-lg font-black text-on-background">{locationLabel}</p>
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">{totalAttendees} attendees</p>
                </div>
              </div>
              <div className="mt-4 h-2 w-full bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                <div className="h-full rounded-full bg-brand-lime" style={{ width: "100%" }} />
              </div>
            </div>
          </div>

          {/* Total Tickets Sold, Total Orders & Total Refunded */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white dark:bg-surface rounded-[2rem] border border-gray-100 dark:border-gray-800 p-8">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mb-2">Total Tickets Sold</p>
              <p className="text-3xl font-black text-on-background tabular-nums">{orders.reduce((s, o) => s + o.quantity, 0)}</p>
            </div>
            <div className="bg-white dark:bg-surface rounded-[2rem] border border-gray-100 dark:border-gray-800 p-8">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mb-2">Total Orders</p>
              <p className="text-3xl font-black text-on-background tabular-nums">{orders.length}</p>
            </div>
            <div className="bg-white dark:bg-surface rounded-[2rem] border border-gray-100 dark:border-gray-800 p-8">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mb-2">Total Refunded</p>
              <p className="text-3xl font-black text-red-400 tabular-nums">{formatCurrency(totalRefunded)}</p>
            </div>
          </div>

          {/* Ticket Breakdown */}
          <div className="bg-white dark:bg-surface rounded-[2rem] border border-gray-100 dark:border-gray-800 p-8">
            <h3 className="text-xl font-black text-on-background mb-6">Ticket Breakdown</h3>
            <div className="space-y-4">
              {(() => {
                const ticketMap = new Map<string, { sold: number; revenue: number; checkedIn: number }>();
                orderFinancials.forEach(({ order, organizerRevenue }) => {
                  const existing = ticketMap.get(order.ticket_name) || { sold: 0, revenue: 0, checkedIn: 0 };
                  existing.sold += order.quantity;
                  existing.revenue += organizerRevenue;
                  if (order.checked_in) existing.checkedIn += order.quantity;
                  ticketMap.set(order.ticket_name, existing);
                });
                const totalCheckedIn = [...ticketMap.values()].reduce((s, d) => s + d.checkedIn, 0);
                const totalSold = [...ticketMap.values()].reduce((s, d) => s + d.sold, 0);
                return (
                  <>
                    {[...ticketMap.entries()].map(([name, data]) => (
                      <div key={name} className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Ticket className="w-4 h-4 text-brand-pink" />
                          <span className="font-bold text-on-background text-sm uppercase tracking-tight">{name}</span>
                        </div>
                        <div className="flex items-center gap-6">
                          <span className="text-xs font-bold text-gray-500 tabular-nums">{data.sold} sold</span>
                          <span className="text-xs font-bold text-brand-lime tabular-nums">{data.checkedIn} checked in</span>
                          <span className="text-sm font-black text-brand-pink tabular-nums">{formatCurrency(data.revenue)}</span>
                        </div>
                      </div>
                    ))}
                    <div className="pt-4 mt-4 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Total Check-in</span>
                      <span className="text-lg font-black text-brand-lime tabular-nums">{totalCheckedIn} / {totalSold}</span>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>

          {/* Attendees Table */}
          <div className="bg-white dark:bg-surface rounded-[2rem] border border-gray-100 dark:border-gray-800 overflow-hidden">
            <div className="p-8 pb-4">
              <h3 className="text-xl font-black text-on-background">Attendees ({attendees.length})</h3>
            </div>
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-800">
                  <th onClick={() => handleSort("name")} className="px-8 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 cursor-pointer hover:text-on-background transition-colors select-none">
                    Attendee <SortIcon col="name" />
                  </th>
                  <th onClick={() => handleSort("tickets")} className="px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 cursor-pointer hover:text-on-background transition-colors select-none">
                    Tickets <SortIcon col="tickets" />
                  </th>
                  <th onClick={() => handleSort("spent")} className="px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 cursor-pointer hover:text-on-background transition-colors select-none text-right">
                    Total Spent <SortIcon col="spent" />
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                {attendees.length === 0 ? (
                  <tr><td colSpan={3} className="px-8 py-16 text-center text-gray-400 text-sm">No attendees yet</td></tr>
                ) : (
                  attendees.slice(0, 50).map(a => (
                    <tr key={a.userId} className="hover:bg-gray-50 dark:hover:bg-surface-container transition-colors">
                      <td className="px-8 py-4">
                        <div className="flex items-center gap-3">
                          {a.avatar_url ? (
                            <img src={a.avatar_url} alt={a.name} className="w-8 h-8 rounded-full object-cover ring-1 ring-gray-200 dark:ring-gray-700" />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                              <span className="text-[10px] font-black text-gray-500">{a.name[0]?.toUpperCase()}</span>
                            </div>
                          )}
                          <div>
                            <p className="font-bold text-on-background text-sm">{a.name}</p>
                            <p className="text-[10px] text-gray-400">{a.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 font-bold text-on-background tabular-nums">{a.tickets}</td>
                      <td className="px-6 py-4 text-right font-black text-brand-pink tabular-nums">{formatCurrency(a.spent)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Main Links */}
          <div className="bg-white dark:bg-surface rounded-[2rem] border border-gray-100 dark:border-gray-800 overflow-hidden">
            <div className="p-8 pb-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h3 className="text-xl font-black text-on-background">Main Links</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Default tracking links for this event</p>
              </div>
              <Button
                onClick={() => { setNewLinkLabel(""); setNewLinkSlug(""); setShowCreateLinkModal(true); }}
                className="gap-2 rounded-full font-bold bg-[hsl(var(--brand-pink))] text-primary-foreground hover:bg-[hsl(var(--brand-pink))]/90"
              >
                <Link2 className="w-4 h-4" />
                Create Tracking Link
              </Button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-gray-800">
                    <th className="text-left px-8 py-3 text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Link</th>
                    <th className="text-left px-6 py-3 text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Clicks</th>
                    <th className="text-left px-6 py-3 text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Sales</th>
                    <th className="text-left px-6 py-3 text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Conversion</th>
                    <th className="text-left px-6 py-3 text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Revenue</th>
                    <th className="text-right px-6 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                  {mainLinks.map(link => (
                    <tr key={link.id} className="hover:bg-gray-50 dark:hover:bg-surface-container transition-colors">
                      <td className="px-8 py-4 font-bold text-on-background">{link.label}</td>
                      <td className="px-6 py-4 font-bold text-on-background tabular-nums">{link.clicks.toLocaleString()}</td>
                      <td className="px-6 py-4 font-bold text-on-background tabular-nums">{link.sales}</td>
                      <td className="px-6 py-4 font-bold text-on-background tabular-nums">{link.clicks > 0 ? `${((link.sales / link.clicks) * 100).toFixed(1)}%` : "0%"}</td>
                      <td className="px-6 py-4 font-bold text-brand-pink tabular-nums">{link.revenue}</td>
                      <td className="px-6 py-4 text-right">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={() => handleCopyLink(link.url, link.id)}>
                          {copiedLink === link.id ? <Check className="w-4 h-4 text-[hsl(var(--brand-lime))]" /> : <Copy className="w-4 h-4" />}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>


          {/* Create Tracking Link Modal */}
          <Dialog open={showCreateLinkModal} onOpenChange={setShowCreateLinkModal}>
            <DialogContent className="sm:max-w-md rounded-3xl">
              <DialogHeader>
                <DialogTitle className="text-xl font-black">Create Tracking Link</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div>
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5 block">Link Label</label>
                  <input
                    type="text"
                    value={newLinkLabel}
                    onChange={(e) => {
                      setNewLinkLabel(e.target.value);
                      setNewLinkSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-"));
                    }}
                    placeholder="e.g. Facebook Ads"
                    className="w-full bg-secondary rounded-xl border-none py-2.5 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--brand-pink))] placeholder:text-muted-foreground"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5 block">Link Slug</label>
                  <div className="flex items-center gap-0 bg-secondary rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-[hsl(var(--brand-pink))] transition-all">
                    <span className="text-xs text-muted-foreground pl-4 pr-1 whitespace-nowrap font-mono">brazou.com/</span>
                    <input
                      type="text"
                      value={newLinkSlug}
                      onChange={(e) => setNewLinkSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                      placeholder="my-tracking-link"
                      className="flex-1 bg-transparent border-none py-2.5 pr-4 text-sm focus:outline-none placeholder:text-muted-foreground font-mono"
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1.5">Only lowercase letters, numbers, and hyphens allowed.</p>
                </div>
                <div className="flex gap-2 pt-2">
                  <Button variant="ghost" className="flex-1 rounded-full" onClick={() => setShowCreateLinkModal(false)}>Cancel</Button>
                  <Button
                    className="flex-1 rounded-full font-bold bg-[hsl(var(--brand-pink))] text-primary-foreground hover:bg-[hsl(var(--brand-pink))]/90 gap-2"
                    disabled={!newLinkLabel || !newLinkSlug}
                    onClick={async () => {
                      const { data: session } = await supabase.auth.getSession();
                      const userId = session?.session?.user?.id;
                      if (!userId) { toast.error("Not authenticated"); return; }

                      const { data: inserted, error } = await supabase
                        .from("tracking_links")
                        .insert({ event_id: event.id, label: newLinkLabel, slug: newLinkSlug, created_by: userId, created_by_admin: true } as any)
                        .select()
                        .single();

                      if (error) {
                        toast.error(error.message.includes("duplicate") ? "A link with this slug already exists" : "Failed to create link");
                        return;
                      }

                      const newLink: TrackingLinkData = {
                        id: inserted.id,
                        label: inserted.label,
                        url: `${window.location.host}/${inserted.slug}`,
                        clicks: 0,
                        sales: 0,
                        revenue: formatCurrency(0),
                        createdBy: "Admin",
                      };
                      setMainLinks(prev => [...prev, newLink]);
                      setShowCreateLinkModal(false);
                      toast.success("Tracking link created!");
                    }}
                  >
                    <Link2 className="w-4 h-4" />
                    Create Link
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </>
      )}
    </div>
  );
};

export default AdminEventDetail;
