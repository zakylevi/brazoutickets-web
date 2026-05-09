import { useState, useEffect } from "react";
import { StoredEvent, getEventsByOrg } from "@/stores/eventStore";
import { useOrganizations } from "@/contexts/OrganizationContext";
import { PlusCircle, Send, ArrowLeft, Link2, X, Megaphone, Clock, Users, ChevronDown, Zap, Image as ImageIcon, MapPin, MousePointerClick } from "lucide-react";
import { format } from "date-fns";

interface DeliveryStats {
  sending: number;
  delivered: number;
  optOut: number;
  failed: number;
  clicks: number;
}

interface Campaign {
  id: string;
  name: string;
  message: string;
  audienceCount: number;
  sentAt: string;
  status: "sent" | "scheduled";
  stats?: DeliveryStats;
  trackingLink?: string;
}

interface Props {
  event?: StoredEvent | null;
  orgSlug: string;
}

const SMS_LIMIT = 10;
const SMS_PERIOD_DAYS = 30;
const MAX_CHARS = 140;

const STORAGE_KEY_CAMPAIGNS = "lovable_sms_campaigns";
const STORAGE_KEY_SENDS = "lovable_sms_sends";

const getCampaigns = (orgSlug: string): Campaign[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CAMPAIGNS);
    const all: (Campaign & { orgSlug: string })[] = raw ? JSON.parse(raw) : [];
    return all.filter((c) => c.orgSlug === orgSlug);
  } catch {
    return [];
  }
};

const saveCampaign = (orgSlug: string, campaign: Campaign) => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CAMPAIGNS);
    const all: (Campaign & { orgSlug: string })[] = raw ? JSON.parse(raw) : [];
    all.push({ ...campaign, orgSlug });
    localStorage.setItem(STORAGE_KEY_CAMPAIGNS, JSON.stringify(all));
  } catch {}
};

const getSendsInPeriod = (orgSlug: string): number => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_SENDS);
    const all: { orgSlug: string; sentAt: string }[] = raw ? JSON.parse(raw) : [];
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - SMS_PERIOD_DAYS);
    return all.filter((s) => s.orgSlug === orgSlug && new Date(s.sentAt) > cutoff).length;
  } catch {
    return 0;
  }
};

const recordSend = (orgSlug: string) => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_SENDS);
    const all: { orgSlug: string; sentAt: string }[] = raw ? JSON.parse(raw) : [];
    all.push({ orgSlug, sentAt: new Date().toISOString() });
    localStorage.setItem(STORAGE_KEY_SENDS, JSON.stringify(all));
  } catch {}
};

// Mock attendees per event (with billing state)
const getMockAttendees = (eventTitle: string) => {
  const names = [
    { name: "Lucas Mendes", email: "lucas@email.com", state: "NY" },
    { name: "Sofia Almeida", email: "sofia@email.com", state: "CA" },
    { name: "James Carter", email: "james@email.com", state: "DC" },
    { name: "Ana Costa", email: "ana@email.com", state: "NY" },
    { name: "Liam Nguyen", email: "liam@email.com", state: "TX" },
    { name: "Maya Johnson", email: "maya@email.com", state: "DC" },
    { name: "Carlos Silva", email: "carlos@email.com", state: "CA" },
    { name: "Emma Wilson", email: "emma@email.com", state: "NY" },
  ];
  // Deterministic subset based on title length
  const start = eventTitle.length % 3;
  return names.slice(start, start + 4 + (eventTitle.length % 3));
};

const EventMarketingTab = ({ event, orgSlug }: Props) => {
  const { getOrgBySlug } = useOrganizations();
  const org = getOrgBySlug(orgSlug);
  const orgName = org?.name || "Org";

  const [view, setView] = useState<"list" | "create" | "sending">("list");
  const [campaigns, setCampaigns] = useState<Campaign[]>(() => getCampaigns(orgSlug));
  const sendsUsed = getSendsInPeriod(orgSlug);
  const smsRemaining = Math.max(0, SMS_LIMIT - sendsUsed);

  // Create campaign state
  const [campaignName, setCampaignName] = useState("");
  const [audienceMode, setAudienceMode] = useState<"all" | "by_event" | "by_location">("all");
  const [selectedEvents, setSelectedEvents] = useState<string[]>([]);
  const [selectedLocations, setSelectedLocations] = useState<string[]>([]);
  const [messageBody, setMessageBody] = useState("");
  const [selectedEventLink, setSelectedEventLink] = useState("");
  const [showEventDropdown, setShowEventDropdown] = useState(false);
  const [showLocationDropdown, setShowLocationDropdown] = useState(false);
  const [showLinkPicker, setShowLinkPicker] = useState(false);
  const [locationSearch, setLocationSearch] = useState("");
  const [sendingStats, setSendingStats] = useState<DeliveryStats>({ sending: 0, delivered: 0, optOut: 0, failed: 0, clicks: 0 });
  const [sendingCampaignName, setSendingCampaignName] = useState("");

  const [orgEvents, setOrgEvents] = useState<StoredEvent[]>([]);
  useEffect(() => {
    getEventsByOrg(orgSlug).then(setOrgEvents);
  }, [orgSlug]);
  const allEvents = orgEvents.length > 0 ? orgEvents : event ? [event] : [];

  // Generate tracking link for SMS campaigns
  const getTrackingLink = (eventId: string) => {
    const existingCampaigns = getCampaigns(orgSlug);
    const smsCount = existingCampaigns.filter((c) => c.trackingLink).length + 1;
    return `www.brazou.com/${eventId}SMS${smsCount}`;
  };

  const prefix = `${orgName}: `;
  const trackingLink = selectedEventLink ? getTrackingLink(selectedEventLink) : "";
  const eventLinkText = trackingLink ? ` ${trackingLink}` : "";
  const fullMessage = prefix + messageBody + eventLinkText;
  const charsUsed = fullMessage.length;
  const charsLeft = MAX_CHARS - charsUsed;

  // Calculate total audience
  const getTotalAudience = () => {
    if (audienceMode === "all") {
      const allAttendees = new Set<string>();
      allEvents.forEach((ev) => {
        getMockAttendees(ev.title).forEach((a) => allAttendees.add(a.email));
      });
      return allAttendees.size;
    }
    if (audienceMode === "by_event") {
      const attendees = new Set<string>();
      selectedEvents.forEach((evId) => {
        const ev = allEvents.find((e) => e.id === evId);
        if (ev) getMockAttendees(ev.title).forEach((a) => attendees.add(a.email));
      });
      return attendees.size;
    }
    if (audienceMode === "by_location") {
      const allAtts: { email: string; state: string }[] = [];
      const seen = new Set<string>();
      allEvents.forEach((ev) => {
        getMockAttendees(ev.title).forEach((a) => {
          if (!seen.has(a.email)) { seen.add(a.email); allAtts.push(a); }
        });
      });
      return allAtts.filter((a) => selectedLocations.includes(a.state)).length;
    }
    return 0;
  };

  const totalAudience = getTotalAudience();

  const attendeesForSelectedEvents = () => {
    const seen = new Set<string>();
    const result: { name: string; email: string }[] = [];
    selectedEvents.forEach((evId) => {
      const ev = allEvents.find((e) => e.id === evId);
      if (ev) {
        getMockAttendees(ev.title).forEach((a) => {
          if (!seen.has(a.email)) {
            seen.add(a.email);
            result.push(a);
          }
        });
      }
    });
    return result;
  };

  const handleSend = () => {
    if (smsRemaining <= 0 || !campaignName.trim() || charsUsed > MAX_CHARS || totalAudience === 0) return;

    const total = totalAudience;
    const name = campaignName;
    setSendingCampaignName(name);
    setSendingStats({ sending: total, delivered: 0, optOut: 0, failed: 0, clicks: 0 });
    setView("sending");

    // Simulate delivery progress
    let remaining = total;
    let delivered = 0;
    let optOut = 0;
    let failed = 0;
    let clicks = 0;

    const tick = () => {
      if (remaining <= 0) {
        // Simulate clicks as a % of delivered
        clicks = Math.floor(delivered * (0.15 + Math.random() * 0.25));
        const campaign: Campaign = {
          id: crypto.randomUUID(),
          name,
          message: fullMessage,
          audienceCount: total,
          sentAt: new Date().toISOString(),
          status: "sent",
          stats: { sending: 0, delivered, optOut, failed, clicks },
          trackingLink: trackingLink || undefined,
        };
        saveCampaign(orgSlug, campaign);
        recordSend(orgSlug);
        setCampaigns((prev) => [...prev, campaign]);
        setSendingStats({ sending: 0, delivered, optOut, failed, clicks });
        return;
      }

      // Process a batch
      const batch = Math.min(remaining, Math.max(1, Math.ceil(total * 0.08)));
      for (let i = 0; i < batch; i++) {
        const rand = Math.random();
        if (rand < 0.85) delivered++;
        else if (rand < 0.93) optOut++;
        else failed++;
      }
      remaining -= batch;
      setSendingStats({ sending: remaining, delivered, optOut, failed, clicks });
      setTimeout(tick, 200 + Math.random() * 300);
    };

    setTimeout(tick, 600);

    // Reset form state
    setCampaignName("");
    setMessageBody("");
    setAudienceMode("all");
    setSelectedEvents([]);
    setSelectedLocations([]);
    setSelectedEventLink("");
  };

  const resetAndGoCreate = () => {
    setCampaignName("");
    setMessageBody("");
    setAudienceMode("all");
    setSelectedEvents([]);
    setSelectedLocations([]);
    setSelectedEventLink("");
    setView("create");
  };

  // ── LIST VIEW ──
  if (view === "list") {
    return (
      <div className="space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-black tracking-tight text-foreground">Marketing</h2>
            <p className="text-sm text-muted-foreground">Manage SMS campaigns for this event</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 px-4 py-2 bg-secondary rounded-full">
              <Zap className="w-4 h-4 text-[hsl(var(--brand-pink))]" />
              <span className="text-xs font-black uppercase tracking-wider">
                <span className="text-[hsl(var(--brand-pink))]">{smsRemaining}</span>
                <span className="text-muted-foreground"> / {SMS_LIMIT} blasts left</span>
              </span>
            </div>
            <button
              onClick={resetAndGoCreate}
              disabled={smsRemaining <= 0}
              className="px-6 py-3 bg-[hsl(var(--brand-pink))] text-primary-foreground rounded-full font-black text-sm flex items-center gap-2 hover:scale-[1.02] transition-transform active:scale-95 shadow-xl shadow-[hsl(var(--brand-pink))]/20 disabled:opacity-50 disabled:pointer-events-none"
            >
              <PlusCircle className="w-4 h-4" />
              Create Campaign
            </button>
          </div>
        </div>

        {/* Campaign List */}
        {campaigns.length === 0 ? (
          <div className="bg-card rounded-3xl border border-border p-16 flex flex-col items-center justify-center text-center">
            <div className="w-20 h-20 rounded-full bg-secondary flex items-center justify-center mb-6">
              <Megaphone className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-xl font-black tracking-tight text-foreground mb-2">No campaigns yet</h3>
            <p className="text-muted-foreground text-sm max-w-sm mb-8">
              Create your first SMS campaign to reach your attendees directly on their phones.
            </p>
            <button
              onClick={resetAndGoCreate}
              disabled={smsRemaining <= 0}
              className="px-8 py-3 bg-[hsl(var(--brand-pink))] text-primary-foreground rounded-full font-black text-sm flex items-center gap-2 hover:scale-[1.02] transition-transform active:scale-95 disabled:opacity-50"
            >
              <PlusCircle className="w-4 h-4" />
              Create Campaign
            </button>
          </div>
        ) : (
          <div className="bg-card rounded-3xl border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="text-left px-6 py-3 font-bold text-[10px] uppercase tracking-[0.15em]">Campaign</th>
                  <th className="text-left px-6 py-3 font-bold text-[10px] uppercase tracking-[0.15em]">Tracking Link</th>
                  <th className="text-left px-6 py-3 font-bold text-[10px] uppercase tracking-[0.15em]">Audience</th>
                  <th className="text-left px-6 py-3 font-bold text-[10px] uppercase tracking-[0.15em]">Delivered</th>
                  <th className="text-left px-6 py-3 font-bold text-[10px] uppercase tracking-[0.15em]">Clicks</th>
                  <th className="text-left px-6 py-3 font-bold text-[10px] uppercase tracking-[0.15em]">Date</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map((c) => (
                  <tr key={c.id} className="border-b border-border last:border-0 hover:bg-secondary/50 transition-colors">
                    <td className="px-6 py-4">
                      <p className="font-bold text-foreground">{c.name}</p>
                      <p className="text-xs text-muted-foreground truncate max-w-xs">{c.message}</p>
                    </td>
                    <td className="px-6 py-4">
                      {c.trackingLink ? (
                        <span className="text-xs font-mono font-bold text-blue-500">{c.trackingLink}</span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4 font-medium">{c.audienceCount}</td>
                    <td className="px-6 py-4">
                      <span className="text-emerald-500 font-bold">{c.stats?.delivered ?? "—"}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1.5">
                        <MousePointerClick className="w-3.5 h-3.5 text-blue-500" />
                        <span className="text-blue-500 font-bold">{c.stats?.clicks ?? 0}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-muted-foreground">{format(new Date(c.sentAt), "MMM d, yyyy")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  }

  // ── SENDING VIEW ──
  if (view === "sending") {
    const totalProcessed = sendingStats.delivered + sendingStats.optOut + sendingStats.failed;
    const totalAll = totalProcessed + sendingStats.sending;
    const isComplete = sendingStats.sending === 0 && totalProcessed > 0;
    const progress = totalAll > 0 ? (totalProcessed / totalAll) * 100 : 0;

    const statCards = [
      { label: "Sending", value: sendingStats.sending, color: "text-amber-500", bg: "bg-amber-500/10" },
      { label: "Delivered", value: sendingStats.delivered, color: "text-emerald-500", bg: "bg-emerald-500/10" },
      { label: "Clicks", value: sendingStats.clicks, color: "text-blue-500", bg: "bg-blue-500/10" },
      { label: "Opt-Out", value: sendingStats.optOut, color: "text-orange-500", bg: "bg-orange-500/10" },
      { label: "Failed", value: sendingStats.failed, color: "text-destructive", bg: "bg-destructive/10" },
    ];

    return (
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-black tracking-tight text-foreground">
              {isComplete ? "Blast Complete" : "Sending Blast..."}
            </h2>
            <p className="text-sm text-muted-foreground">{sendingCampaignName}</p>
          </div>
          {isComplete && (
            <button
              onClick={() => setView("list")}
              className="px-6 py-3 bg-[hsl(var(--brand-pink))] text-primary-foreground rounded-full font-black text-sm flex items-center gap-2 hover:scale-[1.02] transition-transform active:scale-95"
            >
              Done
            </button>
          )}
        </div>

        {/* Progress bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-muted-foreground">
            <span>{totalProcessed} of {totalAll} processed</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <div className="w-full h-3 bg-secondary rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-[hsl(var(--brand-pink))] transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {statCards.map((stat) => (
            <div key={stat.label} className={`rounded-3xl border border-border p-6 ${stat.bg} transition-all`}>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground mb-2">{stat.label}</p>
              <p className={`text-3xl font-black tracking-tighter tabular-nums ${stat.color}`}>
                {stat.value}
              </p>
            </div>
          ))}
        </div>

        {/* Delivery rate summary (shown when complete) */}
        {isComplete && (
          <div className="bg-card rounded-3xl border border-border p-8">
            <h3 className="text-lg font-black tracking-tight text-foreground mb-4">Delivery Summary</h3>
            <div className="space-y-3">
              {[
                { label: "Delivery Rate", value: `${totalAll > 0 ? Math.round((sendingStats.delivered / totalAll) * 100) : 0}%`, color: "text-emerald-500" },
                { label: "Click Rate", value: `${sendingStats.delivered > 0 ? Math.round((sendingStats.clicks / sendingStats.delivered) * 100) : 0}%`, color: "text-blue-500" },
                { label: "Opt-Out Rate", value: `${totalAll > 0 ? Math.round((sendingStats.optOut / totalAll) * 100) : 0}%`, color: "text-orange-500" },
                { label: "Failure Rate", value: `${totalAll > 0 ? Math.round((sendingStats.failed / totalAll) * 100) : 0}%`, color: "text-destructive" },
              ].map((row) => (
                <div key={row.label} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                  <span className="text-sm font-bold text-muted-foreground">{row.label}</span>
                  <span className={`text-sm font-black ${row.color}`}>{row.value}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── CREATE CAMPAIGN VIEW ──
  return (
    <div className="space-y-8">
      {/* Back button */}
      <button
        onClick={() => setView("list")}
        className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors font-bold"
      >
        <ArrowLeft className="w-3.5 h-3.5" /> Back to Campaigns
      </button>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <span className="text-[hsl(var(--brand-pink))] font-bold uppercase tracking-[0.2em] text-[10px] block mb-2">Campaign Manager</span>
          <h2 className="text-4xl md:text-5xl font-black tracking-tighter uppercase text-foreground">SMS Blast</h2>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-secondary rounded-full">
          <Zap className="w-4 h-4 text-[hsl(var(--brand-pink))]" />
          <span className="text-xs font-black uppercase tracking-wider">
            <span className="text-[hsl(var(--brand-pink))]">{smsRemaining}</span>
            <span className="text-muted-foreground"> / {SMS_LIMIT} left</span>
          </span>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-8 lg:gap-12">
        {/* ── LEFT: Form ── */}
        <div className="col-span-12 lg:col-span-7 space-y-10">
          {/* Campaign Name */}
          <section className="space-y-3">
            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Campaign Name</h4>
            <input
              type="text"
              value={campaignName}
              onChange={(e) => setCampaignName(e.target.value)}
              placeholder="E.G. SUMMER FESTIVAL VIP BLAST"
              className="w-full bg-secondary border-none rounded-2xl p-5 text-lg font-black uppercase tracking-tighter focus:outline-none focus:ring-2 focus:ring-[hsl(var(--brand-pink))] placeholder:text-muted-foreground/30 text-foreground"
            />
          </section>

          {/* 01. SELECT AUDIENCE */}
          <section className="space-y-6">
            <div className="flex items-baseline gap-4">
              <span className="text-3xl font-black tracking-tighter text-foreground/20">01.</span>
              <h3 className="text-2xl font-black tracking-tighter uppercase text-foreground">Select Audience</h3>
            </div>

            {/* All Attendees Toggle */}
            <button
              onClick={() => setAudienceMode("all")}
              className={`w-full flex items-center justify-between p-6 rounded-3xl transition-all hover:scale-[0.99] active:scale-[0.97] ${
                audienceMode === "all"
                  ? "bg-[hsl(var(--brand-pink))] text-primary-foreground shadow-xl shadow-[hsl(var(--brand-pink))]/20"
                  : "bg-secondary text-foreground border border-border"
              }`}
            >
              <div className="flex items-center gap-5 text-left">
                <Users className="w-8 h-8" />
                <div>
                  <h4 className="text-lg font-black uppercase tracking-tight">All Attendees</h4>
                  <p className="text-[10px] uppercase tracking-widest opacity-70 font-bold">Total registered user base</p>
                </div>
              </div>
              {audienceMode === "all" && (
                <div className="w-6 h-6 rounded-full bg-primary-foreground/20 flex items-center justify-center">
                  <div className="w-3 h-3 rounded-full bg-primary-foreground" />
                </div>
              )}
            </button>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Filter By Event */}
              <div className="space-y-3">
                <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Filter by Event</h4>
                <div className="relative">
                  <button
                    onClick={() => { setShowEventDropdown(!showEventDropdown); setAudienceMode("by_event"); }}
                    className="w-full bg-secondary border-none rounded-2xl p-4 text-xs font-black uppercase tracking-widest text-left flex items-center justify-between focus:ring-2 focus:ring-[hsl(var(--brand-pink))]"
                  >
                    <span className={selectedEvents.length > 0 ? "text-foreground" : "text-muted-foreground"}>
                      {selectedEvents.length > 0 ? `${selectedEvents.length} event(s) selected` : "Select Specific Events"}
                    </span>
                    <ChevronDown className="w-4 h-4 text-muted-foreground" />
                  </button>
                  {showEventDropdown && (
                    <div className="absolute z-20 top-full mt-2 w-full bg-card border border-border rounded-2xl shadow-xl overflow-hidden">
                      {allEvents.map((ev) => (
                        <button
                          key={ev.id}
                          onClick={() => {
                            setSelectedEvents((prev) =>
                              prev.includes(ev.id) ? prev.filter((id) => id !== ev.id) : [...prev, ev.id]
                            );
                          }}
                          className="w-full text-left px-4 py-3 text-sm font-bold hover:bg-secondary transition-colors flex items-center gap-3"
                        >
                          <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                            selectedEvents.includes(ev.id)
                              ? "bg-[hsl(var(--brand-pink))] border-[hsl(var(--brand-pink))]"
                              : "border-border"
                          }`}>
                            {selectedEvents.includes(ev.id) && (
                              <svg className="w-3 h-3 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                            )}
                          </div>
                          {/* Flyer thumbnail */}
                          <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 bg-muted">
                            {ev.flyer ? (
                              <img src={ev.flyer} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <ImageIcon className="w-4 h-4 text-muted-foreground" />
                              </div>
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <span className="text-foreground block truncate">{ev.title || "Untitled Event"}</span>
                            {ev.date && ev.month && ev.year && (
                              <span className="text-[10px] text-muted-foreground font-medium">{ev.month} {ev.date}, {ev.year}</span>
                            )}
                          </div>
                        </button>
                      ))}
                      <div className="p-2 border-t border-border">
                        <button onClick={() => setShowEventDropdown(false)} className="w-full py-2 text-xs font-bold text-[hsl(var(--brand-pink))] uppercase tracking-widest">Done</button>
                      </div>
                    </div>
                  )}
                </div>
                {selectedEvents.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {selectedEvents.map((evId) => {
                      const ev = allEvents.find((e) => e.id === evId);
                      return (
                        <span key={evId} className="inline-flex items-center gap-1 px-3 py-1 bg-secondary rounded-full text-[9px] font-black uppercase tracking-tighter text-foreground">
                          {ev?.title || "Untitled"}
                          <button onClick={() => setSelectedEvents((prev) => prev.filter((id) => id !== evId))}>
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Filter by Location */}
              <div className="space-y-3">
                <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Filter by Location</h4>
                <div className="relative">
                  <button
                    onClick={() => {
                      setShowLocationDropdown(!showLocationDropdown);
                      if (audienceMode !== "by_location") {
                        setAudienceMode("by_location");
                      }
                    }}
                    className="w-full bg-secondary border-none rounded-2xl p-4 text-xs font-black uppercase tracking-widest text-left flex items-center justify-between"
                  >
                    <span className={selectedLocations.length > 0 ? "text-foreground" : "text-muted-foreground"}>
                      {selectedLocations.length > 0 ? `${selectedLocations.length} location(s) selected` : "Select Locations"}
                    </span>
                    <ChevronDown className="w-4 h-4 text-muted-foreground" />
                  </button>
                  {showLocationDropdown && (
                    <div className="absolute z-20 top-full mt-2 w-full bg-card border border-border rounded-2xl shadow-xl overflow-hidden">
                      <div className="p-3 border-b border-border">
                        <input
                          type="text"
                          placeholder="Search states..."
                          value={locationSearch}
                          onChange={(e) => setLocationSearch(e.target.value)}
                          className="w-full bg-secondary rounded-xl px-3 py-2 text-sm font-medium text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-[hsl(var(--brand-pink))]"
                        />
                      </div>
                      <div className="max-h-48 overflow-y-auto">
                        {(() => {
                          // Derive unique states from all attendees across org events
                          const stateSet = new Set<string>();
                          allEvents.forEach((ev) => {
                            getMockAttendees(ev.title).forEach((a) => stateSet.add(a.state));
                          });
                          const states = Array.from(stateSet).sort();
                          const filtered = locationSearch
                            ? states.filter((s) => s.toLowerCase().includes(locationSearch.toLowerCase()))
                            : states;
                          if (filtered.length === 0) {
                            return <p className="px-4 py-3 text-sm text-muted-foreground font-medium">No matching states</p>;
                          }
                          return filtered.map((st) => {
                            // Count attendees in this state
                            const seen = new Set<string>();
                            allEvents.forEach((ev) => {
                              getMockAttendees(ev.title).forEach((a) => {
                                if (a.state === st) seen.add(a.email);
                              });
                            });
                            return (
                              <button
                                key={st}
                                onClick={() => {
                                  setSelectedLocations((prev) =>
                                    prev.includes(st) ? prev.filter((l) => l !== st) : [...prev, st]
                                  );
                                }}
                                className="w-full text-left px-4 py-3 text-sm hover:bg-secondary transition-colors flex items-center gap-3"
                              >
                                <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                                  selectedLocations.includes(st)
                                    ? "bg-[hsl(var(--brand-pink))] border-[hsl(var(--brand-pink))]"
                                    : "border-border"
                                }`}>
                                  {selectedLocations.includes(st) && (
                                    <svg className="w-3 h-3 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                                  )}
                                </div>
                                <MapPin className="w-3.5 h-3.5 text-brand-pink flex-shrink-0" />
                                <span className="font-bold text-foreground">{st}</span>
                                <span className="text-[10px] text-muted-foreground ml-auto">{seen.size} attendee{seen.size !== 1 ? "s" : ""}</span>
                              </button>
                            );
                          });
                        })()}
                      </div>
                      <div className="p-2 border-t border-border">
                        <button onClick={() => setShowLocationDropdown(false)} className="w-full py-2 text-xs font-bold text-[hsl(var(--brand-pink))] uppercase tracking-widest">Done</button>
                      </div>
                    </div>
                  )}
                </div>
                {selectedLocations.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {selectedLocations.map((loc) => (
                      <span key={loc} className="inline-flex items-center gap-1 px-3 py-1 bg-secondary rounded-full text-[9px] font-black uppercase tracking-tighter text-foreground">
                        <MapPin className="w-3 h-3" />
                        {loc}
                        <button onClick={() => setSelectedLocations((prev) => prev.filter((l) => l !== loc))}>
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* 02. COMPOSE MESSAGE */}
          <section className="space-y-6">
            <div className="flex items-baseline justify-between">
              <div className="flex items-baseline gap-4">
                <span className="text-3xl font-black tracking-tighter text-foreground/20">02.</span>
                <h3 className="text-2xl font-black tracking-tighter uppercase text-foreground">Compose Message</h3>
              </div>
              <span className={`text-[10px] font-black uppercase tracking-widest ${charsLeft < 0 ? "text-destructive" : "text-muted-foreground"}`}>
                {charsUsed} / {MAX_CHARS} Characters
              </span>
            </div>

            <div className="space-y-4">
              {/* Prefix indicator */}
              <div className="flex items-center gap-2 px-4 py-2 bg-secondary rounded-full w-fit">
                <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Prefix:</span>
                <span className="text-xs font-bold text-foreground">{prefix}</span>
              </div>

              <textarea
                value={messageBody}
                onChange={(e) => {
                  const newBody = e.target.value;
                  const newFull = prefix + newBody + eventLinkText;
                  if (newFull.length <= MAX_CHARS || newBody.length < messageBody.length) {
                    setMessageBody(newBody);
                  }
                }}
                placeholder="Type your SMS message here..."
                rows={5}
                className="w-full bg-secondary border-none rounded-2xl p-5 text-base font-medium focus:outline-none focus:ring-2 focus:ring-[hsl(var(--brand-pink))] placeholder:text-muted-foreground/30 text-foreground resize-none"
              />

              {/* Event link button */}
              <div className="relative">
                <button
                  onClick={() => setShowLinkPicker(!showLinkPicker)}
                  className={`px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-colors flex items-center gap-2 ${
                    selectedEventLink
                      ? "bg-[hsl(var(--brand-pink))]/10 text-[hsl(var(--brand-pink))]"
                      : "bg-secondary text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Link2 className="w-3.5 h-3.5" />
                  {selectedEventLink ? "Event Link Added" : "Add Event Link"}
                </button>
                {showLinkPicker && (
                  <div className="absolute z-20 top-full mt-2 w-72 bg-card border border-border rounded-2xl shadow-xl overflow-hidden">
                    <button
                      onClick={() => { setSelectedEventLink(""); setShowLinkPicker(false); }}
                      className="w-full text-left px-4 py-3 text-sm font-bold hover:bg-secondary transition-colors text-muted-foreground"
                    >
                      No link
                    </button>
                    {allEvents.filter((ev) => ev.status === "Live").map((ev) => (
                      <button
                        key={ev.id}
                        onClick={() => { setSelectedEventLink(ev.id); setShowLinkPicker(false); }}
                        className={`w-full text-left px-4 py-3 text-sm font-bold hover:bg-secondary transition-colors flex items-center gap-3 ${
                          selectedEventLink === ev.id ? "text-[hsl(var(--brand-pink))]" : "text-foreground"
                        }`}
                      >
                        <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 bg-muted">
                          {ev.flyer ? (
                            <img src={ev.flyer} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <ImageIcon className="w-4 h-4 text-muted-foreground" />
                            </div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <span className="block truncate">{ev.title || "Untitled Event"}</span>
                          {ev.date && ev.month && ev.year && (
                            <span className="text-[10px] text-muted-foreground font-medium">{ev.month} {ev.date}, {ev.year}</span>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Character bar */}
              <div className="w-full h-1.5 bg-secondary rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    charsLeft < 0 ? "bg-destructive" : charsLeft < 20 ? "bg-amber-500" : "bg-[hsl(var(--brand-pink))]"
                  }`}
                  style={{ width: `${Math.min(100, (charsUsed / MAX_CHARS) * 100)}%` }}
                />
              </div>
            </div>
          </section>

          {/* SEND BUTTON */}
          <div className="pt-4">
            <button
              onClick={handleSend}
              disabled={!campaignName.trim() || charsUsed > MAX_CHARS || totalAudience === 0 || smsRemaining <= 0 || messageBody.trim().length === 0}
              className="w-full h-16 bg-[hsl(var(--brand-pink))] text-primary-foreground rounded-full flex items-center justify-center gap-4 hover:scale-[0.98] transition-transform shadow-xl shadow-[hsl(var(--brand-pink))]/20 disabled:opacity-50 disabled:pointer-events-none active:scale-95"
            >
              <span className="text-xl font-black uppercase tracking-tighter">Send Blast Now</span>
              <Send className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ── RIGHT: Preview ── */}
        <div className="col-span-12 lg:col-span-5">
          <div className="sticky top-28 space-y-8">
            <div className="flex items-baseline gap-4">
              <span className="text-3xl font-black tracking-tighter text-foreground/20">03.</span>
              <h3 className="text-2xl font-black tracking-tighter uppercase text-foreground">Preview</h3>
            </div>

            {/* Phone Mockup */}
            <div className="relative mx-auto w-full max-w-[320px] h-[640px] bg-[#1a1a1a] rounded-[52px] border-[10px] border-[#1a1a1a] shadow-[0_40px_80px_-20px_rgba(0,0,0,0.4)] overflow-hidden">
              <div className="w-full h-full bg-black relative p-4 flex flex-col pt-4">
                {/* Status Bar */}
                <div className="flex justify-between items-center px-4 mb-6">
                  <span className="text-white text-xs font-semibold">
                    {format(new Date(), "h:mm")}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <div className="flex gap-0.5">
                      <div className="w-1 h-2 bg-white rounded-sm" />
                      <div className="w-1 h-2.5 bg-white rounded-sm" />
                      <div className="w-1 h-3 bg-white rounded-sm" />
                      <div className="w-1 h-3.5 bg-white rounded-sm" />
                    </div>
                    <div className="w-4 h-2.5 border border-white rounded-sm ml-1">
                      <div className="w-3 h-1.5 bg-white rounded-sm m-px" />
                    </div>
                  </div>
                </div>

                {/* SMS Header */}
                <div className="flex items-center mb-4 relative px-2">
                  <div className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center">
                    <div className="w-14 h-14 bg-[#8e8e93] rounded-full flex items-center justify-center mb-1">
                      <Users className="w-7 h-7 text-white" />
                    </div>
                    <span className="text-white text-[10px] font-medium">{totalAudience} recipients</span>
                  </div>
                </div>

                {/* Chat Content */}
                <div className="flex-1 mt-12 px-2 overflow-y-auto">
                  <div className="text-center mb-4">
                    <span className="text-[10px] text-gray-500 font-bold uppercase tracking-tighter">
                      Today <span className="normal-case">{format(new Date(), "h:mm a")}</span>
                    </span>
                  </div>

                  {/* Message Bubble */}
                  {(messageBody || selectedEventLink) && (
                    <div className="flex justify-start mb-1">
                      <div className="bg-[#262629] text-white px-4 py-3 rounded-[20px] rounded-bl-md max-w-[85%]">
                        <p className="text-[14px] leading-snug font-medium break-words">
                          <span className="font-bold">{prefix}</span>
                          {messageBody}
                          {eventLinkText && (
                            <span className="text-blue-400 underline">{eventLinkText}</span>
                          )}
                        </p>
                      </div>
                    </div>
                  )}

                  {!messageBody && !selectedEventLink && (
                    <div className="flex justify-start mb-1">
                      <div className="bg-[#262629] text-white px-4 py-3 rounded-[20px] rounded-bl-md max-w-[85%]">
                        <p className="text-[14px] leading-snug font-medium text-gray-500">
                          <span className="font-bold text-gray-400">{prefix}</span>
                          Your message will appear here...
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Input Simulation */}
                <div className="mt-auto pb-4">
                  <div className="flex items-center gap-3 px-2 mb-2">
                    <div className="flex-1 h-8 bg-[#1c1c1e] border border-gray-800 rounded-full flex items-center px-4">
                      <span className="text-gray-500 text-xs">iMessage</span>
                    </div>
                  </div>
                </div>

                {/* Home Indicator */}
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-28 h-1 bg-white/20 rounded-full" />
              </div>
            </div>

            {/* Reach Card */}
            <div className="bg-[hsl(var(--brand-pink))]/10 p-6 rounded-3xl flex items-center justify-between border border-[hsl(var(--brand-pink))]/20">
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-[hsl(var(--brand-pink))] block mb-1">
                  Total Attendees Selected
                </span>
                <h4 className="text-3xl font-black tracking-tighter text-foreground uppercase">
                  {totalAudience.toLocaleString()} {totalAudience === 1 ? "Guest" : "Guests"}
                </h4>
              </div>
              <div className="w-14 h-14 bg-[hsl(var(--brand-pink))]/20 rounded-full flex items-center justify-center">
                <Zap className="w-6 h-6 text-[hsl(var(--brand-pink))]" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EventMarketingTab;
