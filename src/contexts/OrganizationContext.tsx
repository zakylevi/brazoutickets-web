import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type OrgType = "venue" | "event_organizer" | "person" | "community";

export interface OrgLink {
  label: string;
  url: string;
}

export interface OrgSocials {
  instagram?: string;
  tiktok?: string;
  x?: string;
  youtube?: string;
  website?: string;
}

export interface Organization {
  id: string;
  slug: string;
  name: string;
  avatarUrl?: string;
  type: OrgType;
  region: string;
  country: string;
  state: string;
  socials: OrgSocials;
  links: OrgLink[];
  createdAt: string;
  isPromoterOnly?: boolean;
}

interface OrganizationContextType {
  organizations: Organization[];
  loading: boolean;
  addOrganization: (org: Organization) => Promise<void>;
  updateOrganization: (id: string, data: Partial<Omit<Organization, "id" | "createdAt">>) => Promise<void>;
  getOrgBySlug: (slug: string) => Organization | undefined;
  refreshOrganizations: () => Promise<void>;
  isPromoterForOrg: (orgId: string) => boolean;
}

const OrganizationContext = createContext<OrganizationContextType | undefined>(undefined);

const dbRowToOrg = (row: any): Organization => ({
  id: row.id,
  slug: row.slug,
  name: row.name,
  avatarUrl: row.avatar_url || undefined,
  type: row.type as OrgType,
  region: row.region || "",
  country: row.country || "",
  state: row.state || "",
  socials: (row.socials as OrgSocials) || {},
  links: (row.links as OrgLink[]) || [],
  createdAt: row.created_at,
});

export const OrganizationProvider = ({ children }: { children: ReactNode }) => {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const { session, authReady } = useAuth();
  const userId = session?.user?.id;

  const fetchOrganizations = useCallback(async () => {
    if (!authReady) return;
    if (!userId) {
      setOrganizations([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    const { data: memberships } = await supabase
      .from("organization_members")
      .select("organization_id")
      .eq("user_id", userId);

    const { data: invitations } = await supabase
      .from("team_invitations")
      .select("organization_id, role")
      .eq("accepted_by", userId)
      .eq("status", "accepted");

    const orgIdsFromMemberships = (memberships || []).map((m) => m.organization_id);
    const promoterOrgIds = new Set(
      (invitations || []).filter((i) => i.role === "promoter").map((i) => i.organization_id)
    );
    const orgIdsFromInvitations = (invitations || []).map((i) => i.organization_id);
    const orgIds = [...new Set([...orgIdsFromMemberships, ...orgIdsFromInvitations])];

    if (orgIds.length === 0) {
      setOrganizations([]);
      setLoading(false);
      return;
    }

    const { data: orgs } = await supabase
      .from("organizations")
      .select("*")
      .in("id", orgIds)
      .order("created_at", { ascending: false });

    setOrganizations((orgs || []).map((row) => ({
      ...dbRowToOrg(row),
      isPromoterOnly: promoterOrgIds.has(row.id) && !orgIdsFromMemberships.includes(row.id),
    })));
    setLoading(false);
  }, [userId, authReady]);

  useEffect(() => {
    fetchOrganizations();
  }, [fetchOrganizations]);

  const addOrganization = async (org: Organization) => {
    if (!session?.user) throw new Error("Not authenticated");

    // Insert organization
    const { error: orgError } = await supabase.from("organizations").insert({
      id: org.id,
      slug: org.slug,
      name: org.name,
      avatar_url: org.avatarUrl || null,
      type: org.type,
      region: org.region,
      country: org.country,
      state: org.state,
      socials: org.socials as any,
      links: org.links as any,
      created_by: session.user.id,
    });

    if (orgError) throw orgError;

    // Add creator as owner
    const { error: memberError } = await supabase.from("organization_members").insert({
      organization_id: org.id,
      user_id: session.user.id,
      role: "owner" as const,
    });

    if (memberError) console.error("Failed to add member:", memberError);

    // Update local state
    setOrganizations((prev) => [org, ...prev]);
  };

  const updateOrganization = async (id: string, data: Partial<Omit<Organization, "id" | "createdAt">>) => {
    const { error } = await supabase.from("organizations").update({
      name: data.name,
      slug: data.slug,
      avatar_url: data.avatarUrl ?? null,
      type: data.type,
      region: data.region,
      country: data.country,
      state: data.state,
      socials: data.socials as any,
      links: data.links as any,
    }).eq("id", id);

    if (error) throw error;

    setOrganizations((prev) =>
      prev.map((o) => o.id === id ? { ...o, ...data } : o)
    );
  };

  const getOrgBySlug = (slug: string) => organizations.find((o) => o.slug === slug);
  const isPromoterForOrg = (orgId: string) => organizations.find((o) => o.id === orgId)?.isPromoterOnly ?? false;

  return (
    <OrganizationContext.Provider value={{ organizations, loading, addOrganization, updateOrganization, getOrgBySlug, refreshOrganizations: fetchOrganizations, isPromoterForOrg }}>
      {children}
    </OrganizationContext.Provider>
  );
};

export const useOrganizations = () => {
  const ctx = useContext(OrganizationContext);
  if (!ctx) throw new Error("useOrganizations must be used within OrganizationProvider");
  return ctx;
};
