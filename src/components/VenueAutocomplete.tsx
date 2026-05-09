import { useState, useEffect, useRef, useCallback } from "react";

const GOOGLE_MAPS_API_KEY = "AIzaSyBalU_2zolJX-4NL0an5rzXiv3gW3gOZCo";

export interface PlaceResult {
  venue: string;
  address: string;
  city: string;
  state: string;
  country: string;
  postalCode: string;
  lat: number | null;
  lng: number | null;
  placeId: string;
}

interface VenueAutocompleteProps {
  venue: string;
  address: string;
  onSelect: (result: PlaceResult) => void;
  onManualChange: (field: "venue" | "address", value: string) => void;
}

const getAddressComponent = (
  components: Array<{ types?: string[]; longText?: string; shortText?: string }>,
  type: string
): string => {
  const c = components.find((comp) => comp.types?.includes(type));
  return c?.longText ?? c?.shortText ?? "";
};

interface PlacePrediction {
  placeId: string;
  text: string;
  mainText: string;
  secondaryText: string;
}

interface PlaceDetailsResponse {
  addressComponents?: Array<{ types?: string[]; longText?: string; shortText?: string }>;
  displayName?: { text?: string };
  formattedAddress?: string;
  id?: string;
  location?: { latitude?: number; longitude?: number };
}

const VenueAutocomplete = ({ venue, address, onSelect, onManualChange }: VenueAutocompleteProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const blurTimeoutRef = useRef<number>();
  const abortControllerRef = useRef<AbortController | null>(null);
  const [manualMode, setManualMode] = useState(false);
  const [query, setQuery] = useState(venue || "");
  const [predictions, setPredictions] = useState<PlacePrediction[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [isLoading, setIsLoading] = useState(false);
  const [requestFailed, setRequestFailed] = useState(false);

  useEffect(() => {
    setRequestFailed(false);
  }, []);

  useEffect(() => {
    setQuery(venue || "");
  }, [venue]);

  useEffect(() => {
    if (manualMode || !query.trim()) {
      abortControllerRef.current?.abort();
      setPredictions([]);
      setIsOpen(false);
      setActiveIndex(-1);
      setIsLoading(false);
      return;
    }

    const trimmedQuery = query.trim();
    if (trimmedQuery.length < 2) {
      setPredictions([]);
      setIsOpen(false);
      setActiveIndex(-1);
      return;
    }

    const timeoutId = window.setTimeout(() => {
      abortControllerRef.current?.abort();
      const controller = new AbortController();
      abortControllerRef.current = controller;
      setIsLoading(true);

      fetch("https://places.googleapis.com/v1/places:autocomplete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": GOOGLE_MAPS_API_KEY,
          "X-Goog-FieldMask": "suggestions.placePrediction.placeId,suggestions.placePrediction.text,suggestions.placePrediction.structuredFormat",
        },
        body: JSON.stringify({
          input: trimmedQuery,
          languageCode: "en",
        }),
        signal: controller.signal,
      })
        .then(async (response) => {
          if (!response.ok) {
            throw new Error("Autocomplete request failed");
          }

          const data = await response.json();
          const nextPredictions: PlacePrediction[] = (data.suggestions || [])
            .map((item: any) => item.placePrediction)
            .filter(Boolean)
            .map((prediction: any) => ({
              placeId: prediction.placeId,
              text: prediction.text?.text || "",
              mainText: prediction.structuredFormat?.mainText?.text || prediction.text?.text || "",
              secondaryText: prediction.structuredFormat?.secondaryText?.text || "",
            }));

          setRequestFailed(false);
          setPredictions(nextPredictions);
          setIsOpen(document.activeElement === inputRef.current);
          setActiveIndex(nextPredictions.length > 0 ? 0 : -1);
        })
        .catch((error) => {
          if (error.name === "AbortError") return;
          setRequestFailed(true);
          setPredictions([]);
          setIsOpen(false);
          setActiveIndex(-1);
        })
        .finally(() => {
          if (!controller.signal.aborted) {
            setIsLoading(false);
          }
        });
    }, 200);

    return () => {
      window.clearTimeout(timeoutId);
      abortControllerRef.current?.abort();
    };
  }, [manualMode, query]);

  useEffect(() => () => {
    if (blurTimeoutRef.current) {
      window.clearTimeout(blurTimeoutRef.current);
    }
    abortControllerRef.current?.abort();
  }, []);

  const handlePredictionSelect = useCallback(async (prediction: PlacePrediction) => {
    try {
      setIsLoading(true);
      const response = await fetch(`https://places.googleapis.com/v1/places/${prediction.placeId}`, {
        headers: {
          "X-Goog-Api-Key": GOOGLE_MAPS_API_KEY,
          "X-Goog-FieldMask": "id,displayName,formattedAddress,addressComponents,location",
        },
      });

      if (!response.ok) {
        throw new Error("Place details request failed");
      }

      const place: PlaceDetailsResponse = await response.json();
      const components = place.addressComponents || [];
      const result: PlaceResult = {
        venue: place.displayName?.text || prediction.mainText || prediction.text || "",
        address: place.formattedAddress || prediction.text || "",
        city:
          getAddressComponent(components, "locality") ||
          getAddressComponent(components, "sublocality") ||
          getAddressComponent(components, "administrative_area_level_2"),
        state: getAddressComponent(components, "administrative_area_level_1"),
        country: getAddressComponent(components, "country"),
        postalCode: getAddressComponent(components, "postal_code"),
        lat: place.location?.latitude ?? null,
        lng: place.location?.longitude ?? null,
        placeId: prediction.placeId || place.id || "",
      };

      setQuery(result.venue || result.address);
      setPredictions([]);
      setIsOpen(false);
      setActiveIndex(-1);
      setRequestFailed(false);
      onSelect(result);
    } catch {
      setRequestFailed(true);
    } finally {
      setIsLoading(false);
    }
  }, [onSelect]);

  const handleInputChange = (value: string) => {
    setQuery(value);
    setIsOpen(value.trim().length > 0);
    setRequestFailed(false);
    onManualChange("venue", value);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen || predictions.length === 0) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((prev) => (prev + 1) % predictions.length);
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((prev) => (prev <= 0 ? predictions.length - 1 : prev - 1));
    }

    if (event.key === "Enter" && activeIndex >= 0) {
      event.preventDefault();
      handlePredictionSelect(predictions[activeIndex]);
    }

    if (event.key === "Escape") {
      setIsOpen(false);
    }
  };

  if (manualMode) {
    return (
      <div className="flex-1 space-y-1">
        <input
          value={venue}
          onChange={(e) => onManualChange("venue", e.target.value)}
          placeholder="Venue Name"
          className="bg-transparent border-b-2 border-dashed border-border focus:border-primary outline-none transition-colors w-full font-black"
        />
        <input
          value={address}
          onChange={(e) => onManualChange("address", e.target.value)}
          placeholder="Full Address (e.g. 123 Main St, City, Country)"
          className="bg-transparent border-b-2 border-dashed border-border focus:border-primary outline-none transition-colors w-full text-sm text-muted-foreground font-medium"
        />
        <p className="text-[10px] text-muted-foreground">
          Autocomplete unavailable —{" "}
          <button type="button" onClick={() => setManualMode(false)} className="text-primary underline">
            retry
          </button>
        </p>
      </div>
    );
  }

  return (
    <div className="relative flex-1 space-y-1">
      <input
        ref={inputRef}
        value={query}
        onChange={(e) => handleInputChange(e.target.value)}
        onFocus={() => setIsOpen(predictions.length > 0 || isLoading)}
        onBlur={() => {
          blurTimeoutRef.current = window.setTimeout(() => setIsOpen(false), 150);
        }}
        onKeyDown={handleKeyDown}
        autoComplete="off"
        placeholder="Search venue or address..."
        className="bg-transparent border-b-2 border-dashed border-border focus:border-primary outline-none transition-colors w-full font-black"
      />
      {isOpen && (isLoading || predictions.length > 0) && (
        <div className="absolute left-0 right-0 top-full z-[70] mt-2 overflow-hidden rounded-2xl border border-border bg-background shadow-lg">
          {isLoading && predictions.length === 0 ? (
            <div className="px-4 py-3 text-sm text-muted-foreground">Searching addresses…</div>
          ) : predictions.map((prediction, index) => (
            <button
              key={prediction.placeId}
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => handlePredictionSelect(prediction)}
              className={`flex w-full flex-col items-start gap-1 px-4 py-3 text-left transition-colors ${
                index === activeIndex ? "bg-accent text-accent-foreground" : "bg-background text-foreground hover:bg-accent hover:text-accent-foreground"
              }`}
            >
              <span className="text-sm font-bold">
                {prediction.mainText || prediction.text}
              </span>
              {prediction.secondaryText && (
                <span className="text-xs text-muted-foreground">
                  {prediction.secondaryText}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
      {!manualMode && requestFailed && (
        <p className="text-[10px] text-destructive">Autocomplete failed — use manual address entry or retry typing.</p>
      )}
      {address && (
        <p className="text-sm text-muted-foreground font-medium truncate">{address}</p>
      )}
      <button
        type="button"
        onClick={() => setManualMode(true)}
        className="text-[10px] text-muted-foreground hover:text-primary transition-colors"
      >
        Enter address manually
      </button>
    </div>
  );
};

export default VenueAutocomplete;
