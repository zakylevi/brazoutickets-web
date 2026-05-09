import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import MainLayout from "@/components/MainLayout";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { OrganizationProvider } from "@/contexts/OrganizationContext";
import Index from "./pages/Index.tsx";
import Explore from "./pages/Explore.tsx";
import EventDetail from "./pages/EventDetail.tsx";
import Auth from "./pages/Auth.tsx";
import Profile from "./pages/Profile.tsx";
import OrganizerDashboard from "./pages/OrganizerDashboard.tsx";
import CreateEvent from "./pages/CreateEvent.tsx";
import OrganizationProfile from "./pages/OrganizationProfile.tsx";
import EventDashboard from "./pages/EventDashboard.tsx";
import AdminDashboard from "./pages/AdminDashboard.tsx";
import AdminEventsFinance from "./pages/AdminEventsFinance.tsx";
import AdminAllOrders from "./pages/AdminAllOrders.tsx";
import TrackingLinkRedirect from "./pages/TrackingLinkRedirect.tsx";
import AcceptInvite from "./pages/AcceptInvite.tsx";
import ForOrganizers from "./pages/ForOrganizers.tsx";
import TicketValidation from "./pages/TicketValidation.tsx";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <OrganizationProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route element={<MainLayout />}>
                <Route path="/" element={<Index />} />
                <Route path="/explore" element={<Explore />} />
                <Route path="/event/:eventId" element={<EventDetail />} />
                <Route path="/event/:eventId/:source" element={<EventDetail />} />
                <Route path="/auth" element={<Auth />} />
                <Route path="/profile" element={<Profile />} />
                <Route path="/org/:orgSlug" element={<OrganizationProfile />} />
                <Route path="/user/:userName" element={<Profile viewMode />} />
                <Route path="/for-organizers" element={<ForOrganizers />} />
                <Route path="/accept-invite" element={<AcceptInvite />} />
                <Route path="/ticket/:token" element={<TicketValidation />} />
                <Route path="/:slug" element={<TrackingLinkRedirect />} />
              </Route>
              <Route path="/dashboard/:orgSlug" element={<OrganizerDashboard />} />
              <Route path="/dashboard/:orgSlug/create-event" element={<CreateEvent />} />
              <Route path="/dashboard/:orgSlug/edit-event/:eventId" element={<CreateEvent />} />
              <Route path="/dashboard/:orgSlug/event/:eventId" element={<EventDashboard />} />
              <Route path="/admin" element={<AdminDashboard />} />
              <Route path="/admin/events-finance" element={<AdminEventsFinance />} />
              <Route path="/admin/orders" element={<AdminAllOrders />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </OrganizationProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
