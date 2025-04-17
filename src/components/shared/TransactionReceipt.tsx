
import React, { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import html2canvas from "html2canvas";

interface TransactionReceiptProps {
  transaction: {
    id: string;
    type: string;
    amount: number;
    description: string;
    createdAt: string;
    status: string;
    contributionName?: string;
    bankName?: string;
    accountNumber?: string;
    contributorName?: string;
    metaData?: any;
  };
  onClose?: () => void;
}

const TransactionReceipt = ({ transaction, onClose }: TransactionReceiptProps) => {
  const receiptRef = useRef<HTMLDivElement>(null);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-NG', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).format(date);
  };

  const getTransactionTypeText = (type: string) => {
    switch (type) {
      case 'deposit': return 'Payment';
      case 'withdrawal': return 'Withdrawal';
      case 'transfer': return 'Transfer';
      case 'vote': return 'Vote';
      default: return 'Transaction';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'text-green-600';
      case 'pending': return 'text-yellow-600';
      case 'failed': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const handleDownload = async () => {
    if (!receiptRef.current) return;
    
    try {
      const canvas = await html2canvas(receiptRef.current, {
        scale: 2,
        backgroundColor: '#ffffff',
        logging: false,
      });
      
      const image = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.href = image;
      link.download = `receipt-${transaction.id}.png`;
      link.click();
    } catch (error) {
      console.error('Error generating receipt image:', error);
    }
  };

  return (
    <div className="flex flex-col space-y-4">
      <div 
        ref={receiptRef} 
        className="bg-white rounded-lg p-6 border border-gray-200 max-w-md mx-auto"
      >
        {/* Receipt Header */}
        <div className="flex justify-center mb-4">
          <div className="flex items-center">
            <img 
              src="/lovable-uploads/e7056a4c-9b9c-4ca8-b393-4cfe5027fa67.png" 
              alt="CollectiPay Logo" 
              className="h-12 w-12 object-contain"
            />
            <div className="ml-2">
              <h2 className="text-2xl font-bold text-[#2DAE75]">CollectiPay</h2>
              <p className="text-xs text-gray-500">Transaction Receipt</p>
            </div>
          </div>
        </div>
        
        {/* Divider */}
        <div className="border-b-2 border-dashed border-gray-200 my-4"></div>
        
        {/* Receipt Body */}
        <div className="space-y-4">
          <div className="flex justify-between">
            <span className="text-gray-500">Transaction ID:</span>
            <span className="font-mono text-xs">{transaction.id.substring(0, 8)}...</span>
          </div>
          
          <div className="flex justify-between">
            <span className="text-gray-500">Date & Time:</span>
            <span>{formatDate(transaction.createdAt)}</span>
          </div>
          
          <div className="flex justify-between">
            <span className="text-gray-500">Type:</span>
            <span>{getTransactionTypeText(transaction.type)}</span>
          </div>
          
          <div className="flex justify-between">
            <span className="text-gray-500">Status:</span>
            <span className={getStatusColor(transaction.status)}>
              {transaction.status.charAt(0).toUpperCase() + transaction.status.slice(1)}
            </span>
          </div>
          
          <div className="flex justify-between">
            <span className="text-gray-500">Amount:</span>
            <span className="font-bold text-xl text-[#2DAE75]">
              ₦{transaction.amount.toLocaleString()}
            </span>
          </div>
          
          {transaction.description && (
            <div className="flex justify-between">
              <span className="text-gray-500">Description:</span>
              <span className="text-right max-w-[200px]">{transaction.description}</span>
            </div>
          )}
          
          {transaction.contributionName && (
            <div className="flex justify-between">
              <span className="text-gray-500">Group:</span>
              <span>{transaction.contributionName}</span>
            </div>
          )}
          
          {transaction.metaData?.bankName && (
            <div className="flex justify-between">
              <span className="text-gray-500">Bank:</span>
              <span>{transaction.metaData.bankName}</span>
            </div>
          )}
          
          {transaction.metaData?.accountNumber && (
            <div className="flex justify-between">
              <span className="text-gray-500">Account:</span>
              <span className="font-mono">{transaction.metaData.accountNumber}</span>
            </div>
          )}
          
          {transaction.contributorName && (
            <div className="flex justify-between">
              <span className="text-gray-500">From:</span>
              <span>{transaction.contributorName}</span>
            </div>
          )}
        </div>
        
        {/* Divider */}
        <div className="border-b-2 border-dashed border-gray-200 my-4"></div>
        
        {/* Receipt Footer */}
        <div className="text-center text-xs text-gray-500 mt-4">
          <p>Thank you for using CollectiPay</p>
          <p className="mt-1">For support contact: support@collectipay.com</p>
        </div>
      </div>
      
      <Button 
        onClick={handleDownload}
        className="bg-[#2DAE75] hover:bg-[#259a69] mx-auto"
      >
        <Download className="mr-2 h-4 w-4" />
        Download Receipt
      </Button>
      
      {onClose && (
        <Button 
          variant="outline" 
          onClick={onClose}
          className="mx-auto"
        >
          Close
        </Button>
      )}
    </div>
  );
};

export default TransactionReceipt;
