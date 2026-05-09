import { useState, useMemo, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { Calendar } from "@/components/ui/calendar";
import { PlusCircle, Filter, StickyNote, X, CalendarDays } from "lucide-react";
import { getEventsByOrg, type StoredEvent } from "@/stores/eventStore";
import { format, isBefore, startOfDay, parseISO, isSameDay } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type EventFilter = "All" | "Live" | "Past";

interface CalendarNote {
  date: string; // ISO date string yyyy-MM-dd
  text: string;
}

const statusStyles: Record<string, string> = {
  Live: "bg-[hsl(var(--brand-lime))]/10 text-[hsl(var(--brand-lime))] border-[hsl(var(--brand-lime))]/20",
  "Sold Out": "bg-[hsl(var(--brand-pink))]/10 text-[hsl(var(--brand-pink))] border-[hsl(var(--brand-pink))]/20",
  Draft: "bg-muted text-muted-foreground border-border",
  Ended: "bg-foreground/10 text-foreground border-foreground/20",
};

const NOTES_KEY = "lovable_calendar_notes";

const loadNotes = (orgSlug: string): CalendarNote[] => {
  try {
    const raw = localStorage.getItem(`${NOTES_KEY}_${orgSlug}`);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const saveNotes = (orgSlug: string, notes: CalendarNote[]) => {
  localStorage.setItem(`${NOTES_KEY}_${orgSlug}`, JSON.stringify(notes));
};

interface Props {
  orgSlug: string;
  events?: StoredEvent[];
  isPromoter?: boolean;
}

const monthMap: Record<string, number> = {
  Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
  Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11,
  JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, JUN: 5,
  JUL: 6, AUG: 7, SEP: 8, OCT: 9, NOV: 10, DEC: 11,
};

const parseEventDate = (ev: Pick<StoredEvent, "date" | "month" | "year">): Date | null => {
  const m = monthMap[ev.month];
  if (m === undefined || !ev.date || !ev.year) return null;
  return new Date(Number(ev.year), m, Number(ev.date));
};

const parseEventEndDate = (ev: StoredEvent): Date | null => {
  if (!ev.endDate || !ev.endMonth || !ev.endYear) return null;
  const m = monthMap[ev.endMonth];
  if (m === undefined) return null;
  return new Date(Number(ev.endYear), m, Number(ev.endDate));
};

const isEventPast = (ev: StoredEvent, today: Date): boolean => {
  const endD = parseEventEndDate(ev);
  if (endD) return isBefore(endD, today);
  const startD = parseEventDate(ev);
  return startD ? isBefore(startD, today) : false;
};

const getEventPriceFromTicketTypes = (eventId: string, ticketTypesMap: Map<string, {price: string}[]>): string => {
  const types = ticketTypesMap.get(eventId);
  if (types && types.length > 0) {
    const prices = types.map(t => parseFloat(t.price)).filter(p => !isNaN(p) && p > 0);
    if (prices.length === 0) return "Free";
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    if (min === max) return `$${min.toFixed(2)}`;
    return `$${min.toFixed(2)} – $${max.toFixed(2)}`;
  }
  return "Free";
};

export default function OrgEventsTab({ orgSlug, events: propEvents, isPromoter = false }: Props) {
  const [filter, setFilter] = useState<EventFilter>("All");
  const [calendarDate, setCalendarDate] = useState<Date>(new Date());
  const [selectedDay, setSelectedDay] = useState<Date | undefined>(undefined);
  const [notes, setNotes] = useState<CalendarNote[]>(() => loadNotes(orgSlug));
  const [noteDialog, setNoteDialog] = useState(false);
  const [noteText, setNoteText] = useState("");

  const today = startOfDay(new Date());

  const [dbEvents, setDbEvents] = useState<StoredEvent[]>([]);

  const [revenueMap, setRevenueMap] = useState<Map<string, number>>(new Map());

  useEffect(() => {
    if (propEvents) {
      setDbEvents(propEvents);
    } else {
      getEventsByOrg(orgSlug).then(setDbEvents);
    }
  }, [orgSlug, propEvents]);

  useEffect(() => {
    if (dbEvents.length === 0) return;
    const eventIds = dbEvents.map(e => e.id);
    supabase.from("orders").select("event_id, unit_price, quantity, discount, refunded_amount").in("event_id", eventIds).then(({ data }) => {
      const map = new Map<string, number>();
      (data || []).forEach(o => {
        const gross = Math.max(0, Number(o.unit_price) || 0) * Math.max(1, Number(o.quantity) || 1);
        const discount = Math.max(0, Number(o.discount) || 0);
        const refunded = Math.max(0, Number(o.refunded_amount) || 0);
        const rev = Math.max(0, gross - discount - refunded);
        map.set(o.event_id, (map.get(o.event_id) || 0) + rev);
      });
      setRevenueMap(map);
    });
  }, [dbEvents]);

  const allEvents = dbEvents;

  const filtered = useMemo(() => {
    if (filter === "All") return allEvents;
    return allEvents.filter((ev) => {
      const past = isEventPast(ev, today);
      if (filter === "Live") {
        return !past;
      }
      // Past
      return past;
    });
  }, [allEvents, filter, today]);

  // Dates that have events for calendar highlighting
  const eventDates = useMemo(() => {
    const dates: Date[] = [];
    allEvents.forEach((ev) => {
      const d = parseEventDate(ev);
      if (d) dates.push(d);
    });
    return dates;
  }, [allEvents]);

  // Notes for a given date
  const notesForDay = (d: Date) =>
    notes.filter((n) => isSameDay(parseISO(n.date), d));

  const handleAddNote = () => {
    if (!selectedDay || !noteText.trim()) return;
    const updated = [
      ...notes,
      { date: format(selectedDay, "yyyy-MM-dd"), text: noteText.trim() },
    ];
    setNotes(updated);
    saveNotes(orgSlug, updated);
    setNoteText("");
    setNoteDialog(false);
  };

  const handleDeleteNote = (idx: number) => {
    const updated = notes.filter((_, i) => i !== idx);
    setNotes(updated);
    saveNotes(orgSlug, updated);
  };

  const selectedDayNotes = selectedDay ? notesForDay(selectedDay) : [];
  const selectedDayEvents = selectedDay
    ? allEvents.filter((ev) => {
        const d = parseEventDate(ev);
        return d && isSameDay(d, selectedDay);
      })
    : [];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between md:items-end gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-black tracking-tighter text-foreground mb-1">Events</h1>
          <p className="text-muted-foreground text-sm">
            Manage and track all your events in one place.
          </p>
        </div>
        <Link
          to={`/dashboard/${orgSlug}/create-event`}
          className="px-5 py-2.5 rounded-full bg-[hsl(var(--brand-pink))] text-primary-foreground text-sm font-bold flex items-center gap-2 hover:scale-105 transition-transform active:scale-95 w-fit"
        >
          <PlusCircle className="w-4 h-4" />
          New Event
        </Link>
      </div>

      {/* Filter Pills */}
      <div className="flex bg-secondary rounded-full p-1 w-fit">
        {(["All", "Live", "Past"] as EventFilter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-5 py-2 rounded-full text-xs font-bold transition-all ${
              filter === f
                ? "bg-accent text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {f}
            <span className="ml-1.5 text-[10px] opacity-60">
              {f === "All"
                ? allEvents.length
                : f === "Live"
                ? allEvents.filter((e) => !isEventPast(e, today)).length
                : allEvents.filter((e) => isEventPast(e, today)).length}
            </span>
          </button>
        ))}
      </div>

      {/* Events Table */}
      <div className="bg-card rounded-3xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border">
                <th className="px-8 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Event</th>
                <th className="px-8 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Date</th>
                <th className="px-8 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Venue</th>
                <th className="px-8 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Status</th>
                {!isPromoter && <th className="px-8 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground text-right">Total Revenue</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={isPromoter ? 4 : 5} className="px-8 py-12 text-center text-muted-foreground text-sm">
                    No events found.
                  </td>
                </tr>
              )}
              {filtered.map((ev) => {
                const d = parseEventDate(ev);
                const dateStr = d ? format(d, "MMM dd, yyyy") : "—";
                const isPast = isEventPast(ev, today);
                return (
                  <tr key={ev.id} className="group hover:bg-secondary/50 transition-colors">
                    <td className="px-8 py-5">
                      <Link
                        to={`/dashboard/${orgSlug}/event/${ev.id}`}
                        className="flex items-center gap-4"
                      >
                        <div className="w-12 h-12 rounded-xl overflow-hidden flex-shrink-0 bg-secondary">
                          {ev.flyer ? (
                            <img src={ev.flyer} alt={ev.title} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-muted-foreground text-lg">
                              <CalendarDays className="w-5 h-5" />
                            </div>
                          )}
                        </div>
                        <div>
                          <p className="font-bold text-foreground group-hover:text-[hsl(var(--brand-pink))] transition-colors">
                            {ev.title || "Untitled Event"}
                          </p>
                          <p className="text-xs text-muted-foreground">{ev.city || ev.venue || "—"}</p>
                        </div>
                      </Link>
                    </td>
                    <td className={`px-8 py-5 text-sm font-medium ${isPast ? "text-muted-foreground" : "text-foreground"}`}>
                      {dateStr}
                    </td>
                    <td className="px-8 py-5 text-sm text-muted-foreground">{ev.venue || "—"}</td>
                    <td className="px-8 py-5">
                      <span
                        className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                          isPast ? statusStyles.Ended : (statusStyles[ev.status] || statusStyles.Draft)
                        }`}
                      >
                        {isPast ? "Ended" : ev.status}
                      </span>
                    </td>
                    {!isPromoter && (
                      <td className="px-8 py-5 text-right font-black text-foreground tabular-nums">
                        {(revenueMap.get(ev.id) || 0).toLocaleString("en-US", { style: "currency", currency: "USD" })}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Calendar Section */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        <div className="xl:col-span-2 bg-card rounded-3xl border border-border p-8">
          <h3 className="text-xl font-black text-foreground mb-6 flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-[hsl(var(--brand-pink))]" />
            Event Calendar
          </h3>
          <Calendar
            mode="single"
            selected={selectedDay}
            onSelect={(d) => setSelectedDay(d)}
            month={calendarDate}
            onMonthChange={setCalendarDate}
            className="p-0 pointer-events-auto w-full"
            classNames={{
              months: "w-full",
              month: "w-full space-y-4",
              table: "w-full border-collapse",
              head_row: "flex w-full",
              head_cell: "text-muted-foreground rounded-md flex-1 font-bold text-xs text-center",
              row: "flex w-full mt-1",
              cell: "flex-1 h-14 text-center text-sm p-0.5 relative",
              day: "h-full w-full rounded-xl font-medium hover:bg-secondary transition-colors flex flex-col items-center justify-center gap-0.5 aria-selected:opacity-100",
              day_selected: "bg-[hsl(var(--brand-pink))] text-primary-foreground hover:bg-[hsl(var(--brand-pink))] focus:bg-[hsl(var(--brand-pink))]",
              day_today: "bg-accent text-accent-foreground font-black",
              day_outside: "text-muted-foreground opacity-30",
              caption: "flex justify-center pt-1 relative items-center mb-4",
              caption_label: "text-sm font-black",
              nav_button: "h-8 w-8 bg-secondary hover:bg-accent rounded-full p-0 flex items-center justify-center transition-colors",
              nav_button_previous: "absolute left-0",
              nav_button_next: "absolute right-0",
            }}
            components={{
              DayContent: ({ date }) => {
                const hasEvent = eventDates.some((ed) => isSameDay(ed, date));
                const hasNote = notes.some((n) => isSameDay(parseISO(n.date), date));
                return (
                  <div className="flex flex-col items-center">
                    <span>{date.getDate()}</span>
                    <div className="flex gap-0.5">
                      {hasEvent && (
                        <div className="w-1.5 h-1.5 rounded-full bg-[hsl(var(--brand-pink))]" />
                      )}
                      {hasNote && (
                        <div className="w-1.5 h-1.5 rounded-full bg-[hsl(var(--brand-lime))]" />
                      )}
                    </div>
                  </div>
                );
              },
              IconLeft: () => <span className="text-xs">◀</span>,
              IconRight: () => <span className="text-xs">▶</span>,
            }}
          />
        </div>

        {/* Day Detail Panel */}
        <div className="bg-card rounded-3xl border border-border p-8 flex flex-col">
          <h3 className="text-lg font-black text-foreground mb-1">
            {selectedDay ? format(selectedDay, "EEEE, MMMM d") : "Select a day"}
          </h3>
          <p className="text-xs text-muted-foreground mb-6">
            {selectedDay
              ? isSameDay(selectedDay, today)
                ? "Today"
                : format(selectedDay, "yyyy")
              : "Click a date on the calendar"}
          </p>

          {selectedDay && (
            <>
              {/* Events on this day */}
              {selectedDayEvents.length > 0 && (
                <div className="mb-6">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground mb-3">
                    Events
                  </p>
                  <div className="space-y-2">
                    {selectedDayEvents.map((ev) => (
                      <Link
                        key={ev.id}
                        to={`/dashboard/${orgSlug}/event/${ev.id}`}
                        className="flex items-center gap-3 p-3 rounded-xl bg-secondary hover:bg-accent transition-colors group"
                      >
                        <div className="w-9 h-9 rounded-lg overflow-hidden flex-shrink-0 bg-muted">
                          {ev.flyer ? (
                            <img src={ev.flyer} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <CalendarDays className="w-4 h-4 text-muted-foreground" />
                            </div>
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-foreground truncate group-hover:text-[hsl(var(--brand-pink))] transition-colors">
                            {ev.title || "Untitled"}
                          </p>
                          <p className="text-[10px] text-muted-foreground">{ev.time} · {ev.venue}</p>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {/* Notes */}
              <div className="flex-1">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-1.5">
                    <StickyNote className="w-3 h-3" /> Notes
                  </p>
                  <button
                    onClick={() => {
                      setNoteText("");
                      setNoteDialog(true);
                    }}
                    className="text-[10px] font-bold text-[hsl(var(--brand-pink))] hover:underline"
                  >
                    + Add Note
                  </button>
                </div>
                {selectedDayNotes.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">No notes for this day.</p>
                ) : (
                  <div className="space-y-2">
                    {selectedDayNotes.map((n, i) => {
                      const globalIdx = notes.indexOf(n);
                      return (
                        <div
                          key={i}
                          className="flex items-start gap-2 p-3 rounded-xl bg-secondary text-sm"
                        >
                          <span className="flex-1 text-foreground">{n.text}</span>
                          <button
                            onClick={() => handleDeleteNote(globalIdx)}
                            className="text-muted-foreground hover:text-destructive transition-colors flex-shrink-0 mt-0.5"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Add Note Dialog */}
      <Dialog open={noteDialog} onOpenChange={setNoteDialog}>
        <DialogContent className="sm:max-w-md bg-card border-border">
          <DialogHeader>
            <DialogTitle className="font-black">
              Add Note — {selectedDay ? format(selectedDay, "MMM d, yyyy") : ""}
            </DialogTitle>
          </DialogHeader>
          <textarea
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            placeholder="Write a note..."
            className="w-full min-h-[100px] rounded-xl border border-border bg-background px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--brand-pink))] placeholder:text-muted-foreground resize-none"
          />
          <button
            onClick={handleAddNote}
            disabled={!noteText.trim()}
            className="w-full py-3 bg-[hsl(var(--brand-pink))] text-primary-foreground rounded-full font-bold text-sm hover:scale-[1.02] transition-transform active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
          >
            Save Note
          </button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
