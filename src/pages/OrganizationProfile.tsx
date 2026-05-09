import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, MapPin, Instagram, Globe, ExternalLink, Link as LinkIcon, Calendar, Clock, Image as ImageIcon } from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const ORG_TYPE_LABELS: Record<string, string> = {
  venue: "Venue",
  event_organizer: "Event Organizer",
  person: "Person",
  community: "Community",
};

const SOCIAL_CONFIG = [
  { key: "instagram" as const, label: "Instagram", icon: <Instagram className="w-5 h-5" />, prefix: "" },
  { key: "tiktok" as const, label: "TikTok", icon: <span className="text-base font-black">T</span>, prefix: "" },
  { key: "x" as const, label: "X", icon: <span className="text-base font-black">𝕏</span>, prefix: "" },
  { key: "youtube" as const, label: "YouTube", icon: <span className="text-base font-black">▶</span>, prefix: "" },
  { key: "website" as const, label: "Website", icon: <Globe className="w-5 h-5" />, prefix: "" },
];

const OrganizationProfile = () => {
  const { orgSlug } = useParams<{ orgSlug: string }>();
  const { session } = useAuth();
  const [org, setOrg] = useState<any>(null);
  const [orgLoading, setOrgLoading] = useState(true);
  const [events, setEvents] = useState<any[]>([]);

  useEffect(() => {
    if (!orgSlug) return;
    const loadOrg = async () => {
      setOrgLoading(true);
      const { data } = await supabase
        .from("organizations")
        .select("*")
        .eq("slug", orgSlug)
        .single();
      if (data) {
        setOrg({
          id: data.id,
          slug: data.slug,
          name: data.name,
          avatarUrl: data.avatar_url || undefined,
          type: data.type,
          region: data.region || "",
          country: data.country || "",
          state: data.state || "",
          socials: (data.socials as any) || {},
          links: (data.links as any) || [],
          createdAt: data.created_at,
        });
      }
      setOrgLoading(false);
    };
    loadOrg();
  }, [orgSlug]);
  const [followerCount, setFollowerCount] = useState(0);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);

  useEffect(() => {
    if (!org) return;
    const loadEvents = async () => {
      const { data } = await supabase
        .from("events")
        .select("id, title, flyer_url, date, end_date, time, venue, city, category, price, status")
        .eq("organization_id", org.id)
        .eq("status", "live")
        .order("date", { ascending: true });
      if (data) {
        const today = new Date().toISOString().split("T")[0];
        setEvents(data.filter(e => {
          const endStr = e.end_date || e.date;
          return !endStr || endStr >= today;
        }));
      }
    };
    loadEvents();
  }, [org]);

  // Load follower count + follow status
  useEffect(() => {
    if (!org) return;
    const loadFollowers = async () => {
      const { count } = await supabase
        .from("organization_followers")
        .select("*", { count: "exact", head: true })
        .eq("organization_id", org.id);
      setFollowerCount(count || 0);

      if (session?.user?.id) {
        const { data } = await supabase
          .from("organization_followers")
          .select("id")
          .eq("organization_id", org.id)
          .eq("user_id", session.user.id)
          .maybeSingle();
        setIsFollowing(!!data);
      }
    };
    loadFollowers();
  }, [org, session]);

  const handleFollow = async () => {
    if (!session?.user?.id) {
      toast.error("Sign in to follow this organization");
      return;
    }
    if (!org) return;
    setFollowLoading(true);
    if (isFollowing) {
      await supabase
        .from("organization_followers")
        .delete()
        .eq("organization_id", org.id)
        .eq("user_id", session.user.id);
      setIsFollowing(false);
      setFollowerCount((c) => Math.max(0, c - 1));
    } else {
      await supabase
        .from("organization_followers")
        .insert({ organization_id: org.id, user_id: session.user.id });
      setIsFollowing(true);
      setFollowerCount((c) => c + 1);
    }
    setFollowLoading(false);
  };

  if (orgLoading) {
    return (
      <main className="pt-20 flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-4 border-brand-pink border-t-transparent rounded-full animate-spin" />
      </main>
    );
  }

  if (!org) {
    return (
      <main className="pt-20 flex flex-col items-center justify-center min-h-[60vh] px-4">
          <p className="text-4xl font-black mb-4">😢</p>
          <h1 className="text-2xl font-black tracking-tight text-on-background mb-2">Organization not found</h1>
          <p className="text-muted-foreground font-medium mb-6">This organization doesn't exist or has been removed.</p>
          <Link to="/" className="bg-brand-pink text-primary-foreground px-8 py-3 rounded-full font-bold text-sm hover:scale-105 transition-all">
            Go Home
          </Link>
      </main>
    );
  }

  const activeSocials = SOCIAL_CONFIG.filter((s) => org.socials[s.key]);
  const location = [org.state, org.country, org.region].filter(Boolean).join(", ");

  return (
    <main className="pt-20 pb-32">
        {/* Back */}
        <div className="max-w-2xl mx-auto px-4 pt-6 pb-4">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-muted-foreground hover:text-brand-pink transition-colors text-sm font-bold"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </Link>
        </div>

        {/* Linktree-style Profile */}
        <div className="max-w-2xl mx-auto px-4">
          <div className="flex flex-col items-center text-center mb-10">
            {/* Avatar */}
            <div className="w-28 h-28 rounded-full overflow-hidden border-4 border-border shadow-xl mb-5 bg-secondary">
              {org.avatarUrl ? (
                <img src={org.avatarUrl} alt={org.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-3xl font-black text-muted-foreground">
                  {org.name[0]}
                </div>
              )}
            </div>

            {/* Name + Type */}
            <h1 className="text-3xl md:text-4xl font-black tracking-tight text-on-background mb-2 text-balance">
              {org.name}
            </h1>
            <span className="inline-flex items-center gap-1.5 bg-secondary text-foreground px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest mb-3">
              {ORG_TYPE_LABELS[org.type]}
            </span>

            {/* Location */}
            {location && (
              <div className="flex items-center gap-2 text-muted-foreground text-sm font-medium">
                <MapPin className="w-4 h-4 text-brand-pink" />
                {location}
              </div>
            )}

            {/* Follower count + Follow button */}
            <div className="flex items-center gap-4 mt-4">
              <span className="text-sm font-bold text-muted-foreground">
                <span className="text-foreground tabular-nums">{followerCount}</span> {followerCount === 1 ? "follower" : "followers"}
              </span>
              <button
                onClick={handleFollow}
                disabled={followLoading}
                className={`px-5 py-2 rounded-full text-xs font-black uppercase tracking-widest transition-all ${
                  isFollowing
                    ? "bg-secondary text-foreground border border-border hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30"
                    : "bg-[hsl(var(--brand-pink))] text-primary-foreground hover:scale-105"
                }`}
              >
                {isFollowing ? "Following" : "Follow"}
              </button>
            </div>
          </div>

          {/* Social Media Icons Row */}
          {activeSocials.length > 0 && (
            <div className="flex items-center justify-center gap-3 mb-8">
              {activeSocials.map((s) => (
                <a
                  key={s.key}
                  href={org.socials[s.key]}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-12 h-12 rounded-full border border-border bg-secondary flex items-center justify-center text-muted-foreground hover:text-brand-pink hover:border-brand-pink transition-all"
                  title={s.label}
                >
                  {s.icon}
                </a>
              ))}
            </div>
          )}

          {/* Links (Linktree style) */}
          {org.links.length > 0 && (
            <div className="space-y-3 mb-12">
              {org.links.map((link, i) => (
                <a
                  key={i}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between w-full px-6 py-4 rounded-2xl border border-border bg-secondary hover:border-brand-pink hover:shadow-lg transition-all group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <LinkIcon className="w-5 h-5 text-muted-foreground group-hover:text-brand-pink transition-colors flex-shrink-0" />
                    <span className="font-bold text-on-background group-hover:text-brand-pink transition-colors truncate">
                      {link.label}
                    </span>
                  </div>
                  <ExternalLink className="w-4 h-4 text-muted-foreground group-hover:text-brand-pink transition-colors flex-shrink-0" />
                </a>
              ))}
            </div>
          )}

          {/* Upcoming Events */}
          <div>
            <h2 className="text-xl font-black tracking-tight text-on-background mb-6">Upcoming Events</h2>
            {events.length === 0 ? (
              <div className="rounded-2xl border border-border bg-secondary p-8 text-center">
                <p className="text-muted-foreground font-medium text-sm">No upcoming events</p>
              </div>
            ) : (
              <div className="space-y-4">
                {events.map((ev) => {
                  const eventDate = ev.date ? new Date(ev.date + "T00:00:00") : null;
                  const monthNames = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
                  return (
                    <Link
                      key={ev.id}
                      to={`/event/${ev.id}`}
                      className="flex items-center gap-4 rounded-2xl border border-border bg-secondary hover:border-brand-pink hover:shadow-lg transition-all p-3 group"
                    >
                      {/* Flyer thumbnail */}
                      <div className="w-20 h-20 rounded-xl overflow-hidden flex-shrink-0 bg-muted">
                        {ev.flyer_url ? (
                          <img src={ev.flyer_url} alt={ev.title} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <ImageIcon className="w-6 h-6 text-muted-foreground" />
                          </div>
                        )}
                      </div>
                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <h3 className="font-black text-on-background tracking-tight group-hover:text-brand-pink transition-colors truncate">
                          {ev.title || "Untitled Event"}
                        </h3>
                        <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground font-medium flex-wrap">
                          {eventDate && (
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3.5 h-3.5 text-brand-pink" />
                              {monthNames[eventDate.getMonth()]} {eventDate.getDate()}, {eventDate.getFullYear()}
                            </span>
                          )}
                          {ev.time && (
                            <span className="flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5 text-brand-pink" />
                              {ev.time}
                            </span>
                          )}
                        </div>
                        {ev.venue && (
                          <p className="text-xs text-muted-foreground font-medium mt-1 flex items-center gap-1 truncate">
                            <MapPin className="w-3 h-3 text-brand-pink flex-shrink-0" />
                            {ev.venue}{ev.city ? ` — ${ev.city}` : ""}
                          </p>
                        )}
                      </div>
                      {/* Category badge */}
                      {ev.category && (
                        <span className="bg-brand-lime text-on-background px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest flex-shrink-0 hidden sm:block">
                          {ev.category}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </main>
  );
};

export default OrganizationProfile;
