import { Sun, Moon, User, ChevronDown, Building2, UserCircle, Settings, Ticket, LogOut, ShieldCheck } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import OrganizationSelectorModal from "@/components/OrganizationSelectorModal";
import brazouLogo from "@/assets/brazou-logo.png";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const languages = [
  { code: "en", label: "English", flag: "🇺🇸" },
  { code: "pt", label: "Português", flag: "🇧🇷" },
  { code: "es", label: "Español", flag: "🇪🇸" },
];

const Header = () => {
  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem("brazou-dark-mode");
    if (saved !== null) return saved === "true";
    return document.documentElement.classList.contains("dark");
  });
  const [lang, setLang] = useState("pt");
  const [langOpen, setLangOpen] = useState(false);
  const [orgSelectorOpen, setOrgSelectorOpen] = useState(false);
  const langRef = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, session, logout } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const adminCheckedRef = useRef<string | null>(null);

  useEffect(() => {
    const uid = session?.user?.id;
    if (!uid) { setIsAdmin(false); adminCheckedRef.current = null; return; }
    if (adminCheckedRef.current === uid) return;
    adminCheckedRef.current = uid;
    supabase.rpc("has_role", { _user_id: uid, _role: "admin" as const })
      .then(({ data }) => setIsAdmin(!!data));
  }, [session?.user?.id]);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDark);
    localStorage.setItem("brazou-dark-mode", String(isDark));
  }, [isDark]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (langRef.current && !langRef.current.contains(e.target as Node)) {
        setLangOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const currentLang = languages.find((l) => l.code === lang)!;

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const handleLogout = async () => {
    await logout();
    navigate("/");
  };

  return (
    <>
      <header className="fixed top-0 w-full z-50 glass-nav border-b border-border">
        <nav className="flex justify-between items-center w-full px-8 py-4 max-w-7xl mx-auto">
          <Link to="/" className="flex items-center gap-2">
            <img src={brazouLogo} alt="BRAZOU" className="h-7" />
          </Link>
          <div className="hidden md:flex items-center gap-10 font-medium tracking-tight text-muted-foreground">
            <Link to="/" className={`transition-colors hover:text-brand-pink ${location.pathname === "/" ? "text-on-background font-semibold" : ""}`}>Início</Link>
            <Link to="/explore" className={`transition-colors hover:text-brand-pink ${location.pathname === "/explore" ? "text-on-background font-semibold" : ""}`}>Explorar</Link>
            <Link to="/for-organizers" className={`transition-colors hover:text-brand-pink ${location.pathname === "/for-organizers" ? "text-on-background font-semibold" : ""}`}>For Organizers</Link>
            
          </div>
          <div className="flex items-center gap-1">
            {/* Language Selector */}
            <div ref={langRef} className="relative">
              <button
                onClick={() => setLangOpen(!langOpen)}
                className="flex items-center gap-1.5 text-foreground px-3 py-2 rounded-full hover:bg-secondary transition-colors text-sm font-semibold"
              >
                <span className="text-base leading-none">{currentLang.flag}</span>
                <span className="hidden sm:inline">{currentLang.code.toUpperCase()}</span>
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${langOpen ? "rotate-180" : ""}`} />
              </button>
              {langOpen && (
                <div className="absolute right-0 top-full mt-2 bg-surface border border-border rounded-2xl shadow-xl overflow-hidden min-w-[160px] z-50">
                  {languages.map((l) => (
                    <button
                      key={l.code}
                      onClick={() => { setLang(l.code); setLangOpen(false); }}
                      className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors hover:bg-secondary ${
                        lang === l.code ? "text-brand-pink font-bold" : "text-foreground"
                      }`}
                    >
                      <span className="text-base">{l.flag}</span>
                      {l.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button
              onClick={() => setIsDark(!isDark)}
              className="text-foreground p-2.5 rounded-full hover:bg-secondary transition-colors"
              aria-label="Toggle dark mode"
            >
              {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>

            {/* User Avatar / Sign In */}
            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background">
                    <Avatar className="h-9 w-9 border-2 border-brand-pink cursor-pointer hover:opacity-90 transition-opacity">
                      <AvatarImage src={user.avatarUrl} alt={user.name} />
                      <AvatarFallback className="bg-brand-pink text-primary-foreground text-xs font-bold">
                        {getInitials(user.name)}
                      </AvatarFallback>
                    </Avatar>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 rounded-xl border-border bg-surface shadow-xl">
                  <div className="px-3 py-3">
                    <p className="text-sm font-bold text-on-background truncate">{user.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                  </div>
                  <DropdownMenuSeparator className="bg-border" />

                  {isAdmin && (
                    <>
                      <DropdownMenuItem onClick={() => navigate("/admin")} className="gap-3 px-3 py-2.5 cursor-pointer rounded-lg mx-1 focus:bg-secondary">
                        <ShieldCheck className="w-4 h-4 text-brand-pink" />
                        <span className="font-medium text-brand-pink">Admin Panel</span>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator className="bg-border" />
                    </>
                  )}

                  <DropdownMenuLabel className="text-[11px] uppercase tracking-widest text-muted-foreground font-bold px-3 py-1.5">
                    As Organizer
                  </DropdownMenuLabel>
                  <DropdownMenuItem onClick={() => setOrgSelectorOpen(true)} className="gap-3 px-3 py-2.5 cursor-pointer rounded-lg mx-1 focus:bg-secondary">
                    <Building2 className="w-4 h-4 text-muted-foreground" />
                    <span className="font-medium">My Organizations</span>
                  </DropdownMenuItem>

                  <DropdownMenuSeparator className="bg-border" />

                  <DropdownMenuLabel className="text-[11px] uppercase tracking-widest text-muted-foreground font-bold px-3 py-1.5">
                    As Attendee
                  </DropdownMenuLabel>
                  <DropdownMenuItem onClick={() => navigate("/profile")} className="gap-3 px-3 py-2.5 cursor-pointer rounded-lg mx-1 focus:bg-secondary">
                    <UserCircle className="w-4 h-4 text-muted-foreground" />
                    <span className="font-medium">Profile</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate("/profile?tab=settings")} className="gap-3 px-3 py-2.5 cursor-pointer rounded-lg mx-1 focus:bg-secondary">
                    <Settings className="w-4 h-4 text-muted-foreground" />
                    <span className="font-medium">Settings</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate("/profile?tab=tickets")} className="gap-3 px-3 py-2.5 cursor-pointer rounded-lg mx-1 focus:bg-secondary">
                    <Ticket className="w-4 h-4 text-muted-foreground" />
                    <span className="font-medium">My Tickets</span>
                  </DropdownMenuItem>

                  <DropdownMenuSeparator className="bg-border" />

                  <DropdownMenuItem
                    onClick={handleLogout}
                    className="gap-3 px-3 py-2.5 cursor-pointer rounded-lg mx-1 text-destructive focus:bg-destructive/10 focus:text-destructive"
                  >
                    <LogOut className="w-4 h-4" />
                    <span className="font-medium">Sign Out</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Link to="/auth" className="text-foreground p-2.5 rounded-full hover:bg-secondary transition-colors">
                <User className="w-5 h-5" />
              </Link>
            )}
          </div>
        </nav>
      </header>
      <OrganizationSelectorModal open={orgSelectorOpen} onClose={() => setOrgSelectorOpen(false)} />
    </>
  );
};

export default Header;
