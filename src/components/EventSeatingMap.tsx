import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { Users, Armchair, Accessibility, Crown, Gem, Diamond } from "lucide-react";
import { calculateServiceFee } from "@/lib/orderPricing";

interface Seat {
  id: string;
  section_id: string;
  row_label: string;
  seat_number: number;
  layout_row_index: number;
  layout_seat_index: number;
  status: string;
  blocked: boolean;
  price: string | null;
  label: string | null;
  is_special: boolean;
  order_id: string | null;
}

interface Section {
  id: string;
  name: string;
  rows_count: number;
  seats_per_row: number;
  price: string;
  is_general_admission: boolean;
  sort_order: number;
}

interface Props {
  eventId: string;
  selectedSeatIds: Set<string>;
  onToggleSeat: (seatId: string, seatInfo: { sectionName: string; rowLabel: string; seatNumber: number; price: number }) => void;
  maxSelectable?: number;
}

const EventSeatingMap = ({ eventId, selectedSeatIds, onToggleSeat, maxSelectable = 10 }: Props) => {
  const [sections, setSections] = useState<Section[]>([]);
  const [seats, setSeats] = useState<Seat[]>([]);
  const [loading, setLoading] = useState(true);
  const [hoveredSeat, setHoveredSeat] = useState<Seat | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const load = async () => {
      const [{ data: secData }, { data: seatData }] = await Promise.all([
        supabase.from("seating_sections").select("*").eq("event_id", eventId).order("sort_order"),
        supabase.from("seats").select("*").eq("event_id", eventId),
      ]);
      if (secData) setSections(secData as Section[]);
      if (seatData) setSeats(seatData as Seat[]);
      setLoading(false);
    };
    load();
  }, [eventId]);

  const maxSeatsPerRow = useMemo(() => {
    if (seats.length === 0) return 0;
    const counts: Record<string, number> = {};
    seats.forEach(s => {
      const key = `${s.section_id}-${s.row_label}`;
      counts[key] = (counts[key] || 0) + 1;
    });
    return Math.max(...Object.values(counts), 0);
  }, [seats]);

  if (loading) return <div className="py-8 text-center text-muted-foreground font-bold text-sm">Loading seating map...</div>;
  if (sections.length === 0) return null;

  const seatSize = maxSeatsPerRow > 30 ? 16 : maxSeatsPerRow > 20 ? 20 : maxSeatsPerRow > 12 ? 26 : 32;
  const seatGap = seatSize > 24 ? 4 : 3;
  const fontSize = seatSize > 24 ? 9 : 7;
  const seatRadius = Math.round(seatSize * 0.22);

  const getSeatPrice = (seat: Seat) => {
    const section = sections.find(s => s.id === seat.section_id);
    const basePrice = parseFloat(seat.price || section?.price || "0") || 0;
    return basePrice;
  };

  const getDisplayPrice = (base: number) => {
    if (base <= 0) return "Free";
    const fee = calculateServiceFee(base, 1);
    return `$${(base + fee).toFixed(2)}`;
  };

  const getRowOrderValue = (sectionSeats: Seat[], rowLabel: string) => {
    const rowIndexes = sectionSeats
      .filter((seat) => seat.row_label === rowLabel)
      .map((seat) => seat.layout_row_index ?? Number.MAX_SAFE_INTEGER);

    return Math.min(...rowIndexes);
  };

  const sortSeatsByLayout = (a: Seat, b: Seat) => {
    const rowDiff = (a.layout_row_index ?? 0) - (b.layout_row_index ?? 0);
    if (rowDiff !== 0) return rowDiff;

    const seatDiff = (a.layout_seat_index ?? a.seat_number) - (b.layout_seat_index ?? b.seat_number);
    if (seatDiff !== 0) return seatDiff;

    return a.seat_number - b.seat_number;
  };

  return (
    <div className="space-y-4">
      {/* Legend */}
      <div className="flex flex-wrap items-center justify-center gap-4 text-xs">
        {[
          { cls: "bg-foreground/85", label: "Available" },
          { cls: "bg-primary", label: "Sold" },
          { cls: "border-2 border-border", label: "Unavailable" },
          { cls: "ring-2 ring-[#CDFF00]/50", label: "Selected", style: { backgroundColor: "#CDFF00" } },
        ].map(l => (
          <div key={l.label} className="flex items-center gap-1.5">
            <div className={cn("w-3 h-3 rounded-sm", l.cls)} style={(l as any).style} />
            <span className="text-muted-foreground">{l.label}</span>
          </div>
        ))}
      </div>

      {/* Map */}
      <div className="relative bg-secondary/30 rounded-2xl border border-border overflow-hidden">
        {/* Tooltip */}
        {hoveredSeat && (
          <div
            className="fixed z-[100] pointer-events-none bg-popover border border-border rounded-lg px-3 py-2 shadow-xl"
            style={{ left: tooltipPos.x + 12, top: tooltipPos.y - 10 }}
          >
            <p className="text-xs font-black text-foreground">
              Row {hoveredSeat.row_label} · Seat {hoveredSeat.seat_number}
            </p>
            <p className="text-[10px] text-muted-foreground">
              {hoveredSeat.blocked ? "Unavailable" : hoveredSeat.status === "sold" ? "Sold" : getDisplayPrice(getSeatPrice(hoveredSeat))}
              {hoveredSeat.label && ` · ${hoveredSeat.label}`}
            </p>
          </div>
        )}

        <div className="p-6 flex flex-col items-center gap-0 overflow-x-auto">
          {/* Stage */}
          <div className="mb-6 w-full max-w-[500px]">
            <div
              className="mx-auto h-10 rounded-b-[50%] flex items-center justify-center"
              style={{
                background: "linear-gradient(180deg, hsl(var(--primary) / 0.25), hsl(var(--primary) / 0.08))",
                border: "1px solid hsl(var(--primary) / 0.3)",
                width: "80%",
              }}
            >
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">Stage</span>
            </div>
          </div>

          {/* Sections */}
          <div className="flex flex-col items-center gap-8 w-full">
            {sections.map((section, sIdx) => {
              const sectionSeats = seats.filter(s => s.section_id === section.id);
              const rows = [...new Set(sectionSeats.map(s => s.row_label))].sort();

              if (section.is_general_admission) {
                return (
                  <div key={section.id} className="w-full max-w-[600px] rounded-xl border border-border p-4 text-center bg-muted/30">
                    <div className="flex items-center justify-center gap-2 mb-1">
                      <Users className="w-4 h-4 text-muted-foreground" />
                      <span className="font-black text-sm text-foreground">{section.name}</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground">General Admission</p>
                  </div>
                );
              }

              return (
                <div key={section.id} className="flex flex-col items-center gap-1 w-full">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                      {section.name}
                    </span>
                    <span className="text-[9px] text-muted-foreground">
                      from {getDisplayPrice(parseFloat(section.price) || 0)}
                    </span>
                  </div>

                  {rows
                    .sort((a, b) => getRowOrderValue(sectionSeats, a) - getRowOrderValue(sectionSeats, b))
                    .map((rowLabel, rIdx) => {
                    const rowSeats = sectionSeats.filter(s => s.row_label === rowLabel).sort(sortSeatsByLayout);
                    const totalRows = rows.length;
                    const curveOffset = Math.pow((rIdx / Math.max(totalRows - 1, 1)), 1.5) * 16;

                    return (
                      <div key={rowLabel} className="flex items-center justify-center" style={{ paddingLeft: curveOffset, paddingRight: curveOffset }}>
                        <span className="flex-shrink-0 w-5 text-center text-muted-foreground font-black" style={{ fontSize: fontSize + 1 }}>
                          {rowLabel}
                        </span>
                        <div className="flex items-center justify-center" style={{ gap: seatGap }}>
                          {rowSeats.map(seat => {
                            const isSelected = selectedSeatIds.has(seat.id);
                            const isSold = seat.status === "sold" || !!seat.order_id;
                            const isBlocked = seat.blocked;
                            const isAvailable = !isSold && !isBlocked;

                            let bgColor: string, borderColor: string, textColor: string;

                            if (isSelected) {
                              bgColor = "#CDFF00";
                              borderColor = "#CDFF00";
                              textColor = "#000000";
                            } else if (isBlocked) {
                              bgColor = "transparent";
                              borderColor = "transparent";
                              textColor = "transparent";
                            } else if (isSold) {
                              bgColor = "hsl(var(--primary))";
                              borderColor = "hsl(var(--primary))";
                              textColor = "hsl(var(--primary-foreground))";
                            } else {
                              bgColor = "hsl(var(--foreground) / 0.85)";
                              borderColor = "hsl(var(--foreground) / 0.9)";
                              textColor = "hsl(var(--background))";
                            }

                            return (
                              <button
                                key={seat.id}
                                disabled={!isAvailable && !isSelected}
                                aria-hidden={isBlocked}
                                onClick={() => {
                                  if (!isAvailable && !isSelected) return;
                                  if (!isSelected && selectedSeatIds.size >= maxSelectable) return;
                                  const sectionObj = sections.find(s => s.id === seat.section_id);
                                  onToggleSeat(seat.id, {
                                    sectionName: sectionObj?.name || "",
                                    rowLabel: seat.row_label,
                                    seatNumber: seat.seat_number,
                                    price: getSeatPrice(seat),
                                  });
                                }}
                                onMouseEnter={(e) => { setHoveredSeat(seat); setTooltipPos({ x: e.clientX, y: e.clientY }); }}
                                onMouseMove={(e) => setTooltipPos({ x: e.clientX, y: e.clientY })}
                                onMouseLeave={() => setHoveredSeat(null)}
                                className={cn(
                                  "flex items-center justify-center transition-all duration-150",
                                  isAvailable && !isSelected ? "cursor-pointer hover:opacity-80" : "",
                                  !isAvailable && !isSelected ? "cursor-not-allowed" : "",
                                )}
                                style={{
                                  width: seatSize,
                                  height: seatSize,
                                  fontSize,
                                  fontWeight: 800,
                                  background: bgColor,
                                  border: `2px solid ${borderColor}`,
                                  borderRadius: seatRadius,
                                  color: textColor,
                                  boxShadow: isSelected ? "0 0 10px rgba(205, 255, 0, 0.5)" : undefined,
                                }}
                              >
                                {seat.label === "Wheelchair" ? (
                                  <Accessibility style={{ width: seatSize * 0.55, height: seatSize * 0.55 }} />
                                ) : seat.label === "VIP" ? (
                                  <Crown style={{ width: seatSize * 0.55, height: seatSize * 0.55 }} />
                                ) : seat.label === "Premium" ? (
                                  <Gem style={{ width: seatSize * 0.55, height: seatSize * 0.55 }} />
                                ) : seat.label === "Diamond" ? (
                                  <Diamond style={{ width: seatSize * 0.55, height: seatSize * 0.55 }} />
                                ) : null}
                              </button>
                            );
                          })}
                        </div>
                        <span className="flex-shrink-0 w-5 text-center text-muted-foreground font-black" style={{ fontSize: fontSize + 1 }}>
                          {rowLabel}
                        </span>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default EventSeatingMap;
