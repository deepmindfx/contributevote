
import React from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import TransactionReceipt from "@/components/shared/TransactionReceipt";
import html2canvas from "html2canvas";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { toast } from "sonner";

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
  
  const handleDownloadReceipt = async () => {
    try {
      const receiptElement = document.getElementById('transaction-receipt');
      
      if (!receiptElement) {
        toast.error("Receipt element not found");
        return;
      }
      
      toast.info("Preparing receipt for download...");
      
      const canvas = await html2canvas(receiptElement, {
        scale: 2, // Increase quality
        backgroundColor: null,
        logging: false
      });
      
      // Create a download link
      const link = document.createElement('a');
      link.download = `CollectiPay-Receipt-${data.id || 'transaction'}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      
      toast.success("Receipt downloaded successfully");
    } catch (error) {
      console.error("Error downloading receipt:", error);
      toast.error("Failed to download receipt. Please try again.");
    }
  };
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex justify-end mb-2">
          <Button 
            size="sm" 
            variant="outline" 
            className="flex items-center gap-1"
            onClick={handleDownloadReceipt}
          >
            <Download size={16} />
            Download
          </Button>
        </div>
        <div id="transaction-receipt">
          <TransactionReceipt 
            transaction={data} 
            onClose={() => onOpenChange(false)} 
          />
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default TransactionReceiptDialog;
