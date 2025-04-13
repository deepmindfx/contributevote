
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";

interface AccountNumberDisplayProps {
  accountNumber: string;
  accountName: string;
  bankName?: string; // Make bankName optional
  monnifyDetails?: any; // Add support for Monnify details
}

const AccountNumberDisplay = ({ 
  accountNumber, 
  accountName, 
  bankName = "CollectiPay Bank", // Default bank name
  monnifyDetails 
}: AccountNumberDisplayProps) => {
  const [showCopiedAccountNumber, setShowCopiedAccountNumber] = useState(false);
  
  // Determine if we should use Monnify account details
  const useMonnifyDetails = monnifyDetails && 
    monnifyDetails.accounts && 
    monnifyDetails.accounts.length > 0;
  
  // Get account details from Monnify or use provided values
  const displayAccountNumber = useMonnifyDetails 
    ? monnifyDetails.accounts[0].accountNumber 
    : accountNumber;
    
  const displayAccountName = useMonnifyDetails
    ? monnifyDetails.accounts[0].accountName || monnifyDetails.accountName
    : accountName;
    
  const displayBankName = useMonnifyDetails
    ? monnifyDetails.accounts[0].bankName
    : bankName;
  
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
        <span className="font-mono">{displayAccountNumber || "Generating..."}</span>
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
