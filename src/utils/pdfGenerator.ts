import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import html2canvas from 'html2canvas';

interface ContributionData {
  id: string;
  amount: number;
  description: string;
  status: string;
  payment_method: string;
  reference_id: string;
  created_at: string;
}

interface ReceiptData {
  contributorName: string;
  groupName: string;
  groupId: string;
  contributions: ContributionData[];
  totalAmount: number;
  contributionCount: number;
}

export class PDFGenerator {
  private static readonly BRAND_COLOR = '#10B981'; // Green
  private static readonly SECONDARY_COLOR = '#1E293B'; // Slate
  private static readonly LIGHT_GRAY = '#F1F5F9';

  /**
   * Generate a single contribution receipt with modern design
   */
  static generateSingleReceipt(
    contribution: ContributionData,
    contributorName: string,
    groupName: string
  ): void {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    // Background
    doc.setFillColor(241, 245, 249); // slate-100
    doc.rect(0, 0, pageWidth, pageHeight, 'F');

    // White card background
    const cardMargin = 15;
    const cardWidth = pageWidth - (cardMargin * 2);
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(cardMargin, 20, cardWidth, pageHeight - 40, 3, 3, 'F');

    // Success icon (green circle with checkmark)
    doc.setFillColor(74, 222, 128); // green-400
    doc.circle(pageWidth / 2, 40, 8, 'F');
    doc.setDrawColor(255, 255, 255);
    doc.setLineWidth(2);
    // Checkmark
    doc.line(pageWidth / 2 - 3, 40, pageWidth / 2 - 1, 42);
    doc.line(pageWidth / 2 - 1, 42, pageWidth / 2 + 3, 38);

    // Success text
    doc.setFontSize(18);
    doc.setTextColor(30, 41, 59); // slate-800
    doc.setFont('helvetica', 'bold');
    doc.text('Payment Success!', pageWidth / 2, 58, { align: 'center' });

    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139); // slate-500
    doc.setFont('helvetica', 'normal');
    doc.text('Your payment has been successfully done.', pageWidth / 2, 65, { align: 'center' });

    // Divider
    doc.setDrawColor(226, 232, 240); // slate-200
    doc.setLineWidth(0.5);
    doc.line(cardMargin + 10, 72, pageWidth - cardMargin - 10, 72);

    // Total Payment label
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text('Total Payment', pageWidth / 2, 82, { align: 'center' });

    // Amount
    doc.setFontSize(32);
    doc.setTextColor(30, 41, 59);
    doc.setFont('helvetica', 'bold');
    doc.text(`₦${contribution.amount.toLocaleString()}`, pageWidth / 2, 95, { align: 'center' });

    // Details grid
    let yPos = 108;
    const boxWidth = (cardWidth - 30) / 2;
    const boxHeight = 18;
    const gap = 5;

    // Helper function to draw detail box
    const drawDetailBox = (x: number, y: number, label: string, value: string) => {
      doc.setFillColor(241, 245, 249); // slate-100
      doc.roundedRect(x, y, boxWidth, boxHeight, 2, 2, 'F');
      
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.setFont('helvetica', 'normal');
      doc.text(label, x + boxWidth / 2, y + 6, { align: 'center' });
      
      doc.setFontSize(9);
      doc.setTextColor(30, 41, 59);
      doc.setFont('helvetica', 'bold');
      const truncatedValue = value.length > 20 ? value.substring(0, 20) + '...' : value;
      doc.text(truncatedValue, x + boxWidth / 2, y + 13, { align: 'center' });
    };

    // Row 1
    drawDetailBox(cardMargin + 10, yPos, 'Ref Number', contribution.reference_id.substring(0, 16));
    drawDetailBox(cardMargin + 10 + boxWidth + gap, yPos, 'Payment Time', 
      `${this.formatDate(contribution.created_at)}, ${this.formatTime(contribution.created_at)}`);

    // Row 2
    yPos += boxHeight + gap;
    drawDetailBox(cardMargin + 10, yPos, 'Payment Method', this.capitalizeFirst(contribution.payment_method));
    drawDetailBox(cardMargin + 10 + boxWidth + gap, yPos, 'Sender Name', contributorName);

    // Group name box (full width)
    yPos += boxHeight + gap;
    doc.setFillColor(241, 245, 249);
    doc.roundedRect(cardMargin + 10, yPos, cardWidth - 20, boxHeight, 2, 2, 'F');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text('Group', pageWidth / 2, yPos + 6, { align: 'center' });
    doc.setFontSize(10);
    doc.setTextColor(30, 41, 59);
    doc.setFont('helvetica', 'bold');
    doc.text(groupName, pageWidth / 2, yPos + 13, { align: 'center' });

    // Description if available
    if (contribution.description) {
      yPos += boxHeight + gap;
      doc.setFillColor(241, 245, 249);
      doc.roundedRect(cardMargin + 10, yPos, cardWidth - 20, 20, 2, 2, 'F');
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.setFont('helvetica', 'normal');
      doc.text('Description', cardMargin + 15, yPos + 6);
      doc.setFontSize(8);
      doc.setTextColor(30, 41, 59);
      const wrappedText = doc.splitTextToSize(contribution.description, cardWidth - 30);
      doc.text(wrappedText, cardMargin + 15, yPos + 12);
    }

    // Footer branding
    yPos = pageHeight - 25;
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184); // slate-400
    doc.setFont('helvetica', 'italic');
    doc.text('Powered by Collectipay', pageWidth / 2, yPos, { align: 'center' });
    doc.setFontSize(7);
    doc.text(`Generated on ${new Date().toLocaleString()}`, pageWidth / 2, yPos + 5, { align: 'center' });

    // Save PDF
    const fileName = `Collectipay_Receipt_${contribution.reference_id.substring(0, 12)}.pdf`;
    doc.save(fileName);
  }

  /**
   * Generate full contribution history report
   */
  static generateFullReport(data: ReceiptData): void {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();

    // Add branding header
    this.addHeader(doc, pageWidth);

    // Report title
    doc.setFontSize(18);
    doc.setTextColor(this.SECONDARY_COLOR);
    doc.text('CONTRIBUTION HISTORY REPORT', pageWidth / 2, 50, { align: 'center' });

    // Report info
    let yPos = 60;
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('Contributor:', 20, yPos);
    doc.setFont('helvetica', 'normal');
    doc.text(data.contributorName, 60, yPos);

    yPos += 7;
    doc.setFont('helvetica', 'bold');
    doc.text('Group:', 20, yPos);
    doc.setFont('helvetica', 'normal');
    doc.text(data.groupName, 60, yPos);

    yPos += 7;
    doc.setFont('helvetica', 'bold');
    doc.text('Generated:', 20, yPos);
    doc.setFont('helvetica', 'normal');
    doc.text(new Date().toLocaleString(), 60, yPos);

    // Summary box
    yPos += 15;
    doc.setFillColor(this.LIGHT_GRAY);
    doc.rect(20, yPos, pageWidth - 40, 20, 'F');

    doc.setFontSize(10);
    doc.setTextColor(this.SECONDARY_COLOR);
    doc.setFont('helvetica', 'bold');
    doc.text(`Total Contributions: ${data.contributionCount}`, 25, yPos + 8);
    doc.text(
      `Total Amount: ₦${data.totalAmount.toLocaleString()}`,
      pageWidth - 25,
      yPos + 8,
      { align: 'right' }
    );

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(100);
    doc.text(
      `Average: ₦${(data.totalAmount / data.contributionCount).toLocaleString()}`,
      25,
      yPos + 15
    );

    // Contributions table
    yPos += 30;

    const tableData = data.contributions.map((c) => [
      this.formatDate(c.created_at),
      this.formatTime(c.created_at),
      `₦${c.amount.toLocaleString()}`,
      this.capitalizeFirst(c.payment_method),
      this.capitalizeFirst(c.status),
      c.reference_id.substring(0, 16) + '...',
    ]);

    autoTable(doc, {
      startY: yPos,
      head: [['Date', 'Time', 'Amount', 'Method', 'Status', 'Reference']],
      body: tableData,
      theme: 'striped',
      headStyles: {
        fillColor: this.BRAND_COLOR,
        textColor: '#FFFFFF',
        fontStyle: 'bold',
        fontSize: 9,
      },
      bodyStyles: {
        fontSize: 8,
        textColor: this.SECONDARY_COLOR,
      },
      alternateRowStyles: {
        fillColor: this.LIGHT_GRAY,
      },
      columnStyles: {
        0: { cellWidth: 25 },
        1: { cellWidth: 20 },
        2: { cellWidth: 25, fontStyle: 'bold' },
        3: { cellWidth: 25 },
        4: { cellWidth: 20 },
        5: { cellWidth: 'auto', fontSize: 7 },
      },
      margin: { left: 20, right: 20 },
    });

    // Footer
    this.addFooter(doc, pageWidth);

    // Save PDF
    const fileName = `CollectiPay_Report_${data.groupName.replace(/\s+/g, '_')}_${Date.now()}.pdf`;
    doc.save(fileName);
  }

  /**
   * Add branded header to PDF
   */
  private static addHeader(doc: jsPDF, pageWidth: number): void {
    // Brand color bar
    doc.setFillColor(this.BRAND_COLOR);
    doc.rect(0, 0, pageWidth, 15, 'F');

    // Logo/Brand name
    doc.setFontSize(16);
    doc.setTextColor('#FFFFFF');
    doc.setFont('helvetica', 'bold');
    doc.text('CollectiPay', pageWidth / 2, 10, { align: 'center' });

    // Tagline
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text('Transparent Group Contributions', pageWidth / 2, 20, { align: 'center' });
  }

  /**
   * Add footer to PDF
   */
  private static addFooter(doc: jsPDF, pageWidth: number): void {
    const pageHeight = doc.internal.pageSize.getHeight();

    // Divider line
    doc.setDrawColor(200);
    doc.setLineWidth(0.3);
    doc.line(20, pageHeight - 25, pageWidth - 20, pageHeight - 25);

    // Footer text
    doc.setFontSize(8);
    doc.setTextColor(100);
    doc.setFont('helvetica', 'italic');
    doc.text(
      'This is an official receipt from CollectiPay',
      pageWidth / 2,
      pageHeight - 18,
      { align: 'center' }
    );
    doc.text(
      'For inquiries, visit collectipay.com or contact support@collectipay.com',
      pageWidth / 2,
      pageHeight - 13,
      { align: 'center' }
    );

    // Verification note
    doc.setFontSize(7);
    doc.text(
      `Generated on ${new Date().toLocaleString()} | Verify at collectipay.com/verify`,
      pageWidth / 2,
      pageHeight - 8,
      { align: 'center' }
    );
  }

  /**
   * Format date helper
   */
  private static formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }

  /**
   * Format time helper
   */
  private static formatTime(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  /**
   * Capitalize first letter
   */
  private static capitalizeFirst(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
  }
}
