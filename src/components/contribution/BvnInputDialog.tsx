import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertCircle, Shield } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface BvnInputDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (bvn: string) => void;
  isLoading?: boolean;
  initialBvn?: string | null; // Optional pre-filled BVN from user profile
}

export function BvnInputDialog({ 
  open, 
  onOpenChange, 
  onSubmit,
  isLoading = false,
  initialBvn = null
}: BvnInputDialogProps) {
  const [bvn, setBvn] = useState(initialBvn || '');
  const [error, setError] = useState('');

  // Update BVN when initialBvn changes
  useState(() => {
    if (initialBvn) {
      setBvn(initialBvn);
    }
  }, [initialBvn]);

  const validateBvn = (value: string) => {
    if (!value.trim()) {
      return 'BVN is required';
    }
    if (value.length !== 11) {
      return 'BVN must be 11 digits';
    }
    if (!/^\d+$/.test(value)) {
      return 'BVN must contain only numbers';
    }
    return '';
  };

  const handleSubmit = () => {
    const validationError = validateBvn(bvn);
    if (validationError) {
      setError(validationError);
      return;
    }
    onSubmit(bvn);
  };

  const handleBvnChange = (value: string) => {
    // Only allow numbers and limit to 11 digits
    const cleaned = value.replace(/\D/g, '').slice(0, 11);
    setBvn(cleaned);
    if (error) {
      setError('');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            Setup Bank Account
          </DialogTitle>
          <DialogDescription>
            {initialBvn 
              ? "We'll use your saved BVN to create a dedicated bank account for this group"
              : "Enter your BVN to create a dedicated bank account for this group"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {initialBvn ? (
            // Show that BVN is already available
            <Alert className="bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800">
              <AlertCircle className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-xs text-green-800 dark:text-green-200">
                <strong>BVN Retrieved from Your Profile</strong>
                <p className="mt-1">Your saved BVN (ending in ****{bvn.slice(-4)}) will be used.</p>
              </AlertDescription>
            </Alert>
          ) : (
            // Show input field if BVN doesn't exist
            <>
              <div className="space-y-2">
                <Label htmlFor="bvn">Bank Verification Number (BVN)</Label>
                <Input
                  id="bvn"
                  type="text"
                  inputMode="numeric"
                  placeholder="Enter 11-digit BVN"
                  value={bvn}
                  onChange={(e) => handleBvnChange(e.target.value)}
                  maxLength={11}
                  className={error ? 'border-red-500' : ''}
                  disabled={isLoading}
                />
                {error && (
                  <p className="text-sm text-red-500">{error}</p>
                )}
              </div>

              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  <strong>Why we need your BVN:</strong>
                  <ul className="list-disc list-inside mt-1 space-y-1">
                    <li>Required by Flutterwave to create a virtual account</li>
                    <li>Used for identity verification only</li>
                    <li>Your BVN will be saved to your profile for future use</li>
                    <li>Never shared with third parties</li>
                  </ul>
                </AlertDescription>
              </Alert>
            </>
          )}

          <Alert className="bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-900">
            <AlertCircle className="h-4 w-4 text-blue-600" />
            <AlertDescription className="text-xs text-blue-900 dark:text-blue-200">
              <strong>Don't know your BVN?</strong> Dial <strong>*565*0#</strong> from your registered phone number to retrieve it.
            </AlertDescription>
          </Alert>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isLoading || !bvn}
            className="bg-green-600 hover:bg-green-700"
          >
            {isLoading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2" />
                Creating...
              </>
            ) : (
              'Create Account'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
