
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Copy, RefreshCw } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useReservedAccount } from "@/hooks/useReservedAccount";
import IdFormDialog from "./IdFormDialog";
import AccountDetailsList from "./AccountDetailsList";

export interface IdFormData {
  idType: "bvn" | "nin";
  idNumber: string;
}

const ReservedAccount = () => {
  const {
    loading,
    error,
    reservedAccount,
    hasReservedAccount,
    showFullDetails,
    setShowFullDetails,
    showIdForm,
    setShowIdForm,
    form,
    handleCreateAccount,
    handleRefresh,
    copyToClipboard,
    onSubmitIdForm,
  } = useReservedAccount();

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="text-lg font-semibold">Bank Account</CardTitle>
        <CardDescription>Your dedicated CollectiPay account for receiving funds</CardDescription>
      </CardHeader>

      <CardContent>
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {!hasReservedAccount ? (
          <div className="space-y-4">
            <div className="text-center py-8">
              <div className="bg-muted/30 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="28"
                  height="28"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-muted-foreground"
                >
                  <path d="M18 3v4c0 2-2 4-4 4H4a2 2 0 0 1-2-2V5c0-1.1.9-2 2-2h14Z" />
                  <path d="M18 15v4c0 1.1-.9 2-2 2H4a2 2 0 0 1-2-2v-4c0-1.1.9-2 2-2h12c1.1 0 2 .9 2 2Z" />
                  <path d="M22 9v8c0 1.1-.9 2-2 2h-2V7h2c1.1 0 2 .9 2 2Z" />
                  <path d="M6 7v12" />
                  <path d="M2 9h20" />
                  <path d="M2 15h8" />
                </svg>
              </div>
              <h3 className="text-lg font-medium">No Bank Account Yet</h3>
              <p className="text-muted-foreground text-sm mt-1">
                Create your dedicated account to receive deposits
              </p>
            </div>
            
            <Button 
              onClick={handleCreateAccount} 
              className="w-full bg-green-600 hover:bg-green-700"
              disabled={loading}
            >
              {loading ? 
                <div className="flex items-center">
                  <div className="animate-spin mr-2 h-4 w-4 border-t-2 border-b-2 border-current rounded-full"></div>
                  Creating...
                </div> : 
                'Create Bank Account'
              }
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-muted/30 p-4 rounded-lg">
              <div className="flex items-center justify-between mb-1">
                <div className="text-sm text-muted-foreground">Account Number</div>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-6 px-2"
                  onClick={() => copyToClipboard(reservedAccount?.accountNumber || '', 'Account number')}
                >
                  <Copy className="h-3 w-3 mr-1" />
                  <span className="text-xs">Copy</span>
                </Button>
              </div>
              <div className="text-xl font-mono font-medium tracking-wider">
                {reservedAccount?.accountNumber || 'N/A'}
              </div>
            </div>
            
            <div className="bg-muted/30 p-4 rounded-lg">
              <div className="flex items-center justify-between mb-1">
                <div className="text-sm text-muted-foreground">Bank Name</div>
              </div>
              <div className="font-medium">
                {reservedAccount?.bankName || 'N/A'}
              </div>
            </div>
            
            {showFullDetails ? (
              <AccountDetailsList 
                reservedAccount={reservedAccount} 
                copyToClipboard={copyToClipboard} 
              />
            ) : null}
            
            <div className="flex flex-col space-y-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setShowFullDetails(!showFullDetails)}
              >
                {showFullDetails ? 'Hide Details' : 'Show Full Details'}
              </Button>
              
              <Button 
                variant="outline" 
                size="sm"
                className="flex items-center"
                onClick={handleRefresh}
                disabled={loading}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                {loading ? 'Refreshing...' : 'Refresh Details'}
              </Button>
            </div>
          </div>
        )}
      </CardContent>

      <IdFormDialog 
        open={showIdForm} 
        onClose={() => setShowIdForm(false)}
        form={form}
        onSubmit={onSubmitIdForm}
        loading={loading}
      />
    </Card>
  );
};

export default ReservedAccount;
