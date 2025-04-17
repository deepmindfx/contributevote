
import React from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Receipt } from "lucide-react";
import { format, isValid } from "date-fns";

interface TransactionReceiptDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  receiptData: {
    receiptNumber: string;
    date: string;
    contributionName: string;
    accountNumber: string;
    contributorName: string;
    amount: number;
  } | null;
}

const TransactionReceiptDialog = ({
  open,
  onOpenChange,
  receiptData
}: TransactionReceiptDialogProps) => {
  const formatDate = (dateString?: string) => {
    if (!dateString) return "Unknown date";
    
    try {
      const date = new Date(dateString);
      if (!isValid(date)) {
        return "Invalid date";
      }
      return format(date, 'MMMM d, yyyy');
    } catch (error) {
      console.error("Error formatting date:", error, dateString);
      return "Invalid date";
    }
  };

  if (!receiptData) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center">Transaction Receipt</DialogTitle>
        </DialogHeader>
        <div className="p-6 bg-muted/30 rounded-lg space-y-4">
          <div className="flex justify-center mb-4">
            <div className="h-16 w-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <Receipt className="h-8 w-8 text-green-600 dark:text-green-400" />
            </div>
          </div>
          
          <div className="text-center mb-4">
            <h3 className="text-xl font-bold">CollectiPay</h3>
            <p className="text-sm text-muted-foreground">Official Contribution Receipt</p>
          </div>
          
          <div className="space-y-3 pt-2 border-t">
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Receipt No:</span>
              <span className="font-mono">{receiptData.receiptNumber}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Date:</span>
              <span>{formatDate(receiptData.date)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Group:</span>
              <span>{receiptData.contributionName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Account No:</span>
              <span className="font-mono">{receiptData.accountNumber}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Contributor:</span>
              <span>{receiptData.contributorName}</span>
            </div>
            <div className="flex justify-between font-bold pt-2 border-t">
              <span>Amount:</span>
              <span className="text-green-600">₦{receiptData.amount.toLocaleString()}</span>
            </div>
          </div>
          
          <div className="text-center text-xs text-muted-foreground mt-6 pt-2 border-t">
            <p>Thank you for your contribution!</p>
            <p>For any inquiries, please contact support@collectipay.com</p>
          </div>
        </div>
        <DialogFooter className="flex justify-center">
          <Button variant="outline">
            Download Receipt
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default TransactionReceiptDialog;
