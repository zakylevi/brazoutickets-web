import { useState, useRef, useEffect } from "react";
import { ChevronDown, Search } from "lucide-react";

interface Country {
  code: string;
  dial: string;
  name: string;
  format: string; // e.g. "## #### ####"
}

const countries: Country[] = [
  { code: "BR", dial: "+55", name: "Brazil", format: "## #####-####" },
  { code: "US", dial: "+1", name: "United States", format: "### ### ####" },
  { code: "GB", dial: "+44", name: "United Kingdom", format: "#### ######" },
  { code: "PT", dial: "+351", name: "Portugal", format: "### ### ###" },
  { code: "DE", dial: "+49", name: "Germany", format: "#### #######" },
  { code: "FR", dial: "+33", name: "France", format: "# ## ## ## ##" },
  { code: "ES", dial: "+34", name: "Spain", format: "### ## ## ##" },
  { code: "IT", dial: "+39", name: "Italy", format: "### ### ####" },
  { code: "AR", dial: "+54", name: "Argentina", format: "## ####-####" },
  { code: "MX", dial: "+52", name: "Mexico", format: "## #### ####" },
  { code: "CO", dial: "+57", name: "Colombia", format: "### ### ####" },
  { code: "CL", dial: "+56", name: "Chile", format: "# #### ####" },
  { code: "JP", dial: "+81", name: "Japan", format: "## #### ####" },
  { code: "KR", dial: "+82", name: "South Korea", format: "## #### ####" },
  { code: "CN", dial: "+86", name: "China", format: "### #### ####" },
  { code: "IN", dial: "+91", name: "India", format: "##### #####" },
  { code: "AU", dial: "+61", name: "Australia", format: "### ### ###" },
  { code: "CA", dial: "+1", name: "Canada", format: "### ### ####" },
  { code: "AE", dial: "+971", name: "UAE", format: "## ### ####" },
  { code: "SA", dial: "+966", name: "Saudi Arabia", format: "## ### ####" },
  { code: "NG", dial: "+234", name: "Nigeria", format: "### ### ####" },
  { code: "ZA", dial: "+27", name: "South Africa", format: "## ### ####" },
  { code: "EG", dial: "+20", name: "Egypt", format: "### ### ####" },
  { code: "RU", dial: "+7", name: "Russia", format: "### ### ## ##" },
  { code: "TR", dial: "+90", name: "Turkey", format: "### ### ## ##" },
  { code: "NL", dial: "+31", name: "Netherlands", format: "# ## ## ## ##" },
  { code: "SE", dial: "+46", name: "Sweden", format: "## ### ## ##" },
  { code: "CH", dial: "+41", name: "Switzerland", format: "## ### ## ##" },
  { code: "PL", dial: "+48", name: "Poland", format: "### ### ###" },
  { code: "BE", dial: "+32", name: "Belgium", format: "### ## ## ##" },
];

const flagEmoji = (code: string) => {
  return code
    .toUpperCase()
    .split("")
    .map((c) => String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 65))
    .join("");
};

const applyFormat = (digits: string, format: string): string => {
  let result = "";
  let di = 0;
  for (let i = 0; i < format.length && di < digits.length; i++) {
    if (format[i] === "#") {
      result += digits[di++];
    } else {
      result += format[i];
    }
  }
  return result;
};

const maxDigits = (format: string) => format.split("").filter((c) => c === "#").length;

interface PhoneInputProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  placeholder?: string;
}

const PhoneInput = ({ value, onChange, className = "", placeholder }: PhoneInputProps) => {
  const [selectedCountry, setSelectedCountry] = useState<Country>(countries[0]);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setDropdownOpen(false);
        setSearch("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    if (dropdownOpen && searchRef.current) {
      searchRef.current.focus();
    }
  }, [dropdownOpen]);

  const handlePhoneChange = (raw: string) => {
    const digits = raw.replace(/\D/g, "").slice(0, maxDigits(selectedCountry.format));
    const formatted = applyFormat(digits, selectedCountry.format);
    onChange(`${selectedCountry.dial} ${formatted}`.trim());
  };

  // Extract just the local part (without dial code) for the input display
  const localPart = value.startsWith(selectedCountry.dial)
    ? value.slice(selectedCountry.dial.length).trim()
    : value.replace(/^\+\d+\s*/, "");

  const filtered = countries.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.dial.includes(search) ||
      c.code.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div ref={ref} className={`relative flex ${className}`}>
      {/* Country selector */}
      <button
        type="button"
        onClick={() => { setDropdownOpen(!dropdownOpen); setSearch(""); }}
        className="flex items-center gap-1.5 px-3 rounded-l-xl border border-r-0 border-border bg-secondary text-on-background hover:bg-secondary/80 transition-colors shrink-0"
      >
        <span className="text-lg leading-none">{flagEmoji(selectedCountry.code)}</span>
        <span className="text-xs font-bold text-muted-foreground">{selectedCountry.dial}</span>
        <ChevronDown className="w-3 h-3 text-muted-foreground" />
      </button>

      {/* Phone input */}
      <input
        type="tel"
        value={localPart}
        onChange={(e) => handlePhoneChange(e.target.value)}
        placeholder={placeholder || applyFormat("0".repeat(maxDigits(selectedCountry.format)), selectedCountry.format).replace(/0/g, "0")}
        className="flex-1 px-4 py-3 rounded-r-xl border border-border bg-background text-on-background font-medium focus:outline-none focus:ring-2 focus:ring-brand-pink transition-shadow min-w-0"
      />

      {/* Dropdown */}
      {dropdownOpen && (
        <div className="absolute top-full left-0 mt-1 w-72 max-h-64 bg-surface border border-border rounded-2xl shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
          <div className="p-2 border-b border-border">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <input
                ref={searchRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search country..."
                className="w-full pl-8 pr-3 py-2 text-sm rounded-lg bg-secondary border-none text-on-background placeholder:text-muted-foreground focus:outline-none"
              />
            </div>
          </div>
          <div className="overflow-y-auto max-h-48 hide-scrollbar">
            {filtered.map((country) => (
              <button
                key={country.code + country.dial}
                type="button"
                onClick={() => {
                  setSelectedCountry(country);
                  setDropdownOpen(false);
                  setSearch("");
                  // Re-format existing digits with new country format
                  const digits = localPart.replace(/\D/g, "").slice(0, maxDigits(country.format));
                  const formatted = applyFormat(digits, country.format);
                  onChange(`${country.dial} ${formatted}`.trim());
                }}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-secondary transition-colors ${
                  selectedCountry.code === country.code && selectedCountry.dial === country.dial
                    ? "bg-brand-pink/10 text-brand-pink"
                    : "text-on-background"
                }`}
              >
                <span className="text-lg">{flagEmoji(country.code)}</span>
                <span className="flex-1 text-sm font-medium truncate">{country.name}</span>
                <span className="text-xs font-bold text-muted-foreground">{country.dial}</span>
              </button>
            ))}
            {filtered.length === 0 && (
              <p className="text-center text-sm text-muted-foreground py-4">No countries found</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default PhoneInput;
