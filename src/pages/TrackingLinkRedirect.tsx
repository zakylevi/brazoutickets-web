import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

const TrackingLinkRedirect = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!slug) {
      setNotFound(true);
      return;
    }

    const resolveTrackingLink = async () => {
      const normalizedSlug = decodeURIComponent(slug).trim();
      const { data, error } = await supabase.rpc("resolve_tracking_link", {
        _slug: normalizedSlug,
      });

      const resolvedLink = Array.isArray(data) ? data[0] : null;

      if (error || !resolvedLink?.event_id || !resolvedLink?.slug) {
        setNotFound(true);
        return;
      }

      localStorage.setItem("ref_source", resolvedLink.slug);
      navigate(`/event/${resolvedLink.event_id}?ref=${encodeURIComponent(resolvedLink.slug)}`, { replace: true });
    };

    void resolveTrackingLink();
  }, [slug, navigate]);

  if (notFound) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-muted px-4">
        <div className="text-center">
          <h1 className="mb-4 text-4xl font-bold">404</h1>
          <p className="mb-4 text-xl text-muted-foreground">Tracking link not found</p>
          <Link to="/" className="text-primary underline hover:text-primary/90">
            Return to Home
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted px-4">
      <p className="font-medium text-muted-foreground">Redirecting…</p>
    </main>
  );
};

export default TrackingLinkRedirect;
