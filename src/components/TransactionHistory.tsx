import { useState, useEffect } from 'react';
import { formatCurrency } from '@/lib/utils';
import { ArrowLeft, Download, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import html2canvas from 'html2canvas';

interface Transaction {
  id: string;
  reference: string;
  amount: number;
  fee: number;
  status: string;
  createdAt: string;
  recipientName: string;
  recipientAccount: string;
  bankName: string;
  narration?: string;
}

export default function TransactionHistory() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [isGeneratingReceipt, setIsGeneratingReceipt] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Load transactions from localStorage
    const loadTransactions = () => {
      const storedTransactions = JSON.parse(localStorage.getItem('transactions') || '[]');
      setTransactions(storedTransactions);
      setIsLoading(false);
    };

    loadTransactions();
  }, []);

  const generateReceipt = async (transaction: Transaction) => {
    setIsGeneratingReceipt(true);
    try {
      const receiptElement = document.getElementById('transfer-receipt');
      if (!receiptElement) return;

      const canvas = await html2canvas(receiptElement, {
        scale: 2,
        backgroundColor: '#ffffff',
        logging: false
      });

      const imgData = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = `transfer-receipt-${transaction.reference}.png`;
      link.href = imgData;
      link.click();
    } catch (error) {
      console.error('Error generating receipt:', error);
    } finally {
      setIsGeneratingReceipt(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'SUCCESSFUL':
        return 'bg-green-100 text-green-800';
      case 'FAILED':
        return 'bg-red-100 text-red-800';
      case 'NEW':
      case 'PENDING':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (selectedTransaction) {
    return (
      <div className="flex flex-col h-full bg-background">
        <div className="flex items-center p-4 border-b">
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => setSelectedTransaction(null)}
            className="mr-2"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-semibold flex-1 text-center pr-8">Transaction Details</h1>
        </div>
        
        <div className="flex-1 p-4 overflow-auto max-w-md mx-auto w-full">
          <div className="bg-white rounded-lg shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-medium">Transfer Receipt</h3>
              <Button
                variant="outline"
                size="sm"
                onClick={() => generateReceipt(selectedTransaction)}
                disabled={isGeneratingReceipt}
              >
                <Download className="h-4 w-4 mr-2" />
                {isGeneratingReceipt ? 'Generating...' : 'Download Receipt'}
              </Button>
            </div>
            
            <div id="transfer-receipt" className="p-6 border rounded-lg bg-white">
              {/* Receipt Header */}
              <div className="text-center mb-6">
                <img src="/logo.png" alt="Logo" className="h-12 mx-auto mb-4" />
                <h2 className="text-2xl font-bold text-gray-800">Transfer Receipt</h2>
                <p className="text-sm text-gray-500 mt-1">Transaction {selectedTransaction.status}</p>
              </div>

              {/* Transaction Details */}
              <div className="space-y-4 mb-6">
                <div className="flex justify-between items-center pb-2 border-b">
                  <span className="text-gray-600">Transaction ID</span>
                  <span className="font-medium">{selectedTransaction.id}</span>
                </div>
                <div className="flex justify-between items-center pb-2 border-b">
                  <span className="text-gray-600">Reference</span>
                  <span className="font-medium">{selectedTransaction.reference}</span>
                </div>
                <div className="flex justify-between items-center pb-2 border-b">
                  <span className="text-gray-600">Date & Time</span>
                  <span className="font-medium">{new Date(selectedTransaction.createdAt).toLocaleString('en-NG')}</span>
                </div>
              </div>

              {/* Recipient Details */}
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-gray-700 mb-2">Recipient Details</h3>
                <div className="bg-gray-50 p-3 rounded-lg">
                  <p className="font-medium">{selectedTransaction.recipientName}</p>
                  <p className="text-sm text-gray-600">{selectedTransaction.recipientAccount}</p>
                  <p className="text-sm text-gray-600">{selectedTransaction.bankName}</p>
                </div>
              </div>

              {/* Transaction Summary */}
              <div className="space-y-3 mb-6">
                <div className="flex justify-between items-center pb-2 border-b">
                  <span className="text-gray-600">Amount</span>
                  <span className="font-medium text-[#2DAE75]">{formatCurrency(selectedTransaction.amount)}</span>
                </div>
                <div className="flex justify-between items-center pb-2 border-b">
                  <span className="text-gray-600">Fee</span>
                  <span className="font-medium">₦ {selectedTransaction.fee?.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center pb-2 border-b">
                  <span className="text-gray-600">Total</span>
                  <span className="font-medium">₦ {(selectedTransaction.amount + (selectedTransaction.fee || 0)).toFixed(2)}</span>
                </div>
              </div>

              {/* Status */}
              <div className="text-center">
                <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(selectedTransaction.status)}`}>
                  {selectedTransaction.status}
                </span>
              </div>

              {/* Footer */}
              <div className="mt-6 text-center text-sm text-gray-500">
                <p>Thank you for using our service</p>
                <p className="mt-1">This is a computer-generated receipt</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="flex items-center p-4 border-b">
        <Button 
          variant="ghost" 
          size="icon"
          onClick={() => navigate(-1)}
          className="mr-2"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-lg font-semibold flex-1 text-center pr-8">Transaction History</h1>
      </div>
      
      <div className="flex-1 p-4 overflow-auto">
        <div className="max-w-4xl mx-auto">
          {isLoading ? (
            <div className="flex justify-center items-center h-32">
              <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
            </div>
          ) : transactions.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500">No transactions found</p>
            </div>
          ) : (
            <div className="space-y-4">
              {transactions.map((transaction) => (
                <div
                  key={transaction.reference}
                  className="bg-white rounded-lg shadow-sm p-4 cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => setSelectedTransaction(transaction)}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-medium">{transaction.recipientName}</h3>
                      <p className="text-sm text-gray-500">{transaction.recipientAccount} - {transaction.bankName}</p>
                      <p className="text-sm text-gray-500 mt-1">{new Date(transaction.createdAt).toLocaleString('en-NG')}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-[#2DAE75]">{formatCurrency(transaction.amount)}</p>
                      <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium mt-1 ${getStatusColor(transaction.status)}`}>
                        {transaction.status}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 