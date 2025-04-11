
import React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshCcw } from "lucide-react";
import BankTransactionItem from "./BankTransactionItem";
import EmptyState from "./EmptyState";

interface BankTransactionsListProps {
  hasReservedAccount: boolean;
  isLoading: boolean;
  transactions: any[];
  currencyType: "NGN" | "USD";
  convertToUSD: (amount: number) => number;
  onRefresh: () => void;
  error?: string | null;
}

const BankTransactionsList = ({ 
  hasReservedAccount, 
  isLoading, 
  transactions,
  currencyType,
  convertToUSD,
  onRefresh,
  error
}: BankTransactionsListProps) => {
  if (!hasReservedAccount) {
    return (
      <Card>
        <CardContent className="pt-6">
          <EmptyState message="No reserved account found. Create a reserved account to receive bank transfers." />
        </CardContent>
      </Card>
    );
  }
  
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div>
          <CardTitle>Bank Transactions</CardTitle>
          <CardDescription>
            Transactions from your reserved account
          </CardDescription>
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={onRefresh}
          disabled={isLoading}
        >
          <RefreshCcw size={16} className={`mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="p-4 border rounded-lg animate-pulse bg-muted/20">
                <div className="flex justify-between">
                  <div className="space-y-2">
                    <div className="h-4 w-24 bg-muted rounded"></div>
                    <div className="h-3 w-16 bg-muted rounded"></div>
                  </div>
                  <div className="h-4 w-16 bg-muted rounded"></div>
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="text-center py-6">
            <p className="text-red-500 mb-2">{error}</p>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={onRefresh}
            >
              Try Again
            </Button>
          </div>
        ) : transactions.length === 0 ? (
          <EmptyState message="No bank transactions found. When you receive money to your reserved account, it will appear here." />
        ) : (
          <div className="space-y-3">
            {transactions.map((transaction, index) => (
              <BankTransactionItem 
                key={index} 
                transaction={transaction}
                currencyType={currencyType}
                convertToUSD={convertToUSD}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default BankTransactionsList;
