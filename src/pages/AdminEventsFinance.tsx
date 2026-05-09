import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ChevronUp, ChevronDown, ArrowUpDown } from "lucide-react";
import { computeOrderFinancials, countUniqueGroups } from "@/lib/orderFinancials";
import { Button } from "@/components/ui/button";
import { useAdminGuard } from "@/hooks/useAdminGuard";


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

type SortKey = "index" | "title" | "orgName" | "totalOrders" | "totalRefunded" | "grossTicket" | "serviceFees" | "processingRevenue" | "stripeFees" | "platformRevenue";
type SortDir = "asc" | "desc";

const columns: { key: SortKey; label: string }[] = [
  { key: "index", label: "#" },
  { key: "title", label: "Event" },
  { key: "orgName", label: "Organizer" },
  { key: "totalOrders", label: "Total Orders" },
  { key: "totalRefunded", label: "Total Refunded" },
  { key: "grossTicket", label: "Gross Ticket Revenue" },
  { key: "serviceFees", label: "Service Fees" },
  { key: "processingRevenue", label: "Processing Revenue" },
  { key: "stripeFees", label: "Stripe Fees" },
  { key: "platformRevenue", label: "Platform Revenue" },
];

const AdminEventsFinance = () => {
  const navigate = useNavigate();
  const { isAdmin, checking: adminLoading } = useAdminGuard();
  const [orders, setOrders] = useState<Order[]>([]);
  const [events, setEvents] = useState<EventInfo[]>([]);
  const [orgs, setOrgs] = useState<OrgInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>("platformRevenue");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  useEffect(() => {
    if (!isAdmin && !adminLoading) {
      navigate("/");
      return;
    }
    const fetchData = async () => {
      const [ordersRes, eventsRes, orgsRes] = await Promise.all([
        supabase.from("orders").select("*"),
        supabase.from("events").select("id, title, organization_id, flyer_url"),
        supabase.from("organizations").select("id, name, avatar_url"),
      ]);
      setOrders((ordersRes.data as Order[]) || []);
      setEvents((eventsRes.data as EventInfo[]) || []);
      setOrgs((orgsRes.data as OrgInfo[]) || []);
      setLoading(false);
    };
    if (isAdmin) fetchData();
  }, [isAdmin, adminLoading, navigate]);

  const eventBreakdown = useMemo(() => {
    // Group orders by event
    const eventOrdersMap = new Map<string, Order[]>();
    orders.forEach((o) => {
      const arr = eventOrdersMap.get(o.event_id) || [];
      arr.push(o);
      eventOrdersMap.set(o.event_id, arr);
    });

    const items = [...eventOrdersMap.entries()]
      .map(([eventId, eventOrders], i) => {
        const ev = events.find((e) => e.id === eventId);
        const org = ev ? orgs.find((o) => o.id === ev.organization_id) : null;

        let grossTicketOriginal = 0;
        let totalRefunded = 0;
        let serviceFees = 0;
        let processingRevenue = 0;

        eventOrders.forEach((o) => {
          const f = computeOrderFinancials(o);
          grossTicketOriginal += f.subtotal;
          totalRefunded += Math.max(0, Number((o as any).refunded_amount || 0));
          serviceFees += f.serviceFee;
          processingRevenue += f.processingValue;
        });

        // Count unique checkout groups for Stripe $0.30 flat fee
        const uniqueGroups = countUniqueGroups(eventOrders);
        const stripeFees = processingRevenue * 0.029 + 0.30 * uniqueGroups;
        const grossTicket = grossTicketOriginal - totalRefunded;

        return {
          eventId,
          title: ev?.title || "Unknown",
          flyerUrl: ev?.flyer_url,
          orgName: org?.name || "Unknown",
          orgAvatar: org?.avatar_url,
          grossTicket,
          totalRefunded,
          totalOrders: uniqueGroups,
          serviceFees,
          processingRevenue,
          stripeFees,
          platformRevenue: serviceFees - stripeFees,
          orders: uniqueGroups,
          index: i,
        };
      });

    items.sort((a, b) => {
      let valA: number | string;
      let valB: number | string;
      switch (sortKey) {
        case "title": valA = a.title.toLowerCase(); valB = b.title.toLowerCase(); break;
        case "orgName": valA = a.orgName.toLowerCase(); valB = b.orgName.toLowerCase(); break;
        case "index": valA = a.index; valB = b.index; break;
        default: valA = a[sortKey]; valB = b[sortKey]; break;
      }
      if (valA < valB) return sortDir === "asc" ? -1 : 1;
      if (valA > valB) return sortDir === "asc" ? 1 : -1;
      return 0;
    });

    return items;
  }, [orders, events, orgs, sortKey, sortDir]);

  const fmt = (v: number) => v.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });

  if (adminLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-brand-pink border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const totals = eventBreakdown.reduce(
    (acc, ev) => ({
      grossTicket: acc.grossTicket + ev.grossTicket,
      totalOrders: acc.totalOrders + ev.totalOrders,
      totalRefunded: acc.totalRefunded + ev.totalRefunded,
      serviceFees: acc.serviceFees + ev.serviceFees,
      processingRevenue: acc.processingRevenue + ev.processingRevenue,
      stripeFees: acc.stripeFees + ev.stripeFees,
      platformRevenue: acc.platformRevenue + ev.platformRevenue,
    }),
    { grossTicket: 0, totalOrders: 0, totalRefunded: 0, serviceFees: 0, processingRevenue: 0, stripeFees: 0, platformRevenue: 0 }
  );

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <ArrowUpDown className="w-3 h-3 text-muted-foreground/40" />;
    return sortDir === "asc" ? <ChevronUp className="w-3 h-3 text-brand-pink" /> : <ChevronDown className="w-3 h-3 text-brand-pink" />;
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-7xl mx-auto px-6 py-10">
        <Button variant="ghost" onClick={() => navigate("/admin")} className="mb-6 gap-2">
          <ArrowLeft className="w-4 h-4" /> Back to Admin
        </Button>

        <h1 className="text-3xl font-black tracking-tighter text-on-background mb-2">Events Financial Breakdown</h1>
        <p className="text-sm text-muted-foreground mb-8">Platform revenue breakdown for all events (all time)</p>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-10">
          {[
            { label: "Gross Ticket Revenue", value: fmt(totals.grossTicket) },
            { label: "Service Fees Collected", value: fmt(totals.serviceFees) },
            { label: "Total Processing Revenue", value: fmt(totals.processingRevenue) },
            { label: "Total Stripe Fees", value: fmt(totals.stripeFees), color: "text-red-400" },
            { label: "Net Platform Revenue", value: fmt(totals.platformRevenue), bg: "bg-[#CDFF00] text-black" },
          ].map((c) => (
            <div key={c.label} className={`rounded-2xl p-6 ${c.bg || "bg-secondary/50"}`}>
              <p className={`text-[10px] font-bold uppercase tracking-[0.2em] mb-2 ${c.bg ? "text-black/60" : "text-muted-foreground"}`}>{c.label}</p>
              <p className={`text-2xl font-black tabular-nums ${c.color || (c.bg ? "text-black" : "text-on-background")}`}>{c.value}</p>
            </div>
          ))}
        </div>

        {/* Events Table */}
        <div className="bg-secondary/50 rounded-[2rem] p-8 overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-border">
                {columns.map((col) => (
                  <th
                    key={col.key}
                    onClick={() => toggleSort(col.key)}
                    className="py-3 px-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground cursor-pointer select-none hover:text-foreground transition-colors"
                  >
                    <span className="inline-flex items-center gap-1.5">
                      {col.label}
                      <SortIcon col={col.key} />
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {eventBreakdown.map((ev, i) => (
                <tr key={ev.eventId} className="border-b border-border/50 hover:bg-secondary/50 transition-colors">
                  <td className="py-4 px-3 text-xs font-black text-muted-foreground">{i + 1}</td>
                  <td className="py-4 px-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg overflow-hidden bg-secondary shrink-0">
                        {ev.flyerUrl ? (
                          <img src={ev.flyerUrl} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-xs font-black text-muted-foreground">{ev.title[0]}</div>
                        )}
                      </div>
                      <span
                        className="text-xs font-black text-on-background truncate max-w-[200px] cursor-pointer hover:text-brand-pink transition-colors"
                        onClick={() => navigate(`/admin?event=${ev.eventId}`)}
                      >{ev.title}</span>
                    </div>
                  </td>
                  <td className="py-4 px-3">
                    <div className="flex items-center gap-2">
                      {ev.orgAvatar ? (
                        <img src={ev.orgAvatar} alt="" className="w-6 h-6 rounded-full object-cover" />
                      ) : (
                        <div className="w-6 h-6 rounded-full bg-secondary flex items-center justify-center text-[9px] font-black text-muted-foreground">{ev.orgName[0]}</div>
                      )}
                      <span className="text-xs font-bold text-muted-foreground">{ev.orgName}</span>
                    </div>
                  </td>
                  <td className="py-4 px-3 text-xs font-bold text-on-background tabular-nums">{ev.totalOrders}</td>
                  <td className="py-4 px-3 text-xs font-bold text-red-400 tabular-nums">{ev.totalRefunded > 0 ? fmt(ev.totalRefunded) : "—"}</td>
                  <td className="py-4 px-3 text-xs font-bold text-on-background tabular-nums">{fmt(ev.grossTicket)}</td>
                  <td className="py-4 px-3 text-xs font-bold text-on-background tabular-nums">{fmt(ev.serviceFees)}</td>
                  <td className="py-4 px-3 text-xs font-bold text-on-background tabular-nums">{fmt(ev.processingRevenue)}</td>
                  <td className="py-4 px-3 text-xs font-bold text-red-400 tabular-nums">{fmt(ev.stripeFees)}</td>
                  <td className="py-4 px-3 text-xs font-black text-brand-pink tabular-nums">{fmt(ev.platformRevenue)}</td>
                </tr>
              ))}
              {eventBreakdown.length === 0 && (
                <tr><td colSpan={10} className="text-center text-muted-foreground py-12 text-xs">No events with orders</td></tr>
              )}
            </tbody>
            {eventBreakdown.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-border">
                  <td colSpan={3} className="py-4 px-3 text-xs font-black uppercase tracking-widest text-on-background">Total</td>
                  <td className="py-4 px-3 text-xs font-black text-on-background tabular-nums">{totals.totalOrders}</td>
                  <td className="py-4 px-3 text-xs font-black text-red-400 tabular-nums">{fmt(totals.totalRefunded)}</td>
                  <td className="py-4 px-3 text-xs font-black text-on-background tabular-nums">{fmt(totals.grossTicket)}</td>
                  <td className="py-4 px-3 text-xs font-black text-on-background tabular-nums">{fmt(totals.serviceFees)}</td>
                  <td className="py-4 px-3 text-xs font-black text-on-background tabular-nums">{fmt(totals.processingRevenue)}</td>
                  <td className="py-4 px-3 text-xs font-black text-red-400 tabular-nums">{fmt(totals.stripeFees)}</td>
                  <td className="py-4 px-3 text-xs font-black text-brand-pink tabular-nums">{fmt(totals.platformRevenue)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdminEventsFinance;
