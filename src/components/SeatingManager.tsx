import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Plus, Armchair, Users, EyeOff, Star,
  ShoppingCart, Unlock, Crown, Accessibility,
  Sparkles, Heart, Diamond, Gem, Gift,
} from "lucide-react";
import SeatingMapBuilder, { type SeatingSection } from "@/components/SeatingMapBuilder";

interface DbSeat {
  id: string;
  section_id: string;
  event_id: string;
  row_label: string;
  seat_number: number;
  layout_row_index: number;
  layout_seat_index: number;
  status: string;
  order_id: string | null;
  blocked: boolean;
  price: string | null;
  label: string | null;
  is_special: boolean;
}

interface DbSection {
  id: string;
  event_id: string;
  name: string;
  rows_count: number;
  seats_per_row: number;
  price: string;
  is_general_admission: boolean;
  sort_order: number;
}

const SECTION_PALETTE = [
  { bg: "rgba(59,130,246,0.12)", border: "rgba(59,130,246,0.3)", text: "#60a5fa" },
  { bg: "rgba(168,85,247,0.12)", border: "rgba(168,85,247,0.3)", text: "#c084fc" },
  { bg: "rgba(245,158,11,0.12)", border: "rgba(245,158,11,0.3)", text: "#fbbf24" },
  { bg: "rgba(16,185,129,0.12)", border: "rgba(16,185,129,0.3)", text: "#34d399" },
  { bg: "rgba(244,63,94,0.12)", border: "rgba(244,63,94,0.3)", text: "#fb7185" },
  { bg: "rgba(6,182,212,0.12)", border: "rgba(6,182,212,0.3)", text: "#22d3ee" },
];

interface Props {
  eventId: string;
}

const SeatingManager = ({ eventId }: Props) => {
  const [sections, setSections] = useState<DbSection[]>([]);
  const [seats, setSeats] = useState<DbSeat[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSeats, setSelectedSeats] = useState<Set<string>>(new Set());
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [showAddSections, setShowAddSections] = useState(false);
  const [builderSections, setBuilderSections] = useState<SeatingSection[]>([]);
  const [hoveredSeat, setHoveredSeat] = useState<string | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  const [bulkAction, setBulkAction] = useState<"price" | "status" | "special" | "label" | "seat_number" | "row">("status");
  const [bulkValue, setBulkValue] = useState("");
  const [editingRowName, setEditingRowName] = useState(false);
  const [newRowName, setNewRowName] = useState("");
  const [showCompModal, setShowCompModal] = useState(false);
  const [compEmail, setCompEmail] = useState("");

  const sectionsWithSoldSeats = useMemo(() => {
    const ids = new Set<string>();
    seats.forEach(s => {
      if (s.status === "sold" || s.order_id) ids.add(s.section_id);
    });
    return ids;
  }, [seats]);

  const getRowOrderValue = useCallback((sectionSeats: DbSeat[], rowLabel: string) => {
    const rowIndexes = sectionSeats
      .filter((seat) => seat.row_label === rowLabel)
      .map((seat) => seat.layout_row_index ?? Number.MAX_SAFE_INTEGER);

    return Math.min(...rowIndexes);
  }, []);

  const sortSeatsByLayout = useCallback((a: DbSeat, b: DbSeat) => {
    const rowDiff = (a.layout_row_index ?? 0) - (b.layout_row_index ?? 0);
    if (rowDiff !== 0) return rowDiff;

    const seatDiff = (a.layout_seat_index ?? a.seat_number) - (b.layout_seat_index ?? b.seat_number);
    if (seatDiff !== 0) return seatDiff;

    return a.seat_number - b.seat_number;
  }, []);

  const loadData = useCallback(async () => {
    const [secRes, seatRes] = await Promise.all([
      supabase.from("seating_sections").select("*").eq("event_id", eventId).order("sort_order"),
      supabase.from("seats").select("*").eq("event_id", eventId).order("row_label").order("seat_number"),
    ]);
    if (secRes.data) setSections(secRes.data as any);
    if (seatRes.data) setSeats(seatRes.data as any);
    setLoading(false);
  }, [eventId]);

  useEffect(() => { loadData(); }, [loadData]);

  const toggleSeatSelection = (seatId: string) => {
    setSelectedSeats(prev => {
      const next = new Set(prev);
      if (next.has(seatId)) next.delete(seatId);
      else next.add(seatId);
      return next;
    });
  };

  const selectRow = (sectionId: string, rowLabel: string) => {
    const rowSeats = seats.filter(s => s.section_id === sectionId && s.row_label === rowLabel);
    const allSelected = rowSeats.every(s => selectedSeats.has(s.id));
    setSelectedSeats(prev => {
      const next = new Set(prev);
      if (allSelected) rowSeats.forEach(s => next.delete(s.id));
      else rowSeats.forEach(s => next.add(s.id));
      return next;
    });
  };

  const selectAllInSection = (sectionId: string) => {
    const sectionSeats = seats.filter(s => s.section_id === sectionId);
    const allSelected = sectionSeats.every(s => selectedSeats.has(s.id));
    setSelectedSeats(prev => {
      const next = new Set(prev);
      if (allSelected) sectionSeats.forEach(s => next.delete(s.id));
      else sectionSeats.forEach(s => next.add(s.id));
      return next;
    });
  };

  const handleBulkApply = async () => {
    if (selectedSeats.size === 0) return;
    const ids = Array.from(selectedSeats);
    try {
      let updatePayload: any = {};
      switch (bulkAction) {
        case "status":
          if (bulkValue === "blocked") updatePayload = { blocked: true, status: "available" };
          else if (bulkValue === "sold") updatePayload = { status: "sold", blocked: false };
          else updatePayload = { status: "available", blocked: false };
          break;
        case "price":
          updatePayload = { price: bulkValue || null };
          break;
        case "label":
          updatePayload = { label: bulkValue || null, is_special: ["VIP", "Premium", "Diamond", "Special"].includes(bulkValue) };
          break;
        case "seat_number":
          updatePayload = { seat_number: parseInt(bulkValue) || 1 };
          break;
        case "row":
          updatePayload = { row_label: bulkValue.toUpperCase() };
          break;
      }
      const { error } = await supabase.from("seats").update(updatePayload).in("id", ids);
      if (error) throw error;
      setSeats(prev => prev.map(seat => (
        ids.includes(seat.id)
          ? {
              ...seat,
              ...updatePayload,
              row_label: updatePayload.row_label ?? seat.row_label,
              seat_number: updatePayload.seat_number ?? seat.seat_number,
            }
          : seat
      )));
      toast.success(`Updated ${ids.length} seats`);
      setSelectedSeats(new Set());
      setShowBulkModal(false);
      await loadData();
    } catch (err: any) {
      toast.error(err.message || "Failed to update seats");
    }
  };

  const handleSaveSections = async () => {
    if (builderSections.length === 0) { toast.error("Add at least one section"); return; }
    try {
      await supabase.from("seats").delete().eq("event_id", eventId);
      await supabase.from("seating_sections").delete().eq("event_id", eventId);
      const sectionRows = builderSections.map((s, i) => ({
        event_id: eventId, name: s.name, rows_count: s.rowsCount, seats_per_row: s.seatsPerRow,
        price: s.price || "0", is_general_admission: s.isGeneralAdmission, sort_order: i,
      }));
      const { data: insertedSections, error: secErr } = await supabase.from("seating_sections").insert(sectionRows as any).select();
      if (secErr) throw secErr;
      if (insertedSections) {
        const seatRows: any[] = [];
        for (const sec of insertedSections) {
          const original = builderSections.find(s => s.name === (sec as any).name);
          if (original?.isGeneralAdmission) continue;
          for (let r = 0; r < (sec as any).rows_count; r++) {
            const rowLabel = String.fromCharCode(65 + r);
            for (let s = 1; s <= (sec as any).seats_per_row; s++) {
              seatRows.push({ section_id: (sec as any).id, event_id: eventId, row_label: rowLabel, seat_number: s, status: "available" });
            }
          }
        }
        if (seatRows.length > 0) {
          const { error: seatErr } = await supabase.from("seats").insert(seatRows as any);
          if (seatErr) throw seatErr;
        }
      }
      toast.success("Seating map saved");
      setShowAddSections(false);
      loadData();
    } catch (err: any) {
      toast.error(err.message || "Failed to save seating map");
    }
  };

  const getSectionStats = (sectionId: string) => {
    const ss = seats.filter(s => s.section_id === sectionId);
    return {
      total: ss.filter(s => !s.blocked).length,
      available: ss.filter(s => s.status === "available" && !s.blocked).length,
      sold: ss.filter(s => s.status === "sold").length,
      blocked: ss.filter(s => s.blocked).length,
      special: ss.filter(s => s.is_special).length,
    };
  };

  // Compute the max seats per row across all sections for scaling
  const maxSeatsPerRow = useMemo(() => {
    return Math.max(...sections.map(s => s.seats_per_row), 1);
  }, [sections]);

  if (loading) {
    return <div className="flex items-center justify-center py-12"><p className="text-muted-foreground font-bold">Loading seating map...</p></div>;
  }

  if (sections.length === 0) {
    return (
      <div className="space-y-6">
        <div className="text-center py-12 border-2 border-dashed border-border rounded-2xl">
          <Armchair className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="font-black text-lg mb-2">No Seating Map</h3>
          <p className="text-muted-foreground text-sm mb-6 max-w-md mx-auto">
            This is a seated event. Create a seating map to define sections, rows, and seats.
          </p>
          <Button onClick={() => { setBuilderSections([]); setShowAddSections(true); }}>
            <Plus className="w-4 h-4 mr-2" /> Create Seating Map
          </Button>
        </div>
        <Dialog open={showAddSections} onOpenChange={setShowAddSections}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader><DialogTitle className="font-black">Create Seating Map</DialogTitle></DialogHeader>
            <SeatingMapBuilder sections={builderSections} onChange={setBuilderSections} />
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAddSections(false)}>Cancel</Button>
              <Button onClick={handleSaveSections}>Save Seating Map</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // SEAT SIZE based on max seats (responsive)
  const seatSize = maxSeatsPerRow > 30 ? 18 : maxSeatsPerRow > 20 ? 22 : maxSeatsPerRow > 12 ? 28 : 34;
  const seatGap = seatSize > 24 ? 5 : 3;
  const fontSize = seatSize > 24 ? 10 : 8;
  const seatRadius = Math.round(seatSize * 0.22);

  return (
    <div className="space-y-4">
      {/* Top bar */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-black text-lg">Seating Map</h3>
          <p className="text-xs text-muted-foreground">Click seats to select · Click row label to select row · Bulk actions below</p>
        </div>
        <div className="flex items-center gap-2">
          {selectedSeats.size > 0 && (
            <>
              <Button size="sm" variant="outline" onClick={() => { setSelectedSeats(new Set()); setEditingRowName(false); }}>
                Clear ({selectedSeats.size})
              </Button>
              {!editingRowName ? (
                <Button size="sm" variant="outline" onClick={() => {
                  const selectedArr = Array.from(selectedSeats);
                  const selectedSeatObjs = seats.filter(s => selectedArr.includes(s.id));
                  const rowLabels = [...new Set(selectedSeatObjs.map(s => s.row_label))];
                  setNewRowName(rowLabels.length === 1 ? rowLabels[0] : "");
                  setEditingRowName(true);
                }}>
                  Rename Row
                </Button>
              ) : (
                <div className="flex items-center gap-1.5">
                  <Input
                    value={newRowName}
                    onChange={(e) => setNewRowName(e.target.value.toUpperCase())}
                    placeholder="Row name"
                    className="h-8 w-20 text-xs"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        (async () => {
                          if (!newRowName.trim()) return;
                          const ids = Array.from(selectedSeats);
                          const { error } = await supabase.from("seats").update({ row_label: newRowName.trim() }).in("id", ids);
                          if (error) { toast.error("Failed to rename row"); return; }
                          setSeats(prev => prev.map(s => ids.includes(s.id) ? { ...s, row_label: newRowName.trim() } : s));
                          toast.success(`Renamed row to ${newRowName.trim()}`);
                          setEditingRowName(false);
                        })();
                      }
                      if (e.key === "Escape") setEditingRowName(false);
                    }}
                  />
                  <Button size="sm" onClick={async () => {
                    if (!newRowName.trim()) return;
                    const ids = Array.from(selectedSeats);
                    const { error } = await supabase.from("seats").update({ row_label: newRowName.trim() }).in("id", ids);
                    if (error) { toast.error("Failed to rename row"); return; }
                    setSeats(prev => prev.map(s => ids.includes(s.id) ? { ...s, row_label: newRowName.trim() } : s));
                    toast.success(`Renamed row to ${newRowName.trim()}`);
                    setEditingRowName(false);
                  }}>
                    Save
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditingRowName(false)}>
                    ✕
                  </Button>
                </div>
              )}
              <Button size="sm" onClick={() => setShowBulkModal(true)}>
                Edit {selectedSeats.size} seats
              </Button>
              {selectedSeats.size === 1 && (() => {
                const seatObj = seats.find(s => s.id === Array.from(selectedSeats)[0]);
                return seatObj && seatObj.status !== "sold" && !seatObj.order_id && !seatObj.blocked;
              })() && (
                <Button size="sm" variant="outline" onClick={() => { setCompEmail(""); setShowCompModal(true); }}>
                  <Gift className="w-3.5 h-3.5 mr-1" /> Send Comp Ticket
                </Button>
              )}
            </>
          )}
          <Button size="sm" variant="outline" onClick={() => {
            setBuilderSections(sections.map(s => ({
              id: s.id, name: s.name, rowsCount: s.rows_count, seatsPerRow: s.seats_per_row,
              isGeneralAdmission: s.is_general_admission, sortOrder: s.sort_order, price: s.price || "",
            })));
            setShowAddSections(true);
          }}>
            <Plus className="w-4 h-4 mr-1" /> Edit Layout
          </Button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 text-xs">
        {[
          { cls: "bg-foreground/85", label: "Available" },
          { cls: "bg-primary", label: "Sold" },
          { cls: "border-2 border-border", label: "Disabled" },
          { cls: "border-2 border-primary", label: "Special" },
          { cls: "ring-2 ring-[#CDFF00]/50", label: "Selected", style: { backgroundColor: "#CDFF00" } },
        ].map(l => (
          <div key={l.label} className="flex items-center gap-1.5">
            <div className={cn("w-3 h-3 rounded-sm", l.cls)} style={(l as any).style} />
            <span className="text-muted-foreground">{l.label}</span>
          </div>
        ))}
      </div>

      {/* ========== 2D MAP ========== */}
      <div className="relative bg-secondary/30 rounded-2xl border border-border overflow-hidden">
        {/* Tooltip */}
        {hoveredSeat && (() => {
          const currentSeat = seats.find(s => s.id === hoveredSeat) || null;
          if (!currentSeat) return null;
          return (
            <div
              className="fixed z-[100] pointer-events-none bg-popover border border-border rounded-lg px-3 py-2 shadow-xl"
              style={{ left: tooltipPos.x + 12, top: tooltipPos.y - 10 }}
            >
              <p className="text-xs font-black text-foreground">
                Row {currentSeat.row_label} · Seat {currentSeat.seat_number}
                {currentSeat.is_special && <Star className="inline w-3 h-3 ml-1 text-amber-400 fill-amber-400" />}
              </p>
              <p className="text-[10px] text-muted-foreground">
                {currentSeat.blocked ? "Disabled" : currentSeat.status === "sold" ? "Sold" : "Available"}
                {currentSeat.price && ` · $${currentSeat.price}`}
                {currentSeat.label && ` · ${currentSeat.label}`}
              </p>
            </div>
          );
        })()}

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
              const palette = SECTION_PALETTE[sIdx % SECTION_PALETTE.length];
              const sectionSeats = seats.filter(s => s.section_id === section.id);
              const rows = [...new Set(sectionSeats.map(s => s.row_label))].sort();
              const stats = getSectionStats(section.id);

              if (section.is_general_admission) {
                return (
                  <div
                    key={section.id}
                    className="w-full max-w-[600px] rounded-xl border p-4 text-center"
                    style={{ background: palette.bg, borderColor: palette.border }}
                  >
                    <div className="flex items-center justify-center gap-2 mb-1">
                      <Users className="w-4 h-4" style={{ color: palette.text }} />
                      <span className="font-black text-sm" style={{ color: palette.text }}>{section.name}</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      General Admission · Capacity: {section.rows_count * section.seats_per_row}
                    </p>
                  </div>
                );
              }

              return (
                <div key={section.id} className="flex flex-col items-center gap-1 w-full">
                  {/* Section label */}
                  <div className="flex items-center gap-2 mb-2">
                    <button
                      onClick={() => selectAllInSection(section.id)}
                      className="text-[10px] font-black uppercase tracking-widest hover:underline cursor-pointer"
                      style={{ color: palette.text }}
                    >
                      {section.name}
                    </button>
                    <span className="text-[9px] text-muted-foreground">
                      {stats.available}/{stats.total} avail
                      {stats.sold > 0 && ` · ${stats.sold} sold`}
                    </span>
                  </div>

                  {/* Rows */}
                  {rows
                    .sort((a, b) => getRowOrderValue(sectionSeats, a) - getRowOrderValue(sectionSeats, b))
                    .map((rowLabel, rIdx) => {
                    const rowSeats = sectionSeats.filter(s => s.row_label === rowLabel).sort(sortSeatsByLayout);
                    // Slight curve: offset increases toward the edges
                    const totalRows = rows.length;
                    const curveOffset = Math.pow((rIdx / Math.max(totalRows - 1, 1)), 1.5) * 16;

                    return (
                      <div
                        key={rowLabel}
                        className="flex items-center justify-center"
                        style={{ paddingLeft: curveOffset, paddingRight: curveOffset }}
                      >
                        {/* Row label left */}
                        <button
                          onClick={() => selectRow(section.id, rowLabel)}
                          className="flex-shrink-0 w-5 text-center text-muted-foreground hover:text-primary transition-colors cursor-pointer"
                          style={{ fontSize: fontSize + 1 }}
                          title={`Select row ${rowLabel}`}
                        >
                          <span className="font-black">{rowLabel}</span>
                        </button>

                        {/* Seats */}
                        <div className="flex items-center justify-center" style={{ gap: seatGap }}>
                          {rowSeats.map(seat => {
                            const isSelected = selectedSeats.has(seat.id);
                            const isSold = seat.status === "sold";
                            const isBlocked = seat.blocked;
                            const isSpecial = seat.is_special;

                            let bgColor = "hsl(var(--muted) / 0.6)";
                            let borderColor = "hsl(var(--muted-foreground) / 0.2)";
                            let textColor = "hsl(var(--muted-foreground) / 0.5)";

                            if (isSelected) {
                              bgColor = "#CDFF00";
                              borderColor = "#CDFF00";
                              textColor = "#000000";
                            } else if (isBlocked) {
                              bgColor = "transparent";
                              borderColor = "hsl(var(--border))";
                              textColor = "hsl(var(--muted-foreground) / 0.3)";
                            } else if (isSold) {
                              bgColor = "hsl(var(--primary))";
                              borderColor = "hsl(var(--primary))";
                              textColor = "hsl(var(--primary-foreground))";
                            } else if (isSpecial) {
                              bgColor = "transparent";
                              borderColor = "hsl(var(--primary))";
                              textColor = "hsl(var(--primary) / 0.7)";
                            } else {
                              bgColor = "hsl(var(--foreground) / 0.85)";
                              borderColor = "hsl(var(--foreground) / 0.9)";
                              textColor = "hsl(var(--background))";
                            }

                            return (
                              <button
                                key={seat.id}
                                onClick={() => toggleSeatSelection(seat.id)}
                                onMouseEnter={(e) => { setHoveredSeat(seat.id); setTooltipPos({ x: e.clientX, y: e.clientY }); }}
                                onMouseMove={(e) => setTooltipPos({ x: e.clientX, y: e.clientY })}
                                onMouseLeave={() => setHoveredSeat(null)}
                                className="flex items-center justify-center transition-all duration-150 cursor-pointer"
                                style={{
                                  width: seatSize,
                                  height: seatSize,
                                  fontSize,
                                  fontWeight: 800,
                                  background: bgColor,
                                  border: `2px solid ${borderColor}`,
                                  borderRadius: seatRadius,
                                  color: textColor,
                                  boxShadow: isSelected ? "0 0 8px rgba(205, 255, 0, 0.5)" : undefined,
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

                        {/* Row label right */}
                        <div
                          className="flex-shrink-0 w-5 text-center text-muted-foreground"
                          style={{ fontSize: fontSize + 1 }}
                        >
                          <span className="font-black">{rowLabel}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Section stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {sections.map((section, sIdx) => {
          const palette = SECTION_PALETTE[sIdx % SECTION_PALETTE.length];
          const stats = getSectionStats(section.id);
          return (
            <div
              key={section.id}
              className="rounded-xl border p-3"
              style={{ background: palette.bg, borderColor: palette.border }}
            >
              <p className="font-black text-xs mb-1" style={{ color: palette.text }}>{section.name}</p>
              <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[10px]">
                <span className="text-muted-foreground">Total</span>
                <span className="font-bold text-foreground text-right">{stats.total}</span>
                <span className="text-muted-foreground">Available</span>
                <span className="font-bold text-emerald-400 text-right">{stats.available}</span>
                <span className="text-muted-foreground">Sold</span>
                <span className="font-bold text-red-400 text-right">{stats.sold}</span>
                {stats.blocked > 0 && <>
                  <span className="text-muted-foreground">Disabled</span>
                  <span className="font-bold text-muted-foreground text-right">{stats.blocked}</span>
                </>}
              </div>
            </div>
          );
        })}
      </div>

      {/* Bulk action modal */}
      <Dialog open={showBulkModal} onOpenChange={setShowBulkModal}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="font-black">Edit {selectedSeats.size} Seats</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-xs font-bold text-muted-foreground">Action</Label>
              <Select value={bulkAction} onValueChange={(v: any) => { setBulkAction(v); setBulkValue(""); }}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="status">Change Status</SelectItem>
                  <SelectItem value="price">Change Price</SelectItem>
                  <SelectItem value="label">Set Label</SelectItem>
                  {selectedSeats.size === 1 && <SelectItem value="seat_number">Change Seat Number</SelectItem>}
                  
                </SelectContent>
              </Select>
            </div>
            {bulkAction === "status" && (
              <div>
                <Label className="text-xs font-bold text-muted-foreground">Status</Label>
                <Select value={bulkValue} onValueChange={setBulkValue}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Choose status" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="available"><div className="flex items-center gap-2"><Unlock className="w-3 h-3 text-emerald-400" /> Available</div></SelectItem>
                    <SelectItem value="blocked"><div className="flex items-center gap-2"><EyeOff className="w-3 h-3 text-muted-foreground" /> Disabled (Hidden)</div></SelectItem>
                    <SelectItem value="sold"><div className="flex items-center gap-2"><ShoppingCart className="w-3 h-3 text-red-400" /> Mark as Sold</div></SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            {bulkAction === "price" && (() => {
              const selectedSeatsList = seats.filter(s => selectedSeats.has(s.id));
              const currentPrices = [...new Set(selectedSeatsList.map(s => s.price))];
              const sectionIds = [...new Set(selectedSeatsList.map(s => s.section_id))];
              const sectionPrices = sectionIds.map(sid => {
                const sec = sections.find(s => s.id === sid);
                return sec ? sec.price : "0";
              });
              const currentDisplay = currentPrices.length === 1 && currentPrices[0]
                ? `$${currentPrices[0]}`
                : currentPrices.every(p => !p)
                  ? `Section default ($${[...new Set(sectionPrices)].join(" / $")})`
                  : "Mixed";

              const gross = parseFloat(bulkValue) || 0;
              const serviceFee = gross > 0 ? gross * 0.10 + 0.99 : 0;
              const displayed = gross + serviceFee;
              return (
                <div className="space-y-2">
                  <div className="rounded-md bg-muted/50 p-2 text-xs">
                    <span className="text-muted-foreground">Current Price: </span>
                    <span className="font-bold text-foreground">{currentDisplay}</span>
                  </div>
                  <div>
                    <Label className="text-xs font-bold text-muted-foreground">New Gross Ticket Price ($)</Label>
                    <Input type="number" min="0" step="0.01" value={bulkValue} onChange={e => setBulkValue(e.target.value)} placeholder="Leave empty for section default" className="mt-1" />
                  </div>
                  {gross > 0 && (
                    <div className="rounded-md bg-muted/50 p-2 text-xs space-y-1">
                      <div className="flex justify-between text-muted-foreground">
                        <span>Gross Ticket Price:</span>
                        <span className="font-bold text-foreground">${gross.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-muted-foreground">
                        <span>Service Fee:</span>
                        <span className="font-bold text-foreground">${serviceFee.toFixed(2)}</span>
                      </div>
                      <div className="border-t border-border pt-1 flex justify-between font-bold text-foreground">
                        <span>Displayed Ticket Price:</span>
                        <span>${displayed.toFixed(2)}</span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}
            {bulkAction === "label" && (
              <div>
                <Label className="text-xs font-bold text-muted-foreground">Seat Label</Label>
                <div className="grid grid-cols-3 gap-2 mt-2">
                  {[
                    { value: "VIP", icon: <Crown className="w-4 h-4 text-amber-400" />, label: "VIP" },
                    { value: "Wheelchair", icon: <Accessibility className="w-4 h-4 text-blue-400" />, label: "Wheelchair" },
                    { value: "Premium", icon: <Gem className="w-4 h-4 text-purple-400" />, label: "Premium" },
                    { value: "Diamond", icon: <Diamond className="w-4 h-4 text-cyan-400" />, label: "Diamond" },
                    { value: "Favorite", icon: <Heart className="w-4 h-4 text-red-400" />, label: "Favorite" },
                    { value: "Special", icon: <Sparkles className="w-4 h-4 text-amber-300" />, label: "Special" },
                  ].map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setBulkValue(bulkValue === opt.value ? "" : opt.value)}
                      className={cn(
                        "flex flex-col items-center gap-1.5 rounded-lg border-2 p-3 transition-all text-xs font-semibold",
                        bulkValue === opt.value
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border bg-background text-muted-foreground hover:border-muted-foreground/50"
                      )}
                    >
                      {opt.icon}
                      {opt.label}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">Click again to remove label</p>
              </div>
            )}
            {bulkAction === "seat_number" && selectedSeats.size === 1 && (
              <div>
                <Label className="text-xs font-bold text-muted-foreground">New Seat Number</Label>
                <Input type="number" min="1" value={bulkValue} onChange={e => setBulkValue(e.target.value)} placeholder="Enter new seat number" className="mt-1" />
              </div>
            )}
            {bulkAction === "row" && (
              <div>
                <Label className="text-xs font-bold text-muted-foreground">New Row Label</Label>
                <Input value={bulkValue} onChange={e => setBulkValue(e.target.value.toUpperCase())} placeholder="e.g. A, B, C" maxLength={3} className="mt-1 uppercase" />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBulkModal(false)}>Cancel</Button>
            <Button onClick={handleBulkApply} disabled={bulkAction === "status" && !bulkValue}>Apply to {selectedSeats.size} seats</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Layout dialog */}
      <Dialog open={showAddSections} onOpenChange={setShowAddSections}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="font-black">Edit Seating Layout</DialogTitle></DialogHeader>
          <p className="text-xs text-destructive font-bold">⚠️ Changing the layout will reset all seat statuses and customizations.</p>
          <SeatingMapBuilder sections={builderSections} onChange={setBuilderSections} lockedSectionIds={sectionsWithSoldSeats} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddSections(false)}>Cancel</Button>
            <Button onClick={handleSaveSections}>Save Layout</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Send Comp Ticket dialog */}
      <Dialog open={showCompModal} onOpenChange={setShowCompModal}>
        <DialogContent className="sm:max-w-md rounded-3xl">
          <DialogHeader>
            <DialogTitle className="font-black text-xl">Send Complimentary Ticket</DialogTitle>
          </DialogHeader>
          {(() => {
            const seatId = Array.from(selectedSeats)[0];
            const seat = seats.find(s => s.id === seatId);
            if (!seat) return null;
            const section = sections.find(s => s.id === seat.section_id);
            return (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Seat: <span className="font-bold text-foreground">{section?.name} · Row {seat.row_label} · Seat {seat.seat_number}</span>
                </p>
                <div>
                  <Label className="text-xs font-bold text-muted-foreground">Recipient Email</Label>
                  <Input
                    type="email"
                    value={compEmail}
                    onChange={(e) => setCompEmail(e.target.value)}
                    placeholder="guest@example.com"
                    className="mt-1"
                    autoFocus
                  />
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowCompModal(false)}>Cancel</Button>
                  <Button
                    disabled={!compEmail.trim() || !compEmail.includes("@")}
                    onClick={async () => {
                      const sectionObj = sections.find(s => s.id === seat.section_id);
                      const ticketName = `${sectionObj?.name || "Section"} · Row ${seat.row_label} · Seat ${seat.seat_number}`;
                      const { error } = await supabase.from("comp_tickets").insert({
                        event_id: eventId,
                        email: compEmail.trim(),
                        ticket_type: ticketName,
                      });
                      if (error) { toast.error("Failed to send comp ticket"); return; }
                      // Mark seat as sold
                      await supabase.from("seats").update({ status: "sold" }).eq("id", seat.id);
                      setSeats(prev => prev.map(s => s.id === seat.id ? { ...s, status: "sold" } : s));
                      toast.success(`Comp ticket sent to ${compEmail.trim()}`);
                      setShowCompModal(false);
                      setSelectedSeats(new Set());
                    }}
                  >
                    <Gift className="w-4 h-4 mr-1" /> Send Ticket
                  </Button>
                </DialogFooter>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SeatingManager;
