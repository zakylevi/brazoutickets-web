import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Upload, Instagram, Music2 } from "lucide-react";
import { EventArtist } from "@/stores/eventStore";

interface AddArtistModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (artist: EventArtist) => void;
}

const AddArtistModal = ({ open, onOpenChange, onAdd }: AddArtistModalProps) => {
  const [name, setName] = useState("");
  const [image, setImage] = useState("");
  const [instagram, setInstagram] = useState("");
  const [spotify, setSpotify] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (ext === "heic" || ext === "heif" || file.type === "image/heic" || file.type === "image/heif") {
      alert("HEIC photos aren't supported by browsers. Please convert to JPG or PNG first.\n\nOn iPhone: open the photo → tap Share → Save as file → choose JPG.");
      e.target.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => setImage(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleAdd = () => {
    if (!name.trim()) return;
    onAdd({ name: name.trim(), image, instagram: instagram.trim(), spotify: spotify.trim() });
    setName("");
    setImage("");
    setInstagram("");
    setSpotify("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md rounded-3xl border-border">
        <DialogHeader>
          <DialogTitle className="text-xl font-black tracking-tight">Add Artist</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 pt-2">
          {/* Photo */}
          <div className="flex flex-col items-center gap-3">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="w-28 h-28 rounded-[1.5rem] border-2 border-dashed border-border bg-secondary flex items-center justify-center overflow-hidden hover:border-primary transition-colors group"
            >
              {image ? (
                <img src={image} alt="Preview" className="w-full h-full object-cover" />
              ) : (
                <Upload className="w-6 h-6 text-muted-foreground group-hover:text-primary transition-colors" />
              )}
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
            <span className="text-xs text-muted-foreground font-medium">Upload photo</span>
          </div>

          {/* Name */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Name</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Artist name"
              className="font-bold"
            />
          </div>

          {/* Instagram */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Instagram className="w-3.5 h-3.5" /> Instagram
            </label>
            <Input
              value={instagram}
              onChange={(e) => setInstagram(e.target.value)}
              placeholder="@username"
            />
          </div>

          {/* Spotify */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Music2 className="w-3.5 h-3.5" /> Spotify
            </label>
            <Input
              value={spotify}
              onChange={(e) => setSpotify(e.target.value)}
              placeholder="Spotify profile URL"
            />
          </div>

          <Button
            onClick={handleAdd}
            disabled={!name.trim()}
            className="w-full rounded-full bg-primary text-primary-foreground font-black text-sm h-11"
          >
            Add to Lineup
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AddArtistModal;
