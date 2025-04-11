
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogFooter,
  DialogClose
} from '@/components/ui/dialog';
import { Copy, RefreshCw, Plus, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { useApp } from '@/contexts/AppContext';
import { useReservedAccount } from '@/hooks/useReservedAccount';
import IdFormDialog from './IdFormDialog';
import { useForm } from 'react-hook-form';

// Define the interface for IdFormData here to be used in this component
export interface IdFormData {
  idType: "bvn" | "nin";
  idNumber: string;
}

const ReservedAccount = () => {
  const { user } = useApp();
  const { reservedAccount, loading, error, handleRefresh, createAccount, handleCreateAccount, setShowIdForm, showIdForm, onSubmitIdForm, form } = useReservedAccount();
  const [copySuccess, setCopySuccess] = useState(false);

  const handleCopyAccountNumber = () => {
    if (reservedAccount?.accountNumber) {
      navigator.clipboard.writeText(reservedAccount.accountNumber)
        .then(() => {
          setCopySuccess(true);
          toast.success('Account number copied!');
          setTimeout(() => setCopySuccess(false), 2000);
        })
        .catch(() => {
          toast.error('Failed to copy account number');
        });
    }
  };

  return (
    <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
      <div className="flex flex-col space-y-1.5 p-6">
        <h3 className="text-2xl font-semibold leading-none tracking-tight">Reserved Account</h3>
        <p className="text-sm text-muted-foreground">Your dedicated account for deposits</p>
      </div>
      <div className="p-6 pt-0">
        {error ? (
          <div className="flex flex-col items-center justify-center text-center py-6">
            <AlertTriangle className="h-12 w-12 text-amber-500 mb-2" />
            <h3 className="font-medium text-lg mb-1">Account Unavailable</h3>
            <p className="text-sm text-muted-foreground mb-4">{error}</p>
            <Button onClick={handleCreateAccount}>
              <Plus className="mr-2 h-4 w-4" />
              Set Up Account
            </Button>
          </div>
        ) : loading ? (
          <div className="flex flex-col items-center justify-center py-6">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4"></div>
            <p className="text-sm text-muted-foreground">Loading your account information...</p>
          </div>
        ) : reservedAccount ? (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <Label className="text-sm font-medium">Account Name</Label>
                <p className="text-md font-medium">{reservedAccount.accountName}</p>
              </div>
              <Button variant="outline" size="icon" onClick={handleRefresh} title="Refresh Account">
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>

            <div className="space-y-1">
              <Label className="text-sm font-medium">Account Number</Label>
              <div className="flex justify-between items-center">
                <p className="text-xl font-mono font-bold">{reservedAccount.accountNumber}</p>
                <Button variant="outline" size="sm" onClick={handleCopyAccountNumber}>
                  {copySuccess ? 'Copied!' : 'Copy'}
                  <Copy className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-sm font-medium">Bank Name</Label>
              <p className="text-md">{reservedAccount.bankName}</p>
            </div>

            <div className="pt-2 text-sm">
              <p className="text-muted-foreground">
                Funds deposited to this account will appear in your wallet balance within minutes.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center text-center py-6">
            <div className="bg-muted h-12 w-12 rounded-full flex items-center justify-center mb-4">
              <Plus className="h-6 w-6 text-muted-foreground" />
            </div>
            <h3 className="font-medium text-lg mb-1">No Reserved Account</h3>
            <p className="text-sm text-muted-foreground mb-4">Set up a dedicated account for easy deposits</p>
            <Button onClick={handleCreateAccount}>
              <Plus className="mr-2 h-4 w-4" />
              Set Up Account
            </Button>
          </div>
        )}
      </div>

      <IdFormDialog 
        open={showIdForm} 
        onOpenChange={setShowIdForm}
        onSubmit={onSubmitIdForm}
        form={form}
      />
    </div>
  );
};

export default ReservedAccount;
