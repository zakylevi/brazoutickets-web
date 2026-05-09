import { ArrowRight, ChevronLeft, ChevronRight, MapPin, Heart, Building2, SlidersHorizontal, Plus, X, Check, Search, Navigation } from "lucide-react";
import { useState, useRef, useEffect, useCallback } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useUserLocation } from "@/hooks/useUserLocation";
import exploreHero from "@/assets/explore-hero-samba.jpg";
import exploreTop1 from "@/assets/explore-top1.jpg";
import exploreTop2 from "@/assets/explore-top2.jpg";
import exploreTop3 from "@/assets/explore-top3.jpg";

interface TopEvent {
  rank: number;
  title: string;
  image: string;
  date: string;
  month: string;
  price: string;
  dbId: string;
}

type EventCategory = "Party" | "Concert" | "Festival" | "Comedy" | "Wellness" | "Business";
type AgeRestriction = "Everyone" | "18+" | "21+";
type DateRange = "All" | "This Week" | "This Month";

const discoverEvents = [
  {
    title: "Subterranean Beats: Rio Underground",
    description: "The most exclusive electronic venue opens its doors for a 12-hour immersive experience.",
    image: exploreTop1,
    date: "24",
    month: "AUG",
    location: "Rio de Janeiro",
    city: "Rio de Janeiro",
    price: "$120.00",
    category: "Party" as EventCategory,
    age: "18+" as AgeRestriction,
  },
  {
    title: "Sunsets & Sambistas: Ipanema",
    description: "Golden hour sessions with the masters of Brazilian percussion and cold cocktails.",
    image: exploreTop2,
    date: "02",
    month: "SEP",
    location: "Ipanema Beach",
    city: "Rio de Janeiro",
    price: "$85.00",
    
    category: "Festival" as EventCategory,
    age: "Everyone" as AgeRestriction,
  },
  {
    title: "Classics Transformed: Teatro Municipal",
    description: "A classical orchestra meets modern synth textures in the city's most iconic theater.",
    image: exploreTop3,
    date: "15",
    month: "SEP",
    location: "City Center",
    city: "Rio de Janeiro",
    price: "$250.00",
    category: "Concert" as EventCategory,
    age: "Everyone" as AgeRestriction,
  },
  {
    title: "Tropicália Revival: Lapa Arches",
    description: "A night celebrating the revolutionary sounds of Brazilian tropicália with modern twists.",
    image: exploreTop2,
    date: "22",
    month: "SEP",
    location: "Lapa, Rio",
    city: "Rio de Janeiro",
    price: "$95.00",
    badge: "New",
    category: "Concert" as EventCategory,
    age: "18+" as AgeRestriction,
  },
  {
    title: "Funk Carioca: Baile da Gaiola",
    description: "The biggest baile funk party returns with headliners from the favela funk scene.",
    image: exploreTop1,
    date: "29",
    month: "SEP",
    location: "Complexo da Maré",
    city: "Rio de Janeiro",
    price: "$60.00",
    category: "Party" as EventCategory,
    age: "18+" as AgeRestriction,
  },
  {
    title: "Afro-Brazilian Rhythms: Pelourinho",
    description: "Immerse yourself in the ancestral beats of Salvador's historic quarter.",
    image: exploreTop3,
    date: "05",
    month: "OCT",
    location: "Salvador",
    city: "Salvador",
    price: "$110.00",
    category: "Festival" as EventCategory,
    age: "Everyone" as AgeRestriction,
  },
  {
    title: "MPB Unplugged: Sala São Paulo",
    description: "Intimate acoustic sessions featuring the best of Música Popular Brasileira.",
    image: exploreTop2,
    date: "12",
    month: "OCT",
    location: "São Paulo",
    city: "São Paulo",
    price: "$180.00",
    category: "Concert" as EventCategory,
    age: "Everyone" as AgeRestriction,
  },
  {
    title: "Drum & Bass Warehouse: Vila Madalena",
    description: "An underground D&B rave in a converted warehouse with international DJs.",
    image: exploreTop1,
    date: "19",
    month: "OCT",
    location: "São Paulo",
    city: "São Paulo",
    price: "$75.00",
    
    category: "Party" as EventCategory,
    age: "21+" as AgeRestriction,
  },
  {
    title: "Forró das Antigas: Recife",
    description: "Traditional forró meets contemporary artists in a celebration of Northeastern culture.",
    image: exploreTop3,
    date: "26",
    month: "OCT",
    location: "Recife",
    city: "Recife",
    price: "$70.00",
    category: "Festival" as EventCategory,
    age: "Everyone" as AgeRestriction,
  },
];

const allCategories: EventCategory[] = ["Party", "Concert", "Festival", "Comedy", "Wellness", "Business"];
const allAges: AgeRestriction[] = ["Everyone", "18+", "21+"];
const allDateRanges: DateRange[] = ["All", "This Week", "This Month"];

const GOOGLE_MAPS_KEY = "AIzaSyBalU_2zolJX-4NL0an5rzXiv3gW3gOZCo";

interface ExplorerPromo {
  id: string;
  title: string;
  subtitle: string;
  location: string;
  background_url: string | null;
  event_link: string;
}

const Explore = () => {
  const [searchParams] = useSearchParams();
  const cityFromUrl = searchParams.get("city");
  const categoryFromUrl = searchParams.get("category") as EventCategory | null;
  useUserLocation(); // keep hook active for caching

  const [city, setCity] = useState("All");
  const [topCityOpen, setTopCityOpen] = useState(false);
  const topCityRef = useRef<HTMLDivElement>(null);
  const [showAll, setShowAll] = useState(false);
  const [dbEvents, setDbEvents] = useState<typeof discoverEvents>([]);
  const [topEvents, setTopEvents] = useState<TopEvent[]>([]);
  const [explorerPromos, setExplorerPromos] = useState<ExplorerPromo[]>([]);
  const [explorerPromosLoading, setExplorerPromosLoading] = useState(true);
  const [explorerIndex, setExplorerIndex] = useState(0);
  const explorerTouchStartX = useRef<number | null>(null);
  const explorerTouchEndX = useRef<number | null>(null);

  // Filter state
  const [selectedCity, setSelectedCity] = useState(cityFromUrl || "All Cities");
  const [selectedCategory, setSelectedCategory] = useState<EventCategory | null>(
    categoryFromUrl && allCategories.includes(categoryFromUrl) ? categoryFromUrl : null
  );
  const [selectedDateRange, setSelectedDateRange] = useState<DateRange>("All");
  const [selectedAge, setSelectedAge] = useState<AgeRestriction | null>(null);

  // City dropdown state
  const [cityOpen, setCityOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [citySearch, setCitySearch] = useState("");
  const [googleSuggestions, setGoogleSuggestions] = useState<{ label: string; city: string }[]>([]);
  const cityRef = useRef<HTMLDivElement>(null);
  const cityInputRef = useRef<HTMLInputElement>(null);
  const filterRef = useRef<HTMLDivElement>(null);

  // My Location / selected city coordinates
  const [usingMyLocation, setUsingMyLocation] = useState(false);
  const [myLocationLat, setMyLocationLat] = useState<number | null>(null);
  const [myLocationLng, setMyLocationLng] = useState<number | null>(null);
  const [selectedCityLat, setSelectedCityLat] = useState<number | null>(null);
  const [selectedCityLng, setSelectedCityLng] = useState<number | null>(null);

  // Geocode selected city to get lat/lng for proximity filtering
  useEffect(() => {
    if (selectedCity === "All Cities" || usingMyLocation) {
      setSelectedCityLat(null);
      setSelectedCityLng(null);
      return;
    }
    const geocodeCity = async () => {
      try {
        const res = await fetch(
          `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(selectedCity)}&key=${GOOGLE_MAPS_KEY}`
        );
        const data = await res.json();
        if (data.results?.[0]?.geometry?.location) {
          setSelectedCityLat(data.results[0].geometry.location.lat);
          setSelectedCityLng(data.results[0].geometry.location.lng);
        }
      } catch {
        setSelectedCityLat(null);
        setSelectedCityLng(null);
      }
    };
    geocodeCity();
  }, [selectedCity, usingMyLocation]);

  // Google Places Autocomplete (New API with CORS support)
  useEffect(() => {
    if (citySearch.trim().length < 2) {
      setGoogleSuggestions([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          "https://places.googleapis.com/v1/places:autocomplete",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Goog-Api-Key": GOOGLE_MAPS_KEY,
            },
            body: JSON.stringify({
              input: citySearch,
              includedPrimaryTypes: ["locality", "administrative_area_level_3", "sublocality"],
              languageCode: "en",
            }),
          }
        );
        if (!res.ok) {
          setGoogleSuggestions([]);
          return;
        }
        const data = await res.json();
        const suggestions = (data.suggestions || [])
          .filter((s: any) => s.placePrediction)
          .map((s: any) => ({
            label: s.placePrediction.text?.text || "",
            city: s.placePrediction.structuredFormat?.mainText?.text || s.placePrediction.text?.text || "",
          }));
        setGoogleSuggestions(suggestions.slice(0, 5));
      } catch {
        setGoogleSuggestions([]);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [citySearch]);

  // Fetch explorer promoted events
  useEffect(() => {
    const fetchExplorerPromos = async () => {
      const { data } = await supabase
        .from("promoted_events")
        .select("*")
        .eq("placement", "explorer")
        .order("sort_order", { ascending: true });
      if (data && data.length > 0) setExplorerPromos(data);
      setExplorerPromosLoading(false);
    };
    fetchExplorerPromos();
  }, []);

  // Fetch top events by clicks (top 10 live events)
  useEffect(() => {
    const fetchTopEvents = async () => {
      const today = new Date().toISOString().split("T")[0];
      const { data } = await supabase
        .from("events")
        .select("id, title, flyer_url, date, price, ticket_types(price), clicks")
        .eq("status", "live")
        .gte("date", today)
        .order("clicks", { ascending: false })
        .limit(10);
      if (data && data.length > 0) {
        const mapped: TopEvent[] = data.map((ev: any, idx: number) => {
          const eventDate = ev.date ? new Date(ev.date + "T12:00:00") : null;
          const ticketPrices = (ev.ticket_types || [])
            .map((t: any) => parseFloat(t.price))
            .filter((p: number) => !isNaN(p) && p > 0);
          const cheapest = ticketPrices.length > 0 ? Math.min(...ticketPrices) : null;
          const displayPrice = cheapest !== null
            ? `$${(cheapest * 1.1 + 0.99).toFixed(2)}`
            : (ev.price || "Free");
          return {
            rank: idx + 1,
            title: ev.title,
            image: ev.flyer_url || exploreTop1,
            date: eventDate ? String(eventDate.getDate()).padStart(2, "0") : "TBD",
            month: eventDate ? eventDate.toLocaleDateString("en-US", { month: "short" }).toUpperCase() : "",
            price: displayPrice,
            dbId: ev.id,
          };
        });
        setTopEvents(mapped);
      }
    };
    fetchTopEvents();
  }, []);

  // Fetch live events from database
  useEffect(() => {
    const fetchLiveEvents = async () => {
      const today = new Date().toISOString().split("T")[0];
      const { data } = await supabase
        .from("events")
        .select("*, ticket_types(price, sold, quantity)")
        .eq("status", "live")
        .gte("date", today);
      if (data && data.length > 0) {
        const mapped = data.map((ev: any) => {
          const eventDate = ev.date ? new Date(ev.date + "T12:00:00") : null;
          // Find cheapest ticket price
          const ticketPrices = (ev.ticket_types || [])
            .map((t: any) => parseFloat(t.price))
            .filter((p: number) => !isNaN(p) && p > 0);
          const cheapest = ticketPrices.length > 0 ? Math.min(...ticketPrices) : null;
          const displayPrice = cheapest !== null
            ? `$${(cheapest * 1.1 + 0.99).toFixed(2)}`
            : (ev.price || "Free");

          // Calculate sold percentage across all ticket types
          const tickets = ev.ticket_types || [];
          const totalQuantity = tickets.reduce((sum: number, t: any) => sum + (t.quantity || 0), 0);
          const totalSold = tickets.reduce((sum: number, t: any) => sum + (t.sold || 0), 0);
          const soldPercent = totalQuantity > 0 ? (totalSold / totalQuantity) * 100 : 0;
          const almostSoldOut = soldPercent >= 80;

          return {
            title: ev.title,
            description: ev.short_description || ev.description || "",
            image: ev.flyer_url || exploreTop1,
            date: eventDate ? String(eventDate.getDate()).padStart(2, "0") : "TBD",
            month: eventDate ? eventDate.toLocaleDateString("en-US", { month: "short" }).toUpperCase() : "",
            location: ev.venue || ev.city || "",
            city: ev.city || "",
            price: displayPrice,
            badge: almostSoldOut ? "Almost Sold Out" : undefined,
            category: (ev.category || "Party") as EventCategory,
            age: (ev.age_restriction || "18+") as AgeRestriction,
            dbId: ev.id,
            lat: ev.lat || null,
            lng: ev.lng || null,
          };
        });
        setDbEvents(mapped);
      }
    };
    fetchLiveEvents();
  }, []);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (cityRef.current && !cityRef.current.contains(e.target as Node)) setCityOpen(false);
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) setFilterOpen(false);
      if (topCityRef.current && !topCityRef.current.contains(e.target as Node)) setTopCityOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Combine hardcoded + DB events
  const allDiscoverEvents = [...dbEvents, ...discoverEvents];

  // Fallback: IP-based location
  const fallbackToIP = async () => {
    try {
      const res = await fetch("https://ipapi.co/json/");
      if (!res.ok) return;
      const data = await res.json();
      if (data.city) {
        setSelectedCity(data.city);
        setMyLocationLat(data.latitude || null);
        setMyLocationLng(data.longitude || null);
      } else {
        setSelectedCity("All Cities");
      }
    } catch {
      setSelectedCity("All Cities");
    }
  };

  // Handle "My Location" click
  const handleMyLocation = () => {
    localStorage.removeItem("brazou-user-location");
    setUsingMyLocation(true);
    setCityOpen(false);
    setCitySearch("");

    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          setMyLocationLat(lat);
          setMyLocationLng(lng);

          // Reverse geocode to get city name
          try {
            const res = await fetch(
              `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${GOOGLE_MAPS_KEY}`
            );
            const data = await res.json();
            let detectedCity = "";
            for (const result of data.results || []) {
              for (const comp of result.address_components || []) {
                if (comp.types?.includes("locality")) {
                  detectedCity = comp.long_name;
                  break;
                }
              }
              if (detectedCity) break;
            }
            if (detectedCity) {
              setSelectedCity(detectedCity);
            } else {
              setSelectedCity("All Cities");
            }
          } catch {
            setSelectedCity("All Cities");
          }
        },
        () => {
          // Permission denied - fallback to IP
          fallbackToIP();
        },
        { timeout: 8000 }
      );
    } else {
      // No geolocation support - fallback to IP
      fallbackToIP();
    }
  };

  // Helper: haversine distance in miles
  const distanceMiles = (lat1: number, lng1: number, lat2: number, lng2: number) => {
    const R = 3959;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };

  // Get the reference lat/lng for filtering (either My Location or geocoded city)
  const refLat = usingMyLocation ? myLocationLat : selectedCityLat;
  const refLng = usingMyLocation ? myLocationLng : selectedCityLng;

  // Filter logic - exact city match OR within 30mi radius
  const filteredEvents = allDiscoverEvents.filter((event) => {
    if (selectedCity !== "All Cities") {
      // Check exact city match (case-insensitive partial)
      const cityMatch = event.city.toLowerCase().includes(selectedCity.toLowerCase()) ||
                        selectedCity.toLowerCase().includes(event.city.toLowerCase());
      if (!cityMatch) {
        // Try 30mi radius if we have coordinates
        if (refLat && refLng && (event as any).lat && (event as any).lng) {
          const dist = distanceMiles(refLat, refLng, (event as any).lat, (event as any).lng);
          if (dist > 30) return false;
        } else {
          return false;
        }
      }
    }
    if (selectedCategory && event.category !== selectedCategory) return false;
    if (selectedAge && event.age !== selectedAge) return false;
    return true;
  });

  // When no events found for the city, compute closest events sorted by distance
  const closestEvents = (filteredEvents.length === 0 && selectedCity !== "All Cities" && refLat && refLng)
    ? allDiscoverEvents
        .filter((e) => (e as any).lat && (e as any).lng)
        .map((e) => ({ ...e, _dist: distanceMiles(refLat!, refLng!, (e as any).lat, (e as any).lng) }))
        .filter((e) => {
          if (selectedCategory && e.category !== selectedCategory) return false;
          if (selectedAge && e.age !== selectedAge) return false;
          return true;
        })
        .sort((a, b) => a._dist - b._dist)
        .slice(0, 6)
    : [];

  const visibleEvents = showAll ? filteredEvents : filteredEvents.slice(0, 3);
  const hasActiveFilters = selectedCity !== "All Cities" || selectedCategory || selectedAge || selectedDateRange !== "All";

  const clearFilters = () => {
    setSelectedCity("All Cities");
    setSelectedCategory(null);
    setSelectedDateRange("All");
    setSelectedAge(null);
    setUsingMyLocation(false);
    setMyLocationLat(null);
    setMyLocationLng(null);
  };

  return (
    <>
      <main className="pt-20 pb-32">
        {/* Trending Category Hero */}
        <section className="px-4 md:px-8 mt-6 max-w-[1440px] mx-auto">
          {explorerPromosLoading ? (
            <div className="relative w-full aspect-[16/10] md:aspect-[21/9] rounded-5xl md:rounded-7xl overflow-hidden bg-secondary animate-pulse shadow-2xl" />
          ) : (() => {
            const currentPromo = explorerPromos[explorerIndex] || null;
            if (!currentPromo) return null;
            const goNext = () => setExplorerIndex((prev) => (prev + 1) % explorerPromos.length);
            const goPrev = () => setExplorerIndex((prev) => (prev - 1 + explorerPromos.length) % explorerPromos.length);
            const handleTouchStart = (e: React.TouchEvent) => { explorerTouchStartX.current = e.targetTouches[0].clientX; explorerTouchEndX.current = null; };
            const handleTouchMove = (e: React.TouchEvent) => { explorerTouchEndX.current = e.targetTouches[0].clientX; };
            const handleTouchEnd = () => {
              if (explorerTouchStartX.current === null || explorerTouchEndX.current === null) return;
              const diff = explorerTouchStartX.current - explorerTouchEndX.current;
              if (diff > 50) goNext(); else if (diff < -50) goPrev();
              explorerTouchStartX.current = null; explorerTouchEndX.current = null;
            };
            return (
              <div
                className="relative w-full aspect-[3/4] sm:aspect-[16/10] md:aspect-[21/9] rounded-3xl md:rounded-7xl overflow-hidden bg-secondary group shadow-2xl"
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
              >
                <img
                  alt={currentPromo.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                  src={currentPromo.background_url || exploreHero}
                  width={1920}
                  height={800}
                  fetchPriority="high"
                  decoding="async"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                <div className="absolute bottom-0 left-0 p-5 md:p-20 w-full md:w-2/3">
                  <span className="inline-block px-3 md:px-4 py-1 md:py-1.5 mb-4 bg-brand-lime text-on-background rounded-full text-[9px] md:text-[10px] font-black uppercase tracking-widest">
                    Trending Event
                  </span>
                  {currentPromo.location && (
                    <span className="inline-block ml-2 md:ml-3 text-white/80 font-bold text-xs md:text-sm uppercase tracking-wider">
                      {currentPromo.location}
                    </span>
                  )}
                  <h1 className="text-3xl md:text-7xl font-black text-primary-foreground tracking-tight leading-none mb-4 text-balance">
                    {currentPromo.title}
                  </h1>
                  <p className="text-white/90 text-lg md:text-xl font-medium mb-6 leading-relaxed max-w-lg hidden md:block">
                    {currentPromo.subtitle}
                  </p>
                  {currentPromo.event_link ? (
                    <Link to={currentPromo.event_link} className="bg-brand-pink text-primary-foreground px-6 py-2.5 md:px-10 md:py-4 rounded-full text-sm md:text-base font-black tracking-tight inline-flex items-center gap-2 hover:scale-105 transition-all shadow-xl">
                      Discover Events
                      <ArrowRight className="w-4 h-4 md:w-5 md:h-5" />
                    </Link>
                  ) : (
                    <button className="bg-brand-pink text-primary-foreground px-6 py-2.5 md:px-10 md:py-4 rounded-full text-sm md:text-base font-black tracking-tight flex items-center gap-2 hover:scale-105 transition-all shadow-xl">
                      Discover Events
                      <ArrowRight className="w-4 h-4 md:w-5 md:h-5" />
                    </button>
                  )}
                </div>
                {explorerPromos.length > 1 && (
                  <>
                    <button onClick={goPrev} className="absolute left-6 top-1/2 -translate-y-1/2 z-20 w-14 h-14 rounded-full bg-white/10 backdrop-blur-xl border border-white/20 text-primary-foreground items-center justify-center opacity-0 group-hover:opacity-100 transition-all hover:bg-brand-pink hover:border-brand-pink hidden md:flex">
                      <ChevronLeft className="w-6 h-6" />
                    </button>
                    <button onClick={goNext} className="absolute right-6 top-1/2 -translate-y-1/2 z-20 w-14 h-14 rounded-full bg-white/10 backdrop-blur-xl border border-white/20 text-primary-foreground items-center justify-center opacity-0 group-hover:opacity-100 transition-all hover:bg-brand-pink hover:border-brand-pink hidden md:flex">
                      <ChevronRight className="w-6 h-6" />
                    </button>
                    <div className="absolute -bottom-3 md:bottom-8 left-1/2 -translate-x-1/2 z-20 flex gap-2">
                      {explorerPromos.map((_, idx) => (
                        <button
                          key={idx}
                          onClick={() => setExplorerIndex(idx)}
                          className={`rounded-full transition-all ${idx === explorerIndex ? "w-8 h-1.5 bg-brand-pink" : "w-1.5 h-1.5 bg-white/40 hover:bg-white/60"}`}
                        />
                      ))}
                    </div>
                  </>
                )}
              </div>
            );
          })()}
        </section>

        {/* Top Events Section */}
        <section className="py-24">
          <div className="px-8 mb-12 max-w-7xl mx-auto flex justify-between items-end">
            <div>
              <p className="text-brand-pink font-bold tracking-wider text-xs uppercase mb-3">Hot This Week</p>
              <h2 className="text-4xl md:text-5xl font-black tracking-tight text-on-background">Top Events</h2>
            </div>
            <div className="flex items-center gap-4">
              <a className="text-brand-pink font-bold text-sm tracking-tight hover:underline hidden md:inline" href="#">
                View Ranking
              </a>
              <div className="flex items-center gap-2 ml-4">
                <button className="w-12 h-12 rounded-full border border-brand-pink/20 flex items-center justify-center text-brand-pink hover:bg-brand-pink hover:text-primary-foreground transition-all active:scale-95">
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button className="w-12 h-12 rounded-full border border-brand-pink/20 flex items-center justify-center text-brand-pink hover:bg-brand-pink hover:text-primary-foreground transition-all active:scale-95">
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
          <div className="flex overflow-x-auto hide-scrollbar gap-8 px-8 max-w-7xl mx-auto">
            {topEvents.length === 0 && (
              <p className="text-muted-foreground text-sm">No live events yet.</p>
            )}
            {topEvents.map((event) => (
              <Link key={event.dbId} to={`/event/${event.dbId}?ref=explore`} className="flex-none w-72 relative group cursor-pointer">
                <div className="absolute top-4 right-4 z-10 bg-brand-pink text-primary-foreground w-10 h-10 rounded-full flex items-center justify-center font-black text-sm shadow-xl">
                  {event.rank}
                </div>
                <div className="relative aspect-[3/4] rounded-5xl overflow-hidden shadow-sm">
                  <img
                    alt={event.title}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000"
                    src={event.image}
                    loading="lazy"
                    decoding="async"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                  <div className="absolute top-5 left-5 bg-surface/90 backdrop-blur-md rounded-4xl p-3 text-center min-w-[56px]">
                    <span className="block text-brand-pink font-black text-2xl leading-none">{event.date}</span>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-foreground">{event.month}</span>
                  </div>
                  <div className="absolute bottom-6 left-6 right-6">
                    <p className="text-primary-foreground font-black text-xl leading-tight tracking-tight line-clamp-2 mb-2">{event.title}</p>
                    <span className="text-white/80 text-sm font-bold">{event.price}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* Main Feed */}
        <section className="py-24 bg-secondary-container">
          <div className="max-w-7xl mx-auto px-8">
            <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-4">
              <div>
                <p className="text-brand-pink font-bold tracking-wider text-xs uppercase mb-3">Browse</p>
                <h2 className="text-4xl md:text-5xl font-black tracking-tight text-on-background">Discover All Events</h2>
              </div>
              <div className="flex items-center gap-3 pb-2 md:pb-0 flex-wrap">
                {/* City Dropdown */}
                <div ref={cityRef} className="relative">
                  <button
                    onClick={() => { setCityOpen(!cityOpen); setFilterOpen(false); setCitySearch(""); setTimeout(() => cityInputRef.current?.focus(), 50); }}
                    className={`flex items-center gap-2 bg-surface px-5 py-3 rounded-full text-sm font-bold border transition-all cursor-pointer ${
                      selectedCity !== "All Cities" ? "border-brand-pink text-brand-pink" : "border-border text-foreground hover:border-brand-pink"
                    }`}
                  >
                    <Building2 className="w-4 h-4" />
                    <span>{selectedCity === "All Cities" ? "City" : selectedCity}</span>
                  </button>
                  {cityOpen && (
                    <div className="absolute left-0 md:left-auto md:right-0 top-full mt-2 bg-surface border border-border rounded-4xl shadow-2xl min-w-[260px] z-50 py-2">
                      <div className="px-3 pb-2 pt-1">
                        <div className="flex items-center gap-2 bg-secondary rounded-full px-4 py-2.5">
                          <Search className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                          <input
                            ref={cityInputRef}
                            type="text"
                            placeholder="Search city..."
                            value={citySearch}
                            onChange={(e) => setCitySearch(e.target.value)}
                            className="bg-transparent text-sm font-medium text-foreground placeholder:text-muted-foreground outline-none w-full"
                          />
                        </div>
                      </div>
                      <div className="max-h-[280px] overflow-y-auto">
                        {/* My Location option */}
                        {!citySearch && (
                          <button
                            onClick={handleMyLocation}
                            className="w-full flex items-center gap-3 px-5 py-3 text-sm font-bold transition-colors hover:bg-secondary text-brand-pink"
                          >
                            <Navigation className="w-4 h-4" />
                            My Location
                          </button>
                        )}
                        {/* All Cities option */}
                        {(!citySearch || "all cities".includes(citySearch.toLowerCase())) && (
                          <button
                            onClick={() => { setSelectedCity("All Cities"); setUsingMyLocation(false); setCityOpen(false); setCitySearch(""); }}
                            className={`w-full flex items-center justify-between px-5 py-3 text-sm font-medium transition-colors hover:bg-secondary ${
                              selectedCity === "All Cities" ? "text-brand-pink font-bold" : "text-foreground"
                            }`}
                          >
                            All Cities
                            {selectedCity === "All Cities" && <Check className="w-4 h-4 text-brand-pink" />}
                          </button>
                        )}
                        {/* Google Places suggestions */}
                        {citySearch.trim().length >= 2 && googleSuggestions.length > 0 && (
                          <>
                            {googleSuggestions.map((s) => (
                              <button
                                key={s.label}
                                onClick={() => { setSelectedCity(s.city); setUsingMyLocation(false); setCityOpen(false); setCitySearch(""); }}
                                className="w-full flex items-center gap-2 px-5 py-3 text-sm font-medium transition-colors hover:bg-secondary text-foreground"
                              >
                                <MapPin className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                                {s.label}
                              </button>
                            ))}
                          </>
                        )}
                        {/* No results */}
                        {citySearch.trim().length >= 2 && googleSuggestions.length === 0 && (
                          <p className="px-5 py-3 text-sm text-muted-foreground">No cities found</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Filters Dropdown */}
                <div ref={filterRef} className="relative">
                  <button
                    onClick={() => { setFilterOpen(!filterOpen); setCityOpen(false); }}
                    className={`flex items-center gap-2 bg-surface px-5 py-3 rounded-full text-sm font-bold border transition-all cursor-pointer ${
                      (selectedCategory || selectedAge || selectedDateRange !== "All") ? "border-brand-pink text-brand-pink" : "border-border text-foreground hover:border-brand-pink"
                    }`}
                  >
                    <SlidersHorizontal className="w-4 h-4" />
                    Filters
                    {(selectedCategory || selectedAge || selectedDateRange !== "All") && (
                      <span className="bg-brand-pink text-primary-foreground w-5 h-5 rounded-full text-[10px] font-black flex items-center justify-center">
                        {[selectedCategory, selectedAge, selectedDateRange !== "All" ? selectedDateRange : null].filter(Boolean).length}
                      </span>
                    )}
                  </button>
                  {filterOpen && (
                    <div className="absolute left-0 md:left-auto md:right-0 top-full mt-2 bg-surface border border-border rounded-4xl shadow-2xl min-w-[280px] max-w-[calc(100vw-2rem)] z-50 p-6 space-y-6">
                      {/* Category */}
                      <div>
                        <p className="text-brand-pink font-bold tracking-wider text-[10px] uppercase mb-3">Category</p>
                        <div className="flex flex-wrap gap-2">
                          {allCategories.map((cat) => (
                            <button
                              key={cat}
                              onClick={() => setSelectedCategory(selectedCategory === cat ? null : cat)}
                              className={`px-4 py-2 rounded-full text-xs font-bold tracking-tight transition-all ${
                                selectedCategory === cat
                                  ? "bg-brand-pink text-primary-foreground shadow-md"
                                  : "bg-secondary text-foreground hover:border-brand-pink border border-transparent hover:bg-surface"
                              }`}
                            >
                              {cat}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Date Range */}
                      <div>
                        <p className="text-brand-pink font-bold tracking-wider text-[10px] uppercase mb-3">Date</p>
                        <div className="flex gap-2">
                          {allDateRanges.map((dr) => (
                            <button
                              key={dr}
                              onClick={() => setSelectedDateRange(dr)}
                              className={`px-4 py-2 rounded-full text-xs font-bold tracking-tight transition-all ${
                                selectedDateRange === dr
                                  ? "bg-brand-pink text-primary-foreground shadow-md"
                                  : "bg-secondary text-foreground hover:bg-surface"
                              }`}
                            >
                              {dr === "All" ? "Any Date" : dr}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Age */}
                      <div>
                        <p className="text-brand-pink font-bold tracking-wider text-[10px] uppercase mb-3">Age</p>
                        <div className="flex gap-2">
                          {allAges.map((a) => (
                            <button
                              key={a}
                              onClick={() => setSelectedAge(selectedAge === a ? null : a)}
                              className={`px-4 py-2 rounded-full text-xs font-bold tracking-tight transition-all ${
                                selectedAge === a
                                  ? "bg-brand-pink text-primary-foreground shadow-md"
                                  : "bg-secondary text-foreground hover:bg-surface"
                              }`}
                            >
                              {a}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center justify-between pt-4 border-t border-border">
                        <button
                          onClick={clearFilters}
                          className="text-muted-foreground text-sm font-bold hover:text-brand-pink transition-colors"
                        >
                          Clear All
                        </button>
                        <button
                          onClick={() => setFilterOpen(false)}
                          className="bg-brand-pink text-primary-foreground px-6 py-2.5 rounded-full text-sm font-black tracking-tight hover:scale-105 transition-all shadow-lg"
                        >
                          Apply Filters
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Latest Button */}
                <button className="bg-brand-lime text-on-background px-6 py-3 rounded-full text-sm font-black tracking-tight shadow-sm hover:scale-105 transition-transform">
                  Latest
                </button>

                {/* Clear filters pill */}
                {hasActiveFilters && (
                  <button
                    onClick={clearFilters}
                    className="flex items-center gap-1 bg-brand-pink/10 text-brand-pink px-4 py-3 rounded-full text-xs font-bold tracking-tight hover:bg-brand-pink/20 transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                    Clear
                  </button>
                )}
              </div>
            </div>

            {/* Results count */}
            {hasActiveFilters && (
              <p className="text-muted-foreground text-sm font-medium mb-8">
                Showing <span className="text-brand-pink font-bold">{filteredEvents.length}</span> event{filteredEvents.length !== 1 ? "s" : ""}
              </p>
            )}

            <div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {visibleEvents.map((event) => (
                <Link
                  to={`/event/${(event as any).dbId || encodeURIComponent(event.title)}?ref=explore`}
                  key={(event as any).dbId || event.title}
                  className="group relative isolate block cursor-pointer overflow-hidden rounded-5xl border border-border bg-surface transition-[box-shadow,transform] duration-300 hover:-translate-y-1 hover:shadow-xl"
                >
                  <div className="relative aspect-square w-full overflow-hidden rounded-t-5xl">
                    <img
                      alt={event.title}
                      className="block h-full w-full transform-gpu object-cover transition-transform duration-1000 group-hover:scale-105"
                      src={event.image}
                      loading="lazy"
                      decoding="async"
                    />
                    <div className="absolute top-5 left-5 bg-surface/90 backdrop-blur-md rounded-4xl p-3 text-center min-w-[56px]">
                      <span className="block text-brand-pink font-black text-2xl leading-none">{event.date}</span>
                      <span className="text-[10px] font-bold uppercase tracking-widest text-foreground">{event.month}</span>
                    </div>
                    {event.badge && (
                      <div className="absolute top-5 right-5 bg-brand-lime text-on-background rounded-full px-4 py-1.5 text-[10px] font-black uppercase tracking-widest shadow-lg">
                        {event.badge}
                      </div>
                    )}
                  </div>
                  <div className="p-8">
                    <div className="flex justify-between items-start mb-3">
                      <h3 className="text-xl font-black tracking-tight leading-tight group-hover:text-brand-pink transition-colors text-on-background">
                        {event.title}
                      </h3>
                      <button className="text-muted-foreground hover:text-brand-pink transition-colors flex-shrink-0 ml-3">
                        <Heart className="w-5 h-5" />
                      </button>
                    </div>
                    <p className="text-muted-foreground text-sm font-medium mb-6 line-clamp-2">{event.description}</p>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1 text-muted-foreground font-bold text-sm">
                        <MapPin className="w-4 h-4 text-brand-pink" />
                        {event.location}
                      </div>
                      <span className="text-on-background font-black text-lg">{event.price}</span>
                    </div>
                  </div>
                </Link>
              ))}
              </div>

              {/* Empty state */}
              {filteredEvents.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <p className="text-4xl mb-4">🎭</p>
                  <h3 className="text-2xl font-black tracking-tight text-on-background mb-2">
                    No events in {selectedCity !== "All Cities" ? selectedCity : "this area"}
                  </h3>
                  <p className="text-muted-foreground font-medium mb-6">
                    {closestEvents.length > 0
                      ? "Here are the closest events we found:"
                      : "Try adjusting your filters to discover more events."}
                  </p>
                  {closestEvents.length === 0 && (
                    <button
                      onClick={clearFilters}
                      className="bg-brand-pink text-primary-foreground px-8 py-3 rounded-full font-black tracking-tight hover:scale-105 transition-all shadow-lg"
                    >
                      Clear Filters
                    </button>
                  )}
                </div>
              )}

              {/* Closest events fallback */}
              {filteredEvents.length === 0 && closestEvents.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mt-4">
                  {closestEvents.map((event) => (
                    <Link
                      to={`/event/${(event as any).dbId || encodeURIComponent(event.title)}?ref=explore`}
                      key={(event as any).dbId || event.title}
                      className="group relative isolate block cursor-pointer overflow-hidden rounded-5xl border border-border bg-surface transition-[box-shadow,transform] duration-300 hover:-translate-y-1 hover:shadow-xl"
                    >
                      <div className="relative aspect-square w-full overflow-hidden rounded-t-5xl">
                        <img
                          alt={event.title}
                          className="block h-full w-full transform-gpu object-cover transition-transform duration-1000 group-hover:scale-105"
                          src={event.image}
                          loading="lazy"
                          decoding="async"
                        />
                        <div className="absolute top-5 left-5 bg-surface/90 backdrop-blur-md rounded-4xl p-3 text-center min-w-[56px]">
                          <span className="block text-brand-pink font-black text-2xl leading-none">{event.date}</span>
                          <span className="text-[10px] font-bold uppercase tracking-widest text-foreground">{event.month}</span>
                        </div>
                        <div className="absolute bottom-5 left-5 bg-surface/90 backdrop-blur-md rounded-full px-3 py-1.5">
                          <span className="text-[11px] font-bold text-muted-foreground">
                            {Math.round(event._dist)} mi away
                          </span>
                        </div>
                      </div>
                      <div className="p-8">
                        <h3 className="text-xl font-black tracking-tight leading-tight group-hover:text-brand-pink transition-colors text-on-background mb-3">
                          {event.title}
                        </h3>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1 text-muted-foreground font-bold text-sm">
                            <MapPin className="w-4 h-4 text-brand-pink" />
                            {event.location}
                          </div>
                          <span className="text-on-background font-black text-lg">{event.price}</span>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {filteredEvents.length > 3 && (
              <div className="flex justify-center mt-12">
                <button
                  onClick={() => setShowAll(!showAll)}
                  className="bg-brand-pink text-primary-foreground px-10 py-4 rounded-full font-black tracking-tight hover:scale-105 transition-all shadow-xl flex items-center gap-2"
                >
                  {showAll ? "Show Less" : "See All Events"}
                  <ArrowRight className={`w-5 h-5 transition-transform ${showAll ? "rotate-[-90deg]" : ""}`} />
                </button>
              </div>
            )}
          </div>
        </section>
      </main>

      {/* Floating Action Button */}
      <div className="fixed bottom-24 right-6 md:bottom-12 md:right-12 z-40">
        <button className="bg-brand-lime text-on-background w-16 h-16 rounded-full shadow-2xl flex items-center justify-center hover:scale-110 active:scale-90 transition-transform">
          <Plus className="w-7 h-7" strokeWidth={2.5} />
        </button>
      </div>
    </>
  );
};

export default Explore;
