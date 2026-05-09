import { Home, Compass, Briefcase, User } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

const MobileNav = () => {
  const location = useLocation();
  const path = location.pathname;
  const { user } = useAuth();

  const profileTo = user ? "/profile?tab=tickets" : "/auth";

  const tabs = [
    { to: "/", icon: Home, match: (p: string) => p === "/" },
    { to: "/explore", icon: Compass, match: (p: string) => p === "/explore" },
    { to: "/for-organizers", icon: Briefcase, match: (p: string) => p === "/for-organizers" },
    { to: profileTo, icon: User, match: (p: string) => p === "/profile" || p === "/auth" },
  ];

  return (
    <nav className="md:hidden fixed bottom-6 left-1/2 -translate-x-1/2 w-[90%] flex justify-around items-center px-4 py-3 backdrop-blur-2xl rounded-full z-50 shadow-2xl bg-[sidebar-primary-foreground] bg-primary">
      {tabs.map(({ to, icon: Icon, match }) => (
        <Link
          key={to}
          to={to}
          className={`flex items-center justify-center rounded-full w-12 h-12 transition-all active:scale-90 ${
            match(path)
              ? "bg-brand-lime text-slate-950"
              : "text-white/60 hover:text-primary-foreground"
          }`}
        >
          <Icon className="w-5 h-5" />
        </Link>
      ))}
    </nav>
  );
};

export default MobileNav;
