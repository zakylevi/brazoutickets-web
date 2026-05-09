import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Save, DollarSign, ShieldCheck, FileText } from "lucide-react";
import { toast } from "sonner";

const AdminSettingsTab = () => {
  // Monetization
  const [platformFeePercent, setPlatformFeePercent] = useState("10");
  const [fixedFeeAmount, setFixedFeeAmount] = useState("0.99");

  // Content / Trust
  const [autoFlagThreshold, setAutoFlagThreshold] = useState("5");
  const [reportHandlingRules, setReportHandlingRules] = useState(
    "Events with 5+ reports are automatically flagged for review.\nDuplicate reports from the same user are ignored.\nReports are reviewed within 48 hours."
  );
  const [suspensionRules, setSuspensionRules] = useState(
    "3 confirmed violations within 90 days → temporary suspension (30 days).\n5 confirmed violations → permanent suspension.\nOrganizers may appeal within 14 days of suspension."
  );

  // Privacy Policy
  const [privacyPolicy, setPrivacyPolicy] = useState(
    `PRIVACY POLICY

Last updated: April 9, 2026

1. INFORMATION WE COLLECT
We collect personal information you provide when creating an account, purchasing tickets, or organizing events. This includes your name, email address, phone number, billing information, and location data.

2. HOW WE USE YOUR INFORMATION
We use your information to process transactions, provide customer support, send event notifications, improve our platform, and comply with legal obligations.

3. INFORMATION SHARING
We share your information with event organizers for events you attend, payment processors (Stripe), and as required by law. We do not sell your personal data to third parties.

4. DATA RETENTION
We retain your data for as long as your account is active. You may request deletion of your account and associated data at any time.

5. COOKIES AND TRACKING
We use essential cookies for authentication and analytics cookies to improve the platform experience. You can manage cookie preferences through your browser settings.

6. YOUR RIGHTS
You have the right to access, correct, delete, or export your personal data. Contact support@brazou.com for any data-related requests.

7. SECURITY
We implement industry-standard security measures including encryption, secure authentication, and regular security audits.

8. CHANGES TO THIS POLICY
We may update this policy periodically. Users will be notified of material changes via email.

9. CONTACT
For questions about this policy, contact: privacy@brazou.com`
  );

  const handleSaveMonetization = () => {
    const pct = parseFloat(platformFeePercent);
    const fixed = parseFloat(fixedFeeAmount);
    if (isNaN(pct) || pct < 0 || pct > 100) {
      toast.error("Platform fee must be between 0% and 100%");
      return;
    }
    if (isNaN(fixed) || fixed < 0) {
      toast.error("Fixed fee must be a positive amount");
      return;
    }
    toast.success("Monetization settings saved");
  };

  const handleSaveContentRules = () => {
    toast.success("Content & trust rules saved");
  };

  const handleSavePrivacyPolicy = () => {
    toast.success("Privacy policy saved");
  };

  return (
    <div className="space-y-10">
      <h2 className="text-2xl font-black uppercase tracking-tight text-on-background">Settings</h2>

      {/* ── MONETIZATION ── */}
      <section className="rounded-2xl bg-surface border border-border p-6 space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-pink/10 flex items-center justify-center">
            <DollarSign className="w-5 h-5 text-brand-pink" />
          </div>
          <div>
            <h3 className="text-lg font-black uppercase tracking-tight text-on-background">Monetization</h3>
            <p className="text-xs text-muted-foreground">Control platform fees applied to every ticket sale</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
              Platform Fee (%)
            </Label>
            <Input
              type="number"
              min="0"
              max="100"
              step="0.1"
              value={platformFeePercent}
              onChange={(e) => setPlatformFeePercent(e.target.value)}
              className="font-mono text-lg"
            />
            <p className="text-[11px] text-muted-foreground">
              Percentage charged on top of every ticket subtotal (after discounts)
            </p>
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
              Fixed Fee Amount ($)
            </Label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={fixedFeeAmount}
              onChange={(e) => setFixedFeeAmount(e.target.value)}
              className="font-mono text-lg"
            />
            <p className="text-[11px] text-muted-foreground">
              Fixed dollar amount added per ticket quantity on top of the percentage fee
            </p>
          </div>
        </div>

        <div className="rounded-xl bg-muted/50 border border-border p-4">
          <p className="text-xs font-bold text-muted-foreground mb-1">PREVIEW</p>
          <p className="text-sm text-on-background">
            A $50.00 ticket (qty 2) → Service Fee ={" "}
            <span className="font-black text-brand-pink">
              ${(
                (50 * 2 * (parseFloat(platformFeePercent) || 0)) / 100 +
                (parseFloat(fixedFeeAmount) || 0) * 2
              ).toFixed(2)}
            </span>
          </p>
        </div>

        <div className="flex justify-end">
          <Button onClick={handleSaveMonetization} className="gap-2 bg-brand-pink hover:bg-brand-pink/90 text-primary-foreground font-bold">
            <Save className="w-4 h-4" />
            Save Monetization
          </Button>
        </div>
      </section>

      {/* ── CONTENT / TRUST ── */}
      <section className="rounded-2xl bg-surface border border-border p-6 space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-pink/10 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5 text-brand-pink" />
          </div>
          <div>
            <h3 className="text-lg font-black uppercase tracking-tight text-on-background">Content & Trust</h3>
            <p className="text-xs text-muted-foreground">Configure auto-flag thresholds, report handling, and organizer suspension rules</p>
          </div>
        </div>

        <div className="space-y-5">
          <div className="space-y-2">
            <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
              Auto-Flag Threshold (reports)
            </Label>
            <Input
              type="number"
              min="1"
              max="100"
              value={autoFlagThreshold}
              onChange={(e) => setAutoFlagThreshold(e.target.value)}
              className="font-mono max-w-xs"
            />
            <p className="text-[11px] text-muted-foreground">
              Number of reports required before an event/organizer is automatically flagged for review
            </p>
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
              Report Handling Rules
            </Label>
            <Textarea
              value={reportHandlingRules}
              onChange={(e) => setReportHandlingRules(e.target.value)}
              rows={4}
              className="text-sm"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
              Organizer Suspension Rules
            </Label>
            <Textarea
              value={suspensionRules}
              onChange={(e) => setSuspensionRules(e.target.value)}
              rows={4}
              className="text-sm"
            />
          </div>
        </div>

        <div className="flex justify-end">
          <Button onClick={handleSaveContentRules} className="gap-2 bg-brand-pink hover:bg-brand-pink/90 text-primary-foreground font-bold">
            <Save className="w-4 h-4" />
            Save Content Rules
          </Button>
        </div>
      </section>

      {/* ── PRIVACY POLICY ── */}
      <section className="rounded-2xl bg-surface border border-border p-6 space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-pink/10 flex items-center justify-center">
            <FileText className="w-5 h-5 text-brand-pink" />
          </div>
          <div>
            <h3 className="text-lg font-black uppercase tracking-tight text-on-background">Privacy Policy</h3>
            <p className="text-xs text-muted-foreground">Edit and manage the platform's privacy policy</p>
          </div>
        </div>

        <div className="space-y-2">
          <Textarea
            value={privacyPolicy}
            onChange={(e) => setPrivacyPolicy(e.target.value)}
            rows={20}
            className="text-sm font-mono leading-relaxed"
          />
        </div>

        <div className="flex justify-end">
          <Button onClick={handleSavePrivacyPolicy} className="gap-2 bg-brand-pink hover:bg-brand-pink/90 text-primary-foreground font-bold">
            <Save className="w-4 h-4" />
            Save Privacy Policy
          </Button>
        </div>
      </section>
    </div>
  );
};

export default AdminSettingsTab;
