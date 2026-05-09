import { useState, useEffect } from "react";
import { Users, Mail, Crown, Megaphone, ShieldCheck, ScanLine, ClipboardList, Settings, UserPlus, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganizations } from "@/contexts/OrganizationContext";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";

interface OrgTeamTabProps {
  orgSlug: string;
}

type TeamRole = "admin" | "promoter" | "staff" | "scanner";

const roleConfig: Record<TeamRole, { label: string; icon: React.ReactNode; color: string }> = {
  admin: { label: "Admin", icon: <Crown className="w-3.5 h-3.5" />, color: "bg-[hsl(var(--brand-pink))]/10 text-[hsl(var(--brand-pink))]" },
  promoter: { label: "Promoter", icon: <Megaphone className="w-3.5 h-3.5" />, color: "bg-[hsl(var(--brand-lime))]/15 text-foreground dark:text-[hsl(var(--brand-lime))]" },
  staff: { label: "Staff", icon: <ShieldCheck className="w-3.5 h-3.5" />, color: "bg-accent text-accent-foreground" },
  scanner: { label: "Scanner", icon: <ScanLine className="w-3.5 h-3.5" />, color: "bg-secondary text-muted-foreground" },
};

const roleDefaults: Record<TeamRole, string[]> = {
  admin: ["edit_event_visuals", "edit_event_settings", "edit_event_tickets", "view_attendees", "check_in_attendees", "view_send_comp_tickets"],
  promoter: ["view_attendees"],
  staff: ["view_attendees", "check_in_attendees"],
  scanner: ["check_in_attendees"],
};

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

const OrgTeamTab = ({ orgSlug }: OrgTeamTabProps) => {
  const { getOrgBySlug } = useOrganizations();
  const { session, authReady } = useAuth();
  const org = getOrgBySlug(orgSlug);
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Invite modal state
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<TeamRole>("promoter");
  const [invitePermissions, setInvitePermissions] = useState<Set<string>>(new Set(roleDefaults.promoter));
  const [selectedEventIds, setSelectedEventIds] = useState<Set<string>>(new Set());
  const [orgEvents, setOrgEvents] = useState<{ id: string; title: string; flyerUrl: string | null }[]>([]);
  const [invitationLoading, setInvitationLoading] = useState(false);
  const [orgMembers, setOrgMembers] = useState<{ email: string; name: string; avatarUrl: string; role: string; acceptedBy: string | null }[]>([]);

  // Fetch org events
  useEffect(() => {
    if (!org) return;
    (async () => {
      const { data } = await supabase
        .from("events")
        .select("id, title, flyer_url")
        .eq("organization_id", org.id)
        .eq("status", "live")
        .order("created_at", { ascending: false });
      if (data) setOrgEvents(data.map(e => ({ id: e.id, title: e.title, flyerUrl: e.flyer_url })));
    })();
  }, [org?.id]);

  // Fetch existing org members for quick-select
  useEffect(() => {
    if (!org || !authReady || !session?.user) return;
    (async () => {
      const { data: invitations } = await supabase
        .from("team_invitations")
        .select("email, role, accepted_by")
        .eq("organization_id", org.id)
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

      setOrgMembers(Array.from(uniqueEmails.values()).map((inv) => {
        const profile = inv.accepted_by ? profilesMap.get(inv.accepted_by) : null;
        return {
          email: inv.email.toLowerCase().trim(),
          name: profile?.name || inv.email.split("@")[0],
          avatarUrl: profile?.avatar_url || "",
          role: inv.role,
          acceptedBy: inv.accepted_by,
        };
      }));
    })();
  }, [org?.id, authReady, session?.user]);

  const handleRoleChange = (role: TeamRole) => {
    setInviteRole(role);
    setInvitePermissions(new Set(roleDefaults[role]));
  };

  const togglePermission = (key: string) => {
    setInvitePermissions(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const toggleEventSelection = (eventId: string) => {
    setSelectedEventIds(prev => {
      const next = new Set(prev);
      if (next.has(eventId)) next.delete(eventId); else next.add(eventId);
      return next;
    });
  };

  const handleInvite = async () => {
    if (!inviteEmail) { toast.error("Please enter an email address"); return; }
    if (selectedEventIds.size === 0) { toast.error("Please select at least one event"); return; }
    if (!org) return;

    setInvitationLoading(true);
    try {
      const userId = session?.user?.id;
      if (!userId) { toast.error("Not authenticated"); return; }

      const emailNormalized = inviteEmail.toLowerCase().trim();
      const permissionsArray = Array.from(invitePermissions);
      const existingOrgMember = orgMembers.find(m => m.email === emailNormalized);
      const isExistingMember = !!existingOrgMember?.acceptedBy;

      let successCount = 0;
      let skipCount = 0;

      for (const eventId of selectedEventIds) {
        const { error } = await supabase.from("team_invitations").insert({
          event_id: eventId,
          organization_id: org.id,
          email: emailNormalized,
          role: inviteRole,
          permissions: permissionsArray as any,
          invited_by: userId,
          status: isExistingMember ? "accepted" : "pending",
          ...(isExistingMember ? { accepted_by: existingOrgMember.acceptedBy } : {}),
        });

        if (error) {
          if (error.message.includes("duplicate") || error.message.includes("unique")) {
            skipCount++;
          } else {
            toast.error("Failed to send invitation: " + error.message);
            return;
          }
        } else {
          successCount++;
        }
      }

      if (!isExistingMember && successCount > 0) {
        try {
          const firstEventId = [...selectedEventIds][0];
          await supabase.functions.invoke("send-team-invite", {
            body: {
              email: emailNormalized,
              eventId: firstEventId,
              organizationId: org.id,
              role: inviteRole,
            },
          });
        } catch {}
      }

      setShowInviteModal(false);
      setInviteEmail("");
      setSelectedEventIds(new Set());
      setInviteRole("promoter");
      setInvitePermissions(new Set(roleDefaults.promoter));

      if (skipCount > 0 && successCount === 0) {
        toast.error("Already invited to all selected events");
      } else if (skipCount > 0) {
        toast.success(`Added to ${successCount} event${successCount > 1 ? "s" : ""} (${skipCount} already invited)`);
      } else {
        toast.success(
          isExistingMember
            ? `${existingOrgMember.name} added to ${successCount} event${successCount > 1 ? "s" : ""}`
            : `Invitation sent to ${emailNormalized} for ${successCount} event${successCount > 1 ? "s" : ""}`
        );
      }
      fetchTeam();
    } finally {
      setInvitationLoading(false);
    }
  };

  const fetchTeam = async () => {
    if (!org) return;
    setLoading(true);

    const { data: invitations } = await supabase
      .from("team_invitations")
      .select("id, email, role, status, accepted_by, event_id, permissions")
      .eq("organization_id", org.id);

    if (!invitations || invitations.length === 0) {
      setTeamMembers([]);
      setLoading(false);
      return;
    }

    const acceptedUserIds = invitations.filter(i => i.accepted_by).map(i => i.accepted_by as string);
    const uniqueUserIds = [...new Set(acceptedUserIds)];

    let profilesMap = new Map<string, any>();
    if (uniqueUserIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, name, email, phone, avatar_url")
        .in("user_id", uniqueUserIds);
      if (profiles) profiles.forEach(p => profilesMap.set(p.user_id, p));
    }

    const eventIds = [...new Set(invitations.map(i => i.event_id))];
    const { data: trackingLinks } = await supabase
      .from("tracking_links")
      .select("slug, created_by, event_id")
      .in("event_id", eventIds);

    const { data: orders } = await supabase
      .from("orders")
      .select("ref_source, event_id, unit_price, quantity, discount, refunded_amount, status")
      .in("event_id", eventIds)
      .eq("status", "completed");

    const memberMap = new Map<string, {
      name: string; email: string; phone: string; avatarUrl: string;
      totalRevenue: number; eventCount: number; role: string; status: string;
    }>();

    invitations.forEach(inv => {
      const userId = inv.accepted_by;
      const key = userId || inv.email;
      const existing = memberMap.get(key);

      if (!existing) {
        const profile = userId ? profilesMap.get(userId) : null;
        memberMap.set(key, {
          name: profile?.name || inv.email.split("@")[0],
          email: profile?.email || inv.email,
          phone: profile?.phone || "",
          avatarUrl: profile?.avatar_url || "",
          totalRevenue: 0,
          eventCount: 1,
          role: inv.role,
          status: inv.status,
        });
      } else {
        existing.eventCount += 1;
      }

      if (userId && trackingLinks && orders) {
        const memberLinks = trackingLinks.filter(tl => tl.created_by === userId && tl.event_id === inv.event_id);
        const memberSlugs = new Set(memberLinks.map(l => l.slug));
        const memberOrders = orders.filter(o => o.event_id === inv.event_id && memberSlugs.has(o.ref_source));
        const revenue = memberOrders.reduce((sum, o) => {
          const gross = Math.max(0, Number(o.unit_price) || 0) * Math.max(1, o.quantity || 1);
          const discount = Math.max(0, Number(o.discount) || 0);
          const refunded = Math.max(0, Number(o.refunded_amount) || 0);
          return sum + (gross - discount - refunded);
        }, 0);
        memberMap.get(key)!.totalRevenue += revenue;
      }
    });

    setTeamMembers(Array.from(memberMap.entries()).map(([key, m]) => ({ id: key, ...m })));
    setLoading(false);
  };

  useEffect(() => { fetchTeam(); }, [org?.id]);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl md:text-4xl font-black tracking-tighter text-foreground mb-1">Team</h1>
          <p className="text-muted-foreground text-sm">All team members across your events.</p>
        </div>
        <Button
          onClick={() => setShowInviteModal(true)}
          className="gap-2 rounded-full font-bold bg-[hsl(var(--brand-pink))] text-primary-foreground hover:bg-[hsl(var(--brand-pink))]/90"
        >
          <UserPlus className="w-4 h-4" />
          Add Member
        </Button>
      </div>

      {loading ? (
        <div className="text-center py-16 text-muted-foreground text-sm">Loading team members...</div>
      ) : teamMembers.length === 0 ? (
        <div className="text-center py-16">
          <Users className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground text-sm">No team members added yet.</p>
          <p className="text-muted-foreground text-xs mt-1">Click "Add Member" to invite someone to your team.</p>
        </div>
      ) : (
        <div className="bg-card rounded-3xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Member</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Email</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Phone</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Role</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Events</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground text-right">Total Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {teamMembers.map(member => (
                  <tr key={member.id} className="group hover:bg-secondary/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9 ring-2 ring-border">
                          <AvatarImage src={member.avatarUrl} />
                          <AvatarFallback className="text-xs font-bold bg-secondary">
                            {member.name?.charAt(0)?.toUpperCase() || "?"}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-bold text-sm text-foreground">{member.name}</p>
                          {member.status === "pending" && (
                            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Pending</span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-muted-foreground">{member.email}</td>
                    <td className="px-6 py-4 text-sm text-muted-foreground">{member.phone || "—"}</td>
                    <td className="px-6 py-4">
                      <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{member.role}</span>
                    </td>
                    <td className="px-6 py-4 text-sm font-bold text-foreground tabular-nums">{member.eventCount}</td>
                    <td className="px-6 py-4 text-right font-black text-[hsl(var(--brand-pink))] tabular-nums">
                      ${member.totalRevenue.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Invite Team Member Modal — same layout as Event Dashboard */}
      <Dialog open={showInviteModal} onOpenChange={setShowInviteModal}>
        <DialogContent className="sm:max-w-[580px] rounded-3xl p-0 overflow-hidden max-h-[85vh] flex flex-col">
          <DialogHeader className="px-6 pt-6 pb-0 flex-shrink-0">
            <DialogTitle className="text-lg font-black tracking-tight">Add Team Member</DialogTitle>
          </DialogHeader>
          <div className="px-6 pb-6 space-y-5 overflow-y-auto flex-1">
            {/* Event Selection */}
            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 block">
                Events {selectedEventIds.size > 0 && <span className="text-[hsl(var(--brand-pink))]">({selectedEventIds.size} selected)</span>}
              </label>
              {orgEvents.length === 0 ? (
                <p className="text-sm text-muted-foreground bg-secondary rounded-xl px-4 py-3">No live events available.</p>
              ) : (
                <div className="space-y-1.5 max-h-[180px] overflow-y-auto rounded-xl bg-secondary/50 p-2">
                  {orgEvents.map(ev => {
                    const isSelected = selectedEventIds.has(ev.id);
                    return (
                      <button
                        key={ev.id}
                        onClick={() => toggleEventSelection(ev.id)}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-left ${
                          isSelected
                            ? "bg-[hsl(var(--brand-pink))]/10 ring-1 ring-[hsl(var(--brand-pink))]/30"
                            : "hover:bg-secondary"
                        }`}
                      >
                        <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                          isSelected
                            ? "border-[hsl(var(--brand-pink))] bg-[hsl(var(--brand-pink))]"
                            : "border-border"
                        }`}>
                          {isSelected && <Check className="w-3 h-3 text-primary-foreground" />}
                        </div>
                        {ev.flyerUrl && (
                          <img src={ev.flyerUrl} alt="" className="w-8 h-8 rounded-lg object-cover flex-shrink-0" />
                        )}
                        <span className="text-sm font-bold text-foreground truncate flex-1">{ev.title}</span>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[hsl(var(--brand-lime))]">Live</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Existing Org Members quick-select */}
            {(() => {
              const available = orgMembers;
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
                className="w-full bg-secondary border-none rounded-xl py-2.5 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--brand-pink))] transition-all placeholder:text-muted-foreground text-foreground"
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
                disabled={!inviteEmail || selectedEventIds.size === 0 || invitationLoading}
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
    </div>
  );
};

export default OrgTeamTab;
