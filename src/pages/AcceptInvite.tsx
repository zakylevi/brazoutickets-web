import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Check, X, Megaphone, ShieldCheck, ScanLine, Crown } from "lucide-react";

const AcceptInvite = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, session } = useAuth();
  const token = searchParams.get("token");
  const [invitation, setInvitation] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);

  useEffect(() => {
    if (!token) { setLoading(false); return; }

    const fetchInvitation = async () => {
      const { data, error } = await supabase.rpc("resolve_team_invitation", {
        _token: token,
      });

      if (error || !data || data.length === 0) {
        setLoading(false);
        return;
      }

      setInvitation(data[0]);
      setLoading(false);
    };

    fetchInvitation();
  }, [token]);

  const handleAccept = async () => {
    if (!invitation || !session?.user || !token) return;
    setAccepting(true);

    try {
      const { data, error } = await supabase.rpc("accept_team_invitation", {
        _token: token,
      });

      if (error) throw error;

      toast.success("Invitation accepted! You're now part of the team.");
      navigate(`/dashboard/${invitation.org_slug}/event/${invitation.event_id}`);
    } catch (err: any) {
      toast.error("Failed to accept invitation: " + err.message);
    } finally {
      setAccepting(false);
    }
  };

  const handleDecline = async () => {
    if (!invitation) return;
    // For decline, we still try the direct update — user might have RLS access
    await supabase
      .from("team_invitations")
      .update({ status: "declined", updated_at: new Date().toISOString() })
      .eq("id", invitation.id);

    toast.success("Invitation declined.");
    navigate("/");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[hsl(var(--brand-pink))] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!token || !invitation) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-6">
          <h1 className="text-2xl font-black text-foreground mb-2">Invalid Invitation</h1>
          <p className="text-muted-foreground mb-6">This invitation link is invalid or has expired.</p>
          <Button onClick={() => navigate("/")} className="rounded-full">Go Home</Button>
        </div>
      </div>
    );
  }

  if (invitation.status !== "pending") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-6">
          <h1 className="text-2xl font-black text-foreground mb-2">
            Invitation Already {invitation.status === "accepted" ? "Accepted" : "Declined"}
          </h1>
          <p className="text-muted-foreground mb-6">This invitation has already been responded to.</p>
          <Button onClick={() => navigate("/")} className="rounded-full">Go Home</Button>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-6">
          <h1 className="text-2xl font-black text-foreground mb-2">Sign In Required</h1>
          <p className="text-muted-foreground mb-6">
            Please sign in or create an account to accept this invitation from <strong>{invitation.org_name}</strong>.
          </p>
          <Button
            onClick={() => navigate(`/auth?redirect=/accept-invite?token=${token}`)}
            className="rounded-full bg-[hsl(var(--brand-pink))] text-primary-foreground hover:bg-[hsl(var(--brand-pink))]/90"
          >
            Sign In / Sign Up
          </Button>
        </div>
      </div>
    );
  }

  const roleIcons: Record<string, React.ReactNode> = {
    admin: <Crown className="w-6 h-6" />,
    promoter: <Megaphone className="w-6 h-6" />,
    staff: <ShieldCheck className="w-6 h-6" />,
    scanner: <ScanLine className="w-6 h-6" />,
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="max-w-md mx-auto px-6 w-full">
        <div className="bg-card rounded-3xl border border-border p-8 text-center space-y-6">
          <div className="w-16 h-16 rounded-full bg-[hsl(var(--brand-pink))]/10 flex items-center justify-center mx-auto text-[hsl(var(--brand-pink))]">
            {roleIcons[invitation.role] || <Megaphone className="w-6 h-6" />}
          </div>

          <div>
            <h1 className="text-2xl font-black text-foreground mb-1">You're Invited!</h1>
            <p className="text-muted-foreground">
              <strong className="text-foreground">{invitation.org_name}</strong> has invited you to join as a{" "}
              <strong className="text-[hsl(var(--brand-pink))]">{invitation.role}</strong> for the event:
            </p>
            <p className="text-lg font-bold text-foreground mt-2">{invitation.event_title}</p>
          </div>

          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1 rounded-full gap-2"
              onClick={handleDecline}
            >
              <X className="w-4 h-4" />
              Decline
            </Button>
            <Button
              className="flex-1 rounded-full font-bold gap-2 bg-[hsl(var(--brand-pink))] text-primary-foreground hover:bg-[hsl(var(--brand-pink))]/90"
              onClick={handleAccept}
              disabled={accepting}
            >
              {accepting ? (
                <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
              ) : (
                <Check className="w-4 h-4" />
              )}
              {accepting ? "Accepting..." : "Accept Invitation"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AcceptInvite;