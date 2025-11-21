
import React from 'react';
import { Check, CreditCard, Share2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ReceiptData {
  refNumber: string;
  paymentTime: string;
  paymentMethod: string;
  senderName: string;
  amount: string;
  currency: string;
  groupName?: string;
  description?: string;
}

interface ModernReceiptProps {
  data: ReceiptData;
  onDownload?: () => void;
}

export const ModernReceipt = React.forwardRef<HTMLDivElement, ModernReceiptProps>(
  ({ data }, ref) => {
    return (
      <div ref={ref} className="w-full bg-white text-slate-900 rounded-3xl overflow-hidden shadow-2xl font-sans relative">
        {/* Top decorative circle */}
        <div className="absolute -top-20 -left-20 w-40 h-40 bg-primary/5 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-20 -right-20 w-40 h-40 bg-blue-500/5 rounded-full blur-3xl"></div>

        {/* Header Section */}
        <div className="bg-slate-50 p-8 text-center border-b border-dashed border-slate-200 relative">
          {/* Punch holes */}
          <div className="absolute -bottom-3 -left-3 w-6 h-6 bg-transparent rounded-full z-10"></div>
          <div className="absolute -bottom-3 -right-3 w-6 h-6 bg-transparent rounded-full z-10"></div>

          <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4 ring-8 ring-green-50">
            <Check className="w-8 h-8 text-green-600" strokeWidth={3} />
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">Payment Success</h2>
          <p className="text-slate-500 text-sm mt-1">Receipt #{data.refNumber.slice(-8)}</p>
        </div>

        {/* Amount Section */}
        <div className="p-8 pb-0 text-center">
          <p className="text-sm font-medium text-slate-400 uppercase tracking-wider">Total Amount</p>
          <div className="mt-2 flex items-baseline justify-center gap-1">
            <span className="text-2xl font-medium text-slate-400">{data.currency}</span>
            <span className="text-5xl font-extrabold tracking-tight text-slate-900">{data.amount}</span>
          </div>
          {data.groupName && (
            <div className="mt-2 inline-block px-3 py-1 bg-slate-100 rounded-full text-xs font-medium text-slate-600">
              For {data.groupName}
            </div>
          )}
        </div>

        {/* Details Section */}
        <div className="p-8 space-y-4">
          <div className="space-y-4">
            <div className="flex justify-between items-center py-3 border-b border-slate-100">
              <span className="text-slate-500 text-sm">Payment Date</span>
              <span className="font-semibold text-slate-900 text-sm">{data.paymentTime.split(',')[0]}</span>
            </div>
            <div className="flex justify-between items-center py-3 border-b border-slate-100">
              <span className="text-slate-500 text-sm">Time</span>
              <span className="font-semibold text-slate-900 text-sm">{data.paymentTime.split(',')[1]}</span>
            </div>
            <div className="flex justify-between items-center py-3 border-b border-slate-100">
              <span className="text-slate-500 text-sm">Payment Method</span>
              <div className="flex items-center gap-2">
                <CreditCard className="w-3.5 h-3.5 text-slate-400" />
                <span className="font-semibold text-slate-900 text-sm capitalize">{data.paymentMethod}</span>
              </div>
            </div>
            <div className="flex justify-between items-center py-3 border-b border-slate-100">
              <span className="text-slate-500 text-sm">Sender</span>
              <span className="font-semibold text-slate-900 text-sm">{data.senderName}</span>
            </div>
            <div className="flex justify-between items-center py-3">
              <span className="text-slate-500 text-sm">Reference ID</span>
              <span className="font-mono text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded">{data.refNumber}</span>
            </div>
          </div>
        </div>

        {/* Footer Section */}
        <div className="bg-slate-900 p-4 text-center">
          <div className="flex items-center justify-center gap-2 text-slate-400 text-xs">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            Verified Transaction by Collectipay
          </div>
        </div>
      </div>
    );
  }
);

ModernReceipt.displayName = 'ModernReceipt';

// Re-export hook remains the same
export { useReceiptDownload } from './ModernReceiptHook';
