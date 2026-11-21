import { Link } from "react-router-dom";
import { Building2, Clock, Plus, SendHorizontal, UserPlus, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CreditCard, Wallet, Building } from "lucide-react";
import { Database } from "@/integrations/supabase/types";
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
  user: Database['public']['Tables']['profiles']['Row'] | null;
  setShowHistory: (value: boolean) => void;
  onOpenBankAccount?: () => void;
  showQuickActions?: boolean;
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
  onOpenBankAccount,
  showQuickActions,
}: WalletActionsProps) => {
  const navigate = useNavigate();
  const [isAccountLoading, setIsAccountLoading] = useState(isDepositOpen);
  const [accountDetails, setAccountDetails] = useState<ReservedAccountData | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  
  useEffect(() => {
    if (!isDepositOpen || !user?.id) return;
    let active = true;
    setIsAccountLoading(true);
    void WalletService.getVirtualAccount(user.id).then((account) => {
      if (!active) return;
      setAccountDetails(account);
      setIsAccountLoading(false);
    });
    return () => { active = false; };
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
    <div className={showQuickActions ? "dashboard-quick-actions" : "bg-card"}>
      {showQuickActions && <h3 className="dashboard-quick-title">Quick actions</h3>}
      <div className="wallet-actions-grid grid grid-cols-2 gap-2 p-3 sm:p-4">
        <Dialog open={isDepositOpen} onOpenChange={setIsDepositOpen}>
          <DialogTrigger asChild>
            <button type="button" className="wallet-action wallet-primary-action" onClick={() => setIsAccountLoading(true)}>
              <Plus size={19} aria-hidden="true" />
              <span>Add money</span>
            </button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Top Up Wallet</DialogTitle>
              <DialogDescription>
                Transfer money to your virtual account to fund your wallet.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              {isAccountLoading ? (
                <p className="text-sm text-muted-foreground" role="status">Loading bank details…</p>
              ) : accountDetails ? (
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
                      if (onOpenBankAccount) {
                        onOpenBankAccount();
                      } else {
                        setIsDepositOpen(false);
                        navigate("/dashboard");
                      }
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
        
        <Link className="wallet-action wallet-send-action" to="/transfer">
          <SendHorizontal size={17} aria-hidden="true" />
          <span>Send</span>
        </Link>
        {onOpenBankAccount ? (
          <button className="wallet-action" type="button" onClick={onOpenBankAccount}>
            <Building2 size={17} aria-hidden="true" />
            <span>Bank account</span>
          </button>
        ) : (
          <Link className="wallet-action" to="/create-group">
            <UserPlus size={17} aria-hidden="true" />
            <span>New group</span>
          </Link>
        )}
        <button className="wallet-action" type="button" onClick={() => setShowHistory(true)}>
          <Clock size={17} aria-hidden="true" />
          <span>History</span>
        </button>
      </div>
    </div>
  );
};

export default WalletActions;
