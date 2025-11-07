import { useState, useMemo } from "react";
import { useSupabaseContribution } from "@/contexts/SupabaseContributionContext";
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
  const { getReceipt, refreshContributionData } = useSupabaseContribution();
  const [selectedTransactionId, setSelectedTransactionId] = useState<string | null>(null);
  const [receiptData, setReceiptData] = useState<any>(null);
  const [receiptDialogOpen, setReceiptDialogOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Filter out duplicate transactions
  const uniqueTransactions = useMemo(() => {
    const seen = new Set();
    return transactions.filter(transaction => {
      // Create a unique key based on payment reference or transaction ID
      const key = transaction.metaData?.paymentReference || 
                 transaction.metaData?.paymentDetails?.transactionId ||
                 transaction.id;
                 
      // If we've seen this key before, it's a duplicate
      if (seen.has(key)) {
        return false;
      }
      
      // Add the key to our set of seen keys
      seen.add(key);
      return true;
    });
  }, [transactions]);

  const handleViewReceipt = (transactionId: string) => {
    const receipt = getReceipt(transactionId);
    if (receipt) {
      setReceiptData(receipt);
      setSelectedTransactionId(transactionId);
      setReceiptDialogOpen(true);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    
    try {
      await refreshContributionData();
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
            transactions={uniqueTransactions}
            onViewReceipt={handleViewReceipt}
          />
        </CardContent>
      </Card>

      {/* Transaction Receipt Dialog */}
      <TransactionReceiptDialog
        open={receiptDialogOpen}
        onOpenChange={setReceiptDialogOpen}
        receiptData={receiptData}
      />
    </>
  );
};

export default TransactionsList;
