import { ArrowDown, ExternalLink, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useNavigate } from "react-router-dom";
import { Transaction } from "@/services/localStorage/types";
import { format, isValid, parseISO } from "date-fns";

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
    if (!dateString) return "Unknown date";
    
    try {
      // First try with parseISO which is more reliable for ISO strings
      const parsedDate = parseISO(dateString);
      if (!isValid(parsedDate)) {
        // If parseISO fails, try with regular Date constructor
        const fallbackDate = new Date(dateString);
        if (!isValid(fallbackDate)) {
          return "Invalid date";
        }
        return format(fallbackDate, 'MMM d, yyyy');
      }
      return format(parsedDate, 'MMM d, yyyy');
    } catch (error) {
      console.error("Error formatting date:", error, dateString);
      return "Invalid date";
    }
  };
  
  const formatDateTime = (dateString: string) => {
    if (!dateString) return "Unknown date";
    
    try {
      // First try with parseISO which is more reliable for ISO strings
      const parsedDate = parseISO(dateString);
      if (!isValid(parsedDate)) {
        // If parseISO fails, try with regular Date constructor
        const fallbackDate = new Date(dateString);
        if (!isValid(fallbackDate)) {
          return "Invalid date";
        }
        return format(fallbackDate, 'MMM d, yyyy h:mm a');
      }
      return format(parsedDate, 'MMM d, yyyy h:mm a');
    } catch (error) {
      console.error("Error formatting date:", error, dateString);
      return "Invalid date";
    }
  };
  
  // Find sender name if available
  const getSenderName = (transaction: Transaction) => {
    if (transaction.type === 'deposit') {
      return transaction.metaData?.senderName || "Bank Transfer";
    } else if (transaction.type === 'transfer') {
      return transaction.recipientName || "Recipient";
    } else {
      return "Wallet Withdrawal";
    }
  };
  
  // Get sender bank if available
  const getSenderBank = (transaction: Transaction) => {
    if (transaction.type === 'transfer') {
      return transaction.bankName || "";
    }
    return transaction.metaData?.bankName || transaction.metaData?.senderBank || "";
  };
  
  // Get transaction icon based on type
  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'deposit':
        return <ArrowDown size={18} />;
      case 'withdrawal':
        return <ArrowDown size={18} className="transform rotate-180" />;
      case 'transfer':
        return <ArrowRight size={18} />;
      default:
        return <ArrowDown size={18} />;
    }
  };
  
  // Get transaction icon color based on type
  const getTransactionIconColor = (type: string) => {
    switch (type) {
      case 'deposit':
        return 'bg-green-100 text-[#2DAE75]';
      case 'withdrawal':
        return 'bg-amber-100 text-amber-600';
      case 'transfer':
        return 'bg-blue-100 text-blue-600';
      default:
        return 'bg-gray-100 text-gray-600';
    }
  };
  
  // Get transaction title based on type
  const getTransactionTitle = (type: string) => {
    switch (type) {
      case 'deposit':
        return 'Money In';
      case 'withdrawal':
        return 'Money Out';
      case 'transfer':
        return 'Transfer';
      default:
        return type;
    }
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
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${getTransactionIconColor(transaction.type)}`}>
                  {getTransactionIcon(transaction.type)}
                </div>
                <div className="ml-3">
                  <p className="font-medium text-sm">
                    {getTransactionTitle(transaction.type)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {transaction.type === 'transfer' ? (
                      `To: ${transaction.recipientName} (${transaction.recipientAccount})`
                    ) : transaction.metaData?.senderName || getSenderBank(transaction) ? (
                      `From: ${transaction.metaData?.senderName || ""} ${getSenderBank(transaction) ? `(${getSenderBank(transaction)})` : ""}`
                    ) : (
                      formatDate(transaction.createdAt)
                    )}
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
                <div className={`w-16 h-16 rounded-full flex items-center justify-center ${getTransactionIconColor(selectedTransaction.type)}`}>
                  {getTransactionIcon(selectedTransaction.type)}
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
                  <span className="font-medium">{selectedTransaction.id ? selectedTransaction.id.slice(0, 8) : "N/A"}</span>
                </div>
                
                {selectedTransaction.type === 'transfer' ? (
                  <>
                    <div className="flex justify-between py-2 border-b">
                      <span className="text-muted-foreground">Recipient</span>
                      <span className="font-medium">{selectedTransaction.recipientName}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b">
                      <span className="text-muted-foreground">Account Number</span>
                      <span className="font-medium">{selectedTransaction.recipientAccount}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b">
                      <span className="text-muted-foreground">Bank</span>
                      <span className="font-medium">{selectedTransaction.bankName}</span>
                    </div>
                    {selectedTransaction.fee > 0 && (
                      <div className="flex justify-between py-2 border-b">
                        <span className="text-muted-foreground">Fee</span>
                        <span className="font-medium">₦{selectedTransaction.fee.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                      </div>
                    )}
                    {selectedTransaction.narration && (
                      <div className="flex justify-between py-2 border-b">
                        <span className="text-muted-foreground">Narration</span>
                        <span className="font-medium">{selectedTransaction.narration}</span>
                      </div>
                    )}
                  </>
                ) : selectedTransaction.type === 'deposit' && (
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
