import { useState, useRef, useEffect } from "react";
import { QRCodeSVG } from "qrcode.react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Ticket, CreditCard, Settings, HelpCircle, ArrowRight, Pencil, Plus, Trash2, Eye, EyeOff, Check, X, Download, QrCode } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import PhoneInput from "@/components/PhoneInput";
import VerifyChangeModal from "@/components/VerifyChangeModal";

const allEvents = [
  {
    title: "NEON PULSE: RAVE EDITION",
    date: "Oct 12, 2023",
    location: "São Paulo, BR",
    image: "https://lh3.googleusercontent.com/aida-public/AB6AXuAjLcieecpA4M4EMZHMbW1gIIr4wmoWSN17pvnUUEc7pvXxa08B6jnA5IIszQdv9ksCHqqF5SbbGb_yIuWli9t6gsSGyQTJwAi9bx0UWji0v2Tup_FewHmWQzWD3XChVAeRugxRuIQgu9gE3L7cPQI3BWIUBoFAVXcU2Og6bz1RnT1Guz7g354WUqbsupunrOfxDygyjutNYd57sYS5oBm_oKdCJvb8vZVh7JASBwfyI6iGKoJBO4Fqon_dTa89Smv4MDbAJCcV6Wjf",
  },
  {
    title: "TECHNO WAREHOUSE 04",
    date: "Sep 28, 2023",
    location: "Rio de Janeiro, BR",
    image: "https://lh3.googleusercontent.com/aida-public/AB6AXuDce6AQj1QlS0UJOs6cAeXBUPZudeEvCfAhqTfWxPPslsxRG3MMEWspsuqbgjG2xG7Lfs7pjtQj9dkq_tBu_fy6_cXD1wJd1KStjr_Gl7zWNnuQ5DjI6dahVZd0uHDA2Jbw1GtfBwZtUlPxCKgs-gkXFp3VOTA3SqnuMLmNAodLGkKn1J1I3s8d-ZaH6iFYXyh1mRJw41H3RuWWEDHpcCz5JHdaF1cJLObNElb2qIsxT582EAfmoszTz0-b4PunEsulV7evS1wEySNf",
  },
  {
    title: "SUMMER VIBES FEST",
    date: "Aug 15, 2023",
    location: "Florianópolis, BR",
    image: "https://lh3.googleusercontent.com/aida-public/AB6AXuAe0aS6M1j-kcqZaGSr7ZgJC4bnLY4qx2GWniWIejuaFlbgp4SZwlhqsIUWPdc8vPkcDtivl4QsCulNsymb8aecWL-cFoiqbe5nP2YgL5iimgUuFkfAjF9xug1zZc8euShNvgUv_-ab6K1yQsUy4y5vLMi9wXbS6yzxoRu_772FfkUQyzcGjwfqRyF898jD3OxFGH1pf87hognRmi7hYN8wWCvm_pNxySM_mT2xRRpCDYtPQUPc_qpLiUmZZRWW8bsED4uteedVB_sP",
  },
  {
    title: "DEEP HOUSE SESSIONS",
    date: "Jul 04, 2023",
    location: "Belo Horizonte, BR",
    image: "https://lh3.googleusercontent.com/aida-public/AB6AXuAjLcieecpA4M4EMZHMbW1gIIr4wmoWSN17pvnUUEc7pvXxa08B6jnA5IIszQdv9ksCHqqF5SbbGb_yIuWli9t6gsSGyQTJwAi9bx0UWji0v2Tup_FewHmWQzWD3XChVAeRugxRuIQgu9gE3L7cPQI3BWIUBoFAVXcU2Og6bz1RnT1Guz7g354WUqbsupunrOfxDygyjutNYd57sYS5oBm_oKdCJvb8vZVh7JASBwfyI6iGKoJBO4Fqon_dTa89Smv4MDbAJCcV6Wjf",
  },
  {
    title: "BASS CULTURE 02",
    date: "Jun 18, 2023",
    location: "Curitiba, BR",
    image: "https://lh3.googleusercontent.com/aida-public/AB6AXuDce6AQj1QlS0UJOs6cAeXBUPZudeEvCfAhqTfWxPPslsxRG3MMEWspsuqbgjG2xG7Lfs7pjtQj9dkq_tBu_fy6_cXD1wJd1KStjr_Gl7zWNnuQ5DjI6dahVZd0uHDA2Jbw1GtfBwZtUlPxCKgs-gkXFp3VOTA3SqnuMLmNAodLGkKn1J1I3s8d-ZaH6iFYXyh1mRJw41H3RuWWEDHpcCz5JHdaF1cJLObNElb2qIsxT582EAfmoszTz0-b4PunEsulV7evS1wEySNf",
  },
  {
    title: "UNDERGROUND NIGHTS",
    date: "May 22, 2023",
    location: "Porto Alegre, BR",
    image: "https://lh3.googleusercontent.com/aida-public/AB6AXuAe0aS6M1j-kcqZaGSr7ZgJC4bnLY4qx2GWniWIejuaFlbgp4SZwlhqsIUWPdc8vPkcDtivl4QsCulNsymb8aecWL-cFoiqbe5nP2YgL5iimgUuFkfAjF9xug1zZc8euShNvgUv_-ab6K1yQsUy4y5vLMi9wXbS6yzxoRu_772FfkUQyzcGjwfqRyF898jD3OxFGH1pf87hognRmi7hYN8wWCvm_pNxySM_mT2xRRpCDYtPQUPc_qpLiUmZZRWW8bsED4uteedVB_sP",
  },
  {
    title: "ELECTRIC DAWN FESTIVAL",
    date: "Apr 08, 2023",
    location: "Salvador, BR",
    image: "https://lh3.googleusercontent.com/aida-public/AB6AXuDce6AQj1QlS0UJOs6cAeXBUPZudeEvCfAhqTfWxPPslsxRG3MMEWspsuqbgjG2xG7Lfs7pjtQj9dkq_tBu_fy6_cXD1wJd1KStjr_Gl7zWNnuQ5DjI6dahVZd0uHDA2Jbw1GtfBwZtUlPxCKgs-gkXFp3VOTA3SqnuMLmNAodLGkKn1J1I3s8d-ZaH6iFYXyh1mRJw41H3RuWWEDHpcCz5JHdaF1cJLObNElb2qIsxT582EAfmoszTz0-b4PunEsulV7evS1wEySNf",
  },
  {
    title: "SYNTH WAVE NIGHT",
    date: "Mar 15, 2023",
    location: "Recife, BR",
    image: "https://lh3.googleusercontent.com/aida-public/AB6AXuAjLcieecpA4M4EMZHMbW1gIIr4wmoWSN17pvnUUEc7pvXxa08B6jnA5IIszQdv9ksCHqqF5SbbGb_yIuWli9t6gsSGyQTJwAi9bx0UWji0v2Tup_FewHmWQzWD3XChVAeRugxRuIQgu9gE3L7cPQI3BWIUBoFAVXcU2Og6bz1RnT1Guz7g354WUqbsupunrOfxDygyjutNYd57sYS5oBm_oKdCJvb8vZVh7JASBwfyI6iGKoJBO4Fqon_dTa89Smv4MDbAJCcV6Wjf",
  },
];


const sidebarItems = [
  { label: "My Tickets", icon: Ticket, active: true },
  { label: "Payment Methods", icon: CreditCard },
  { label: "Settings", icon: Settings },
  { label: "Help & Support", icon: HelpCircle },
];

interface SavedCard {
  id: string;
  brand: string;
  last4: string;
  expiry: string;
  holder: string;
  isDefault: boolean;
}

const Profile = ({ viewMode = false }: { viewMode?: boolean }) => {
  const { user, session, loading, authReady, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const { userName } = useParams<{ userName?: string }>();
  const location = useLocation();
  const customerData = (location.state as any)?.customer;
  const isViewMode = viewMode || !!userName;
  const searchParams = new URLSearchParams(location.search);
  const tabParam = searchParams.get("tab");
  const [activeTab, setActiveTab] = useState(() => 
    tabParam === "settings" ? "Settings" : tabParam === "tickets" ? "My Tickets" : "My Tickets"
  );
  const [showAllEvents, setShowAllEvents] = useState(false);
  const [qrTicket, setQrTicket] = useState<string | null>(null);
  const [showAllTickets, setShowAllTickets] = useState(false);

  useEffect(() => {
    if (tabParam === "settings") setActiveTab("Settings");
    else if (tabParam === "tickets") setActiveTab("My Tickets");
  }, [tabParam]);

  // Build display user: use customer data in view mode, otherwise logged-in user
  const displayUser = isViewMode && customerData ? {
    name: customerData.name,
    email: customerData.email,
    phone: customerData.phone,
    avatarUrl: customerData.avatarUrl || "",
    eventsAttended: customerData.eventsAttended,
    totalSpent: customerData.totalSpent,
    orders: customerData.orders,
    instagram: customerData.instagram,
  } : user ? { ...user, eventsAttended: 0, totalSpent: "$0", orders: [], instagram: "" } : null;

  // Real tickets from DB
  interface MyTicket {
    id: string;
    publicToken: string;
    eventTitle: string;
    date: string;
    rawDate: string | null;
    venue: string;
    location: string;
    ticketType: string;
    quantity: number;
    image: string;
    eventId: string;
  }
  const [myTickets, setMyTickets] = useState<MyTicket[]>([]);
  const [ticketsLoading, setTicketsLoading] = useState(true);

  useEffect(() => {
    // For own profile, use session user; for view mode, use customerData.userId or customerData.user_id
    const userId = isViewMode ? (customerData?.userId || customerData?.user_id) : session?.user?.id;
    if (!authReady) return;
    if (!userId) {
      setTicketsLoading(false);
      return;
    }
    const fetchTickets = async () => {
      setTicketsLoading(true);
      try {
        const { data: orders } = await supabase
          .from("orders")
          .select("id, public_ticket_token, ticket_name, quantity, created_at, event_id, events(title, venue, city, flyer_url, date)")
          .eq("user_id", userId)
          .in("status", ["completed", "COMPLETED", "paid", "SCANNED", "scanned"])
          .order("created_at", { ascending: false });

        if (orders) {
          const tickets: MyTicket[] = orders.map((o: any) => ({
            id: o.id,
            publicToken: o.public_ticket_token,
            eventTitle: o.events?.title || "Event",
            date: o.events?.date ? new Date(o.events.date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : new Date(o.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
            rawDate: o.events?.date || null,
            venue: o.events?.venue || "",
            location: o.events?.city || "",
            ticketType: o.ticket_name,
            quantity: o.quantity || 1,
            image: o.events?.flyer_url || "",
            eventId: o.event_id,
          }));
          setMyTickets(tickets);
        }
      } finally {
        setTicketsLoading(false);
      }
    };
    fetchTickets();
  }, [authReady, session?.user?.id, isViewMode, customerData?.userId, customerData?.user_id]);

  // Fetch followed organizations
  const [followedOrgs, setFollowedOrgs] = useState<{ name: string; avatar: string; slug: string }[]>([]);
  useEffect(() => {
    const userId = isViewMode ? (customerData?.userId || customerData?.user_id) : session?.user?.id;
    if (!userId) return;
    const fetchFollowed = async () => {
      const { data: follows } = await supabase
        .from("organization_followers")
        .select("organization_id")
        .eq("user_id", userId);
      if (!follows || follows.length === 0) { setFollowedOrgs([]); return; }
      const orgIds = follows.map(f => f.organization_id);
      const { data: orgs } = await supabase
        .from("organizations")
        .select("name, avatar_url, slug")
        .in("id", orgIds);
      if (orgs) {
        setFollowedOrgs(orgs.map(o => ({ name: o.name, avatar: o.avatar_url || "", slug: o.slug })));
      }
    };
    fetchFollowed();
  }, [session?.user, isViewMode, customerData?.userId, customerData?.user_id]);

  const today = new Date().toISOString().split("T")[0];
  const upcomingTickets = myTickets.filter(t => !t.rawDate || t.rawDate >= today);
  const pastTickets = myTickets.filter(t => t.rawDate && t.rawDate < today);

  // Group upcoming tickets by eventId
  interface GroupedEvent {
    eventId: string;
    eventTitle: string;
    date: string;
    venue: string;
    location: string;
    image: string;
    tickets: MyTicket[];
    totalQuantity: number;
  }
  const groupedUpcoming: GroupedEvent[] = Object.values(
    upcomingTickets.reduce((acc, t) => {
      if (!acc[t.eventId]) {
        acc[t.eventId] = {
          eventId: t.eventId,
          eventTitle: t.eventTitle,
          date: t.date,
          venue: t.venue,
          location: t.location,
          image: t.image,
          tickets: [],
          totalQuantity: 0,
        };
      }
      acc[t.eventId].tickets.push(t);
      acc[t.eventId].totalQuantity += t.quantity;
      return acc;
    }, {} as Record<string, GroupedEvent>)
  );

  const [expandedEvent, setExpandedEvent] = useState<string | null>(null);
  const [showAllOrganizers, setShowAllOrganizers] = useState(false);

  // Payment Methods state
  const [savedCards, setSavedCards] = useState<SavedCard[]>([
    { id: "1", brand: "Visa", last4: "4242", expiry: "12/26", holder: "ISAAC LEVI", isDefault: true },
  ]);
  const [showAddCard, setShowAddCard] = useState(false);
  const [newCard, setNewCard] = useState({ number: "", expiry: "", cvc: "", holder: "", address: "", city: "", state: "", zip: "", country: "" });

  // Settings state
  const [settingsForm, setSettingsForm] = useState({
    name: user?.name || "",
    email: user?.email || "",
    phone: user?.phone || "",
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [verifyModal, setVerifyModal] = useState<{ open: boolean; field: "email" | "phone"; value: string }>({ open: false, field: "email", value: "" });
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const withTimeout = async <T,>(operation: () => Promise<T>, ms = 12000): Promise<T> => {
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        operation(),
        new Promise<T>((_, reject) => {
          timeoutId = setTimeout(() => reject(new Error("Upload timeout")), ms);
        }),
      ]);
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !session?.user) return;

    setUploadingAvatar(true);
    try {
      const fileExt = file.name.split(".").pop();
      const filePath = `${session.user.id}/avatar.${fileExt}`;

      const uploadResult = await withTimeout(async () => {
        return await supabase.storage.from("avatars").upload(filePath, file, { upsert: true });
      }, 12000);
      if (uploadResult.error) throw uploadResult.error;

      const {
        data: { publicUrl },
      } = supabase.storage.from("avatars").getPublicUrl(filePath);

      const avatarUrl = `${publicUrl}?t=${Date.now()}`;

      const profileUpdateResult = await withTimeout(async () => {
        return await supabase.from("profiles").update({ avatar_url: avatarUrl }).eq("user_id", session.user.id);
      }, 12000);
      if (profileUpdateResult.error) throw profileUpdateResult.error;


      await refreshProfile();
      toast.success("Avatar updated!");
    } catch (err: any) {
      toast.error(err.message || "Failed to upload avatar");
    } finally {
      setUploadingAvatar(false);
      e.target.value = "";
    }
  };

  const pastEventsData = Object.values(pastTickets.reduce((acc, t) => {
    if (!acc[t.eventTitle]) acc[t.eventTitle] = { title: t.eventTitle, date: t.date, location: t.location, image: t.image };
    return acc;
  }, {} as Record<string, { title: string; date: string; location: string; image: string }>));
  const displayedEvents = showAllEvents ? pastEventsData : pastEventsData.slice(0, 2);
  const displayedOrganizers = showAllOrganizers ? followedOrgs : followedOrgs.slice(0, 5);

  const getInitials = (name: string) =>
    name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);

  useEffect(() => {
    if (authReady && !user && !isViewMode) {
      navigate("/auth");
    }
  }, [authReady, user, isViewMode, navigate]);

  if (!authReady || loading) {
    return (
      <main className="max-w-7xl mx-auto px-8 pt-28 pb-16">
        <p className="text-muted-foreground text-center">Loading...</p>
      </main>
    );
  }

  if (!user && !isViewMode) {
    return null;
  }

  if (isViewMode && !displayUser) {
    return (
      <main className="max-w-7xl mx-auto px-8 pt-28 pb-16">
        <p className="text-muted-foreground text-center">User not found.</p>
      </main>
    );
  }

  const formatCardNumber = (value: string) => {
    const v = value.replace(/\D/g, "").slice(0, 16);
    return v.replace(/(\d{4})(?=\d)/g, "$1 ");
  };

  const formatExpiry = (value: string) => {
    const v = value.replace(/\D/g, "").slice(0, 4);
    if (v.length >= 3) return v.slice(0, 2) + "/" + v.slice(2);
    return v;
  };

  const handleAddCard = () => {
    if (!newCard.number || !newCard.expiry || !newCard.cvc || !newCard.holder || !newCard.address || !newCard.city || !newCard.zip || !newCard.country) {
      toast.error("Please fill in all card and billing fields");
      return;
    }
    const last4 = newCard.number.replace(/\s/g, "").slice(-4);
    const card: SavedCard = {
      id: Date.now().toString(),
      brand: newCard.number.startsWith("4") ? "Visa" : newCard.number.startsWith("5") ? "Mastercard" : "Card",
      last4,
      expiry: newCard.expiry,
      holder: newCard.holder.toUpperCase(),
      isDefault: savedCards.length === 0,
    };
    setSavedCards([...savedCards, card]);
    setNewCard({ number: "", expiry: "", cvc: "", holder: "", address: "", city: "", state: "", zip: "", country: "" });
    setShowAddCard(false);
    toast.success("Card added successfully");
  };

  const handleDeleteCard = (id: string) => {
    setSavedCards(savedCards.filter((c) => c.id !== id));
    toast.success("Card removed");
  };

  const handleSetDefault = (id: string) => {
    setSavedCards(savedCards.map((c) => ({ ...c, isDefault: c.id === id })));
    toast.success("Default card updated");
  };

  const handleSaveSettings = async (field: string) => {
    if (field === "password") {
      if (!settingsForm.currentPassword) {
        toast.error("Enter your current password");
        return;
      }
      if (settingsForm.newPassword !== settingsForm.confirmPassword) {
        toast.error("Passwords do not match");
        return;
      }
      if (settingsForm.newPassword.length < 6) {
        toast.error("Password must be at least 6 characters");
        return;
      }
      toast.success("Password updated successfully");
      setSettingsForm((f) => ({ ...f, currentPassword: "", newPassword: "", confirmPassword: "" }));
    } else if (field === "email" || field === "phone") {
      const newValue = field === "email" ? settingsForm.email : settingsForm.phone;
      const currentValue = field === "email" ? user.email : user.phone;
      if (newValue === currentValue) {
        toast.info("No changes detected");
        setEditingField(null);
        return;
      }
      if (field === "email" && !newValue.includes("@")) {
        toast.error("Please enter a valid email");
        return;
      }
      if (field === "phone" && newValue.replace(/\D/g, "").length < 6) {
        toast.error("Please enter a valid phone number");
        return;
      }
      // Open verification modal
      setVerifyModal({ open: true, field, value: newValue });
      return; // Don't close editing yet
    } else {
      if (session?.user) {
        await supabase.from("profiles").update({
          name: settingsForm.name,
        }).eq("user_id", session.user.id);
      }
      toast.success(`${field.charAt(0).toUpperCase() + field.slice(1)} updated successfully`);
    }
    setEditingField(null);
  };

  const handleVerified = async () => {
    if (session?.user) {
      await supabase.from("profiles").update({
        name: settingsForm.name,
        email: settingsForm.email,
        phone: settingsForm.phone,
      }).eq("user_id", session.user.id);
    }
    setVerifyModal({ open: false, field: "email", value: "" });
    setEditingField(null);
  };

  const renderMainContent = () => {
    if (activeTab === "Payment Methods") {
      return (
        <section className="space-y-8">
          <div>
            <p className="font-bold uppercase tracking-widest text-xs text-brand-pink">FAST CHECKOUT</p>
            <h2 className="text-4xl md:text-5xl font-black tracking-tighter text-on-background">PAYMENT METHODS</h2>
            <p className="text-muted-foreground mt-2 text-sm">Save your cards for faster checkout at events.</p>
          </div>

          {/* Saved Cards */}
          <div className="space-y-4">
            {savedCards.map((card) => (
              <div
                key={card.id}
                className={`flex items-center justify-between p-6 rounded-2xl border transition-all ${
                  card.isDefault ? "border-brand-pink bg-secondary" : "border-border bg-secondary/50 hover:bg-secondary"
                }`}
              >
                <div className="flex items-center gap-5">
                  <div className="w-14 h-10 rounded-lg bg-foreground/10 flex items-center justify-center">
                    <CreditCard className="w-6 h-6 text-on-background" />
                  </div>
                  <div>
                    <div className="flex items-center gap-3">
                      <span className="font-black tracking-tight text-on-background">{card.brand} •••• {card.last4}</span>
                      {card.isDefault && (
                        <span className="bg-brand-lime text-foreground px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest">
                          Default
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {card.holder} · Expires {card.expiry}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {!card.isDefault && (
                    <button
                      onClick={() => handleSetDefault(card.id)}
                      className="text-xs font-bold text-muted-foreground hover:text-brand-pink transition-colors px-3 py-2 rounded-lg hover:bg-secondary"
                    >
                      Set Default
                    </button>
                  )}
                  <button
                    onClick={() => handleDeleteCard(card.id)}
                    className="p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Add New Card */}
          {showAddCard ? (
            <div className="p-8 rounded-3xl border border-border bg-secondary/50 space-y-6">
              <h3 className="font-black tracking-tight text-lg text-on-background">Add New Card</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2 block">Card Number</label>
                  <input
                    type="text"
                    value={newCard.number}
                    onChange={(e) => setNewCard({ ...newCard, number: formatCardNumber(e.target.value) })}
                    placeholder="1234 5678 9012 3456"
                    className="w-full px-4 py-3 rounded-xl border border-border bg-background text-on-background font-medium focus:outline-none focus:ring-2 focus:ring-brand-pink transition-shadow"
                    maxLength={19}
                  />
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2 block">Expiry Date</label>
                  <input
                    type="text"
                    value={newCard.expiry}
                    onChange={(e) => setNewCard({ ...newCard, expiry: formatExpiry(e.target.value) })}
                    placeholder="MM/YY"
                    className="w-full px-4 py-3 rounded-xl border border-border bg-background text-on-background font-medium focus:outline-none focus:ring-2 focus:ring-brand-pink transition-shadow"
                    maxLength={5}
                  />
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2 block">CVC</label>
                  <input
                    type="text"
                    value={newCard.cvc}
                    onChange={(e) => setNewCard({ ...newCard, cvc: e.target.value.replace(/\D/g, "").slice(0, 4) })}
                    placeholder="123"
                    className="w-full px-4 py-3 rounded-xl border border-border bg-background text-on-background font-medium focus:outline-none focus:ring-2 focus:ring-brand-pink transition-shadow"
                    maxLength={4}
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2 block">Cardholder Name</label>
                  <input
                    type="text"
                    value={newCard.holder}
                    onChange={(e) => setNewCard({ ...newCard, holder: e.target.value })}
                    placeholder="JOHN DOE"
                    className="w-full px-4 py-3 rounded-xl border border-border bg-background text-on-background font-medium uppercase focus:outline-none focus:ring-2 focus:ring-brand-pink transition-shadow"
                  />
                </div>
              </div>

              {/* Billing Address */}
              <div className="pt-4 border-t border-border">
                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4">Billing Address</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2 block">Street Address</label>
                    <input
                      type="text"
                      value={newCard.address}
                      onChange={(e) => setNewCard({ ...newCard, address: e.target.value })}
                      placeholder="123 Main Street"
                      className="w-full px-4 py-3 rounded-xl border border-border bg-background text-on-background font-medium focus:outline-none focus:ring-2 focus:ring-brand-pink transition-shadow"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2 block">City</label>
                    <input
                      type="text"
                      value={newCard.city}
                      onChange={(e) => setNewCard({ ...newCard, city: e.target.value })}
                      placeholder="São Paulo"
                      className="w-full px-4 py-3 rounded-xl border border-border bg-background text-on-background font-medium focus:outline-none focus:ring-2 focus:ring-brand-pink transition-shadow"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2 block">State / Province</label>
                    <input
                      type="text"
                      value={newCard.state}
                      onChange={(e) => setNewCard({ ...newCard, state: e.target.value })}
                      placeholder="SP"
                      className="w-full px-4 py-3 rounded-xl border border-border bg-background text-on-background font-medium focus:outline-none focus:ring-2 focus:ring-brand-pink transition-shadow"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2 block">ZIP / Postal Code</label>
                    <input
                      type="text"
                      value={newCard.zip}
                      onChange={(e) => setNewCard({ ...newCard, zip: e.target.value })}
                      placeholder="01000-000"
                      className="w-full px-4 py-3 rounded-xl border border-border bg-background text-on-background font-medium focus:outline-none focus:ring-2 focus:ring-brand-pink transition-shadow"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2 block">Country</label>
                    <input
                      type="text"
                      value={newCard.country}
                      onChange={(e) => setNewCard({ ...newCard, country: e.target.value })}
                      placeholder="Brazil"
                      className="w-full px-4 py-3 rounded-xl border border-border bg-background text-on-background font-medium focus:outline-none focus:ring-2 focus:ring-brand-pink transition-shadow"
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleAddCard}
                  className="px-8 py-3 bg-brand-pink text-primary-foreground font-black uppercase tracking-widest text-xs rounded-full hover:opacity-90 transition-opacity"
                >
                  Save Card
                </button>
                <button
                  onClick={() => { setShowAddCard(false); setNewCard({ number: "", expiry: "", cvc: "", holder: "", address: "", city: "", state: "", zip: "", country: "" }); }}
                  className="px-8 py-3 bg-secondary text-foreground font-black uppercase tracking-widest text-xs rounded-full hover:bg-secondary/80 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowAddCard(true)}
              className="flex items-center gap-3 px-6 py-4 rounded-2xl border-2 border-dashed border-border hover:border-brand-pink text-muted-foreground hover:text-brand-pink transition-all w-full group"
            >
              <Plus className="w-5 h-5 group-hover:scale-110 transition-transform" />
              <span className="font-black tracking-tight text-sm">Add New Card</span>
            </button>
          )}
        </section>
      );
    }

    if (activeTab === "Settings") {
      return (
        <section className="space-y-8">
          <div>
            <p className="font-bold uppercase tracking-widest text-xs text-brand-pink">ACCOUNT</p>
            <h2 className="text-4xl md:text-5xl font-black tracking-tighter text-on-background">SETTINGS</h2>
          </div>

          <div className="space-y-2">
            {/* Name */}
            <div className="flex items-center justify-between p-6 rounded-2xl border border-border bg-secondary/50 hover:bg-secondary transition-all">
              <div className="flex-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Full Name</label>
                {editingField === "name" ? (
                  <input
                    type="text"
                    value={settingsForm.name}
                    onChange={(e) => setSettingsForm({ ...settingsForm, name: e.target.value })}
                    className="w-full mt-1 px-4 py-2.5 rounded-xl border border-border bg-background text-on-background font-bold focus:outline-none focus:ring-2 focus:ring-brand-pink"
                    autoFocus
                  />
                ) : (
                  <p className="font-black text-lg tracking-tight text-on-background mt-1">{user.name}</p>
                )}
              </div>
              <div className="flex gap-2 ml-4">
                {editingField === "name" ? (
                  <>
                    <button onClick={() => handleSaveSettings("name")} className="p-2 rounded-lg text-brand-pink hover:bg-brand-pink/10 transition-colors">
                      <Check className="w-5 h-5" />
                    </button>
                    <button onClick={() => { setEditingField(null); setSettingsForm((f) => ({ ...f, name: user.name })); }} className="p-2 rounded-lg text-muted-foreground hover:bg-secondary transition-colors">
                      <X className="w-5 h-5" />
                    </button>
                  </>
                ) : (
                  <button onClick={() => setEditingField("name")} className="p-2 rounded-lg text-muted-foreground hover:text-brand-pink hover:bg-brand-pink/10 transition-colors">
                    <Pencil className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Email */}
            <div className="flex items-center justify-between p-6 rounded-2xl border border-border bg-secondary/50 hover:bg-secondary transition-all">
              <div className="flex-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Email Address</label>
                {editingField === "email" ? (
                  <input
                    type="email"
                    value={settingsForm.email}
                    onChange={(e) => setSettingsForm({ ...settingsForm, email: e.target.value })}
                    className="w-full mt-1 px-4 py-2.5 rounded-xl border border-border bg-background text-on-background font-bold focus:outline-none focus:ring-2 focus:ring-brand-pink"
                    autoFocus
                  />
                ) : (
                  <p className="font-black text-lg tracking-tight text-on-background mt-1">{user.email}</p>
                )}
              </div>
              <div className="flex gap-2 ml-4">
                {editingField === "email" ? (
                  <>
                    <button onClick={() => handleSaveSettings("email")} className="p-2 rounded-lg text-brand-pink hover:bg-brand-pink/10 transition-colors">
                      <Check className="w-5 h-5" />
                    </button>
                    <button onClick={() => { setEditingField(null); setSettingsForm((f) => ({ ...f, email: user.email })); }} className="p-2 rounded-lg text-muted-foreground hover:bg-secondary transition-colors">
                      <X className="w-5 h-5" />
                    </button>
                  </>
                ) : (
                  <button onClick={() => setEditingField("email")} className="p-2 rounded-lg text-muted-foreground hover:text-brand-pink hover:bg-brand-pink/10 transition-colors">
                    <Pencil className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Phone */}
            <div className="flex items-center justify-between p-6 rounded-2xl border border-border bg-secondary/50 hover:bg-secondary transition-all">
              <div className="flex-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Phone Number</label>
                {editingField === "phone" ? (
                  <div className="mt-1">
                    <PhoneInput
                      value={settingsForm.phone}
                      onChange={(val) => setSettingsForm({ ...settingsForm, phone: val })}
                    />
                  </div>
                ) : (
                  <p className="font-black text-lg tracking-tight text-on-background mt-1">{user.phone || "Not set"}</p>
                )}
              </div>
              <div className="flex gap-2 ml-4">
                {editingField === "phone" ? (
                  <>
                    <button onClick={() => handleSaveSettings("phone")} className="p-2 rounded-lg text-brand-pink hover:bg-brand-pink/10 transition-colors">
                      <Check className="w-5 h-5" />
                    </button>
                    <button onClick={() => { setEditingField(null); setSettingsForm((f) => ({ ...f, phone: user.phone })); }} className="p-2 rounded-lg text-muted-foreground hover:bg-secondary transition-colors">
                      <X className="w-5 h-5" />
                    </button>
                  </>
                ) : (
                  <button onClick={() => setEditingField("phone")} className="p-2 rounded-lg text-muted-foreground hover:text-brand-pink hover:bg-brand-pink/10 transition-colors">
                    <Pencil className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Change Password */}
            <div className="p-6 rounded-2xl border border-border bg-secondary/50 space-y-4">
              <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Change Password</label>
              <div className="space-y-3">
                <div className="relative">
                  <input
                    type={showCurrentPassword ? "text" : "password"}
                    value={settingsForm.currentPassword}
                    onChange={(e) => setSettingsForm({ ...settingsForm, currentPassword: e.target.value })}
                    placeholder="Current Password"
                    className="w-full px-4 py-3 rounded-xl border border-border bg-background text-on-background font-medium focus:outline-none focus:ring-2 focus:ring-brand-pink pr-12"
                  />
                  <button
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-on-background transition-colors"
                  >
                    {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={showNewPassword ? "text" : "password"}
                    value={settingsForm.newPassword}
                    onChange={(e) => setSettingsForm({ ...settingsForm, newPassword: e.target.value })}
                    placeholder="New Password"
                    className="w-full px-4 py-3 rounded-xl border border-border bg-background text-on-background font-medium focus:outline-none focus:ring-2 focus:ring-brand-pink pr-12"
                  />
                  <button
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-on-background transition-colors"
                  >
                    {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <input
                  type="password"
                  value={settingsForm.confirmPassword}
                  onChange={(e) => setSettingsForm({ ...settingsForm, confirmPassword: e.target.value })}
                  placeholder="Confirm New Password"
                  className="w-full px-4 py-3 rounded-xl border border-border bg-background text-on-background font-medium focus:outline-none focus:ring-2 focus:ring-brand-pink"
                />
                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => handleSaveSettings("password")}
                    className="px-8 py-3 bg-brand-pink text-primary-foreground font-black uppercase tracking-widest text-xs rounded-full hover:opacity-90 transition-opacity"
                  >
                    Update Password
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>
      );
    }

    // Default: My Tickets + events + organizers
    return (
      <>
        {/* My Tickets */}
        <section>
          <div className="flex justify-between items-end mb-8">
            <div>
              <p className="font-bold uppercase tracking-widest text-xs text-brand-pink">UPCOMING</p>
              <h2 className="text-4xl md:text-5xl font-black tracking-tighter text-on-background">{isViewMode ? "UPCOMING EVENTS" : "MY TICKETS"}</h2>
            </div>
            {groupedUpcoming.length > 2 && !showAllTickets && (
              <button
                onClick={() => setShowAllTickets(true)}
                className="flex items-center gap-1 text-xs font-black uppercase tracking-widest text-brand-pink hover:opacity-70 transition-opacity"
              >
                View All <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
            {showAllTickets && (
              <button
                onClick={() => setShowAllTickets(false)}
                className="flex items-center gap-1 text-xs font-black uppercase tracking-widest text-muted-foreground hover:opacity-70 transition-opacity"
              >
                Show Less
              </button>
            )}
          </div>
          {ticketsLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-6 h-6 border-2 border-muted-foreground/30 border-t-muted-foreground rounded-full animate-spin" />
            </div>
          ) : groupedUpcoming.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 rounded-3xl border border-dashed border-border bg-secondary/30">
              <Ticket className="w-12 h-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground font-bold text-sm">{isViewMode ? "No upcoming events" : "No upcoming tickets"}</p>
              <p className="text-muted-foreground text-xs mt-1">{isViewMode ? "This user has no upcoming events" : "Your purchased tickets will appear here"}</p>
              {!isViewMode && (
                <button
                  onClick={() => navigate("/explore")}
                  className="mt-6 px-8 py-3 bg-brand-pink text-primary-foreground font-black uppercase tracking-widest text-xs rounded-full hover:opacity-90 transition-opacity"
                >
                  Explore Events
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {(showAllTickets ? groupedUpcoming : groupedUpcoming.slice(0, 2)).map((group) => (
                <div
                  key={group.eventId}
                  className="group relative rounded-[1.5rem] overflow-hidden bg-secondary border border-border hover:border-brand-pink/50 transition-all cursor-pointer"
                  onClick={() => isViewMode ? navigate(`/event/${group.eventId}`) : undefined}
                >
                  <div className="flex">
                    {/* Event image */}
                    <div className="w-[140px] shrink-0 overflow-hidden">
                      <img
                        className="w-full h-full object-cover min-h-[200px]"
                        src={group.image}
                        alt={group.eventTitle}
                        loading="lazy"
                      />
                    </div>
                    {/* Event / Ticket info */}
                    <div className="flex-1 p-5 flex flex-col justify-between">
                      <div className="space-y-2">
                        <h3 className="text-lg font-black tracking-tighter text-on-background leading-tight">
                          {group.eventTitle}
                        </h3>
                        <div className="space-y-1 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                          <p>{group.date}</p>
                          <p>{group.venue} · {group.location}</p>
                        </div>
                        {!isViewMode && (
                          <div className="flex items-center gap-2">
                            <span className="inline-block bg-brand-lime text-black px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">
                              {group.totalQuantity} {group.totalQuantity === 1 ? "Ticket" : "Tickets"}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* View Tickets button - only for own profile */}
                      {!isViewMode && (
                        <div className="flex gap-2 mt-3">
                          <button
                            onClick={() => setExpandedEvent(group.eventId)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-foreground text-background text-[10px] font-black uppercase tracking-widest hover:opacity-80 transition-opacity"
                          >
                            <Ticket className="w-3 h-3" />
                            View {group.totalQuantity === 1 ? "Ticket" : `All ${group.totalQuantity} Tickets`}
                          </button>
                        </div>
                      )}
                      {isViewMode && (
                        <button
                          onClick={() => navigate(`/event/${group.eventId}`)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-foreground text-background text-[10px] font-black uppercase tracking-widest hover:opacity-80 transition-opacity mt-3 w-fit"
                        >
                          View Event
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* QR Code Modal */}
          <Dialog open={!!qrTicket} onOpenChange={() => setQrTicket(null)}>
            <DialogContent className="max-w-xs text-center">
              <DialogHeader>
                <DialogTitle className="text-center font-black uppercase tracking-tighter">Your QR Code</DialogTitle>
              </DialogHeader>
              <div className="flex justify-center py-4">
                <div className="w-48 h-48 bg-white rounded-2xl p-3 shadow-md flex items-center justify-center">
                  {qrTicket && (
                    <QRCodeSVG
                      value={`https://brazou.com/ticket/${qrTicket}`}
                      size={168}
                      level="M"
                      includeMargin={false}
                    />
                  )}
                </div>
              </div>
              <p className="text-xs text-muted-foreground font-bold uppercase tracking-widest">Present this at the entrance</p>
            </DialogContent>
          </Dialog>

          {/* All Tickets Dialog */}
          <Dialog open={!!expandedEvent} onOpenChange={(open) => !open && setExpandedEvent(null)}>
            <DialogContent className="sm:max-w-md rounded-3xl p-0 overflow-hidden">
              <DialogHeader className="px-6 pt-6 pb-0">
                <DialogTitle className="text-xl font-black tracking-tight">
                  {groupedUpcoming.find(g => g.eventId === expandedEvent)?.eventTitle || "Tickets"}
                </DialogTitle>
              </DialogHeader>
              {(() => {
                const group = groupedUpcoming.find(g => g.eventId === expandedEvent);
                if (!group) return null;
                return (
                  <div className="px-6 pb-6 pt-2 space-y-3">
                    <div className="flex items-center gap-3 text-xs text-muted-foreground font-bold uppercase tracking-wider">
                      <span>{group.date}</span>
                      <span>•</span>
                      <span>{group.venue}</span>
                    </div>
                    <p className="text-sm font-bold text-on-background">
                      {group.totalQuantity} {group.totalQuantity === 1 ? "Ticket" : "Tickets"}
                    </p>
                    <div className="space-y-3 max-h-[400px] overflow-y-auto">
                      {group.tickets.map((ticket, tIdx) => (
                        Array.from({ length: ticket.quantity }, (_, qIdx) => (
                          <div
                            key={`${ticket.id}-${qIdx}`}
                            className="flex items-center justify-between p-4 bg-secondary rounded-2xl border border-border"
                          >
                            <div className="space-y-1">
                              <p className="text-sm font-black text-on-background">
                                Ticket #{tIdx + qIdx + 1}
                              </p>
                              <span className="inline-block bg-brand-lime text-black px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest">
                                {ticket.ticketType}
                              </span>
                            </div>
                            <div className="flex gap-2">
                              <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-foreground text-background text-[9px] font-black uppercase tracking-widest hover:opacity-80 transition-opacity">
                                <Download className="w-3 h-3" />
                                PDF
                              </button>
                              <button
                                onClick={() => { setExpandedEvent(null); setTimeout(() => setQrTicket(ticket.publicToken), 150); }}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border text-foreground text-[9px] font-black uppercase tracking-widest hover:bg-secondary transition-colors"
                              >
                                <QrCode className="w-3 h-3" />
                                QR
                              </button>
                            </div>
                          </div>
                        ))
                      ))}
                    </div>
                  </div>
                );
              })()}
            </DialogContent>
          </Dialog>
        </section>

        {/* Last Events */}
        <section>
          <div className="mb-8">
            <div>
              <p className="font-bold uppercase tracking-widest text-xs text-brand-pink">JOURNEY HISTORY</p>
              <h2 className="text-4xl md:text-5xl font-black tracking-tighter text-on-background">
                {showAllEvents ? "ALL EVENTS" : "LAST EVENTS"}
              </h2>
            </div>
            <button
              onClick={() => setShowAllEvents(!showAllEvents)}
              className="font-black uppercase tracking-widest text-[10px] hover:text-brand-pink transition-colors underline underline-offset-8 text-on-background mt-2"
            >
              {showAllEvents ? "Show Less" : "View All History"}
            </button>
          </div>
          <div className="flex flex-col gap-4 pb-4">
            {displayedEvents.map((event) => (
              <div key={event.title} className="group flex rounded-[1.5rem] overflow-hidden bg-secondary border border-border">
                <div className="w-28 h-28 shrink-0 overflow-hidden">
                  <img
                    className="w-full h-full object-cover grayscale group-hover:grayscale-0 group-hover:scale-110 transition-all duration-700"
                    src={event.image}
                    alt={event.title}
                    loading="lazy"
                  />
                </div>
                <div className="p-3 flex flex-col justify-center gap-1.5 min-w-0">
                  <h3 className="text-sm font-black tracking-tighter text-on-background leading-tight truncate">{event.title}</h3>
                  <div className="flex gap-2 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                    <span>{event.date}</span>
                    <span>•</span>
                    <span className="truncate">{event.location}</span>
                  </div>
                  <span className="bg-[#CDFF00] text-black px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest whitespace-nowrap self-start">
                    Completed
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Organizers Following */}
        <section>
          <div className="flex justify-between items-end mb-8">
            <div>
              <p className="font-bold uppercase tracking-widest text-xs text-brand-pink">CURATED NETWORK</p>
              <h2 className="text-4xl md:text-5xl font-black tracking-tighter text-on-background">ORGANIZERS FOLLOWING</h2>
            </div>
            {followedOrgs.length > 5 && (
              <button
                onClick={() => setShowAllOrganizers(!showAllOrganizers)}
                className="font-black uppercase tracking-widest text-[10px] hover:text-brand-pink transition-colors underline underline-offset-8 text-on-background"
              >
                {showAllOrganizers ? "Show Less" : "View All"}
              </button>
            )}
          </div>
          <div className={
            showAllOrganizers
              ? "grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-8 max-h-[400px] overflow-y-auto hide-scrollbar pb-4"
              : "grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-8"
          }>
            {displayedOrganizers.length === 0 ? (
              <div className="col-span-full text-center py-8">
                <p className="text-muted-foreground text-sm font-medium">Not following any organizations yet.</p>
              </div>
            ) : displayedOrganizers.map((org) => (
              <div key={org.slug} className="group flex flex-col items-center space-y-4 cursor-pointer" onClick={() => navigate(`/org/${org.slug}`)}>
                <div className="w-20 h-20 md:w-24 md:h-24 rounded-full overflow-hidden border-2 border-transparent group-hover:border-brand-pink transition-all p-1">
                  {org.avatar ? (
                    <img
                      className="w-full h-full object-cover rounded-full grayscale group-hover:grayscale-0 transition-all duration-500"
                      src={org.avatar}
                      alt={org.name}
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full rounded-full bg-secondary flex items-center justify-center text-xl font-black text-muted-foreground">
                      {org.name[0]}
                    </div>
                  )}
                </div>
                <span className="font-black text-xs uppercase tracking-widest text-center group-hover:text-brand-pink transition-colors text-on-background">
                  {org.name}
                </span>
              </div>
            ))}
          </div>
        </section>
      </>
    );
  };

  return (
    <>
    <main className="max-w-7xl mx-auto px-8 pt-28 pb-16 space-y-20">
        {/* Profile Header */}
        <section className="flex flex-col md:flex-row items-center md:items-end gap-8 md:gap-12">
          <div className="relative group">
            <div className="w-40 h-40 md:w-48 md:h-48 rounded-full border-4 border-brand-pink p-1 overflow-hidden">
              <Avatar className="w-full h-full">
                <AvatarImage src={(isViewMode ? displayUser?.avatarUrl : user?.avatarUrl) || ""} alt={(isViewMode ? displayUser?.name : user?.name) || ""} className="object-cover grayscale group-hover:grayscale-0 transition-all duration-500" />
                <AvatarFallback className="bg-brand-pink text-primary-foreground text-4xl font-black w-full h-full">
                  {getInitials((isViewMode ? displayUser?.name : user?.name) || "")}
                </AvatarFallback>
              </Avatar>
            </div>
            {!isViewMode && (
            <div
              onClick={() => avatarInputRef.current?.click()}
              className="absolute inset-0 rounded-full flex items-center justify-center bg-foreground/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300 cursor-pointer"
            >
              {uploadingAvatar ? (
                <div className="w-8 h-8 border-3 border-background border-t-transparent rounded-full animate-spin" />
              ) : (
                <Pencil className="w-8 h-8 text-background" />
              )}
            </div>
            )}
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarUpload}
            />
          </div>
          <div className="flex-1 text-center md:text-left space-y-2">
            <p className="font-bold uppercase tracking-widest text-xs text-brand-pink">
              MEMBER SINCE {session?.user?.created_at ? new Date(session.user.created_at).getFullYear() : "—"}
            </p>
            <h1 className="text-3xl md:text-7xl lg:text-8xl font-black tracking-tighter leading-none text-on-background text-balance">
                {((isViewMode ? displayUser?.name : user?.name) || "").toUpperCase().split(" ").map((n: string, i: number) => i === 0 ? n : n[0] + ".").join(" ")}
              </h1>
              <div className="border-l-4 border-brand-lime pl-4 mt-2">
                <p className="font-bold uppercase tracking-widest text-[10px] text-muted-foreground leading-tight">
                  EVENTS ATTENDED
                </p>
                <span className="text-2xl md:text-4xl font-black tracking-tighter leading-none text-on-background">
                  {isViewMode && displayUser ? displayUser.eventsAttended : new Set(myTickets.map(t => t.eventTitle)).size}
                </span>
              </div>
          </div>
        </section>

        {/* Main Grid */}
        <div className="grid grid-cols-12 gap-8">
          {/* Sidebar */}
          {!isViewMode && (
          <div className="col-span-12 md:col-span-3 space-y-8">
            <div>
              <p className="font-bold uppercase tracking-widest text-xs text-brand-pink mb-6">ACCOUNT MANAGEMENT</p>
              <nav className="flex flex-col space-y-1">
                {sidebarItems.map((item) => (
                  <button
                    key={item.label}
                    onClick={() => setActiveTab(item.label)}
                    className={`flex items-center justify-between group py-4 px-6 rounded-xl transition-all w-full text-left ${
                      activeTab === item.label
                        ? "bg-secondary text-on-background"
                        : "hover:bg-secondary/50"
                    }`}
                  >
                    <span className="font-black tracking-tight text-base">{item.label}</span>
                    {activeTab === item.label ? (
                      <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                    ) : (
                      <item.icon className="w-5 h-5 text-muted-foreground" />
                    )}
                  </button>
                ))}
              </nav>
            </div>
          </div>
          )}

          {/* Main Content */}
          <div className={`col-span-12 ${isViewMode ? '' : 'md:col-span-9'} space-y-16`}>
            {renderMainContent()}
          </div>
        </div>
      </main>
    
      <VerifyChangeModal
        open={verifyModal.open}
        onClose={() => setVerifyModal({ open: false, field: "email", value: "" })}
        onVerified={handleVerified}
        field={verifyModal.field}
        newValue={verifyModal.value}
      />
    </>
  );
};

export default Profile;
