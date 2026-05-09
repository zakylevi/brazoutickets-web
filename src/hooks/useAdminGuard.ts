import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

export const useAdminGuard = () => {
  const { session, authReady } = useAuth();
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState(false);
  const [checking, setChecking] = useState(true);
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const uid = session?.user?.id;

    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }

    if (!authReady) return;

    if (!uid) {
      setIsAdmin(false);
      setChecking(false);
      navigate("/auth", { replace: true });
      return;
    }

    let cancelled = false;
    setChecking(true);
    setIsAdmin(false);

    const checkAdmin = async (attempt = 0) => {
      const { data, error } = await supabase.rpc("has_role", {
        _user_id: uid,
        _role: "admin",
      });

      if (cancelled) return;

      if (!error) {
        const allowed = !!data;
        setIsAdmin(allowed);
        setChecking(false);

        if (!allowed) {
          navigate("/", { replace: true });
        }
        return;
      }

      const nextAttempt = attempt + 1;
      const delay = nextAttempt < 5 ? 400 * nextAttempt : 1500;

      retryTimeoutRef.current = setTimeout(() => {
        void checkAdmin(nextAttempt < 5 ? nextAttempt : 0);
      }, delay);
    };

    void checkAdmin();

    return () => {
      cancelled = true;
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }
    };
  }, [session?.user?.id, authReady, navigate]);

  return { isAdmin, checking };
};