
import React from "react";
import { Transaction } from "@/services/localStorage";
import TransactionItem from "./TransactionItem";
import EmptyTransactionsList from "./EmptyTransactionsList";
import { format, isValid } from "date-fns";

interface TransactionListContentProps {
  transactions: Transaction[];
  onViewReceipt: (transactionId: string) => void;
}

const TransactionListContent = ({ transactions, onViewReceipt }: TransactionListContentProps) => {
  const sortedTransactions = [...transactions].sort((a, b) => {
    try {
      const dateA = new Date(a.createdAt || "");
      const dateB = new Date(b.createdAt || "");
      if (!isValid(dateA) || !isValid(dateB)) {
        console.error("Invalid date in transaction sort:", a.createdAt, b.createdAt);
        return 0;
      }
      return dateB.getTime() - dateA.getTime();
    } catch (error) {
      console.error("Error sorting transactions:", error);
      return 0;
    }
  });

  if (sortedTransactions.length === 0) {
    return <EmptyTransactionsList />;
  }

  return (
    <div className="space-y-4">
      {sortedTransactions.map(transaction => (
        <TransactionItem 
          key={transaction.id} 
          transaction={transaction} 
          onViewReceipt={onViewReceipt}
        />
      ))}
    </div>
  );
};

export default TransactionListContent;
