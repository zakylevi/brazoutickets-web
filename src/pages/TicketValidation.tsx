import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle, XCircle, AlertTriangle, Loader2 } from "lucide-react";

type ValidationStatus = "loading" | "valid" | "already_used" | "invalid" | "error";

const TicketValidation = () => {
  const { token } = useParams<{ token: string }>();
  const [status, setStatus] = useState<ValidationStatus>("loading");
  const [details, setDetails] = useState<{ event_title?: string; ticket_name?: string; quantity?: number; message?: string }>({});

  useEffect(() => {
    if (!token) {
      setStatus("invalid");
      return;
    }

    const validate = async () => {
      try {
        const { data, error } = await supabase.rpc("validate_ticket_token", {
          _token: token,
        });

        if (error) {
          setStatus("error");
          setDetails({ message: error.message });
          return;
        }

        const result = data as any;
        setStatus(result.status as ValidationStatus);
        setDetails(result);
      } catch {
        setStatus("error");
        setDetails({ message: "Failed to validate ticket" });
      }
    };

    validate();
  }, [token]);

  const statusConfig = {
    loading: { icon: <Loader2 className="w-16 h-16 text-muted-foreground animate-spin" />, title: "Validating...", color: "text-muted-foreground" },
    valid: { icon: <CheckCircle className="w-16 h-16 text-green-500" />, title: "Ticket Valid ✓", color: "text-green-500" },
    already_used: { icon: <AlertTriangle className="w-16 h-16 text-yellow-500" />, title: "Already Scanned", color: "text-yellow-500" },
    invalid: { icon: <XCircle className="w-16 h-16 text-destructive" />, title: "Invalid Ticket", color: "text-destructive" },
    unauthorized: { icon: <XCircle className="w-16 h-16 text-destructive" />, title: "Unauthorized", color: "text-destructive" },
    error: { icon: <XCircle className="w-16 h-16 text-destructive" />, title: "Error", color: "text-destructive" },
  };

  const config = statusConfig[status] || statusConfig.error;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="text-center space-y-6 max-w-sm">
        <div className="flex justify-center">{config.icon}</div>
        <h1 className={`text-3xl font-black tracking-tight ${config.color}`}>{config.title}</h1>
        {details.event_title && (
          <div className="space-y-2 text-muted-foreground">
            <p className="text-lg font-bold">{details.event_title}</p>
            {details.ticket_name && <p className="text-sm">{details.ticket_name}</p>}
            {details.quantity && details.quantity > 1 && <p className="text-sm">Qty: {details.quantity}</p>}
          </div>
        )}
        {details.message && <p className="text-sm text-muted-foreground">{details.message}</p>}
      </div>
    </div>
  );
};

export default TicketValidation;
