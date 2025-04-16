
import React from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import TransactionReceipt from "@/components/shared/TransactionReceipt";

interface TransactionReceiptDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction?: any;
  receiptData?: any;
}

const TransactionReceiptDialog = ({ 
  open, 
  onOpenChange, 
  transaction,
  receiptData
}: TransactionReceiptDialogProps) => {
  // Use receiptData if provided, otherwise use transaction
  const data = receiptData || transaction;
  
  if (!data) return null;
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <TransactionReceipt 
          transaction={data} 
          onClose={() => onOpenChange(false)} 
        />
      </DialogContent>
    </Dialog>
  );
};

export default TransactionReceiptDialog;
