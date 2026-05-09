import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Mail, Lock, User, Eye, EyeOff } from "lucide-react";
import PhoneInput from "@/components/PhoneInput";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

const Auth = () => {
  const navigate = useNavigate();
  const { login, signup } = useAuth();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "", confirmPassword: "" });
  const [passwordError, setPasswordError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const update = (field: string, value: string) => setForm((prev) => ({ ...prev, [field]: value }));

  const inputClass = "w-full bg-secondary border border-border rounded-xl py-3.5 pl-11 pr-4 text-on-background placeholder:text-muted-foreground font-medium focus:outline-none focus:ring-2 focus:ring-brand-pink focus:border-transparent transition-all";
  const inputClassPr11 = "w-full bg-secondary border border-border rounded-xl py-3.5 pl-11 pr-11 text-on-background placeholder:text-muted-foreground font-medium focus:outline-none focus:ring-2 focus:ring-brand-pink focus:border-transparent transition-all";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      if (mode === "login") {
        const { error } = await login(form.email, form.password);
        if (error) {
          toast.error(error);
        } else {
          toast.success("Welcome back!");
          navigate("/");
        }
      } else {
        if (form.password !== form.confirmPassword) {
          setPasswordError("Passwords do not match");
          return;
        }

        setPasswordError("");
        const { error } = await signup(form.email, form.password, form.name, form.phone);
        if (error) {
          toast.error(error);
        } else {
          toast.success("Account created! Check your email to verify.");
          navigate("/");
        }
      }
    } catch {
      toast.error("Login request failed. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="pb-32 flex items-center justify-center min-h-screen">
        <div className="w-full max-w-md mx-auto px-4">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-muted-foreground hover:text-brand-pink transition-colors text-sm font-bold mb-10"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </Link>

          <div className="rounded-4xl border border-border bg-surface p-8 md:p-10 shadow-xl mt-8">
            <h1 className="text-3xl font-black tracking-tight text-on-background mb-2">
              {mode === "login" ? "Welcome back" : "Create account"}
            </h1>
            <p className="text-muted-foreground font-medium mb-8">
              {mode === "login"
                ? "Sign in to access your tickets and events."
                : "Join to discover and book amazing events."}
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === "signup" && (
                <>
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                      type="text"
                      placeholder="Full name"
                      value={form.name}
                      onChange={(e) => update("name", e.target.value)}
                      className={inputClass}
                      required
                    />
                  </div>
                  <PhoneInput
                    value={form.phone}
                    onChange={(val) => update("phone", val)}
                  />
                </>
              )}

              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="email"
                  placeholder="Email address"
                  value={form.email}
                  onChange={(e) => update("email", e.target.value)}
                  className={inputClass}
                  required
                />
              </div>

              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Password"
                  value={form.password}
                  onChange={(e) => update("password", e.target.value)}
                  className={inputClassPr11}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-on-background transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {mode === "signup" && (
                <div>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                      type={showConfirmPassword ? "text" : "password"}
                      placeholder="Confirm password"
                      value={form.confirmPassword}
                      onChange={(e) => {
                        update("confirmPassword", e.target.value);
                        if (passwordError) setPasswordError("");
                      }}
                      className={inputClassPr11}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-on-background transition-colors"
                    >
                      {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {passwordError && (
                    <p className="text-sm text-red-500 font-medium mt-1.5 ml-1">{passwordError}</p>
                  )}
                </div>
              )}

              {mode === "login" && (
                <div className="text-right">
                  <button type="button" className="text-sm text-brand-pink font-bold hover:underline">
                    Forgot password?
                  </button>
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-brand-pink text-primary-foreground py-4 rounded-full font-black tracking-tight hover:scale-[1.02] transition-all shadow-xl text-base disabled:opacity-50 disabled:hover:scale-100"
              >
                {isSubmitting ? "Please wait..." : mode === "login" ? "Sign In" : "Create Account"}
              </button>
            </form>

            {/* Divider */}
            <div className="flex items-center gap-4 my-8">
              <div className="flex-1 h-px bg-border" />
              <span className="text-xs text-muted-foreground font-bold uppercase tracking-widest">or</span>
              <div className="flex-1 h-px bg-border" />
            </div>

            {/* Social buttons */}
            <div className="space-y-3">
              <button className="w-full flex items-center justify-center gap-3 border border-border rounded-xl py-3.5 font-bold text-on-background hover:bg-secondary transition-all">
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                Continue with Google
              </button>
              <button className="w-full flex items-center justify-center gap-3 border border-border rounded-xl py-3.5 font-bold text-on-background hover:bg-secondary transition-all">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
                </svg>
                Continue with Apple
              </button>
            </div>

            {/* Toggle mode */}
            <p className="text-center text-sm text-muted-foreground font-medium mt-8">
              {mode === "login" ? "Don't have an account?" : "Already have an account?"}{" "}
              <button
                onClick={() => {
                  setMode(mode === "login" ? "signup" : "login");
                  setPasswordError("");
                }}
                className="text-brand-pink font-bold hover:underline"
              >
                {mode === "login" ? "Sign up" : "Sign in"}
              </button>
            </p>
          </div>
        </div>
    </main>
  );
};

export default Auth;
