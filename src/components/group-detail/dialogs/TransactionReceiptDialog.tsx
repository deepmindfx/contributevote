
import React, { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Check, Download } from "lucide-react";
import { format, isValid } from "date-fns";
import html2canvas from "html2canvas";
import { toast } from "sonner";

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
  receiptData
}: TransactionReceiptDialogProps) => {
  const receiptRef = useRef<HTMLDivElement>(null);
  
  const formatDate = (dateString?: string) => {
    if (!dateString) return "Unknown date";
    
    try {
      const date = new Date(dateString);
      if (!isValid(date)) {
        return "Invalid date";
      }
      return format(date, 'dd MMM yyyy, HH:mm');
    } catch (error) {
      console.error("Error formatting date:", error, dateString);
      return "Invalid date";
    }
  };

  const downloadReceipt = async () => {
    if (!receiptRef.current) return;
    
    try {
      toast.loading("Generating receipt...");
      const canvas = await html2canvas(receiptRef.current, {
        scale: 2,
        backgroundColor: receiptData?.status === 'completed' || receiptData?.status === 'successful' ? '#1A1A1A' : '#FFFFFF',
        logging: false
      });
      
      const imgData = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.href = imgData;
      link.download = `receipt-${receiptData?.receiptNumber || 'payment'}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.dismiss();
      toast.success("Receipt downloaded successfully");
    } catch (error) {
      console.error("Error downloading receipt:", error);
      toast.dismiss();
      toast.error("Failed to download receipt");
    }
  };

  if (!receiptData) return null;

  const isSuccessful = receiptData.status === 'completed' || receiptData.status === 'successful';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-0 overflow-hidden">
        <DialogHeader className="p-6 text-center">
          <DialogTitle>Transaction Receipt</DialogTitle>
        </DialogHeader>
        
        <div ref={receiptRef} className={`space-y-5 ${isSuccessful ? 'bg-gray-900 text-white' : 'bg-white'} p-6`}>
          {/* Success Icon */}
          <div className="flex justify-center">
            <div className={`h-16 w-16 rounded-full ${isSuccessful ? 'bg-green-500/20' : 'bg-green-100'} flex items-center justify-center`}>
              <Check className={`h-8 w-8 ${isSuccessful ? 'text-green-400' : 'text-green-600'}`} />
            </div>
          </div>
          
          {/* Payment Success */}
          <div className="text-center space-y-1">
            <h3 className="text-xl font-bold">Payment Success!</h3>
            {isSuccessful && (
              <p className="text-gray-400 text-sm">Your payment has been successfully done.</p>
            )}
          </div>
          
          {/* Divider */}
          <div className={`h-px ${isSuccessful ? 'bg-gray-700' : 'bg-gray-200'} w-full my-4`}></div>
          
          {/* Total Payment */}
          <div className="text-center">
            <p className={`text-sm ${isSuccessful ? 'text-gray-400' : 'text-gray-500'}`}>Total Payment</p>
            <h2 className="text-2xl font-bold mt-1">₦{receiptData.amount.toLocaleString()}</h2>
          </div>
          
          {/* Details Grid */}
          <div className="grid grid-cols-2 gap-3">
            {/* Ref Number */}
            <div className={`p-4 rounded-lg ${isSuccessful ? 'bg-gray-800' : 'bg-gray-100'}`}>
              <p className={`text-xs ${isSuccessful ? 'text-gray-400' : 'text-gray-500'}`}>Ref Number</p>
              <p className="text-sm font-mono mt-1">{receiptData.receiptNumber}</p>
            </div>
            
            {/* Payment Time */}
            <div className={`p-4 rounded-lg ${isSuccessful ? 'bg-gray-800' : 'bg-gray-100'}`}>
              <p className={`text-xs ${isSuccessful ? 'text-gray-400' : 'text-gray-500'}`}>Payment Time</p>
              <p className="text-sm mt-1">{formatDate(receiptData.date)}</p>
            </div>
            
            {/* Payment Method */}
            <div className={`p-4 rounded-lg ${isSuccessful ? 'bg-gray-800' : 'bg-gray-100'}`}>
              <p className={`text-xs ${isSuccessful ? 'text-gray-400' : 'text-gray-500'}`}>Payment Method</p>
              <p className="text-sm mt-1">{receiptData.paymentMethod || "Bank Transfer"}</p>
            </div>
            
            {/* Sender Name */}
            <div className={`p-4 rounded-lg ${isSuccessful ? 'bg-gray-800' : 'bg-gray-100'}`}>
              <p className={`text-xs ${isSuccessful ? 'text-gray-400' : 'text-gray-500'}`}>Sender Name</p>
              <p className="text-sm mt-1">{receiptData.payerName || "Anonymous"}</p>
            </div>
          </div>
          
          {/* Contribution details if applicable */}
          {receiptData.contributionName && (
            <div className={`p-4 rounded-lg ${isSuccessful ? 'bg-gray-800' : 'bg-gray-100'} w-full`}>
              <p className={`text-xs ${isSuccessful ? 'text-gray-400' : 'text-gray-500'}`}>Contribution</p>
              <p className="text-sm mt-1">{receiptData.contributionName}</p>
            </div>
          )}
          
          {/* CollectiPay Logo at bottom */}
          <div className="flex justify-center pt-2">
            <img 
              src="/lovable-uploads/e7056a4c-9b9c-4ca8-b393-4cfe5027fa67.png" 
              alt="CollectiPay Logo" 
              className="h-6 object-contain opacity-50 mt-4"
            />
          </div>
        </div>
        
        <DialogFooter className="p-4 flex justify-center border-t">
          <Button 
            variant="outline" 
            className="flex items-center gap-2" 
            onClick={downloadReceipt}
          >
            <Download className="h-4 w-4" />
            Download Receipt
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default TransactionReceiptDialog;
