import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export interface UserProfile {
  name: string;
  email: string;
  phone: string;
  avatarUrl?: string;
}

interface AuthContextType {
  user: UserProfile | null;
  session: Session | null;
  loading: boolean;
  authReady: boolean;
  login: (email: string, password: string) => Promise<{ error: string | null }>;
  signup: (email: string, password: string, name: string, phone: string) => Promise<{ error: string | null }>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  authReady: false,
  login: async () => ({ error: null }),
  signup: async () => ({ error: null }),
  logout: async () => {},
  refreshProfile: async () => {},
});

export const useAuth = () => useContext(AuthContext);

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PROJECT_ID = import.meta.env.VITE_SUPABASE_PROJECT_ID;

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [authReady, setAuthReady] = useState(false);
  const initializedRef = useRef(false);
  const loggingOutRef = useRef(false);

  const withTimeout = async <T,>(promise: Promise<T>, ms = 12000): Promise<T> => {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error("Request timeout. Please try again.")), ms);
    });

    try {
      return await Promise.race([promise, timeoutPromise]);
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }
  };

  const getAuthErrorMessage = (error: unknown, fallback: string) => {
    if (error instanceof Error && error.message) return error.message;
    return fallback;
  };

  const getAuthStorageKeys = () => {
    const projectRef = (() => {
      try {
        return new URL(SUPABASE_URL).hostname.split(".")[0] || null;
      } catch {
        return null;
      }
    })();

    return Array.from(
      new Set(
        [projectRef, SUPABASE_PROJECT_ID, "supabase.auth.token"]
          .filter(Boolean)
          .flatMap((value) =>
            value === "supabase.auth.token"
              ? [value]
              : [`sb-${value}-auth-token`, `sb-${value}-auth-token-code-verifier`]
          )
      )
    );
  };

  const clearStaleAuthStorage = () => {
    try {
      getAuthStorageKeys().forEach((key) => localStorage.removeItem(key));
    } catch {
      // noop
    }
  };

  const getStoredAuthPayload = () => {
    for (const key of getAuthStorageKeys()) {
      if (key === "supabase.auth.token" || key.endsWith("-auth-token")) {
        try {
          const raw = localStorage.getItem(key);
          if (!raw) continue;
          return JSON.parse(raw);
        } catch {
          continue;
        }
      }
    }

    return null;
  };

  const hasCorruptedAuthToken = () => {
    try {
      const parsed = getStoredAuthPayload();
      if (!parsed) return false;

      const refreshToken =
        parsed?.currentSession?.refresh_token ??
        parsed?.refresh_token ??
        parsed?.session?.refresh_token;

      return typeof refreshToken === "string" && refreshToken.length < 30;
    } catch {
      return false;
    }
  };

  const fetchProfile = async (authUser: User) => {
    if (loggingOutRef.current) return;

    const { data } = await supabase
      .from("profiles")
      .select("name, email, phone, avatar_url")
      .eq("user_id", authUser.id)
      .maybeSingle();

    if (loggingOutRef.current) return;

    if (data) {
      setUser({
        name: data.name,
        email: data.email,
        phone: data.phone || "",
        avatarUrl: data.avatar_url || undefined,
      });
      return;
    }

    setUser({
      name: authUser.user_metadata?.name || authUser.email?.split("@")[0] || "",
      email: authUser.email || "",
      phone: authUser.user_metadata?.phone || "",
    });
  };

  useEffect(() => {
    let active = true;

    const applySession = async (nextSession: Session | null) => {
      if (!active || loggingOutRef.current) return;

      setSession(nextSession);

      if (nextSession?.user) {
        await fetchProfile(nextSession.user);
      } else {
        setUser(null);
      }

      if (!active) return;
      setLoading(false);
      setAuthReady(true);
    };

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!initializedRef.current && event === "INITIAL_SESSION") {
        return;
      }

      if (event === "SIGNED_OUT") {
        clearStaleAuthStorage();
        if (!active) return;
        setSession(null);
        setUser(null);
        setLoading(false);
        setAuthReady(true);
        return;
      }

      if (loggingOutRef.current) {
        return;
      }

      void applySession(nextSession);
    });

    const initSession = async () => {
      try {
        if (hasCorruptedAuthToken()) {
          clearStaleAuthStorage();
        }

        const {
          data: { session: initialSession },
        } = await withTimeout(supabase.auth.getSession(), 10000);

        if (!active || loggingOutRef.current) {
          return;
        }

        await applySession(initialSession);
      } catch {
        clearStaleAuthStorage();
        void supabase.auth.signOut({ scope: "local" }).catch(() => undefined);
        if (!active) return;
        setSession(null);
        setUser(null);
      } finally {
        initializedRef.current = true;
        if (!active) return;
        setLoading(false);
        setAuthReady(true);
      }
    };

    void initSession();

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const login = async (email: string, password: string) => {
    loggingOutRef.current = false;

    try {
      if (hasCorruptedAuthToken()) {
        clearStaleAuthStorage();
      }

      const { error } = await withTimeout(supabase.auth.signInWithPassword({ email, password }));
      return { error: error?.message || null };
    } catch (error) {
      const firstError = getAuthErrorMessage(error, "Unable to sign in. Please try again.");
      const isNetworkLikeError = /failed to fetch|timeout|network/i.test(firstError);

      if (!isNetworkLikeError) {
        return { error: firstError };
      }

      try {
        clearStaleAuthStorage();
        await withTimeout(
          supabase.auth.signOut({ scope: "local" }).catch(() => ({ error: null })),
          3000
        ).catch(() => undefined);

        const { error: retryError } = await withTimeout(supabase.auth.signInWithPassword({ email, password }));
        return { error: retryError?.message || null };
      } catch (retryError) {
        return { error: getAuthErrorMessage(retryError, firstError) };
      }
    }
  };

  const signup = async (email: string, password: string, name: string, phone: string) => {
    loggingOutRef.current = false;

    try {
      const { error } = await withTimeout(
        supabase.auth.signUp({
          email,
          password,
          options: {
            data: { name, phone },
            emailRedirectTo: window.location.origin,
          },
        })
      );

      return { error: error?.message || null };
    } catch (error) {
      return { error: getAuthErrorMessage(error, "Unable to create account. Please try again.") };
    }
  };

  const logout = async () => {
    loggingOutRef.current = true;
    initializedRef.current = true;
    setUser(null);
    setSession(null);
    setLoading(false);
    setAuthReady(true);
    clearStaleAuthStorage();

    await supabase.auth.signOut({ scope: "local" }).catch(() => undefined);
  };

  const refreshProfile = async () => {
    if (session?.user) {
      await fetchProfile(session.user);
    }
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, authReady, login, signup, logout, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
};