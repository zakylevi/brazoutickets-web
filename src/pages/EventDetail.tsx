import { useState, useEffect } from "react";
import { useParams, Link, useSearchParams } from "react-router-dom";
import { ArrowLeft, Calendar, Clock, MapPin, Heart, Share2, Music, Ticket, ChevronRight, Star, Instagram, Minus, Plus, ShoppingCart, Image as ImageIcon, ShieldCheck, MessageSquare } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import CheckoutModal from "@/components/CheckoutModal";
import EventSeatingMap from "@/components/EventSeatingMap";
import { getEventById, StoredEvent } from "@/stores/eventStore";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { calculateServiceFee } from "@/lib/orderPricing";
import RequestAccessModal from "@/components/RequestAccessModal";

interface DbTicketType {
  id: string;
  name: string;
  price: string;
  quantity: number;
  max_per_order: number;
  sold: number;
  sold_out: boolean;
  hidden: boolean;
  available_soon: boolean;
  available_date: string | null;
  approval_required: boolean;
}

const EventDetail = () => {
  const { eventId, source } = useParams<{ eventId: string; source?: string }>();
  const [searchParams] = useSearchParams();
  const refSource = source || searchParams.get("ref");
  const [event, setEvent] = useState<StoredEvent | null>(null);
  const [tickets, setTickets] = useState<DbTicketType[]>([]);
  const [loading, setLoading] = useState(true);
  const [orgInfo, setOrgInfo] = useState<{ name: string; avatar_url: string | null; slug: string } | null>(null);
  const [ticketQuantities, setTicketQuantities] = useState<Record<number, number>>({});
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [requestModalOpen, setRequestModalOpen] = useState(false);
  const [requestTicket, setRequestTicket] = useState<DbTicketType | null>(null);
  const [userRequestStatuses, setUserRequestStatuses] = useState<Record<string, string>>({});
  const [selectedSeats, setSelectedSeats] = useState<Map<string, { sectionName: string; rowLabel: string; seatNumber: number; price: number }>>(new Map());
  const { user } = useAuth();

  const isSeatedEvent = event?.eventType === "seated";

  useEffect(() => {
    if (!eventId) return;
    const load = async () => {
      const ev = await getEventById(eventId);
      if (ev) {
        setEvent(ev);
        // Load ticket types from DB
        const { data: ticketData } = await supabase
          .from("ticket_types")
          .select("id, name, price, quantity, max_per_order, sold, sold_out, hidden, available_soon, available_date, approval_required")
          .eq("event_id", eventId)
          .order("created_at");
        if (ticketData) setTickets(ticketData.map((t: any) => ({ ...t, max_per_order: t.max_per_order ?? 10, approval_required: !!t.approval_required })) as DbTicketType[]);

        // Load user's existing requests for this event
        const { data: sessionData } = await supabase.auth.getSession();
        if (sessionData?.session?.user) {
          const { data: reqs } = await supabase.from("ticket_requests" as any)
            .select("ticket_type_id, status")
            .eq("event_id", eventId)
            .eq("user_id", sessionData.session.user.id);
          if (reqs) {
            const map: Record<string, string> = {};
            (reqs as any[]).forEach((r: any) => { map[r.ticket_type_id] = r.status; });
            setUserRequestStatuses(map);
          }
        }

        // Load org info
        const { data: evRow } = await supabase
          .from("events")
          .select("organization_id")
          .eq("id", eventId)
          .single();
        if (evRow) {
          const { data: org } = await supabase
            .from("organizations")
            .select("name, avatar_url, slug")
            .eq("id", (evRow as any).organization_id)
            .single();
          if (org) setOrgInfo(org as any);
        }

        // Increment click count based on source
        const ref = refSource || searchParams.get("ref");
        if (ref) {
          localStorage.setItem("ref_source", ref);
        }
        if (ref === "explore") {
          await supabase.rpc("increment_event_explore_clicks", { _event_id: eventId });
        } else if (ref === "instagram") {
          await supabase.rpc("increment_event_instagram_clicks" as any, { _event_id: eventId });
        } else {
          await supabase.rpc("increment_event_clicks", { _event_id: eventId });
        }
        // Also increment tracking link clicks for custom slugs
        if (ref && ref !== "explore" && ref !== "instagram" && ref !== "direct") {
          try { await supabase.rpc("increment_tracking_link_clicks" as any, { _slug: ref }); } catch (_) {}
        }
      }
      setLoading(false);
    };
    load();
  }, [eventId]);

  const updateQuantity = (index: number, delta: number) => {
    setTicketQuantities((prev) => {
      const current = prev[index] || 0;
      const limit = Math.max(1, tickets[index]?.max_per_order ?? 10);
      const next = Math.max(0, Math.min(limit, current + delta));
      return { ...prev, [index]: next };
    });
  };

  const totalInCart = Object.values(ticketQuantities).reduce((s, q) => s + q, 0);

  // Build cart items: for seated events, one item per seat with full identifier
  const cartItems = isSeatedEvent
    ? Array.from(selectedSeats.entries()).map(([seatId, info]) => ({
        name: `${info.sectionName} · Row ${info.rowLabel} · Seat ${info.seatNumber}`,
        price: info.price.toFixed(2),
        quantity: 1,
        seatIds: [seatId],
        isSeated: true,
      }))
    : tickets
        .map((tier, i) => ({
          ticketTypeId: tier.id,
          name: tier.name,
          price: tier.price,
          quantity: ticketQuantities[i] || 0,
          maxPerOrder: tier.max_per_order,
        }))
        .filter((item) => item.quantity > 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] pt-20">
        <p className="text-muted-foreground font-bold">Loading event...</p>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="flex items-center justify-center pt-40">
        <div className="text-center">
          <p className="text-4xl mb-4">🎪</p>
          <h1 className="text-2xl font-black text-foreground mb-2">Event not found</h1>
          <Link to="/explore" className="text-primary font-bold text-sm underline">Back to Explore</Link>
        </div>
      </div>
    );
  }

  const totalPrice = (base: number) => base + calculateServiceFee(base, 1);
  const formatPrice = (v: number) => `$${v.toFixed(2)}`;

  const cheapestPrice = (() => {
    const availableTickets = tickets.filter((t) => !t.sold_out);
    const prices = tickets
      .filter((t) => !t.sold_out)
      .map((t) => parseFloat(t.price.replace(/[^\d.,]/g, "").replace(",", ".")))
      .filter((n) => !isNaN(n) && n > 0);
    if (prices.length === 0 && availableTickets.some((t) => (parseFloat(t.price.replace(/[^\d.,]/g, "").replace(",", ".")) || 0) <= 0)) return "Free";
    if (prices.length === 0) return event.price || "—";
    return formatPrice(totalPrice(Math.min(...prices)));
  })();

  return (
    <>
      <main className="pt-20 pb-32">
        {/* Back nav */}
        <div className="max-w-7xl mx-auto px-4 md:px-8 pt-6 pb-4">
          <Link
            to="/explore"
            className="inline-flex items-center gap-2 text-muted-foreground hover:text-brand-pink transition-colors text-sm font-bold"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Explore
          </Link>
        </div>

        {/* Hero: Flyer + Key Info */}
        <section className="max-w-7xl mx-auto px-4 md:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
            {/* Event Flyer */}
            <div className="w-full max-w-[600px] mx-auto lg:mx-0">
              <div className="rounded-5xl overflow-hidden shadow-2xl border border-border" style={{ aspectRatio: "1080 / 1350" }}>
                {event.flyer ? (
                  <div className="relative w-full h-full">
                    <img src={event.flyer} alt="" className="absolute inset-0 w-full h-full object-cover scale-110 blur-2xl opacity-80" decoding="async" />
                    <img src={event.flyer} alt={`${event.title} flyer`} className="relative w-full h-full object-contain z-10" fetchPriority="high" decoding="async" />
                  </div>
                ) : (
                  <div className="w-full h-full bg-secondary flex items-center justify-center">
                    <ImageIcon className="w-16 h-16 text-muted-foreground" />
                  </div>
                )}
              </div>
            </div>

            {/* Key Info */}
            <div className="flex flex-col justify-center py-4">
              <div className="flex items-center gap-3 mb-4">
                {event.category && (
                  <span className="bg-[#CDFF00] text-black px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest">
                    {event.category}
                  </span>
                )}
                <span className="bg-secondary text-foreground px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest">
                  {event.age}
                </span>
              </div>

              {orgInfo && (
                <Link to={`/org/${orgInfo.slug}`} className="flex items-center gap-3 mb-5 group">
                  <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-border group-hover:border-brand-pink transition-colors flex-shrink-0 bg-secondary">
                    {orgInfo.avatar_url ? (
                      <img src={orgInfo.avatar_url} alt={orgInfo.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-xs font-black text-muted-foreground">
                        {orgInfo.name.charAt(0)}
                      </div>
                    )}
                  </div>
                  <span className="text-sm font-bold text-muted-foreground group-hover:text-brand-pink transition-colors">
                    {orgInfo.name}
                  </span>
                </Link>
              )}

              <h1 className="text-4xl md:text-5xl lg:text-6xl font-black tracking-tight leading-none mb-5 text-balance text-on-background">
                {event.title}
              </h1>

              {event.shortDescription && (
                <p className="text-muted-foreground text-lg font-medium leading-relaxed mb-8 max-w-lg">
                  {event.shortDescription}
                </p>
              )}

              {/* Date / Time / Location */}
              <div className="space-y-4 mb-8">
                {event.date && (
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-secondary flex items-center justify-center flex-shrink-0">
                      <Calendar className="w-5 h-5 text-brand-pink" />
                    </div>
                    <div>
                      <p className="font-black text-on-background">
                        {(() => {
                          const monthMap: Record<string, number> = { JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, JUN: 5, JUL: 6, AUG: 7, SEP: 8, OCT: 9, NOV: 10, DEC: 11 };
                          const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
                          const fullMonths = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
                          const ordinal = (n: number) => { const s = ["th","st","nd","rd"]; const v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); };
                          const m = monthMap[event.month?.toUpperCase()];
                          if (m !== undefined && event.date && event.year) {
                            const d = new Date(Number(event.year), m, Number(event.date));
                            return `${days[d.getDay()]}, ${fullMonths[m]} ${ordinal(Number(event.date))}, ${event.year}`;
                          }
                          return `${event.date} ${event.month} ${event.year}`;
                        })()}
                      </p>
                      {event.doors && event.showEndTime && <p className="text-sm text-muted-foreground font-medium">Ends at {event.doors}</p>}
                    </div>
                  </div>
                )}
                {event.time && (
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-secondary flex items-center justify-center flex-shrink-0">
                      <Clock className="w-5 h-5 text-brand-pink" />
                    </div>
                    <div>
                      <p className="font-black text-on-background">{event.time}</p>
                    </div>
                  </div>
                )}
                {event.venue && (
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-secondary flex items-center justify-center flex-shrink-0">
                      <MapPin className="w-5 h-5 text-brand-pink" />
                    </div>
                    <div>
                      <p className="font-black text-on-background">{event.venue}</p>
                      {event.address && <p className="text-sm text-muted-foreground font-medium">{event.address}{event.city ? ` — ${event.city}` : ""}</p>}
                    </div>
                  </div>
                )}
              </div>

              {/* CTA Row */}
              <div className="flex items-center gap-4 flex-wrap">
                {tickets.length > 0 && (
                  <a
                    href="#tickets"
                    className="bg-brand-pink text-primary-foreground px-10 py-4 rounded-full font-black tracking-tight flex items-center gap-2 hover:scale-105 transition-all shadow-xl"
                  >
                    <Ticket className="w-5 h-5" />
                    Get Tickets — {cheapestPrice}
                  </a>
                )}
                <button className="w-12 h-12 rounded-full border border-border flex items-center justify-center text-muted-foreground hover:text-brand-pink hover:border-brand-pink transition-all">
                  <Heart className="w-5 h-5" />
                </button>
                <button className="w-12 h-12 rounded-full border border-border flex items-center justify-center text-muted-foreground hover:text-brand-pink hover:border-brand-pink transition-all">
                  <Share2 className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* About / Description */}
        {event.description && (
          <section className="max-w-7xl mx-auto px-4 md:px-8 py-20">
            <div className="max-w-3xl">
              <p className="text-brand-pink font-bold tracking-wider text-xs uppercase mb-3">About This Event</p>
              <h2 className="text-3xl md:text-4xl font-black tracking-tight text-on-background mb-8">Event Description</h2>
              <div className="space-y-5 text-muted-foreground text-base md:text-lg font-medium leading-relaxed">
                {event.description.split("\n\n").map((para, i) => (
                  <p key={i}>{para}</p>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Lineup */}
        {event.lineup.length > 0 && (
          <section className="py-20 bg-secondary-container">
            <div className="max-w-7xl mx-auto px-4 md:px-8">
              <div className="flex items-center gap-3 mb-3">
                <Music className="w-5 h-5 text-brand-pink" />
                <p className="text-brand-pink font-bold tracking-wider text-xs uppercase">Artists</p>
              </div>
              <h2 className="text-3xl md:text-4xl font-black tracking-tight text-on-background mb-12">Lineup</h2>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-6">
                {event.lineup.map((artist, i) => (
                  <div key={i} className="group cursor-pointer text-center">
                    <div className="aspect-square rounded-5xl overflow-hidden mb-4 shadow-sm border border-border">
                      {artist.image ? (
                        <img src={artist.image} alt={artist.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000" loading="lazy" />
                      ) : (
                        <div className="w-full h-full bg-secondary flex items-center justify-center">
                          <Music className="w-8 h-8 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                    <p className="font-black text-on-background tracking-tight group-hover:text-brand-pink transition-colors">
                      {artist.name}
                    </p>
                    <div className="flex items-center justify-center gap-3 mt-2">
                      {artist.instagram && (
                        <a href={artist.instagram} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-brand-pink transition-colors">
                          <Instagram className="w-4 h-4" />
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Tickets */}
        {(() => {
          // Determine if event is over
          const endDateStr = event?.endDate && event?.endMonth && event?.endYear
            ? `${event.endYear}-${String(["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"].indexOf(event.endMonth.toUpperCase()) + 1).padStart(2, "0")}-${event.endDate.padStart(2, "0")}`
            : event?.date && event?.month && event?.year
              ? `${event.year}-${String(["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"].indexOf(event.month.toUpperCase()) + 1).padStart(2, "0")}-${event.date.padStart(2, "0")}`
              : null;
          const isEventOver = endDateStr ? new Date(endDateStr + "T23:59:59") < new Date() : false;

          if (isEventOver) {
            return (
              <section id="tickets" className="max-w-7xl mx-auto px-4 md:px-8 py-20 scroll-mt-24">
                <div className="flex items-center gap-3 mb-3">
                  <Ticket className="w-5 h-5 text-brand-pink" />
                  <p className="text-brand-pink font-bold tracking-wider text-xs uppercase">Pricing</p>
                </div>
                <h2 className="text-3xl md:text-4xl font-black tracking-tight text-on-background mb-12">Tickets</h2>
                <div className="p-8 rounded-3xl border border-border bg-secondary text-center">
                  <p className="text-xl font-black text-foreground">This event is over</p>
                  <p className="text-muted-foreground text-sm font-medium mt-2">Tickets are no longer available for purchase.</p>
                </div>
              </section>
            );
          }

          return (tickets.length > 0 || isSeatedEvent) ? (
          <section id="tickets" className="max-w-7xl mx-auto px-4 md:px-8 py-20 scroll-mt-24">
            <div className="flex items-center gap-3 mb-3">
              <Ticket className="w-5 h-5 text-brand-pink" />
              <p className="text-brand-pink font-bold tracking-wider text-xs uppercase">Pricing</p>
            </div>
            <h2 className="text-3xl md:text-4xl font-black tracking-tight text-on-background mb-12">Tickets</h2>

            {event?.salesDisabled && (
              <div className="mb-8 p-4 rounded-2xl bg-orange-500/10 border border-orange-500/30 text-center">
                <p className="text-orange-500 font-bold uppercase tracking-widest text-xs">Sales are currently disabled for this event</p>
              </div>
            )}

            {/* SEATED EVENT — show seating map */}
            {isSeatedEvent ? (
              <div className="space-y-6">
                <p className="text-sm text-muted-foreground font-medium">Select your seats from the map below</p>
                <EventSeatingMap
                  eventId={eventId!}
                  selectedSeatIds={new Set(selectedSeats.keys())}
                  onToggleSeat={(seatId, info) => {
                    setSelectedSeats(prev => {
                      const next = new Map(prev);
                      if (next.has(seatId)) next.delete(seatId);
                      else next.set(seatId, info);
                      return next;
                    });
                  }}
                  maxSelectable={10}
                />

                {/* Selected seats summary */}
                {selectedSeats.size > 0 && (
                  <div className="rounded-3xl border border-brand-pink bg-surface p-6 shadow-xl">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <p className="font-black text-on-background text-lg">
                          {selectedSeats.size} Seat{selectedSeats.size !== 1 ? "s" : ""} Selected
                        </p>
                      </div>
                      <button
                        onClick={() => setCheckoutOpen(true)}
                        className="bg-brand-pink text-primary-foreground px-10 py-4 rounded-full font-black tracking-tight flex items-center gap-2 hover:scale-105 transition-all shadow-xl"
                      >
                        <ShoppingCart className="w-5 h-5" />
                        Checkout — {(() => {
                          const total = Array.from(selectedSeats.values()).reduce((sum, s) => {
                            const fee = calculateServiceFee(s.price, 1);
                            return sum + s.price + fee;
                          }, 0);
                          return `$${total.toFixed(2)}`;
                        })()}
                      </button>
                    </div>
                    <div className="space-y-1">
                      {Array.from(selectedSeats.entries()).map(([id, info]) => {
                        const fee = calculateServiceFee(info.price, 1);
                        return (
                          <div key={id} className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground font-medium">
                              {info.sectionName} · Row {info.rowLabel} · Seat {info.seatNumber}
                            </span>
                            <span className="font-bold text-on-background">
                              {info.price > 0 ? `$${(info.price + fee).toFixed(2)}` : "Free"}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* GENERAL ADMISSION — standard ticket list */
              <>
                <div className="space-y-4">
              {tickets.map((tier, i) => {
                const qty = ticketQuantities[i] || 0;
                const isSoldOut = tier.sold_out || tier.sold >= tier.quantity;
                const isHidden = tier.hidden || !!event?.salesDisabled;
                const isAvailableSoon = tier.available_soon;
                const availableDate = tier.available_date ? new Date(tier.available_date) : null;
                const isNotYetAvailable = isAvailableSoon && (!availableDate || availableDate > new Date());
                const parsedTierPrice = parseFloat(tier.price.replace(/[^\d.,]/g, "").replace(",", ".")) || 0;

                // Don't render hidden tickets at all
                if (isHidden) return null;

                return (
                  <div
                    key={tier.id}
                    className={`rounded-3xl border p-6 transition-all ${
                      isNotYetAvailable
                        ? "border-border bg-muted/50 opacity-80"
                        : isSoldOut
                          ? "border-border bg-muted opacity-60"
                          : qty > 0
                            ? "border-brand-pink bg-surface shadow-xl"
                            : "border-border bg-surface hover:border-brand-pink hover:shadow-lg"
                    }`}
                  >
                    <div className="flex items-center gap-6">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-1">
                          <h3 className="text-lg font-black tracking-tight text-on-background">{tier.name}</h3>
                          {isNotYetAvailable && (
                            <span className="bg-accent text-muted-foreground px-3 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              Coming Soon
                            </span>
                          )}
                          {tier.approval_required && !isSoldOut && !isNotYetAvailable && (
                            <span className="bg-primary/10 text-primary px-3 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-1">
                              <ShieldCheck className="w-3 h-3" />
                              Approval Required
                            </span>
                          )}
                          {isSoldOut && !isNotYetAvailable && (
                            <span className="bg-muted text-muted-foreground px-3 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest">Sold Out</span>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground font-medium">
                          {isNotYetAvailable && availableDate
                            ? `Available ${format(availableDate, "MMM dd, yyyy 'at' h:mm a")}`
                            : `${tier.sold} / ${tier.quantity} sold • Limit ${tier.max_per_order} per order`}
                        </p>
                      </div>
                      <div className="flex items-center gap-5 flex-shrink-0">
                        <p className="text-2xl font-black text-brand-pink">{parsedTierPrice > 0 ? formatPrice(totalPrice(parsedTierPrice)) : "Free"}</p>
                        {isNotYetAvailable ? (
                          <span className="px-8 py-3 rounded-full bg-accent text-muted-foreground font-black tracking-tight text-sm cursor-not-allowed">
                            Coming Soon
                          </span>
                        ) : tier.approval_required && !isSoldOut ? (
                          (() => {
                            const reqStatus = userRequestStatuses[tier.id];
                            if (reqStatus === "pending") {
                              return (
                                <span className="px-8 py-3 rounded-full bg-amber-500/10 text-amber-500 font-black tracking-tight text-sm cursor-not-allowed">
                                  Request Pending
                                </span>
                              );
                            }
                            if (reqStatus === "approved") {
                              return (
                                <a
                                  href="/tickets"
                                  className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-green-500/10 text-green-600 font-black tracking-tight text-sm"
                                >
                                  <ShieldCheck className="w-4 h-4" />
                                  Approved — View Ticket
                                </a>
                              );
                            }
                            if (reqStatus === "rejected") {
                              return (
                                <span className="px-8 py-3 rounded-full bg-destructive/10 text-destructive font-black tracking-tight text-sm cursor-not-allowed">
                                  Request Denied
                                </span>
                              );
                            }
                            return (
                              <button
                                onClick={() => {
                                  setRequestTicket(tier);
                                  setRequestModalOpen(true);
                                }}
                                className="px-8 py-3 rounded-full bg-primary text-primary-foreground font-black tracking-tight text-sm hover:scale-105 transition-all flex items-center gap-2"
                              >
                                <ShieldCheck className="w-4 h-4" />
                                Request Access
                              </button>
                            );
                          })()
                        ) : !isSoldOut ? (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => updateQuantity(i, -1)}
                              disabled={qty === 0}
                              className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center text-on-background hover:bg-brand-pink hover:text-primary-foreground transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                              <Minus className="w-4 h-4" />
                            </button>
                            <span className="w-8 text-center font-black text-on-background tabular-nums">{qty}</span>
                            <button
                              onClick={() => updateQuantity(i, 1)}
                              disabled={qty >= tier.max_per_order}
                              className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center text-on-background hover:bg-brand-pink hover:text-primary-foreground transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <span className="px-8 py-3 rounded-full bg-muted text-muted-foreground font-black tracking-tight text-sm cursor-not-allowed">
                            Sold Out
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Cart summary bar */}
            {totalInCart > 0 && (
              <div className="mt-8 rounded-3xl border border-brand-pink bg-surface p-6 flex items-center justify-between shadow-xl">
                <div>
                  <p className="font-black text-on-background text-lg">
                    {totalInCart} Ticket{totalInCart !== 1 ? "s" : ""} Selected
                  </p>
                  <p className="text-sm text-muted-foreground font-medium">
                    {cartItems.map((item) => `${item.quantity}× ${item.name}`).join(", ")}
                  </p>
                </div>
                <button
                  onClick={() => setCheckoutOpen(true)}
                  className="bg-brand-pink text-primary-foreground px-10 py-4 rounded-full font-black tracking-tight flex items-center gap-2 hover:scale-105 transition-all shadow-xl"
                >
                  <ShoppingCart className="w-5 h-5" />
                  Checkout
                </button>
              </div>
            )}
              </>
            )}
          </section>
          ) : null;
        })()}

        {/* Gallery */}
        {event.gallery.length > 0 && (
          <section className="py-20 bg-secondary-container">
            <div className="max-w-7xl mx-auto px-4 md:px-8">
              <p className="text-brand-pink font-bold tracking-wider text-xs uppercase mb-3">Photos</p>
              <h2 className="text-3xl md:text-4xl font-black tracking-tight text-on-background mb-12">Gallery</h2>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {event.gallery.map((img, i) => (
                  <div key={i} className="rounded-4xl overflow-hidden group cursor-pointer">
                    <div className="w-full overflow-hidden" style={{ aspectRatio: "1350 / 1080" }}>
                      <img src={img} alt={`${event.title} gallery ${i + 1}`} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000" loading="lazy" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Location */}
        {event.venue && (
          <section className="max-w-7xl mx-auto px-4 md:px-8 py-20">
            <div className="flex items-center gap-3 mb-3">
              <MapPin className="w-5 h-5 text-brand-pink" />
              <p className="text-brand-pink font-bold tracking-wider text-xs uppercase">Venue</p>
            </div>
            <h2 className="text-3xl md:text-4xl font-black tracking-tight text-on-background mb-8">Location</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
              <div>
                <h3 className="text-2xl font-black tracking-tight text-on-background mb-2">{event.venue}</h3>
                {event.address && <p className="text-muted-foreground font-medium mb-1">{event.address}</p>}
                {event.city && <p className="text-muted-foreground font-medium mb-6">{event.city}{event.locationState ? `, ${event.locationState}` : ""}{event.country ? ` — ${event.country}` : ""}</p>}
                <a
                  href={event.lat && event.lng
                    ? `https://www.google.com/maps/search/?api=1&query=${event.lat},${event.lng}${event.placeId ? `&query_place_id=${event.placeId}` : ""}`
                    : `https://maps.google.com/?q=${encodeURIComponent((event.address || "") + ", " + (event.city || ""))}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 bg-secondary text-on-background px-6 py-3 rounded-full font-bold text-sm hover:bg-brand-pink hover:text-primary-foreground transition-all"
                >
                  <MapPin className="w-4 h-4" />
                  View on Maps
                </a>
              </div>
              <div className="aspect-video rounded-4xl overflow-hidden bg-secondary border border-border">
                {event.lat && event.lng ? (
                  <img
                    src={`https://maps.googleapis.com/maps/api/staticmap?center=${event.lat},${event.lng}&zoom=15&size=600x340&scale=2&markers=color:red%7C${event.lat},${event.lng}&key=AIzaSyBalU_2zolJX-4NL0an5rzXiv3gW3gOZCo`}
                    alt="Map preview"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <div className="text-center">
                      <MapPin className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                      <p className="text-muted-foreground font-bold text-sm">Map not available</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </section>
        )}
      </main>

      <RequestAccessModal
        open={requestModalOpen}
        onOpenChange={setRequestModalOpen}
        ticket={requestTicket}
        eventId={eventId || ""}
        onSubmitted={(ticketTypeId) => setUserRequestStatuses((prev) => ({ ...prev, [ticketTypeId]: "pending" }))}
      />

      <CheckoutModal
        open={checkoutOpen}
        onClose={() => setCheckoutOpen(false)}
        cart={cartItems}
        eventTitle={event.title}
        eventId={event.id}
        refSource={refSource || localStorage.getItem("ref_source") || "direct"}
      />
    </>
  );
};

export default EventDetail;
