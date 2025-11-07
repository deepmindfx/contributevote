import { Link } from "react-router-dom";
import { Clock, PlusCircle, SendHorizontal, UserPlus, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CreditCard, Wallet, Building } from "lucide-react";
import { User } from "@/services/localStorage/types";
import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { WalletService, ReservedAccountData } from "@/services/supabase/walletService";
import { toast } from "sonner";

interface WalletActionsProps {
  setIsDepositOpen: (value: boolean) => void;
  isDepositOpen: boolean;
  setIsWithdrawOpen: (value: boolean) => void;
  isWithdrawOpen: boolean;
  amount: string;
  setAmount: (value: string) => void;
  handleDeposit: (e: React.MouseEvent<Element, MouseEvent>) => void;
  handleWithdraw: (e: React.MouseEvent<Element, MouseEvent>) => void;
  depositMethod: "manual" | "card" | "bank";
  setDepositMethod: (value: "manual" | "card" | "bank") => void;
  isProcessingDeposit: boolean;
  currencyType: "NGN" | "USD";
  user: User | null;
  setShowHistory: (value: boolean) => void;
}

const WalletActions = ({
  setIsDepositOpen,
  isDepositOpen,
  setIsWithdrawOpen,
  isWithdrawOpen,
  amount,
  setAmount,
  handleDeposit,
  handleWithdraw,
  depositMethod,
  setDepositMethod,
  isProcessingDeposit,
  currencyType,
  user,
  setShowHistory,
}: WalletActionsProps) => {
  const navigate = useNavigate();
  const [accountDetails, setAccountDetails] = useState<ReservedAccountData | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  
  // Fetch virtual account when dialog opens
  useEffect(() => {
    const loadAccountData = async () => {
      if (isDepositOpen && user?.id) {
        const existingAccount = await WalletService.getVirtualAccount(user.id);
        if (existingAccount) {
          setAccountDetails(existingAccount);
        }
      }
    };
    
    loadAccountData();
  }, [isDepositOpen, user?.id]);
  
  // Copy to clipboard function
  const copyToClipboard = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      toast.success(`${field} copied!`);
      setTimeout(() => setCopiedField(null), 2000);
    } catch (err) {
      toast.error("Failed to copy");
    }
  };
  
  // Copy all account details
  const copyAllDetails = async () => {
    if (!accountDetails) return;
    
    const allDetails = `Bank Name: ${accountDetails.bankName}\nAccount Number: ${accountDetails.accountNumber}\nAccount Name: ${accountDetails.accountName}`;
    
    try {
      await navigator.clipboard.writeText(allDetails);
      toast.success("All details copied!");
    } catch (err) {
      toast.error("Failed to copy");
    }
  };
  
  return (
    <div className="bg-white dark:bg-black/40 rounded-t-3xl -mt-3 overflow-hidden">
      <div className="grid grid-cols-4 gap-1 pt-2 px-4">
        <Dialog open={isDepositOpen} onOpenChange={setIsDepositOpen}>
          <DialogTrigger asChild>
            <div className="flex flex-col items-center justify-center p-3 hover:bg-muted/50 cursor-pointer rounded-lg transition-colors">
              <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center text-[#2DAE75] mb-1">
                <PlusCircle size={20} />
              </div>
              <span className="text-xs">Top Up</span>
            </div>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Top Up Wallet</DialogTitle>
              <DialogDescription>
                Transfer money to your virtual account to fund your wallet.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              {accountDetails ? (
                <div className="space-y-3">
                  <div className="p-4 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg">
                    <div className="flex justify-between items-center mb-3">
                      <p className="font-semibold text-green-900 dark:text-green-100">Transfer to this account:</p>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={copyAllDetails}
                        className="h-7 text-xs"
                      >
                        <Copy className="h-3 w-3 mr-1" />
                        Copy All
                      </Button>
                    </div>
                    <div className="space-y-3">
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Bank Name</p>
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-medium">{accountDetails.bankName}</p>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => copyToClipboard(accountDetails.bankName, "Bank name")}
                            className="h-7 w-7 p-0"
                          >
                            {copiedField === "Bank name" ? (
                              <Check className="h-3 w-3 text-green-600" />
                            ) : (
                              <Copy className="h-3 w-3" />
                            )}
                          </Button>
                        </div>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Account Number</p>
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-mono text-lg font-bold">{accountDetails.accountNumber}</p>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => copyToClipboard(accountDetails.accountNumber, "Account number")}
                            className="h-7 w-7 p-0"
                          >
                            {copiedField === "Account number" ? (
                              <Check className="h-3 w-3 text-green-600" />
                            ) : (
                              <Copy className="h-3 w-3" />
                            )}
                          </Button>
                        </div>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Account Name</p>
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-medium">{accountDetails.accountName}</p>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => copyToClipboard(accountDetails.accountName, "Account name")}
                            className="h-7 w-7 p-0"
                          >
                            {copiedField === "Account name" ? (
                              <Check className="h-3 w-3 text-green-600" />
                            ) : (
                              <Copy className="h-3 w-3" />
                            )}
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg">
                    <div className="text-blue-600 dark:text-blue-400 mt-0.5">ℹ️</div>
                    <p className="text-sm text-blue-900 dark:text-blue-100">
                      Transfer any amount to this account and your wallet will be credited automatically within minutes.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    You need to set up a virtual account first to receive bank transfers.
                  </p>
                  <Button 
                    onClick={() => {
                      setIsDepositOpen(false);
                      navigate("/dashboard");
                    }}
                    className="w-full"
                  >
                    Set Up Virtual Account
                  </Button>
                </div>
              )}
            </div>
            
            <DialogFooter>
              <Button 
                className="w-full" 
                onClick={e => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsDepositOpen(false);
                }} 
                type="button"
              >
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        
        {/* Send button */}
        <div 
          className="flex flex-col items-center justify-center p-3 hover:bg-muted/50 cursor-pointer rounded-lg transition-colors" 
          onClick={() => navigate("/transfer")}
        >
          <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center text-[#2DAE75] mb-1">
            <SendHorizontal size={20} />
          </div>
          <span className="text-xs">Send</span>
        </div>
        
        {/* Create Group button */}
        <div 
          className="flex flex-col items-center justify-center p-3 hover:bg-muted/50 cursor-pointer rounded-lg transition-colors" 
          onClick={() => navigate("/create-group")}
        >
          <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center text-[#2DAE75] mb-1">
            <UserPlus size={20} />
          </div>
          <span className="text-xs">Group</span>
        </div>
        
        {/* History button */}
        <div 
          className="flex flex-col items-center justify-center p-3 hover:bg-muted/50 cursor-pointer rounded-lg transition-colors" 
          onClick={() => setShowHistory(true)}
        >
          <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center text-[#2DAE75] mb-1">
            <Clock size={20} />
          </div>
          <span className="text-xs">History</span>
        </div>
      </div>
    </div>
  );
};

export default WalletActions;