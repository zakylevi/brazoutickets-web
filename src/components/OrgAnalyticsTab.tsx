import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { TrendingUp, Users, MapPin, Trophy, UserPlus, Calendar, Heart } from "lucide-react";
import DonutChart, { type DonutCategory } from "@/components/DonutChart";
import AnimatedNumber from "@/components/AnimatedNumber";
import { useOrganizations } from "@/contexts/OrganizationContext";
import { supabase } from "@/integrations/supabase/client";

// Gender detection via common first names (shared logic)
const MALE_NAMES = new Set(["hugo","isaac","james","john","robert","michael","david","william","richard","joseph","thomas","charles","christopher","daniel","matthew","anthony","mark","donald","steven","paul","andrew","joshua","kenneth","kevin","brian","george","timothy","ronald","edward","jason","jeffrey","ryan","jacob","gary","nicholas","eric","jonathan","stephen","larry","justin","scott","brandon","benjamin","samuel","raymond","gregory","frank","alexander","patrick","jack","dennis","jerry","tyler","aaron","jose","adam","nathan","henry","peter","zachary","douglas","harold","gabriel","carl","arthur","bruce","logan","albert","eugene","gerald","roger","keith","lawrence","terry","sean","jesse","austin","noah","ethan","dylan","lucas","liam","mason","aiden","elijah","oliver","owen","carter","connor","luke","caleb","hunter","isaiah","christian","landon","jordan","cameron","evan","leo","mateo","thiago","pedro","rafael","diego","bruno","felipe","gustavo","henrique","caio","vinicius","bernardo","enzo","davi","miguel","arthur","heitor","theo","murilo","pietro","luan","gabriel","lucas","guilherme","eduardo","fernando","marcelo","rodrigo","andre","fabio","sergio","paulo","carlos","marcos","jorge","antonio","luis","leandro","renato","alessandro","danilo","renan","igor","artur"]);
const FEMALE_NAMES = new Set(["mary","patricia","jennifer","linda","barbara","elizabeth","susan","jessica","sarah","karen","lisa","nancy","betty","margaret","sandra","ashley","emily","donna","michelle","dorothy","carol","amanda","melissa","deborah","stephanie","rebecca","sharon","laura","cynthia","kathleen","amy","angela","shirley","anna","brenda","pamela","emma","nicole","helen","samantha","katherine","christine","debra","rachel","carolyn","janet","catherine","maria","heather","diane","ruth","julia","olivia","grace","victoria","rose","mia","sophia","isabella","ava","charlotte","amelia","harper","abigail","ella","madison","chloe","scarlett","aria","riley","zoey","lily","eleanor","hannah","natalie","lillian","savannah","brooklyn","leah","stella","hazel","aurora","ana","juliana","larissa","camila","fernanda","beatriz","carolina","mariana","gabriela","rafaela","isabela","leticia","bruna","amanda","bianca","jessica","tatiana","vanessa","daniela","priscila","renata","aline","patricia","adriana","cristina","natalia"]);

const guessGender = (name: string): "male" | "female" | "other" => {
  const first = (name || "").trim().split(/\s+/)[0].toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (MALE_NAMES.has(first)) return "male";
  if (FEMALE_NAMES.has(first)) return "female";
  return "other";
};

interface OrgAnalyticsTabProps {
  orgSlug: string;
  dbOrders: any[];
  dbEvents: any[];
}

const OrgAnalyticsTab = ({ orgSlug, dbOrders, dbEvents }: OrgAnalyticsTabProps) => {
  const navigate = useNavigate();
  const { getOrgBySlug } = useOrganizations();
  const org = getOrgBySlug(orgSlug);
  const [hoveredRegion, setHoveredRegion] = useState<number | null>(null);
  const [barAnim, setBarAnim] = useState(0);
  const [regionAnim, setRegionAnim] = useState(0);
  const [totalFollowers, setTotalFollowers] = useState(0);

  // Load follower count
  useEffect(() => {
    if (!org) return;
    supabase
      .from("organization_followers")
      .select("*", { count: "exact", head: true })
      .eq("organization_id", org.id)
      .then(({ count }) => setTotalFollowers(count || 0));
  }, [org]);

  // Animate bars and regions on mount
  useEffect(() => {
    setBarAnim(0);
    setRegionAnim(0);
    const start = performance.now();
    const duration = 1200;
    const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
    const animate = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      setBarAnim(easeOut(progress));
      setRegionAnim(easeOut(Math.min(elapsed / 1000, 1)));
      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, []);

  // --- Total Customers (unique attendees) ---
  const uniqueUserMap = useMemo(() => {
    const map = new Map<string, { name: string; city?: string; state?: string }>();
    dbOrders.forEach((o) => {
      if (!map.has(o.user_id)) {
        map.set(o.user_id, {
          name: o.profiles?.name || "",
          city: o.profiles?.city || "",
          state: o.profiles?.state || "",
        });
      }
    });
    return map;
  }, [dbOrders]);

  const totalCustomers = uniqueUserMap.size;

  // --- New This Month (first-time buyers within org this month) ---
  const newThisMonth = useMemo(() => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    // For each user find their earliest order
    const firstOrderMap = new Map<string, Date>();
    dbOrders.forEach((o) => {
      const d = new Date(o.created_at);
      const existing = firstOrderMap.get(o.user_id);
      if (!existing || d < existing) firstOrderMap.set(o.user_id, d);
    });
    let count = 0;
    firstOrderMap.forEach((firstDate) => {
      if (firstDate >= startOfMonth) count++;
    });
    return count;
  }, [dbOrders]);

  // --- Gender Breakdown ---
  const genderData = useMemo<DonutCategory[]>(() => {
    let male = 0, female = 0, other = 0;
    uniqueUserMap.forEach(({ name }) => {
      const g = guessGender(name);
      if (g === "male") male++;
      else if (g === "female") female++;
      else other++;
    });
    return [
      { label: "Male", value: male, color: "hsl(210, 80%, 55%)" },
      { label: "Female", value: female, color: "hsl(343, 94%, 55%)" },
      { label: "Others", value: other, color: "hsl(48, 96%, 53%)" },
    ].filter((d) => d.value > 0);
  }, [uniqueUserMap]);

  // --- Top Regions (from billing address) ---
  const topRegions = useMemo(() => {
    const regionCount = new Map<string, number>();
    const userRegion = new Map<string, string>();
    dbOrders.forEach((o) => {
      if (!userRegion.has(o.user_id)) {
        const city = (o.billing_city || "").trim();
        const state = (o.billing_state || "").trim().toUpperCase().slice(0, 2);
        const country = (o.billing_country || "").trim().toUpperCase().slice(0, 3);
        if (city) {
          const parts = [city];
          if (state) parts.push(state);
          if (country) parts.push(country);
          userRegion.set(o.user_id, parts.join(", "));
        }
      }
    });
    userRegion.forEach((region) => {
      regionCount.set(region, (regionCount.get(region) || 0) + 1);
    });
    const sorted = Array.from(regionCount.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6);
    const total = sorted.reduce((s, [, c]) => s + c, 0) || 1;
    return sorted.map(([name, count]) => ({
      name,
      count,
      pct: Math.round((count / total) * 100),
    }));
  }, [dbOrders]);

  // --- New Customers with period toggle ---
  const [customersPeriod, setCustomersPeriod] = useState<"week" | "month" | "year">("month");

  const newCustomersData = useMemo(() => {
    const now = new Date();

    if (customersPeriod === "week") {
      // Last 8 weeks
      const buckets: { label: string; start: Date; end: Date }[] = [];
      for (let i = 7; i >= 0; i--) {
        const end = new Date(now);
        end.setDate(end.getDate() - i * 7);
        end.setHours(23, 59, 59, 999);
        const start = new Date(end);
        start.setDate(start.getDate() - 6);
        start.setHours(0, 0, 0, 0);
        const label = `${start.toLocaleString("en", { month: "short" })} ${start.getDate()}`;
        buckets.push({ label, start, end });
      }
      const firstOrderMap = new Map<string, Date>();
      dbOrders.forEach((o) => {
        const d = new Date(o.created_at);
        const existing = firstOrderMap.get(o.user_id);
        if (!existing || d < existing) firstOrderMap.set(o.user_id, d);
      });
      return buckets.map(({ label, start, end }) => {
        let value = 0;
        firstOrderMap.forEach((firstDate) => {
          if (firstDate >= start && firstDate <= end) value++;
        });
        return { month: label, value };
      });
    }

    if (customersPeriod === "year") {
      // Last 6 years
      const buckets: { label: string; start: Date; end: Date }[] = [];
      for (let i = 5; i >= 0; i--) {
        const year = now.getFullYear() - i;
        buckets.push({
          label: String(year),
          start: new Date(year, 0, 1),
          end: new Date(year + 1, 0, 1),
        });
      }
      const firstOrderMap = new Map<string, Date>();
      dbOrders.forEach((o) => {
        const d = new Date(o.created_at);
        const existing = firstOrderMap.get(o.user_id);
        if (!existing || d < existing) firstOrderMap.set(o.user_id, d);
      });
      return buckets.map(({ label, start, end }) => {
        let value = 0;
        firstOrderMap.forEach((firstDate) => {
          if (firstDate >= start && firstDate < end) value++;
        });
        return { month: label, value };
      });
    }

    // Default: month (last 6 months)
    const months: { month: string; start: Date; end: Date }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
      months.push({
        month: d.toLocaleString("en", { month: "short" }),
        start: d,
        end,
      });
    }
    const firstOrderMap = new Map<string, Date>();
    dbOrders.forEach((o) => {
      const d = new Date(o.created_at);
      const existing = firstOrderMap.get(o.user_id);
      if (!existing || d < existing) firstOrderMap.set(o.user_id, d);
    });
    return months.map(({ month, start, end }) => {
      let value = 0;
      firstOrderMap.forEach((firstDate) => {
        if (firstDate >= start && firstDate < end) value++;
      });
      return { month, value };
    });
  }, [dbOrders, customersPeriod]);

  const maxBarVal = Math.max(...newCustomersData.map((m) => m.value), 1);

  // --- Event Ranking (top 5 by revenue) ---
  const eventRanking = useMemo(() => {
    const eventRevenueMap = new Map<string, { revenue: number; tickets: number }>();
    dbOrders.forEach((o) => {
      const existing = eventRevenueMap.get(o.event_id) || { revenue: 0, tickets: 0 };
      const gross = Math.max(0, Number(o.unit_price) || 0) * Math.max(1, o.quantity || 1);
      const discount = Math.max(0, Number(o.discount) || 0);
      const refunded = Math.max(0, Number(o.refunded_amount) || 0);
      existing.revenue += gross - discount - refunded;
      existing.tickets += o.quantity || 1;
      eventRevenueMap.set(o.event_id, existing);
    });
    const eventMap = new Map(dbEvents.map((e: any) => [e.id, e]));
    return Array.from(eventRevenueMap.entries())
      .map(([eventId, { revenue, tickets }]) => {
        const ev = eventMap.get(eventId);
        let formattedDate = "";
        if (ev) {
          const monthNames: Record<string, string> = { JAN: "January", FEB: "February", MAR: "March", APR: "April", MAY: "May", JUN: "June", JUL: "July", AUG: "August", SEP: "September", OCT: "October", NOV: "November", DEC: "December" };
          const monthName = monthNames[(ev.month || "").toUpperCase()] || ev.month || "";
          formattedDate = `${monthName} ${ev.date}, ${ev.year}`;
        }
        return {
          eventId,
          name: ev?.title || "Unknown Event",
          revenue,
          tickets,
          date: formattedDate,
        };
      })
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5)
      .map((e, i) => ({ ...e, rank: i + 1 }));
  }, [dbOrders, dbEvents]);

  // --- Average Order Value ---
  const averageOrderValue = useMemo(() => {
    if (dbOrders.length === 0) return 0;
    const totalRevenue = dbOrders.reduce((sum, o) => {
      const gross = Math.max(0, Number(o.unit_price) || 0) * Math.max(1, o.quantity || 1);
      const discount = Math.max(0, Number(o.discount) || 0);
      const refunded = Math.max(0, Number(o.refunded_amount) || 0);
      return sum + (gross - discount - refunded);
    }, 0);
    return totalRevenue / dbOrders.length;
  }, [dbOrders]);

  // Average age placeholder
  const genderRatioDisplay = useMemo(() => {
    const total = genderData.reduce((s, d) => s + d.value, 0) || 1;
    const male = genderData.find((d) => d.label === "Male")?.value || 0;
    const female = genderData.find((d) => d.label === "Female")?.value || 0;
    return `${Math.round((male / total) * 100)}% / ${Math.round((female / total) * 100)}%`;
  }, [genderData]);


  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl md:text-4xl font-black tracking-tighter text-foreground mb-1">Analytics</h1>
        <p className="text-muted-foreground text-sm">Deep dive into your audience demographics and event performance.</p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Customers", numValue: totalCustomers, icon: Users, accent: "foreground" },
          { label: "New This Month", numValue: newThisMonth, prefix: "+", icon: UserPlus, accent: "brand-lime" },
          { label: "Gender Ratio", displayValue: genderRatioDisplay, icon: TrendingUp, accent: "foreground", sub: "M / F" },
          { label: "Total Followers", numValue: totalFollowers, icon: Heart, accent: "brand-pink" },
        ].map((stat, i) => (
          <div key={i} className="p-6 bg-card rounded-3xl border border-border relative overflow-hidden group hover:shadow-lg transition-all">
            <div className="flex items-center gap-2 mb-3">
              <stat.icon className="w-4 h-4 text-muted-foreground" />
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">{stat.label}</p>
            </div>
            <h2 className={`text-3xl font-black ${stat.accent === "brand-lime" ? "text-[hsl(var(--brand-lime))]" : stat.accent === "brand-pink" ? "text-[hsl(var(--brand-pink))]" : "text-foreground"}`}>
              {stat.numValue !== undefined ? (
                <AnimatedNumber value={stat.numValue} prefix={stat.prefix || ""} suffix={(stat as any).suffix || ""} />
              ) : (
                stat.displayValue
              )}
            </h2>
            {stat.sub && <p className="text-xs text-muted-foreground mt-1 font-medium">{stat.sub}</p>}
          </div>
        ))}
      </div>

      {/* Donut Charts Row: Gender + Retention */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Gender Breakdown */}
        <div className="p-8 bg-card rounded-3xl border border-border">
          <h3 className="text-xl font-black text-foreground mb-6">Gender Breakdown</h3>
          <div className="flex justify-center">
            {totalCustomers > 0 ? (
              <DonutChart data={genderData} size={220} thickness={36} centerLabel="Total" isCurrency={false} />
            ) : (
              <p className="text-muted-foreground text-sm py-12">No customer data yet.</p>
            )}
          </div>
        </div>

        {/* Average Order Value */}
        <div className="p-8 bg-card rounded-3xl border border-border">
          <div className="flex items-center gap-2 mb-6">
            <TrendingUp className="w-5 h-5 text-[hsl(var(--brand-pink))]" />
            <h3 className="text-xl font-black text-foreground">Average Order Value</h3>
          </div>
          <div className="flex flex-col items-center justify-center py-8">
            <span className="text-5xl font-black text-[hsl(var(--brand-pink))] tabular-nums">
              ${averageOrderValue.toFixed(2)}
            </span>
            <span className="text-sm text-muted-foreground mt-3 font-medium">per order (excl. fees)</span>
          </div>
        </div>
      </div>

      {/* Top Regions - full width */}
      <div className="p-8 bg-card rounded-3xl border border-border">
        <div className="flex items-center gap-2 mb-6">
          <MapPin className="w-5 h-5 text-[hsl(var(--brand-pink))]" />
          <h3 className="text-xl font-black text-foreground">Top Regions</h3>
        </div>
        {topRegions.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
            {topRegions.map((r, i) => (
              <div
                key={r.name}
                className="group/region cursor-default"
                onMouseEnter={() => setHoveredRegion(i)}
                onMouseLeave={() => setHoveredRegion(null)}
              >
                <div className="flex justify-between text-xs mb-1.5 font-bold uppercase tracking-wider">
                  <span className="flex items-center gap-2">
                    <span className="text-muted-foreground w-5 text-right tabular-nums">{i + 1}.</span>
                    <span className={hoveredRegion === i ? "text-[hsl(var(--brand-pink))]" : "text-foreground"}>{r.name}</span>
                  </span>
                  <span className="tabular-nums text-muted-foreground">
                    <AnimatedNumber value={r.count} className="tabular-nums" /> <span className="text-foreground font-black">({r.pct}%)</span>
                  </span>
                </div>
                <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${r.pct * regionAnim}%`,
                      background: hoveredRegion === i
                        ? "hsl(var(--brand-pink))"
                        : i === 0
                          ? "hsl(var(--brand-pink))"
                          : `hsl(343, 94%, ${55 + i * 8}%)`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground text-sm py-12 text-center">No region data yet.</p>
        )}
      </div>

      {/* New Customers */}
      <div className="p-8 bg-card rounded-3xl border border-border">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-[hsl(var(--brand-lime))]" />
            <h3 className="text-xl font-black text-foreground">New Customers</h3>
          </div>
          <div className="flex gap-1">
            {(["week", "month", "year"] as const).map(p => (
              <button
                key={p}
                onClick={() => setCustomersPeriod(p)}
                className={`px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-[0.15em] transition-colors ${
                  customersPeriod === p ? "bg-foreground text-background" : "bg-secondary text-muted-foreground hover:bg-secondary/80"
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
        <p className="text-sm text-muted-foreground mb-6">
          {customersPeriod === "week" ? "Weekly" : customersPeriod === "year" ? "Yearly" : "Monthly"} new customer acquisition.
        </p>
        <div className="flex items-end gap-3 h-48">
          {newCustomersData.map((m, i) => {
            const heightPct = (m.value / maxBarVal) * 100;
            const isLatest = i === newCustomersData.length - 1;
            return (
              <div key={m.month} className="flex-1 flex flex-col items-center gap-2 h-full relative group/bar">
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1.5 bg-popover border border-border rounded-lg text-[10px] font-bold whitespace-nowrap opacity-0 group-hover/bar:opacity-100 transition-opacity pointer-events-none z-20 shadow-lg">
                  <span className={isLatest ? "text-[hsl(var(--brand-lime))]" : "text-[hsl(var(--brand-pink))]"}>+{m.value}</span>
                </div>
                <div className="w-full flex-1 flex items-end">
                  <div
                    className={`w-full rounded-t-xl transition-all ${
                      isLatest
                        ? "bg-[hsl(var(--brand-lime))] shadow-lg shadow-[hsl(var(--brand-lime))]/20"
                        : "bg-[hsl(var(--brand-pink))]/20 group-hover/bar:bg-[hsl(var(--brand-pink))]/50"
                    }`}
                    style={{ height: `${heightPct * barAnim}%`, transition: "height 0.05s linear" }}
                  />
                </div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{m.month}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Event Ranking */}
      <div className="bg-card rounded-3xl border border-border overflow-hidden">
        <div className="p-8 pb-4 flex items-center gap-2">
          <Trophy className="w-5 h-5 text-[hsl(var(--brand-pink))]" />
          <h3 className="text-xl font-black text-foreground">Event Ranking</h3>
          <span className="text-xs text-muted-foreground font-medium ml-2">Top 5 by revenue</span>
        </div>
        {eventRanking.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-8 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground w-12">#</th>
                  <th className="px-8 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Event</th>
                  <th className="px-8 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Date</th>
                  <th className="px-8 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground text-right">Tickets Sold</th>
                  <th className="px-8 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground text-right">Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {eventRanking.map((ev) => (
                  <tr key={ev.rank} className="group hover:bg-secondary/50 transition-colors cursor-pointer" onClick={() => navigate(`/dashboard/${orgSlug}/event/${ev.eventId}`)}>
                    <td className="px-8 py-5">
                      <span className={`text-lg font-black tabular-nums ${
                        ev.rank === 1 ? "text-[hsl(var(--brand-pink))]" : ev.rank === 2 ? "text-foreground" : "text-muted-foreground"
                      }`}>
                        {ev.rank}
                      </span>
                    </td>
                    <td className="px-8 py-5">
                      <p
                        className="font-bold text-foreground group-hover:text-[hsl(var(--brand-pink))] transition-colors cursor-pointer"
                        onClick={(e) => { e.stopPropagation(); navigate(`/dashboard/${orgSlug}/event/${ev.eventId}`); }}
                      >{ev.name}</p>
                    </td>
                    <td className="px-8 py-5 text-sm font-medium text-muted-foreground">{ev.date}</td>
                    <td className="px-8 py-5 text-right font-bold text-foreground tabular-nums">
                      <AnimatedNumber value={ev.tickets} />
                    </td>
                    <td className="px-8 py-5 text-right font-black text-[hsl(var(--brand-pink))] tabular-nums">
                      <AnimatedNumber value={Math.round(ev.revenue)} prefix="$" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-muted-foreground text-sm px-8 pb-8">No event revenue data yet.</p>
        )}
      </div>
    </div>
  );
};

export default OrgAnalyticsTab;
