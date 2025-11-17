import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

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
  private static readonly BRAND_COLOR = '#F97316'; // Orange
  private static readonly SECONDARY_COLOR = '#1F2937'; // Dark gray
  private static readonly LIGHT_GRAY = '#F3F4F6';

  /**
   * Generate a single contribution receipt
   */
  static generateSingleReceipt(
    contribution: ContributionData,
    contributorName: string,
    groupName: string
  ): void {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();

    // Add branding header
    this.addHeader(doc, pageWidth);

    // Receipt title
    doc.setFontSize(20);
    doc.setTextColor(this.SECONDARY_COLOR);
    doc.text('CONTRIBUTION RECEIPT', pageWidth / 2, 50, { align: 'center' });

    // Receipt number
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Receipt #: ${contribution.reference_id.substring(0, 20)}`, pageWidth / 2, 58, {
      align: 'center',
    });

    // Divider line
    doc.setDrawColor(this.BRAND_COLOR);
    doc.setLineWidth(0.5);
    doc.line(20, 65, pageWidth - 20, 65);

    // Contributor and Group Info
    let yPos = 75;
    doc.setFontSize(11);
    doc.setTextColor(this.SECONDARY_COLOR);

    doc.setFont('helvetica', 'bold');
    doc.text('Contributor:', 20, yPos);
    doc.setFont('helvetica', 'normal');
    doc.text(contributorName, 60, yPos);

    yPos += 8;
    doc.setFont('helvetica', 'bold');
    doc.text('Group:', 20, yPos);
    doc.setFont('helvetica', 'normal');
    doc.text(groupName, 60, yPos);

    yPos += 8;
    doc.setFont('helvetica', 'bold');
    doc.text('Date:', 20, yPos);
    doc.setFont('helvetica', 'normal');
    doc.text(this.formatDate(contribution.created_at), 60, yPos);

    yPos += 8;
    doc.setFont('helvetica', 'bold');
    doc.text('Time:', 20, yPos);
    doc.setFont('helvetica', 'normal');
    doc.text(this.formatTime(contribution.created_at), 60, yPos);

    yPos += 8;
    doc.setFont('helvetica', 'bold');
    doc.text('Payment Method:', 20, yPos);
    doc.setFont('helvetica', 'normal');
    doc.text(this.capitalizeFirst(contribution.payment_method), 60, yPos);

    yPos += 8;
    doc.setFont('helvetica', 'bold');
    doc.text('Status:', 20, yPos);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(contribution.status === 'completed' ? '#16A34A' : '#EAB308');
    doc.text(this.capitalizeFirst(contribution.status), 60, yPos);

    // Amount box
    yPos += 20;
    doc.setFillColor(this.LIGHT_GRAY);
    doc.rect(20, yPos, pageWidth - 40, 25, 'F');

    doc.setFontSize(14);
    doc.setTextColor(this.SECONDARY_COLOR);
    doc.setFont('helvetica', 'bold');
    doc.text('AMOUNT PAID', pageWidth / 2, yPos + 10, { align: 'center' });

    doc.setFontSize(24);
    doc.setTextColor(this.BRAND_COLOR);
    doc.text(`₦${contribution.amount.toLocaleString()}`, pageWidth / 2, yPos + 20, {
      align: 'center',
    });

    // Description
    if (contribution.description) {
      yPos += 35;
      doc.setFontSize(10);
      doc.setTextColor(100);
      doc.setFont('helvetica', 'italic');
      doc.text(`Note: ${contribution.description}`, 20, yPos);
    }

    // Footer
    this.addFooter(doc, pageWidth);

    // Save PDF
    const fileName = `CollectiPay_Receipt_${contribution.reference_id.substring(0, 12)}.pdf`;
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
