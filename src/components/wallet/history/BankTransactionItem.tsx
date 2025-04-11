
import React from "react";
import { ArrowDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

interface MonnifyTransaction {
  amount: number;
  paymentReference: string;
  transactionReference: string;
  paymentMethod: string;
  paidOn: string;
  paymentStatus: string;
  destinationAccountName: string;
  destinationBankName: string;
  destinationAccountNumber: string;
}

interface BankTransactionItemProps {
  transaction: MonnifyTransaction;
  currencyType: "NGN" | "USD";
  convertToUSD: (amount: number) => number;
}

const BankTransactionItem = ({ transaction, currencyType, convertToUSD }: BankTransactionItemProps) => {
  const formatDate = (dateString: string) => {
    return format(new Date(dateString), 'MMM d, yyyy h:mm a');
  };

  return (
    <div className="flex items-start p-3 border rounded-lg">
      <div className="w-10 h-10 rounded-full flex items-center justify-center bg-green-100 text-[#2DAE75]">
        <ArrowDown size={18} />
      </div>
      <div className="ml-3 flex-1">
        <div className="flex justify-between">
          <div>
            <h4 className="font-medium">Bank Transfer</h4>
            <p className="text-sm text-muted-foreground">
              Via {transaction.paymentMethod}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {formatDate(transaction.paidOn)}
            </p>
          </div>
          <div className="text-right">
            <div className="font-medium text-[#2DAE75]">
              +{currencyType === "NGN" ? 
                `₦${transaction.amount.toLocaleString()}` : 
                `$${convertToUSD(transaction.amount).toFixed(2)}`}
            </div>
            <div className="mt-1">
              <Badge variant={
                transaction.paymentStatus === 'PAID' ? 'default' :
                transaction.paymentStatus === 'PENDING' ? 'outline' : 'destructive'
              }>
                {transaction.paymentStatus}
              </Badge>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BankTransactionItem;
