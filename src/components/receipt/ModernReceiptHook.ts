
import { useRef } from 'react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

export const useReceiptDownload = (receiptRef: React.RefObject<HTMLDivElement>) => {
  const generateCanvas = async () => {
    if (!receiptRef.current) {
      throw new Error('Receipt element not found');
    }

    const receiptElement = receiptRef.current;
    // Hide any buttons inside the receipt if they exist (though our new design keeps them outside)
    const buttonContainer = receiptElement.querySelector<HTMLElement>(
      '#download-button-container'
    );

    if (buttonContainer) {
      buttonContainer.style.display = 'none';
    }

    try {
      const canvas = await html2canvas(receiptElement, {
        backgroundColor: null, // Transparent background for better PNGs
        useCORS: true,
        scale: 3, // Higher scale for crisp text
        logging: false,
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
      link.download = `receipt-${Date.now()}.png`;
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
      const imgData = canvas.toDataURL('image/jpeg', 1.0); // High quality JPEG
      const pdfWidth = 210;
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: [pdfWidth, pdfHeight],
      });
      pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`receipt-${Date.now()}.pdf`);
    } catch (error) {
      console.error('Error generating receipt PDF:', error);
      throw error;
    }
  };

  return { downloadAsImage, downloadAsPDF };
};

