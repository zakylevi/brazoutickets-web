import { useState, useMemo } from "react";
import { ArrowLeft, Building2, CalendarDays, Users, DollarSign, Ticket, Search, ArrowUpDown, ArrowUp, ArrowDown, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import AnimatedNumber from "@/components/AnimatedNumber";

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
}

interface OrgStat {
  id: string;
  name: string;
  avatar_url: string | null;
  slug: string;
  type: string;
  eventCount: number;
  ownerName: string;
  ownerUserId: string;
  totalRevenue: number;
  totalAttendees: number;
  createdAt: string;
  region: string;
  country: string;
  state: string;
  socials: any;
  links: any;
  created_by: string;
}

type SortCol = "title" | "status" | "revenue" | "ticketsSold" | "date";
type TimePeriod = "all" | "month" | "year";

interface AdminOrgDetailProps {
  org: OrgStat;
  allEvents: EventStat[];
  onBack: () => void;
  onOwnerClick: () => void;
}

const formatCurrency = (val: number) =>
  val.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 });

const AdminOrgDetail = ({ org, allEvents, onBack, onOwnerClick }: AdminOrgDetailProps) => {
  const [search, setSearch] = useState("");
  const [sortCol, setSortCol] = useState<SortCol | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [revenuePeriod, setRevenuePeriod] = useState<TimePeriod>("all");
  const [ticketsPeriod, setTicketsPeriod] = useState<TimePeriod>("all");

  const orgEvents = useMemo(() => allEvents.filter(e => e.orgSlug === org.slug), [allEvents, org.slug]);

  const today = new Date().toISOString().slice(0, 10);
  const getDisplayStatus = (ev: EventStat) => {
    if (ev.status === "cancelled") return "cancelled";
    const endDate = ev.date || "";
    if (endDate && endDate < today) return "ended";
    return ev.status;
  };

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfYear = new Date(now.getFullYear(), 0, 1);

  const filterByPeriod = (events: EventStat[], period: TimePeriod) => {
    if (period === "all") return events;
    return events.filter(e => {
      if (!e.date) return false;
      const d = new Date(e.date + "T12:00:00");
      return period === "month" ? d >= startOfMonth : d >= startOfYear;
    });
  };

  const periodRevenue = useMemo(() => {
    return filterByPeriod(orgEvents, revenuePeriod).reduce((s, e) => s + e.revenue, 0);
  }, [orgEvents, revenuePeriod]);

  const periodTickets = useMemo(() => {
    return filterByPeriod(orgEvents, ticketsPeriod).reduce((s, e) => s + e.ticketsSold, 0);
  }, [orgEvents, ticketsPeriod]);

  // Gender/age placeholder analytics
  const genderSplit = { male: 54, female: 40, other: 6 };
  const ageSplit = [
    { label: "18-24", pct: 42 },
    { label: "25-34", pct: 31 },
    { label: "35-44", pct: 18 },
    { label: "45+", pct: 9 },
  ];

  const handleSort = (col: SortCol) => {
    if (sortCol === col) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortCol(col); setSortDir("desc"); }
  };

  const SortIcon = ({ col }: { col: SortCol }) => {
    if (sortCol !== col) return <ArrowUpDown className="w-3 h-3 ml-1 opacity-40" />;
    return sortDir === "asc" ? <ArrowUp className="w-3 h-3 ml-1" /> : <ArrowDown className="w-3 h-3 ml-1" />;
  };

  const filteredEvents = useMemo(() => {
    let list = [...orgEvents];
    if (statusFilter !== "ALL") list = list.filter(e => getDisplayStatus(e) === statusFilter.toLowerCase());
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(e => e.title.toLowerCase().includes(q));
    }
    if (sortCol) {
      list.sort((a, b) => {
        let av: any, bv: any;
        if (sortCol === "title") { av = a.title.toLowerCase(); bv = b.title.toLowerCase(); }
        else if (sortCol === "date") { av = a.date || ""; bv = b.date || ""; }
        else if (sortCol === "status") { av = a.status; bv = b.status; }
        else if (sortCol === "revenue") { av = a.revenue; bv = b.revenue; }
        else if (sortCol === "ticketsSold") { av = a.ticketsSold; bv = b.ticketsSold; }
        else { av = 0; bv = 0; }
        if (av < bv) return sortDir === "asc" ? -1 : 1;
        if (av > bv) return sortDir === "asc" ? 1 : -1;
        return 0;
      });
    }
    return list;
  }, [orgEvents, statusFilter, search, sortCol, sortDir]);

  const statuses = ["ALL", "LIVE", "DRAFT", "SOLD_OUT", "ENDED", "CANCELLED"];

  const PeriodPills = ({ value, onChange }: { value: TimePeriod; onChange: (v: TimePeriod) => void }) => (
    <div className="flex gap-1">
      {(["all", "month", "year"] as TimePeriod[]).map(p => (
        <button
          key={p}
          onClick={() => onChange(p)}
          className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-[0.15em] transition-colors ${
            value === p ? "bg-foreground text-background" : "bg-secondary text-muted-foreground hover:bg-secondary/80"
          }`}
        >
          {p === "all" ? "All" : p === "month" ? "Month" : "Year"}
        </button>
      ))}
    </div>
  );

  return (
    <div className="space-y-8">
      {/* Back button */}
      <button onClick={onBack} className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors group">
        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
        <span className="text-xs font-black uppercase tracking-[0.2em]">Back to Organizations</span>
      </button>

      {/* Header */}
      <div className="flex items-start gap-6">
        <div className="w-20 h-20 rounded-2xl overflow-hidden flex-shrink-0 bg-secondary ring-2 ring-border">
          {org.avatar_url ? (
            <img src={org.avatar_url} alt={org.name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-primary text-primary-foreground font-black text-2xl">
              {org.name[0]?.toUpperCase()}
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-3xl md:text-4xl font-black tracking-tighter text-foreground">{org.name}</h1>
          <div className="flex flex-wrap items-center gap-4 mt-2">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground bg-secondary px-3 py-1 rounded-full">
              {org.type.replace("_", " ")}
            </span>
            <span className="flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground">
              <CalendarDays className="w-3 h-3" />
              Joined {new Date(org.createdAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
            </span>
          </div>
          <div className="mt-2">
            <button onClick={onOwnerClick} className="text-xs font-bold text-muted-foreground hover:text-primary transition-colors">
              Owner: <span className="underline">{org.ownerName}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Revenue */}
        <div className="p-6 bg-card rounded-3xl border border-border">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-muted-foreground" />
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Total Revenue</p>
            </div>
            <PeriodPills value={revenuePeriod} onChange={setRevenuePeriod} />
          </div>
          <h2 className="text-2xl font-black text-foreground">{formatCurrency(periodRevenue)}</h2>
        </div>

        {/* Total Tickets Sold */}
        <div className="p-6 bg-card rounded-3xl border border-border">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Ticket className="w-4 h-4 text-muted-foreground" />
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Tickets Sold</p>
            </div>
            <PeriodPills value={ticketsPeriod} onChange={setTicketsPeriod} />
          </div>
          <h2 className="text-2xl font-black text-foreground">
            <AnimatedNumber value={periodTickets} />
          </h2>
        </div>

        {/* Total Events */}
        <div className="p-6 bg-card rounded-3xl border border-border">
          <div className="flex items-center gap-2 mb-3">
            <CalendarDays className="w-4 h-4 text-muted-foreground" />
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Total Events</p>
          </div>
          <h2 className="text-2xl font-black text-foreground">
            <AnimatedNumber value={orgEvents.length} />
          </h2>
        </div>

        {/* Total Attendees */}
        <div className="p-6 bg-card rounded-3xl border border-border">
          <div className="flex items-center gap-2 mb-3">
            <Users className="w-4 h-4 text-muted-foreground" />
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Total Attendees</p>
          </div>
          <h2 className="text-2xl font-black text-foreground">
            <AnimatedNumber value={org.totalAttendees} />
          </h2>
        </div>
      </div>

      {/* Customer Analytics */}
      <div className="bg-card rounded-3xl border border-border p-8">
        <h3 className="text-xl font-black text-foreground mb-6">Customer Analytics</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Gender Split */}
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground mb-4">Gender Split</p>
            <div className="space-y-3">
              {[
                { label: "Male", pct: genderSplit.male, color: "bg-[hsl(210,80%,55%)]" },
                { label: "Female", pct: genderSplit.female, color: "bg-[hsl(343,94%,55%)]" },
                { label: "Other", pct: genderSplit.other, color: "bg-[hsl(48,96%,53%)]" },
              ].map(g => (
                <div key={g.label}>
                  <div className="flex justify-between text-xs font-bold mb-1">
                    <span className="text-foreground">{g.label}</span>
                    <span className="text-muted-foreground tabular-nums">{g.pct}%</span>
                  </div>
                  <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${g.color}`} style={{ width: `${g.pct}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Age Demographics */}
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground mb-4">Age Demographics</p>
            <div className="space-y-3">
              {ageSplit.map(a => (
                <div key={a.label}>
                  <div className="flex justify-between text-xs font-bold mb-1">
                    <span className="text-foreground">{a.label}</span>
                    <span className="text-muted-foreground tabular-nums">{a.pct}%</span>
                  </div>
                  <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${a.pct}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* All Events */}
      <div className="bg-card rounded-3xl border border-border overflow-hidden">
        <div className="p-8 pb-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <h3 className="text-xl font-black text-foreground">All Events</h3>
            <div className="flex items-center gap-3 flex-wrap">
              {/* Status Filter */}
              <div className="flex gap-1">
                {statuses.map(s => (
                  <button
                    key={s}
                    onClick={() => setStatusFilter(s)}
                    className={`px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-[0.15em] transition-colors ${
                      statusFilter === s ? "bg-foreground text-background" : "bg-secondary text-muted-foreground hover:bg-secondary/80"
                    }`}
                  >
                    {s.replace("_", " ")}
                  </button>
                ))}
              </div>
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search events..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 pr-4 py-2 rounded-full bg-secondary border-none text-xs font-bold text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 w-48"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border">
                {([
                  { key: "title" as SortCol, label: "Event" },
                  { key: "date" as SortCol, label: "Date" },
                  { key: "status" as SortCol, label: "Status" },
                  { key: "ticketsSold" as SortCol, label: "Attendees" },
                  { key: "revenue" as SortCol, label: "Revenue" },
                ]).map(col => (
                  <th
                    key={col.key}
                    onClick={() => handleSort(col.key)}
                    className="px-8 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground cursor-pointer hover:text-foreground transition-colors select-none"
                  >
                    <span className="flex items-center">
                      {col.label}
                      <SortIcon col={col.key} />
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {filteredEvents.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-8 py-16 text-center text-muted-foreground text-sm">No events found</td>
                </tr>
              ) : (
                filteredEvents.map(ev => (
                  <tr key={ev.id} className="group hover:bg-secondary/50 transition-colors">
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-3">
                        {ev.flyer_url && (
                          <div className="w-10 h-10 rounded-xl overflow-hidden flex-shrink-0 bg-secondary">
                            <img src={ev.flyer_url} alt="" className="w-full h-full object-cover" />
                          </div>
                        )}
                        <span className="font-bold text-foreground group-hover:text-primary transition-colors truncate max-w-[200px]">{ev.title}</span>
                      </div>
                    </td>
                    <td className="px-8 py-5 text-sm font-medium text-muted-foreground whitespace-nowrap">
                      {ev.date ? new Date(ev.date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"}
                    </td>
                    <td className="px-8 py-5">
                      {(() => {
                        const displayStatus = getDisplayStatus(ev);
                        return (
                          <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-[0.15em] ${
                            displayStatus === "live" ? "bg-emerald-500/10 text-emerald-500" :
                            displayStatus === "draft" ? "bg-amber-500/10 text-amber-500" :
                            displayStatus === "sold_out" ? "bg-primary/10 text-primary" :
                            displayStatus === "ended" ? "bg-muted text-muted-foreground" :
                            "bg-destructive/10 text-destructive"
                          }`}>
                            {displayStatus.replace("_", " ")}
                          </span>
                        );
                      })()}
                    </td>
                    <td className="px-8 py-5 text-sm font-bold text-foreground tabular-nums">
                      <AnimatedNumber value={ev.ticketsSold} />
                    </td>
                    <td className="px-8 py-5 text-sm font-black text-primary tabular-nums">
                      {formatCurrency(ev.revenue)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdminOrgDetail;
