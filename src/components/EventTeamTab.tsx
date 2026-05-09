import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { resolveOrderPricing } from "@/lib/orderPricing";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  UserPlus, Link2, Copy, Users, ShieldCheck, ScanLine, Megaphone, Crown,
  Eye, ClipboardList, RotateCcw, ScanBarcode, Clock, FileText,
  Palette, Settings, Ticket, Gift, UserCog, ExternalLink, Trash2,
  Check, Mail,
} from "lucide-react";

type TeamRole = "admin" | "promoter" | "staff" | "scanner";

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: TeamRole;
  avatarUrl: string;
  status: "active" | "pending";
  permissions: string[];
  trackingLinks?: { id: string; label: string; url: string; clicks: number; sales: number; revenue: string }[];
}

interface TrackingLink {
  id: string;
  label: string;
  url: string;
  clicks: number;
  sales: number;
  revenue: string;
  createdBy: string;
  createdByAdmin?: boolean;
}

const roleConfig: Record<TeamRole, { label: string; icon: React.ReactNode; color: string }> = {
  admin: { label: "Admin", icon: <Crown className="w-3.5 h-3.5" />, color: "bg-[hsl(var(--brand-pink))]/10 text-[hsl(var(--brand-pink))]" },
  promoter: { label: "Promoter", icon: <Megaphone className="w-3.5 h-3.5" />, color: "bg-[hsl(var(--brand-lime))]/15 text-foreground dark:text-[hsl(var(--brand-lime))]" },
  staff: { label: "Staff", icon: <ShieldCheck className="w-3.5 h-3.5" />, color: "bg-accent text-accent-foreground" },
  scanner: { label: "Scanner", icon: <ScanLine className="w-3.5 h-3.5" />, color: "bg-secondary text-muted-foreground" },
};

// Permission definitions
const ADMIN_ONLY_PERMISSIONS = new Set(["edit_event_tickets", "view_send_comp_tickets", "add_affiliates"]);

const permissionGroups = [
  {
    category: "Attendees",
    permissions: [
      { key: "view_attendees", label: "View Attendees", description: "Allows the user to view a list of all attendees" },
    ],
  },
  {
    category: "Orders",
    permissions: [
      { key: "view_orders", label: "View Orders", description: "Allows the user to view all orders through the \"Orders\" tab" },
      
      { key: "resend_receipt", label: "Resend Receipt", description: "Allows the user to resend receipt emails for orders of their choice" },
      { key: "scan_ticket", label: "Scan Ticket", description: "Allows the user to scan tickets for an order" },
      
      { key: "access_attendee_files", label: "Access Attendee Files", description: "Allows the user to access attendee files" },
    ],
  },
  {
    category: "Event",
    permissions: [
      { key: "edit_event_visuals", label: "Edit Event Visuals", description: "Allows the user to access the \"Visuals\" tab on the event (flyer, color, etc.)" },
      { key: "edit_event_settings", label: "Edit Event Settings", description: "Allows the user to edit settings on the event page (\"Settings\" & \"Visuals\" tabs)" },
      { key: "edit_event_tickets", label: "Edit Event Tickets", description: "Allows the user to create, remove, or edit existing / new tickets", adminOnly: true },
      { key: "view_send_comp_tickets", label: "View / Send Complimentary Tickets", description: "Allows the user to view, send, and update complimentary tickets and manage the guest-list", adminOnly: true },
      { key: "add_affiliates", label: "Add Affiliates", description: "Allows the user to add and manage affiliates for their event", adminOnly: true },
    ],
  },
];

const roleDefaults: Record<TeamRole, string[]> = {
  admin: permissionGroups.flatMap(g => g.permissions.map(p => p.key)),
  promoter: ["view_attendees", "view_orders"],
  staff: ["view_attendees", "view_orders", "scan_ticket"],
  scanner: ["scan_ticket"],
};

const defaultMainLinks = (eventId: string): TrackingLink[] => {
  const origin = window.location.host;
  return [
    { id: "main-event-link", label: "Event Link", url: `${origin}/event/${eventId}`, clicks: 0, sales: 0, revenue: "$0", createdBy: "System" },
    { id: "main-brazou", label: "Brazou", url: `${origin}/event/${eventId}?ref=explore`, clicks: 0, sales: 0, revenue: "$0", createdBy: "System" },
    { id: "main-instagram", label: "Instagram", url: `${origin}/event/${eventId}?ref=instagram`, clicks: 0, sales: 0, revenue: "$0", createdBy: "System" },
  ];
};

const getInitials = (name: string) =>
  name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);

interface OrgExistingMember {
  email: string;
  name: string;
  avatarUrl: string;
  role: string;
  acceptedBy: string | null;
}

const EventTeamTab = ({ eventId, organizationId }: { eventId?: string; organizationId?: string }) => {
  const { authReady, session } = useAuth();
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [mainLinks, setMainLinks] = useState<TrackingLink[]>(defaultMainLinks(eventId || ""));
  const [trackingLinks, setTrackingLinks] = useState<TrackingLink[]>([]);
  const [invitationLoading, setInvitationLoading] = useState(false);
  const [teamLoading, setTeamLoading] = useState(true);
  const [orgMembers, setOrgMembers] = useState<OrgExistingMember[]>([]);

  useEffect(() => {
    if (!eventId || !authReady || !session?.user) {
      if (authReady) setTeamLoading(false);
      return;
    }

    const fetchInvitations = async () => {
      setTeamLoading(true);

      try {
        await supabase.auth.setSession({
          access_token: session.access_token,
          refresh_token: session.refresh_token,
        });

        const { data, error } = await supabase.rpc("get_event_team_members", {
          _event_id: eventId,
        });

        if (error) {
          console.error("[TeamTab] failed to load team members", error);
          setTeam([]);
          return;
        }

        const members: TeamMember[] = (data || []).map((member: any) => ({
          id: member.id,
          name: member.name || member.email.split("@")[0],
          email: member.email,
          role: member.role as TeamRole,
          avatarUrl: member.avatar_url || "",
          status: member.status === "accepted" ? "active" as const : "pending" as const,
          permissions: Array.isArray(member.permissions) ? member.permissions : [],
          trackingLinks: [
            {
              id: `${member.id}-summary`,
              label: `${member.name || member.email.split("@")[0]} Summary`,
              url: `${window.location.host}/event/${eventId}`,
              clicks: Number(member.total_clicks || 0),
              sales: Number(member.total_sales || 0),
              revenue: `$${Number(member.total_revenue || 0).toFixed(2)}`,
            },
          ],
        }));

        setTeam(members);
      } finally {
        setTeamLoading(false);
      }
    };

    void fetchInvitations();
  }, [authReady, eventId, session?.access_token, session?.refresh_token]);

  // Fetch real click count, sales, and DB tracking links
  useEffect(() => {
    if (!eventId) return;
    const fetchData = async () => {
      const [{ data: eventData }, { data: orderData }, { data: dbLinks }] = await Promise.all([
        supabase.from("events").select("clicks, explore_clicks, instagram_clicks").eq("id", eventId).single(),
        supabase.from("orders").select("ref_source, quantity, total, unit_price, discount").eq("event_id", eventId),
        supabase.from("tracking_links").select("*").eq("event_id", eventId),
      ]);

      const allSlugs = new Set([
        "explore", "instagram",
        ...(dbLinks || []).map((tl: any) => tl.slug as string),
      ]);
      const filterOrders = (ref: string) => (orderData || []).filter(o => o.ref_source === ref);
      const directOrders = (orderData || []).filter(o => !allSlugs.has(o.ref_source));
      const sumSales = (orders: typeof directOrders) => orders.reduce((s, o) => s + (o.quantity || 0), 0);
      const sumRevenue = (orders: typeof directOrders) => orders.reduce((s, o) => {
        const pricing = resolveOrderPricing({ unitPrice: o.unit_price, quantity: o.quantity, discount: o.discount, total: o.total });
        return s + pricing.subtotalAfterPromo;
      }, 0);

      setMainLinks(prev => prev.map(link => {
        if (link.id === "main-event-link") {
          return { ...link, clicks: (eventData as any)?.clicks || 0, sales: sumSales(directOrders), revenue: `$${sumRevenue(directOrders).toFixed(2)}` };
        }
        if (link.id === "main-brazou") {
          const exploreOrders = filterOrders("explore");
          return { ...link, clicks: (eventData as any)?.explore_clicks || 0, sales: sumSales(exploreOrders), revenue: `$${sumRevenue(exploreOrders).toFixed(2)}` };
        }
        if (link.id === "main-instagram") {
          const igOrders = filterOrders("instagram");
          return { ...link, clicks: (eventData as any)?.instagram_clicks || 0, sales: sumSales(igOrders), revenue: `$${sumRevenue(igOrders).toFixed(2)}` };
        }
        return link;
      }));

      // Resolve creator names for tracking links
      const creatorIds = [...new Set((dbLinks || []).map((tl: any) => tl.created_by).filter(Boolean))];
      const { data: creatorProfiles } = creatorIds.length > 0
        ? await supabase.from("profiles").select("user_id, name").in("user_id", creatorIds)
        : { data: [] };
      const creatorMap = new Map((creatorProfiles || []).map((p: any) => [p.user_id, p.name]));
      const currentUserId = (await supabase.auth.getSession()).data.session?.user?.id;

      // Populate tracking links from DB with real order data
      const persistedLinks: TrackingLink[] = (dbLinks || []).map((tl: any) => {
        const srcOrders = filterOrders(tl.slug);
        let createdBy = "Unknown";
        if (tl.created_by_admin) {
          createdBy = "Brazou";
        } else if (tl.created_by === currentUserId) {
          createdBy = "You";
        } else {
          createdBy = creatorMap.get(tl.created_by) || "Team Member";
        }
        return {
          id: tl.id,
          label: tl.label,
          url: `${window.location.host}/${tl.slug}`,
          clicks: tl.clicks || 0,
          sales: sumSales(srcOrders),
          revenue: `$${sumRevenue(srcOrders).toFixed(2)}`,
          createdBy,
          createdByAdmin: !!tl.created_by_admin,
        };
      });

      // Admin-created links go into Main Links section
      const adminLinks = persistedLinks.filter(l => l.createdByAdmin);
      const orgLinks = persistedLinks.filter(l => !l.createdByAdmin);

      setMainLinks(prev => [...prev.filter(l => !l.id.startsWith("db-admin-")), ...adminLinks.map(l => ({ ...l, id: `db-admin-${l.id}`, createdByAdmin: true }))]);
      setTrackingLinks(orgLinks);
    };
    fetchData();
  }, [eventId]);
  // Fetch existing org team members (from other events) to allow quick selection
  useEffect(() => {
    if (!organizationId || !authReady || !session?.user) return;
    (async () => {
      const { data: invitations } = await supabase
        .from("team_invitations")
        .select("email, role, accepted_by")
        .eq("organization_id", organizationId)
        .eq("status", "accepted");

      if (!invitations || invitations.length === 0) return;

      const uniqueEmails = new Map<string, { email: string; role: string; accepted_by: string | null }>();
      invitations.forEach((inv) => {
        const email = inv.email.toLowerCase().trim();
        if (!uniqueEmails.has(email)) uniqueEmails.set(email, inv);
      });

      const acceptedUserIds = [...new Set(invitations.filter(i => i.accepted_by).map(i => i.accepted_by as string))];
      let profilesMap = new Map<string, { name: string; avatar_url: string }>();
      if (acceptedUserIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, name, avatar_url")
          .in("user_id", acceptedUserIds);
        profiles?.forEach(p => profilesMap.set(p.user_id, { name: p.name, avatar_url: p.avatar_url || "" }));
      }

      const members: OrgExistingMember[] = Array.from(uniqueEmails.values()).map((inv) => {
        const profile = inv.accepted_by ? profilesMap.get(inv.accepted_by) : null;
        return {
          email: inv.email.toLowerCase().trim(),
          name: profile?.name || inv.email.split("@")[0],
          avatarUrl: profile?.avatar_url || "",
          role: inv.role,
          acceptedBy: inv.accepted_by,
        };
      });

      setOrgMembers(members);
    })();
  }, [organizationId, authReady, session?.user]);

  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showCreateLinkModal, setShowCreateLinkModal] = useState(false);
  const [newLinkLabel, setNewLinkLabel] = useState("");
  const [newLinkSlug, setNewLinkSlug] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<TeamRole>("promoter");
  const [invitePermissions, setInvitePermissions] = useState<Set<string>>(new Set(roleDefaults.promoter));
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);
  const [copiedLink, setCopiedLink] = useState<string | null>(null);
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null);
  const [editRole, setEditRole] = useState<TeamRole>("staff");
  const [editPermissions, setEditPermissions] = useState<Set<string>>(new Set());

  const handleRoleChange = (role: TeamRole) => {
    setInviteRole(role);
    setInvitePermissions(new Set(roleDefaults[role]));
  };

  const togglePermission = (key: string) => {
    setInvitePermissions(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        // Prevent disabling view_attendees while access_attendee_files is on
        if (key === "view_attendees" && next.has("access_attendee_files")) return next;
        next.delete(key);
      } else {
        next.add(key);
        if (key === "access_attendee_files") { next.add("view_orders"); next.add("view_attendees"); }
      }
      return next;
    });
  };

  const handleInvite = async () => {
    if (!inviteEmail) {
      toast.error("Please enter an email address");
      return;
    }
    if (!eventId || !organizationId) {
      toast.error("Missing event or organization info");
      return;
    }

    setInvitationLoading(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      const userId = session?.session?.user?.id;
      if (!userId) { toast.error("Not authenticated"); return; }

      const permissionsArray = Array.from(invitePermissions);
      const emailNormalized = inviteEmail.toLowerCase().trim();

      // Check if this is an existing org member
      const existingOrgMember = orgMembers.find(m => m.email.toLowerCase() === emailNormalized);
      const isExistingMember = !!existingOrgMember?.acceptedBy;

      const { data: invitation, error } = await supabase
        .from("team_invitations")
        .insert({
          event_id: eventId,
          organization_id: organizationId,
          email: emailNormalized,
          role: inviteRole,
          permissions: permissionsArray as any,
          invited_by: userId,
          status: isExistingMember ? "accepted" : "pending",
          ...(isExistingMember ? { accepted_by: existingOrgMember.acceptedBy } : {}),
        })
        .select()
        .single();

      if (error) {
        if (error.message.includes("duplicate") || error.message.includes("unique")) {
          toast.error("This email has already been invited to this event");
        } else {
          toast.error("Failed to send invitation: " + error.message);
        }
        return;
      }

      // Add to local state
      const newMember: TeamMember = {
        id: invitation.id,
        name: existingOrgMember?.name || emailNormalized.split("@")[0],
        email: emailNormalized,
        role: inviteRole,
        avatarUrl: existingOrgMember?.avatarUrl || "",
        status: isExistingMember ? "active" : "pending",
        permissions: permissionsArray,
        trackingLinks: [],
      };
      setTeam(prev => [...prev, newMember]);

      if (!isExistingMember) {
        // Send invitation email only for new members
        try {
          await supabase.functions.invoke("send-team-invite", {
            body: {
              email: emailNormalized,
              token: invitation.token,
              eventId,
              organizationId,
              role: inviteRole,
            },
          });
        } catch {
          console.warn("Failed to send invitation email");
        }
      }

      setShowInviteModal(false);
      setInviteEmail("");
      setInviteRole("promoter");
      setInvitePermissions(new Set(roleDefaults.promoter));
      toast.success(isExistingMember ? `${existingOrgMember.name} added to this event` : `Invitation sent to ${inviteEmail}`);
    } finally {
      setInvitationLoading(false);
    }
  };

  const handleRemoveMember = async (id: string) => {
    const { error } = await supabase.from("team_invitations").delete().eq("id", id);
    if (error) {
      toast.error("Failed to remove team member");
      return;
    }
    setTeam(prev => prev.filter(m => m.id !== id));
    toast.success("Team member removed");
  };

  const handleCopyLink = (url: string, id: string) => {
    navigator.clipboard.writeText(`https://${url}`);
    setCopiedLink(id);
    setTimeout(() => setCopiedLink(null), 2000);
    toast.success("Link copied!");
  };

  const openEditMember = (member: TeamMember) => {
    setEditingMember(member);
    setEditRole(member.role);
    setEditPermissions(new Set(member.permissions || roleDefaults[member.role]));
  };

  const handleEditRoleChange = (role: TeamRole) => {
    setEditRole(role);
    setEditPermissions(new Set(roleDefaults[role]));
  };

  const toggleEditPermission = (key: string) => {
    setEditPermissions(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        if (key === "view_attendees" && next.has("access_attendee_files")) return next;
        next.delete(key);
      } else {
        next.add(key);
        if (key === "access_attendee_files") { next.add("view_orders"); next.add("view_attendees"); }
      }
      return next;
    });
  };

  const handleSavePermissions = async () => {
    if (!editingMember) return;
    const permissionsArray = Array.from(editPermissions);
    const { error } = await supabase
      .from("team_invitations")
      .update({ role: editRole, permissions: permissionsArray as any })
      .eq("id", editingMember.id);

    if (error) {
      toast.error("Failed to update permissions");
      return;
    }

    setTeam(prev => prev.map(m => m.id === editingMember.id ? { ...m, role: editRole, permissions: permissionsArray } : m));
    setEditingMember(null);
    toast.success(`Permissions updated for ${editingMember.name}`);
  };

  // Calculate sum of all tracking links for a promoter
  const getPromoterTotals = (member: TeamMember) => {
    const links = member.trackingLinks || [];
    const totalClicks = links.reduce((s, l) => s + l.clicks, 0);
    const totalSales = links.reduce((s, l) => s + l.sales, 0);
    const totalRevenue = links.reduce((s, l) => s + parseFloat(l.revenue.replace("$", "")), 0);
    const conversion = totalClicks > 0 ? ((totalSales / totalClicks) * 100).toFixed(1) : "0.0";
    return { totalClicks, totalSales, totalRevenue, conversion };
  };

  return (
    <div className="space-y-8">
      {/* Team Members */}
      <div className="bg-card rounded-3xl border border-border overflow-hidden">
        <div className="px-6 py-5 border-b border-border flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-lg font-black tracking-tight">Team Members</h2>
            <p className="text-xs text-muted-foreground mt-0.5">{team.length} members on this event</p>
          </div>
          <Button
            onClick={() => setShowInviteModal(true)}
            className="gap-2 rounded-full font-bold bg-[hsl(var(--brand-pink))] text-primary-foreground hover:bg-[hsl(var(--brand-pink))]/90"
          >
            <UserPlus className="w-4 h-4" />
            Add Team Member
          </Button>
        </div>
        {teamLoading ? (
          <div className="px-6 py-10 text-center">
            <p className="text-sm text-muted-foreground">Loading team members...</p>
          </div>
        ) : team.length === 0 ? (
          <div className="px-6 py-10 text-center">
            <Users className="w-8 h-8 text-muted-foreground mx-auto mb-3 opacity-40" />
            <p className="text-sm text-muted-foreground">No team members yet</p>
            <p className="text-xs text-muted-foreground mt-1">Invite promoters, staff, and scanners to help manage this event</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="text-left px-6 py-3 font-bold text-[10px] uppercase tracking-[0.15em]">Member</th>
                  <th className="text-left px-6 py-3 font-bold text-[10px] uppercase tracking-[0.15em]">Role</th>
                  <th className="text-left px-6 py-3 font-bold text-[10px] uppercase tracking-[0.15em]">Status</th>
                   <th className="text-left px-6 py-3 font-bold text-[10px] uppercase tracking-[0.15em]">Clicks</th>
                   <th className="text-left px-6 py-3 font-bold text-[10px] uppercase tracking-[0.15em]">Sales</th>
                   <th className="text-left px-6 py-3 font-bold text-[10px] uppercase tracking-[0.15em]">Conversion</th>
                   <th className="text-left px-6 py-3 font-bold text-[10px] uppercase tracking-[0.15em]">Revenue</th>
                   <th className="text-right px-6 py-3 font-bold text-[10px] uppercase tracking-[0.15em]">Actions</th>
                </tr>
              </thead>
              <tbody>
                {team.map((m) => {
                  const totals = getPromoterTotals(m);
                  return (
                    <tr key={m.id} className="border-b border-border last:border-0 hover:bg-secondary/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <Avatar className="w-9 h-9 border border-border">
                            <AvatarImage src={m.avatarUrl} />
                            <AvatarFallback className="bg-secondary text-foreground font-bold text-xs">
                              {getInitials(m.name)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <button
                              onClick={() => setSelectedMember(m)}
                              className="font-bold text-foreground hover:text-[hsl(var(--brand-pink))] hover:underline transition-colors cursor-pointer text-left"
                            >
                              {m.name}
                            </button>
                            <p className="text-[10px] text-muted-foreground">{m.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold ${roleConfig[m.role].color}`}>
                          {roleConfig[m.role].icon}
                          {roleConfig[m.role].label}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                          m.status === "active"
                            ? "bg-[hsl(var(--brand-lime))]/15 text-foreground dark:text-[hsl(var(--brand-lime))]"
                            : "bg-accent text-muted-foreground"
                        }`}>
                          {m.status === "active" ? "Active" : "Pending"}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-bold text-foreground tabular-nums">{totals.totalClicks}</td>
                      <td className="px-6 py-4 font-bold text-foreground tabular-nums">{totals.totalSales}</td>
                      <td className="px-6 py-4 font-bold text-muted-foreground tabular-nums">{totals.conversion}%</td>
                      <td className="px-6 py-4 font-bold text-[hsl(var(--brand-pink))] tabular-nums">${totals.totalRevenue.toFixed(2)}</td>
                      <td className="px-6 py-4 text-right flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-foreground"
                          onClick={() => {
                            const link = `${window.location.origin}/event/${eventId}?ref=${m.email.split("@")[0]}`;
                            navigator.clipboard.writeText(link);
                            toast.success("Promoter link copied!");
                          }}
                        >
                          <Copy className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          onClick={() => handleRemoveMember(m.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Main Links */}
      <div className="bg-card rounded-3xl border border-border overflow-hidden">
        <div className="px-6 py-5 border-b border-border">
          <h2 className="text-lg font-black tracking-tight">Main Links</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Default tracking links for every event</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                <th className="text-left px-6 py-3 font-bold text-[10px] uppercase tracking-[0.15em]">Link</th>
                <th className="text-left px-6 py-3 font-bold text-[10px] uppercase tracking-[0.15em]">Clicks</th>
                <th className="text-left px-6 py-3 font-bold text-[10px] uppercase tracking-[0.15em]">Sales</th>
                <th className="text-left px-6 py-3 font-bold text-[10px] uppercase tracking-[0.15em]">Conversion</th>
                <th className="text-left px-6 py-3 font-bold text-[10px] uppercase tracking-[0.15em]">Revenue</th>
                <th className="text-right px-6 py-3 font-bold text-[10px] uppercase tracking-[0.15em]"></th>
              </tr>
            </thead>
            <tbody>
              {mainLinks.map((link) => (
                <tr key={link.id} className="border-b border-border last:border-0 hover:bg-secondary/50 transition-colors">
                  <td className="px-6 py-4 font-bold text-foreground">{link.label}</td>
                  <td className="px-6 py-4 font-bold text-foreground tabular-nums">{link.clicks.toLocaleString()}</td>
                  <td className="px-6 py-4 font-bold text-foreground tabular-nums">{link.sales}</td>
                  <td className="px-6 py-4 font-bold text-foreground tabular-nums">{link.clicks > 0 ? `${((link.sales / link.clicks) * 100).toFixed(1)}%` : "0%"}</td>
                  <td className="px-6 py-4 font-bold text-[hsl(var(--brand-pink))] tabular-nums">{link.revenue}</td>
                  <td className="px-6 py-4 text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-foreground"
                      onClick={() => handleCopyLink(link.url, link.id)}
                    >
                      {copiedLink === link.id ? <Check className="w-4 h-4 text-[hsl(var(--brand-lime))]" /> : <Copy className="w-4 h-4" />}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Tracking Links */}
      <div className="bg-card rounded-3xl border border-border overflow-hidden">
        <div className="px-6 py-5 border-b border-border flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-lg font-black tracking-tight">Tracking Links</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Custom tracking links for campaigns and promoters</p>
          </div>
          <Button
            onClick={() => { setNewLinkLabel(""); setNewLinkSlug(""); setShowCreateLinkModal(true); }}
            className="gap-2 rounded-full font-bold bg-[hsl(var(--brand-pink))] text-primary-foreground hover:bg-[hsl(var(--brand-pink))]/90"
          >
            <Link2 className="w-4 h-4" />
            Create Tracking Link
          </Button>
        </div>
        {trackingLinks.length === 0 ? (
          <div className="px-6 py-10 text-center">
            <Link2 className="w-8 h-8 text-muted-foreground mx-auto mb-3 opacity-40" />
            <p className="text-sm text-muted-foreground">No custom tracking links yet</p>
            <p className="text-xs text-muted-foreground mt-1">Create a tracking link to monitor specific campaigns</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="text-left px-6 py-3 font-bold text-[10px] uppercase tracking-[0.15em]">Link</th>
                  <th className="text-left px-6 py-3 font-bold text-[10px] uppercase tracking-[0.15em]">Clicks</th>
                  <th className="text-left px-6 py-3 font-bold text-[10px] uppercase tracking-[0.15em]">Sales</th>
                  <th className="text-left px-6 py-3 font-bold text-[10px] uppercase tracking-[0.15em]">Conversion</th>
                  <th className="text-left px-6 py-3 font-bold text-[10px] uppercase tracking-[0.15em]">Revenue</th>
                  <th className="text-left px-6 py-3 font-bold text-[10px] uppercase tracking-[0.15em]">Created By</th>
                  <th className="text-right px-6 py-3 font-bold text-[10px] uppercase tracking-[0.15em]"></th>
                </tr>
              </thead>
              <tbody>
                {trackingLinks.map((link) => (
                  <tr key={link.id} className="border-b border-border last:border-0 hover:bg-secondary/50 transition-colors">
                    <td className="px-6 py-4 font-bold text-foreground">{link.label}</td>
                    <td className="px-6 py-4 font-bold text-foreground tabular-nums">{link.clicks.toLocaleString()}</td>
                    <td className="px-6 py-4 font-bold text-foreground tabular-nums">{link.sales}</td>
                    <td className="px-6 py-4 font-bold text-foreground tabular-nums">{link.clicks > 0 ? `${((link.sales / link.clicks) * 100).toFixed(1)}%` : "0%"}</td>
                    <td className="px-6 py-4 font-bold text-[hsl(var(--brand-pink))] tabular-nums">{link.revenue}</td>
                    <td className="px-6 py-4 text-muted-foreground">{link.createdBy}</td>
                    <td className="px-6 py-4 text-right flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                        onClick={() => handleCopyLink(link.url, link.id)}
                      >
                        {copiedLink === link.id ? <Check className="w-4 h-4 text-[hsl(var(--brand-lime))]" /> : <Copy className="w-4 h-4" />}
                      </Button>
                      {!link.createdByAdmin && link.sales === 0 && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          onClick={async () => {
                            await supabase.from("tracking_links").delete().eq("id", link.id);
                            setTrackingLinks(prev => prev.filter(l => l.id !== link.id));
                            toast.success("Tracking link removed");
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Invite Team Member Modal */}
      <Dialog open={showInviteModal} onOpenChange={setShowInviteModal}>
        <DialogContent className="sm:max-w-[580px] rounded-3xl p-0 overflow-hidden max-h-[85vh] flex flex-col">
          <DialogHeader className="px-6 pt-6 pb-0 flex-shrink-0">
            <DialogTitle className="text-lg font-black tracking-tight">Add Team Member</DialogTitle>
          </DialogHeader>
          <div className="px-6 pb-6 space-y-5 overflow-y-auto flex-1">
            {/* Existing Org Members */}
            {(() => {
              const currentEmails = new Set(team.map(m => m.email.toLowerCase().trim()));
              const available = orgMembers.filter(m => !currentEmails.has(m.email.toLowerCase().trim()));
              if (available.length === 0) return null;
              return (
                <div>
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 block">From Your Organization</label>
                  <div className="space-y-1 max-h-[160px] overflow-y-auto rounded-xl bg-secondary/50 p-2">
                    {available.map((m) => (
                      <button
                        key={m.email}
                        onClick={() => {
                          setInviteEmail(m.email);
                          const mappedRole = (["admin", "promoter", "staff", "scanner"].includes(m.role) ? m.role : "promoter") as TeamRole;
                          handleRoleChange(mappedRole);
                        }}
                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl transition-colors text-left ${
                          inviteEmail.toLowerCase() === m.email.toLowerCase()
                            ? "bg-[hsl(var(--brand-pink))]/10 ring-1 ring-[hsl(var(--brand-pink))]/30"
                            : "hover:bg-secondary"
                        }`}
                      >
                        <Avatar className="w-7 h-7 border border-border">
                          <AvatarImage src={m.avatarUrl} />
                          <AvatarFallback className="bg-secondary text-foreground font-bold text-[10px]">
                            {m.name?.charAt(0)?.toUpperCase() || "?"}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-foreground truncate">{m.name}</p>
                          <p className="text-[10px] text-muted-foreground truncate">{m.email}</p>
                        </div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{m.role}</span>
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-3 my-3">
                    <div className="flex-1 h-px bg-border" />
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">or enter email</span>
                    <div className="flex-1 h-px bg-border" />
                  </div>
                </div>
              );
            })()}

            {/* Email */}
            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5 block">Email</label>
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="email@example.com"
                className="w-full bg-secondary border-none rounded-xl py-2.5 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--brand-pink))] transition-all placeholder:text-muted-foreground"
              />
            </div>

            {/* Role Selection */}
            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 block">Role</label>
              <div className="grid grid-cols-4 gap-2">
                {(["admin", "promoter", "staff", "scanner"] as TeamRole[]).map((role) => (
                  <button
                    key={role}
                    onClick={() => handleRoleChange(role)}
                    className={`flex flex-col items-center gap-1.5 px-3 py-3 rounded-2xl border-2 transition-all text-center ${
                      inviteRole === role
                        ? "border-[hsl(var(--brand-pink))] bg-[hsl(var(--brand-pink))]/5"
                        : "border-border hover:border-muted-foreground/30"
                    }`}
                  >
                    <span className={`w-8 h-8 rounded-full flex items-center justify-center ${roleConfig[role].color}`}>
                      {roleConfig[role].icon}
                    </span>
                    <span className="text-xs font-bold text-foreground">{roleConfig[role].label}</span>
                  </button>
                ))}
              </div>
              {inviteRole === "promoter" && (
                <p className="text-[10px] text-muted-foreground mt-2 bg-secondary rounded-xl px-3 py-2">
                  Promoters can track their sales, see only revenue generated by them, and create their own tracking links.
                </p>
              )}
            </div>

            {/* Permissions */}
            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3 block">Permissions</label>
              <div className="space-y-4">
                {permissionGroups.map((group) => (
                  <div key={group.category}>
                    <h4 className="text-xs font-black text-foreground mb-2 flex items-center gap-2">
                      {group.category === "Attendees" && <Users className="w-3.5 h-3.5" />}
                      {group.category === "Orders" && <ClipboardList className="w-3.5 h-3.5" />}
                      {group.category === "Event" && <Settings className="w-3.5 h-3.5" />}
                      {group.category}
                    </h4>
                    <div className="space-y-1">
                      {group.permissions.filter(perm => !ADMIN_ONLY_PERMISSIONS.has(perm.key) || inviteRole === "admin").map((perm) => (
                        <label
                          key={perm.key}
                          className="flex items-start gap-3 cursor-pointer group px-3 py-2 rounded-xl hover:bg-secondary/60 transition-colors"
                        >
                          <Checkbox
                            checked={invitePermissions.has(perm.key)}
                            onCheckedChange={() => togglePermission(perm.key)}
                            className="mt-0.5"
                          />
                          <div className="flex-1 min-w-0">
                            <span className="text-sm font-bold text-foreground block leading-tight">{perm.label}</span>
                            <span className="text-[11px] text-muted-foreground leading-tight">{perm.description}</span>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Send Invitation */}
            <div className="flex gap-2 pt-2">
              <Button variant="ghost" className="flex-1 rounded-full" onClick={() => setShowInviteModal(false)}>
                Cancel
              </Button>
              <Button
                className="flex-1 rounded-full font-bold bg-[hsl(var(--brand-pink))] text-primary-foreground hover:bg-[hsl(var(--brand-pink))]/90 gap-2"
                onClick={handleInvite}
                disabled={!inviteEmail || invitationLoading}
              >
                {invitationLoading ? (
                  <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Mail className="w-4 h-4" />
                )}
                {invitationLoading ? "Sending..." : "Send Invitation"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Member Detail Modal */}
      <Dialog open={!!selectedMember} onOpenChange={(open) => !open && setSelectedMember(null)}>
        <DialogContent className="sm:max-w-[500px] rounded-3xl p-0 overflow-hidden">
          <DialogHeader className="px-6 pt-6 pb-0">
            <DialogTitle className="text-lg font-black tracking-tight">Team Member</DialogTitle>
          </DialogHeader>
          {selectedMember && (
            <div className="px-6 pb-6 space-y-5">
              <div className="flex items-center gap-4">
                <Avatar className="w-14 h-14 border-2 border-border">
                  <AvatarImage src={selectedMember.avatarUrl} />
                  <AvatarFallback className="bg-secondary text-foreground font-black text-lg">
                    {getInitials(selectedMember.name)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="text-lg font-black text-foreground">{selectedMember.name}</h3>
                  <p className="text-sm text-muted-foreground">{selectedMember.email}</p>
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold mt-1 ${roleConfig[selectedMember.role].color}`}>
                    {roleConfig[selectedMember.role].icon}
                    {roleConfig[selectedMember.role].label}
                  </span>
                </div>
              </div>

              {/* Aggregate Stats */}
              {selectedMember.status === "active" && (() => {
                const totals = getPromoterTotals(selectedMember);
                return (
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-secondary/50 rounded-2xl p-3 text-center">
                      <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Clicks</p>
                      <p className="text-xl font-black text-foreground tabular-nums">{totals.totalClicks}</p>
                    </div>
                    <div className="bg-secondary/50 rounded-2xl p-3 text-center">
                      <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Sales</p>
                      <p className="text-xl font-black text-foreground tabular-nums">{totals.totalSales}</p>
                    </div>
                    <div className="bg-secondary/50 rounded-2xl p-3 text-center">
                      <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Revenue</p>
                      <p className="text-xl font-black text-[hsl(var(--brand-pink))] tabular-nums">${totals.totalRevenue.toFixed(2)}</p>
                    </div>
                  </div>
                );
              })()}


              {/* Permissions List */}
              <div>
                <h4 className="text-xs font-black uppercase tracking-[0.15em] text-muted-foreground mb-2">Permissions</h4>
                <div className="flex flex-wrap gap-1.5">
                  {(selectedMember.permissions || []).map(p => {
                    const perm = permissionGroups.flatMap(g => g.permissions).find(x => x.key === p);
                    return perm ? (
                      <span key={p} className="px-2 py-0.5 bg-secondary rounded-full text-[10px] font-bold text-muted-foreground">
                        {perm.label}
                      </span>
                    ) : null;
                  })}
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  className="flex-1 rounded-full font-bold gap-2 bg-[hsl(var(--brand-pink))] text-primary-foreground hover:bg-[hsl(var(--brand-pink))]/90"
                  onClick={() => {
                    openEditMember(selectedMember);
                    setSelectedMember(null);
                  }}
                >
                  <UserCog className="w-4 h-4" />
                  Edit Permissions
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Create Tracking Link Modal */}
      <Dialog open={showCreateLinkModal} onOpenChange={setShowCreateLinkModal}>
        <DialogContent className="sm:max-w-md rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-black tracking-tight">Create Tracking Link</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5 block">Label</label>
              <input
                type="text"
                value={newLinkLabel}
                onChange={(e) => {
                  setNewLinkLabel(e.target.value);
                  setNewLinkSlug(e.target.value.toLowerCase().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, ""));
                }}
                placeholder="e.g. Instagram Bio"
                className="w-full bg-secondary border-none rounded-xl py-2.5 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--brand-pink))] transition-all placeholder:text-muted-foreground"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5 block">Link Slug</label>
              <div className="flex items-center gap-0 bg-secondary rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-[hsl(var(--brand-pink))] transition-all">
                <span className="text-xs text-muted-foreground pl-4 pr-1 whitespace-nowrap font-mono">brazou.com/</span>
                <input
                  type="text"
                  value={newLinkSlug}
                  onChange={(e) => {
                    const val = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "");
                    setNewLinkSlug(val);
                  }}
                  placeholder="my-tracking-link"
                  className="flex-1 bg-transparent border-none py-2.5 pr-4 text-sm focus:outline-none placeholder:text-muted-foreground font-mono"
                />
              </div>
              <p className="text-[10px] text-muted-foreground mt-1.5">Auto-generated from label. Only lowercase letters, numbers, and hyphens allowed.</p>
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="ghost" className="flex-1 rounded-full" onClick={() => setShowCreateLinkModal(false)}>
                Cancel
              </Button>
              <Button
                className="flex-1 rounded-full font-bold bg-[hsl(var(--brand-pink))] text-primary-foreground hover:bg-[hsl(var(--brand-pink))]/90 gap-2"
                disabled={!newLinkLabel || !newLinkSlug}
                onClick={async () => {
                  if (!eventId) return;
                  const { data: session } = await supabase.auth.getSession();
                  const userId = session?.session?.user?.id;
                  if (!userId) { toast.error("Not authenticated"); return; }

                  const { data: inserted, error } = await supabase
                    .from("tracking_links")
                    .insert({ event_id: eventId, label: newLinkLabel, slug: newLinkSlug, created_by: userId })
                    .select()
                    .single();

                  if (error) {
                    toast.error(error.message.includes("duplicate") ? "A link with this slug already exists" : "Failed to create link");
                    return;
                  }

                  const newLink: TrackingLink = {
                    id: inserted.id,
                    label: inserted.label,
                    url: `${window.location.host}/${inserted.slug}`,
                    clicks: 0,
                    sales: 0,
                    revenue: "$0",
                    createdBy: "You",
                  };
                  setTrackingLinks(prev => [...prev, newLink]);
                  setShowCreateLinkModal(false);
                  toast.success("Tracking link created!");
                }}
              >
                <Link2 className="w-4 h-4" />
                Create Link
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Permissions Modal */}
      <Dialog open={!!editingMember} onOpenChange={(open) => !open && setEditingMember(null)}>
        <DialogContent className="sm:max-w-[580px] rounded-3xl p-0 overflow-hidden max-h-[85vh] flex flex-col">
          <DialogHeader className="px-6 pt-6 pb-0 flex-shrink-0">
            <DialogTitle className="text-lg font-black tracking-tight">Edit Permissions</DialogTitle>
          </DialogHeader>
          {editingMember && (
            <div className="px-6 pb-6 space-y-5 overflow-y-auto flex-1">
              <div className="flex items-center gap-3 bg-secondary/50 rounded-2xl p-3 border border-border/50">
                <Avatar className="w-10 h-10 border border-border">
                  <AvatarImage src={editingMember.avatarUrl} />
                  <AvatarFallback className="bg-secondary text-foreground font-bold text-xs">
                    {getInitials(editingMember.name)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-bold text-foreground text-sm">{editingMember.name}</p>
                  <p className="text-[10px] text-muted-foreground">{editingMember.email}</p>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 block">Role</label>
                <div className="grid grid-cols-4 gap-2">
                  {(["admin", "promoter", "staff", "scanner"] as TeamRole[]).map((role) => (
                    <button
                      key={role}
                      onClick={() => handleEditRoleChange(role)}
                      className={`flex flex-col items-center gap-1.5 px-3 py-3 rounded-2xl border-2 transition-all text-center ${
                        editRole === role
                          ? "border-[hsl(var(--brand-pink))] bg-[hsl(var(--brand-pink))]/5"
                          : "border-border hover:border-muted-foreground/30"
                      }`}
                    >
                      <span className={`w-8 h-8 rounded-full flex items-center justify-center ${roleConfig[role].color}`}>
                        {roleConfig[role].icon}
                      </span>
                      <span className="text-xs font-bold text-foreground">{roleConfig[role].label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3 block">Permissions</label>
                <div className="space-y-4">
                  {permissionGroups.map((group) => (
                    <div key={group.category}>
                      <h4 className="text-xs font-black text-foreground mb-2 flex items-center gap-2">
                        {group.category === "Attendees" && <Users className="w-3.5 h-3.5" />}
                        {group.category === "Orders" && <ClipboardList className="w-3.5 h-3.5" />}
                        {group.category === "Event" && <Settings className="w-3.5 h-3.5" />}
                        {group.category}
                      </h4>
                      <div className="space-y-1">
                        {group.permissions.filter(perm => !ADMIN_ONLY_PERMISSIONS.has(perm.key) || editRole === "admin").map((perm) => (
                          <label
                            key={perm.key}
                            className="flex items-start gap-3 cursor-pointer group px-3 py-2 rounded-xl hover:bg-secondary/60 transition-colors"
                          >
                            <Checkbox
                              checked={editPermissions.has(perm.key)}
                              onCheckedChange={() => toggleEditPermission(perm.key)}
                              className="mt-0.5"
                            />
                            <div className="flex-1 min-w-0">
                              <span className="text-sm font-bold text-foreground block leading-tight">{perm.label}</span>
                              <span className="text-[11px] text-muted-foreground leading-tight">{perm.description}</span>
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <Button variant="ghost" className="flex-1 rounded-full" onClick={() => setEditingMember(null)}>
                  Cancel
                </Button>
                <Button
                  className="flex-1 rounded-full font-bold bg-[hsl(var(--brand-pink))] text-primary-foreground hover:bg-[hsl(var(--brand-pink))]/90 gap-2"
                  onClick={handleSavePermissions}
                >
                  <Check className="w-4 h-4" />
                  Save Changes
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default EventTeamTab;
