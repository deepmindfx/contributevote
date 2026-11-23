import { BarChart3, FileDown } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

export function WalletReportLinks({ scope }: { scope: "wallet" | "bulk" }) {
  const base = scope === "bulk" ? "/transfer/bulk/history" : "/activity";
  return (
    <nav aria-label={scope === "bulk" ? "Bulk transfer reports" : "Wallet reports"} className="grid grid-cols-2 gap-2">
      <Button asChild variant="outline" className="h-auto min-h-12 justify-start gap-2 rounded-xl bg-card px-3 text-left">
        <Link to={`${base}?view=analytics`}><BarChart3 size={18} className="shrink-0 text-primary" aria-hidden="true" /> Analytics</Link>
      </Button>
      <Button asChild variant="outline" className="h-auto min-h-12 justify-start gap-2 whitespace-normal rounded-xl bg-card px-3 text-left">
        <Link to={`${base}?view=statement`}><FileDown size={18} className="shrink-0 text-primary" aria-hidden="true" /> Bank statement</Link>
      </Button>
    </nav>
  );
}
