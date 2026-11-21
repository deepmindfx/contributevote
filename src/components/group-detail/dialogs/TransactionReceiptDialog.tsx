import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CollectiPayReceipt } from "@/components/receipt/CollectiPayReceipt";

interface TransactionReceiptDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  receiptData: {
    receiptNumber: string;
    date: string;
    contributionName?: string;
    accountNumber?: string;
    payerName?: string;
    payerEmail?: string;
    amount: number;
    status?: string;
    reference?: string;
    paymentMethod?: string;
    description?: string;
    transactionId?: string;
  } | null;
}

const TransactionReceiptDialog = ({
  open,
  onOpenChange,
  receiptData,
}: TransactionReceiptDialogProps) => {
  if (!receiptData) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] max-w-md overflow-y-auto border-none bg-transparent p-2 shadow-none sm:p-4">
        <DialogHeader className="sr-only">
          <DialogTitle>Transaction Receipt</DialogTitle>
        </DialogHeader>
        <CollectiPayReceipt
          data={{
            kind: receiptData.contributionName ? "contribution" : "deposit",
            title: receiptData.contributionName ? "Group Contribution" : "Payment Receipt",
            amount: receiptData.amount,
            status: receiptData.status || "completed",
            date: receiptData.date,
            reference: receiptData.reference || receiptData.receiptNumber,
            transactionId: receiptData.transactionId,
            groupName: receiptData.contributionName,
            paymentMethod: receiptData.paymentMethod || "Bank Transfer",
            narration: receiptData.description,
            sender: {
              label: "From",
              name: receiptData.payerName || "Contributor",
              subtitle: receiptData.payerEmail,
            },
            recipient: receiptData.contributionName
              ? {
                  label: "To Pool",
                  name: receiptData.contributionName,
                  subtitle: receiptData.accountNumber,
                }
              : undefined,
          }}
          onDone={() => onOpenChange(false)}
          doneLabel="Close receipt"
        />
      </DialogContent>
    </Dialog>
  );
};

export default TransactionReceiptDialog;
