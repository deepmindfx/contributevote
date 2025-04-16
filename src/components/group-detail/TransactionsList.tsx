
import { useState } from "react";
import { useApp } from "@/contexts/AppContext";
import { Card, CardContent } from "@/components/ui/card";
import { Transaction } from "@/services/localStorage";
import TransactionReceiptDialog from "./dialogs/TransactionReceiptDialog";
import { 
  TransactionHeader, 
  TransactionListContent 
} from "./transactions";

interface TransactionsListProps {
  transactions: Transaction[];
}

const TransactionsList = ({ transactions }: TransactionsListProps) => {
  const { getReceipt, refreshData } = useApp();
  const [selectedTransaction, setSelectedTransaction] = useState<any>(null);
  const [receiptDialogOpen, setReceiptDialogOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleViewReceipt = (transactionId: string) => {
    const receipt = getReceipt(transactionId);
    if (receipt) {
      setSelectedTransaction(receipt);
      setReceiptDialogOpen(true);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    
    try {
      await refreshData();
      setTimeout(() => {
        setIsRefreshing(false);
      }, 1000);
    } catch (error) {
      console.error("Error refreshing data:", error);
      setIsRefreshing(false);
    }
  };

  return (
    <>
      <Card className="glass-card animate-slide-up">
        <TransactionHeader 
          onRefresh={handleRefresh} 
          isRefreshing={isRefreshing} 
        />
        <CardContent>
          <TransactionListContent 
            transactions={transactions}
            onViewReceipt={handleViewReceipt}
          />
        </CardContent>
      </Card>

      {/* Transaction Receipt Dialog */}
      <TransactionReceiptDialog
        open={receiptDialogOpen}
        onOpenChange={setReceiptDialogOpen}
        transaction={selectedTransaction}
      />
    </>
  );
};

export default TransactionsList;
