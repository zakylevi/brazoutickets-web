import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { format, subMonths, startOfMonth, endOfMonth, parseISO, isWithinInterval, subDays, eachDayOfInterval, eachMonthOfInterval } from "date-fns";
import { computeOrderFinancials, aggregateFinancials, countUniqueGroups } from "@/lib/orderFinancials";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import DonutChart from "@/components/DonutChart";
import AnimatedNumber from "@/components/AnimatedNumber";
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  CalendarDays,
  ArrowUpRight,
  Ticket,
  ShoppingCart,
  BarChart3,
  Users,
  Receipt,
  Percent,
  CreditCard,
} from "lucide-react";
import { cn } from "@/lib/utils";

import AdminFinancePayoutsTab from "@/components/AdminFinancePayoutsTab";
import AdminFinanceDisputesTab from "@/components/AdminFinanceDisputesTab";

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
  refunded_amount: number;
  ticket_name: string;
  status: string;
  ref_source: string;
  promo_code: string | null;
  order_group_id: string | null;
}

interface EventInfo {
  id: string;
  title: string;
  organization_id: string;
  flyer_url: string | null;
}

interface OrgInfo {
  id: string;
  name: string;
  avatar_url: string | null;
}

interface ProfileInfo {
  user_id: string;
  name: string;
}

type Period = "7d" | "30d" | "90d" | "this_month" | "all" | "custom";

const AdminFinanceTab = () => {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [trackingLinkSlugs, setTrackingLinkSlugs] = useState<{ slug: string; created_by_admin: boolean }[]>([]);
  const [events, setEvents] = useState<EventInfo[]>([]);
  const [orgs, setOrgs] = useState<OrgInfo[]>([]);
  const [profiles, setProfiles] = useState<ProfileInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [subTab, setSubTab] = useState<"overview" | "payouts" | "disputes">("overview");
  const [period, setPeriod] = useState<Period>("all");
  const [customFrom, setCustomFrom] = useState<Date | undefined>();
  const [customTo, setCustomTo] = useState<Date | undefined>();

  useEffect(() => {
    const fetch = async () => {
      const [ordersRes, eventsRes, orgsRes, profilesRes, trackingRes] = await Promise.all([
        supabase.from("orders").select("*").order("created_at", { ascending: false }),
        supabase.from("events").select("id, title, organization_id, flyer_url"),
        supabase.from("organizations").select("id, name, avatar_url"),
        supabase.from("profiles").select("user_id, name"),
        supabase.from("tracking_links").select("slug, created_by_admin"),
      ]);
      setOrders((ordersRes.data as Order[]) || []);
      setEvents((eventsRes.data as EventInfo[]) || []);
      setOrgs((orgsRes.data as OrgInfo[]) || []);
      setProfiles((profilesRes.data as ProfileInfo[]) || []);
      setTrackingLinkSlugs((trackingRes.data || []).map((t: any) => ({ slug: t.slug, created_by_admin: t.created_by_admin })));
      setLoading(false);
    };
    fetch();
  }, []);

  const dateRange = useMemo(() => {
    const now = new Date();
    if (period === "7d") return { from: subDays(now, 7), to: now };
    if (period === "30d") return { from: subDays(now, 30), to: now };
    if (period === "90d") return { from: subDays(now, 90), to: now };
    if (period === "this_month") return { from: startOfMonth(now), to: now };
    if (period === "all") {
      // Find earliest order date or fallback to 1 year ago
      const earliest = orders.length > 0
        ? new Date(orders.reduce((min, o) => o.created_at < min ? o.created_at : min, orders[0].created_at))
        : subDays(now, 365);
      return { from: earliest, to: now };
    }
    if (period === "custom" && customFrom && customTo) return { from: customFrom, to: customTo };
    return { from: subDays(now, 30), to: now };
  }, [period, customFrom, customTo, orders]);

  const prevRange = useMemo(() => {
    const diff = dateRange.to.getTime() - dateRange.from.getTime();
    return { from: new Date(dateRange.from.getTime() - diff), to: new Date(dateRange.from.getTime()) };
  }, [dateRange]);

  const filteredOrders = useMemo(
    () => orders.filter((o) => {
      const d = new Date(o.created_at);
      return isWithinInterval(d, { start: dateRange.from, end: dateRange.to });
    }),
    [orders, dateRange]
  );

  const prevOrders = useMemo(
    () => orders.filter((o) => {
      const d = new Date(o.created_at);
      return isWithinInterval(d, { start: prevRange.from, end: prevRange.to });
    }),
    [orders, prevRange]
  );

  // Metrics — use centralized financial formulas
  const agg = useMemo(() => aggregateFinancials(filteredOrders), [filteredOrders]);
  const prevAgg = useMemo(() => aggregateFinancials(prevOrders), [prevOrders]);

  const totalRevenue = filteredOrders.reduce((s, o) => s + Number(o.total), 0);
  const prevRevenue = prevOrders.reduce((s, o) => s + Number(o.total), 0);
  const revenueGrowth = prevRevenue > 0 ? ((totalRevenue - prevRevenue) / prevRevenue) * 100 : totalRevenue > 0 ? 100 : 0;

  const totalProcessingRevenue = agg.totalProcessing;
  const prevProcessingRevenue = prevAgg.totalProcessing;
  const processingRevenueGrowth = prevProcessingRevenue > 0
    ? ((totalProcessingRevenue - prevProcessingRevenue) / prevProcessingRevenue) * 100
    : totalProcessingRevenue > 0 ? 100 : 0;

  const grossTicketRevenue = agg.grossTicketRevenue;
  const totalServiceFees = agg.totalServiceFees;
  const totalDiscounts = filteredOrders.reduce((s, o) => s + Number(o.discount), 0);
  const totalStripeFee = agg.totalStripeFees;
  const netPlatformRevenue = agg.netPlatformRevenue;

  const totalTicketsSold = filteredOrders.reduce((s, o) => s + o.quantity, 0);
  const prevTickets = prevOrders.reduce((s, o) => s + o.quantity, 0);
  const ticketGrowth = prevTickets > 0 ? ((totalTicketsSold - prevTickets) / prevTickets) * 100 : totalTicketsSold > 0 ? 100 : 0;

  const totalOrders = countUniqueGroups(filteredOrders);
  const prevOrderCount = countUniqueGroups(prevOrders);
  const orderGrowth = prevOrderCount > 0 ? ((totalOrders - prevOrderCount) / prevOrderCount) * 100 : totalOrders > 0 ? 100 : 0;

  const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
  const prevAvg = prevOrderCount > 0 ? prevRevenue / prevOrderCount : 0;
  const avgGrowth = prevAvg > 0 ? ((avgOrderValue - prevAvg) / prevAvg) * 100 : avgOrderValue > 0 ? 100 : 0;

  const uniqueCustomers = new Set(filteredOrders.map((o) => o.user_id)).size;

  // Average Organization Revenue
  const orgRevenueMap = new Map<string, number>();
  filteredOrders.forEach((o) => {
    const ev = events.find((e) => e.id === o.event_id);
    if (ev) {
      const current = orgRevenueMap.get(ev.organization_id) || 0;
      orgRevenueMap.set(ev.organization_id, current + Number(o.unit_price) * o.quantity);
    }
  });
  const avgOrgRevenue = orgRevenueMap.size > 0
    ? [...orgRevenueMap.values()].reduce((a, b) => a + b, 0) / orgRevenueMap.size
    : 0;

  const promoOrders = filteredOrders.filter((o) => o.promo_code).length;
  const promoRate = totalOrders > 0 ? (promoOrders / totalOrders) * 100 : 0;

  // Platform revenue by event (service fees - stripe fees)
  const platformRevenueByEvent = useMemo(() => {
    const map = new Map<string, { orders: Order[]; serviceFees: number; processingRevenue: number }>();
    filteredOrders.forEach((o) => {
      const existing = map.get(o.event_id) || { orders: [], serviceFees: 0, processingRevenue: 0 };
      const f = computeOrderFinancials(o);
      existing.orders.push(o);
      existing.serviceFees += f.serviceFee;
      existing.processingRevenue += f.processingValue;
      map.set(o.event_id, existing);
    });
    return [...map.entries()]
      .map(([eventId, data]) => {
        const ev = events.find((e) => e.id === eventId);
        const org = ev ? orgs.find((o) => o.id === ev.organization_id) : null;
        const uniqueGroups = countUniqueGroups(data.orders);
        const stripeFees = data.processingRevenue * 0.029 + 0.30 * uniqueGroups;
        const platformRev = data.serviceFees - stripeFees;
        return { eventId, platformRevenue: platformRev, title: ev?.title || "Unknown", orgName: org?.name || "", flyerUrl: ev?.flyer_url };
      })
      .sort((a, b) => b.platformRevenue - a.platformRevenue);
  }, [filteredOrders, events, orgs]);

  // Revenue by event (total) — kept for % calculations
  const revenueByEvent = useMemo(() => {
    const map = new Map<string, number>();
    filteredOrders.forEach((o) => map.set(o.event_id, (map.get(o.event_id) || 0) + Number(o.total)));
    return [...map.entries()]
      .map(([eventId, revenue]) => {
        const ev = events.find((e) => e.id === eventId);
        const org = ev ? orgs.find((o) => o.id === ev.organization_id) : null;
        return { eventId, revenue, title: ev?.title || "Unknown", orgName: org?.name || "", flyerUrl: ev?.flyer_url };
      })
      .sort((a, b) => b.revenue - a.revenue);
  }, [filteredOrders, events, orgs]);

  // Revenue by org
  const revenueByOrg = useMemo(() => {
    const eventOrgMap = new Map<string, string>();
    events.forEach((e) => eventOrgMap.set(e.id, e.organization_id));
    const map = new Map<string, number>();
    filteredOrders.forEach((o) => {
      const orgId = eventOrgMap.get(o.event_id) || "unknown";
      const gross = Number(o.unit_price) * o.quantity - Number(o.discount) - Number(o.refunded_amount);
      map.set(orgId, (map.get(orgId) || 0) + gross);
    });
    return [...map.entries()]
      .map(([orgId, revenue]) => {
        const org = orgs.find((o) => o.id === orgId);
        return { orgId, revenue, name: org?.name || "Unknown", avatarUrl: org?.avatar_url };
      })
      .sort((a, b) => b.revenue - a.revenue);
  }, [filteredOrders, events, orgs]);

  // Revenue by source
  const revBySource = useMemo(() => {
    const adminSlugs = new Set(trackingLinkSlugs.filter(t => t.created_by_admin).map(t => t.slug));
    const orgSlugs = new Set(trackingLinkSlugs.filter(t => !t.created_by_admin).map(t => t.slug));
    const map = new Map<string, number>();
    map.set("Event Page", 0);
    map.set("Brazou", 0);
    map.set("Instagram", 0);
    map.set("Tracking Links", 0);
    map.set("Promotions", 0);
    filteredOrders.forEach((o) => {
      const src = o.ref_source;
      let category: string;
      if (src === "direct" || !src) {
        category = "Event Page";
      } else if (src === "explore") {
        category = "Brazou";
      } else if (src === "instagram") {
        category = "Instagram";
      } else if (adminSlugs.has(src)) {
        category = "Promotions";
      } else if (orgSlugs.has(src)) {
        category = "Tracking Links";
      } else {
        category = "Tracking Links";
      }
      map.set(category, (map.get(category) || 0) + Number(o.total));
    });
    return [...map.entries()].filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  }, [filteredOrders, trackingLinkSlugs]);

  // Revenue over time chart — shows NET PLATFORM REVENUE (service fees - stripe fees)
  const revenueTimeline = useMemo(() => {
    const diff = dateRange.to.getTime() - dateRange.from.getTime();
    const days = diff / (1000 * 60 * 60 * 24);

    const calcNetRevenue = (dayOrders: Order[]) => {
      const a = aggregateFinancials(dayOrders);
      return a.netPlatformRevenue;
    };
    
    if (days <= 31) {
      const allDays = eachDayOfInterval({ start: dateRange.from, end: dateRange.to });
      return allDays.map((day) => {
        const label = format(day, "MMM d");
        const dayStr = format(day, "yyyy-MM-dd");
        const dayOrders = filteredOrders.filter((o) => format(new Date(o.created_at), "yyyy-MM-dd") === dayStr);
        const revenue = calcNetRevenue(dayOrders);
        const tickets = dayOrders.reduce((s, o) => s + o.quantity, 0);
        return { label, revenue, tickets };
      });
    } else {
      const allMonths = eachMonthOfInterval({ start: dateRange.from, end: dateRange.to });
      return allMonths.map((month) => {
        const label = format(month, "MMM yyyy");
        const monthStr = format(month, "yyyy-MM");
        const monthOrders = filteredOrders.filter((o) => format(new Date(o.created_at), "yyyy-MM") === monthStr);
        const revenue = calcNetRevenue(monthOrders);
        const tickets = monthOrders.reduce((s, o) => s + o.quantity, 0);
        return { label, revenue, tickets };
      });
    }
  }, [filteredOrders, dateRange]);

  const maxRev = Math.max(...revenueTimeline.map((d) => d.revenue), 1);

  // Attendees by event donut
  const attendeesByEvent = useMemo(() => {
    const colors = ["hsl(var(--brand-pink))", "hsl(var(--brand-lime))", "#3b82f6", "#f59e0b", "#8b5cf6", "#ec4899", "#14b8a6", "#f97316"];
    const eventCounts = new Map<string, { title: string; count: number }>();
    filteredOrders.forEach((o) => {
      const ev = eventCounts.get(o.event_id) || { title: events.find((e) => e.id === o.event_id)?.title || "Unknown", count: 0 };
      ev.count += o.quantity;
      eventCounts.set(o.event_id, ev);
    });
    return Array.from(eventCounts.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 8)
      .map((ev, i) => ({ label: ev.title, value: ev.count, color: colors[i % colors.length] }));
  }, [filteredOrders, events]);

  const sourceDonut = useMemo(() => {
    const colors = ["#f82268", "#a3e635", "#3b82f6", "#f59e0b", "#8b5cf6"];
    return revBySource.map(([label, value], i) => ({
      label,
      value,
      color: colors[i % colors.length],
    }));
  }, [revBySource]);

  const fmt = (v: number) => v.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const [hoveredBar, setHoveredBar] = useState<number | null>(null);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-40">
        <div className="animate-pulse text-muted-foreground font-bold uppercase tracking-widest text-xs">Loading finance data...</div>
      </div>
    );
  }

  const GrowthBadge = ({ value }: { value: number }) => (
    <span className={cn(
      "inline-flex items-center gap-0.5 text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full",
      value >= 0 ? "bg-green-100 dark:bg-green-900/30 text-green-600" : "bg-red-100 dark:bg-red-900/30 text-red-500"
    )}>
      {value >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
      {Math.abs(value).toFixed(1)}%
    </span>
  );

  return (
    <div className="space-y-10">
      {/* Sub-tab Navigation */}
      <div className="flex items-center gap-2">
        {(["overview", "payouts", "disputes"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setSubTab(tab)}
            className={cn(
              "px-6 py-3 rounded-full font-black uppercase tracking-widest text-[10px] transition-all",
              subTab === tab
                ? "bg-brand-pink text-white"
                : "bg-secondary text-muted-foreground hover:bg-brand-pink/10 hover:text-brand-pink"
            )}
          >
            {tab === "overview" ? "Overview" : tab === "payouts" ? "Payouts" : "Disputes"}
          </button>
        ))}
      </div>

      {subTab === "payouts" ? (
        <AdminFinancePayoutsTab />
      ) : subTab === "disputes" ? (
        <AdminFinanceDisputesTab />
      ) : (
      <>
    <div className="space-y-10">
      {/* Header + Period Selector */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <span className="font-bold uppercase tracking-[0.2em] text-[10px] text-brand-pink mb-1 block">Financial Analytics</span>
          <h2 className="text-5xl font-black tracking-tighter text-on-background">FINANCE DASHBOARD</h2>
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mt-2">
            {format(dateRange.from, "MMM d, yyyy")} — {format(dateRange.to, "MMM d, yyyy")}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {(["7d", "30d", "90d", "this_month", "all"] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={cn(
                "px-4 py-2 rounded-full font-black uppercase tracking-widest text-[10px] transition-all",
                period === p
                  ? "bg-brand-pink text-white"
                  : "bg-secondary text-muted-foreground hover:bg-brand-pink/10 hover:text-brand-pink"
              )}
            >
              {p === "7d" ? "7 Days" : p === "30d" ? "30 Days" : p === "90d" ? "90 Days" : p === "this_month" ? "This Month" : "All"}
            </button>
          ))}
          <Popover>
            <PopoverTrigger asChild>
              <button
                className={cn(
                  "px-4 py-2 rounded-full font-black uppercase tracking-widest text-[10px] transition-all inline-flex items-center gap-1.5",
                  period === "custom"
                    ? "bg-brand-pink text-white"
                    : "bg-secondary text-muted-foreground hover:bg-brand-pink/10 hover:text-brand-pink"
                )}
              >
                <CalendarDays className="w-3.5 h-3.5" />
                Custom
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-4 space-y-3" align="end">
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Select Range</p>
              <div className="flex gap-2">
                <div>
                  <p className="text-[10px] font-bold text-muted-foreground mb-1">From</p>
                  <Calendar mode="single" selected={customFrom} onSelect={(d) => { setCustomFrom(d); setPeriod("custom"); }} className="p-2 pointer-events-auto" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-muted-foreground mb-1">To</p>
                  <Calendar mode="single" selected={customTo} onSelect={(d) => { setCustomTo(d); setPeriod("custom"); }} className="p-2 pointer-events-auto" />
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Primary KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { icon: DollarSign, label: "TOTAL PROCESSING REVENUE", value: totalProcessingRevenue, prefix: "$", growth: processingRevenueGrowth, color: "text-brand-pink" },
          { icon: Ticket, label: "Tickets Sold", value: totalTicketsSold, prefix: "", growth: ticketGrowth, color: "text-brand-lime" },
          { icon: ShoppingCart, label: "Total Orders", value: totalOrders, prefix: "", growth: orderGrowth, color: "text-blue-500" },
          { icon: Receipt, label: "Avg Order Value", value: avgOrderValue, prefix: "$", growth: avgGrowth, color: "text-amber-500" },
        ].map((kpi, i) => (
          <div key={i} className="bg-secondary/50 rounded-[2rem] p-8 relative overflow-hidden group hover:shadow-lg transition-shadow">
            <kpi.icon className={cn("w-6 h-6 mb-4", kpi.color)} />
            <p className="font-bold uppercase tracking-[0.2em] text-[10px] text-muted-foreground mb-1">{kpi.label}</p>
            <div className="flex items-end gap-3">
              <span className="text-3xl font-black tracking-tighter text-on-background tabular-nums">
                {kpi.prefix === "$" ? (
                  <AnimatedNumber value={kpi.value} prefix="$" decimals={2} />
                ) : (
                  <AnimatedNumber value={kpi.value} />
                )}
              </span>
              <GrowthBadge value={kpi.growth} />
            </div>
            <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground mt-2">vs previous period</p>
          </div>
        ))}
      </div>

      {/* Secondary KPIs */}
      <div className="grid grid-cols-3 lg:grid-cols-6 gap-4">
        {[
          { label: "Gross Ticket Revenue", value: fmt(grossTicketRevenue), highlight: false },
          { label: "Service Fees Collected", value: fmt(totalServiceFees), highlight: false },
          { label: "Total Stripe Fee", value: fmt(totalStripeFee), highlight: false },
          { label: "Net Platform Revenue", value: fmt(netPlatformRevenue), highlight: true },
          { label: "Avg Organization Revenue", value: fmt(avgOrgRevenue), highlight: false },
          { label: "Promo Code Usage", value: `${promoRate.toFixed(1)}%`, highlight: false },
        ].map((m, i) => (
          <div key={i} className={cn("rounded-2xl p-5", m.highlight ? "bg-[#CDFF00]" : "bg-secondary/30")}>
            <p className={cn("font-bold uppercase tracking-[0.15em] text-[9px] mb-1", m.highlight ? "text-black/70" : "text-muted-foreground")}>{m.label}</p>
            <p className={cn("text-lg font-black tracking-tight tabular-nums", m.highlight ? "text-black" : "text-on-background")}>{m.value}</p>
          </div>
        ))}
      </div>

      {/* Revenue Chart */}
      <div className="bg-secondary/50 rounded-[2rem] p-10">
        <div className="flex justify-between items-start mb-8">
          <div>
            <span className="font-bold uppercase tracking-[0.2em] text-[10px] text-brand-pink mb-1 block">Revenue Timeline</span>
            <h3 className="text-2xl font-black tracking-tighter text-on-background">Platform Revenue Over Time</h3>
          </div>
          <div className="text-right">
            <p className="text-2xl font-black tracking-tighter text-on-background tabular-nums">{fmt(netPlatformRevenue)}</p>
            <GrowthBadge value={revenueGrowth} />
          </div>
        </div>
        <div className="h-64 relative" onMouseLeave={() => setHoveredBar(null)}>
          <svg viewBox={`0 0 ${revenueTimeline.length > 1 ? 1000 : 100} 256`} className="w-full h-full" preserveAspectRatio="none">
            {/* Grid lines */}
            {[0, 0.25, 0.5, 0.75, 1].map((pct) => (
              <line
                key={pct}
                x1="0"
                y1={256 - pct * 240 - 8}
                x2={revenueTimeline.length > 1 ? 1000 : 100}
                y2={256 - pct * 240 - 8}
                stroke="currentColor"
                className="text-border"
                strokeWidth="0.5"
                strokeDasharray="4 4"
              />
            ))}
            {/* Gradient fill */}
            <defs>
              <linearGradient id="financeLineGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#f82268" stopOpacity="0.3" />
                <stop offset="100%" stopColor="#f82268" stopOpacity="0" />
              </linearGradient>
            </defs>
            {revenueTimeline.length > 1 && (
              <>
                {/* Area fill */}
                <path
                  d={(() => {
                    const w = 1000;
                    const pts = revenueTimeline.map((d, i) => {
                      const x = (i / (revenueTimeline.length - 1)) * w;
                      const y = 256 - 8 - (maxRev > 0 ? (d.revenue / maxRev) * 240 : 0);
                      return { x, y };
                    });
                    let path = `M${pts[0].x},${pts[0].y}`;
                    for (let i = 1; i < pts.length; i++) {
                      const cp1x = pts[i - 1].x + (pts[i].x - pts[i - 1].x) * 0.4;
                      const cp2x = pts[i].x - (pts[i].x - pts[i - 1].x) * 0.4;
                      path += ` C${cp1x},${pts[i - 1].y} ${cp2x},${pts[i].y} ${pts[i].x},${pts[i].y}`;
                    }
                    path += ` L${pts[pts.length - 1].x},${256} L${pts[0].x},${256} Z`;
                    return path;
                  })()}
                  fill="url(#financeLineGrad)"
                />
                {/* Line */}
                <path
                  d={(() => {
                    const w = 1000;
                    const pts = revenueTimeline.map((d, i) => {
                      const x = (i / (revenueTimeline.length - 1)) * w;
                      const y = 256 - 8 - (maxRev > 0 ? (d.revenue / maxRev) * 240 : 0);
                      return { x, y };
                    });
                    let path = `M${pts[0].x},${pts[0].y}`;
                    for (let i = 1; i < pts.length; i++) {
                      const cp1x = pts[i - 1].x + (pts[i].x - pts[i - 1].x) * 0.4;
                      const cp2x = pts[i].x - (pts[i].x - pts[i - 1].x) * 0.4;
                      path += ` C${cp1x},${pts[i - 1].y} ${cp2x},${pts[i].y} ${pts[i].x},${pts[i].y}`;
                    }
                    return path;
                  })()}
                  fill="none"
                  stroke="#f82268"
                  strokeWidth="3"
                  vectorEffect="non-scaling-stroke"
                />
                {/* Hover dots */}
                {revenueTimeline.map((d, i) => {
                  const w = 1000;
                  const x = (i / (revenueTimeline.length - 1)) * w;
                  const y = 256 - 8 - (maxRev > 0 ? (d.revenue / maxRev) * 240 : 0);
                  return (
                    <circle
                      key={i}
                      cx={x}
                      cy={y}
                      r={hoveredBar === i ? 6 : 3}
                      fill={hoveredBar === i ? "#f82268" : "transparent"}
                      stroke={hoveredBar === i ? "#fff" : "transparent"}
                      strokeWidth="2"
                      className="transition-all duration-200"
                    />
                  );
                })}
              </>
            )}
            {/* Invisible hover areas */}
            {revenueTimeline.map((_, i) => {
              const w = revenueTimeline.length > 1 ? 1000 : 100;
              const segW = w / revenueTimeline.length;
              return (
                <rect
                  key={`hover-${i}`}
                  x={i * segW}
                  y={0}
                  width={segW}
                  height={256}
                  fill="transparent"
                  onMouseEnter={() => setHoveredBar(i)}
                  className="cursor-pointer"
                />
              );
            })}
          </svg>
          {/* Hover tooltip */}
          {hoveredBar !== null && revenueTimeline[hoveredBar] && (
            <div
              className="absolute bg-on-background text-background text-[10px] font-bold px-3 py-2 rounded-xl whitespace-nowrap shadow-lg z-20 space-y-0.5 pointer-events-none"
              style={{
                left: `${revenueTimeline.length > 1 ? (hoveredBar / (revenueTimeline.length - 1)) * 100 : 50}%`,
                top: "0px",
                transform: "translateX(-50%)",
              }}
            >
              <p className="text-xs font-black">{fmt(revenueTimeline[hoveredBar].revenue)}</p>
              <p className="text-muted-foreground">{revenueTimeline[hoveredBar].label}</p>
            </div>
          )}
        </div>
        <div className="flex justify-between mt-3 overflow-x-auto">
          {revenueTimeline.map((d, i) => (
            <span
              key={i}
              className={cn(
                "flex-1 text-center text-[9px] font-bold uppercase tracking-widest transition-colors truncate px-0.5",
                hoveredBar === i ? "text-brand-pink" : "text-muted-foreground"
              )}
            >
              {d.label}
            </span>
          ))}
        </div>
      </div>

      {/* Revenue Breakdown + Source */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-secondary/50 rounded-[2rem] p-10">
          <span className="font-bold uppercase tracking-[0.2em] text-[10px] text-brand-pink mb-1 block">Attendees</span>
          <h3 className="text-xl font-black tracking-tighter text-on-background mb-2">Total Attendees</h3>
          <p className="text-3xl font-black text-on-background tabular-nums mb-6">{uniqueCustomers}</p>
          {attendeesByEvent.length > 0 ? (
            <div className="space-y-3">
              {attendeesByEvent.map((ev, i) => {
                const maxVal = attendeesByEvent[0]?.value || 1;
                const pct = (ev.value / maxVal) * 100;
                return (
                  <div key={i}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="font-bold text-on-background truncate max-w-[60%]">{ev.label}</span>
                      <span className="font-black tabular-nums text-on-background">{ev.value}</span>
                    </div>
                    <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${pct}%`, background: ev.color }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">No attendee data yet.</p>
          )}
        </div>
        <div className="bg-secondary/50 rounded-[2rem] p-10">
          <span className="font-bold uppercase tracking-[0.2em] text-[10px] text-brand-pink mb-1 block">Attribution</span>
          <h3 className="text-xl font-black tracking-tighter text-on-background mb-6">Revenue by Source</h3>
          <DonutChart data={sourceDonut} size={180} thickness={28} centerLabel="Sources" />
        </div>
      </div>

      {/* Top Events + Top Orgs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Top Events by Revenue */}
        <div className="bg-secondary/50 rounded-[2rem] p-10">
          <span className="font-bold uppercase tracking-[0.2em] text-[10px] text-brand-pink mb-1 block">Performance</span>
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-black tracking-tighter text-on-background">Top Events by Platform Revenue</h3>
            <button
              onClick={() => navigate("/admin/events-finance")}
              className="text-[10px] font-black uppercase tracking-widest text-brand-pink hover:underline"
            >
              See All →
            </button>
          </div>
          <div className="space-y-4">
            {platformRevenueByEvent.slice(0, 8).map((ev, i) => {
              const totalPlatRev = platformRevenueByEvent.reduce((s, e) => s + e.platformRevenue, 0);
              const pct = totalPlatRev > 0 ? (ev.platformRevenue / totalPlatRev) * 100 : 0;
              return (
                <div key={ev.eventId} className="flex items-center gap-4">
                  <span className="text-[10px] font-black text-muted-foreground w-5">{i + 1}</span>
                  <div className="w-8 h-8 rounded-lg overflow-hidden bg-secondary shrink-0">
                    {ev.flyerUrl ? (
                      <img src={ev.flyerUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-[10px] font-black text-muted-foreground">
                        {ev.title[0]}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-black text-on-background truncate">{ev.title}</p>
                    <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">{ev.orgName}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs font-black text-brand-pink tabular-nums">{fmt(ev.platformRevenue)}</p>
                    <p className="text-[9px] font-bold text-muted-foreground">{pct.toFixed(1)}%</p>
                  </div>
                </div>
              );
            })}
            {platformRevenueByEvent.length === 0 && (
              <p className="text-center text-muted-foreground text-xs py-8">No revenue data</p>
            )}
          </div>
        </div>

        {/* Top Orgs by Revenue */}
        <div className="bg-secondary/50 rounded-[2rem] p-10">
          <span className="font-bold uppercase tracking-[0.2em] text-[10px] text-brand-pink mb-1 block">Organizations</span>
          <h3 className="text-xl font-black tracking-tighter text-on-background mb-6">Top Organizations by Revenue</h3>
          <div className="space-y-4">
            {revenueByOrg.slice(0, 8).map((org, i) => {
              const pct = totalRevenue > 0 ? (org.revenue / totalRevenue) * 100 : 0;
              return (
                <div key={org.orgId} className="flex items-center gap-4">
                  <span className="text-[10px] font-black text-muted-foreground w-5">{i + 1}</span>
                  <div className="w-8 h-8 rounded-full overflow-hidden bg-secondary shrink-0">
                    {org.avatarUrl ? (
                      <img src={org.avatarUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-[10px] font-black text-muted-foreground">
                        {org.name[0]}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-black text-on-background truncate">{org.name}</p>
                  </div>
                  <div className="w-32">
                    <div className="h-2 rounded-full bg-secondary overflow-hidden">
                      <div className="h-full rounded-full bg-brand-pink transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                  <div className="text-right shrink-0 w-24">
                    <p className="text-xs font-black text-on-background tabular-nums">{fmt(org.revenue)}</p>
                    <p className="text-[9px] font-bold text-muted-foreground">{pct.toFixed(1)}%</p>
                  </div>
                </div>
              );
            })}
            {revenueByOrg.length === 0 && (
              <p className="text-center text-muted-foreground text-xs py-8">No revenue data</p>
            )}
          </div>
        </div>
      </div>

      {/* Recent Orders Table */}
      <div className="bg-secondary/50 rounded-[2rem] p-10">
        <div className="flex items-center justify-between mb-6">
          <div>
            <span className="font-bold uppercase tracking-[0.2em] text-[10px] text-brand-pink mb-1 block">Transactions</span>
            <h3 className="text-xl font-black tracking-tighter text-on-background">Recent Orders</h3>
          </div>
          <Button variant="outline" size="sm" onClick={() => navigate("/admin/orders")} className="text-xs font-bold uppercase tracking-widest">
            See All
          </Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-border">
                {["Order ID", "Date", "Customer", "Event", "Ticket", "Qty", "Unit Price", "Discount", "Service Fee", "Total", "Stripe Fee", "Platform Revenue", "Source"].map((h) => (
                  <th key={h} className="py-3 px-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredOrders.slice(0, 20).map((o) => {
                const ev = events.find((e) => e.id === o.event_id);
                const profile = profiles.find((p) => p.user_id === o.user_id);
                const f = computeOrderFinancials(o);
                const stripeFee = f.stripeFee;
                const platformRevenue = f.platformRevenue;
                return (
                  <tr key={o.id} className="border-b border-border/50 hover:bg-secondary/50 transition-colors">
                    <td className="py-3 px-3 text-[10px] font-mono font-bold text-muted-foreground tabular-nums whitespace-nowrap">{o.id.slice(0, 8).toUpperCase()}</td>
                    <td className="py-3 px-3 text-xs font-bold text-on-background tabular-nums whitespace-nowrap">{format(new Date(o.created_at), "MMM d, yyyy")}</td>
                    <td className="py-3 px-3 text-xs font-bold text-on-background truncate max-w-[120px]">{profile?.name || "—"}</td>
                    <td className="py-3 px-3 text-xs font-bold text-on-background truncate max-w-[150px]">{ev?.title || "—"}</td>
                    <td className="py-3 px-3 text-xs text-muted-foreground">{o.ticket_name}</td>
                    <td className="py-3 px-3 text-xs font-bold text-on-background tabular-nums">{o.quantity}</td>
                    <td className="py-3 px-3 text-xs font-bold text-on-background tabular-nums">{fmt(Number(o.unit_price))}</td>
                    <td className="py-3 px-3 text-xs text-red-500 tabular-nums">{Number(o.discount) > 0 ? `-${fmt(Number(o.discount))}` : "—"}</td>
                    <td className="py-3 px-3 text-xs text-muted-foreground tabular-nums">{fmt(Number(o.service_fee))}</td>
                    <td className="py-3 px-3 text-xs font-black text-on-background tabular-nums">{fmt(Number(o.total))}</td>
                    <td className="py-3 px-3 text-xs font-bold text-red-400 tabular-nums">{fmt(stripeFee)}</td>
                    <td className="py-3 px-3 text-xs font-black text-brand-pink tabular-nums">{fmt(platformRevenue)}</td>
                    <td className="py-3 px-3">
                      <span className="text-[9px] font-black uppercase tracking-widest bg-secondary px-2 py-1 rounded-full text-muted-foreground">
                        {(() => {
                          const src = o.ref_source;
                          if (src === "direct" || !src) return "Event Page";
                          if (src === "explore") return "Brazou";
                          if (src === "instagram") return "Instagram";
                          const isAdmin = trackingLinkSlugs.some(t => t.slug === src && t.created_by_admin);
                          return isAdmin ? "Promotions" : "Tracking Links";
                        })()}
                      </span>
                    </td>
                  </tr>
                );
              })}
              {filteredOrders.length === 0 && (
                <tr><td colSpan={13} className="text-center text-muted-foreground py-12 text-xs">No orders in this period</td></tr>
              )}
            {(() => {
              const displayed = filteredOrders.slice(0, 20);
              const sumUnitPrice = displayed.reduce((s, o) => s + Number(o.unit_price), 0);
              const sumDiscount = displayed.reduce((s, o) => s + Number(o.discount), 0);
              const sumServiceFee = displayed.reduce((s, o) => s + Number(o.service_fee), 0);
              const sumTotal = displayed.reduce((s, o) => s + Number(o.total), 0);
              const sumStripeFee = displayed.reduce((s, o) => {
                const pv = Number(o.unit_price) * o.quantity + Number(o.service_fee);
                return s + pv * 0.029 + 0.30;
              }, 0);
              const sumPlatformRev = displayed.reduce((s, o) => {
                const pv = Number(o.unit_price) * o.quantity + Number(o.service_fee);
                const sf = pv * 0.029 + 0.30;
                return s + Number(o.service_fee) - sf;
              }, 0);
              return (
                <tr className="border-t-2 border-border bg-secondary/30">
                  <td colSpan={6} className="py-3 px-3 text-[10px] font-black uppercase tracking-widest text-on-background">Totals</td>
                  <td className="py-3 px-3 text-xs font-black text-on-background tabular-nums">{fmt(sumUnitPrice)}</td>
                  <td className="py-3 px-3 text-xs font-black text-red-500 tabular-nums">{sumDiscount > 0 ? `-${fmt(sumDiscount)}` : "—"}</td>
                  <td className="py-3 px-3 text-xs font-black text-muted-foreground tabular-nums">{fmt(sumServiceFee)}</td>
                  <td className="py-3 px-3 text-xs font-black text-on-background tabular-nums">{fmt(sumTotal)}</td>
                  <td className="py-3 px-3 text-xs font-black text-red-400 tabular-nums">{fmt(sumStripeFee)}</td>
                  <td className="py-3 px-3 text-xs font-black text-brand-pink tabular-nums">{fmt(sumPlatformRev)}</td>
                  <td className="py-3 px-3"></td>
                </tr>
              );
            })()}
            </tbody>
          </table>
          {filteredOrders.length > 20 && (
            <p className="text-center text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-4">
              Showing 20 of {filteredOrders.length} orders
            </p>
          )}
        </div>
      </div>
    </div>
      </>
      )}
    </div>
  );
};

export default AdminFinanceTab;
