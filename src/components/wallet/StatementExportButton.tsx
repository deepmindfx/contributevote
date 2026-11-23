import { useState } from "react";
import { FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TransactionPinDialog } from "@/components/security/TransactionPinDialog";
import { useBankDirectory } from "@/hooks/useBankDirectory";
import { prepareStatementExport, type StatementScope } from "@/services/supabase/statementService";
import { cn } from "@/lib/utils";

const monthLabel = new Intl.DateTimeFormat("en-NG", { month: "long", year: "numeric", timeZone: "UTC" });

export function StatementExportButton({ month, scope, className }: { month: string; scope: StatementScope; className?: string }) {
  const [requestedMonth, setRequestedMonth] = useState<string | null>(null);
  const { data: banks, refetch: loadBanks } = useBankDirectory(scope === "bulk" && requestedMonth !== null);
  const exportStatement = async (pin: string) => {
    if (!requestedMonth) return;
    const [statement, { saveBankStatement }] = await Promise.all([
      prepareStatementExport(scope, requestedMonth, pin),
      import("@/utils/bankStatement"),
    ]);
    const directory = statement.scope === "bulk" && !banks ? (await loadBanks()).data : banks;
    await saveBankStatement(statement, directory);
    setRequestedMonth(null);
  };
  return (
    <>
      <Button type="button" size="lg" className={cn("h-11 gap-2 rounded-xl", className)} onClick={() => setRequestedMonth(month)}>
        <FileDown size={17} aria-hidden="true" /> Export bank statement
      </Button>
      <TransactionPinDialog open={requestedMonth !== null} onOpenChange={(open) => { if (!open) setRequestedMonth(null); }}
        title="Authorize statement export" confirmLabel="Download PDF" verifyInAction onVerified={exportStatement}
        description={requestedMonth ? `Enter your transaction PIN to download your ${scope === "bulk" ? "bulk transfer" : "wallet"} statement for ${monthLabel.format(new Date(requestedMonth + "-01T00:00:00Z"))}.` : undefined} />
    </>
  );
}
