import { ArrowRight, Image as ImageIcon } from "lucide-react";
import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

interface TrendingEvent {
  id: string;
  title: string;
  flyer_url: string | null;
  city: string;
  date: string | null;
  clicks: number;
  category: string;
  ticket_types: { price: string }[];
}

const MONTH_NAMES = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

const getDisplayPrice = (ev: TrendingEvent) => {
  const ticketPrices = (ev.ticket_types || [])
    .map((t) => parseFloat(t.price))
    .filter((p) => !isNaN(p) && p > 0);
  const cheapest = ticketPrices.length > 0 ? Math.min(...ticketPrices) : null;
  if (cheapest !== null) return `From $${(cheapest * 1.1 + 0.99).toFixed(2)}`;
  return "Free";
};

const formatDate = (dateStr: string | null, city: string) => {
  if (!dateStr) return city;
  const d = new Date(dateStr + "T00:00:00");
  return `${MONTH_NAMES[d.getMonth()]} ${d.getDate()} • ${city}`;
};

const TrendingEvents = () => {
  const [events, setEvents] = useState<TrendingEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const today = new Date().toISOString().split("T")[0];
      const { data } = await supabase
        .from("events")
        .select("id, title, flyer_url, city, date, clicks, category, ticket_types(price)")
        .eq("status", "live")
        .gte("date", today)
        .order("clicks", { ascending: false })
        .limit(3);
      setEvents((data as any) || []);
      setLoading(false);
    };
    load();
  }, []);

  const main = events[0];
  const side1 = events[1];
  const side2 = events[2];

  return (
    <section className="py-24 bg-surface">
      <div className="max-w-7xl mx-auto px-8 mb-12 flex justify-between items-end">
        <div>
          <p className="text-brand-pink font-bold tracking-wider text-xs uppercase mb-3">Hot This Week</p>
          <h2 className="text-4xl md:text-5xl font-black tracking-tight text-on-background">Trending Events</h2>
        </div>
        <Link to="/explore" className="group text-brand-pink font-bold flex items-center gap-2 hover:opacity-80 transition-opacity">
          View All <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
        </Link>
      </div>
      <div className="max-w-7xl mx-auto px-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {loading ? (
          <>
            <div className="lg:col-span-2 lg:row-span-2 rounded-3xl bg-secondary animate-pulse aspect-[16/10] lg:aspect-auto min-h-[400px]" />
            <div className="rounded-3xl bg-secondary animate-pulse aspect-square" />
            <div className="rounded-3xl bg-secondary animate-pulse aspect-square" />
          </>
        ) : (
          <>
            {/* #1 Most Clicked - Main Card */}
            {main ? (
              <Link
                to={`/event/${main.id}`}
                className="lg:col-span-2 lg:row-span-2 group relative overflow-hidden rounded-3xl bg-secondary aspect-[16/10] lg:aspect-auto shadow-sm min-h-[220px]"
              >
                {main.flyer_url ? (
                  <img
                    alt={main.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-1000"
                    src={main.flyer_url}
                    loading="lazy"
                    decoding="async"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-muted">
                    <ImageIcon className="w-16 h-16 text-muted-foreground" />
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
                <div className="absolute top-8 left-8 flex gap-2">
                  <span className="bg-brand-lime text-black px-5 py-2 rounded-full text-[11px] font-black uppercase tracking-widest shadow-xl">
                    #1 Trending
                  </span>
                  {main.category && (
                    <span className="bg-brand-pink text-white px-4 py-2 rounded-full text-[11px] font-black uppercase tracking-widest shadow-xl">
                      {main.category}
                    </span>
                  )}
                </div>
                <div className="absolute bottom-10 left-10 right-10">
                  <p className="text-brand-lime text-sm font-bold uppercase tracking-tight mb-2">
                    {formatDate(main.date, main.city)}
                  </p>
                  <h3 className="text-white text-4xl lg:text-5xl font-black tracking-tight leading-none mb-6">
                    {main.title}
                  </h3>
                  <div className="flex items-center justify-between">
                    <span className="text-white/90 text-lg font-medium">{getDisplayPrice(main)}</span>
                    <span className="bg-surface text-foreground px-8 py-4 rounded-full font-bold group-hover:bg-brand-pink group-hover:text-white transition-all">
                      Get Tickets
                    </span>
                  </div>
                </div>
              </Link>
            ) : (
              <div className="lg:col-span-2 lg:row-span-2 rounded-3xl bg-secondary flex items-center justify-center min-h-[400px]">
                <p className="text-muted-foreground font-bold">No trending events</p>
              </div>
            )}

            {/* #2 Side Card */}
            {side1 ? (
              <Link
                to={`/event/${side1.id}`}
                className="group relative overflow-hidden rounded-3xl bg-secondary aspect-square shadow-sm"
              >
                {side1.flyer_url ? (
                  <img
                    alt={side1.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-1000"
                    src={side1.flyer_url}
                    loading="lazy"
                    decoding="async"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-muted">
                    <ImageIcon className="w-12 h-12 text-muted-foreground" />
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
                <div className="absolute top-4 left-4">
                  <span className="bg-brand-lime text-black px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">
                    #2
                  </span>
                </div>
                <div className="absolute bottom-8 left-8 right-8">
                  <p className="text-brand-lime text-xs font-bold uppercase tracking-tight mb-1">
                    {formatDate(side1.date, side1.city)}
                  </p>
                  <h3 className="text-white text-2xl font-bold tracking-tight mb-4">{side1.title}</h3>
                  <span className="text-white/80 text-sm font-medium">{getDisplayPrice(side1)}</span>
                </div>
              </Link>
            ) : (
              <div className="rounded-3xl bg-secondary aspect-square" />
            )}

            {/* #3 Side Card */}
            {side2 ? (
              <Link
                to={`/event/${side2.id}`}
                className="group relative overflow-hidden rounded-3xl bg-secondary aspect-square shadow-sm"
              >
                {side2.flyer_url ? (
                  <img
                    alt={side2.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-1000"
                    src={side2.flyer_url}
                    loading="lazy"
                    decoding="async"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-muted">
                    <ImageIcon className="w-12 h-12 text-muted-foreground" />
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
                <div className="absolute top-4 left-4">
                  <span className="bg-brand-lime text-black px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">
                    #3
                  </span>
                </div>
                <div className="absolute bottom-8 left-8 right-8">
                  <p className="text-brand-lime text-xs font-bold uppercase tracking-tight mb-1">
                    {formatDate(side2.date, side2.city)}
                  </p>
                  <h3 className="text-white text-2xl font-bold tracking-tight mb-4">{side2.title}</h3>
                  <span className="text-white/80 text-sm font-medium">{getDisplayPrice(side2)}</span>
                </div>
              </Link>
            ) : (
              <div className="rounded-3xl bg-secondary aspect-square" />
            )}
          </>
        )}
      </div>
    </section>
  );
};

export default TrendingEvents;
