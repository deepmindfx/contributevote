
import React from "react";
import { Button } from "@/components/ui/button";
import { DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Clipboard } from "lucide-react";
import { toast } from "sonner";
import { ReservedAccountData } from "@/services/walletIntegration";

interface AccountDetailsListProps {
  accounts: any[];
  onClose: () => void;
}

const AccountDetailsList = ({ accounts, onClose }: AccountDetailsListProps) => {
  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  };
  
  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>All Virtual Accounts</DialogTitle>
        <DialogDescription>
          Your reserved account is available across multiple banks
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-4 py-4 max-h-[400px] overflow-y-auto">
        {accounts?.map((account, index) => (
          <div key={index} className="border rounded-lg p-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium text-muted-foreground">Account Number</span>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => copyToClipboard(account.accountNumber, "Account number")}
                className="h-6 px-2"
              >
                <Clipboard size={14} />
              </Button>
            </div>
            <div className="font-mono text-lg">{account.accountNumber}</div>
            
            <div className="mt-2">
              <span className="text-sm font-medium text-muted-foreground">Bank</span>
              <div>{account.bankName}</div>
            </div>
          </div>
        ))}
      </div>
      <DialogFooter>
        <Button onClick={onClose}>Close</Button>
      </DialogFooter>
    </DialogContent>
  );
};

export default AccountDetailsList;
