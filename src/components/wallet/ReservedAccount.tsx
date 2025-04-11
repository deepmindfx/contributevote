
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Clipboard, RefreshCw, Plus } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import IdFormDialog from "@/components/wallet/IdFormDialog";
import AccountDetailsList from "@/components/wallet/AccountDetailsList";
import { useReservedAccount } from "@/hooks/useReservedAccount";

const ReservedAccount = () => {
  const {
    isLoading,
    accountDetails,
    showFullDetails,
    setShowFullDetails,
    showIdForm,
    setShowIdForm,
    form,
    handleCreateAccount,
    handleRefresh,
    copyToClipboard,
    onSubmitIdForm
  } = useReservedAccount();

  if (!accountDetails) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Virtual Account</CardTitle>
          <CardDescription>
            Create a dedicated virtual account for easy deposits
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center py-8">
          {isLoading ? (
            <div className="space-y-3 w-full">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-10 w-32 mx-auto" />
            </div>
          ) : (
            <>
              <div className="text-center mb-6">
                <p className="text-muted-foreground mb-3">
                  You don't have a virtual account yet. Create one to easily fund your wallet from any bank.
                </p>
              </div>
              <Button 
                onClick={() => handleCreateAccount()} 
                className="flex items-center gap-2"
              >
                <Plus size={16} />
                Create Virtual Account
              </Button>
              
              {/* BVN/NIN Input Dialog */}
              <Dialog open={showIdForm} onOpenChange={setShowIdForm}>
                <IdFormDialog 
                  form={form}
                  onSubmit={onSubmitIdForm}
                  isLoading={isLoading}
                  onClose={() => setShowIdForm(false)}
                />
              </Dialog>
            </>
          )}
        </CardContent>
      </Card>
    );
  }
  
  // Display account details
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between pb-2">
        <div>
          <CardTitle>Virtual Account</CardTitle>
          <CardDescription>
            Fund your wallet directly from any bank
          </CardDescription>
        </div>
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={handleRefresh} 
          disabled={isLoading}
          className="h-8 w-8"
        >
          <RefreshCw size={16} className={isLoading ? "animate-spin" : ""} />
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-6 w-36" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-sm font-medium text-muted-foreground">Account Number</label>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => copyToClipboard(accountDetails.accountNumber, "Account number")}
                  className="h-6 px-2"
                >
                  <Clipboard size={14} />
                </Button>
              </div>
              <div className="font-mono text-xl bg-muted/50 rounded-md py-2 px-3 flex items-center justify-between">
                {accountDetails.accountNumber || (accountDetails.accounts && accountDetails.accounts.length > 0 
                  ? accountDetails.accounts[0].accountNumber 
                  : "Pending...")}
              </div>
            </div>
            
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-sm font-medium text-muted-foreground">Bank Name</label>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => copyToClipboard(accountDetails.bankName, "Bank name")}
                  className="h-6 px-2"
                >
                  <Clipboard size={14} />
                </Button>
              </div>
              <div className="font-medium text-lg bg-muted/50 rounded-md py-2 px-3">
                {accountDetails.bankName || (accountDetails.accounts && accountDetails.accounts.length > 0 
                  ? accountDetails.accounts[0].bankName 
                  : "Pending...")}
              </div>
            </div>
            
            <div className="pt-1">
              <label className="text-sm font-medium text-muted-foreground block mb-1">Account Name</label>
              <div className="font-medium text-lg">
                {accountDetails.accountName || "Pending..."}
              </div>
            </div>
            
            <div className="flex gap-2">
              {!showFullDetails && accountDetails.accounts && accountDetails.accounts.length > 1 && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="flex-1 mt-2" 
                  onClick={() => setShowFullDetails(true)}
                >
                  Show All Bank Accounts
                </Button>
              )}
            </div>
            
            <Dialog open={showFullDetails} onOpenChange={setShowFullDetails}>
              <AccountDetailsList 
                accounts={accountDetails.accounts || []} 
                onClose={() => setShowFullDetails(false)} 
              />
            </Dialog>
            
            <p className="text-sm text-muted-foreground mt-2">
              Transfer to this account from any bank and your wallet will be credited automatically.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ReservedAccount;
