
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";

interface AccountNumberDisplayProps {
  accountNumber: string;
  accountName: string;
}

const AccountNumberDisplay = ({ accountNumber, accountName }: AccountNumberDisplayProps) => {
  const [showCopiedAccountNumber, setShowCopiedAccountNumber] = useState(false);
  
  const copyAccountNumber = () => {
    if (!accountNumber) {
      toast.error("No account number available to copy");
      return;
    }
    
    navigator.clipboard.writeText(accountNumber).then(() => {
      setShowCopiedAccountNumber(true);
      toast.success("Account number copied to clipboard");
      setTimeout(() => setShowCopiedAccountNumber(false), 2000);
    }).catch(() => {
      toast.error("Failed to copy account number");
    });
  };
  
  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <span className="text-sm font-medium">Account Details</span>
        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={copyAccountNumber}>
          {showCopiedAccountNumber ? "Copied!" : "Copy"}
          {showCopiedAccountNumber ? <Check className="h-3 w-3 ml-1 text-green-600" /> : <Copy className="h-3 w-3 ml-1" />}
        </Button>
      </div>
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">Account No.</span>
        <span className="font-mono">{accountNumber || "Generating..."}</span>
      </div>
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">Account Name</span>
        <span>{accountName}</span>
      </div>
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">Bank</span>
        <span>CollectiPay Bank</span>
      </div>
    </div>
  );
};

export default AccountNumberDisplay;
