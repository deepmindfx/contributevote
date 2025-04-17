import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { CalendarIcon, CreditCard, ArrowRight, PiggyBank, Coins, ChevronsUpDown, Copy, Check } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useApp } from "@/contexts/AppContext";
import { formatDate } from "@/lib/utils";
import Header from "@/components/layout/Header";
import { toast } from "sonner";
import { updateUserBalance } from "@/services/localStorage";
import { getReservedAccountTransactions } from "@/services/walletIntegration";

interface Transaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  status: "pending" | "completed" | "failed";
}

const WalletHistory = () => {
  const [accountTransactions, setAccountTransactions] = useState<any[]>([]);
  const [isMockingTransactions, setIsMockingTransactions] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isFiltering, setIsFiltering] = useState(false);
  const [filterType, setFilterType] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [isTransactionDetailsOpen, setIsTransactionDetailsOpen] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<any | null>(null);
  
  const { user } = useApp();
  
  // Mock transactions for demonstration
  useEffect(() => {
    if (isMockingTransactions) {
      const mockTransactions: Transaction[] = [
        {
          id: "1",
          date: "2024-07-15",
          description: "Deposit from bank transfer",
          amount: 5000,
          status: "completed",
        },
        {
          id: "2",
          date: "2024-07-10",
          description: "Withdrawal to bank account",
          amount: -2000,
          status: "completed",
        },
        {
          id: "3",
          date: "2024-07-05",
          description: "Contribution to Charity Fund",
          amount: -1000,
          status: "completed",
        },
      ];
      setAccountTransactions(mockTransactions);
      setIsLoading(false);
    }
  }, [isMockingTransactions]);
  
  // Fetch account transactions
  const fetchAccountTransactions = async () => {
    if (!user?.reservedAccount?.accountReference) {
      setErrorMessage("You don't have a reserved account");
      setIsLoading(false);
      return;
    }
    
    try {
      setIsLoading(true);
      
      const response = await getReservedAccountTransactions(user.reservedAccount.accountReference);
      
      // Fix the access of responseBody property
      const transactions = response?.content || [];
      const totalElements = response?.totalElements || 0;
      const totalPages = response?.totalPages || 0;
      
      setAccountTransactions(transactions);
      setIsMockingTransactions(false);
      
      if (transactions.length === 0 && !isFiltering) {
        setErrorMessage("No transactions found for your account");
      }
    } catch (error) {
      console.error("Error fetching transactions:", error);
      setErrorMessage("Failed to load transactions");
    } finally {
      setIsLoading(false);
    }
  };
  
  useEffect(() => {
    fetchAccountTransactions();
  }, []);
  
  // Filter transactions
  const filteredTransactions = accountTransactions.filter((transaction) => {
    const typeMatch = filterType === "all" || transaction.type === filterType;
    const statusMatch = filterStatus === "all" || transaction.status === filterStatus;
    return typeMatch && statusMatch;
  });
  
  // Handle filter change
  const handleFilterChange = (type: string, value: string) => {
    setIsFiltering(true);
    if (type === "type") {
      setFilterType(value);
    } else if (type === "status") {
      setFilterStatus(value);
    }
  };
  
  // View transaction details
  const viewTransactionDetails = (transaction: any) => {
    setSelectedTransaction(transaction);
    setIsTransactionDetailsOpen(true);
  };
  
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container mx-auto py-12 px-4">
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="text-2xl font-bold">Wallet History</CardTitle>
            <CardDescription>
              View your recent transactions and account activity.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-4 flex items-center space-x-4">
              <Select onValueChange={(value) => handleFilterChange("type", value)}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filter by Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="deposit">Deposits</SelectItem>
                  <SelectItem value="withdrawal">Withdrawals</SelectItem>
                  <SelectItem value="transfer">Transfers</SelectItem>
                  <SelectItem value="vote">Votes</SelectItem>
                </SelectContent>
              </Select>
              
              <Select onValueChange={(value) => handleFilterChange("status", value)}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filter by Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {isLoading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="flex items-center space-x-4">
                    <Skeleton className="h-12 w-12 rounded-full" />
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-[250px]" />
                      <Skeleton className="h-4 w-[200px]" />
                    </div>
                    <Skeleton className="ml-auto h-4 w-[60px]" />
                  </div>
                ))}
              </div>
            ) : errorMessage ? (
              <div className="text-center text-muted-foreground">
                {errorMessage}
              </div>
            ) : filteredTransactions.length === 0 && isFiltering ? (
              <div className="text-center text-muted-foreground">
                No transactions match the selected filters.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[150px]">Date</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTransactions.map((transaction) => (
                    <TableRow key={transaction.id} onClick={() => viewTransactionDetails(transaction)} className="cursor-pointer hover:bg-secondary">
                      <TableCell className="font-medium">{formatDate(transaction.createdAt)}</TableCell>
                      <TableCell>{transaction.description}</TableCell>
                      <TableCell className="text-right">{transaction.amount}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant={transaction.status === "completed" ? "success" : transaction.status === "pending" ? "secondary" : "destructive"}>
                          {transaction.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
      
      {/* Transaction Details Dialog */}
      <Dialog open={isTransactionDetailsOpen} onOpenChange={setIsTransactionDetailsOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Transaction Details</DialogTitle>
            <DialogDescription>
              View detailed information about this transaction.
            </DialogDescription>
          </DialogHeader>
          
          {selectedTransaction && (
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="date" className="text-right">
                  Date
                </Label>
                <Input type="text" id="date" value={formatDate(selectedTransaction.createdAt)} className="col-span-3" readOnly />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="description" className="text-right">
                  Description
                </Label>
                <Input type="text" id="description" value={selectedTransaction.description} className="col-span-3" readOnly />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="amount" className="text-right">
                  Amount
                </Label>
                <Input type="text" id="amount" value={selectedTransaction.amount} className="col-span-3" readOnly />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="status" className="text-right">
                  Status
                </Label>
                <Input type="text" id="status" value={selectedTransaction.status} className="col-span-3" readOnly />
              </div>
              {selectedTransaction.metaData && selectedTransaction.metaData.paymentReference && (
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="paymentReference" className="text-right">
                    Payment Reference
                  </Label>
                  <Input type="text" id="paymentReference" value={selectedTransaction.metaData.paymentReference} className="col-span-3" readOnly />
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default WalletHistory;
