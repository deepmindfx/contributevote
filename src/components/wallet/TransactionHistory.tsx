
import React from "react";
import { Button } from "@/components/ui/button";
import { ArrowDown } from "lucide-react";
import { Transaction } from "@/services/localStorage";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";

interface TransactionHistoryProps {
  transactions: Transaction[];
  currencyType: "NGN" | "USD";
  onBack: () => void;
}

const TransactionHistory = ({ transactions, currencyType, onBack }: TransactionHistoryProps) => {
  const navigate = useNavigate();
  
  // Convert NGN to USD (simplified conversion rate)
  const convertToUSD = (amount: number) => {
    return amount / 1550; // Using a simplified conversion rate of 1 USD = 1550 NGN
  };
  
  const formatDate = (dateString: string) => {
    return format(new Date(dateString), 'MMM d, yyyy');
  };
  
  return (
    <div className="bg-white dark:bg-black/40 rounded-t-3xl -mt-3 p-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-semibold text-lg">Recent Transactions</h3>
        <Button variant="ghost" size="sm" onClick={onBack} className="text-[#2DAE75]">
          Back
        </Button>
      </div>
      
      {transactions.length > 0 ? (
        <div className="space-y-3">
          {transactions.map(transaction => (
            <div key={transaction.id} className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center
                  ${transaction.type === 'deposit' ? 'bg-green-100 text-[#2DAE75]' : transaction.type === 'withdrawal' ? 'bg-amber-100 text-amber-600' : 'bg-blue-100 text-blue-600'}`}>
                  {transaction.type === 'deposit' ? <ArrowDown size={18} /> : <ArrowDown size={18} className="transform rotate-180" />}
                </div>
                <div className="ml-3">
                  <p className="font-medium text-sm">
                    {transaction.type === 'deposit' ? 'Money In' : 'Money Out'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(transaction.createdAt)}
                  </p>
                </div>
              </div>
              <div className={`font-semibold ${transaction.type === 'deposit' ? 'text-[#2DAE75]' : 'text-red-500'}`}>
                {transaction.type === 'deposit' ? '+' : '-'}
                {currencyType === "NGN" ? `₦${transaction.amount.toLocaleString()}` : `$${convertToUSD(transaction.amount).toFixed(2)}`}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-6 text-muted-foreground">
          <p>No transaction history yet</p>
        </div>
      )}
      
      <Button variant="outline" className="w-full mt-4" onClick={() => navigate("/wallet-history")}>
        View All Transactions
      </Button>
    </div>
  );
};

export default TransactionHistory;
