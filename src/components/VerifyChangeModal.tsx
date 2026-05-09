import { useState, useEffect, useRef } from "react";
import { X, ShieldCheck } from "lucide-react";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { toast } from "sonner";

interface VerifyChangeModalProps {
  open: boolean;
  onClose: () => void;
  onVerified: () => void;
  field: "email" | "phone";
  newValue: string;
}

const MOCK_CODE = "123456";

const VerifyChangeModal = ({ open, onClose, onVerified, field, newValue }: VerifyChangeModalProps) => {
  const [otp, setOtp] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (open) {
      setOtp("");
      setResendCooldown(30);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [open]);

  useEffect(() => {
    if (resendCooldown > 0) {
      timerRef.current = setInterval(() => {
        setResendCooldown((c) => {
          if (c <= 1) {
            if (timerRef.current) clearInterval(timerRef.current);
            return 0;
          }
          return c - 1;
        });
      }, 1000);
      return () => {
        if (timerRef.current) clearInterval(timerRef.current);
      };
    }
  }, [resendCooldown]);

  if (!open) return null;

  const handleVerify = () => {
    if (otp === MOCK_CODE) {
      toast.success(`${field === "email" ? "Email" : "Phone number"} updated successfully`);
      onVerified();
    } else {
      toast.error("Invalid verification code. Try 123456");
      setOtp("");
    }
  };

  const handleResend = () => {
    if (resendCooldown > 0) return;
    toast.info(`Verification code resent to ${newValue}`);
    setResendCooldown(30);
  };

  const maskedValue = field === "email"
    ? newValue.replace(/(.{2})(.*)(@.*)/, "$1***$3")
    : newValue.slice(0, -4).replace(/\d/g, "•") + newValue.slice(-4);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-surface border border-border rounded-4xl w-full max-w-md p-8 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        <button
          onClick={onClose}
          className="absolute top-6 right-6 w-10 h-10 rounded-full bg-secondary flex items-center justify-center text-muted-foreground hover:text-on-background transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="text-center">
          <div className="w-16 h-16 rounded-2xl bg-brand-pink/10 flex items-center justify-center mx-auto mb-6">
            <ShieldCheck className="w-8 h-8 text-brand-pink" />
          </div>

          <h2 className="text-2xl font-black tracking-tight text-on-background mb-2">
            Verify your {field === "email" ? "new email" : "new phone"}
          </h2>
          <p className="text-muted-foreground font-medium mb-1 text-sm">
            We sent a 6-digit code to
          </p>
          <p className="text-on-background font-bold mb-8 text-sm">
            {maskedValue}
          </p>

          <div className="flex justify-center mb-8">
            <InputOTP maxLength={6} value={otp} onChange={setOtp}>
              <InputOTPGroup className="gap-2">
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <InputOTPSlot
                    key={i}
                    index={i}
                    className="w-12 h-14 text-xl font-black rounded-xl border-border bg-secondary text-on-background"
                  />
                ))}
              </InputOTPGroup>
            </InputOTP>
          </div>

          <button
            onClick={handleVerify}
            disabled={otp.length < 6}
            className="w-full bg-brand-pink text-primary-foreground py-4 rounded-full font-black tracking-tight hover:scale-[1.02] transition-all shadow-xl text-base disabled:opacity-50 disabled:hover:scale-100"
          >
            Verify & Update
          </button>

          <p className="text-sm text-muted-foreground font-medium mt-6">
            Didn't receive a code?{" "}
            {resendCooldown > 0 ? (
              <span className="text-muted-foreground/60">Resend in {resendCooldown}s</span>
            ) : (
              <button onClick={handleResend} className="text-brand-pink font-bold hover:underline">
                Resend
              </button>
            )}
          </p>

          <p className="text-xs text-muted-foreground/60 mt-4">
            Demo: use code <span className="font-mono font-bold text-muted-foreground">123456</span>
          </p>
        </div>
      </div>
    </div>
  );
};

export default VerifyChangeModal;
