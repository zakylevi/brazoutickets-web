import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, ChevronRight } from "lucide-react";
import { useOrganizations } from "@/contexts/OrganizationContext";
import { useNavigate } from "react-router-dom";
import CreateOrganizationModal from "./CreateOrganizationModal";

interface Props {
  open: boolean;
  onClose: () => void;
}

const ORG_TYPE_LABELS: Record<string, string> = {
  venue: "Venue",
  event_organizer: "Event Organizer",
  person: "Person",
  community: "Community",
};

const OrganizationSelectorModal = ({ open, onClose }: Props) => {
  const { organizations } = useOrganizations();
  const navigate = useNavigate();
  const [createOpen, setCreateOpen] = useState(false);

  const handleSelect = (slug: string) => {
    onClose();
    navigate(`/dashboard/${slug}`);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
        <DialogContent className="max-w-md bg-surface border-border rounded-3xl p-0">
          <DialogHeader className="p-6 pb-4">
            <DialogTitle className="text-2xl font-black tracking-tight text-on-background">My Organizations</DialogTitle>
          </DialogHeader>

          <div className="px-6 pb-6 space-y-3">
            {organizations.length === 0 && (
              <p className="text-center text-muted-foreground font-medium py-6 text-sm">
                You haven't created any organizations yet.
              </p>
            )}

            {organizations.map((org) => (
              <button
                key={org.id}
                onClick={() => handleSelect(org.slug)}
                className="w-full flex items-center gap-4 p-4 rounded-2xl border border-border bg-secondary hover:border-brand-pink hover:shadow-lg transition-all group text-left"
              >
                <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-border flex-shrink-0 bg-muted">
                  {org.avatarUrl ? (
                    <img src={org.avatarUrl} alt={org.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-muted-foreground font-black text-lg">
                      {org.name[0]}
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-black text-on-background truncate group-hover:text-brand-pink transition-colors">
                    {org.name}
                  </p>
                  <p className="text-xs text-muted-foreground font-medium">
                    {ORG_TYPE_LABELS[org.type]} · {org.country}
                  </p>
                </div>
                <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-brand-pink transition-colors flex-shrink-0" />
              </button>
            ))}

            {/* Create New */}
            <button
              onClick={() => { onClose(); setCreateOpen(true); }}
              className="w-full flex items-center justify-center gap-3 p-4 rounded-2xl border-2 border-dashed border-border hover:border-brand-pink text-muted-foreground hover:text-brand-pink transition-all font-bold text-sm"
            >
              <Plus className="w-5 h-5" />
              Create New Organization
            </button>
          </div>
        </DialogContent>
      </Dialog>

      <CreateOrganizationModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
      />
    </>
  );
};

export default OrganizationSelectorModal;
