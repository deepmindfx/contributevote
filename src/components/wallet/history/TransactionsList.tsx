
import React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Transaction } from "@/services/localStorage";
import TransactionItem from "./TransactionItem";
import EmptyState from "./EmptyState";

interface TransactionsListProps {
  transactions: Transaction[];
  filter: "all" | "deposit" | "withdrawal" | "vote";
  currencyType: "NGN" | "USD";
  convertToUSD: (amount: number) => number;
}

const TransactionsList = ({ transactions, filter, currencyType, convertToUSD }: TransactionsListProps) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Transactions</CardTitle>
        <CardDescription>
          {filter === "all" 
            ? "All transactions" 
            : filter === "deposit" 
              ? "Deposit transactions" 
              : filter === "withdrawal" 
                ? "Withdrawal transactions" 
                : "Vote transactions"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {transactions.length === 0 ? (
          <EmptyState message="No transactions found" />
        ) : (
          <div className="space-y-4">
            {transactions.map((transaction) => (
              <TransactionItem 
                key={transaction.id} 
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

export default TransactionsList;
