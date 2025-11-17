import React, { useRef } from 'react';
import { Download, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

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

const watermarkSvg = `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' width='150' height='150' viewBox='0 0 150 150'%3e%3ctext x='50%25' y='50%25' font-size='20' fill='rgba(0,0,0,0.03)' font-family='Inter, sans-serif' font-weight='800' text-anchor='middle' dominant-baseline='central' transform='rotate(-45 75 75)'%3eCollectipay%3c/text%3e%3c/svg%3e")`;

export const ModernReceipt = React.forwardRef<HTMLDivElement, ModernReceiptProps>(
  ({ data, onDownload }, ref) => {
    return (
      <div ref={ref} className="w-full max-w-sm mx-auto text-slate-800 font-sans">
        <div className="bg-white rounded-t-2xl shadow-lg" style={{ backgroundImage: watermarkSvg }}>
          <div className="p-8">
            {/* Success Icon */}
            <div className="flex flex-col items-center text-center mb-6">
              <div className="bg-white border-2 border-green-400 rounded-full p-1 mb-4">
                <div className="bg-green-400 rounded-full p-1">
                  <Check className="w-3 h-3 text-white" strokeWidth={3} />
                </div>
              </div>
              <p className="text-xl font-bold">Payment Success!</p>
              <p className="text-slate-500 text-sm mt-1">
                Your payment has been successfully done.
              </p>
            </div>

            <hr className="border-slate-200" />

            {/* Total Amount */}
            <div className="text-center my-6">
              <p className="text-slate-500 text-sm">Total Payment</p>
              <p className="text-4xl font-extrabold mt-1">
                {data.currency} {data.amount}
              </p>
            </div>

            {/* Payment Details Grid */}
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="bg-slate-100 p-3 rounded-lg text-center">
                <p className="text-slate-500 text-xs">Ref Number</p>
                <p className="font-bold mt-1 text-xs break-all">{data.refNumber}</p>
              </div>
              <div className="bg-slate-100 p-3 rounded-lg text-center">
                <p className="text-slate-500 text-xs">Payment Time</p>
                <p className="font-bold mt-1 text-xs">{data.paymentTime}</p>
              </div>
              <div className="bg-slate-100 p-3 rounded-lg text-center">
                <p className="text-slate-500 text-xs">Payment Method</p>
                <p className="font-bold mt-1 text-xs">{data.paymentMethod}</p>
              </div>
              <div className="bg-slate-100 p-3 rounded-lg text-center">
                <p className="text-slate-500 text-xs">Sender Name</p>
                <p className="font-bold mt-1 text-xs">{data.senderName}</p>
              </div>
            </div>

            {/* Group Name if provided */}
            {data.groupName && (
              <div className="mt-4 bg-slate-100 p-3 rounded-lg text-center">
                <p className="text-slate-500 text-xs">Group</p>
                <p className="font-bold mt-1 text-sm">{data.groupName}</p>
              </div>
            )}

            {/* Description if provided */}
            {data.description && (
              <div className="mt-4 bg-slate-100 p-3 rounded-lg">
                <p className="text-slate-500 text-xs mb-1">Description</p>
                <p className="text-xs">{data.description}</p>
              </div>
            )}
          </div>
        </div>

        {/* Dashed Divider with Circles */}
        <div className="relative bg-white h-10" style={{ backgroundImage: watermarkSvg }}>
          <div className="absolute inset-x-8 top-1/2 border-t-2 border-dashed border-slate-200"></div>
          <div className="absolute -top-4 left-5 w-8 h-8 bg-slate-100 rounded-full"></div>
          <div className="absolute -top-4 right-5 w-8 h-8 bg-slate-100 rounded-full"></div>
        </div>

        {/* Download Button Section */}
        <div className="bg-white shadow-lg" style={{ backgroundImage: watermarkSvg }}>
          <div id="download-button-container" className="px-8 pb-8 -mt-2">
            <Button
              onClick={onDownload}
              className="w-full flex items-center justify-center gap-2 bg-slate-100 text-slate-800 hover:bg-slate-200 py-3 rounded-lg transition-colors font-semibold"
              variant="ghost"
            >
              <Download className="w-5 h-5" />
              <span>Download Receipt</span>
            </Button>
          </div>

          {/* Bottom Scalloped Edge */}
          <div className="h-5 bg-repeat-x bg-bottom bg-[length:28px_14px] bg-[radial-gradient(circle_at_14px_-7px,theme(colors.slate.100)_14px,transparent_14.5px)]"></div>
        </div>
      </div>
    );
  }
);

ModernReceipt.displayName = 'ModernReceipt';

// Hook for downloading receipt
export const useReceiptDownload = (receiptRef: React.RefObject<HTMLDivElement>) => {
  const generateCanvas = async () => {
    if (!receiptRef.current) {
      throw new Error('Receipt element not found');
    }

    const receiptElement = receiptRef.current;
    const buttonContainer = receiptElement.querySelector<HTMLElement>(
      '#download-button-container'
    );

    if (buttonContainer) {
      buttonContainer.style.display = 'none';
    }

    try {
      const canvas = await html2canvas(receiptElement, {
        backgroundColor: '#f1f5f9',
        useCORS: true,
        scale: 2,
      });
      return canvas;
    } finally {
      if (buttonContainer) {
        buttonContainer.style.display = 'block';
      }
    }
  };

  const downloadAsImage = async () => {
    try {
      const canvas = await generateCanvas();
      const imgData = canvas.toDataURL('image/png', 1.0);
      const link = document.createElement('a');
      link.href = imgData;
      link.download = 'collectipay-receipt.png';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Error generating receipt image:', error);
      throw error;
    }
  };

  const downloadAsPDF = async () => {
    try {
      const canvas = await generateCanvas();
      const imgData = canvas.toDataURL('image/jpeg', 0.98);
      const pdfWidth = 210;
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: [pdfWidth, pdfHeight],
      });
      pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
      pdf.save('collectipay-receipt.pdf');
    } catch (error) {
      console.error('Error generating receipt PDF:', error);
      throw error;
    }
  };

  return { downloadAsImage, downloadAsPDF };
};
