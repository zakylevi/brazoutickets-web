import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import heroFestival from "@/assets/hero-festival.jpg";

interface PromotedEvent {
  id: string;
  title: string;
  subtitle: string;
  location: string;
  background_url: string | null;
  event_link: string;
  sort_order: number;
}

const HeroCarousel = () => {
  const [promotedEvents, setPromotedEvents] = useState<PromotedEvent[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);

  useEffect(() => {
    const fetchPromoted = async () => {
      const { data } = await supabase
        .from("promoted_events")
        .select("*")
        .neq("placement", "explorer")
        .order("sort_order", { ascending: true });
      if (data && data.length > 0) {
        setPromotedEvents(data);
      }
      setLoading(false);
    };
    fetchPromoted();
  }, []);

  const events = loading
    ? []
    : promotedEvents.length > 0
      ? promotedEvents
      : [{
          id: "fallback",
          title: "LOLLAPALOOZA BRASIL 2024",
          subtitle: "Experience the most iconic music festival in South America. Three days of pure magic at Interlagos.",
          location: "São Paulo • March 2024",
          background_url: heroFestival,
          event_link: "",
          sort_order: 0,
        }];

  const goNext = useCallback(() => setCurrentIndex((prev) => (prev + 1) % events.length), [events.length]);
  const goPrev = useCallback(() => setCurrentIndex((prev) => (prev - 1 + events.length) % events.length), [events.length]);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.targetTouches[0].clientX;
    touchEndX.current = null;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.targetTouches[0].clientX;
  };

  const handleTouchEnd = () => {
    if (touchStartX.current === null || touchEndX.current === null) return;
    const diff = touchStartX.current - touchEndX.current;
    const minSwipe = 50;
    if (diff > minSwipe) goNext();
    else if (diff < -minSwipe) goPrev();
    touchStartX.current = null;
    touchEndX.current = null;
  };

  if (loading) {
    return (
      <section className="relative pt-20 px-4 md:px-8 bg-surface">
        <div className="max-w-[1440px] mx-auto relative overflow-hidden rounded-5xl md:rounded-7xl shadow-2xl aspect-[4/5] md:aspect-[21/9] bg-secondary animate-pulse" />
      </section>
    );
  }

  const current = events[currentIndex] || events[0];

  // Split title into two lines at the first space after half the title length
  const titleParts = (() => {
    const t = current.title;
    const mid = Math.floor(t.length / 2);
    const spaceAfterMid = t.indexOf(" ", mid);
    if (spaceAfterMid === -1) return [t, ""];
    return [t.slice(0, spaceAfterMid), t.slice(spaceAfterMid + 1)];
  })();

  return (
    <section className="relative pt-20 px-2 md:px-8 bg-surface">
      <div
        className="max-w-[1440px] mx-auto relative group overflow-hidden rounded-3xl md:rounded-7xl shadow-2xl aspect-[3/4] sm:aspect-[16/9] md:aspect-[21/9]"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div className="absolute inset-0 z-0">
          <img
            alt={current.title}
            className="w-full h-full object-cover transition-opacity duration-700"
            src={current.background_url || heroFestival}
            width={1920}
            height={816}
            fetchPriority="high"
            decoding="async"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
        </div>
        <div className="absolute inset-0 z-10 flex flex-col justify-end p-5 md:p-20">
          <div className="max-w-2xl space-y-3 md:space-y-6">
            <div className="flex items-center gap-2 md:gap-3">
              <span className="bg-brand-lime text-on-background px-3 md:px-4 py-1 md:py-1.5 rounded-full text-[9px] md:text-[10px] font-black uppercase tracking-widest">
                Promoted Event
              </span>
              {current.location && (
                <span className="text-white/80 font-bold text-xs md:text-sm uppercase tracking-wider">
                  {current.location}
                </span>
              )}
            </div>
            <h1 className="text-3xl md:text-7xl font-black text-primary-foreground tracking-tight leading-none text-balance">
              {titleParts[0]} <br />
              {titleParts[1] && <span className="text-brand-lime">{titleParts[1]}</span>}
            </h1>
            {current.subtitle && (
              <p className="text-white/90 text-lg md:text-xl font-medium max-w-lg hidden md:block">
                {current.subtitle}
              </p>
            )}
            <div className="flex flex-wrap items-center gap-2 md:gap-4 pt-2 md:pt-4">
              {current.event_link ? (
                <Link
                  to={current.event_link}
                  className="bg-brand-pink text-primary-foreground px-6 py-2.5 md:px-10 md:py-4 rounded-full text-sm md:text-base font-black tracking-tight hover:scale-105 transition-all shadow-xl"
                >
                  BOOK TICKETS
                </Link>
              ) : (
                <button className="bg-brand-pink text-primary-foreground px-6 py-2.5 md:px-10 md:py-4 rounded-full text-sm md:text-base font-black tracking-tight hover:scale-105 transition-all shadow-xl">
                  BOOK TICKETS
                </button>
              )}
              <button className="bg-white/10 backdrop-blur-md border border-white/20 text-primary-foreground px-5 py-2.5 md:px-8 md:py-4 rounded-full text-sm md:text-base font-black tracking-tight hover:bg-white/20 transition-all">
                LEARN MORE
              </button>
            </div>
          </div>
        </div>
        <button
          onClick={goPrev}
          className="absolute left-6 top-1/2 -translate-y-1/2 z-20 w-14 h-14 rounded-full bg-white/10 backdrop-blur-xl border border-white/20 text-primary-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all hover:bg-brand-pink hover:border-brand-pink hidden md:flex"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
        <button
          onClick={goNext}
          className="absolute right-6 top-1/2 -translate-y-1/2 z-20 w-14 h-14 rounded-full bg-white/10 backdrop-blur-xl border border-white/20 text-primary-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all hover:bg-brand-pink hover:border-brand-pink hidden md:flex"
        >
          <ChevronRight className="w-6 h-6" />
        </button>
        <div className="absolute -bottom-3 md:bottom-8 left-1/2 -translate-x-1/2 z-20 flex gap-2">
          {events.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentIndex(idx)}
              className={`rounded-full transition-all ${
                idx === currentIndex
                  ? "w-8 h-1.5 bg-brand-pink"
                  : "w-1.5 h-1.5 bg-white/40 hover:bg-white/60"
              }`}
            />
          ))}
        </div>
      </div>
    </section>
  );
};

export default HeroCarousel;
