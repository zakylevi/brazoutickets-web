import { useAdminGuard } from "@/hooks/useAdminGuard";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import CreateOrganizationModal from "@/components/CreateOrganizationModal";
import AdminOrgDetail from "@/components/AdminOrgDetail";
import AdminEventDetail from "@/components/AdminEventDetail";
import type { Organization } from "@/contexts/OrganizationContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard,
  Ticket,
  DollarSign,
  Megaphone,
  Users,
  HelpCircle,
  ArrowRight,
  Download,
  ShieldCheck,
  Briefcase,
  Building2,
  BarChart3,
  CalendarDays,
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Plus,
  Trash2,
  Ban,
  ImageIcon,
  ExternalLink,
  Pencil,
  Check,
  MoreVertical,
  EyeOff,
  XCircle,
  Mail,
  Phone,
  CalendarCheck,
  ChevronRight,
  Lock,
  Save,
  RotateCcw,
  Send,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import brazouLogo from "@/assets/brazou-logo.png";
import { cn } from "@/lib/utils";
import { resolveOrderPricing } from "@/lib/orderPricing";
import { applyRefundToOrder, applyRefundToOrders, getNetOrderRevenue, isOrderRefunded, refundOrder } from "@/lib/refunds";
import AdminFinanceTab from "@/components/AdminFinanceTab";
import AdminSettingsTab from "@/components/AdminSettingsTab";
import { eachDayOfInterval, eachMonthOfInterval, format, subDays, parseISO } from "date-fns";
import { aggregateFinancials } from "@/lib/orderFinancials";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip as RechartsTooltip, CartesianGrid } from "recharts";

type AdminTab = "OVERVIEW" | "EVENTS" | "EVENTS_ANALYTICS" | "ORGANIZATIONS" | "FINANCE" | "MARKETING" | "ATTENDEES" | "SUPPORT" | "SETTINGS";

interface NavChild {
  icon: React.ElementType;
  label: string;
  tab: AdminTab;
}

interface NavItem {
  icon: React.ElementType;
  label: string;
  tab: AdminTab;
  children?: NavChild[];
}

const navItems: NavItem[] = [
  { icon: LayoutDashboard, label: "OVERVIEW", tab: "OVERVIEW" },
  { icon: Ticket, label: "Events", tab: "EVENTS", children: [
    { icon: BarChart3, label: "PROMOTED EVENTS", tab: "EVENTS_ANALYTICS" },
  ]},
  { icon: DollarSign, label: "FINANCE DASHBOARD", tab: "FINANCE" },
  { icon: Megaphone, label: "Marketing", tab: "MARKETING" },
  { icon: Users, label: "Attendees", tab: "ATTENDEES" },
  { icon: Building2, label: "ORGANIZATIONS", tab: "ORGANIZATIONS" },
  { icon: HelpCircle, label: "Support", tab: "SUPPORT" },
  { icon: Lock, label: "SETTINGS", tab: "SETTINGS" },
];

interface OrgStat {
  id: string;
  name: string;
  avatar_url: string | null;
  slug: string;
  type: string;
  eventCount: number;
  ownerName: string;
  ownerUserId: string;
  totalRevenue: number;
  totalAttendees: number;
  createdAt: string;
  region: string;
  country: string;
  state: string;
  socials: any;
  links: any;
  created_by: string;
}

interface EventStat {
  id: string;
  title: string;
  flyer_url: string | null;
  category: string;
  ticketsSold: number;
  totalTickets: number;
  revenue: number;
  orgName: string;
  orgAvatarUrl: string | null;
  orgSlug: string;
  status: string;
  date: string | null;
  end_date: string | null;
  city: string;
  salesDisabled: boolean;
}

const AdminDashboard = () => {
  const { isAdmin, checking } = useAdminGuard();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [stats, setStats] = useState({ totalUsers: 0, totalOrgs: 0, totalEvents: 0, totalRevenue: 0, netPlatformRevenue: 0 });
  const [dailyPlatformRevenue, setDailyPlatformRevenue] = useState<{ date: string; revenue: number }[]>([]);
  const [topEvents, setTopEvents] = useState<EventStat[]>([]);
  const [topOrgs, setTopOrgs] = useState<OrgStat[]>([]);
  const [activeTab, setActiveTab] = useState<AdminTab>("OVERVIEW");
  const [allOrgs, setAllOrgs] = useState<OrgStat[]>([]);
  const [allEvents, setAllEvents] = useState<EventStat[]>([]);
  const [hoveredBar, setHoveredBar] = useState<number | null>(null);
  const [disableSalesConfirm, setDisableSalesConfirm] = useState<EventStat | null>(null);
  const [eventSearch, setEventSearch] = useState("");
  const [orgSearch, setOrgSearch] = useState("");
  const [eventFilter, setEventFilter] = useState<"ALL" | "LIVE" | "PAST">("ALL");
  const [eventDateFilter, setEventDateFilter] = useState("");
  const [sortColumn, setSortColumn] = useState<"title" | "date" | "orgName" | "ticketsSold" | "city" | "revenue" | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [promotedEvents, setPromotedEvents] = useState<any[]>([]);
  const [promoForm, setPromoForm] = useState({ title: "", subtitle: "", location: "", event_link: "", background_url: "" });
  const [promoUploading, setPromoUploading] = useState(false);
  const [promoSaving, setPromoSaving] = useState(false);
  const [promoBgFile, setPromoBgFile] = useState<File | null>(null);
  const [promoBgPreview, setPromoBgPreview] = useState<string | null>(null);
  const [promoSubTab, setPromoSubTab] = useState<"homepage" | "explorer">("homepage");
  const [explorerPromotedEvents, setExplorerPromotedEvents] = useState<any[]>([]);
  const [explorerPromoForm, setExplorerPromoForm] = useState({ title: "", subtitle: "", location: "", event_link: "", background_url: "" });
  const [explorerPromoBgFile, setExplorerPromoBgFile] = useState<File | null>(null);
  const [explorerPromoBgPreview, setExplorerPromoBgPreview] = useState<string | null>(null);
  const [explorerPromoSaving, setExplorerPromoSaving] = useState(false);
  const [editingExplorerPromoId, setEditingExplorerPromoId] = useState<string | null>(null);
  const [editExplorerPromoForm, setEditExplorerPromoForm] = useState({ title: "", subtitle: "", location: "", event_link: "" });
  const [editExplorerPromoBgFile, setEditExplorerPromoBgFile] = useState<File | null>(null);
  const [editExplorerPromoBgPreview, setEditExplorerPromoBgPreview] = useState<string | null>(null);

  useEffect(() => {
    if (!isAdmin) return;
    const fetchPromoted = async () => {
      const { data } = await supabase.from("promoted_events").select("*").order("sort_order", { ascending: true });
      const all = data || [];
      setPromotedEvents(all.filter((p: any) => p.placement !== "explorer"));
      setExplorerPromotedEvents(all.filter((p: any) => p.placement === "explorer"));
    };
    fetchPromoted();
    const fetchUsers = async () => {
      const [{ data: usersData }, { data: userOrders }, { data: eventsData }] = await Promise.all([
        supabase.from("profiles").select("user_id, name, email, phone, avatar_url, created_at, instagram").order("created_at", { ascending: false }),
        supabase.from("orders").select("id, created_at, event_id, user_id, ticket_name, quantity, unit_price, service_fee, total, discount, promo_code, status, refunded_amount, refunded_at, billing_city, billing_state, billing_zip"),
        supabase.from("events").select("id, title"),
      ]);
      setAllUsers(usersData || []);
      const eventTitleMap = new Map<string, string>();
      (eventsData || []).forEach(e => eventTitleMap.set(e.id, e.title));
      const map = new Map<string, { totalSpent: number; eventsAttended: number; billingCity: string; billingState: string; billingZip: string; orders: { id: string; created_at: string; event_id: string; event_title: string; ticket_name: string; quantity: number; total: number; status: string; unit_price?: number; service_fee?: number; discount?: number; promo_code?: string | null; refunded_amount?: number; refunded_at?: string | null }[] }>();
      (userOrders || []).forEach(o => {
        const existing = map.get(o.user_id) || { totalSpent: 0, eventsAttended: 0, billingCity: "", billingState: "", billingZip: "", orders: [] };
        existing.totalSpent += Math.max(0, Number(o.total || 0) - Number((o as any).refunded_amount || 0));
        if (!existing.billingCity && o.billing_city) existing.billingCity = o.billing_city;
        if (!existing.billingState && o.billing_state) existing.billingState = o.billing_state;
        if (!existing.billingZip && (o as any).billing_zip) existing.billingZip = (o as any).billing_zip;
        existing.orders.push({ ...o, total: Number(o.total || 0), event_title: eventTitleMap.get(o.event_id) || "Unknown Event" });
        map.set(o.user_id, existing);
      });
      map.forEach((val) => {
        val.eventsAttended = new Set(val.orders.map(o => o.event_id)).size;
        val.orders.sort((a, b) => b.created_at.localeCompare(a.created_at));
      });
      setUserOrdersMap(map);
    };
    fetchUsers();
  }, [isAdmin]);

  const handlePromoBgSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPromoBgFile(file);
    const reader = new FileReader();
    reader.onload = () => setPromoBgPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleAddPromotedEvent = async () => {
    if (!promoForm.title.trim()) return;
    setPromoSaving(true);
    let backgroundUrl = promoForm.background_url;

    if (promoBgFile) {
      const ext = promoBgFile.name.split(".").pop() || "jpg";
      const path = `promoted/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("event-images").upload(path, promoBgFile, { upsert: true });
      if (!error) {
        const { data } = supabase.storage.from("event-images").getPublicUrl(path);
        backgroundUrl = data.publicUrl;
      }
    }

    const { data, error } = await supabase.from("promoted_events").insert({
      title: promoForm.title,
      subtitle: promoForm.subtitle,
      location: promoForm.location,
      event_link: promoForm.event_link,
      background_url: backgroundUrl || null,
      sort_order: promotedEvents.length,
      placement: "homepage",
    }).select().single();

    if (!error && data) {
      setPromotedEvents([...promotedEvents, data]);
      setPromoForm({ title: "", subtitle: "", location: "", event_link: "", background_url: "" });
      setPromoBgFile(null);
      setPromoBgPreview(null);
    }
    setPromoSaving(false);
  };

  // Attendees state
  const [allUsers, setAllUsers] = useState<{ user_id: string; name: string; email: string; phone: string | null; avatar_url: string | null; created_at: string; instagram?: string | null }[]>([]);
  const [userOrdersMap, setUserOrdersMap] = useState<Map<string, { totalSpent: number; eventsAttended: number; billingCity: string; billingState: string; billingZip: string; orders: { id: string; created_at: string; event_id: string; event_title: string; ticket_name: string; quantity: number; total: number; status: string; unit_price?: number; service_fee?: number; discount?: number; promo_code?: string | null; refunded_amount?: number; refunded_at?: string | null }[] }>>(new Map());
  const [attendeeSearch, setAttendeeSearch] = useState("");
  const [selectedUser, setSelectedUser] = useState<{ user_id: string; name: string; email: string; phone: string | null; avatar_url: string | null; created_at: string } | null>(null);
  const [selectedOrderDetail, setSelectedOrderDetail] = useState<{ id: string; created_at: string; event_id: string; event_title: string; ticket_name: string; quantity: number; total: number; status: string; unit_price?: number; service_fee?: number; discount?: number; promo_code?: string | null; refunded_amount?: number; refunded_at?: string | null; user_name?: string; user_email?: string } | null>(null);
  const [adminShowPartialRefund, setAdminShowPartialRefund] = useState(false);
  const [adminPartialRefundAmount, setAdminPartialRefundAmount] = useState("");
   const [attendeeSortCol, setAttendeeSortCol] = useState<"name" | "email" | "phone" | "joined" | "spent" | null>(null);
   const [growthPeriod, setGrowthPeriod] = useState<"month" | "year">("month");
  const [attendeeSortDir, setAttendeeSortDir] = useState<"asc" | "desc">("asc");
  const [adminEditEmail, setAdminEditEmail] = useState("");
  const [adminEditPassword, setAdminEditPassword] = useState("");
  const [adminEditSaving, setAdminEditSaving] = useState(false);
  const [editOrgData, setEditOrgData] = useState<Organization | null>(null);
  const [selectedOrg, setSelectedOrg] = useState<OrgStat | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<EventStat | null>(null);

  const syncAdminRefundState = (orderId: string, refundAmount: number, refundedAt: string) => {
    setSelectedOrderDetail((prev) => (prev?.id === orderId ? applyRefundToOrder(prev, refundAmount, refundedAt) ?? prev : prev));
    setUserOrdersMap((prev) => {
      const next = new Map(prev);
      prev.forEach((value, key) => {
        if (!value.orders.some((order) => order.id === orderId)) return;
        const updatedOrders = applyRefundToOrders(value.orders, orderId, refundAmount, refundedAt);
        const totalSpent = updatedOrders.reduce(
          (sum, order) => sum + Math.max(0, Number(order.total || 0) - Number(order.refunded_amount || 0)),
          0
        );
        next.set(key, { ...value, orders: updatedOrders, totalSpent });
      });
      return next;
    });
  };

  const handleAdminUpdateUser = async (field: "email" | "password") => {
    if (!selectedUser) return;
    const value = field === "email" ? adminEditEmail.trim() : adminEditPassword;
    if (!value) return;
    if (field === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      toast.error("Invalid email format");
      return;
    }
    if (field === "password" && value.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    setAdminEditSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-update-user`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          user_id: selectedUser.user_id,
          ...(field === "email" ? { email: value } : { password: value }),
        }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Failed to update");
      toast.success(field === "email" ? "Email updated successfully" : "Password updated successfully");
      if (field === "email") {
        setAllUsers(allUsers.map(u => u.user_id === selectedUser.user_id ? { ...u, email: value } : u));
        setSelectedUser({ ...selectedUser, email: value });
        setAdminEditEmail("");
      } else {
        setAdminEditPassword("");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to update user");
    } finally {
      setAdminEditSaving(false);
    }
  };

  const handleBlockUser = async () => {
    if (!selectedUser) return;
    setBlockConfirmOpen(true);
  };

  const [blockConfirmOpen, setBlockConfirmOpen] = useState(false);

  const executeBlockUser = async () => {
    if (!selectedUser) return;
    setBlockConfirmOpen(false);
    setAdminEditSaving(true);
    try {
      const { data: { session: s } } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-update-user`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${s?.access_token}`,
          },
          body: JSON.stringify({ user_id: selectedUser.user_id, ban: true }),
        }
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to block user");
      toast.success(`${selectedUser.name} has been blocked`);
      setSelectedUser(null);
    } catch (err: any) {
      toast.error(err.message || "Failed to block user");
    } finally {
      setAdminEditSaving(false);
    }
  };

  const [editingPromoId, setEditingPromoId] = useState<string | null>(null);
  const [editPromoForm, setEditPromoForm] = useState({ title: "", subtitle: "", location: "", event_link: "" });
  const [editPromoBgFile, setEditPromoBgFile] = useState<File | null>(null);
  const [editPromoBgPreview, setEditPromoBgPreview] = useState<string | null>(null);

  const handleDeletePromoted = async (id: string) => {
    await supabase.from("promoted_events").delete().eq("id", id);
    setPromotedEvents(promotedEvents.filter(p => p.id !== id));
  };

  const startEditPromo = (pe: any) => {
    setEditingPromoId(pe.id);
    setEditPromoForm({ title: pe.title, subtitle: pe.subtitle || "", location: pe.location || "", event_link: pe.event_link || "" });
    setEditPromoBgFile(null);
    setEditPromoBgPreview(null);
  };

  const handleEditPromoBgSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setEditPromoBgFile(file);
    const reader = new FileReader();
    reader.onload = () => setEditPromoBgPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleSaveEditPromo = async (id: string) => {
    let backgroundUrl: string | undefined;
    if (editPromoBgFile) {
      const ext = editPromoBgFile.name.split(".").pop() || "jpg";
      const path = `promoted/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("event-images").upload(path, editPromoBgFile, { upsert: true });
      if (!error) {
        const { data } = supabase.storage.from("event-images").getPublicUrl(path);
        backgroundUrl = data.publicUrl;
      }
    }
    const updates: any = {
      title: editPromoForm.title,
      subtitle: editPromoForm.subtitle,
      location: editPromoForm.location,
      event_link: editPromoForm.event_link,
    };
    if (backgroundUrl) updates.background_url = backgroundUrl;
    const { data } = await supabase.from("promoted_events").update(updates).eq("id", id).select().single();
    if (data) {
      setPromotedEvents(promotedEvents.map(p => p.id === id ? data : p));
    }
    setEditingPromoId(null);
  };

  useEffect(() => {
    if (!isAdmin) return;

    const fetchStats = async () => {
      const [profilesRes, orgsRes, eventsRes, ticketTypesRes, ordersRes, seatsRes] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("organizations").select("id, name, avatar_url, slug, type, created_by, created_at, region, country, state, socials, links"),
        supabase.from("events").select("id, title, flyer_url, category, organization_id, status, date, end_date, city, sales_disabled, event_type"),
        supabase.from("ticket_types").select("id, event_id, sold, quantity, price"),
        supabase.from("orders").select("created_at, event_id, unit_price, quantity, service_fee, discount, refunded_amount, total"),
        supabase.from("seats").select("event_id, blocked, status"),
      ]);

      const totalUsers = profilesRes.count || 0;
      const orgs = orgsRes.data || [];
      const events = eventsRes.data || [];
      const ticketTypes = ticketTypesRes.data || [];

      // Build seat counts per event (excluding blocked seats)
      const seatCountByEvent = new Map<string, { total: number; sold: number }>();
      (seatsRes.data || []).forEach((s: any) => {
        if (s.blocked) return;
        const existing = seatCountByEvent.get(s.event_id) || { total: 0, sold: 0 };
        existing.total += 1;
        if (s.status === "sold") existing.sold += 1;
        seatCountByEvent.set(s.event_id, existing);
      });

      // Identify seated events
      const seatedEventIds = new Set(events.filter((e: any) => e.event_type === "seated").map((e: any) => e.id));

      const eventRevMap = new Map<string, { sold: number; total: number; revenue: number }>();
      ticketTypes.forEach((tt) => {
        const existing = eventRevMap.get(tt.event_id) || { sold: 0, total: 0, revenue: 0 };
        const price = parseFloat(tt.price) || 0;
        existing.sold += tt.sold;
        existing.total += tt.quantity;
        existing.revenue += tt.sold * price;
        eventRevMap.set(tt.event_id, existing);
      });

      // Override totals for seated events with actual seat counts
      seatedEventIds.forEach((eventId) => {
        const seatData = seatCountByEvent.get(eventId);
        if (seatData) {
          const existing = eventRevMap.get(eventId) || { sold: 0, total: 0, revenue: 0 };
          existing.total = seatData.total;
          existing.sold = seatData.sold;
          eventRevMap.set(eventId, existing);
        }
      });

      // Calculate net platform revenue from orders
      const allOrders = (ordersRes.data || []) as { created_at: string; event_id: string; unit_price: number; quantity: number; service_fee: number; discount?: number; refunded_amount?: number; total: number }[];
      const revenueByEvent = new Map<string, number>();
      allOrders.forEach((order) => {
        revenueByEvent.set(order.event_id, (revenueByEvent.get(order.event_id) || 0) + getNetOrderRevenue(order));
      });

      let totalRevenue = 0;
      revenueByEvent.forEach((value) => {
        totalRevenue += value;
      });

      const { totalServiceFees: _tsf, totalStripeFees: _tstr, netPlatformRevenue } = aggregateFinancials(allOrders);

      // Build daily platform revenue for line chart (use local timezone)
      const dailyMap = new Map<string, typeof allOrders>();
      allOrders.forEach((o) => {
        const day = format(new Date(o.created_at), "yyyy-MM-dd");
        const arr = dailyMap.get(day) || [];
        arr.push(o);
        dailyMap.set(day, arr);
      });

      const now = new Date();
      const earliest = allOrders.length > 0
        ? new Date(allOrders.reduce((min, o) => o.created_at < min ? o.created_at : min, allOrders[0].created_at))
        : subDays(now, 30);
      const days = eachDayOfInterval({ start: earliest, end: now });
      const dailyData = days.map((d) => {
        const key = format(d, "yyyy-MM-dd");
        const dayOrders = dailyMap.get(key) || [];
        const dayAgg = aggregateFinancials(dayOrders);
        return { date: format(d, "MMM dd"), revenue: parseFloat(dayAgg.netPlatformRevenue.toFixed(2)) };
      });
      setDailyPlatformRevenue(dailyData);

      const orgNameMap = new Map<string, string>();
      const orgAvatarMap = new Map<string, string | null>();
      const orgSlugMap = new Map<string, string>();
      orgs.forEach((o) => { orgNameMap.set(o.id, o.name); orgAvatarMap.set(o.id, o.avatar_url); orgSlugMap.set(o.id, o.slug); });

      const allEventStats: EventStat[] = events
        .map((e) => {
          const rev = eventRevMap.get(e.id) || { sold: 0, total: 0, revenue: 0 };
          return { id: e.id, title: e.title, flyer_url: e.flyer_url, category: e.category, ticketsSold: rev.sold, totalTickets: rev.total, revenue: revenueByEvent.get(e.id) || 0, orgName: orgNameMap.get(e.organization_id) || "Unknown", orgAvatarUrl: orgAvatarMap.get(e.organization_id) || null, orgSlug: orgSlugMap.get(e.organization_id) || "", status: e.status, date: e.date, end_date: e.end_date || null, city: e.city || "", salesDisabled: !!(e as any).sales_disabled };
        })
        .sort((a, b) => b.revenue - a.revenue);

      // Compute per-org revenue and attendees
      const orgRevenue = new Map<string, number>();
      const orgAttendees = new Map<string, number>();
      const orgEventCount = new Map<string, number>();
      events.forEach((e) => {
        orgEventCount.set(e.organization_id, (orgEventCount.get(e.organization_id) || 0) + 1);
        const rev = eventRevMap.get(e.id) || { sold: 0, total: 0, revenue: 0 };
        orgRevenue.set(e.organization_id, (orgRevenue.get(e.organization_id) || 0) + (revenueByEvent.get(e.id) || 0));
        orgAttendees.set(e.organization_id, (orgAttendees.get(e.organization_id) || 0) + rev.sold);
      });

      // Fetch owner names
      const ownerIds = [...new Set(orgs.map(o => o.created_by))];
      const { data: ownerProfiles } = ownerIds.length > 0
        ? await supabase.from("profiles").select("user_id, name").in("user_id", ownerIds)
        : { data: [] };
      const ownerNameMap = new Map<string, string>();
      (ownerProfiles || []).forEach(p => ownerNameMap.set(p.user_id, p.name));

      const allOrgStats: OrgStat[] = orgs
        .map((o) => ({
          id: o.id,
          name: o.name,
          avatar_url: o.avatar_url,
          slug: o.slug,
          type: o.type,
          eventCount: orgEventCount.get(o.id) || 0,
          ownerName: ownerNameMap.get(o.created_by) || "Unknown",
          ownerUserId: o.created_by,
          totalRevenue: orgRevenue.get(o.id) || 0,
          totalAttendees: orgAttendees.get(o.id) || 0,
          createdAt: o.created_at,
          region: (o as any).region || "",
          country: (o as any).country || "",
          state: (o as any).state || "",
          socials: (o as any).socials || {},
          links: (o as any).links || [],
          created_by: o.created_by,
        }))
        .sort((a, b) => b.totalRevenue - a.totalRevenue);

      setStats({ totalUsers, totalOrgs: orgs.length, totalEvents: events.length, totalRevenue, netPlatformRevenue });
      setTopEvents(allEventStats.slice(0, 3));
      setTopOrgs(allOrgStats.slice(0, 5));
      setAllOrgs(allOrgStats);
      setAllEvents(allEventStats);
    };

    fetchStats();
  }, [isAdmin, activeTab]);

  // Handle ?event=ID query param to deep-link into Detailed Event Screen
  useEffect(() => {
    const eventId = searchParams.get("event");
    if (eventId && allEvents.length > 0) {
      const match = allEvents.find(e => e.id === eventId);
      if (match) {
        setActiveTab("EVENTS");
        setSelectedEvent(match);
        // Clean up the query param
        searchParams.delete("event");
        setSearchParams(searchParams, { replace: true });
      }
    }
  }, [allEvents, searchParams, setSearchParams]);

  if (checking || !isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground font-bold uppercase tracking-widest text-xs">
          Verifying access...
        </div>
      </div>
    );
  }

  const formatCurrency = (val: number) =>
    val.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 });

  const soldPercent = (sold: number, total: number) => {
    if (total === 0) return "0%";
    const pct = Math.round((sold / total) * 100);
    return pct >= 100 ? "SOLD OUT" : `${pct}% SOLD`;
  };

  const platformRevenueFormatted = formatCurrency(stats.netPlatformRevenue);

  return (
    <div className="flex min-h-screen bg-white dark:bg-[#0e0e0e]">
      {/* Sidebar */}
      <aside className="fixed left-0 top-0 h-full w-64 bg-white dark:bg-[#0e0e0e] flex flex-col border-r border-gray-100 dark:border-gray-900 shadow-[40px_0_60px_-15px_rgba(0,0,0,0.05)] z-50">
        <div className="p-8">
          <Link to="/">
            <img src={brazouLogo} alt="Brazou" className="h-6" />
          </Link>
        </div>
        <nav className="flex-1 px-4 space-y-1">
          {navItems.map((item) => {
            const isActive = activeTab === item.tab || (item.children?.some(c => c.tab === activeTab));
            return (
              <div key={item.label}>
                <button
                  onClick={() => setActiveTab(item.tab)}
                  className={`w-full py-4 px-6 flex items-center space-x-4 transition-all ${
                    isActive
                      ? "bg-brand-pink text-white rounded-r-full translate-x-1"
                      : "text-gray-400 dark:text-gray-600 hover:text-black dark:hover:text-white hover:bg-gray-50 dark:hover:bg-[#131313]"
                  }`}
                >
                  <item.icon className="w-5 h-5" />
                  <span className="font-black uppercase tracking-widest text-[10px]">{item.label}</span>
                </button>
                {item.children && isActive && (
                  <div className="ml-8 mt-1 space-y-1">
                    {item.children.map((child) => (
                      <button
                        key={child.label}
                        onClick={() => setActiveTab(child.tab)}
                        className={`w-full py-2.5 px-4 flex items-center space-x-3 transition-all rounded-lg text-left ${
                          activeTab === child.tab
                            ? "bg-brand-pink/20 text-brand-pink"
                            : "text-gray-400 hover:text-on-background hover:bg-gray-50 dark:hover:bg-[#131313]"
                        }`}
                      >
                        <child.icon className="w-4 h-4" />
                        <span className="font-black uppercase tracking-widest text-[10px]">{child.label}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
        <div className="p-8 border-t border-gray-100 dark:border-gray-900">
          <div className="mb-6">
            <p className="font-black uppercase tracking-widest text-[10px] text-gray-400 mb-1">Status</p>
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 rounded-full bg-brand-lime animate-pulse" />
              <span className="text-xs font-bold uppercase tracking-widest text-on-background">System Live</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="ml-64 flex-1 min-h-screen p-12 bg-white dark:bg-background">
        <header className="flex justify-between items-center w-full mb-16">
          <div>
            <span className="font-bold uppercase tracking-[0.3em] text-[10px] text-brand-pink mb-2 block">
              System Overview
            </span>
            <h1 className="text-7xl lg:text-8xl font-black tracking-tighter text-on-background">ADMIN</h1>
          </div>
          <div className="flex items-center space-x-6">
            <div className="text-right">
              <p className="font-black uppercase tracking-widest text-[10px] text-on-background">
                {user?.name || "Admin"}
              </p>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">High-Octane Control</p>
            </div>
            <div className="w-14 h-14 rounded-full bg-surface-container overflow-hidden border-2 border-brand-pink">
              {user?.avatarUrl ? (
                <img className="w-full h-full object-cover" src={user.avatarUrl} alt={user.name} />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-brand-pink text-white font-bold text-lg">
                  {user?.name?.[0]?.toUpperCase() || "A"}
                </div>
              )}
            </div>
          </div>
        </header>

        {/* OVERVIEW Tab */}
        {activeTab === "OVERVIEW" && (
          <div className="grid grid-cols-12 gap-8">
            <section className="col-span-8 bg-gray-50 dark:bg-surface p-10 rounded-[3rem] relative overflow-hidden group">
              <div className="flex justify-between items-start mb-12 relative z-10">
                <div>
                  <span className="font-bold uppercase tracking-[0.2em] text-[10px] text-brand-pink mb-1 block">Financial Performance</span>
                  <h2 className="text-4xl font-black tracking-tighter text-on-background">{platformRevenueFormatted}</h2>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mt-2">Total platform revenue</p>
                </div>
                <div className="flex items-center space-x-3">
                  <Link to="/dashboard" className="px-5 py-2.5 rounded-full bg-brand-lime text-black font-black uppercase tracking-widest text-[10px] hover:brightness-110 transition-all">Go to Finance Dashboard</Link>
                  <button className="p-2 rounded-full bg-white dark:bg-surface text-on-background hover:bg-brand-pink hover:text-white transition-all"><Download className="w-4 h-4" /></button>
                </div>
              </div>
              <div className="h-64 relative z-10">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={dailyPlatformRevenue}>
                    <defs>
                      <linearGradient id="overviewPlatformGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(var(--brand-pink))" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="hsl(var(--brand-pink))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#9ca3af", fontWeight: 700 }} tickLine={false} axisLine={false} interval={Math.max(0, Math.floor(dailyPlatformRevenue.length / 8))} />
                    <YAxis tick={{ fontSize: 10, fill: "#9ca3af" }} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v}`} width={50} />
                    <RechartsTooltip
                      contentStyle={{ background: "#000", border: "none", borderRadius: 12, padding: "8px 14px" }}
                      itemStyle={{ color: "#fff", fontSize: 12, fontWeight: 700 }}
                      labelStyle={{ color: "#9ca3af", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em" }}
                      formatter={(value: number) => [`$${value.toFixed(2)}`, "Platform Revenue"]}
                    />
                    <Line type="monotone" dataKey="revenue" stroke="hsl(var(--brand-pink))" strokeWidth={2.5} dot={false} activeDot={{ r: 5, fill: "hsl(var(--brand-pink))", stroke: "#fff", strokeWidth: 2 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </section>
            <div className="col-span-4 space-y-8">
              <div className="bg-[#0e0e0e] dark:bg-inverse-surface p-10 rounded-[3rem] text-white">
                <Users className="w-8 h-8 text-brand-lime mb-6" />
                <span className="font-bold uppercase tracking-[0.2em] text-[10px] text-gray-400 block mb-1">Global Community</span>
                <h3 className="text-6xl font-black tracking-tighter">{stats.totalUsers > 1000 ? `${(stats.totalUsers / 1000).toFixed(1)}k` : stats.totalUsers}</h3>
                <p className="text-[10px] font-bold uppercase tracking-widest text-brand-lime mt-4">Total Users</p>
              </div>
              <div className="bg-gray-100 dark:bg-surface-container p-10 rounded-[3rem]">
                <Briefcase className="w-8 h-8 text-brand-pink mb-6" />
                <span className="font-bold uppercase tracking-[0.2em] text-[10px] text-gray-500 block mb-1">Verified Partners</span>
                <h3 className="text-6xl font-black tracking-tighter text-on-background">{stats.totalOrgs}</h3>
                <p className="text-[10px] font-bold uppercase tracking-widest text-brand-pink mt-4">Total Organizations</p>
              </div>
            </div>
            <section className="col-span-12 mt-16">
              <div className="flex justify-between items-end mb-10">
                <div>
                  <span className="font-bold uppercase tracking-[0.2em] text-[10px] text-brand-pink mb-1 block">Live Velocity</span>
                  <h2 className="text-5xl font-black tracking-tighter text-on-background">Top Performance Events</h2>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-8">
                {topEvents.length === 0 && <p className="col-span-3 text-center text-muted-foreground py-20 text-sm">No events yet</p>}
                {topEvents.map((event) => (
                  <div key={event.id} className="group relative bg-white dark:bg-surface rounded-[2rem] overflow-hidden border border-gray-100 dark:border-gray-800 cursor-pointer" onClick={() => { const match = allEvents.find(e => e.id === event.id) || event; setActiveTab("EVENTS"); setSelectedEvent(match); }}>
                    <div className="h-80 overflow-hidden bg-black">
                      {event.flyer_url ? <img className="w-full h-full object-cover grayscale opacity-60 group-hover:scale-110 group-hover:opacity-100 transition-all duration-700" src={event.flyer_url} alt={event.title} /> : <div className="w-full h-full bg-gradient-to-br from-gray-800 to-gray-900" />}
                    </div>
                    <div className="absolute top-6 left-6"><span className="bg-brand-lime text-black font-black uppercase tracking-widest text-[10px] px-3 py-1 rounded-full">{soldPercent(event.ticketsSold, event.totalTickets)}</span></div>
                     <div className="p-8">
                       <Link to={`/org/${event.orgSlug}`} className="flex items-center gap-2 mb-2 group/org hover:opacity-80 transition-opacity">
                         {event.orgAvatarUrl ? (
                           <img src={event.orgAvatarUrl} alt={event.orgName} className="w-5 h-5 rounded-full object-cover ring-1 ring-gray-200 dark:ring-gray-700" />
                         ) : (
                           <div className="w-5 h-5 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                             <span className="text-[8px] font-black text-gray-500">{event.orgName[0]}</span>
                           </div>
                         )}
                         <span className="font-bold uppercase tracking-[0.2em] text-[9px] text-gray-400 group-hover/org:text-brand-pink transition-colors">{event.orgName}</span>
                       </Link>
                      <h4 className="text-2xl font-black tracking-tighter text-on-background uppercase">{event.title || "Untitled"}</h4>
                      <div className="flex justify-between items-center mt-6">
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{event.ticketsSold} sold</span>
                        <span className="font-black uppercase tracking-widest text-[10px] text-brand-pink">{formatCurrency(event.revenue)} Rev.</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
            <section className="col-span-12 mt-20">
              <div className="flex justify-between items-end mb-10">
                <div>
                  <span className="font-bold uppercase tracking-[0.2em] text-[10px] text-brand-pink mb-1 block">Network Power</span>
                  <h2 className="text-5xl font-black tracking-tighter text-on-background">Top Organizers</h2>
                </div>
              </div>
              <div className="grid grid-cols-5 gap-6">
                {topOrgs.length === 0 && <p className="col-span-5 text-center text-muted-foreground py-20 text-sm">No organizations yet</p>}
                {topOrgs.map((org) => (
                  <div key={org.id} onClick={() => { const match = allOrgs.find(o => o.id === org.id) || org; setActiveTab("ORGANIZATIONS"); setSelectedOrg(match); }} className="group bg-white dark:bg-surface rounded-[2rem] overflow-hidden border border-gray-100 dark:border-gray-800 hover:border-brand-pink transition-colors cursor-pointer">
                    <div className="h-52 overflow-hidden bg-black">
                      {org.avatar_url ? <img className="w-full h-full object-cover grayscale group-hover:scale-105 transition-transform duration-700 opacity-70 group-hover:opacity-100" src={org.avatar_url} alt={org.name} /> : <div className="w-full h-full bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center"><span className="text-4xl font-black text-gray-600">{org.name[0]}</span></div>}
                    </div>
                    <div className="p-6">
                      <span className="font-bold uppercase tracking-[0.2em] text-[9px] text-gray-400 block mb-1">{org.type.replace("_", " ")}</span>
                      <h4 className="text-lg font-black tracking-tighter text-on-background uppercase truncate">{org.name}</h4>
                      <p className="text-xl font-black text-brand-pink tabular-nums mt-2">{org.totalRevenue.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 })}</p>
                      <div className="mt-3 pt-3 border-t border-gray-50 dark:border-gray-800 flex justify-between items-center">
                        <span className="font-black uppercase tracking-widest text-[10px] text-muted-foreground">{org.eventCount} Events</span>
                        <ArrowRight className="w-4 h-4 text-gray-200 group-hover:text-brand-pink transition-colors" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}

        {/* EVENTS Tab */}
        {activeTab === "EVENTS" && (() => {
          const now = new Date();
          const filtered = allEvents.filter((ev) => {
            const matchesSearch = !eventSearch || ev.title.toLowerCase().includes(eventSearch.toLowerCase()) || ev.orgName.toLowerCase().includes(eventSearch.toLowerCase());
            if (!matchesSearch) return false;
            if (eventDateFilter) {
              if (!ev.date) return false;
              const evMonth = ev.date.slice(0, 7);
              if (evMonth !== eventDateFilter) return false;
            }
            if (eventFilter === "ALL") return true;
            const endDateRaw = ev.end_date || ev.date;
            const endDate = endDateRaw ? new Date(endDateRaw + "T23:59:59") : null;
            const hasEnded = endDate ? endDate < now : false;
            if (eventFilter === "LIVE") return ev.status === "live" && !hasEnded;
            if (eventFilter === "PAST") return hasEnded;
            return true;
          });
          const totalFilteredRevenue = filtered.reduce((s, e) => s + e.revenue, 0);
          const totalFilteredAttendees = filtered.reduce((s, e) => s + e.ticketsSold, 0);

          const toggleSort = (col: typeof sortColumn) => {
            if (sortColumn === col) {
              setSortDir(d => d === "asc" ? "desc" : "asc");
            } else {
              setSortColumn(col);
              setSortDir("asc");
            }
          };

          const sorted = [...filtered].sort((a, b) => {
            if (!sortColumn) return 0;
            const dir = sortDir === "asc" ? 1 : -1;
            if (sortColumn === "title") return dir * (a.title || "").localeCompare(b.title || "");
            if (sortColumn === "date") return dir * ((a.date || "").localeCompare(b.date || ""));
            if (sortColumn === "orgName") return dir * a.orgName.localeCompare(b.orgName);
            if (sortColumn === "ticketsSold") return dir * (a.ticketsSold - b.ticketsSold);
            if (sortColumn === "city") return dir * (a.city || "").localeCompare(b.city || "");
            if (sortColumn === "revenue") return dir * (a.revenue - b.revenue);
            return 0;
          });

          const SortIcon = ({ col }: { col: typeof sortColumn }) => {
            if (sortColumn !== col) return <ArrowUpDown className="w-3 h-3 ml-1 inline opacity-30" />;
            return sortDir === "asc" ? <ArrowUp className="w-3 h-3 ml-1 inline text-brand-pink" /> : <ArrowDown className="w-3 h-3 ml-1 inline text-brand-pink" />;
          };
          if (selectedEvent) {
            return <AdminEventDetail event={selectedEvent} onBack={() => setSelectedEvent(null)} />;
          }
          return (
          <div>
            <div className="flex justify-between items-end mb-10">
              <div>
                <span className="font-bold uppercase tracking-[0.2em] text-[10px] text-brand-pink mb-1 block">Platform Events</span>
                <h2 className="text-5xl font-black tracking-tighter text-on-background">All Events</h2>
              </div>
              <p className="text-sm font-bold text-gray-400">{filtered.length} of {allEvents.length} events</p>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-3 gap-6 mb-8">
              <div className="bg-[#0e0e0e] dark:bg-inverse-surface p-8 rounded-[2rem] text-white">
                <Ticket className="w-6 h-6 text-brand-lime mb-3" />
                <span className="font-bold uppercase tracking-[0.2em] text-[10px] text-gray-400 block mb-1">Total Live Events</span>
                <h3 className="text-3xl font-black tracking-tighter">{filtered.filter(e => e.status === "live").length}</h3>
              </div>
              <div className="bg-gray-50 dark:bg-surface p-8 rounded-[2rem]">
                <CalendarDays className="w-6 h-6 text-brand-pink mb-3" />
                <span className="font-bold uppercase tracking-[0.2em] text-[10px] text-gray-500 block mb-1">Total Events</span>
                <h3 className="text-3xl font-black tracking-tighter text-on-background">{allEvents.length}</h3>
              </div>
              <div className="bg-gray-50 dark:bg-surface p-8 rounded-[2rem]">
                <Building2 className="w-6 h-6 text-brand-pink mb-3" />
                <span className="font-bold uppercase tracking-[0.2em] text-[10px] text-gray-500 block mb-1">Organizers</span>
                <h3 className="text-3xl font-black tracking-tighter text-on-background">{new Set(filtered.map(e => e.orgSlug)).size}</h3>
              </div>
            </div>

            {/* Search + Filters */}
            <div className="flex items-center gap-4 mb-6">
              <div className="flex-1 relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search events or organizers..."
                  value={eventSearch}
                  onChange={(e) => setEventSearch(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 rounded-full bg-gray-50 dark:bg-surface border border-gray-100 dark:border-gray-800 text-sm font-bold text-on-background placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-pink/40"
                />
              </div>
              <input
                type="month"
                value={eventDateFilter}
                onChange={(e) => setEventDateFilter(e.target.value)}
                className="px-4 py-3 rounded-full bg-gray-50 dark:bg-surface border border-gray-100 dark:border-gray-800 text-sm font-bold text-on-background focus:outline-none focus:ring-2 focus:ring-brand-pink/40"
              />
              {eventDateFilter && (
                <button onClick={() => setEventDateFilter("")} className="px-3 py-3 rounded-full bg-gray-100 dark:bg-surface text-gray-400 hover:text-on-background text-[10px] font-black uppercase tracking-widest">Clear</button>
              )}
              <div className="flex gap-2">
                {(["ALL", "LIVE", "PAST"] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setEventFilter(f)}
                    className={`px-5 py-3 rounded-full font-black uppercase tracking-widest text-[10px] transition-all ${
                      eventFilter === f
                        ? "bg-brand-pink text-white"
                        : "bg-gray-100 dark:bg-surface text-gray-400 hover:text-on-background"
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>

            {/* Table */}
            <div className="bg-white dark:bg-surface rounded-[2rem] border border-gray-100 dark:border-gray-800 overflow-hidden">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-gray-800">
                    <th onClick={() => toggleSort("title")} className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 cursor-pointer select-none hover:text-on-background transition-colors">Event <SortIcon col="title" /></th>
                    <th onClick={() => toggleSort("date")} className="px-6 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 cursor-pointer select-none hover:text-on-background transition-colors">Date <SortIcon col="date" /></th>
                    <th onClick={() => toggleSort("orgName")} className="px-6 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 cursor-pointer select-none hover:text-on-background transition-colors">Organizer <SortIcon col="orgName" /></th>
                    <th className="px-6 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Status</th>
                    <th onClick={() => toggleSort("ticketsSold")} className="px-6 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 cursor-pointer select-none hover:text-on-background transition-colors">Attendees <SortIcon col="ticketsSold" /></th>
                    <th onClick={() => toggleSort("city")} className="px-6 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 cursor-pointer select-none hover:text-on-background transition-colors">Location <SortIcon col="city" /></th>
                    <th className="px-6 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 text-right cursor-pointer select-none hover:text-on-background transition-colors">Revenue <SortIcon col="revenue" /></th>
                    <th className="px-4 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                  {filtered.length === 0 && <tr><td colSpan={8} className="px-8 py-16 text-center text-gray-400 text-sm">No events found</td></tr>}
                  {sorted.map((ev) => {
                    const isLive = ev.status === "live";
                    const eventDate = ev.date ? new Date(ev.date + "T00:00:00") : null;
                    const endDateRaw = ev.end_date || ev.date;
                    const endDate = endDateRaw ? new Date(endDateRaw + "T23:59:59") : null;
                    const hasEnded = endDate ? endDate < now : false;
                    const isPast = hasEnded || (eventDate && eventDate < now && !isLive);
          return (
                    <tr key={ev.id} className="group hover:bg-gray-50 dark:hover:bg-surface-container transition-colors cursor-pointer" onClick={() => setSelectedEvent(ev)}>
                      <td className="px-8 py-5">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-xl overflow-hidden flex-shrink-0 bg-gray-100 dark:bg-surface-container">
                            {ev.flyer_url ? <img src={ev.flyer_url} alt={ev.title} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><CalendarDays className="w-5 h-5 text-gray-300" /></div>}
                          </div>
                          <div>
                            <span className="font-black text-on-background uppercase tracking-tight block">{ev.title || "Untitled"}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        {eventDate ? (
                          <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">{eventDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                        ) : (
                          <span className="text-[11px] text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-6 py-5">
                        <Link to={`/org/${ev.orgSlug}`} className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                          {ev.orgAvatarUrl ? (
                            <img src={ev.orgAvatarUrl} alt={ev.orgName} className="w-6 h-6 rounded-full object-cover ring-1 ring-gray-200 dark:ring-gray-700" />
                          ) : (
                            <div className="w-6 h-6 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                              <span className="text-[8px] font-black text-gray-500">{ev.orgName[0]}</span>
                            </div>
                          )}
                          <span className="font-bold text-[11px] text-gray-500 uppercase tracking-wider hover:text-brand-pink transition-colors">{ev.orgName}</span>
                        </Link>
                      </td>
                      <td className="px-6 py-5">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full font-black uppercase tracking-widest text-[10px] ${
                          isLive ? "bg-brand-lime/20 text-brand-lime" : isPast ? "bg-gray-100 dark:bg-gray-800 text-gray-400" : "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600"
                        }`}>
                          {isPast && <div className="w-1.5 h-1.5 rounded-full bg-gray-400" />}
                          {isLive && !hasEnded && <div className="w-1.5 h-1.5 rounded-full bg-brand-lime animate-pulse" />}
                          {hasEnded ? "ENDED" : isLive ? "LIVE" : isPast ? "PAST" : ev.status === "sold_out" ? "SOLD OUT" : "DRAFT"}
                        </span>
                      </td>
                      <td className="px-6 py-5">
                        <span className="font-black text-on-background">{ev.ticketsSold}</span>
                        <span className="text-[10px] text-gray-400 ml-1">/ {ev.totalTickets}</span>
                      </td>
                      <td className="px-6 py-5">
                        <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">{ev.city || "—"}</span>
                      </td>
                      <td className="px-6 py-5 text-right font-black text-brand-pink">{formatCurrency(ev.revenue)}</td>
                      <td className="px-4 py-5 text-right" onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-surface-container transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100">
                              <MoreVertical className="w-4 h-4 text-gray-400" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-52">
                            <DropdownMenuItem asChild>
                              <Link to={`/dashboard/${ev.orgSlug}/event/${ev.id}`} className="flex items-center gap-2 cursor-pointer">
                                <Pencil className="w-4 h-4" />
                                Edit Event Page
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="flex items-center gap-2 cursor-pointer text-destructive focus:text-destructive"
                              onClick={async () => {
                                if (!confirm("Cancel this event? This will set the status to cancelled.")) return;
                                await supabase.from("events").update({ status: "cancelled" as any }).eq("id", ev.id);
                                setAllEvents(allEvents.map(e => e.id === ev.id ? { ...e, status: "cancelled" as any } : e));
                              }}
                            >
                              <XCircle className="w-4 h-4" />
                              Cancel Event
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="flex items-center gap-2 cursor-pointer"
                              onClick={async () => {
                                const newStatus = ev.status === "draft" ? "live" : "draft";
                                await supabase.from("events").update({ status: newStatus }).eq("id", ev.id);
                                setAllEvents(allEvents.map(e => e.id === ev.id ? { ...e, status: newStatus } : e));
                              }}
                            >
                              <EyeOff className="w-4 h-4" />
                              {ev.status === "draft" ? "Show on Explorer" : "Hide from Explorer"}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className={`flex items-center gap-2 cursor-pointer ${ev.salesDisabled ? "text-brand-lime" : "text-orange-500"} focus:text-orange-500`}
                              onClick={() => setDisableSalesConfirm(ev)}
                            >
                              <Ban className="w-4 h-4" />
                              {ev.salesDisabled ? "Enable Event Sales" : "Disable Event Sales"}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Revenue Ranking - Top 10 */}
            <section className="mt-12">
              <h3 className="text-2xl font-black tracking-tighter text-on-background mb-6">Revenue Ranking — Top 10</h3>
              <div className="bg-white dark:bg-surface rounded-[2rem] border border-gray-100 dark:border-gray-800 overflow-hidden">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-gray-100 dark:border-gray-800">
                      <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">#</th>
                      <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Event</th>
                      <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Sold</th>
                      <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 text-right">Revenue</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                    {[...allEvents].sort((a, b) => b.revenue - a.revenue).slice(0, 10).map((ev, idx) => (
                      <tr key={ev.id} className="hover:bg-gray-50 dark:hover:bg-surface-container transition-colors">
                        <td className="px-8 py-5 font-black text-brand-pink">{idx + 1}</td>
                        <td className="px-8 py-5 font-black text-on-background uppercase tracking-tight">{ev.title || "Untitled"}</td>
                        <td className="px-8 py-5 text-on-background">{ev.ticketsSold} / {ev.totalTickets}</td>
                        <td className="px-8 py-5 text-right font-black text-brand-pink">{formatCurrency(ev.revenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
          );
        })()}

        {/* PROMOTED EVENTS Tab */}
        {activeTab === "EVENTS_ANALYTICS" && (
          <div>
            <div className="flex justify-between items-end mb-10">
              <div>
                <span className="font-bold uppercase tracking-[0.2em] text-[10px] text-brand-pink mb-1 block">Featured Content</span>
                <h2 className="text-5xl font-black tracking-tighter text-on-background">Promoted Events</h2>
              </div>
              <p className="text-sm font-bold text-gray-400">{promotedEvents.length} active</p>
            </div>

            {/* Sub-tab Navigation */}
            <div className="flex items-center gap-2 mb-10">
              {(["homepage", "explorer"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setPromoSubTab(tab)}
                  className={cn(
                    "px-6 py-3 rounded-full font-black uppercase tracking-widest text-[10px] transition-all",
                    promoSubTab === tab
                      ? "bg-brand-pink text-white"
                      : "bg-secondary text-muted-foreground hover:bg-brand-pink/10 hover:text-brand-pink"
                  )}
                >
                  {tab === "homepage" ? "Homepage" : "Explorer"}
                </button>
              ))}
            </div>

            {promoSubTab === "explorer" ? (
              <>
              {/* Add New Explorer Promoted Event Form */}
              <div className="bg-white dark:bg-surface rounded-[2rem] border border-gray-100 dark:border-gray-800 p-8 mb-8">
                <h3 className="text-lg font-black tracking-tight text-on-background mb-6 uppercase">Add Explorer Promoted Event</h3>
                <div className="grid grid-cols-2 gap-6 mb-6">
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mb-2">Event Name *</label>
                    <input type="text" value={explorerPromoForm.title} onChange={e => setExplorerPromoForm({ ...explorerPromoForm, title: e.target.value })} placeholder="e.g. Carnaval Electrônico 2024" className="w-full px-5 py-3 rounded-xl bg-gray-50 dark:bg-surface-container border border-gray-100 dark:border-gray-800 text-sm font-bold text-on-background placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-pink/40" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mb-2">Subtitle</label>
                    <input type="text" value={explorerPromoForm.subtitle} onChange={e => setExplorerPromoForm({ ...explorerPromoForm, subtitle: e.target.value })} placeholder="e.g. Experience the rhythmic heart of Rio" className="w-full px-5 py-3 rounded-xl bg-gray-50 dark:bg-surface-container border border-gray-100 dark:border-gray-800 text-sm font-bold text-on-background placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-pink/40" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mb-2">Location</label>
                    <input type="text" value={explorerPromoForm.location} onChange={e => setExplorerPromoForm({ ...explorerPromoForm, location: e.target.value })} placeholder="e.g. Rio de Janeiro" className="w-full px-5 py-3 rounded-xl bg-gray-50 dark:bg-surface-container border border-gray-100 dark:border-gray-800 text-sm font-bold text-on-background placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-pink/40" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mb-2">Event Link</label>
                    <input type="text" value={explorerPromoForm.event_link} onChange={e => setExplorerPromoForm({ ...explorerPromoForm, event_link: e.target.value })} placeholder="e.g. /event/abc123 or https://..." className="w-full px-5 py-3 rounded-xl bg-gray-50 dark:bg-surface-container border border-gray-100 dark:border-gray-800 text-sm font-bold text-on-background placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-pink/40" />
                  </div>
                </div>
                <div className="mb-6">
                  <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mb-2">Background Image</label>
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 px-5 py-3 rounded-xl bg-gray-50 dark:bg-surface-container border border-gray-100 dark:border-gray-800 text-sm font-bold text-gray-500 cursor-pointer hover:border-brand-pink transition-colors">
                      <ImageIcon className="w-4 h-4" />
                      <span>{explorerPromoBgFile ? explorerPromoBgFile.name : "Choose image..."}</span>
                      <input type="file" accept="image/*" onChange={(e) => { const file = e.target.files?.[0]; if (!file) return; setExplorerPromoBgFile(file); const reader = new FileReader(); reader.onload = () => setExplorerPromoBgPreview(reader.result as string); reader.readAsDataURL(file); }} className="hidden" />
                    </label>
                    {explorerPromoBgPreview && (
                      <div className="w-20 h-12 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
                        <img src={explorerPromoBgPreview} alt="Preview" className="w-full h-full object-cover" />
                      </div>
                    )}
                  </div>
                </div>
                <button
                  onClick={async () => {
                    if (!explorerPromoForm.title.trim()) return;
                    setExplorerPromoSaving(true);
                    let backgroundUrl = explorerPromoForm.background_url;
                    if (explorerPromoBgFile) {
                      const ext = explorerPromoBgFile.name.split(".").pop() || "jpg";
                      const path = `promoted/${crypto.randomUUID()}.${ext}`;
                      const { error } = await supabase.storage.from("event-images").upload(path, explorerPromoBgFile, { upsert: true });
                      if (!error) { const { data } = supabase.storage.from("event-images").getPublicUrl(path); backgroundUrl = data.publicUrl; }
                    }
                    const { data, error } = await supabase.from("promoted_events").insert({ title: explorerPromoForm.title, subtitle: explorerPromoForm.subtitle, location: explorerPromoForm.location, event_link: explorerPromoForm.event_link, background_url: backgroundUrl || null, sort_order: explorerPromotedEvents.length, placement: "explorer" }).select().single();
                    if (!error && data) {
                      setExplorerPromotedEvents([...explorerPromotedEvents, data]);
                      setExplorerPromoForm({ title: "", subtitle: "", location: "", event_link: "", background_url: "" });
                      setExplorerPromoBgFile(null);
                      setExplorerPromoBgPreview(null);
                    }
                    setExplorerPromoSaving(false);
                  }}
                  disabled={!explorerPromoForm.title.trim() || explorerPromoSaving}
                  className="flex items-center gap-2 px-8 py-3 rounded-full bg-brand-pink text-white font-black uppercase tracking-widest text-[11px] hover:opacity-90 transition-opacity disabled:opacity-40"
                >
                  <Plus className="w-4 h-4" />
                  {explorerPromoSaving ? "SAVING..." : "ADD EXPLORER EVENT"}
                </button>
              </div>

              {/* Existing Explorer Promoted Events - Hero Preview Cards */}
              {explorerPromotedEvents.length === 0 ? (
                <div className="text-center py-20 text-gray-400 text-sm font-bold">No explorer promoted events yet. Add one above!</div>
              ) : (
                <div className="space-y-8">
                  {explorerPromotedEvents.map((pe, idx) => {
                    const isEditing = editingExplorerPromoId === pe.id;
                    const bgSrc = isEditing && editExplorerPromoBgPreview ? editExplorerPromoBgPreview : pe.background_url;
                    return (
                      <div key={pe.id} className="relative group">
                        <div className="relative overflow-hidden rounded-[2rem] aspect-[21/9] shadow-xl border border-gray-100 dark:border-gray-800">
                          <div className="absolute inset-0 z-0">
                            {bgSrc ? (
                              <img src={bgSrc} alt={pe.title} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full bg-gradient-to-br from-gray-800 to-gray-950" />
                            )}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                          </div>
                          <div className="absolute inset-0 z-10 flex flex-col justify-end p-8 md:p-12">
                            <div className="max-w-xl space-y-3">
                              <div className="flex items-center gap-3">
                                <span className="bg-brand-lime text-on-background px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest">Trending Event</span>
                                <span className="text-white/80 font-bold text-xs uppercase tracking-wider">{isEditing ? editExplorerPromoForm.location : pe.location}</span>
                              </div>
                              <h3 className="text-3xl md:text-5xl font-black text-white tracking-tight leading-none">{isEditing ? editExplorerPromoForm.title : pe.title}</h3>
                              {(isEditing ? editExplorerPromoForm.subtitle : pe.subtitle) && (
                                <p className="text-white/80 text-sm md:text-base font-medium max-w-md">{isEditing ? editExplorerPromoForm.subtitle : pe.subtitle}</p>
                              )}
                              <div className="flex items-center gap-3 pt-2">
                                <span className="bg-brand-pink text-white px-6 py-2.5 rounded-full font-black tracking-tight text-xs">DISCOVER EVENTS</span>
                              </div>
                            </div>
                          </div>
                          <div className="absolute top-5 left-5 z-20 w-10 h-10 rounded-full bg-black/50 backdrop-blur-xl flex items-center justify-center">
                            <span className="font-black text-white text-sm">{idx + 1}</span>
                          </div>
                          <div className="absolute top-5 right-5 z-20 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            {!isEditing && (
                              <>
                                <button onClick={() => { setEditingExplorerPromoId(pe.id); setEditExplorerPromoForm({ title: pe.title, subtitle: pe.subtitle || "", location: pe.location || "", event_link: pe.event_link || "" }); setEditExplorerPromoBgFile(null); setEditExplorerPromoBgPreview(null); }} className="w-10 h-10 rounded-full bg-white/10 backdrop-blur-xl border border-white/20 flex items-center justify-center text-white hover:bg-brand-pink hover:border-brand-pink transition-all">
                                  <Pencil className="w-4 h-4" />
                                </button>
                                {pe.event_link && (
                                  <a href={pe.event_link} target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-full bg-white/10 backdrop-blur-xl border border-white/20 flex items-center justify-center text-white hover:bg-brand-lime hover:border-brand-lime hover:text-black transition-all">
                                    <ExternalLink className="w-4 h-4" />
                                  </a>
                                )}
                                <button onClick={async () => { await supabase.from("promoted_events").delete().eq("id", pe.id); setExplorerPromotedEvents(explorerPromotedEvents.filter(p => p.id !== pe.id)); }} className="w-10 h-10 rounded-full bg-white/10 backdrop-blur-xl border border-white/20 flex items-center justify-center text-white hover:bg-red-500 hover:border-red-500 transition-all">
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                        {isEditing && (
                          <div className="mt-4 bg-white dark:bg-surface rounded-[1.5rem] border border-brand-pink p-6">
                            <div className="grid grid-cols-2 gap-4 mb-4">
                              <div>
                                <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mb-1">Name</label>
                                <input type="text" value={editExplorerPromoForm.title} onChange={e => setEditExplorerPromoForm({ ...editExplorerPromoForm, title: e.target.value })} className="w-full px-4 py-2.5 rounded-xl bg-gray-50 dark:bg-surface-container border border-gray-100 dark:border-gray-800 text-sm font-bold text-on-background focus:outline-none focus:ring-2 focus:ring-brand-pink/40" />
                              </div>
                              <div>
                                <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mb-1">Subtitle</label>
                                <input type="text" value={editExplorerPromoForm.subtitle} onChange={e => setEditExplorerPromoForm({ ...editExplorerPromoForm, subtitle: e.target.value })} className="w-full px-4 py-2.5 rounded-xl bg-gray-50 dark:bg-surface-container border border-gray-100 dark:border-gray-800 text-sm font-bold text-on-background focus:outline-none focus:ring-2 focus:ring-brand-pink/40" />
                              </div>
                              <div>
                                <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mb-1">Location</label>
                                <input type="text" value={editExplorerPromoForm.location} onChange={e => setEditExplorerPromoForm({ ...editExplorerPromoForm, location: e.target.value })} className="w-full px-4 py-2.5 rounded-xl bg-gray-50 dark:bg-surface-container border border-gray-100 dark:border-gray-800 text-sm font-bold text-on-background focus:outline-none focus:ring-2 focus:ring-brand-pink/40" />
                              </div>
                              <div>
                                <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mb-1">Event Link</label>
                                <input type="text" value={editExplorerPromoForm.event_link} onChange={e => setEditExplorerPromoForm({ ...editExplorerPromoForm, event_link: e.target.value })} className="w-full px-4 py-2.5 rounded-xl bg-gray-50 dark:bg-surface-container border border-gray-100 dark:border-gray-800 text-sm font-bold text-on-background focus:outline-none focus:ring-2 focus:ring-brand-pink/40" />
                              </div>
                            </div>
                            <div className="flex items-center gap-4">
                              <label className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gray-50 dark:bg-surface-container border border-gray-100 dark:border-gray-800 text-sm font-bold text-gray-500 cursor-pointer hover:border-brand-pink transition-colors">
                                <ImageIcon className="w-4 h-4" />
                                <span>{editExplorerPromoBgFile ? editExplorerPromoBgFile.name : "Change background..."}</span>
                                <input type="file" accept="image/*" onChange={(e) => { const file = e.target.files?.[0]; if (!file) return; setEditExplorerPromoBgFile(file); const reader = new FileReader(); reader.onload = () => setEditExplorerPromoBgPreview(reader.result as string); reader.readAsDataURL(file); }} className="hidden" />
                              </label>
                              <div className="flex-1" />
                              <button onClick={() => setEditingExplorerPromoId(null)} className="px-6 py-2.5 rounded-full bg-gray-100 dark:bg-surface-container text-gray-500 font-black uppercase tracking-widest text-[10px] hover:bg-gray-200 transition-colors">Cancel</button>
                              <button onClick={async () => {
                                let backgroundUrl: string | undefined;
                                if (editExplorerPromoBgFile) {
                                  const ext = editExplorerPromoBgFile.name.split(".").pop() || "jpg";
                                  const path = `promoted/${crypto.randomUUID()}.${ext}`;
                                  const { error } = await supabase.storage.from("event-images").upload(path, editExplorerPromoBgFile, { upsert: true });
                                  if (!error) { const { data } = supabase.storage.from("event-images").getPublicUrl(path); backgroundUrl = data.publicUrl; }
                                }
                                const updates: any = { title: editExplorerPromoForm.title, subtitle: editExplorerPromoForm.subtitle, location: editExplorerPromoForm.location, event_link: editExplorerPromoForm.event_link };
                                if (backgroundUrl) updates.background_url = backgroundUrl;
                                const { data } = await supabase.from("promoted_events").update(updates).eq("id", pe.id).select().single();
                                if (data) setExplorerPromotedEvents(explorerPromotedEvents.map(p => p.id === pe.id ? data : p));
                                setEditingExplorerPromoId(null);
                              }} className="flex items-center gap-2 px-6 py-2.5 rounded-full bg-brand-pink text-white font-black uppercase tracking-widest text-[10px] hover:opacity-90 transition-opacity">
                                <Check className="w-3.5 h-3.5" /> Save
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
              </>
            ) : (
            <>
            {/* Add New Promoted Event Form */}
            <div className="bg-white dark:bg-surface rounded-[2rem] border border-gray-100 dark:border-gray-800 p-8 mb-8">
              <h3 className="text-lg font-black tracking-tight text-on-background mb-6 uppercase">Add Promoted Event</h3>
              <div className="grid grid-cols-2 gap-6 mb-6">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mb-2">Event Name *</label>
                  <input
                    type="text"
                    value={promoForm.title}
                    onChange={e => setPromoForm({ ...promoForm, title: e.target.value })}
                    placeholder="e.g. LOLLAPALOOZA BRASIL 2024"
                    className="w-full px-5 py-3 rounded-xl bg-gray-50 dark:bg-surface-container border border-gray-100 dark:border-gray-800 text-sm font-bold text-on-background placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-pink/40"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mb-2">Subtitle</label>
                  <input
                    type="text"
                    value={promoForm.subtitle}
                    onChange={e => setPromoForm({ ...promoForm, subtitle: e.target.value })}
                    placeholder="e.g. Three days of pure magic"
                    className="w-full px-5 py-3 rounded-xl bg-gray-50 dark:bg-surface-container border border-gray-100 dark:border-gray-800 text-sm font-bold text-on-background placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-pink/40"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mb-2">Location</label>
                  <input
                    type="text"
                    value={promoForm.location}
                    onChange={e => setPromoForm({ ...promoForm, location: e.target.value })}
                    placeholder="e.g. São Paulo • March 2024"
                    className="w-full px-5 py-3 rounded-xl bg-gray-50 dark:bg-surface-container border border-gray-100 dark:border-gray-800 text-sm font-bold text-on-background placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-pink/40"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mb-2">Event Link</label>
                  <input
                    type="text"
                    value={promoForm.event_link}
                    onChange={e => setPromoForm({ ...promoForm, event_link: e.target.value })}
                    placeholder="e.g. /event/abc123 or https://..."
                    className="w-full px-5 py-3 rounded-xl bg-gray-50 dark:bg-surface-container border border-gray-100 dark:border-gray-800 text-sm font-bold text-on-background placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-pink/40"
                  />
                </div>
              </div>
              <div className="mb-6">
                <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mb-2">Background Image</label>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 px-5 py-3 rounded-xl bg-gray-50 dark:bg-surface-container border border-gray-100 dark:border-gray-800 text-sm font-bold text-gray-500 cursor-pointer hover:border-brand-pink transition-colors">
                    <ImageIcon className="w-4 h-4" />
                    <span>{promoBgFile ? promoBgFile.name : "Choose image..."}</span>
                    <input type="file" accept="image/*" onChange={handlePromoBgSelect} className="hidden" />
                  </label>
                  {promoBgPreview && (
                    <div className="w-20 h-12 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
                      <img src={promoBgPreview} alt="Preview" className="w-full h-full object-cover" />
                    </div>
                  )}
                </div>
              </div>
              <button
                onClick={handleAddPromotedEvent}
                disabled={!promoForm.title.trim() || promoSaving}
                className="flex items-center gap-2 px-8 py-3 rounded-full bg-brand-pink text-white font-black uppercase tracking-widest text-[11px] hover:opacity-90 transition-opacity disabled:opacity-40"
              >
                <Plus className="w-4 h-4" />
                {promoSaving ? "SAVING..." : "ADD PROMOTED EVENT"}
              </button>
            </div>

            {/* Existing Promoted Events - Hero Preview Cards */}
            {promotedEvents.length === 0 ? (
              <div className="text-center py-20 text-gray-400 text-sm font-bold">No promoted events yet. Add one above!</div>
            ) : (
              <div className="space-y-8">
                {promotedEvents.map((pe, idx) => {
                  const isEditing = editingPromoId === pe.id;
                  const bgSrc = isEditing && editPromoBgPreview ? editPromoBgPreview : pe.background_url;
                  return (
                    <div key={pe.id} className="relative group">
                      {/* Hero-style preview card */}
                      <div className="relative overflow-hidden rounded-[2rem] aspect-[21/9] shadow-xl border border-gray-100 dark:border-gray-800">
                        <div className="absolute inset-0 z-0">
                          {bgSrc ? (
                            <img src={bgSrc} alt={pe.title} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full bg-gradient-to-br from-gray-800 to-gray-950" />
                          )}
                          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                        </div>
                        <div className="absolute inset-0 z-10 flex flex-col justify-end p-8 md:p-12">
                          <div className="max-w-xl space-y-3">
                            <div className="flex items-center gap-3">
                              <span className="bg-brand-lime text-on-background px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest">
                                Promoted Event
                              </span>
                              <span className="text-white/80 font-bold text-xs uppercase tracking-wider">
                                {isEditing ? editPromoForm.location : pe.location}
                              </span>
                            </div>
                            <h3 className="text-3xl md:text-5xl font-black text-white tracking-tight leading-none">
                              {isEditing ? editPromoForm.title : pe.title}
                            </h3>
                            {(isEditing ? editPromoForm.subtitle : pe.subtitle) && (
                              <p className="text-white/80 text-sm md:text-base font-medium max-w-md">
                                {isEditing ? editPromoForm.subtitle : pe.subtitle}
                              </p>
                            )}
                            <div className="flex items-center gap-3 pt-2">
                              <span className="bg-brand-pink text-white px-6 py-2.5 rounded-full font-black tracking-tight text-xs">
                                BOOK TICKETS
                              </span>
                              <span className="bg-white/10 backdrop-blur-md border border-white/20 text-white px-5 py-2.5 rounded-full font-black tracking-tight text-xs">
                                LEARN MORE
                              </span>
                            </div>
                          </div>
                        </div>
                        {/* Card number badge */}
                        <div className="absolute top-5 left-5 z-20 w-10 h-10 rounded-full bg-black/50 backdrop-blur-xl flex items-center justify-center">
                          <span className="font-black text-white text-sm">{idx + 1}</span>
                        </div>
                        {/* Action buttons */}
                        <div className="absolute top-5 right-5 z-20 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          {!isEditing && (
                            <>
                              <button onClick={() => startEditPromo(pe)} className="w-10 h-10 rounded-full bg-white/10 backdrop-blur-xl border border-white/20 flex items-center justify-center text-white hover:bg-brand-pink hover:border-brand-pink transition-all">
                                <Pencil className="w-4 h-4" />
                              </button>
                              {pe.event_link && (
                                <a href={pe.event_link} target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-full bg-white/10 backdrop-blur-xl border border-white/20 flex items-center justify-center text-white hover:bg-brand-lime hover:border-brand-lime hover:text-black transition-all">
                                  <ExternalLink className="w-4 h-4" />
                                </a>
                              )}
                              <button onClick={() => handleDeletePromoted(pe.id)} className="w-10 h-10 rounded-full bg-white/10 backdrop-blur-xl border border-white/20 flex items-center justify-center text-white hover:bg-red-500 hover:border-red-500 transition-all">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                      {/* Inline edit form below the card */}
                      {isEditing && (
                        <div className="mt-4 bg-white dark:bg-surface rounded-[1.5rem] border border-brand-pink p-6">
                          <div className="grid grid-cols-2 gap-4 mb-4">
                            <div>
                              <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mb-1">Name</label>
                              <input type="text" value={editPromoForm.title} onChange={e => setEditPromoForm({ ...editPromoForm, title: e.target.value })} className="w-full px-4 py-2.5 rounded-xl bg-gray-50 dark:bg-surface-container border border-gray-100 dark:border-gray-800 text-sm font-bold text-on-background focus:outline-none focus:ring-2 focus:ring-brand-pink/40" />
                            </div>
                            <div>
                              <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mb-1">Subtitle</label>
                              <input type="text" value={editPromoForm.subtitle} onChange={e => setEditPromoForm({ ...editPromoForm, subtitle: e.target.value })} className="w-full px-4 py-2.5 rounded-xl bg-gray-50 dark:bg-surface-container border border-gray-100 dark:border-gray-800 text-sm font-bold text-on-background focus:outline-none focus:ring-2 focus:ring-brand-pink/40" />
                            </div>
                            <div>
                              <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mb-1">Location</label>
                              <input type="text" value={editPromoForm.location} onChange={e => setEditPromoForm({ ...editPromoForm, location: e.target.value })} className="w-full px-4 py-2.5 rounded-xl bg-gray-50 dark:bg-surface-container border border-gray-100 dark:border-gray-800 text-sm font-bold text-on-background focus:outline-none focus:ring-2 focus:ring-brand-pink/40" />
                            </div>
                            <div>
                              <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mb-1">Event Link</label>
                              <input type="text" value={editPromoForm.event_link} onChange={e => setEditPromoForm({ ...editPromoForm, event_link: e.target.value })} className="w-full px-4 py-2.5 rounded-xl bg-gray-50 dark:bg-surface-container border border-gray-100 dark:border-gray-800 text-sm font-bold text-on-background focus:outline-none focus:ring-2 focus:ring-brand-pink/40" />
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <label className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gray-50 dark:bg-surface-container border border-gray-100 dark:border-gray-800 text-sm font-bold text-gray-500 cursor-pointer hover:border-brand-pink transition-colors">
                              <ImageIcon className="w-4 h-4" />
                              <span>{editPromoBgFile ? editPromoBgFile.name : "Change background..."}</span>
                              <input type="file" accept="image/*" onChange={handleEditPromoBgSelect} className="hidden" />
                            </label>
                            <div className="flex-1" />
                            <button onClick={() => setEditingPromoId(null)} className="px-6 py-2.5 rounded-full bg-gray-100 dark:bg-surface-container text-gray-500 font-black uppercase tracking-widest text-[10px] hover:bg-gray-200 transition-colors">
                              Cancel
                            </button>
                            <button onClick={() => handleSaveEditPromo(pe.id)} className="flex items-center gap-2 px-6 py-2.5 rounded-full bg-brand-pink text-white font-black uppercase tracking-widest text-[10px] hover:opacity-90 transition-opacity">
                              <Check className="w-3.5 h-3.5" /> Save
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            </>
            )}
          </div>
        )}
        {/* ATTENDEES Tab */}
        {activeTab === "ATTENDEES" && (
          <div>
            <div className="flex justify-between items-end mb-10">
              <div>
                <span className="font-bold uppercase tracking-[0.2em] text-[10px] text-brand-pink mb-1 block">Platform Users</span>
                <h2 className="text-5xl font-black tracking-tighter text-on-background">Attendees</h2>
              </div>
              <div className="flex items-center gap-4">
                <p className="text-sm font-bold text-gray-400">{allUsers.length} total users</p>
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-full gap-2 text-[10px] font-black uppercase tracking-[0.15em]"
                  onClick={() => {
                    const headers = ["Name", "Email", "Phone", "Joined", "Total Spent", "Total Events Attended", "Billing City", "Billing State", "Billing Zip Code", "Instagram"];
                    const rows = allUsers.map(u => {
                      const stats = userOrdersMap.get(u.user_id);
                      const spent = stats?.totalSpent ?? 0;
                      const events = stats?.eventsAttended ?? 0;
                      return [
                        `"${u.name.replace(/"/g, '""')}"`,
                        `"${u.email.replace(/"/g, '""')}"`,
                        `"${(u.phone || "—").replace(/"/g, '""')}"`,
                        `"${new Date(u.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}"`,
                        `"${spent.toLocaleString("en-US", { style: "currency", currency: "USD" })}"`,
                        `"${events}"`,
                        `"${(stats?.billingCity || "—").replace(/"/g, '""')}"`,
                        `"${(stats?.billingState || "—").replace(/"/g, '""')}"`,
                        `"${(stats?.billingZip || "—").replace(/"/g, '""')}"`,
                        `"${((u as any).instagram || "—").replace(/"/g, '""')}"`
                      ].join(",");
                    });
                    const csv = [headers.join(","), ...rows].join("\n");
                    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `attendees_export_${new Date().toISOString().slice(0, 10)}.csv`;
                    a.click();
                    URL.revokeObjectURL(url);
                    toast.success("Exported successfully");
                  }}
                >
                  <Download className="w-3.5 h-3.5" />
                  Export CSV
                </Button>
              </div>
            </div>

            {/* Summary */}
            <div className="grid grid-cols-3 gap-6 mb-8">
              <div className="bg-[#0e0e0e] dark:bg-inverse-surface p-8 rounded-[2rem] text-white">
                <Users className="w-6 h-6 text-brand-lime mb-3" />
                <span className="font-bold uppercase tracking-[0.2em] text-[10px] text-gray-400 block mb-1">Total Users</span>
                <h3 className="text-3xl font-black tracking-tighter">{allUsers.length}</h3>
              </div>
              <div className="bg-gray-50 dark:bg-surface p-8 rounded-[2rem]">
                <CalendarDays className="w-6 h-6 text-brand-pink mb-3" />
                <span className="font-bold uppercase tracking-[0.2em] text-[10px] text-gray-500 block mb-1">New This Month</span>
                <h3 className="text-3xl font-black tracking-tighter text-on-background">{allUsers.filter(u => { const d = new Date(u.created_at); const now = new Date(); return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear(); }).length}</h3>
              </div>
              <div className="bg-gray-50 dark:bg-surface p-8 rounded-[2rem]">
                <div className="flex items-center justify-between mb-3">
                  <BarChart3 className="w-6 h-6 text-brand-pink" />
                  <div className="flex gap-1">
                    {(["month", "year"] as const).map(p => (
                      <button
                        key={p}
                        onClick={() => setGrowthPeriod(p)}
                        className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-[0.15em] transition-colors ${
                          growthPeriod === p ? "bg-foreground text-background" : "bg-secondary text-muted-foreground hover:bg-secondary/80"
                        }`}
                      >
                        {p === "month" ? "Month" : "Year"}
                      </button>
                    ))}
                  </div>
                </div>
                <span className="font-bold uppercase tracking-[0.2em] text-[10px] text-gray-500 block mb-1">User Growth</span>
                {(() => {
                  const now = new Date();
                  let currentCount = 0;
                  let previousCount = 0;
                  if (growthPeriod === "month") {
                    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
                    const startOfPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                    currentCount = allUsers.filter(u => new Date(u.created_at) >= startOfMonth).length;
                    previousCount = allUsers.filter(u => { const d = new Date(u.created_at); return d >= startOfPrevMonth && d < startOfMonth; }).length;
                  } else {
                    const startOfYear = new Date(now.getFullYear(), 0, 1);
                    const startOfPrevYear = new Date(now.getFullYear() - 1, 0, 1);
                    currentCount = allUsers.filter(u => new Date(u.created_at) >= startOfYear).length;
                    previousCount = allUsers.filter(u => { const d = new Date(u.created_at); return d >= startOfPrevYear && d < startOfYear; }).length;
                  }
                  const growthPct = previousCount === 0 ? (currentCount > 0 ? 100 : 0) : Math.round(((currentCount - previousCount) / previousCount) * 100);
                  return (
                    <div className="flex items-baseline gap-2">
                      <h3 className="text-3xl font-black tracking-tighter text-on-background">{growthPct >= 0 ? "+" : ""}{growthPct}%</h3>
                      <span className="text-xs font-bold text-muted-foreground">({currentCount} new)</span>
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* Search */}
            <div className="flex items-center gap-4 mb-6">
              <div className="flex-1 relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search users by name or email..."
                  value={attendeeSearch}
                  onChange={(e) => setAttendeeSearch(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 rounded-full bg-gray-50 dark:bg-surface border border-gray-100 dark:border-gray-800 text-sm font-bold text-on-background placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-pink/40"
                />
              </div>
            </div>

            {/* User Table */}
            <div className="bg-white dark:bg-surface rounded-[2rem] border border-gray-100 dark:border-gray-800 overflow-hidden">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-gray-800">
                    {([
                      { key: "name" as const, label: "User" },
                      { key: "email" as const, label: "Email" },
                      { key: "phone" as const, label: "Phone" },
                      { key: "joined" as const, label: "Joined" },
                      { key: "spent" as const, label: "Total Spent" },
                    ]).map(col => (
                      <th
                        key={col.key}
                        onClick={() => {
                          if (attendeeSortCol === col.key) setAttendeeSortDir(d => d === "asc" ? "desc" : "asc");
                          else { setAttendeeSortCol(col.key); setAttendeeSortDir("asc"); }
                        }}
                        className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 cursor-pointer hover:text-gray-600 transition-colors select-none"
                      >
                        <span className="flex items-center gap-1">
                          {col.label}
                          {attendeeSortCol === col.key ? (
                            attendeeSortDir === "asc" ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                          ) : (
                            <ArrowUpDown className="w-3 h-3 opacity-40" />
                          )}
                        </span>
                      </th>
                    ))}
                    <th className="px-6 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                  {(() => {
                    let filteredUsers = allUsers.filter(u => {
                      if (!attendeeSearch) return true;
                      const q = attendeeSearch.toLowerCase();
                      return u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
                    });
                    if (attendeeSortCol) {
                      filteredUsers = [...filteredUsers].sort((a, b) => {
                        let av: any, bv: any;
                        if (attendeeSortCol === "name") { av = a.name.toLowerCase(); bv = b.name.toLowerCase(); }
                        else if (attendeeSortCol === "email") { av = a.email.toLowerCase(); bv = b.email.toLowerCase(); }
                        else if (attendeeSortCol === "phone") { av = a.phone || ""; bv = b.phone || ""; }
                        else if (attendeeSortCol === "joined") { av = a.created_at; bv = b.created_at; }
                        else { av = userOrdersMap.get(a.user_id)?.totalSpent || 0; bv = userOrdersMap.get(b.user_id)?.totalSpent || 0; }
                        if (av < bv) return attendeeSortDir === "asc" ? -1 : 1;
                        if (av > bv) return attendeeSortDir === "asc" ? 1 : -1;
                        return 0;
                      });
                    }
                    if (filteredUsers.length === 0) return <tr><td colSpan={6} className="px-8 py-16 text-center text-gray-400 text-sm">No users found</td></tr>;
                    return filteredUsers.map((u) => (
                      <tr key={u.user_id} className="group hover:bg-gray-50 dark:hover:bg-surface-container transition-colors cursor-pointer" onClick={() => setSelectedUser(u)}>
                        <td className="px-8 py-5">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0 bg-gray-100 dark:bg-surface-container ring-1 ring-gray-200 dark:ring-gray-700">
                              {u.avatar_url ? (
                                <img src={u.avatar_url} alt={u.name} className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center bg-brand-pink text-white font-bold text-sm">{u.name?.[0]?.toUpperCase() || "?"}</div>
                              )}
                            </div>
                            <span className="font-black text-on-background uppercase tracking-tight">{u.name}</span>
                          </div>
                        </td>
                        <td className="px-6 py-5 text-[11px] font-bold text-gray-500">{u.email}</td>
                        <td className="px-6 py-5 text-[11px] font-bold text-gray-500">{u.phone || "—"}</td>
                        <td className="px-6 py-5 text-[11px] font-bold text-gray-500 uppercase tracking-wider">{new Date(u.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</td>
                        <td className="px-6 py-5 text-[11px] font-black text-brand-pink tabular-nums">{formatCurrency(userOrdersMap.get(u.user_id)?.totalSpent || 0)}</td>
                        <td className="px-6 py-5 text-right">
                          <button
                            onClick={(e) => { e.stopPropagation(); setSelectedUser(u); }}
                            className="px-4 py-2 rounded-full bg-gray-100 dark:bg-surface-container text-[10px] font-black uppercase tracking-widest text-gray-500 hover:bg-brand-pink hover:text-white transition-all"
                          >
                            View
                          </button>
                        </td>
                      </tr>
                    ));
                  })()}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Customer Details Dialog - global, accessible from any tab */}
        <Dialog open={!!selectedUser} onOpenChange={(open) => !open && setSelectedUser(null)}>
          <DialogContent className="sm:max-w-[750px] rounded-3xl p-0 overflow-hidden">
            <DialogHeader className="px-8 pt-8 pb-0 flex flex-row items-center justify-between">
              <DialogTitle className="text-xl font-black tracking-tight">Customer Details</DialogTitle>
              {selectedUser && (
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-full font-bold gap-2 text-xs bg-[hsl(var(--brand-lime))] text-black hover:bg-[hsl(var(--brand-lime))]/90 border-none"
                    onClick={() => {
                      const slug = selectedUser.name.toLowerCase().replace(/\s+/g, "-");
                      navigate(`/user/${slug}`, { state: { customer: selectedUser } });
                    }}
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    VIEW PROFILE PAGE
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-full font-bold gap-2 text-xs bg-destructive/10 text-destructive border-destructive/20 hover:bg-destructive/20"
                    disabled={adminEditSaving}
                    onClick={handleBlockUser}
                  >
                    <Ban className="w-3.5 h-3.5" />
                    BLOCK USER
                  </Button>
                </div>
              )}
            </DialogHeader>
            {selectedUser && (
              <div className="flex flex-col md:flex-row gap-0 md:gap-0">
                {/* Left side - Profile info */}
                <div className="md:w-[280px] flex-shrink-0 px-8 py-6 md:border-r border-border flex flex-col items-center text-center gap-4">
                  <Avatar className="w-20 h-20 border-2 border-border">
                    {selectedUser.avatar_url ? (
                      <AvatarImage src={selectedUser.avatar_url} className="object-cover" />
                    ) : null}
                    <AvatarFallback className="bg-secondary text-foreground font-black text-xl">
                      {selectedUser.name.split(" ").map((n: string) => n[0]).join("").toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <h3 className="text-lg font-black text-foreground">{selectedUser.name}</h3>

                  <div className="flex flex-col gap-3 w-full text-left">
                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                      <Mail className="w-4 h-4 flex-shrink-0" />
                      <span className="truncate">{selectedUser.email}</span>
                    </div>
                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                      <Phone className="w-4 h-4 flex-shrink-0" />
                      <span>{selectedUser.phone || "Not provided"}</span>
                    </div>
                  </div>

                  <div className="w-full border-t border-border pt-4 flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <CalendarCheck className="w-4 h-4" />
                        <span>Member Since</span>
                      </div>
                      <span className="text-sm font-black text-foreground">{new Date(selectedUser.created_at).toLocaleDateString("en-US", { month: "short", year: "numeric" })}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <CalendarCheck className="w-4 h-4" />
                        <span>Events Attended</span>
                      </div>
                      <span className="text-sm font-black text-foreground">{userOrdersMap.get(selectedUser.user_id)?.eventsAttended || 0}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <DollarSign className="w-4 h-4" />
                        <span>Total Spent</span>
                      </div>
                      <span className="text-sm font-black text-[hsl(var(--brand-pink))]">{formatCurrency(userOrdersMap.get(selectedUser.user_id)?.totalSpent || 0)}</span>
                    </div>
                  </div>
                </div>

                {/* Right side - Account Management & Orders */}
                <div className="flex-1 px-6 py-6 min-w-0">
                  {/* Admin Account Management */}
                  <h4 className="text-xs font-black uppercase tracking-[0.15em] text-muted-foreground mb-4">Account Management</h4>
                  <div className="space-y-4 mb-6">
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground mb-1.5 block">Change Email</label>
                      <div className="flex gap-2">
                        <div className="flex-1 relative">
                          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                          <input
                            type="email"
                            placeholder={selectedUser.email}
                            value={adminEditEmail}
                            onChange={e => setAdminEditEmail(e.target.value)}
                            className="w-full pl-10 pr-3 py-2.5 rounded-xl bg-secondary/50 border border-border text-sm font-bold text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-[hsl(var(--brand-pink))]/40"
                          />
                        </div>
                        <Button
                          size="sm"
                          disabled={!adminEditEmail.trim() || adminEditSaving}
                          onClick={() => handleAdminUpdateUser("email")}
                          className="rounded-xl bg-[hsl(var(--brand-pink))] hover:bg-[hsl(var(--brand-pink))]/90 text-white font-black text-[10px] uppercase tracking-widest px-4"
                        >
                          <Save className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground mb-1.5 block">Change Password</label>
                      <div className="flex gap-2">
                        <div className="flex-1 relative">
                          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                          <input
                            type="password"
                            placeholder="New password (min 6 chars)"
                            value={adminEditPassword}
                            onChange={e => setAdminEditPassword(e.target.value)}
                            className="w-full pl-10 pr-3 py-2.5 rounded-xl bg-secondary/50 border border-border text-sm font-bold text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-[hsl(var(--brand-pink))]/40"
                          />
                        </div>
                        <Button
                          size="sm"
                          disabled={!adminEditPassword || adminEditSaving}
                          onClick={() => handleAdminUpdateUser("password")}
                          className="rounded-xl bg-[hsl(var(--brand-pink))] hover:bg-[hsl(var(--brand-pink))]/90 text-white font-black text-[10px] uppercase tracking-widest px-4"
                        >
                          <Save className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Last Orders */}
                  <h4 className="text-xs font-black uppercase tracking-[0.15em] text-muted-foreground mb-4 pt-4 border-t border-border">Last Orders</h4>
                  <div className="space-y-3 max-h-[180px] overflow-y-auto pr-2">
                    {(() => {
                      const userData = userOrdersMap.get(selectedUser.user_id);
                      if (!userData || userData.orders.length === 0) {
                        return (
                          <div className="flex flex-col items-center justify-center py-8 text-center gap-2">
                            <Ticket className="w-6 h-6 text-muted-foreground/30" />
                            <p className="text-xs text-muted-foreground">No purchase history yet</p>
                          </div>
                        );
                      }
                      return userData.orders.map(o => (
                        <div
                          key={o.id}
                          className="flex items-center justify-between p-3 rounded-xl bg-secondary/30 hover:bg-secondary/50 transition-colors cursor-pointer"
                          onClick={() => {
                            setSelectedUser(null);
                            setTimeout(() => setSelectedOrderDetail({ ...o, user_name: selectedUser?.name, user_email: selectedUser?.email }), 200);
                          }}
                        >
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-black text-foreground truncate">{o.event_title}</p>
                            <p className="text-[10px] text-muted-foreground">{o.ticket_name} × {o.quantity} · {new Date(o.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</p>
                          </div>
                          <span className="text-xs font-black text-[hsl(var(--brand-pink))] tabular-nums ml-3">{formatCurrency(o.total)}</span>
                        </div>
                      ));
                    })()}
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Block User Confirmation */}
        <AlertDialog open={blockConfirmOpen} onOpenChange={setBlockConfirmOpen}>
          <AlertDialogContent className="rounded-2xl">
            <AlertDialogHeader>
              <AlertDialogTitle className="font-black">Block {selectedUser?.name}?</AlertDialogTitle>
              <AlertDialogDescription>
                This user will no longer be able to sign in to the platform. You can unblock them later if needed.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="rounded-xl font-bold">Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={executeBlockUser}
                className="rounded-xl font-bold bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Block User
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Order Details Modal */}
        <Dialog open={!!selectedOrderDetail} onOpenChange={(open) => { if (!open) { setSelectedOrderDetail(null); setAdminShowPartialRefund(false); } }}>
          <DialogContent className="sm:max-w-md rounded-3xl p-0 overflow-hidden">
            <DialogHeader className="px-6 pt-6 pb-0">
              <DialogTitle className="text-lg font-black">Order {selectedOrderDetail?.id.slice(0, 8)}</DialogTitle>
            </DialogHeader>
            {selectedOrderDetail && (() => {
              const isRefunded = isOrderRefunded(selectedOrderDetail);
              const unitPrice = Number(selectedOrderDetail.unit_price || 0);
              const qty = selectedOrderDetail.quantity;
              const discount = Number(selectedOrderDetail.discount || 0);
              const promoCode = selectedOrderDetail.promo_code || null;
              const pricing = resolveOrderPricing({
                unitPrice,
                quantity: qty,
                discount,
                total: selectedOrderDetail.total,
              });

              return (
                <div className="px-6 pb-6 space-y-5">
                  {isRefunded && (
                    <div className="flex items-center gap-2 px-3 py-2 bg-destructive/10 rounded-xl border border-destructive/20">
                      <Ban className="w-4 h-4 text-destructive" />
                      <span className="text-sm font-bold text-destructive">This order has been refunded — ticket canceled</span>
                    </div>
                  )}

                  {/* Breakdown */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-black uppercase tracking-[0.15em] text-muted-foreground">Spend Breakdown</h4>
                    <div className="bg-secondary/50 rounded-2xl border border-border/50 p-4 space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Ticket Price ({selectedOrderDetail.ticket_name} × {qty})</span>
                        <span className="font-medium text-foreground">{formatCurrency(pricing.ticketPrice)}</span>
                      </div>
                      {discount > 0 && (
                        <>
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Promo Code{promoCode ? ` (${promoCode})` : ""}</span>
                            <span className="font-medium text-green-400">-{formatCurrency(pricing.promoDiscount)}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Subtotal after promo</span>
                            <span className="font-medium text-foreground">{formatCurrency(pricing.subtotalAfterPromo)}</span>
                          </div>
                        </>
                      )}
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Service fee (non-refundable)</span>
                        <span className="font-medium text-foreground">{formatCurrency(pricing.serviceFee)}</span>
                      </div>
                      <div className="border-t border-border pt-2 flex justify-between text-sm">
                        <span className="font-bold text-foreground">Total</span>
                        <span className="font-black text-[hsl(var(--brand-pink))]">{formatCurrency(pricing.totalPaid)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Customer & Event */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Customer</span>
                      <span className="font-medium text-foreground">{selectedOrderDetail.user_name || "—"}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Event</span>
                      <span className="font-medium text-foreground">{selectedOrderDetail.event_title}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Date</span>
                      <span className="font-medium text-foreground">{new Date(selectedOrderDetail.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-black uppercase tracking-[0.15em] text-muted-foreground">Actions</h4>
                    <div className="flex flex-col gap-2">
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="destructive" className="w-full justify-start gap-2 rounded-xl" disabled={isRefunded}>
                            <RotateCcw className="w-4 h-4" />
                            Full Refund
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="rounded-3xl">
                          <AlertDialogHeader>
                            <AlertDialogTitle>Confirm Full Refund</AlertDialogTitle>
                            <AlertDialogDescription>
                              Refund {formatCurrency(pricing.subtotalAfterPromo)} (ticket price) to {selectedOrderDetail.user_name}? Service fees are non-refundable. This will cancel their ticket and cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
                            <AlertDialogAction className="rounded-xl" onClick={async () => {
                              try {
                                const refundAmount = pricing.subtotalAfterPromo;
                                const refundedOrder = await refundOrder(selectedOrderDetail.id, refundAmount);
                                const refundedAt = refundedOrder?.refunded_at || new Date().toISOString();
                                syncAdminRefundState(selectedOrderDetail.id, refundAmount, refundedAt);
                                setAdminShowPartialRefund(false);
                                toast.success(`Full refund of ${formatCurrency(refundAmount)} issued to ${selectedOrderDetail.user_name}`);
                              } catch (error: any) {
                                toast.error(error?.message || "Failed to refund order");
                              }
                            }}>Confirm Refund</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>

                      <Button variant="outline" className="w-full justify-start gap-2 rounded-xl" disabled={isRefunded}
                        onClick={() => { setAdminPartialRefundAmount(""); setAdminShowPartialRefund(true); }}>
                        <DollarSign className="w-4 h-4" />
                        Partial Refund
                      </Button>

                      {adminShowPartialRefund && !isRefunded && (
                        <div className="bg-secondary/50 rounded-2xl border border-border/50 p-4 space-y-3">
                          <p className="text-sm text-muted-foreground">
                            Enter refund amount (max {formatCurrency(pricing.subtotalAfterPromo)} — ticket price only). Service fees are non-refundable.
                          </p>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
                            <input
                              type="number"
                              min="0.01"
                              max={pricing.subtotalAfterPromo}
                              step="0.01"
                              value={adminPartialRefundAmount}
                              onChange={(e) => setAdminPartialRefundAmount(e.target.value)}
                              placeholder="0.00"
                              className="w-full pl-7 pr-3 py-2 bg-background border border-border rounded-xl text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[hsl(var(--brand-pink))] tabular-nums"
                            />
                          </div>
                          <div className="flex gap-2">
                            <Button variant="ghost" size="sm" className="flex-1 rounded-xl" onClick={() => setAdminShowPartialRefund(false)}>
                              Cancel
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="destructive" size="sm" className="flex-1 rounded-xl"
                                  disabled={!adminPartialRefundAmount || parseFloat(adminPartialRefundAmount) <= 0 || parseFloat(adminPartialRefundAmount) > pricing.subtotalAfterPromo}>
                                  Refund ${adminPartialRefundAmount || "0.00"}
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent className="rounded-3xl">
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Confirm Partial Refund</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Refund ${parseFloat(adminPartialRefundAmount || "0").toFixed(2)} of {formatCurrency(pricing.totalPaid)} to {selectedOrderDetail.user_name}? This will cancel their ticket and cannot be undone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
                                  <AlertDialogAction className="rounded-xl" onClick={async () => {
                                    try {
                                      const refundAmount = parseFloat(adminPartialRefundAmount);
                                      const refundedOrder = await refundOrder(selectedOrderDetail.id, refundAmount);
                                      const refundedAt = refundedOrder?.refunded_at || new Date().toISOString();
                                      syncAdminRefundState(selectedOrderDetail.id, refundAmount, refundedAt);
                                      setAdminShowPartialRefund(false);
                                      toast.success(`Partial refund of $${refundAmount.toFixed(2)} issued to ${selectedOrderDetail.user_name}`);
                                    } catch (error: any) {
                                      toast.error(error?.message || "Failed to refund order");
                                    }
                                  }}>Confirm Refund</AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </div>
                      )}

                      <Button variant="secondary" className="w-full justify-start gap-2 rounded-xl" disabled={isRefunded}
                        onClick={() => toast.success(`Ticket resent to ${selectedOrderDetail.user_name}`)}>
                        <Send className="w-4 h-4" />
                        Resend Ticket
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })()}
          </DialogContent>
        </Dialog>


        <AlertDialog open={!!disableSalesConfirm} onOpenChange={(open) => !open && setDisableSalesConfirm(null)}>
          <AlertDialogContent className="rounded-2xl">
            <AlertDialogHeader>
              <AlertDialogTitle className="font-black">
                {disableSalesConfirm?.salesDisabled ? "Enable Sales" : "Disable Sales"} — {disableSalesConfirm?.title}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {disableSalesConfirm?.salesDisabled
                  ? "This will re-enable ticket sales for this event. Tickets will become visible again on the event page and the organizer will be able to manage tickets."
                  : "This will disable all ticket sales for this event. All tickets will be hidden from the event page and the organizer will be unable to edit tickets until sales are re-enabled."}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="rounded-full">Cancel</AlertDialogCancel>
              <AlertDialogAction
                className={`rounded-full font-black uppercase tracking-widest text-[10px] ${disableSalesConfirm?.salesDisabled ? "bg-brand-lime text-black hover:bg-brand-lime/80" : "bg-orange-500 text-white hover:bg-orange-600"}`}
                onClick={async () => {
                  if (!disableSalesConfirm) return;
                  const newVal = !disableSalesConfirm.salesDisabled;
                  await supabase.from("events").update({ sales_disabled: newVal }).eq("id", disableSalesConfirm.id);
                  setAllEvents(allEvents.map(e => e.id === disableSalesConfirm.id ? { ...e, salesDisabled: newVal } : e));
                  setTopEvents(topEvents.map(e => e.id === disableSalesConfirm.id ? { ...e, salesDisabled: newVal } : e));
                  toast.success(newVal ? "Sales disabled for this event" : "Sales re-enabled for this event");
                  setDisableSalesConfirm(null);
                }}
              >
                {disableSalesConfirm?.salesDisabled ? "Enable Sales" : "Disable Sales"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {activeTab === "ORGANIZATIONS" && (
          <div>
            {selectedOrg ? (
              <AdminOrgDetail
                org={selectedOrg}
                allEvents={allEvents}
                onBack={() => setSelectedOrg(null)}
                onOwnerClick={() => {
                  const ownerUser = allUsers.find(u => u.user_id === selectedOrg.ownerUserId);
                  if (ownerUser) setSelectedUser(ownerUser);
                  else toast.error("Owner profile not found");
                }}
              />
            ) : (
            <>
            <div className="flex justify-between items-end mb-10">
              <div>
                <span className="font-bold uppercase tracking-[0.2em] text-[10px] text-brand-pink mb-1 block">Network</span>
                <h2 className="text-5xl font-black tracking-tighter text-on-background">Organizations</h2>
              </div>
              <p className="text-sm font-bold text-gray-400">{allOrgs.length} total</p>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-3 gap-6 mb-8">
              <div className="bg-[#0e0e0e] dark:bg-inverse-surface p-8 rounded-[2rem] text-white">
                <Building2 className="w-6 h-6 text-brand-lime mb-3" />
                <span className="font-bold uppercase tracking-[0.2em] text-[10px] text-gray-400 block mb-1">Total Organizations</span>
                <h3 className="text-3xl font-black tracking-tighter">{allOrgs.length}</h3>
              </div>
              <div className="bg-gray-50 dark:bg-surface p-8 rounded-[2rem]">
                <CalendarDays className="w-6 h-6 text-brand-pink mb-3" />
                <span className="font-bold uppercase tracking-[0.2em] text-[10px] text-gray-500 block mb-1">New This Month</span>
                <h3 className="text-3xl font-black tracking-tighter text-on-background">{allOrgs.filter(o => { const d = new Date(o.createdAt); const now = new Date(); return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear(); }).length}</h3>
              </div>
              <div className="bg-gray-50 dark:bg-surface p-8 rounded-[2rem]">
                <DollarSign className="w-6 h-6 text-brand-pink mb-3" />
                <span className="font-bold uppercase tracking-[0.2em] text-[10px] text-gray-500 block mb-1">Total Organization Revenue</span>
                <h3 className="text-3xl font-black tracking-tighter text-on-background">{allOrgs.reduce((sum, o) => sum + o.totalRevenue, 0).toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 })}</h3>
              </div>
            </div>

            {/* Search */}
            <div className="flex items-center gap-4 mb-8">
              <div className="flex-1 relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search organizations..."
                  value={orgSearch}
                  onChange={(e) => setOrgSearch(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 rounded-full bg-gray-50 dark:bg-surface border border-gray-100 dark:border-gray-800 text-sm font-bold text-on-background placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-pink/40"
                />
              </div>
            </div>

            {/* Org Table */}
            <div className="bg-white dark:bg-surface rounded-[2rem] border border-gray-100 dark:border-gray-800 overflow-hidden">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-gray-800">
                    <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Organization</th>
                    <th className="px-6 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Owner</th>
                    <th className="px-6 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Revenue</th>
                    <th className="px-6 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Attendees</th>
                    <th className="px-6 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Events</th>
                    <th className="px-6 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Created</th>
                    <th className="px-6 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                  {(() => {
                    const filtered = allOrgs.filter(o => {
                      if (!orgSearch) return true;
                      const q = orgSearch.toLowerCase();
                      return o.name.toLowerCase().includes(q) || o.ownerName.toLowerCase().includes(q);
                    });
                    if (filtered.length === 0) return <tr><td colSpan={7} className="px-8 py-16 text-center text-gray-400 text-sm">No organizations found</td></tr>;
                    return filtered.map((org) => (
                      <tr key={org.id} className="group hover:bg-gray-50 dark:hover:bg-surface-container transition-colors">
                        <td className="px-8 py-5">
                          <button onClick={() => setSelectedOrg(org)} className="flex items-center gap-4 text-left">
                            <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0 bg-gray-100 dark:bg-surface-container ring-1 ring-gray-200 dark:ring-gray-700">
                              {org.avatar_url ? (
                                <img src={org.avatar_url} alt={org.name} className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center bg-brand-pink text-white font-bold text-sm">{org.name[0]?.toUpperCase()}</div>
                              )}
                            </div>
                            <div className="min-w-0">
                              <span className="font-black text-on-background uppercase tracking-tight truncate block group-hover:text-brand-pink transition-colors">{org.name}</span>
                              <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-gray-400">{org.type.replace("_", " ")}</span>
                            </div>
                          </button>
                        </td>
                        <td className="px-6 py-5">
                          <button
                            className="text-[11px] font-bold text-gray-500 hover:text-brand-pink hover:underline transition-colors cursor-pointer"
                            onClick={() => {
                              const ownerUser = allUsers.find(u => u.user_id === org.ownerUserId);
                              if (ownerUser) setSelectedUser(ownerUser);
                              else toast.error("Owner profile not found");
                            }}
                          >
                            {org.ownerName}
                          </button>
                        </td>
                        <td className="px-6 py-5 text-[11px] font-black text-brand-pink">{formatCurrency(org.totalRevenue)}</td>
                        <td className="px-6 py-5 text-[11px] font-bold text-gray-500">{org.totalAttendees.toLocaleString()}</td>
                        <td className="px-6 py-5 text-[11px] font-bold text-gray-500">{org.eventCount}</td>
                        <td className="px-6 py-5 text-[11px] font-bold text-gray-500 uppercase tracking-wider">{new Date(org.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</td>
                        <td className="px-6 py-5 text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-surface-container transition-colors">
                                <MoreVertical className="w-4 h-4 text-gray-400" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48 rounded-xl">
                              <DropdownMenuItem
                                className="gap-3 cursor-pointer"
                                onClick={() => {
                                  setEditOrgData({
                                    id: org.id,
                                    slug: org.slug,
                                    name: org.name,
                                    avatarUrl: org.avatar_url || undefined,
                                    type: org.type as any,
                                    region: org.region,
                                    country: org.country,
                                    state: org.state,
                                    socials: org.socials || {},
                                    links: org.links || [],
                                    createdAt: org.createdAt,
                                  });
                                }}
                              >
                                <Pencil className="w-4 h-4" />
                                <span className="font-bold text-xs">Edit Organization</span>
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="gap-3 cursor-pointer text-red-500 focus:text-red-500"
                                onClick={() => {
                                  toast.error(`Organization "${org.name}" has been banned`, { description: "This action is a placeholder." });
                                }}
                              >
                                <XCircle className="w-4 h-4" />
                                <span className="font-bold text-xs">Ban Organization</span>
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    ));
                  })()}
                </tbody>
              </table>
            </div>
            {/* Edit Organization Modal */}
            <CreateOrganizationModal
              open={!!editOrgData}
              onClose={() => setEditOrgData(null)}
              editOrganization={editOrgData || undefined}
              onCreated={() => {
                setEditOrgData(null);
              }}
            />
            </>
            )}
          </div>
        )}

        {activeTab === "FINANCE" && <AdminFinanceTab />}

        {activeTab === "SETTINGS" && <AdminSettingsTab />}

        {/* Footer */}
        <footer className="mt-24 pt-12 border-t border-gray-100 dark:border-gray-800 flex justify-between items-center">
          <span className="font-black uppercase tracking-[0.3em] text-[10px] text-on-background">Brazou Admin v2.4.0</span>
          <div className="flex space-x-12">
            <div>
              <span className="font-bold uppercase tracking-widest text-[8px] text-gray-400 block mb-1">Total Events</span>
              <span className="font-black uppercase tracking-widest text-[10px] text-on-background">{stats.totalEvents}</span>
            </div>
            <div className="flex items-center space-x-2">
              <ShieldCheck className="w-4 h-4 text-brand-pink" />
              <span className="font-black uppercase tracking-widest text-[10px] text-on-background">Secure Admin Session</span>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
};

export default AdminDashboard;
