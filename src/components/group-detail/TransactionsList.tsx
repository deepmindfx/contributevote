
import { useState } from "react";
import { useApp } from "@/contexts/AppContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArrowDown, ArrowUp, HelpCircle, Receipt } from "lucide-react";
import { format, isValid } from "date-fns";
import { Transaction } from "@/services/localStorage";

interface TransactionsListProps {
  transactions: Transaction[];
}

const TransactionsList = ({ transactions }: TransactionsListProps) => {
  const { getReceipt } = useApp();
  const [selectedTransactionId, setSelectedTransactionId] = useState<string | null>(null);
  const [receiptData, setReceiptData] = useState<any>(null);

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

      {receiptData && (
        <Dialog open={!!selectedTransactionId} onOpenChange={() => setSelectedTransactionId(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-center">Transaction Receipt</DialogTitle>
            </DialogHeader>
            <div className="p-6 bg-muted/30 rounded-lg space-y-4">
              <div className="flex justify-center mb-4">
                <div className="h-16 w-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                  <Receipt className="h-8 w-8 text-green-600 dark:text-green-400" />
                </div>
              </div>
              
              <div className="text-center mb-4">
                <h3 className="text-xl font-bold">CollectiPay</h3>
                <p className="text-sm text-muted-foreground">Official Contribution Receipt</p>
              </div>
              
              <div className="space-y-3 pt-2 border-t">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Receipt No:</span>
                  <span className="font-mono">{receiptData.receiptNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Date:</span>
                  <span>{formatDate(receiptData.date)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Group:</span>
                  <span>{receiptData.contributionName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Account No:</span>
                  <span className="font-mono">{receiptData.accountNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Contributor:</span>
                  <span>{receiptData.contributorName}</span>
                </div>
                <div className="flex justify-between font-bold pt-2 border-t">
                  <span>Amount:</span>
                  <span className="text-green-600">₦{receiptData.amount.toLocaleString()}</span>
                </div>
              </div>
              
              <div className="text-center text-xs text-muted-foreground mt-6 pt-2 border-t">
                <p>Thank you for your contribution!</p>
                <p>For any inquiries, please contact support@collectipay.com</p>
              </div>
            </div>
            <DialogFooter className="flex justify-center">
              <Button variant="outline">
                Download Receipt
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
};

export default TransactionsList;
