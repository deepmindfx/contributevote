
import React from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import TransactionReceipt from "@/components/shared/TransactionReceipt";

interface TransactionReceiptDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction: any;
}

const TransactionReceiptDialog = ({ 
  open, 
  onOpenChange, 
  transaction 
}: TransactionReceiptDialogProps) => {
  if (!transaction) return null;
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <TransactionReceipt 
          transaction={transaction} 
          onClose={() => onOpenChange(false)} 
        />
      </DialogContent>
    </Dialog>
  );
};

export default TransactionReceiptDialog;
