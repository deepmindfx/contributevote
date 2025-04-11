
import React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import BankTransactionItem from "./BankTransactionItem";
import EmptyState from "./EmptyState";

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

interface BankTransactionsListProps {
  hasReservedAccount: boolean;
  isLoading: boolean;
  transactions: MonnifyTransaction[];
  currencyType: "NGN" | "USD";
  convertToUSD: (amount: number) => number;
  onRefresh: () => void;
}

const BankTransactionsList = ({ 
  hasReservedAccount, 
  isLoading, 
  transactions, 
  currencyType, 
  convertToUSD,
  onRefresh
}: BankTransactionsListProps) => {
  const navigate = useNavigate();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Bank Transactions</CardTitle>
        <CardDescription>
          Transactions processed through your virtual bank account
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!hasReservedAccount ? (
          <EmptyState 
            message="You don't have a virtual bank account yet" 
            buttonText="Create Virtual Account"
            onButtonClick={() => navigate("/dashboard")}
          />
        ) : isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="flex items-start p-3 border rounded-lg">
                <Skeleton className="w-10 h-10 rounded-full" />
                <div className="ml-3 flex-1">
                  <Skeleton className="h-5 w-32 mb-2" />
                  <Skeleton className="h-4 w-48 mb-1" />
                  <Skeleton className="h-3 w-24" />
                </div>
                <div className="text-right">
                  <Skeleton className="h-5 w-20 mb-2" />
                  <Skeleton className="h-6 w-16 ml-auto" />
                </div>
              </div>
            ))}
          </div>
        ) : transactions.length === 0 ? (
          <EmptyState 
            message="No bank transactions found" 
            buttonText="Refresh Transactions"
            onButtonClick={onRefresh}
          />
        ) : (
          <div className="space-y-4">
            {transactions.map((transaction) => (
              <BankTransactionItem
                key={transaction.transactionReference}
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
