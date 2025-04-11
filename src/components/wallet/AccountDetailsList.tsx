
import React from "react";
import { DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Clipboard } from "lucide-react";
import { toast } from "sonner";

interface Account {
  bankCode: string;
  bankName: string;
  accountNumber: string;
}

interface AccountDetailsListProps {
  accounts: Account[];
  onClose: () => void;
}

const AccountDetailsList = ({ accounts, onClose }: AccountDetailsListProps) => {
  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  };

  return (
    <DialogContent className="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>All Bank Accounts</DialogTitle>
      </DialogHeader>
      
      <div className="space-y-6 py-2">
        {accounts.map((account, index) => (
          <div key={index} className="space-y-2 border-b pb-4 last:border-b-0">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-sm font-medium text-muted-foreground">Bank Name</label>
              </div>
              <div className="font-medium text-lg">
                {account.bankName}
              </div>
            </div>
            
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-sm font-medium text-muted-foreground">Account Number</label>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => copyToClipboard(account.accountNumber, "Account number")}
                  className="h-6 px-2"
                >
                  <Clipboard size={14} />
                </Button>
              </div>
              <div className="font-mono text-xl bg-muted/50 rounded-md py-2 px-3">
                {account.accountNumber}
              </div>
            </div>
          </div>
        ))}
      </div>
      
      <DialogFooter>
        <Button
          onClick={onClose}
          className="w-full"
        >
          Close
        </Button>
      </DialogFooter>
    </DialogContent>
  );
};

export default AccountDetailsList;
