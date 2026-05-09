import { Outlet } from "react-router-dom";
import Header from "@/components/Header";
import SiteFooter from "@/components/SiteFooter";
import MobileNav from "@/components/MobileNav";

const MainLayout = () => {
  return (
    <div className="min-h-screen bg-surface text-on-background">
      <Header />
      <Outlet />
      <SiteFooter />
      <MobileNav />
    </div>
  );
};

export default MainLayout;