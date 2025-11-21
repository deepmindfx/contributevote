import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ApiService } from '@/services/supabase/apiService';
import { toast } from 'sonner';
import { ArrowLeft, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function TestTransferAPI() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any>({});
  const [accountNumber, setAccountNumber] = useState('0690000031');
  const [bankCode, setBankCode] = useState('044');

  const testGetBanks = async () => {
    setLoading(true);
    try {
      const response = await ApiService.getBanks();
      setResults((prev: any) => ({ ...prev, banks: response }));
      toast.success('Banks fetched successfully!');
    } catch (error: any) {
      toast.error(`Failed: ${error.message}`);
      setResults((prev: any) => ({ ...prev, banks: { error: error.message } }));
    } finally {
      setLoading(false);
    }
  };

  const testResolveAccount = async () => {
    setLoading(true);
    try {
      const response = await ApiService.resolveAccount(bankCode, accountNumber);
      setResults((prev: any) => ({ ...prev, account: response }));
      toast.success('Account resolved successfully!');
    } catch (error: any) {
      toast.error(`Failed: ${error.message}`);
      setResults((prev: any) => ({ ...prev, account: { error: error.message } }));
    } finally {
      setLoading(false);
    }
  };

  const testAll = async () => {
    await testGetBanks();
    await new Promise(resolve => setTimeout(resolve, 1000));
    await testResolveAccount();
  };

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <Button
            variant="ghost"
            onClick={() => navigate(-1)}
            className="mb-4"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <h1 className="text-3xl font-bold">Transfer API Test Page</h1>
          <p className="text-muted-foreground">Test the transfer edge functions</p>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Test Controls</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Bank Code</label>
                <Input
                  value={bankCode}
                  onChange={(e) => setBankCode(e.target.value)}
                  placeholder="044"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Account Number</label>
                <Input
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                  placeholder="0690000031"
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button onClick={testGetBanks} disabled={loading}>
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Test Get Banks
              </Button>
              <Button onClick={testResolveAccount} disabled={loading}>
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Test Resolve Account
              </Button>
              <Button onClick={testAll} disabled={loading} variant="default">
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Test All
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Results */}
        {results.banks && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center">
                {results.banks.error ? (
                  <XCircle className="mr-2 h-5 w-5 text-red-500" />
                ) : (
                  <CheckCircle className="mr-2 h-5 w-5 text-green-500" />
                )}
                Get Banks Result
              </CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="bg-muted p-4 rounded-lg overflow-auto max-h-96 text-xs">
                {JSON.stringify(results.banks, null, 2)}
              </pre>
            </CardContent>
          </Card>
        )}

        {results.account && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center">
                {results.account.error ? (
                  <XCircle className="mr-2 h-5 w-5 text-red-500" />
                ) : (
                  <CheckCircle className="mr-2 h-5 w-5 text-green-500" />
                )}
                Resolve Account Result
              </CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="bg-muted p-4 rounded-lg overflow-auto max-h-96 text-xs">
                {JSON.stringify(results.account, null, 2)}
              </pre>
            </CardContent>
          </Card>
        )}

        {/* Environment Info */}
        <Card>
          <CardHeader>
            <CardTitle>Environment Info</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="font-medium">Use Supabase:</span>
                <span className={import.meta.env.VITE_USE_SUPABASE === 'true' ? 'text-green-600' : 'text-red-600'}>
                  {import.meta.env.VITE_USE_SUPABASE || 'false'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium">Supabase URL:</span>
                <span className="text-muted-foreground truncate max-w-xs">
                  {import.meta.env.VITE_SUPABASE_URL || 'Not set'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium">Anon Key:</span>
                <span className="text-muted-foreground">
                  {import.meta.env.VITE_SUPABASE_ANON_KEY ? '✓ Set' : '✗ Not set'}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
