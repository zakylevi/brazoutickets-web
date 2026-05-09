import { useEffect, useState } from "react";
import { ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

interface OrgWithFollowers {
  id: string;
  name: string;
  slug: string;
  avatar_url: string | null;
  totalFollowers: number;
}

const TopOrganizers = () => {
  const [orgs, setOrgs] = useState<OrgWithFollowers[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const [orgRes, followerRes] = await Promise.all([
        supabase.from("organizations").select("id, name, slug, avatar_url"),
        supabase.from("organization_followers").select("organization_id"),
      ]);

      const organizations = orgRes.data || [];
      const followers = followerRes.data || [];

      const followerMap = new Map<string, number>();
      followers.forEach((f: { organization_id: string }) => {
        followerMap.set(f.organization_id, (followerMap.get(f.organization_id) || 0) + 1);
      });

      const ranked = organizations
        .map(o => ({
          id: o.id,
          name: o.name,
          slug: o.slug,
          avatar_url: o.avatar_url,
          totalFollowers: followerMap.get(o.id) || 0,
        }))
        .sort((a, b) => b.totalFollowers - a.totalFollowers)
        .slice(0, 5);

      setOrgs(ranked);
      setLoading(false);
    };
    fetch();
  }, []);

  if (loading) {
    return (
      <section className="py-24 bg-secondary-container">
        <div className="max-w-7xl mx-auto px-8">
          <div className="mb-16">
            <h2 className="text-4xl md:text-5xl font-black tracking-tight mb-4 text-on-background">Top Organizers</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="bg-surface p-8 rounded-4xl flex flex-col items-center text-center border border-border animate-pulse">
                <div className="w-24 h-24 rounded-full bg-secondary mb-6" />
                <div className="h-5 w-24 bg-secondary rounded mb-2" />
                <div className="h-3 w-16 bg-secondary rounded" />
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (orgs.length === 0) return null;

  return (
    <section className="py-24 bg-secondary-container">
      <div className="max-w-7xl mx-auto px-8">
        <div className="mb-16 flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <h2 className="text-4xl md:text-5xl font-black tracking-tight mb-4 text-on-background">Top Organizers</h2>
            <p className="text-muted-foreground max-w-lg text-lg font-medium leading-relaxed">
              The masters of curation and entertainment, bringing you the finest experiences.
            </p>
          </div>
          <Link to="/explore" className="bg-surface border border-border text-foreground px-8 py-3.5 rounded-full font-bold hover:shadow-lg transition-all">
            View All Partners
          </Link>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6">
          {orgs.map((org) => (
            <Link
              to={`/org/${org.slug}`}
              key={org.id}
              className="bg-surface p-8 rounded-4xl flex flex-col items-center text-center shadow-sm border border-border transition-all hover:-translate-y-2 hover:shadow-xl group"
            >
              <div className="relative mb-6">
                <div className="w-24 h-24 rounded-full overflow-hidden border-[6px] border-secondary shadow-inner group-hover:border-brand-lime transition-colors">
                  {org.avatar_url ? (
                    <img alt={org.name} className="w-full h-full object-cover" src={org.avatar_url} loading="lazy" decoding="async" />
                  ) : (
                    <div className="w-full h-full bg-secondary flex items-center justify-center">
                      <span className="text-2xl font-black text-muted-foreground">{org.name[0]}</span>
                    </div>
                  )}
                </div>
              </div>
              <h4 className="font-bold text-lg mb-1 text-on-background">{org.name}</h4>
              <p className="text-muted-foreground text-xs font-bold uppercase tracking-widest mb-6">{org.totalFollowers.toLocaleString()} Followers</p>
              <span className="w-full py-3 rounded-full bg-secondary text-foreground font-bold text-sm group-hover:bg-brand-pink group-hover:text-primary-foreground transition-all hidden md:block">
                View Organizer
              </span>
              <span className="w-10 h-10 rounded-full bg-secondary text-foreground flex items-center justify-center group-hover:bg-brand-pink group-hover:text-primary-foreground transition-all md:hidden">
                <ChevronRight className="w-5 h-5" />
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
};

export default TopOrganizers;
