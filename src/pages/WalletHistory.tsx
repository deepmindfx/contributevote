import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Header from "@/components/layout/Header";
import MobileNav from "@/components/layout/MobileNav";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowDown, ArrowUp, ExternalLink, Filter, Calendar, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useApp } from "@/contexts/AppContext";
import { format } from "date-fns";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { updatePendingTransfers } from "@/utils/transferUtils";

const WalletHistory = () => {
  const navigate = useNavigate();
  const { user, transactions, refreshData } = useApp();
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [isTransactionDetailsOpen, setIsTransactionDetailsOpen] = useState(false);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [filteredTransactions, setFilteredTransactions] = useState([]);
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateRange, setDateRange] = useState({ from: undefined, to: undefined });
  const [isLoading, setIsLoading] = useState(false);
  
  // Load transaction history and update pending transfers
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        // Update status of any pending transfers
        await updatePendingTransfers();
        // Refresh data to get updated statuses
        refreshData();
      } catch (error) {
        console.error("Error fetching transaction data:", error);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchData();
  }, [refreshData]);
  
  // Filter wallet-related transactions for the current user
  useEffect(() => {
    const walletTransactions = transactions.filter(t => 
      t.userId === user?.id && 
      (t.contributionId === "" || t.type === "deposit" || t.type === "withdrawal")
    );
    
    // Apply filters
    let filtered = [...walletTransactions];
    
    if (typeFilter !== "all") {
      filtered = filtered.filter(t => t.type === typeFilter);
    }
    
    if (statusFilter !== "all") {
      filtered = filtered.filter(t => t.status === statusFilter);
    }
    
    if (dateRange.from) {
      const fromDate = new Date(dateRange.from);
      filtered = filtered.filter(t => new Date(t.createdAt) >= fromDate);
    }
    
    if (dateRange.to) {
      const toDate = new Date(dateRange.to);
      toDate.setHours(23, 59, 59, 999); // End of day
      filtered = filtered.filter(t => new Date(t.createdAt) <= toDate);
    }
    
    // Sort by date (newest first)
    filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    
    setFilteredTransactions(filtered);
  }, [transactions, user, typeFilter, statusFilter, dateRange]);
  
  const formatDate = (dateString) => {
    try {
      return format(new Date(dateString), 'MMM d, yyyy');
    } catch {
      return 'Invalid date';
    }
  };
  
  const formatDateTime = (dateString) => {
    try {
      return format(new Date(dateString), 'MMM d, yyyy h:mm a');
    } catch {
      return 'Invalid date';
    }
  };
  
  const handleRefresh = async () => {
    setIsLoading(true);
    try {
      // Update status of any pending transfers
      await updatePendingTransfers();
      // Refresh data to get updated statuses
      refreshData();
    } catch (error) {
      console.error("Error refreshing transactions:", error);
    } finally {
      setIsLoading(false);
    }
  };
  
  const viewTransactionDetails = (transaction) => {
    setSelectedTransaction(transaction);
    setIsTransactionDetailsOpen(true);
  };
  
  return (
    <div className="min-h-screen pb-20 md:pb-0">
      <Header />
      
      <main className="container max-w-4xl mx-auto px-4 pt-24 pb-12">
        <div className="mb-6">
          <Button variant="ghost" size="sm" className="mb-2" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Dashboard
          </Button>
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold">Wallet History</h1>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setIsFilterOpen(true)}>
                <Filter className="h-4 w-4 mr-2" />
                Filter
              </Button>
              <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isLoading}>
                <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          </div>
        </div>
        
        <Card>
          <CardHeader>
            <CardTitle>Transaction History</CardTitle>
            <CardDescription>
              Your wallet transaction history
            </CardDescription>
          </CardHeader>
          <CardContent>
            {filteredTransactions.length > 0 ? (
              <div className="space-y-4">
                {filteredTransactions.map((transaction) => (
                  <div 
                    key={transaction.id} 
                    className="flex items-center justify-between p-3 border rounded-lg cursor-pointer hover:bg-muted/30 transition-colors"
                    onClick={() => viewTransactionDetails(transaction)}
                  >
                    <div className="flex items-center">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center
                        ${transaction.type === 'deposit' ? 'bg-green-100 text-green-600' : 'bg-amber-100 text-amber-600'}`}>
                        {transaction.type === 'deposit' ? <ArrowDown size={18} /> : <ArrowUp size={18} />}
                      </div>
                      <div className="ml-3">
                        <p className="font-medium text-sm">
                          {transaction.type === 'deposit' ? 'Money In' : 'Money Out'}
                          {transaction.status === 'pending' && (
                            <Badge variant="outline" className="ml-2 text-xs">Pending</Badge>
                          )}
                          {transaction.status === 'failed' && (
                            <Badge variant="destructive" className="ml-2 text-xs">Failed</Badge>
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(transaction.createdAt)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center">
                      <div className={`font-semibold ${transaction.type === 'deposit' ? 'text-green-500' : 'text-red-500'}`}>
                        {transaction.type === 'deposit' ? '+' : '-'}
                        ₦{transaction.amount.toLocaleString()}
                      </div>
                      <ExternalLink className="ml-2 h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-10 text-muted-foreground">
                <p>No transactions found</p>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
      
      {/* Filter Dialog */}
      <Dialog open={isFilterOpen} onOpenChange={setIsFilterOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Filter Transactions</DialogTitle>
            <DialogDescription>
              Refine your transaction history view
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Transaction Type</label>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="deposit">Deposits</SelectItem>
                  <SelectItem value="withdrawal">Withdrawals</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Status</label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Date Range</label>
              <DateRangePicker date={dateRange} setDate={setDateRange} />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setTypeFilter("all");
              setStatusFilter("all");
              setDateRange({ from: undefined, to: undefined });
            }}>
              Reset
            </Button>
            <Button onClick={() => setIsFilterOpen(false)}>
              Apply Filters
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Transaction Details Dialog */}
      {selectedTransaction && (
        <Dialog open={isTransactionDetailsOpen} onOpenChange={setIsTransactionDetailsOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Transaction Details</DialogTitle>
              <DialogDescription>
                Complete information about this transaction.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              <div className="flex justify-center mb-4">
                <div className={`w-16 h-16 rounded-full flex items-center justify-center
                  ${selectedTransaction.type === 'deposit' ? 'bg-green-100 text-green-600' : 'bg-amber-100 text-amber-600'}`}>
                  {selectedTransaction.type === 'deposit' ? <ArrowDown size={24} /> : <ArrowUp size={24} />}
                </div>
              </div>
              
              <div className="text-center mb-4">
                <h3 className={`text-2xl font-bold ${selectedTransaction.type === 'deposit' ? 'text-green-500' : 'text-red-500'}`}>
                  {selectedTransaction.type === 'deposit' ? '+' : '-'}
                  ₦{selectedTransaction.amount.toLocaleString()}
                </h3>
                <p className="text-muted-foreground text-sm">
                  {formatDateTime(selectedTransaction.createdAt)}
                </p>
                <Badge className={`mt-2 ${
                  selectedTransaction.status === 'completed' ? 'bg-green-100 text-green-800' : 
                  selectedTransaction.status === 'failed' ? 'bg-red-100 text-red-800' : 
                  'bg-yellow-100 text-yellow-800'
                }`}>
                  {selectedTransaction.status.charAt(0).toUpperCase() + selectedTransaction.status.slice(1)}
                </Badge>
              </div>
              
              <div className="space-y-3">
                <div className="flex justify-between py-2 border-b">
                  <span className="text-muted-foreground">Transaction ID</span>
                  <span className="font-mono text-sm">{selectedTransaction.id.slice(0, 8)}</span>
                </div>
                
                <div className="flex justify-between py-2 border-b">
                  <span className="text-muted-foreground">Type</span>
                  <span className="capitalize">{selectedTransaction.type}</span>
                </div>
                
                {selectedTransaction.description && (
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-muted-foreground">Description</span>
                    <span className="text-right text-sm">{selectedTransaction.description}</span>
                  </div>
                )}
                
                {selectedTransaction.metaData?.bankName && (
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-muted-foreground">Bank</span>
                    <span>{selectedTransaction.metaData.bankName}</span>
                  </div>
                )}
                
                {selectedTransaction.metaData?.accountNumber && (
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-muted-foreground">Account Number</span>
                    <span className="font-mono">{selectedTransaction.metaData.accountNumber}</span>
                  </div>
                )}
                
                {selectedTransaction.metaData?.recipientName && (
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-muted-foreground">Recipient</span>
                    <span>{selectedTransaction.metaData.recipientName}</span>
                  </div>
                )}
                
                {selectedTransaction.metaData?.fee !== undefined && (
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-muted-foreground">Fee</span>
                    <span>₦{selectedTransaction.metaData.fee.toLocaleString()}</span>
                  </div>
                )}
                
                {selectedTransaction.metaData?.transferReference && (
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-muted-foreground">Reference</span>
                    <span className="font-mono text-xs">{selectedTransaction.metaData.transferReference}</span>
                  </div>
                )}
              </div>
            </div>
            
            <DialogFooter className="flex gap-2">
              {selectedTransaction.status === 'pending' && (
                <Button 
                  variant="outline" 
                  onClick={async () => {
                    setIsLoading(true);
                    if (selectedTransaction.metaData?.transferReference) {
                      await updatePendingTransfers();
                      refreshData();
                      setIsTransactionDetailsOpen(false);
                    }
                    setIsLoading(false);
                  }}
                  disabled={isLoading}
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                  Check Status
                </Button>
              )}
              <Button onClick={() => setIsTransactionDetailsOpen(false)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
      
      <MobileNav />
    </div>
  );
};

export default WalletHistory;
