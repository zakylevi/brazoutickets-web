import { useState, useEffect, useMemo, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft, Calendar, Clock, MapPin, Music, Ticket,
  Plus, Trash2, Upload, Save, Image as ImageIcon, ChevronDown, Eye, EyeOff,
} from "lucide-react";
import { format } from "date-fns";
import AddArtistModal from "@/components/AddArtistModal";
import SeatingMapBuilder, { type SeatingSection } from "@/components/SeatingMapBuilder";
import { toast } from "sonner";
import { uploadEventImage, fileToDataUrl } from "@/lib/uploadImage";
import { supabase } from "@/integrations/supabase/client";
import VenueAutocomplete, { PlaceResult } from "@/components/VenueAutocomplete";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar as CalendarUI } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  StoredEvent, EventArtist,
  createBlankEvent, getEventById, saveEvent,
} from "@/stores/eventStore";

const CATEGORIES = ["Party", "Comedy", "Concert", "Business", "Wellness", "Festival"];
const AGE_OPTIONS = ["Everyone", "18+", "21+"];

/* ------------------------------------------------------------------ */
/*  Inline-editable text                                               */
/* ------------------------------------------------------------------ */
const Editable = ({
  value, onChange, placeholder, className = "", multiline = false,
}: {
  value: string; onChange: (v: string) => void; placeholder: string;
  className?: string; multiline?: boolean;
}) => {
  if (multiline) {
    return (
      <textarea
        value={value} onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder} rows={5}
        className={`bg-transparent border-b-2 border-dashed border-border focus:border-primary outline-none transition-colors w-full resize-none ${className}`}
      />
    );
  }
  return (
    <input
      value={value} onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={`bg-transparent border-b-2 border-dashed border-border focus:border-primary outline-none transition-colors w-full ${className}`}
    />
  );
};

/* ------------------------------------------------------------------ */
/*  Time Picker                                                        */
/* ------------------------------------------------------------------ */
const TimePicker = ({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) => {
  const [hour, setHour] = useState(() => {
    if (!value) return "";
    const parts = value.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
    return parts ? parts[1] : "";
  });
  const [minute, setMinute] = useState(() => {
    if (!value) return "00";
    const parts = value.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
    return parts ? parts[2] : "00";
  });
  const [period, setPeriod] = useState<"AM" | "PM">(() => {
    if (!value) return "PM";
    const parts = value.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
    return (parts?.[3]?.toUpperCase() as "AM" | "PM") || "PM";
  });
  const [is24h, setIs24h] = useState(false);

  useEffect(() => {
    if (hour) {
      onChange(is24h ? `${hour.padStart(2, "0")}:${minute}` : `${hour}:${minute} ${period}`);
    }
  }, [hour, minute, period, is24h]);

  const hours = is24h
    ? Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"))
    : Array.from({ length: 12 }, (_, i) => String(i + 1));
  const minutes = ["00", "15", "30", "45"];

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-bold text-muted-foreground w-12">{label}</span>
      <Select value={hour} onValueChange={setHour}>
        <SelectTrigger className="w-16 h-9 text-xs font-black border-border">
          <SelectValue placeholder="HH" />
        </SelectTrigger>
        <SelectContent>{hours.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}</SelectContent>
      </Select>
      <span className="font-black text-foreground">:</span>
      <Select value={minute} onValueChange={setMinute}>
        <SelectTrigger className="w-16 h-9 text-xs font-black border-border">
          <SelectValue placeholder="MM" />
        </SelectTrigger>
        <SelectContent>{minutes.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
      </Select>
      {!is24h && (
        <Select value={period} onValueChange={(v) => setPeriod(v as "AM" | "PM")}>
          <SelectTrigger className="w-16 h-9 text-xs font-black border-border">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="AM">AM</SelectItem>
            <SelectItem value="PM">PM</SelectItem>
          </SelectContent>
        </Select>
      )}
      <button
        type="button"
        onClick={() => setIs24h(!is24h)}
        className="text-[10px] font-bold text-muted-foreground hover:text-primary transition-colors ml-1"
      >
        {is24h ? "12h" : "24h"}
      </button>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */
/** Parse a time string like "10:00 PM" or "22:00" into total minutes from midnight */
const parseTimeToMinutes = (time: string): number | null => {
  if (!time) return null;
  const match = time.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
  if (!match) return null;
  let h = parseInt(match[1], 10);
  const m = parseInt(match[2], 10);
  const period = match[3]?.toUpperCase();
  if (period === "PM" && h !== 12) h += 12;
  if (period === "AM" && h === 12) h = 0;
  return h * 60 + m;
};

const CreateEvent = () => {
  const { orgSlug, eventId } = useParams<{ orgSlug: string; eventId?: string }>();
  const navigate = useNavigate();

  const [event, setEvent] = useState<StoredEvent>(() => createBlankEvent(orgSlug || ""));
  const [loading, setLoading] = useState(!!eventId);

  const [eventDate, setEventDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const [dateChangesCount, setDateChangesCount] = useState(0);
  const [originalDate, setOriginalDate] = useState<string | null>(null);

  const [showArtistModal, setShowArtistModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [seatingSections, setSeatingSections] = useState<SeatingSection[]>([]);
  const [showEndTime] = useState(true); // End time is always required
  const flyerInputRef = useRef<HTMLInputElement>(null);

  // Validate end datetime is after start datetime
  const endTimeError = useMemo(() => {
    if (!showEndTime || !event.time) return false;
    const startMins = parseTimeToMinutes(event.time);
    const endMins = parseTimeToMinutes(event.doors);
    if (startMins === null || endMins === null) return false;
    // Same date or no end date set → compare times directly
    const sameDay = !endDate || (eventDate && endDate.getTime() === eventDate.getTime());
    if (sameDay && endMins <= startMins) return true;
    return false;
  }, [event.time, event.doors, eventDate, endDate, showEndTime]);

  // Load existing event from DB
  useEffect(() => {
    if (eventId) {
      getEventById(eventId).then(async (existing) => {
        if (existing) {
          setEvent(existing);
          if (existing.date && existing.month && existing.year) {
            const d = new Date(`${existing.month} ${existing.date}, ${existing.year}`);
            if (!isNaN(d.getTime())) setEventDate(d);
            setOriginalDate(`${existing.year}-${existing.month}-${existing.date}`);
          }
          if (existing.endDate && existing.endMonth && existing.endYear) {
            const d = new Date(`${existing.endMonth} ${existing.endDate}, ${existing.endYear}`);
            if (!isNaN(d.getTime())) setEndDate(d);
          }
          // End time is always required now — no toggle needed
          // Fetch date_changes_count from DB
          const { data } = await supabase.from("events").select("date_changes_count").eq("id", eventId).single();
          if (data) setDateChangesCount((data as any).date_changes_count || 0);

          // Load seating sections if seated event
          if (existing.eventType === "seated") {
            const { data: secData } = await supabase
              .from("seating_sections")
              .select("*")
              .eq("event_id", eventId)
              .order("sort_order");
            if (secData) {
              setSeatingSections(secData.map((s: any) => ({
                id: s.id,
                name: s.name,
                rowsCount: s.rows_count,
                seatsPerRow: s.seats_per_row,
                price: s.price,
                isGeneralAdmission: s.is_general_admission,
                sortOrder: s.sort_order,
              })));
            }
          }
        }
        setLoading(false);
      });
    }
  }, [eventId]);

  const MAX_FILE_SIZE = 8 * 1024 * 1024; // 8 MB

  const handleFlyerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_FILE_SIZE) {
      toast.error("File too large. Maximum size is 8 MB.");
      return;
    }
    // Show instant local preview
    const localUrl = await fileToDataUrl(file);
    set("flyer", localUrl);
    // Upload in background
    const url = await uploadEventImage(file, event.id, "flyer");
    if (url && url !== localUrl) set("flyer", url);
    toast.success("Flyer uploaded");
  };

  // Auto-save removed — saving is manual via Save Draft / Save Changes button

  const set = <K extends keyof StoredEvent>(key: K, value: StoredEvent[K]) =>
    setEvent((prev) => ({ ...prev, [key]: value }));

  const MAX_DATE_CHANGES = 3;

  const handleDateSelect = (date: Date | undefined) => {
    if (date && eventId && originalDate) {
      const newDateStr = `${date.getFullYear()}-${format(date, "MMM").toUpperCase()}-${date.getDate()}`;
      if (newDateStr !== originalDate && dateChangesCount >= MAX_DATE_CHANGES) {
        toast.error(`You can only change the event date ${MAX_DATE_CHANGES} times`);
        return;
      }
    }
    setEventDate(date);
    if (date) {
      set("date", String(date.getDate()));
      set("month", format(date, "MMM").toUpperCase());
      set("year", String(date.getFullYear()));
    }
  };

  const handleEndDateSelect = (date: Date | undefined) => {
    setEndDate(date);
    if (date) {
      set("endDate", String(date.getDate()));
      set("endMonth", format(date, "MMM").toUpperCase());
      set("endYear", String(date.getFullYear()));
    }
  };

  // Compute cheapest ticket price
  const cheapestPrice = useMemo(() => {
    const prices = event.tickets
      .map(t => parseFloat(t.price.replace(/[^\d.,]/g, "").replace(",", ".")))
      .filter(n => !isNaN(n) && n > 0);
    if (prices.length === 0) return "—";
    const min = Math.min(...prices);
    return `$${min.toFixed(2)}`;
  }, [event.tickets]);

  /* Lineup helpers */
  const addArtist = (artist: EventArtist) =>
    set("lineup", [...event.lineup, artist]);
  const updateArtist = (i: number, patch: Partial<EventArtist>) =>
    set("lineup", event.lineup.map((a, idx) => (idx === i ? { ...a, ...patch } : a)));
  const removeArtist = (i: number) =>
    set("lineup", event.lineup.filter((_, idx) => idx !== i));

  /* Actions */
  const handleSaveDraft = async () => {
    if (!event.title?.trim()) {
      toast.error("Please add an event name before saving");
      return;
    }
    if (!event.date || !event.month || !event.year) {
      toast.error("Please choose a date before saving");
      return;
    }
    if (!event.time) {
      toast.error("Please choose a start time before saving");
      return;
    }
    if (!event.doors) {
      toast.error("Please choose an end time before saving");
      return;
    }
    if (!event.category) {
      toast.error("Please choose an event category before saving");
      return;
    }
    if (endTimeError) {
      toast.error("End time must be after start time");
      return;
    }
    const statusToSave = event.status === "Live" ? "Live" : "Draft";
    set("status", statusToSave);
    setIsSaving(true);
    try {
      await saveEvent({ ...event, status: statusToSave });

      // Save seating sections if seated event
      if (event.eventType === "seated" && seatingSections.length > 0) {
        // Delete existing sections (cascade deletes seats)
        await supabase.from("seating_sections").delete().eq("event_id", event.id);
        // Insert new sections
        const sectionRows = seatingSections.map((s, i) => ({
          event_id: event.id,
          name: s.name,
          rows_count: s.rowsCount,
          seats_per_row: s.seatsPerRow,
          price: "0",
          is_general_admission: s.isGeneralAdmission,
          sort_order: i,
        }));
        const { data: insertedSections, error: secErr } = await supabase
          .from("seating_sections")
          .insert(sectionRows as any)
          .select();
        if (secErr) throw secErr;

        // Generate individual seats for non-GA sections
        if (insertedSections) {
          // Delete existing seats
          await supabase.from("seats").delete().eq("event_id", event.id);
          const seatRows: any[] = [];
          for (const sec of insertedSections) {
            const original = seatingSections.find(s => s.name === (sec as any).name);
            if (original?.isGeneralAdmission) continue;
            const rows = (sec as any).rows_count;
            const seatsPerRow = (sec as any).seats_per_row;
            for (let r = 0; r < rows; r++) {
              const rowLabel = String.fromCharCode(65 + r); // A, B, C...
              for (let s = 1; s <= seatsPerRow; s++) {
                seatRows.push({
                  section_id: (sec as any).id,
                  event_id: event.id,
                  row_label: rowLabel,
                  seat_number: s,
                  status: "available",
                });
              }
            }
          }
          if (seatRows.length > 0) {
            const { error: seatErr } = await supabase.from("seats").insert(seatRows as any);
            if (seatErr) throw seatErr;
          }
        }
      }

      // Track date change if date was modified
      if (eventId && originalDate) {
        const currentDateStr = `${event.year}-${event.month}-${event.date}`;
        if (currentDateStr !== originalDate) {
          const newCount = dateChangesCount + 1;
          await supabase.from("events").update({ date_changes_count: newCount } as any).eq("id", eventId);
          setDateChangesCount(newCount);
          setOriginalDate(currentDateStr);
        }
      }
      toast.success(statusToSave === "Live" ? "Changes saved" : "Draft Saved");
      navigate(`/dashboard/${orgSlug}/event/${event.id}`);
    } catch (err: any) {
      console.error("Save error:", err);
      toast.error(err?.message || String(err) || "Failed to save event");
    } finally {
      setIsSaving(false);
    }
  };

  const statusColor: Record<string, string> = {
    Draft: "bg-muted text-muted-foreground",
    Live: "bg-[hsl(var(--brand-lime))]/10 text-[hsl(var(--brand-lime))]",
    "Sold Out": "bg-primary/10 text-primary",
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <p className="text-muted-foreground font-bold">Loading event...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface text-foreground">
      {/* Top bar */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border">
        <div className="max-w-7xl mx-auto px-4 md:px-8 h-16 flex items-center justify-between">
          <button
            onClick={() => navigate(`/dashboard/${orgSlug}`)}
            className="inline-flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors text-sm font-bold"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </button>

          <div className="flex items-center gap-3">
            <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${statusColor[event.status]}`}>
              {event.status}
            </span>
            <button
              onClick={handleSaveDraft}
              disabled={isSaving}
              className="flex items-center gap-2 px-5 py-2.5 rounded-full border border-border text-sm font-bold hover:bg-secondary transition-colors disabled:opacity-60"
            >
              {isSaving
                ? <><div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" /> Saving...</>
                : <><Save className="w-4 h-4" />{event.status === "Live" ? "Save Changes" : "Save Draft"}</>
              }
            </button>
          </div>
        </div>
      </header>

      <main className="pt-24 pb-32">
        {/* Hero: Flyer + Key Info */}
        <section className="max-w-7xl mx-auto px-4 md:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
            {/* Event Flyer placeholder */}
            <div className="w-full max-w-[600px] mx-auto lg:mx-0">
              <div
                onClick={() => flyerInputRef.current?.click()}
                className="rounded-[2rem] overflow-hidden shadow-2xl border-2 border-dashed border-border bg-secondary flex items-center justify-center cursor-pointer hover:border-primary transition-colors group"
                style={{ aspectRatio: "1080 / 1350" }}
              >
                {event.flyer ? (
                  <div className="relative w-full h-full">
                    {/* Blurred background fill */}
                    <img src={event.flyer} alt="" className="absolute inset-0 w-full h-full object-cover scale-110 blur-2xl opacity-80" />
                    {/* Sharp foreground image */}
                    <img src={event.flyer} alt="Event flyer" className="relative w-full h-full object-contain z-10" />
                  </div>
                ) : (
                  <div className="text-center p-8">
                    <Upload className="w-12 h-12 text-muted-foreground mx-auto mb-4 group-hover:text-primary transition-colors" />
                    <p className="font-bold text-muted-foreground text-sm">Upload Event Flyer</p>
                    <p className="text-xs text-muted-foreground/60 mt-1">1080 × 1350 recommended</p>
                  </div>
                )}
              </div>
              <input
                ref={flyerInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFlyerUpload}
              />
            </div>

            {/* Key Info — editable */}
            <div className="flex flex-col justify-center py-4">
              {/* Category & Age selectors */}
              <div className="flex items-center gap-3 mb-4">
                <Select value={event.category} onValueChange={(v) => set("category", v)}>
                  <SelectTrigger className="w-40 h-8 rounded-full bg-[hsl(var(--brand-lime))]/10 border-none text-[10px] font-black uppercase tracking-widest">
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>

                <Select value={event.age} onValueChange={(v) => set("age", v)}>
                  <SelectTrigger className="w-24 h-8 rounded-full bg-secondary border-none text-[10px] font-black uppercase tracking-widest">
                    <SelectValue placeholder="Age" />
                  </SelectTrigger>
                  <SelectContent>
                    {AGE_OPTIONS.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                  </SelectContent>
                </Select>

                {/* Event type toggle */}
                <div className="flex rounded-full border border-border overflow-hidden h-8">
                  {([{ key: "general_admission", label: "Standing" }, { key: "seated", label: "Seating" }] as const).map(({ key, label }) => (
                    <button
                      key={key}
                      onClick={() => set("eventType", key as any)}
                      className={cn(
                        "px-4 text-[10px] font-black uppercase tracking-wider transition-colors",
                        event.eventType === key
                          ? "bg-primary text-primary-foreground"
                          : "bg-background text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <Editable
                value={event.title} onChange={(v) => set("title", v)}
                placeholder="Event Name"
                className="text-4xl md:text-5xl lg:text-6xl font-black tracking-tight leading-none mb-5"
              />

              <Editable
                value={event.shortDescription} onChange={(v) => set("shortDescription", v)}
                placeholder="Short description of your event..."
                className="text-muted-foreground text-lg font-medium leading-relaxed mb-8 max-w-lg"
                multiline
              />

              {/* Date / Time / Location */}
              <div className="space-y-4 mb-8">
                {/* Date picker */}
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-secondary flex items-center justify-center flex-shrink-0">
                    <Calendar className="w-5 h-5 text-primary" />
                  </div>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "justify-start text-left font-black h-10",
                          !eventDate && "text-muted-foreground"
                        )}
                      >
                        {eventDate ? format(eventDate, "dd MMM yyyy").toUpperCase() : "Pick a date"}
                        <ChevronDown className="ml-2 w-4 h-4 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <CalendarUI
                        mode="single"
                        selected={eventDate}
                        onSelect={handleDateSelect}
                        disabled={(date) => date < new Date()}
                        initialFocus
                        className={cn("p-3 pointer-events-auto")}
                      />
                    </PopoverContent>
                  </Popover>
                  {eventId && dateChangesCount > 0 && (
                    <p className="text-[10px] text-muted-foreground mt-1">
                      Date changed {dateChangesCount}/{MAX_DATE_CHANGES} times
                    </p>
                  )}
                </div>

                {/* Time pickers */}
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-secondary flex items-center justify-center flex-shrink-0">
                    <Clock className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1 space-y-2">
                    <TimePicker value={event.time} onChange={(v) => set("time", v)} label="Start" />
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <TimePicker value={event.doors} onChange={(v) => set("doors", v)} label="End" />
                        <Popover>
                          <PopoverTrigger asChild>
                            <button
                              type="button"
                              className={cn(
                                "h-9 px-3 rounded-lg border border-border text-xs font-bold flex items-center gap-1.5 transition-colors hover:bg-secondary",
                                !endDate && "text-muted-foreground"
                              )}
                            >
                              <Calendar className="w-3.5 h-3.5" />
                              {endDate ? format(endDate, "MMM d") : "End date"}
                            </button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <CalendarUI
                              mode="single"
                              selected={endDate}
                              onSelect={handleEndDateSelect}
                              disabled={(date) => eventDate ? date < eventDate : date < new Date()}
                              initialFocus
                              className={cn("p-3 pointer-events-auto")}
                            />
                          </PopoverContent>
                        </Popover>
                        {/* Toggle visibility of end time on public page */}
                        <button
                          type="button"
                          onClick={() => set("showEndTime", !event.showEndTime)}
                          title={event.showEndTime ? "End time visible on event page" : "End time hidden on event page"}
                          className={cn(
                            "h-9 w-9 rounded-lg border flex items-center justify-center transition-colors",
                            event.showEndTime
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-border bg-secondary text-muted-foreground hover:text-foreground"
                          )}
                        >
                          {event.showEndTime ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                      <p className="text-[10px] text-muted-foreground ml-14">
                        {event.showEndTime ? "End time visible on event page" : "End time hidden — used internally only"}
                      </p>
                      {endTimeError && (
                        <p className="text-xs font-bold text-destructive">End time must be after start time</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Venue & Address */}
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-secondary flex items-center justify-center flex-shrink-0">
                    <MapPin className="w-5 h-5 text-primary" />
                  </div>
                  <VenueAutocomplete
                    venue={event.venue}
                    address={event.address}
                    onSelect={(result: PlaceResult) => {
                      setEvent((prev) => ({
                        ...prev,
                        venue: result.venue,
                        address: result.address,
                        city: result.city,
                        locationState: result.state,
                        country: result.country,
                        postalCode: result.postalCode,
                        lat: result.lat,
                        lng: result.lng,
                        placeId: result.placeId,
                      }));
                    }}
                    onManualChange={(field, value) => {
                      if (field === "venue") {
                        setEvent((prev) => ({
                          ...prev,
                          venue: value,
                          address: "",
                          city: "",
                          locationState: "",
                          country: "",
                          postalCode: "",
                          lat: null,
                          lng: null,
                          placeId: "",
                        }));
                        return;
                      }

                      set(field, value);
                    }}
                  />
                </div>
              </div>

              {/* Starting at price — read-only */}
              <div className="flex items-center gap-3">
                <Ticket className="w-5 h-5 text-primary" />
                <span className="text-sm font-bold text-muted-foreground">Starting at</span>
                <span className="font-black text-primary text-lg">{cheapestPrice}</span>
              </div>
            </div>
          </div>
        </section>

        {/* About / Description */}
        <section className="max-w-7xl mx-auto px-4 md:px-8 py-20">
          <div className="max-w-3xl">
            <p className="text-primary font-bold tracking-wider text-xs uppercase mb-3">About This Event</p>
            <h2 className="text-3xl md:text-4xl font-black tracking-tight mb-8">Event Description</h2>
            <Editable
              value={event.description} onChange={(v) => set("description", v)}
              placeholder="Write a detailed description of your event. Tell people what to expect, what makes it special, the vibe, the experience..."
              className="text-muted-foreground text-base md:text-lg font-medium leading-relaxed"
              multiline
            />
          </div>
        </section>

        {/* Lineup */}
        <section className="py-20 bg-secondary">
          <div className="max-w-7xl mx-auto px-4 md:px-8">
            <div className="flex items-center gap-3 mb-3">
              <Music className="w-5 h-5 text-primary" />
              <p className="text-primary font-bold tracking-wider text-xs uppercase">Artists</p>
            </div>
            <h2 className="text-3xl md:text-4xl font-black tracking-tight mb-12">Lineup</h2>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-6">
              {event.lineup.map((artist, i) => (
                <div key={i} className="text-center relative group">
                  <div className="aspect-square rounded-[2rem] overflow-hidden mb-4 shadow-sm border-2 border-dashed border-border bg-background flex items-center justify-center">
                    {artist.image ? (
                      <img src={artist.image} alt={artist.name} className="w-full h-full object-cover" />
                    ) : (
                      <ImageIcon className="w-8 h-8 text-muted-foreground" />
                    )}
                  </div>
                  <Editable
                    value={artist.name} onChange={(v) => updateArtist(i, { name: v })}
                    placeholder="Artist Name"
                    className="font-black tracking-tight text-center text-sm"
                  />
                  <button
                    onClick={() => removeArtist(i)}
                    className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
              <button
                onClick={() => setShowArtistModal(true)}
                className="aspect-square rounded-[2rem] border-2 border-dashed border-border flex flex-col items-center justify-center gap-2 text-muted-foreground hover:text-primary hover:border-primary transition-colors"
              >
                <Plus className="w-8 h-8" />
                <span className="text-xs font-bold">Add Artist</span>
              </button>
            </div>
            <AddArtistModal open={showArtistModal} onOpenChange={setShowArtistModal} onAdd={addArtist} />
          </div>
        </section>

        {/* Gallery */}
        <section className="max-w-7xl mx-auto px-4 md:px-8 py-20">
          <div className="flex items-center gap-3 mb-3">
            <ImageIcon className="w-5 h-5 text-primary" />
            <p className="text-primary font-bold tracking-wider text-xs uppercase">Photos</p>
          </div>
          <h2 className="text-3xl md:text-4xl font-black tracking-tight mb-12">Gallery</h2>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {event.gallery.map((img, i) => (
              <div key={i} className="relative group aspect-square rounded-2xl overflow-hidden border border-border">
                <img src={img} alt={`Gallery ${i + 1}`} className="w-full h-full object-cover" />
                <button
                  onClick={() => set("gallery", event.gallery.filter((_, idx) => idx !== i))}
                  className="absolute top-2 right-2 w-7 h-7 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
            <label className="aspect-square rounded-2xl border-2 border-dashed border-border flex flex-col items-center justify-center gap-2 text-muted-foreground hover:text-primary hover:border-primary transition-colors cursor-pointer">
              <Plus className="w-8 h-8" />
              <span className="text-xs font-bold">Add Photo</span>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  // Instant local preview
                  const localUrl = await fileToDataUrl(file);
                  set("gallery", [...event.gallery, localUrl]);
                  // Upload in background
                  const url = await uploadEventImage(file, event.id, "gallery");
                  if (url && url !== localUrl) {
                    setEvent((prev) => {
                      const g = [...prev.gallery];
                      const idx = g.indexOf(localUrl);
                      if (idx >= 0) g[idx] = url;
                      return { ...prev, gallery: g };
                    });
                  }
                  toast.success("Photo added");
                  e.target.value = "";
                }}
              />
            </label>
          </div>
        </section>


        {/* Location */}
        <section className="max-w-7xl mx-auto px-4 md:px-8 py-20">
          <div className="flex items-center gap-3 mb-3">
            <MapPin className="w-5 h-5 text-primary" />
            <p className="text-primary font-bold tracking-wider text-xs uppercase">Venue</p>
          </div>
          <h2 className="text-3xl md:text-4xl font-black tracking-tight mb-8">Location</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
            <div>
              <h3 className="text-2xl font-black tracking-tight mb-2">
                {event.venue || "Venue Name"}
              </h3>
              <p className="text-muted-foreground font-medium mb-2">{event.address || "Address"}</p>
              {event.city && <p className="text-muted-foreground font-medium mb-6">{event.city}{event.locationState ? `, ${event.locationState}` : ""}{event.country ? ` — ${event.country}` : ""}</p>}
              {event.lat && event.lng && (
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${event.lat},${event.lng}${event.placeId ? `&query_place_id=${event.placeId}` : ""}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 bg-secondary text-foreground px-6 py-3 rounded-full font-bold text-sm hover:bg-primary hover:text-primary-foreground transition-all"
                >
                  <MapPin className="w-4 h-4" />
                  View on Maps
                </a>
              )}
            </div>
            <div className="aspect-video rounded-3xl overflow-hidden bg-secondary border border-border">
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
                    <p className="text-muted-foreground font-bold text-sm">Select a venue to see map preview</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};

export default CreateEvent;
