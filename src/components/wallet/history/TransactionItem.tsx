
import React from "react";
import { ArrowDown, ArrowUp, HelpCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Transaction } from "@/services/localStorage/types";
import { format } from "date-fns";

interface TransactionItemProps {
  transaction: Transaction;
  currencyType: "NGN" | "USD";
  convertToUSD: (amount: number) => number;
}

const TransactionItem = ({ transaction, currencyType, convertToUSD }: TransactionItemProps) => {
  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), 'MMM d, yyyy h:mm a');
    } catch (error) {
      console.error("Error formatting date:", error, dateString);
      return "Invalid date";
    }
  };

  return (
    <div className="flex items-start p-3 border rounded-lg">
      <div className={`w-10 h-10 rounded-full flex items-center justify-center
        ${transaction.type === 'deposit' ? 'bg-green-100 text-[#2DAE75]' : 
          transaction.type === 'withdrawal' ? 'bg-amber-100 text-amber-600' :
          'bg-blue-100 text-blue-600'}`}>
        {transaction.type === 'deposit' ? (
          <ArrowDown size={18} />
        ) : transaction.type === 'withdrawal' ? (
          <ArrowUp size={18} />
        ) : (
          <HelpCircle size={18} />
        )}
      </div>
      <div className="ml-3 flex-1">
        <div className="flex justify-between">
          <div>
            <h4 className="font-medium">
              {transaction.type === 'deposit' ? 'Deposit' : 
               transaction.type === 'withdrawal' ? 'Withdrawal' : 
               'Vote'}
               {transaction.anonymous ? ' (Anonymous)' : ''}
            </h4>
            <p className="text-sm text-muted-foreground">
              {transaction.description}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {formatDate(transaction.createdAt)}
            </p>
          </div>
          <div className="text-right">
            <div className={`font-medium ${
              transaction.type === 'deposit' ? 'text-[#2DAE75]' : 
              transaction.type === 'withdrawal' ? 'text-red-500' : ''
            }`}>
              {transaction.type === 'deposit' ? '+' : 
               transaction.type === 'withdrawal' ? '-' : ''}
              {transaction.amount > 0 ? (
                currencyType === "NGN" ? 
                  `₦${transaction.amount.toLocaleString()}` : 
                  `$${convertToUSD(transaction.amount).toFixed(2)}`
              ) : ''}
            </div>
            <div className="mt-1">
              <Badge variant={
                transaction.status === 'pending' ? 'outline' :
                transaction.status === 'completed' ? 'default' : 'destructive'
              }>
                {transaction.status.charAt(0).toUpperCase() + transaction.status.slice(1)}
              </Badge>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TransactionItem;
