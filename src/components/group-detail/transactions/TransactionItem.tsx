
import React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowDown, ArrowUp, HelpCircle, Receipt, CreditCard, Banknote } from "lucide-react";
import { Transaction } from "@/services/localStorage";
import { format, isValid } from "date-fns";

interface TransactionItemProps {
  transaction: Transaction;
  onViewReceipt: (transactionId: string) => void;
}

const TransactionItem = ({ transaction, onViewReceipt }: TransactionItemProps) => {
  const formatDate = (dateString?: string) => {
    if (!dateString) return "Unknown date";
    
    try {
      const date = new Date(dateString);
      if (!isValid(date)) {
        return "Invalid date";
      }
      return format(date, 'MMMM d, yyyy h:mm a');
    } catch (error) {
      console.error("Error formatting date:", error, dateString);
      return "Invalid date";
    }
  };

  const getContributorName = (transaction: Transaction) => {
    // For direct contributions
    if (transaction.metaData?.contributorName) {
      return transaction.metaData.contributorName;
    }
    
    // For Monnify transactions
    if (transaction.metaData?.senderName) {
      return transaction.metaData.senderName;
    }
    
    // For other transactions
    if (transaction.metaData?.customerName) {
      return transaction.metaData.customerName;
    }
    
    // Anonymous contributions
    if (transaction.anonymous) {
      return "Anonymous";
    }
    
    return "Unknown User";
  };

  const getPaymentIcon = () => {
    if (transaction.type === 'deposit') {
      if (transaction.paymentMethod === 'CARD') {
        return <CreditCard size={18} />;
      } else if (
        transaction.paymentMethod === 'ACCOUNT_TRANSFER' || 
        transaction.paymentMethod === 'USSD' || 
        transaction.paymentMethod === 'PHONE_NUMBER'
      ) {
        return <Banknote size={18} />;
      }
      return <ArrowDown size={18} />;
    } else if (transaction.type === 'withdrawal') {
      return <ArrowUp size={18} />;
    }
    return <HelpCircle size={18} />;
  };

  const getPaymentMethod = () => {
    if (!transaction.paymentMethod) return "";
    
    switch (transaction.paymentMethod) {
      case 'CARD':
        return ' via Card';
      case 'ACCOUNT_TRANSFER':
        return ' via Bank Transfer';
      case 'USSD':
        return ' via USSD';
      case 'PHONE_NUMBER':
        return ' via Phone';
      default:
        return ` via ${transaction.paymentMethod}`;
    }
  };

  const getTransactionTitle = () => {
    if (transaction.type === 'deposit') {
      // For personal wallet deposits (no contributionId)
      if (!transaction.contributionId) {
        return 'Wallet Top-up' + getPaymentMethod();
      }
      // For contribution deposits
      return 'Contribution' + getPaymentMethod();
    } else if (transaction.type === 'withdrawal') {
      return 'Fund Withdrawal';
    } else if (transaction.type === 'vote') {
      return 'Vote';
    }
    return 'Transaction';
  };

  return (
    <div className="flex items-start py-3 border-b last:border-b-0">
      <div className={`w-10 h-10 rounded-full flex items-center justify-center
        ${transaction.type === 'deposit' 
          ? 'bg-green-100 dark:bg-green-900/20 text-green-600 dark:text-green-400' 
          : transaction.type === 'withdrawal' 
            ? 'bg-amber-100 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400' 
            : 'bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'}`}>
        {getPaymentIcon()}
      </div>
      <div className="ml-3 flex-1">
        <div className="flex justify-between">
          <div>
            <h4 className="font-medium text-sm">
              {getTransactionTitle()}
            </h4>
            <p className="text-xs text-muted-foreground">
              {transaction.description || "Transaction"}
            </p>
            {transaction.type === 'deposit' && (
              <p className="text-xs font-medium mt-1 text-green-600">
                From: {getContributorName(transaction)}
                {transaction.metaData?.bankName && ` (${transaction.metaData.bankName})`}
              </p>
            )}
          </div>
          <div className="text-right">
            <div className={`font-medium ${transaction.type === 'deposit' ? 'text-green-500' : ''}`}>
              {transaction.type === 'deposit' 
                ? '+' 
                : transaction.type === 'withdrawal' 
                  ? '-' 
                  : ''}
              ₦{transaction.amount.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              {formatDate(transaction.createdAt)}
            </p>
          </div>
        </div>
        
        <div className="mt-2 flex flex-wrap justify-between items-center gap-2">
          {transaction.status && (
            <Badge variant={
              transaction.status === 'pending' 
                ? 'outline' 
                : transaction.status === 'completed' || transaction.status === 'successful'
                  ? 'default' 
                  : 'destructive'
            }>
              {transaction.status.charAt(0).toUpperCase() + transaction.status.slice(1)}
            </Badge>
          )}
          
          {transaction.type === 'deposit' && (
            <Button 
              variant="ghost" 
              size="sm" 
              className="text-xs" 
              onClick={() => onViewReceipt(transaction.id)}
            >
              <Receipt className="h-3 w-3 mr-1" />
              View Receipt
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default TransactionItem;
