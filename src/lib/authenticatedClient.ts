import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { xhrFetch } from "@/lib/xhrFetch";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const SUPABASE_PROJECT_ID = import.meta.env.VITE_SUPABASE_PROJECT_ID;

const getSupabaseProjectRef = () => {
  try {
    return new URL(SUPABASE_URL).hostname.split(".")[0] || null;
  } catch {
    return null;
  }
};

const AUTH_STORAGE_KEYS = Array.from(
  new Set(
    [getSupabaseProjectRef(), SUPABASE_PROJECT_ID, "supabase.auth.token"]
      .filter(Boolean)
      .map((value) => (value === "supabase.auth.token" ? value : `sb-${value}-auth-token`))
  )
);

const getStoredAuthPayload = () => {
  for (const storageKey of AUTH_STORAGE_KEYS) {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) continue;

      return {
        storageKey,
        parsed: JSON.parse(raw),
      };
    } catch {
      continue;
    }
  }

  return null;
};

const getStoredAccessToken = () => {
  const payload = getStoredAuthPayload()?.parsed;
  if (!payload) return null;

  return (
    payload?.currentSession?.access_token ??
    payload?.access_token ??
    payload?.session?.access_token ??
    null
  );
};

export const getAuthenticatedClient = () => {
  const accessToken = getStoredAccessToken();
  const storageKey = getStoredAuthPayload()?.storageKey;

  return createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    global: {
      fetch: xhrFetch,
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
    },
    auth: {
      storageKey,
      storage: localStorage,
      persistSession: true,
      autoRefreshToken: true,
    },
  });
};