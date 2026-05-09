import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Camera, Plus, Trash2, Instagram, Globe, Link as LinkIcon, X } from "lucide-react";
import { regions } from "@/data/locations";
import { useOrganizations, OrgType, OrgSocials, OrgLink, Organization } from "@/contexts/OrganizationContext";
import { toast } from "sonner";
import { uploadEventImage } from "@/lib/uploadImage";

const ORG_TYPES: { value: OrgType; label: string; emoji: string }[] = [
  { value: "venue", label: "Venue", emoji: "🏟️" },
  { value: "event_organizer", label: "Event Organizer", emoji: "🎪" },
  { value: "person", label: "Person", emoji: "🧑‍🎤" },
  { value: "community", label: "Community", emoji: "👥" },
];

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated?: () => void;
  editOrganization?: Organization;
}

const CreateOrganizationModal = ({ open, onClose, onCreated, editOrganization }: Props) => {
  const { addOrganization, updateOrganization } = useOrganizations();
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);

  const isEditing = !!editOrganization;

  const [name, setName] = useState("");
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [orgType, setOrgType] = useState<OrgType | "">("");
  const [region, setRegion] = useState("");
  const [country, setCountry] = useState("");
  const [state, setState] = useState("");
  const [socials, setSocials] = useState<OrgSocials>({});
  const [links, setLinks] = useState<OrgLink[]>([]);
  const [newLinkLabel, setNewLinkLabel] = useState("");
  const [newLinkUrl, setNewLinkUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);

  // Pre-populate when editing
  useEffect(() => {
    if (editOrganization && open) {
      setName(editOrganization.name);
      setAvatarPreview(editOrganization.avatarUrl || null);
      setOrgType(editOrganization.type);
      setRegion(editOrganization.region);
      setCountry(editOrganization.country);
      setState(editOrganization.state);
      setSocials(editOrganization.socials || {});
      setLinks(editOrganization.links || []);
      setAvatarFile(null);
    } else if (!editOrganization && open) {
      resetForm();
    }
  }, [editOrganization, open]);

  const selectedRegion = regions.find((r) => r.name === region);
  const selectedCountry = selectedRegion?.countries.find((c) => c.name === country);

  const MAX_FILE_SIZE = 8 * 1024 * 1024; // 8 MB

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > MAX_FILE_SIZE) {
        toast.error("File too large. Maximum size is 8 MB.");
        return;
      }
      setAvatarFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setAvatarPreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const addLink = () => {
    if (newLinkLabel.trim() && newLinkUrl.trim()) {
      setLinks((prev) => [...prev, { label: newLinkLabel.trim(), url: newLinkUrl.trim() }]);
      setNewLinkLabel("");
      setNewLinkUrl("");
    }
  };

  const removeLink = (index: number) => {
    setLinks((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!name.trim()) { toast.error("Organization name is required"); return; }
    if (!orgType) { toast.error("Please select an organization type"); return; }
    if (!region || !country) { toast.error("Please select a location"); return; }

    setSaving(true);
    const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

    // Upload avatar if new file provided
    let avatarUrl: string | undefined = isEditing ? editOrganization?.avatarUrl : undefined;
    if (avatarFile) {
      const id = isEditing ? editOrganization!.id : crypto.randomUUID();
      const url = await uploadEventImage(avatarFile, id, "flyer");
      if (url) avatarUrl = url;
    }

    try {
      if (isEditing) {
        await updateOrganization(editOrganization!.id, {
          name: name.trim(),
          slug,
          avatarUrl,
          type: orgType as OrgType,
          region,
          country,
          state,
          socials,
          links,
        });
        toast.success("Organization updated!");
        onClose();
        // Navigate to new slug if name changed
        if (slug !== editOrganization!.slug) {
          navigate(`/dashboard/${slug}`);
        }
      } else {
        const orgId = crypto.randomUUID();
        if (avatarFile && !avatarUrl) {
          const url = await uploadEventImage(avatarFile, orgId, "flyer");
          if (url) avatarUrl = url;
        }
        await addOrganization({
          id: orgId,
          slug,
          name: name.trim(),
          avatarUrl,
          type: orgType as OrgType,
          region,
          country,
          state,
          socials,
          links,
          createdAt: new Date().toISOString(),
        });
        toast.success("Organization created!");
        resetForm();
        onCreated?.();
        onClose();
        navigate(`/dashboard/${slug}`);
      }
    } catch (err: any) {
      toast.error(err?.message || `Failed to ${isEditing ? "update" : "create"} organization`);
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setName(""); setAvatarPreview(null); setOrgType(""); setRegion(""); setCountry(""); setState("");
    setSocials({}); setLinks([]); setNewLinkLabel(""); setNewLinkUrl(""); setAvatarFile(null);
  };

  const selectClasses = "w-full bg-secondary text-foreground border border-border rounded-xl px-4 py-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-ring appearance-none";
  const inputClasses = "w-full bg-secondary text-foreground border border-border rounded-xl px-4 py-3 text-sm font-medium placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring";

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto bg-surface border-border rounded-3xl p-0">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle className="text-2xl font-black tracking-tight text-on-background">
            {isEditing ? "Edit Organization" : "Create Organization"}
          </DialogTitle>
        </DialogHeader>

        <div className="px-6 pb-6 space-y-6">
          {/* Avatar */}
          <div className="flex flex-col items-center gap-3">
            <button
              onClick={() => fileRef.current?.click()}
              className="relative w-24 h-24 rounded-full border-2 border-dashed border-border hover:border-brand-pink transition-colors flex items-center justify-center overflow-hidden bg-secondary group"
            >
              {avatarPreview ? (
                <img src={avatarPreview} alt="Preview" className="w-full h-full object-cover" />
              ) : (
                <Camera className="w-7 h-7 text-muted-foreground group-hover:text-brand-pink transition-colors" />
              )}
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
            <p className="text-xs text-muted-foreground font-medium">
              {isEditing ? "Change profile picture" : "Upload profile picture"}
            </p>
          </div>

          {/* Name */}
          <div>
            <label className="block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">Organization Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Utopia Events" className={inputClasses} />
          </div>

          {/* Type */}
          <div>
            <label className="block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">Type</label>
            <div className="grid grid-cols-2 gap-2">
              {ORG_TYPES.map((t) => (
                <button
                  key={t.value}
                  onClick={() => setOrgType(t.value)}
                  className={`flex items-center gap-2.5 px-4 py-3 rounded-xl border text-sm font-bold transition-all ${
                    orgType === t.value
                      ? "border-brand-pink bg-brand-pink/10 text-brand-pink"
                      : "border-border bg-secondary text-foreground hover:border-brand-pink/50"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Location */}
          <div>
            <label className="block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">Location</label>
            <div className="space-y-2">
              <select value={region} onChange={(e) => { setRegion(e.target.value); setCountry(""); setState(""); }} className={selectClasses}>
                <option value="">Select Region</option>
                {regions.map((r) => <option key={r.name} value={r.name}>{r.name}</option>)}
              </select>
              {region && (
                <select value={country} onChange={(e) => { setCountry(e.target.value); setState(""); }} className={selectClasses}>
                  <option value="">Select Country</option>
                  {selectedRegion?.countries.map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
                </select>
              )}
              {country && selectedCountry && selectedCountry.states.length > 0 && (
                <select value={state} onChange={(e) => setState(e.target.value)} className={selectClasses}>
                  <option value="">Select State / Region</option>
                  {selectedCountry.states.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              )}
            </div>
          </div>

          {/* Social Media */}
          <div>
            <label className="block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">Social Media</label>
            <div className="space-y-2">
              {([
                { key: "instagram" as const, placeholder: "Instagram URL", icon: <Instagram className="w-4 h-4" /> },
                { key: "tiktok" as const, placeholder: "TikTok URL", icon: <span className="text-sm font-black">T</span> },
                { key: "x" as const, placeholder: "X (Twitter) URL", icon: <span className="text-sm font-black">𝕏</span> },
                { key: "youtube" as const, placeholder: "YouTube URL", icon: <span className="text-sm font-black">▶</span> },
                { key: "website" as const, placeholder: "Website URL", icon: <Globe className="w-4 h-4" /> },
              ]).map((s) => (
                <div key={s.key} className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded-xl bg-secondary border border-border flex items-center justify-center text-muted-foreground flex-shrink-0">
                    {s.icon}
                  </div>
                  <input
                    value={socials[s.key] || ""}
                    onChange={(e) => setSocials((prev) => ({ ...prev, [s.key]: e.target.value }))}
                    placeholder={s.placeholder}
                    className={inputClasses}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Custom Links */}
          <div>
            <label className="block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">Custom Links</label>
            {links.length > 0 && (
              <div className="space-y-2 mb-3">
                {links.map((link, i) => (
                  <div key={i} className="flex items-center gap-2 bg-secondary rounded-xl px-4 py-2.5 border border-border">
                    <LinkIcon className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-on-background truncate">{link.label}</p>
                      <p className="text-xs text-muted-foreground truncate">{link.url}</p>
                    </div>
                    <button onClick={() => removeLink(i)} className="text-muted-foreground hover:text-destructive transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <input value={newLinkLabel} onChange={(e) => setNewLinkLabel(e.target.value)} placeholder="Label" className={`${inputClasses} flex-1`} />
              <input value={newLinkUrl} onChange={(e) => setNewLinkUrl(e.target.value)} placeholder="URL" className={`${inputClasses} flex-1`} />
              <button
                onClick={addLink}
                disabled={!newLinkLabel.trim() || !newLinkUrl.trim()}
                className="w-10 h-10 rounded-xl bg-brand-pink text-primary-foreground flex items-center justify-center flex-shrink-0 hover:opacity-90 transition-opacity disabled:opacity-30"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="w-full bg-brand-pink text-primary-foreground py-4 rounded-full font-black tracking-tight text-base hover:scale-[1.02] transition-all shadow-xl disabled:opacity-50"
          >
            {saving ? (isEditing ? "Saving..." : "Creating...") : (isEditing ? "Save Changes" : "Create Organization")}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CreateOrganizationModal;
