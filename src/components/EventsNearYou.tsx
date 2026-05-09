import { useState, useEffect } from "react";
import { Navigation, ArrowRight, Calendar, MapPin, Image as ImageIcon } from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useUserLocation } from "@/hooks/useUserLocation";

interface NearbyEvent {
  id: string;
  title: string;
  flyer_url: string | null;
  venue: string;
  city: string;
  date: string | null;
  time: string | null;
  category: string;
  price: string;
  ticket_types: { price: string }[];
}

const MONTH_NAMES = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
const DAY_NAMES = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

const EventsNearYou = () => {
  const { location, loading: locationLoading, setManualLocation } = useUserLocation();
  const [events, setEvents] = useState<NearbyEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [showCityInput, setShowCityInput] = useState(false);
  const [manualCity, setManualCity] = useState("");

  const cityLabel = location.city;
  const stateLabel = location.state;
  const displayLocation = [cityLabel, stateLabel].filter(Boolean).join(", ");

  useEffect(() => {
    if (locationLoading) return;
    const loadEvents = async () => {
      setEventsLoading(true);
      const today = new Date().toISOString().split("T")[0];

      let query = supabase
        .from("events")
        .select("id, title, flyer_url, venue, city, date, time, category, price, ticket_types(price)")
        .eq("status", "live")
        .gte("date", today)
        .order("date", { ascending: true })
        .limit(6);

      if (location.city) {
        query = query.ilike("city", `%${location.city}%`);
      }

      const { data } = await query;

      // If no events in this city, fetch global upcoming
      if (!data || data.length === 0) {
        const { data: globalData } = await supabase
          .from("events")
          .select("id, title, flyer_url, venue, city, date, time, category, price, ticket_types(price)")
          .eq("status", "live")
          .gte("date", today)
          .order("date", { ascending: true })
          .limit(6);
        setEvents((globalData as any) || []);
      } else {
        setEvents((data as any) || []);
      }
      setEventsLoading(false);
    };
    loadEvents();
  }, [location.city, locationLoading]);

  const handleManualSubmit = () => {
    const trimmed = manualCity.trim();
    if (trimmed) {
      setManualLocation(trimmed, "", "");
      setShowCityInput(false);
      setManualCity("");
    }
  };

  const formatEventTime = (ev: NearbyEvent) => {
    if (!ev.date) return "";
    const d = new Date(ev.date + "T00:00:00");
    const day = DAY_NAMES[d.getDay()];
    const time = ev.time || "";
    return time ? `${day} • ${time}` : day;
  };

  const getDisplayPrice = (ev: NearbyEvent) => {
    const ticketPrices = (ev.ticket_types || [])
      .map((t) => parseFloat(t.price))
      .filter((p) => !isNaN(p) && p > 0);
    const cheapest = ticketPrices.length > 0 ? Math.min(...ticketPrices) : null;
    if (cheapest !== null) return `$${(cheapest * 1.1 + 0.99).toFixed(2)}`;
    return ev.price && ev.price !== "0" && ev.price !== "" ? `$${ev.price}` : "Free";
  };

  return (
    <section className="py-24 bg-surface overflow-hidden">
      <div className="max-w-7xl mx-auto px-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 mb-16">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <span className="flex h-2 w-2 rounded-full bg-brand-pink animate-pulse" />
              <p className="text-brand-pink font-black tracking-[0.2em] text-xs uppercase">Curated For You</p>
            </div>
            <h2 className="text-5xl md:text-6xl font-black tracking-tight leading-none text-on-background text-balance">
              Events Near <br />
              <span className="text-brand-pink">
                {locationLoading ? "..." : displayLocation || "You"}
              </span>
            </h2>
          </div>
          <div className="flex items-center gap-4 bg-secondary p-2 rounded-full border border-border self-start md:self-end md:mb-2">
            {showCityInput ? (
              <form
                onSubmit={(e) => { e.preventDefault(); handleManualSubmit(); }}
                className="flex items-center gap-2 pl-4 pr-2"
              >
                <input
                  type="text"
                  value={manualCity}
                  onChange={(e) => setManualCity(e.target.value)}
                  placeholder="Enter city..."
                  className="bg-transparent text-sm font-bold text-foreground outline-none w-32 placeholder:text-muted-foreground"
                  autoFocus
                  maxLength={100}
                />
                <button
                  type="submit"
                  className="bg-brand-pink text-primary-foreground px-4 py-2 rounded-full font-bold text-xs"
                >
                  Go
                </button>
                <button
                  type="button"
                  onClick={() => setShowCityInput(false)}
                  className="text-muted-foreground text-xs font-bold hover:text-foreground transition-colors"
                >
                  Cancel
                </button>
              </form>
            ) : (
              <>
                <div className="flex items-center gap-2 pl-4 pr-2">
                  <Navigation className="w-5 h-5 text-brand-pink" />
                  <span className="text-sm font-bold text-foreground whitespace-nowrap">
                    {locationLoading ? "Detecting..." : displayLocation || "Unknown"}
                  </span>
                </div>
                <button
                  onClick={() => setShowCityInput(true)}
                  className="bg-surface text-foreground px-6 py-3 rounded-full font-bold text-sm shadow-sm border border-border hover:bg-brand-pink hover:text-primary-foreground transition-all"
                >
                  Change
                </button>
              </>
            )}
          </div>
        </div>

        {eventsLoading || locationLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="aspect-[4/5] rounded-3xl bg-secondary animate-pulse" />
            ))}
          </div>
        ) : events.length === 0 ? (
          <div className="text-center py-20 rounded-3xl border border-border bg-secondary">
            <p className="text-4xl mb-4">🎭</p>
            <h3 className="text-xl font-black text-on-background mb-2">No upcoming events found</h3>
            <p className="text-muted-foreground font-medium text-sm mb-6">
              Try changing your location or check back soon.
            </p>
            <button
              onClick={() => setShowCityInput(true)}
              className="bg-brand-pink text-primary-foreground px-8 py-3 rounded-full font-bold text-sm hover:scale-105 transition-all"
            >
              Change City
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {events.map((event) => {
              const eventDate = event.date ? new Date(event.date + "T00:00:00") : null;
              return (
                <Link
                  to={`/event/${event.id}`}
                  key={event.id}
                  className="group relative aspect-[4/5] rounded-3xl overflow-hidden bg-secondary shadow-xl transition-transform duration-500 hover:scale-[1.02]"
                >
                  {event.flyer_url ? (
                    <img
                      alt={event.title}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000"
                      src={event.flyer_url}
                      loading="lazy"
                      decoding="async"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-muted">
                      <ImageIcon className="w-12 h-12 text-muted-foreground" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />
                  <div className="absolute inset-0 p-6 flex flex-col justify-between">
                    <div className="flex justify-between items-start">
                      {event.category && (
                        <span className="bg-brand-lime text-black px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg">
                          {event.category}
                        </span>
                      )}
                    </div>
                    <div className="space-y-4">
                      <div>
                        <p className="text-brand-lime font-bold text-xs mb-1.5 tracking-wide uppercase">
                          {formatEventTime(event)} {event.venue ? `@ ${event.venue.toUpperCase()}` : ""}
                        </p>
                        <h3 className="text-2xl font-black text-white tracking-tight leading-tight">
                          {event.title || "Untitled Event"}
                        </h3>
                      </div>
                      <div className="flex items-center justify-between pt-4 border-t border-white/10">
                        <div className="flex flex-col">
                          <span className="text-white/60 text-[10px] font-bold uppercase tracking-widest">
                            {eventDate ? `${MONTH_NAMES[eventDate.getMonth()]} ${eventDate.getDate()}` : "TBA"}
                          </span>
                          <span className="text-white text-lg font-black">
                            {getDisplayPrice(event)}
                          </span>
                        </div>
                        <span className="bg-brand-pink text-white px-5 py-2.5 rounded-full font-black text-xs tracking-tight hover:bg-brand-lime hover:text-black transition-all shadow-lg">
                          GET TICKETS
                        </span>
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        <div className="flex justify-center mt-12">
          <Link
            to={`/explore?city=${encodeURIComponent(location.city)}`}
            className="group flex items-center gap-3 bg-brand-pink text-primary-foreground px-10 py-4 rounded-full font-black text-sm uppercase tracking-widest hover:bg-brand-lime hover:text-black transition-all shadow-xl"
          >
            MORE EVENTS NEAR YOU
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>
      </div>
    </section>
  );
};

export default EventsNearYou;
