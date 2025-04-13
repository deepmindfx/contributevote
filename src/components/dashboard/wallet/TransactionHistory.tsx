
import { ArrowDown, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useNavigate } from "react-router-dom";
import { Transaction } from "@/services/localStorage/types";
import { format } from "date-fns";

interface TransactionHistoryProps {
  walletTransactions: Transaction[];
  viewTransactionDetails: (transaction: Transaction) => void;
  setShowHistory: (value: boolean) => void;
  currencyType: "NGN" | "USD";
  convertToUSD: (amount: number) => number;
  selectedTransaction: Transaction | null;
  isTransactionDetailsOpen: boolean;
  setIsTransactionDetailsOpen: (value: boolean) => void;
}

const TransactionHistory = ({
  walletTransactions,
  viewTransactionDetails,
  setShowHistory,
  currencyType,
  convertToUSD,
  selectedTransaction,
  isTransactionDetailsOpen,
  setIsTransactionDetailsOpen
}: TransactionHistoryProps) => {
  const navigate = useNavigate();
  
  const formatDate = (dateString: string) => {
    return format(new Date(dateString), 'MMM d, yyyy');
  };
  
  const formatDateTime = (dateString: string) => {
    return format(new Date(dateString), 'MMM d, yyyy h:mm a');
  };
  
  // Find sender name if available
  const getSenderName = (transaction: Transaction) => {
    if (transaction.type === 'deposit') {
      return transaction.metaData?.senderName || "Bank Transfer";
    } else {
      return "Wallet Withdrawal";
    }
  };
  
  // Get sender bank if available
  const getSenderBank = (transaction: Transaction) => {
    return transaction.metaData?.bankName || transaction.metaData?.senderBank || "";
  };
  
  return (
    <div className="bg-white dark:bg-black/40 rounded-t-3xl -mt-3 p-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-semibold text-lg">Recent Transactions</h3>
        <Button variant="ghost" size="sm" onClick={() => setShowHistory(false)} className="text-[#2DAE75]">
          Back
        </Button>
      </div>
      
      {walletTransactions.length > 0 ? (
        <div className="space-y-3">
          {walletTransactions.map(transaction => (
            <div 
              key={transaction.id} 
              className="flex items-center justify-between p-3 border rounded-lg cursor-pointer hover:bg-muted/30 transition-colors"
              onClick={() => viewTransactionDetails(transaction)}
            >
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
                    {transaction.metaData?.senderName || getSenderBank(transaction) ? 
                      `From: ${transaction.metaData?.senderName || ""} ${getSenderBank(transaction) ? `(${getSenderBank(transaction)})` : ""}` : 
                      formatDate(transaction.createdAt)
                    }
                  </p>
                </div>
              </div>
              <div className="flex items-center">
                <div className={`font-semibold ${transaction.type === 'deposit' ? 'text-[#2DAE75]' : 'text-red-500'}`}>
                  {transaction.type === 'deposit' ? '+' : '-'}
                  {currencyType === "NGN" ? `₦${transaction.amount.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}` : `$${convertToUSD(transaction.amount).toFixed(2)}`}
                </div>
                <ExternalLink className="ml-2 h-4 w-4 text-muted-foreground" />
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
      
      {/* Transaction Details Dialog */}
      <Dialog open={isTransactionDetailsOpen} onOpenChange={setIsTransactionDetailsOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Transaction Details</DialogTitle>
            <DialogDescription>
              Complete information about this transaction.
            </DialogDescription>
          </DialogHeader>
          
          {selectedTransaction && (
            <div className="space-y-4 py-4">
              <div className="flex justify-center mb-4">
                <div className={`w-16 h-16 rounded-full flex items-center justify-center
                  ${selectedTransaction.type === 'deposit' ? 'bg-green-100 text-[#2DAE75]' : 'bg-amber-100 text-amber-600'}`}>
                  {selectedTransaction.type === 'deposit' ? <ArrowDown size={24} /> : <ArrowDown size={24} className="transform rotate-180" />}
                </div>
              </div>
              
              <div className="text-center mb-4">
                <h3 className={`text-2xl font-bold ${selectedTransaction.type === 'deposit' ? 'text-[#2DAE75]' : 'text-red-500'}`}>
                  {selectedTransaction.type === 'deposit' ? '+' : '-'}
                  ₦{selectedTransaction.amount.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                </h3>
                <p className="text-muted-foreground text-sm">
                  {formatDateTime(selectedTransaction.createdAt)}
                </p>
              </div>
              
              <div className="space-y-3">
                <div className="flex justify-between py-2 border-b">
                  <span className="text-muted-foreground">Status</span>
                  <span className="font-medium capitalize">{selectedTransaction.status || "completed"}</span>
                </div>
                
                <div className="flex justify-between py-2 border-b">
                  <span className="text-muted-foreground">Type</span>
                  <span className="font-medium capitalize">{selectedTransaction.type}</span>
                </div>
                
                <div className="flex justify-between py-2 border-b">
                  <span className="text-muted-foreground">Transaction ID</span>
                  <span className="font-medium">{selectedTransaction.id.slice(0, 8)}</span>
                </div>
                
                {selectedTransaction.type === 'deposit' && (
                  <>
                    {(selectedTransaction.metaData?.senderName || getSenderName(selectedTransaction) !== "Bank Transfer") && (
                      <div className="flex justify-between py-2 border-b">
                        <span className="text-muted-foreground">Sender</span>
                        <span className="font-medium">{selectedTransaction.metaData?.senderName || getSenderName(selectedTransaction)}</span>
                      </div>
                    )}
                    
                    {getSenderBank(selectedTransaction) && (
                      <div className="flex justify-between py-2 border-b">
                        <span className="text-muted-foreground">Bank</span>
                        <span className="font-medium">{getSenderBank(selectedTransaction)}</span>
                      </div>
                    )}
                    
                    {selectedTransaction.metaData?.transactionReference && (
                      <div className="flex justify-between py-2 border-b">
                        <span className="text-muted-foreground">Reference</span>
                        <span className="font-medium">{selectedTransaction.metaData.transactionReference}</span>
                      </div>
                    )}
                  </>
                )}
                
                {selectedTransaction.description && (
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-muted-foreground">Description</span>
                    <span className="font-medium">{selectedTransaction.description}</span>
                  </div>
                )}
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsTransactionDetailsOpen(false);
              }}
              type="button"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TransactionHistory;
