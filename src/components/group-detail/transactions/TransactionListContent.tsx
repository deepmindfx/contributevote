
import React from "react";
import { Transaction } from "@/services/localStorage";
import { TransactionItem } from "./index";
import EmptyTransactionsList from "./EmptyTransactionsList";

interface TransactionListContentProps {
  transactions: Transaction[];
  onViewReceipt: (transactionId: string) => void;
}

const TransactionListContent = ({ transactions, onViewReceipt }: TransactionListContentProps) => {
  if (!transactions || transactions.length === 0) {
    return <EmptyTransactionsList />;
  }

  return (
    <div className="space-y-1 max-h-96 overflow-y-auto pr-1">
      {transactions.map((transaction) => (
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
