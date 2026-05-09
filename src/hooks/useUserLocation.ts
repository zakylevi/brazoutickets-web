import { useState, useEffect, useCallback } from "react";

const GOOGLE_MAPS_API_KEY = "AIzaSyBalU_2zolJX-4NL0an5rzXiv3gW3gOZCo";
const STORAGE_KEY = "brazou-user-location";

export interface UserLocation {
  city: string;
  state: string;
  country: string;
  lat: number;
  lng: number;
  locationSource: "browser" | "ip" | "manual";
}

const DEFAULT_LOCATION: UserLocation = {
  city: "New York",
  state: "NY",
  country: "United States",
  lat: 40.7128,
  lng: -74.006,
  locationSource: "manual",
};

async function reverseGeocode(lat: number, lng: number): Promise<Partial<UserLocation> | null> {
  try {
    const res = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${GOOGLE_MAPS_API_KEY}`
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.results || data.results.length === 0) return null;

    let city = "";
    let state = "";
    let country = "";

    for (const result of data.results) {
      for (const comp of result.address_components || []) {
        const types: string[] = comp.types || [];
        if (!city && types.includes("locality")) city = comp.long_name;
        if (!state && types.includes("administrative_area_level_1")) state = comp.short_name;
        if (!country && types.includes("country")) country = comp.long_name;
      }
      if (city && state && country) break;
    }

    // Fallback: use sublocality if no locality found
    if (!city) {
      for (const result of data.results) {
        for (const comp of result.address_components || []) {
          if (comp.types?.includes("sublocality") || comp.types?.includes("administrative_area_level_2")) {
            city = comp.long_name;
            break;
          }
        }
        if (city) break;
      }
    }

    if (!city && !country) return null;

    return { city, state, country };
  } catch {
    return null;
  }
}

async function getLocationFromIP(): Promise<Partial<UserLocation> | null> {
  try {
    const res = await fetch("https://ipapi.co/json/");
    if (!res.ok) return null;
    const data = await res.json();
    return {
      city: data.city || "",
      state: data.region_code || data.region || "",
      country: data.country_name || "",
      lat: data.latitude,
      lng: data.longitude,
    };
  } catch {
    return null;
  }
}

export function useUserLocation() {
  const [location, setLocation] = useState<UserLocation>(() => {
    try {
      const cached = localStorage.getItem(STORAGE_KEY);
      if (cached) return JSON.parse(cached);
    } catch {}
    return DEFAULT_LOCATION;
  });
  const [loading, setLoading] = useState(() => {
    return !localStorage.getItem(STORAGE_KEY);
  });
  const [permissionDenied, setPermissionDenied] = useState(false);

  useEffect(() => {
    // If we already have a cached location, don't re-detect
    if (localStorage.getItem(STORAGE_KEY)) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    const detect = async () => {
      // Try browser geolocation
      if ("geolocation" in navigator) {
        try {
          const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              timeout: 8000,
              maximumAge: 600000,
            });
          });

          if (cancelled) return;

          const geo = await reverseGeocode(pos.coords.latitude, pos.coords.longitude);
          if (cancelled) return;

          if (geo && geo.city) {
            const loc: UserLocation = {
              city: geo.city,
              state: geo.state || "",
              country: geo.country || "",
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
              locationSource: "browser",
            };
            setLocation(loc);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(loc));
            setLoading(false);
            return;
          }
        } catch {
          setPermissionDenied(true);
        }
      }

      if (cancelled) return;

      // Fallback: IP-based
      const ipLoc = await getLocationFromIP();
      if (cancelled) return;

      if (ipLoc && ipLoc.city) {
        const loc: UserLocation = {
          city: ipLoc.city,
          state: ipLoc.state || "",
          country: ipLoc.country || "",
          lat: ipLoc.lat || 0,
          lng: ipLoc.lng || 0,
          locationSource: "ip",
        };
        setLocation(loc);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(loc));
      }
      setLoading(false);
    };

    detect();
    return () => { cancelled = true; };
  }, []);

  const setManualLocation = useCallback((city: string, state: string, country: string) => {
    const loc: UserLocation = {
      city,
      state,
      country,
      lat: 0,
      lng: 0,
      locationSource: "manual",
    };
    setLocation(loc);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(loc));
  }, []);

  const resetLocation = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setLocation(DEFAULT_LOCATION);
    setLoading(true);
    // Re-trigger detection on next mount
    window.location.reload();
  }, []);

  return { location, loading, permissionDenied, setManualLocation, resetLocation };
}