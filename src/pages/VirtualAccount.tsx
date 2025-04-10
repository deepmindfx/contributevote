import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Header from "@/components/layout/Header";
import MobileNav from "@/components/layout/MobileNav";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ArrowLeft, Copy, Building, RefreshCw, ArrowDownToLine, ArrowUpFromLine, Info } from "lucide-react";
import { useApp } from "@/contexts/AppContext";
import { format } from "date-fns";

const VirtualAccount = () => {
  const navigate = useNavigate();
  const { 
    user, 
    isAuthenticated, 
    createVirtualAccount, 
    updateKYCDetails,
    initiateTransfer,
    getVirtualAccountTransactions,
    getSupportedBanks
  } = useApp();
  
  const [tab, setTab] = useState("account");
  const [isLoading, setIsLoading] = useState(false);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [banks, setBanks] = useState<{ bankCode: string; bankName: string }[]>([]);
  
  // KYC Dialog state
  const [kycDialogOpen, setKycDialogOpen] = useState(false);
  const [bvn, setBvn] = useState("");
  const [nin, setNin] = useState("");
  
  // Transfer Dialog state
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [bankCode, setBankCode] = useState("");
  const [accountName, setAccountName] = useState("");
  const [narration, setNarration] = useState("");
  
  // Redirect if not authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      navigate("/auth");
    }
    
    // Load banks
    const loadBanks = async () => {
      try {
        const bankList = await getSupportedBanks();
        setBanks(bankList);
      } catch (error) {
        console.error("Error loading banks:", error);
      }
    };
    
    loadBanks();
    
    // Load transactions if virtual account exists
    if (user?.virtualAccount) {
      loadTransactions();
    }
  }, [isAuthenticated, user?.virtualAccount, getSupportedBanks, navigate]);
  
  const loadTransactions = async () => {
    setIsLoading(true);
    try {
      const txns = await getVirtualAccountTransactions();
      setTransactions(txns);
    } catch (error) {
      console.error("Error loading transactions:", error);
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleCreateVirtualAccount = async () => {
    setIsLoading(true);
    try {
      const success = await createVirtualAccount();
      if (!success) {
        throw new Error("Failed to create virtual account");
      }
    } catch (error) {
      console.error("Error creating virtual account:", error);
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleUpdateKYC = async () => {
    if (!bvn && !nin) {
      toast.error("Please provide either BVN or NIN");
      return;
    }
    
    setIsLoading(true);
    try {
      const success = await updateKYCDetails({
        bvn: bvn || undefined,
        nin: nin || undefined
      });
      
      if (success) {
        setKycDialogOpen(false);
        setBvn("");
        setNin("");
      }
    } catch (error) {
      console.error("Error updating KYC:", error);
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleInitiateTransfer = async () => {
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }
    
    if (!accountNumber || accountNumber.length < 10) {
      toast.error("Please enter a valid account number");
      return;
    }
    
    if (!bankCode) {
      toast.error("Please select a bank");
      return;
    }
    
    if (!accountName) {
      toast.error("Please enter the account name");
      return;
    }
    
    setIsLoading(true);
    try {
      const success = await initiateTransfer({
        amount: Number(amount),
        recipientAccountNumber: accountNumber,
        recipientBankCode: bankCode,
        recipientName: accountName,
        narration: narration || "Transfer from CollectiPay"
      });
      
      if (success) {
        setTransferDialogOpen(false);
        setAmount("");
        setAccountNumber("");
        setBankCode("");
        setAccountName("");
        setNarration("");
      }
    } catch (error) {
      console.error("Error initiating transfer:", error);
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleCopyAccount = () => {
    if (user.virtualAccount) {
      navigator.clipboard.writeText(user.virtualAccount.accountNumber);
      toast.success("Account number copied to clipboard");
    }
  };
  
  // Format date for display
  const formatDate = (dateString: string) => {
    return format(new Date(dateString), 'MMM d, yyyy h:mm a');
  };

  return (
    <div className="min-h-screen pb-20 md:pb-0">
      <Header />
      
      <main className="container max-w-4xl mx-auto px-4 pt-24 pb-12">
        <div className="mb-6">
          <Button 
            variant="ghost" 
            size="sm" 
            className="mb-2"
            onClick={() => navigate("/dashboard")}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
          <h1 className="text-2xl font-bold">Virtual Account</h1>
          <p className="text-muted-foreground">Manage your dedicated virtual account for payments</p>
        </div>
        
        <Tabs defaultValue="account" value={tab} onValueChange={setTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="account">Account Info</TabsTrigger>
            <TabsTrigger value="transactions">Transactions</TabsTrigger>
            <TabsTrigger value="transfer">Transfer Money</TabsTrigger>
          </TabsList>
          
          <TabsContent value="account">
            {user.virtualAccount ? (
              <Card>
                <CardHeader>
                  <CardTitle>Your Virtual Account</CardTitle>
                  <CardDescription>
                    Use this account to receive payments directly into your CollectiPay wallet
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="p-4 border rounded-lg bg-muted/30">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground">Account Name</p>
                        <p className="text-lg font-medium">{user.name}</p>
                      </div>
                      
                      <div>
                        <p className="text-sm text-muted-foreground">Bank</p>
                        <p className="text-lg font-medium">{user.virtualAccount.bankName}</p>
                      </div>
                      
                      <div>
                        <p className="text-sm text-muted-foreground">Account Number</p>
                        <div className="flex items-center gap-2">
                          <p className="text-lg font-medium tracking-wider">{user.virtualAccount.accountNumber}</p>
                          <Button variant="ghost" size="icon" onClick={handleCopyAccount} className="h-6 w-6">
                            <Copy className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      
                      <div>
                        <p className="text-sm text-muted-foreground">Status</p>
                        <div className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-800/30 dark:text-green-500">
                          Active
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* KYC Information */}
                  <div className="border rounded-lg p-4">
                    <div className="flex justify-between items-center mb-4">
                      <div>
                        <h3 className="text-base font-medium">KYC Information</h3>
                        <p className="text-sm text-muted-foreground">
                          {user.bvn || user.nin 
                            ? "Your account is verified" 
                            : "Add your BVN or NIN to verify your account"}
                        </p>
                      </div>
                      
                      <Button 
                        onClick={() => setKycDialogOpen(true)}
                        variant={user.bvn || user.nin ? "outline" : "default"}
                      >
                        {user.bvn || user.nin ? "Update KYC" : "Add KYC"}
                      </Button>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground">BVN Status</p>
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${user.bvn ? "bg-green-500" : "bg-amber-500"}`}></div>
                          <p className="text-sm">{user.bvn ? "Verified" : "Not Provided"}</p>
                        </div>
                      </div>
                      
                      <div>
                        <p className="text-sm text-muted-foreground">NIN Status</p>
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${user.nin ? "bg-green-500" : "bg-amber-500"}`}></div>
                          <p className="text-sm">{user.nin ? "Verified" : "Not Provided"}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle>Create a Virtual Account</CardTitle>
                  <CardDescription>
                    Get a dedicated account number for receiving payments directly into your CollectiPay wallet
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex flex-col items-center justify-center p-8 border rounded-lg bg-muted/30">
                    <Building className="h-16 w-16 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-medium mb-2">No Virtual Account Yet</h3>
                    <p className="text-center text-muted-foreground mb-6">
                      Create a virtual account to receive money directly into your CollectiPay wallet
                    </p>
                    <Button onClick={handleCreateVirtualAccount} disabled={isLoading}>
                      {isLoading ? "Creating Account..." : "Create Virtual Account"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
          
          <TabsContent value="transactions">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle>Account Transactions</CardTitle>
                    <CardDescription>
                      All payments received to your virtual account
                    </CardDescription>
                  </div>
                  
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={loadTransactions} 
                    disabled={isLoading || !user.virtualAccount}
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Refresh
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {!user.virtualAccount ? (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">
                      Create a virtual account to view transactions
                    </p>
                  </div>
                ) : transactions.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">
                      No transactions found for your virtual account
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {transactions.map((transaction) => (
                      <div key={transaction.id} className="flex justify-between items-center p-4 border rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center text-green-700">
                            <ArrowDownToLine className="h-5 w-5" />
                          </div>
                          <div>
                            <p className="font-medium">{transaction.customerName || "Anonymous"}</p>
                            <p className="text-sm text-muted-foreground">
                              {formatDate(transaction.paidOn)}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-green-600">₦{transaction.amount.toLocaleString()}</p>
                          <p className="text-xs text-muted-foreground">{transaction.paymentStatus}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="transfer">
            <Card>
              <CardHeader>
                <CardTitle>Transfer Money</CardTitle>
                <CardDescription>
                  Transfer funds from your CollectiPay wallet to any bank account
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div className="p-4 border rounded-lg bg-muted/30 mb-4">
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="text-sm text-muted-foreground">Available Balance</p>
                        <p className="text-2xl font-semibold">₦{user.walletBalance?.toLocaleString() || 0}</p>
                      </div>
                      <Button 
                        onClick={() => setTransferDialogOpen(true)} 
                        disabled={!user.virtualAccount || user.walletBalance <= 0}
                      >
                        <ArrowUpFromLine className="h-4 w-4 mr-2" />
                        New Transfer
                      </Button>
                    </div>
                  </div>
                  
                  {!user.virtualAccount && (
                    <div className="flex items-center p-4 border rounded-lg bg-amber-50 text-amber-800 dark:bg-amber-900/20 dark:text-amber-500">
                      <Info className="h-5 w-5 mr-3 flex-shrink-0" />
                      <div>
                        <p className="font-medium">Virtual Account Required</p>
                        <p className="text-sm">You need to create a virtual account before you can make transfers</p>
                      </div>
                    </div>
                  )}
                  
                  {/* Transfer information section */}
                  <div className="p-4 border rounded-lg">
                    <h3 className="text-base font-medium mb-4">About Transfers</h3>
                    <div className="space-y-4 text-sm">
                      <div>
                        <p className="font-medium">Instant Transfers</p>
                        <p className="text-muted-foreground">All transfers are processed instantly during business hours</p>
                      </div>
                      <div>
                        <p className="font-medium">Daily Limits</p>
                        <p className="text-muted-foreground">Maximum transfer amount is ₦1,000,000 per day</p>
                      </div>
                      <div>
                        <p className="font-medium">Fees</p>
                        <p className="text-muted-foreground">Transfers below ₦5,000 incur a ₦10 fee. Transfers above ₦5,000 incur a ₦25 fee.</p>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
      
      {/* KYC Dialog */}
      <Dialog open={kycDialogOpen} onOpenChange={setKycDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update KYC Information</DialogTitle>
            <DialogDescription>
              Add your Bank Verification Number (BVN) or National Identification Number (NIN) to verify your account.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="bvn">BVN (Bank Verification Number)</Label>
              <Input
                id="bvn"
                value={bvn}
                onChange={(e) => setBvn(e.target.value)}
                placeholder="Enter your 11-digit BVN"
                type="text"
                maxLength={11}
              />
              <p className="text-xs text-muted-foreground">Your BVN will not be shared with third parties</p>
            </div>
            
            <div className="relative flex items-center">
              <div className="flex-grow border-t border-gray-300"></div>
              <span className="mx-4 text-sm text-muted-foreground">OR</span>
              <div className="flex-grow border-t border-gray-300"></div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="nin">NIN (National Identification Number)</Label>
              <Input
                id="nin"
                value={nin}
                onChange={(e) => setNin(e.target.value)}
                placeholder="Enter your 11-digit NIN"
                type="text"
                maxLength={11}
              />
              <p className="text-xs text-muted-foreground">Your NIN will not be shared with third parties</p>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setKycDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleUpdateKYC} disabled={isLoading}>
              {isLoading ? "Updating..." : "Update KYC"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Transfer Dialog */}
      <Dialog open={transferDialogOpen} onOpenChange={setTransferDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Transfer Money</DialogTitle>
            <DialogDescription>
              Transfer funds from your CollectiPay wallet to any bank account
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="amount">Amount (₦)</Label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-muted-foreground">₦</span>
                <Input
                  id="amount"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  type="number"
                  min="100"
                  max={user.walletBalance}
                  className="pl-8"
                />
              </div>
              <p className="text-xs text-muted-foreground">Maximum: ₦{user.walletBalance?.toLocaleString() || 0}</p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="bank">Bank</Label>
              <Select value={bankCode} onValueChange={setBankCode}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a bank" />
                </SelectTrigger>
                <SelectContent>
                  {banks.map((bank) => (
                    <SelectItem key={bank.bankCode} value={bank.bankCode}>
                      {bank.bankName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="accountNumber">Account Number</Label>
              <Input
                id="accountNumber"
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value)}
                placeholder="Enter 10-digit account number"
                type="text"
                maxLength={10}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="accountName">Account Name</Label>
              <Input
                id="accountName"
                value={accountName}
                onChange={(e) => setAccountName(e.target.value)}
                placeholder="Enter account name"
              />
              <p className="text-xs text-muted-foreground">
                In a real app, this would be auto-populated after account number verification
              </p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="narration">Narration (Optional)</Label>
              <Input
                id="narration"
                value={narration}
                onChange={(e) => setNarration(e.target.value)}
                placeholder="Payment for..."
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setTransferDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleInitiateTransfer} disabled={isLoading}>
              {isLoading ? "Processing..." : "Send Money"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      <MobileNav />
    </div>
  );
};

export default VirtualAccount;
