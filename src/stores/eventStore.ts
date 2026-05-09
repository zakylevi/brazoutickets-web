import { supabase } from "@/integrations/supabase/client";

export type EventStatus = "Draft" | "Live" | "Sold Out";

export interface EventTicketTier {
  name: string;
  price: string;
  perks: string[];
  available: boolean;
}

export interface EventArtist {
  name: string;
  image: string;
  instagram?: string;
  spotify?: string;
}

export type EventType = "general_admission" | "seated";

export interface StoredEvent {
  id: string;
  title: string;
  shortDescription: string;
  description: string;
  flyer: string;
  date: string;
  month: string;
  year: string;
  time: string;
  doors: string;
  endDate: string;
  endMonth: string;
  endYear: string;
  venue: string;
  address: string;
  city: string;
  locationState: string;
  country: string;
  postalCode: string;
  lat: number | null;
  lng: number | null;
  placeId: string;
  category: string;
  age: string;
  price: string;
  status: EventStatus;
  orgSlug: string;
  createdAt: string;
  lineup: EventArtist[];
  tickets: EventTicketTier[];
  gallery: string[];
  salesDisabled?: boolean;
  showEndTime?: boolean;
  eventType: EventType;
}

/* ── Mapping helpers ── */

const statusToDb: Record<EventStatus, string> = {
  Draft: "draft",
  Live: "live",
  "Sold Out": "sold_out",
};

const statusFromDb: Record<string, EventStatus> = {
  draft: "Draft",
  live: "Live",
  sold_out: "Sold Out",
  cancelled: "Draft",
};

const monthMap: Record<string, number> = {
  JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, JUN: 5,
  JUL: 6, AUG: 7, SEP: 8, OCT: 9, NOV: 10, DEC: 11,
};

const monthNames = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

/** Build an ISO date string from separate date/month/year fields */
const buildIsoDate = (date: string, month: string, year: string): string | null => {
  const m = monthMap[month?.toUpperCase()];
  if (m === undefined || !date || !year) return null;
  const d = new Date(Number(year), m, Number(date));
  return isNaN(d.getTime()) ? null : d.toISOString().split("T")[0];
};

/** Parse an ISO date string into separate date/month/year fields */
const parseIsoDate = (iso: string | null): { date: string; month: string; year: string } => {
  if (!iso) return { date: "", month: "", year: "" };
  const d = new Date(iso + "T00:00:00");
  if (isNaN(d.getTime())) return { date: "", month: "", year: "" };
  return {
    date: String(d.getDate()),
    month: monthNames[d.getMonth()],
    year: String(d.getFullYear()),
  };
};

// Cache for org slug → org id mapping
const orgIdCache: Record<string, string> = {};

const getOrgIdBySlug = async (slug: string): Promise<string | null> => {
  if (orgIdCache[slug]) return orgIdCache[slug];
  const { data } = await supabase
    .from("organizations")
    .select("id")
    .eq("slug", slug)
    .single();
  if (data) orgIdCache[slug] = data.id;
  return data?.id ?? null;
};

// Cache for org id → slug mapping
const orgSlugCache: Record<string, string> = {};

const getOrgSlugById = async (id: string): Promise<string> => {
  if (orgSlugCache[id]) return orgSlugCache[id];
  const { data } = await supabase
    .from("organizations")
    .select("slug")
    .eq("id", id)
    .single();
  const slug = data?.slug ?? "";
  if (slug) orgSlugCache[id] = slug;
  return slug;
};

const ensureAuthenticatedSession = async () => {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  if (!data.session?.user) {
    throw new Error("Your session expired. Please log in again and try saving.");
  }
  return data.session;
};

const dbRowToStoredEvent = async (row: any): Promise<StoredEvent> => {
  const startDate = parseIsoDate(row.date);
  const endDateParsed = parseIsoDate(row.end_date);
  const orgSlug = await getOrgSlugById(row.organization_id);

  return {
    id: row.id,
    title: row.title || "",
    shortDescription: row.short_description || "",
    description: row.description || "",
    flyer: row.flyer_url || "",
    ...startDate,
    time: row.time || "",
    doors: row.end_time || row.doors || "",
    endDate: endDateParsed.date,
    endMonth: endDateParsed.month,
    endYear: endDateParsed.year,
    venue: row.venue || "",
    address: row.address || "",
    city: row.city || "",
    locationState: row.location_state || "",
    country: row.country || "",
    postalCode: row.postal_code || "",
    lat: row.lat ?? null,
    lng: row.lng ?? null,
    placeId: row.place_id || "",
    category: row.category || "",
    age: row.age_restriction || "18+",
    price: row.price || "",
    status: statusFromDb[row.status] || "Draft",
    orgSlug,
    createdAt: row.created_at,
    lineup: (row.lineup as EventArtist[]) || [],
    tickets: (row.tickets as EventTicketTier[]) || [],
    gallery: (row.gallery as string[]) || [],
    salesDisabled: !!row.sales_disabled,
    showEndTime: row.show_end_time !== false,
    eventType: (row.event_type as EventType) || "general_admission",
  };
};

const storedEventToDbRow = async (event: StoredEvent) => {
  const orgId = await getOrgIdBySlug(event.orgSlug);
  if (!orgId) throw new Error(`Organization not found for slug: ${event.orgSlug}`);

  return {
    id: event.id,
    title: event.title,
    short_description: event.shortDescription,
    description: event.description,
    flyer_url: event.flyer || null,
    date: buildIsoDate(event.date, event.month, event.year),
    time: event.time || null,
    doors: event.doors || null,
    end_time: event.doors || null,
    end_date: buildIsoDate(event.endDate, event.endMonth, event.endYear) || buildIsoDate(event.date, event.month, event.year),
    venue: event.venue,
    address: event.address,
    city: event.city,
    location_state: event.locationState || "",
    country: event.country || "",
    postal_code: event.postalCode || "",
    lat: event.lat ?? null,
    lng: event.lng ?? null,
    place_id: event.placeId || "",
    category: event.category,
    age_restriction: event.age,
    price: event.price,
    status: statusToDb[event.status] || "draft",
    organization_id: orgId,
    lineup: event.lineup as any,
    tickets: event.tickets as any,
    gallery: event.gallery as any,
    show_end_time: event.showEndTime !== false,
    event_type: event.eventType || "general_admission",
  };
};

/* ── Public API (async) ── */

export const getEventsByOrgId = async (orgId: string): Promise<StoredEvent[]> => {
  const { data, error } = await supabase
    .from("events")
    .select("*")
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false });

  if (error || !data) return [];
  return Promise.all(data.map(dbRowToStoredEvent));
};

export const getEventsByOrg = async (orgSlug: string): Promise<StoredEvent[]> => {
  const orgId = await getOrgIdBySlug(orgSlug);
  if (!orgId) return [];
  return getEventsByOrgId(orgId);
};

export const getEventById = async (id: string): Promise<StoredEvent | undefined> => {
  const { data, error } = await supabase
    .from("events")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !data) return undefined;
  return dbRowToStoredEvent(data);
};

export const saveEvent = async (event: StoredEvent): Promise<void> => {
  const row = await storedEventToDbRow(event);
  console.log("[saveEvent] Saving row:", JSON.stringify({ id: row.id, status: row.status, title: row.title }));
  await ensureAuthenticatedSession();

  // Check if event already exists in the database
  const { data: existing } = await supabase
    .from("events")
    .select("id")
    .eq("id", row.id)
    .maybeSingle();

  let error: any;
  let data: any;

  if (existing) {
    // UPDATE path
    const { id, ...updateFields } = row;
    const result = await supabase
      .from("events")
      .update(updateFields as any)
      .eq("id", id)
      .select();
    error = result.error;
    data = result.data;
  } else {
    // INSERT path
    const result = await supabase
      .from("events")
      .insert([row] as any)
      .select();
    error = result.error;
    data = result.data;
  }

  if (error) {
    console.error("[saveEvent] Failed to save event:", error);
    throw error;
  }
  console.log("[saveEvent] Save successful:", data);
};

export const deleteEvent = async (eventId: string): Promise<void> => {
  await ensureAuthenticatedSession();
  await Promise.all([
    supabase.from("ticket_types").delete().eq("event_id", eventId),
    supabase.from("comp_tickets").delete().eq("event_id", eventId),
    supabase.from("promo_codes").delete().eq("event_id", eventId),
  ]);
  const { error } = await supabase.from("events").delete().eq("id", eventId);
  if (error) throw error;
};

export const createBlankEvent = (orgSlug: string): StoredEvent => ({
  id: crypto.randomUUID(),
  title: "",
  shortDescription: "",
  description: "",
  flyer: "",
  date: "",
  month: "",
  year: "",
  time: "",
  doors: "",
  endDate: "",
  endMonth: "",
  endYear: "",
  venue: "",
  address: "",
  city: "",
  locationState: "",
  country: "",
  postalCode: "",
  lat: null,
  lng: null,
  placeId: "",
  category: "",
  age: "18+",
  price: "",
  status: "Draft",
  orgSlug,
  createdAt: new Date().toISOString(),
  lineup: [],
  tickets: [
    { name: "Standard", price: "", perks: ["General admission"], available: true },
  ],
  gallery: [],
  showEndTime: true,
  eventType: "general_admission",
});

