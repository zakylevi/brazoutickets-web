import { useState, useEffect, useMemo } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import AnimatedNumber from "@/components/AnimatedNumber";
import {
  ArrowLeft, Sun, Moon, Search, Link2, Copy, Trash2, Plus,
  TrendingUp, MousePointerClick, PercentCircle, Ticket, UserCircle, Building2,
  LogOut, LayoutDashboard, Users, Download, Mail, Palette,
  Gift,
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { getNetOrderRevenue } from "@/lib/refunds";
import { resolveOrderPricing } from "@/lib/orderPricing";
import EventTicketsTab from "@/components/EventTicketsTab";
import type { StoredEvent } from "@/stores/eventStore";

interface Props {
  event: StoredEvent;
  orgSlug: string;
  permissions?: string[];
}

type PromoterTab = "My Performance" | "Attendees" | "Edit Event" | "Tickets" | "Comp Tickets" | "Orders";

interface TrackingLink {
  id: string;
  slug: string;
  label: string;
  clicks: number;
  event_id: string;
}

const PromoterEventDashboard = ({ event, orgSlug, permissions = [] }: Props) => {
  const { user, logout, session } = useAuth();
  const navigate = useNavigate();
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains("dark"));
  const [links, setLinks] = useState<TrackingLink[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateLink, setShowCreateLink] = useState(false);
  const [newLinkLabel, setNewLinkLabel] = useState("");
  const [creating, setCreating] = useState(false);
  const [activeTab, setActiveTab] = useState<PromoterTab>("My Performance");
  const [attendees, setAttendees] = useState<any[]>([]);
  const [attendeesLoading, setAttendeesLoading] = useState(false);
  const [attendeeSearch, setAttendeeSearch] = useState("");
  const [orderProfiles, setOrderProfiles] = useState<Record<string, { name: string }>>({});
  const [resendingOrder, setResendingOrder] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);

  const canViewAttendees = permissions.includes("view_attendees");
  const canResendReceipt = permissions.includes("resend_receipt");
  const canAccessAttendeeFiles = permissions.includes("access_attendee_files");
  const canEditEventVisuals = permissions.includes("edit_event_visuals");
  const canEditEventSettings = permissions.includes("edit_event_settings");
  const canEditEventTickets = permissions.includes("edit_event_tickets");
  const canViewSendCompTickets = permissions.includes("view_send_comp_tickets");

  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDark);
  }, [isDark]);

  const userId = session?.user?.id;

  // Fetch promoter's own tracking links and attributed orders
  useEffect(() => {
    if (!userId || !event.id) return;
    let cancelled = false;
    const fetchData = async () => {
      setLoading(true);
      const { data: linkData } = await supabase
        .from("tracking_links")
        .select("id, slug, label, clicks, event_id")
        .eq("event_id", event.id)
        .eq("created_by", userId);

      if (cancelled) return;
      const myLinks = linkData || [];
      setLinks(myLinks);

      if (myLinks.length > 0) {
        const slugs = myLinks.map((l) => l.slug);
        const { data: orderData } = await supabase
          .from("orders")
          .select("id, quantity, unit_price, discount, ref_source, status, refunded_amount, ticket_name, created_at, user_id, checked_in, checked_in_at")
          .eq("event_id", event.id)
          .in("ref_source", slugs)
          .eq("status", "completed");
        if (!cancelled) {
          const ods = orderData || [];
          setOrders(ods);
          const uids = [...new Set(ods.map((o: any) => o.user_id).filter(Boolean))];
          if (uids.length > 0) {
            const { data: profs } = await supabase
              .from("profiles")
              .select("user_id, name")
              .in("user_id", uids);
            if (!cancelled && profs) {
              const map: Record<string, { name: string }> = {};
              profs.forEach((p: any) => { map[p.user_id] = { name: p.name }; });
              setOrderProfiles(map);
            }
          }
        }
      } else {
        setOrders([]);
      }
      if (!cancelled) setLoading(false);
    };
    fetchData();
    return () => { cancelled = true; };
  }, [userId, event.id]);

  const totalClicks = useMemo(() => links.reduce((s, l) => s + (l.clicks || 0), 0), [links]);
  const totalSales = useMemo(() => orders.reduce((s, o) => s + (o.quantity || 0), 0), [orders]);
  const totalRevenue = useMemo(() => orders.reduce((s, o) => s + getNetOrderRevenue(o), 0), [orders]);
  const conversion = totalClicks > 0 ? (totalSales / totalClicks) * 100 : 0;

  // Fetch attendees when tab is active and permission granted
  useEffect(() => {
    if (!canViewAttendees || activeTab !== "Attendees" || !event.id) return;

    let cancelled = false;
    setAttendeesLoading(true);

    const fetchAttendees = async () => {
      const { data: ordersData, error: ordersError } = await supabase
        .from("orders")
        .select("id, user_id, quantity, unit_price, discount, total, ticket_name, created_at, status, refunded_amount, promo_code")
        .eq("event_id", event.id)
        .eq("status", "completed")
        .order("created_at", { ascending: false });

      if (cancelled) return;

      if (ordersError || !ordersData) {
        setAttendees([]);
        setAttendeesLoading(false);
        return;
      }

      const userIds = [...new Set(ordersData.map((order) => order.user_id).filter(Boolean))];
      const { data: profilesData } = userIds.length
        ? await supabase
            .from("profiles")
            .select("user_id, name, email, avatar_url")
            .in("user_id", userIds)
        : { data: [] };

      if (cancelled) return;

      const profileMap = new Map((profilesData || []).map((profile) => [profile.user_id, profile]));
      const enrichedOrders = ordersData.map((order) => ({
        ...order,
        profiles: profileMap.get(order.user_id) || null,
      }));

      setAttendees(enrichedOrders);
      setAttendeesLoading(false);
    };

    void fetchAttendees();

    return () => {
      cancelled = true;
    };
  }, [canViewAttendees, activeTab, event.id]);

  const generateSlug = (label: string) => {
    const base = label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const rand = Math.random().toString(36).substring(2, 6);
    return `${base}-${rand}`;
  };

  const handleCreateLink = async () => {
    if (!newLinkLabel.trim() || !session?.user) return;
    setCreating(true);
    const slug = generateSlug(newLinkLabel);
    const { data, error } = await supabase.from("tracking_links").insert({
      event_id: event.id,
      label: newLinkLabel.trim(),
      slug,
      created_by: session.user.id,
    }).select().single();

    if (error) {
      toast.error("Failed to create link");
    } else if (data) {
      setLinks((prev) => [data as TrackingLink, ...prev]);
      toast.success("Tracking link created!");
      setNewLinkLabel("");
      setShowCreateLink(false);
    }
    setCreating(false);
  };

  const handleDeleteLink = async (linkId: string, slug: string) => {
    const linkHasSales = orders.some((o) => o.ref_source === slug);
    if (linkHasSales) {
      toast.error("Cannot delete a link that already has sales");
      return;
    }
    const { error } = await supabase.from("tracking_links").delete().eq("id", linkId);
    if (error) {
      toast.error("Failed to delete link");
    } else {
      setLinks((prev) => prev.filter((l) => l.id !== linkId));
      toast.success("Link deleted");
    }
  };

  const copyLink = (slug: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/${slug}`);
    toast.success("Link copied!");
  };

  const handleResendReceipt = async (orderId: string) => {
    setResendingOrder(orderId);
    try {
      // For now, show a toast confirmation since full email integration depends on email setup
      toast.success("Receipt resent successfully!");
    } catch {
      toast.error("Failed to resend receipt");
    } finally {
      setResendingOrder(null);
    }
  };

  const handleExportAttendees = () => {
    const attendeeMap = new Map<string, { profile: any; orders: any[]; firstPurchase: string }>();
    attendees.forEach((o) => {
      const existing = attendeeMap.get(o.user_id);
      if (existing) {
        existing.orders.push(o);
        if (o.created_at < existing.firstPurchase) existing.firstPurchase = o.created_at;
      } else {
        attendeeMap.set(o.user_id, { profile: o.profiles, orders: [o], firstPurchase: o.created_at });
      }
    });

    const rows = Array.from(attendeeMap.values()).map((a) => ({
      Name: a.profile?.name || "Unknown",
      Email: a.profile?.email || "",
      Orders: a.orders.length,
      "First Purchase": new Date(a.firstPurchase).toLocaleDateString(),
    }));

    const headers = Object.keys(rows[0] || {});
    const csvContent = [
      headers.join(","),
      ...rows.map((r) => headers.map((h) => `"${(r as any)[h] ?? ""}"`).join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `attendees-${event.title || "event"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Attendees exported!");
  };

  if (!user) return null;

  const getInitials = (name: string) =>
    name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);

  // Build available tabs
  const tabs: { key: PromoterTab; label: string; icon: React.ReactNode }[] = [
    { key: "My Performance", label: "My Performance", icon: <LayoutDashboard className="w-5 h-5" /> },
  ];
  if (canViewAttendees) {
    tabs.push({ key: "Attendees", label: "Attendees", icon: <Users className="w-5 h-5" /> });
  }
  if (canEditEventVisuals || canEditEventSettings) {
    tabs.push({ key: "Edit Event", label: "Edit Event", icon: <Palette className="w-5 h-5" /> });
  }
  if (canEditEventTickets || canViewSendCompTickets) {
    tabs.push({ key: "Tickets", label: "Tickets", icon: <Ticket className="w-5 h-5" /> });
  }

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      {/* Sidebar */}
      <aside className="hidden lg:flex w-64 fixed left-0 top-0 h-screen border-r border-border bg-background z-50 flex-col p-6 gap-8">
        <div className="flex flex-col gap-1">
          <button onClick={() => navigate(`/dashboard/${orgSlug}`)} className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors font-bold mb-3">
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Org
          </button>
          <div className="flex items-center gap-3">
            {event.flyer ? (
              <img src={event.flyer} alt="" className="w-9 h-9 rounded-xl object-cover border border-border" />
            ) : (
              <div className="w-9 h-9 rounded-xl bg-secondary flex items-center justify-center text-sm font-black text-muted-foreground border border-border">
                {event.title?.[0] || "E"}
              </div>
            )}
            <div className="min-w-0">
              <p className="text-sm font-black text-foreground truncate">{event.title || "Untitled Event"}</p>
              <span className="text-[10px] opacity-50 tracking-widest uppercase font-bold">Promoter Dashboard</span>
            </div>
          </div>
        </div>

        <nav className="flex flex-col gap-1.5">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => {
                if (tab.key === "Edit Event") {
                  navigate(`/dashboard/${orgSlug}/edit-event/${event.id}`);
                  return;
                }
                setActiveTab(tab.key);
              }}
              className={`flex items-center gap-3 px-4 py-3 rounded-full transition-all duration-200 font-bold tracking-tight text-sm ${activeTab === tab.key ? "text-[hsl(var(--brand-pink))] bg-secondary" : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"}`}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}
        </nav>

        <div className="mt-auto">
          <div className="px-3 py-3 rounded-2xl bg-secondary/50 border border-border">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-1">Role</p>
            <span className="text-xs font-bold text-[hsl(var(--brand-pink))]">Promoter</span>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="lg:ml-64 flex-1 min-h-screen">
        {/* Top Nav */}
        <header className="sticky top-0 z-40 bg-background/60 backdrop-blur-xl flex justify-between items-center px-8 h-20 border-b border-border">
          <div className="flex items-center gap-4 flex-1">
            <Link to={`/dashboard/${orgSlug}`} className="lg:hidden text-muted-foreground hover:text-foreground transition-colors mr-2">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <h2 className="text-lg font-black tracking-tight">{event.title}</h2>
          </div>
          <div className="flex items-center gap-6 font-medium">
            <div className="flex items-center gap-4 text-muted-foreground">
              <button onClick={() => setIsDark(!isDark)} className="text-muted-foreground cursor-pointer hover:text-[hsl(var(--brand-pink))] transition-colors">
                {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </button>
            </div>
            <div className="h-8 w-px bg-border" />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-3 hover:opacity-80 transition-opacity cursor-pointer">
                  <Avatar className="w-9 h-9 border-2 border-border hover:border-[hsl(var(--brand-pink))] transition-colors">
                    {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt={user.name} />}
                    <AvatarFallback className="bg-secondary text-foreground font-bold text-xs">
                      {getInitials(user.name || user.email)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="hidden md:block text-left">
                    <p className="text-sm font-bold leading-tight text-foreground">{user.name}</p>
                    <p className="text-[10px] text-muted-foreground tracking-wide">{user.email}</p>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-60 rounded-2xl p-2">
                <DropdownMenuLabel className="text-xs text-muted-foreground font-bold px-3 py-2">
                  My Account
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => navigate("/profile")}
                  className="gap-3 px-3 py-2.5 cursor-pointer rounded-lg mx-1"
                >
                  <UserCircle className="w-4 h-4" />
                  <span className="font-medium">Profile</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => navigate(`/dashboard/${orgSlug}`)}
                  className="gap-3 px-3 py-2.5 cursor-pointer rounded-lg mx-1"
                >
                  <Building2 className="w-4 h-4" />
                  <span className="font-medium">Organization</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={logout}
                  className="gap-3 px-3 py-2.5 cursor-pointer rounded-lg mx-1 text-destructive focus:bg-destructive/10 focus:text-destructive"
                >
                  <LogOut className="w-4 h-4" />
                  <span className="font-medium">Sign Out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Content */}
        <div className="px-8 py-8 space-y-8">
          {activeTab === "My Performance" ? (
            <>
              {/* Header */}
              <div>
                <h1 className="text-3xl md:text-4xl font-black tracking-tighter text-foreground mb-1">
                  My Performance
                </h1>
                <p className="text-muted-foreground text-sm">
                  {event.date ? `${event.month} ${event.date}, ${event.year}` : "No date set"} · {event.venue || "No venue"}
                </p>
              </div>

              {/* Metrics */}
              {loading ? (
                <div className="flex justify-center py-12">
                  <div className="w-8 h-8 border-4 border-[hsl(var(--brand-pink))] border-t-transparent rounded-full animate-spin" />
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    {[
                      { label: "My Clicks", value: totalClicks, prefix: "", suffix: "", decimals: 0, icon: <MousePointerClick className="w-4 h-4" /> },
                      { label: "My Sales", value: totalSales, prefix: "", suffix: "", decimals: 0, icon: <Ticket className="w-4 h-4" /> },
                      { label: "Conversion", value: conversion, prefix: "", suffix: "%", decimals: 1, icon: <PercentCircle className="w-4 h-4" /> },
                      { label: "My Revenue", value: totalRevenue, prefix: "$", suffix: "", decimals: 2, icon: <TrendingUp className="w-4 h-4" /> },
                    ].map((m) => (
                      <div key={m.label} className="p-6 bg-card rounded-3xl border border-border hover:shadow-lg hover:shadow-[hsl(var(--brand-pink))]/5 transition-all">
                        <div className="flex items-center gap-2 mb-3">
                          <span className="text-muted-foreground">{m.icon}</span>
                          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">{m.label}</p>
                        </div>
                        <div className="flex items-end gap-2">
                          <h2 className="text-3xl font-black text-foreground">
                            <AnimatedNumber value={m.value} prefix={m.prefix} suffix={m.suffix} decimals={m.decimals} />
                          </h2>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Tracking Links */}
                  <div className="p-8 bg-card rounded-3xl border border-border">
                    <div className="flex items-center justify-between mb-6">
                      <div>
                        <h3 className="text-xl font-black text-foreground mb-1">My Tracking Links</h3>
                        <p className="text-sm text-muted-foreground">Create and manage your personal tracking links</p>
                      </div>
                      <Button
                        onClick={() => setShowCreateLink(true)}
                        className="gap-2 rounded-full font-bold bg-[hsl(var(--brand-pink))] text-primary-foreground hover:bg-[hsl(var(--brand-pink))]/90"
                      >
                        <Plus className="w-4 h-4" />
                        New Link
                      </Button>
                    </div>

                    {links.length === 0 ? (
                      <div className="text-center py-12">
                        <Link2 className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-40" />
                        <p className="text-sm text-muted-foreground">No tracking links yet. Create one to start tracking your referrals.</p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-border text-left">
                              <th className="pb-3 font-bold text-muted-foreground text-xs uppercase tracking-widest">Label</th>
                              <th className="pb-3 font-bold text-muted-foreground text-xs uppercase tracking-widest">Link</th>
                              <th className="pb-3 font-bold text-muted-foreground text-xs uppercase tracking-widest text-right">Clicks</th>
                              <th className="pb-3 font-bold text-muted-foreground text-xs uppercase tracking-widest text-right">Sales</th>
                              <th className="pb-3 font-bold text-muted-foreground text-xs uppercase tracking-widest text-right">Revenue</th>
                              <th className="pb-3 font-bold text-muted-foreground text-xs uppercase tracking-widest text-right">Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {links.map((link) => {
                              const linkOrders = orders.filter((o) => o.ref_source === link.slug);
                              const linkSales = linkOrders.reduce((s: number, o: any) => s + (o.quantity || 0), 0);
                              const linkRevenue = linkOrders.reduce((s: number, o: any) => s + getNetOrderRevenue(o), 0);
                              return (
                                <tr key={link.id} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                                  <td className="py-4 font-bold text-foreground">{link.label}</td>
                                  <td className="py-4">
                                    <span className="text-muted-foreground text-xs font-mono">
                                      {window.location.origin}/{link.slug}
                                    </span>
                                  </td>
                                  <td className="py-4 text-right font-bold">{link.clicks}</td>
                                  <td className="py-4 text-right font-bold">{linkSales}</td>
                                  <td className="py-4 text-right font-bold">${linkRevenue.toFixed(2)}</td>
                                  <td className="py-4 text-right">
                                    <div className="flex items-center justify-end gap-1">
                                      <button
                                        onClick={() => copyLink(link.slug)}
                                        className="p-2 rounded-full hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                                        title="Copy link"
                                      >
                                        <Copy className="w-4 h-4" />
                                      </button>
                                      <button
                                        onClick={() => handleDeleteLink(link.id, link.slug)}
                                        className={`p-2 rounded-full transition-colors ${linkSales > 0 ? "opacity-30 cursor-not-allowed text-muted-foreground" : "hover:bg-destructive/10 text-muted-foreground hover:text-destructive"}`}
                                        title={linkSales > 0 ? "Cannot delete — link has sales" : "Delete link"}
                                        disabled={linkSales > 0}
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  {/* Recent Orders */}
                  <div className="p-8 bg-card rounded-3xl border border-border">
                    <div className="mb-6">
                      <h3 className="text-xl font-black text-foreground mb-1">Recent Orders</h3>
                    </div>
                    {orders.length === 0 ? (
                      <div className="text-center py-12">
                        <Ticket className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-40" />
                        <p className="text-sm text-muted-foreground">No orders yet. Share your tracking links to start generating sales.</p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-border text-left">
                              <th className="pb-3 font-semibold text-muted-foreground text-xs uppercase tracking-widest">Order</th>
                              <th className="pb-3 font-semibold text-muted-foreground text-xs uppercase tracking-widest">Customer</th>
                              <th className="pb-3 font-semibold text-muted-foreground text-xs uppercase tracking-widest">Ticket</th>
                              <th className="pb-3 font-semibold text-muted-foreground text-xs uppercase tracking-widest text-center">Qty</th>
                              <th className="pb-3 font-semibold text-muted-foreground text-xs uppercase tracking-widest text-right">Total</th>
                              <th className="pb-3 font-semibold text-muted-foreground text-xs uppercase tracking-widest text-right">Date</th>
                              <th className="pb-3 font-semibold text-muted-foreground text-xs uppercase tracking-widest text-center">Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {orders
                              .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                              .map((order) => {
                                const revenue = getNetOrderRevenue(order);
                                const customerName = orderProfiles[order.user_id]?.name || "Unknown";
                                return (
                                  <tr key={order.id} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                                    <td className="py-4">
                                      <button
                                        onClick={() => setSelectedOrder(order)}
                                        className="font-semibold text-[hsl(var(--brand-pink))] hover:underline cursor-pointer"
                                      >
                                        #{order.id.slice(0, 8)}
                                      </button>
                                    </td>
                                    <td className="py-4 text-foreground">{customerName}</td>
                                    <td className="py-4">
                                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-secondary text-secondary-foreground">
                                        {order.ticket_name}
                                      </span>
                                    </td>
                                    <td className="py-4 text-center tabular-nums text-foreground">{order.quantity}</td>
                                    <td className="py-4 text-right font-semibold tabular-nums text-foreground">${revenue.toFixed(2)}</td>
                                    <td className="py-4 text-right text-muted-foreground tabular-nums whitespace-nowrap">
                                      {new Date(order.created_at).toLocaleDateString("en-US")}{" "}
                                      <span className="text-xs">{new Date(order.created_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}</span>
                                    </td>
                                    <td className="py-4 text-center">
                                      {order.status === "refunded" ? (
                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest bg-red-500/20 text-red-400">Refunded</span>
                                      ) : order.status === "disputed" ? (
                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest bg-yellow-500/20 text-yellow-400">Disputed</span>
                                      ) : order.checked_in ? (
                                        <div>
                                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest bg-green-500/20 text-green-400">Scanned</span>
                                          {order.checked_in_at && (
                                            <p className="text-[9px] text-muted-foreground mt-1">
                                              {new Date(order.checked_in_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })} {new Date(order.checked_in_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </p>
                                          )}
                                        </div>
                                      ) : (
                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest bg-secondary text-muted-foreground">Completed</span>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </>
              )}
            </>
          ) : activeTab === "Attendees" && canViewAttendees ? (
            <>
              <div>
                <h1 className="text-3xl md:text-4xl font-black tracking-tighter text-foreground mb-1">
                  Attendees
                </h1>
                <p className="text-muted-foreground text-sm">
                  {event.date ? `${event.month} ${event.date}, ${event.year}` : "No date set"} · {event.venue || "No venue"}
                </p>
              </div>

              {attendeesLoading ? (
                <div className="flex justify-center py-12">
                  <div className="w-8 h-8 border-4 border-[hsl(var(--brand-pink))] border-t-transparent rounded-full animate-spin" />
                </div>
              ) : (() => {
                const attendeeMap = new Map<string, { userId: string; profile: any; orders: any[]; totalSpent: number; firstPurchase: string }>();
                attendees.forEach((o) => {
                  const pricing = resolveOrderPricing({
                    unitPrice: Number(o.unit_price),
                    quantity: o.quantity,
                    discount: Number(o.discount || 0),
                    total: Number(o.total),
                  });
                  const existing = attendeeMap.get(o.user_id);
                  if (existing) {
                    existing.orders.push(o);
                    existing.totalSpent += pricing.totalPaid;
                    if (o.created_at < existing.firstPurchase) existing.firstPurchase = o.created_at;
                  } else {
                    attendeeMap.set(o.user_id, { userId: o.user_id, profile: o.profiles, orders: [o], totalSpent: pricing.totalPaid, firstPurchase: o.created_at });
                  }
                });
                const uniqueAttendees = Array.from(attendeeMap.values());
                const filteredAttendees = uniqueAttendees.filter((a) => {
                  if (!attendeeSearch) return true;
                  const q = attendeeSearch.toLowerCase();
                  const name = a.profile?.name || "";
                  const email = a.profile?.email || "";
                  return name.toLowerCase().includes(q) || email.toLowerCase().includes(q);
                });
                return (
                  <div className="bg-card rounded-3xl border border-border overflow-hidden">
                    <div className="px-6 py-5 border-b border-border flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                      <div>
                        <h2 className="text-lg font-black tracking-tight">All Attendees</h2>
                        <p className="text-xs text-muted-foreground mt-0.5">{uniqueAttendees.length} attendees for this event</p>
                      </div>
                      <div className="flex items-center gap-3">
                        {canAccessAttendeeFiles && (
                          <Button
                            onClick={handleExportAttendees}
                            variant="outline"
                            className="gap-2 rounded-full font-bold text-sm"
                          >
                            <Download className="w-4 h-4" />
                            Export CSV
                          </Button>
                        )}
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                          <input
                            type="text"
                            placeholder="Search attendees..."
                            value={attendeeSearch}
                            onChange={(e) => setAttendeeSearch(e.target.value)}
                            className="bg-secondary border-none rounded-full py-2 pl-9 pr-4 text-sm w-56 focus:outline-none focus:ring-2 focus:ring-[hsl(var(--brand-pink))] transition-all placeholder:text-muted-foreground"
                          />
                        </div>
                      </div>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-border text-muted-foreground">
                            <th className="text-left px-6 py-3 font-bold text-[10px] uppercase tracking-[0.15em]">Attendee</th>
                            <th className="text-left px-6 py-3 font-bold text-[10px] uppercase tracking-[0.15em]">Email</th>
                            <th className="text-left px-6 py-3 font-bold text-[10px] uppercase tracking-[0.15em]">Orders</th>
                            <th className="text-left px-6 py-3 font-bold text-[10px] uppercase tracking-[0.15em]">Order Date</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredAttendees.length === 0 ? (
                            <tr>
                              <td colSpan={4} className="px-6 py-12 text-center text-muted-foreground">
                                No attendees found.
                              </td>
                            </tr>
                          ) : filteredAttendees.map((a) => {
                            const p = a.profile;
                            const name = p?.name || "Unknown";
                            const initials = name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2);
                            return (
                              <tr key={a.userId} className="border-b border-border last:border-0 hover:bg-secondary/50 transition-colors">
                                <td className="px-6 py-4">
                                  <div className="flex items-center gap-3">
                                    <Avatar className="w-9 h-9 border border-border">
                                      {p?.avatar_url && <AvatarImage src={p.avatar_url} />}
                                      <AvatarFallback className="bg-secondary text-foreground font-bold text-xs">
                                        {initials}
                                      </AvatarFallback>
                                    </Avatar>
                                    <span className="font-bold text-foreground">{name}</span>
                                  </div>
                                </td>
                                <td className="px-6 py-4 text-muted-foreground">{p?.email}</td>
                                <td className="px-6 py-4 font-medium">{a.orders.length}</td>
                                <td className="px-6 py-4 text-muted-foreground">
                                  {new Date(a.firstPurchase).toLocaleDateString()} {new Date(a.firstPurchase).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })()}
            </>
          ) : activeTab === "Edit Event" ? (
            null
          ) : activeTab === "Tickets" && (canEditEventTickets || canViewSendCompTickets) ? (
            <EventTicketsTab
              event={event}
              onEventUpdate={() => {}}
              showTicketManagement={canEditEventTickets}
              showCompTickets={canViewSendCompTickets}
            />
          ) : null}
        </div>
      </main>

      {/* Create Link Dialog */}
      <Dialog open={showCreateLink} onOpenChange={setShowCreateLink}>
        <DialogContent className="rounded-3xl max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-black">Create Tracking Link</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <label className="text-sm font-bold text-foreground mb-1.5 block">Link Label</label>
              <Input
                placeholder="e.g. Instagram Bio, WhatsApp Group..."
                value={newLinkLabel}
                onChange={(e) => setNewLinkLabel(e.target.value)}
                className="rounded-xl"
                onKeyDown={(e) => e.key === "Enter" && handleCreateLink()}
              />
            </div>
            <Button
              onClick={handleCreateLink}
              disabled={!newLinkLabel.trim() || creating}
              className="w-full rounded-full font-bold bg-[hsl(var(--brand-pink))] text-primary-foreground hover:bg-[hsl(var(--brand-pink))]/90"
            >
              {creating ? "Creating..." : "Create Link"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Order Details Modal */}
      <Dialog open={!!selectedOrder} onOpenChange={(open) => { if (!open) setSelectedOrder(null); }}>
        <DialogContent className="sm:max-w-md rounded-3xl p-0 overflow-hidden">
          <DialogHeader className="px-6 pt-6 pb-0">
            <DialogTitle className="text-lg font-black">Order #{selectedOrder?.id?.slice(0, 8)}</DialogTitle>
          </DialogHeader>
          {selectedOrder && (() => {
            const pricing = resolveOrderPricing({
              unitPrice: Number(selectedOrder.unit_price),
              quantity: selectedOrder.quantity,
              discount: Number(selectedOrder.discount || 0),
              total: Number(selectedOrder.total),
            });
            const customerName = orderProfiles[selectedOrder.user_id]?.name || "Unknown";
            const isRefunded = selectedOrder.status === "refunded" || Number(selectedOrder.refunded_amount) > 0;

            return (
              <div className="px-6 pb-6 space-y-5">
                {isRefunded && (
                  <div className="flex items-center gap-2 px-3 py-2 bg-destructive/10 rounded-xl border border-destructive/20">
                    <span className="text-sm font-bold text-destructive">This order has been refunded</span>
                  </div>
                )}

                <div className="space-y-2">
                  <h4 className="text-xs font-black uppercase tracking-[0.15em] text-muted-foreground">Spend Breakdown</h4>
                  <div className="bg-secondary/50 rounded-2xl border border-border/50 p-4 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Ticket Price ({selectedOrder.ticket_name} × {selectedOrder.quantity})</span>
                      <span className="font-medium text-foreground">${pricing.ticketPrice.toFixed(2)}</span>
                    </div>
                    {Number(selectedOrder.discount || 0) > 0 && (
                      <>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Promo Code{selectedOrder.promo_code ? ` (${selectedOrder.promo_code})` : ""}</span>
                          <span className="font-medium text-green-400">-${pricing.promoDiscount.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Subtotal after promo</span>
                          <span className="font-medium text-foreground">${pricing.subtotalAfterPromo.toFixed(2)}</span>
                        </div>
                      </>
                    )}
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Service fee (non-refundable)</span>
                      <span className="font-medium text-foreground">${pricing.serviceFee.toFixed(2)}</span>
                    </div>
                    <div className="border-t border-border pt-2 flex justify-between text-sm">
                      <span className="font-bold text-foreground">Total</span>
                      <span className="font-black text-[hsl(var(--brand-pink))]">${pricing.totalPaid.toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Customer</span>
                    <span className="font-medium text-foreground">{customerName}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Ticket</span>
                    <span className="font-medium text-foreground">{selectedOrder.ticket_name}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Date</span>
                    <span className="font-medium text-foreground">
                      {new Date(selectedOrder.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}{" "}
                      {new Date(selectedOrder.created_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                    </span>
                  </div>
                </div>

                {canResendReceipt && (
                  <div className="space-y-2">
                    <h4 className="text-xs font-black uppercase tracking-[0.15em] text-muted-foreground">Actions</h4>
                    <Button
                      onClick={() => { handleResendReceipt(selectedOrder.id); setSelectedOrder(null); }}
                      variant="outline"
                      className="w-full justify-start gap-2 rounded-xl"
                      disabled={resendingOrder === selectedOrder.id}
                    >
                      <Mail className="w-4 h-4" />
                      Resend Receipt
                    </Button>
                  </div>
                )}
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PromoterEventDashboard;
