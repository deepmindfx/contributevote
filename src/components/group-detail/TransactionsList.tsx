
import { useState } from "react";
import { useApp } from "@/contexts/AppContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowDown, ArrowUp, HelpCircle, Receipt } from "lucide-react";
import { format, isValid } from "date-fns";
import { Transaction } from "@/services/localStorage";
import TransactionReceiptDialog from "./dialogs/TransactionReceiptDialog";

interface TransactionsListProps {
  transactions: Transaction[];
}

const TransactionsList = ({ transactions }: TransactionsListProps) => {
  const { getReceipt } = useApp();
  const [selectedTransactionId, setSelectedTransactionId] = useState<string | null>(null);
  const [receiptData, setReceiptData] = useState<any>(null);
  const [receiptDialogOpen, setReceiptDialogOpen] = useState(false);

  const formatDate = (dateString?: string) => {
    if (!dateString) return "Unknown date";
    
    try {
      const date = new Date(dateString);
      if (!isValid(date)) {
        return "Invalid date";
      }
      return format(date, 'MMMM d, yyyy');
    } catch (error) {
      console.error("Error formatting date:", error, dateString);
      return "Invalid date";
    }
  };

  const handleViewReceipt = (transactionId: string) => {
    const receipt = getReceipt(transactionId);
    if (receipt) {
      setReceiptData(receipt);
      setSelectedTransactionId(transactionId);
      setReceiptDialogOpen(true);
    }
  };

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

  return (
    <>
      <Card className="glass-card animate-slide-up">
        <CardHeader>
          <CardTitle>Transaction History</CardTitle>
          <CardDescription>All transactions for this contribution group</CardDescription>
        </CardHeader>
        <CardContent>
          {sortedTransactions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>No transactions yet.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {sortedTransactions.map(transaction => (
                <div key={transaction.id} className="flex items-start py-3 border-b last:border-b-0">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center
                    ${transaction.type === 'deposit' 
                      ? 'bg-green-100 dark:bg-green-900/20 text-green-600 dark:text-green-400' 
                      : transaction.type === 'withdrawal' 
                        ? 'bg-amber-100 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400' 
                        : 'bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'}`}>
                    {transaction.type === 'deposit' 
                      ? <ArrowDown size={18} /> 
                      : transaction.type === 'withdrawal' 
                        ? <ArrowUp size={18} /> 
                        : <HelpCircle size={18} />}
                  </div>
                  <div className="ml-3 flex-1">
                    <div className="flex justify-between">
                      <div>
                        <h4 className="font-medium text-sm">
                          {transaction.type === 'deposit' 
                            ? 'Contribution' 
                            : transaction.type === 'withdrawal' 
                              ? 'Fund Withdrawal' 
                              : 'Vote'}
                        </h4>
                        <p className="text-xs text-muted-foreground">
                          {transaction.description}
                          {transaction.anonymous && ' (Anonymous)'}
                        </p>
                      </div>
                      <div className="text-right">
                        <div className={`font-medium ${transaction.type === 'deposit' ? 'text-green-500' : ''}`}>
                          {transaction.type === 'deposit' 
                            ? '+' 
                            : transaction.type === 'withdrawal' 
                              ? '-' 
                              : ''}
                          ₦{transaction.amount.toLocaleString()}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(transaction.createdAt)}
                        </p>
                      </div>
                    </div>
                    
                    <div className="mt-2 flex flex-wrap justify-between items-center gap-2">
                      {transaction.status && (
                        <Badge variant={
                          transaction.status === 'pending' 
                            ? 'outline' 
                            : transaction.status === 'completed' 
                              ? 'default' 
                              : 'destructive'
                        }>
                          {transaction.status.charAt(0).toUpperCase() + transaction.status.slice(1)}
                        </Badge>
                      )}
                      
                      {transaction.type === 'deposit' && (
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="text-xs" 
                          onClick={() => handleViewReceipt(transaction.id)}
                        >
                          <Receipt className="h-3 w-3 mr-1" />
                          View Receipt
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
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
