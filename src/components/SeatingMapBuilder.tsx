import { useState } from "react";
import { Plus, Trash2, GripVertical, Armchair, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { SERVICE_FEE_RATE, SERVICE_FEE_FLAT } from "@/lib/orderPricing";

export interface SeatingSection {
  id: string;
  name: string;
  rowsCount: number;
  seatsPerRow: number;
  isGeneralAdmission: boolean;
  sortOrder: number;
  price: string;
}

interface SeatingMapBuilderProps {
  sections: SeatingSection[];
  onChange: (sections: SeatingSection[]) => void;
  lockedSectionIds?: Set<string>;
}

const SECTION_COLORS = [
  "bg-blue-500/20 border-blue-500/40 text-blue-400",
  "bg-purple-500/20 border-purple-500/40 text-purple-400",
  "bg-amber-500/20 border-amber-500/40 text-amber-400",
  "bg-emerald-500/20 border-emerald-500/40 text-emerald-400",
  "bg-rose-500/20 border-rose-500/40 text-rose-400",
  "bg-cyan-500/20 border-cyan-500/40 text-cyan-400",
];

const SeatingMapBuilder = ({ sections, onChange, lockedSectionIds = new Set() }: SeatingMapBuilderProps) => {
  const [editingId, setEditingId] = useState<string | null>(null);

  const addSection = () => {
    const newSection: SeatingSection = {
      id: crypto.randomUUID(),
      name: `Section ${sections.length + 1}`,
      rowsCount: 5,
      seatsPerRow: 10,
      isGeneralAdmission: false,
      sortOrder: sections.length,
      price: "",
    };
    onChange([...sections, newSection]);
    setEditingId(newSection.id);
  };

  const updateSection = (id: string, patch: Partial<SeatingSection>) => {
    onChange(sections.map(s => s.id === id ? { ...s, ...patch } : s));
  };

  const removeSection = (id: string) => {
    if (lockedSectionIds.has(id)) return;
    onChange(sections.filter(s => s.id !== id));
    if (editingId === id) setEditingId(null);
  };

  const totalCapacity = sections.reduce((sum, s) => sum + s.rowsCount * s.seatsPerRow, 0);
  const totalSections = sections.length;

  return (
    <div className="space-y-6">
      {/* Stats bar */}
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2">
          <Armchair className="w-4 h-4 text-primary" />
          <span className="text-sm font-bold text-muted-foreground">
            {totalCapacity} total seats
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-primary" />
          <span className="text-sm font-bold text-muted-foreground">
            {totalSections} sections
          </span>
        </div>
      </div>

      {/* Visual preview */}
      {sections.length > 0 && (
        <div className="bg-secondary/50 rounded-2xl p-6 border border-border">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-4">Stage</p>
          <div className="w-full h-2 bg-primary/30 rounded-full mb-8" />
          
          <div className="space-y-3">
            {sections.map((section, idx) => {
              const colorClass = SECTION_COLORS[idx % SECTION_COLORS.length];
              return (
                <button
                  key={section.id}
                  onClick={() => setEditingId(editingId === section.id ? null : section.id)}
                  className={cn(
                    "w-full rounded-xl border p-3 text-left transition-all",
                    colorClass,
                    editingId === section.id && "ring-2 ring-primary"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <GripVertical className="w-4 h-4 opacity-40" />
                      <div>
                        <p className="font-black text-sm">{section.name}</p>
                        <p className="text-[10px] opacity-70">
                          {section.isGeneralAdmission
                            ? `General Admission · ${section.rowsCount * section.seatsPerRow} capacity`
                            : `${section.rowsCount} rows × ${section.seatsPerRow} seats`}
                          {section.price && ` · $${section.price}`}
                        </p>
                      </div>
                    </div>
                    <span className="text-xs font-bold opacity-60">
                      {section.rowsCount * section.seatsPerRow} seats
                    </span>
                  </div>

                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Section editor */}
      {editingId && (() => {
        const section = sections.find(s => s.id === editingId);
        if (!section) return null;
        const isLocked = lockedSectionIds.has(section.id);
        return (
          <div className="bg-card rounded-2xl border border-border p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h4 className="font-black text-sm">Edit Section</h4>
                {isLocked && (
                  <span className="text-[10px] font-bold text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-full">
                    Has sold tickets — locked
                  </span>
                )}
              </div>
              {!isLocked && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive"
                  onClick={() => removeSection(section.id)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label className="text-xs font-bold text-muted-foreground">Section Name</Label>
                <Input
                  value={section.name}
                  onChange={(e) => updateSection(section.id, { name: e.target.value })}
                  placeholder="e.g. Floor, Balcony A, VIP"
                  className="mt-1"
                  disabled={isLocked}
                />
              </div>

              <div className="flex items-center justify-between col-span-2">
                <Label className="text-xs font-bold text-muted-foreground">General Admission</Label>
                <Switch
                  checked={section.isGeneralAdmission}
                  onCheckedChange={(v) => updateSection(section.id, { isGeneralAdmission: v })}
                  disabled={isLocked}
                />
              </div>

              <div>
                <Label className="text-xs font-bold text-muted-foreground">
                  {section.isGeneralAdmission ? "Capacity" : "Number of Rows"}
                </Label>
                <Input
                  type="number"
                  min="1"
                  max="100"
                  value={section.isGeneralAdmission ? section.rowsCount * section.seatsPerRow : section.rowsCount}
                  onChange={(e) => {
                    const val = Math.max(1, parseInt(e.target.value) || 1);
                    if (section.isGeneralAdmission) {
                      updateSection(section.id, { rowsCount: 1, seatsPerRow: val });
                    } else {
                      updateSection(section.id, { rowsCount: val });
                    }
                  }}
                  className="mt-1"
                  disabled={isLocked}
                />
              </div>

              {!section.isGeneralAdmission && (
                <div>
                  <Label className="text-xs font-bold text-muted-foreground">Seats per Row</Label>
                  <Input
                    type="number"
                    min="1"
                    max="50"
                    value={section.seatsPerRow}
                    onChange={(e) => updateSection(section.id, { seatsPerRow: Math.max(1, parseInt(e.target.value) || 1) })}
                    className="mt-1"
                    disabled={isLocked}
                  />
                </div>
              )}

              {/* Price */}
              <div className="col-span-2">
                <Label className="text-xs font-bold text-muted-foreground">Section Price ($)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={section.price}
                  onChange={(e) => updateSection(section.id, { price: e.target.value })}
                  placeholder="0.00"
                  className="mt-1"
                />
                {(() => {
                  const gross = parseFloat(section.price) || 0;
                  if (gross <= 0) return null;
                  const serviceFee = gross * SERVICE_FEE_RATE + SERVICE_FEE_FLAT;
                  const displayed = gross + serviceFee;
                  return (
                    <div className="mt-2 space-y-0.5">
                      <p className="text-[10px] text-muted-foreground">
                        Gross Ticket Price: <span className="font-black text-foreground">${gross.toFixed(2)}</span>
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        Service Fee: <span className="font-bold text-foreground">${serviceFee.toFixed(2)}</span>
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        Displayed Ticket Price: <span className="font-black text-primary">${displayed.toFixed(2)}</span>
                      </p>
                    </div>
                  );
                })()}
              </div>
            </div>

            <div className="pt-2 border-t border-border">
              <p className="text-xs text-muted-foreground">
                Total capacity: <span className="font-black text-foreground">{section.rowsCount * section.seatsPerRow}</span> seats
              </p>
            </div>
          </div>
        );
      })()}

      {/* Add section button */}
      <Button
        variant="outline"
        onClick={addSection}
        className="w-full border-dashed h-14 text-sm font-bold"
      >
        <Plus className="w-4 h-4 mr-2" />
        Add Section
      </Button>
    </div>
  );
};

export default SeatingMapBuilder;
