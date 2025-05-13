import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";

interface AccountNumberDisplayProps {
  accountNumber: string;
  accountName: string;
  bankName?: string;
  accountDetails?: any; // Flutterwave account details
}

const AccountNumberDisplay = ({ 
  accountNumber, 
  accountName, 
  bankName,
  accountDetails 
}: AccountNumberDisplayProps) => {
  const [showCopiedAccountNumber, setShowCopiedAccountNumber] = useState(false);
  
  // Get account details from Flutterwave response
  const displayAccountNumber = accountDetails?.account_number || accountNumber;
  const displayAccountName = accountDetails?.account_name || accountName;
  const displayBankName = accountDetails?.bank_name || bankName;
  
  const copyAccountNumber = () => {
    if (!displayAccountNumber) {
      toast.error("No account number available to copy");
      return;
    }
    
    navigator.clipboard.writeText(displayAccountNumber).then(() => {
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
        <span className="font-mono">{displayAccountNumber}</span>
      </div>
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">Account Name</span>
        <span>{displayAccountName}</span>
      </div>
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">Bank</span>
        <span>{displayBankName}</span>
      </div>
    </div>
  );
};

export default AccountNumberDisplay;
