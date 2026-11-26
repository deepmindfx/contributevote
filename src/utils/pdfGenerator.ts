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
   * Generate full contribution history report — premium branded design
   */
  static generateFullReport(data: ReceiptData): void {
    const doc = new jsPDF({ format: 'a4', unit: 'mm' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 14;
    const contentW = pageWidth - margin * 2;

    // ── Colour palette (matches bankStatement.ts) ──────────────────────────
    const evergreen  = '#0c3027';
    const forest     = '#146747';
    const ink        = '#102c24';
    const muted      = '#49655b';
    const borderCol  = '#dce8df';
    const limeAccent = '#ddf4b7';
    const pale       = '#eaf5ee';

    const money = new Intl.NumberFormat('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const avg   = data.contributionCount > 0 ? data.totalAmount / data.contributionCount : 0;

    // helper: set font and draw text
    const txt = (value: string, x: number, y: number, size: number, color: string, bold = false, align: 'left'|'right'|'center' = 'left') => {
      doc.setFont('helvetica', bold ? 'bold' : 'normal');
      doc.setFontSize(size);
      doc.setTextColor(color);
      doc.text(value, x, y, align !== 'left' ? { align } : undefined);
    };

    // helper: draw brand mark (green circle + "C" + wordmark)
    const brand = (x: number, y: number) => {
      doc.setFillColor('#218f61');
      doc.circle(x + 4, y - 1.5, 4, 'F');
      txt('C', x + 1.75, y + 0.65, 17, '#ffffff', true);
      txt('CollectiPay', x + 11, y, 16, '#ffffff', true);
    };

    // ── HEADER BAND ────────────────────────────────────────────────────────
    doc.setFillColor(evergreen);
    doc.rect(0, 0, pageWidth, 53, 'F');
    // decorative circle
    doc.setFillColor('#1d5e49');
    doc.circle(pageWidth - 7, 0, 31, 'F');
    // lime accent underline
    doc.setFillColor(limeAccent);
    doc.rect(margin, 50, 22, 1.2, 'F');

    brand(margin, 15.5);
    txt('Contribution History Report', margin, 33, 22, '#ffffff', true);
    txt(data.groupName, margin, 42, 11, '#c8e9d8');
    txt('NGN  |  WAT', pageWidth - margin, 42, 10, limeAccent, true, 'right');

    // ── META ROW ──────────────────────────────────────────────────────────
    txt('CONTRIBUTOR', margin, 64, 8, muted, true);
    txt('GENERATED', pageWidth - margin, 64, 8, muted, true, 'right');

    const nameLines = doc.splitTextToSize(data.contributorName.trim() || 'Unknown', contentW * 0.63) as string[];
    nameLines.forEach((line, i) => txt(line, margin, 71 + i * 5, 13, ink, true));
    txt(new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }), pageWidth - margin, 71, 11, ink, true, 'right');
    txt(new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) + ' WAT', pageWidth - margin, 77, 9, muted, false, 'right');

    const metaBottomY = 71 + (nameLines.length - 1) * 5;

    // ── SUMMARY METRIC TILES ──────────────────────────────────────────────
    const summaryY = Math.max(85, metaBottomY + 8);
    const gap      = 3;
    const tile     = (contentW - gap * 2) / 3;
    const metrics: [string, number][] = [
      ['Total paid', data.totalAmount],
      ['Contributions', data.contributionCount],
      ['Average payment', avg],
    ];

    metrics.forEach(([label, value], idx) => {
      const x = margin + idx * (tile + gap);
      doc.setFillColor(idx === 0 ? pale : '#f6f9f7');
      doc.setDrawColor(borderCol);
      doc.roundedRect(x, summaryY, tile, 21, 2.4, 2.4, 'FD');
      txt(label, x + 4, summaryY + 7, 9, forest, true);
      const formatted = idx === 1 ? String(value) : '₦' + money.format(value);
      doc.setFont('helvetica', 'bold').setFontSize(15);
      txt(formatted, x + 4, summaryY + 15,
        Math.min(15, (tile - 8) * 15 / Math.max(1, doc.getTextWidth(formatted))),
        ink, true);
    });

    // ── TABLE SECTION ─────────────────────────────────────────────────────
    const tableStart = summaryY + 32;
    txt('Transaction detail', margin, tableStart, 13, ink, true);
    txt(data.contributions.length + (data.contributions.length === 1 ? ' entry' : ' entries'),
      pageWidth - margin, tableStart, 9, muted, false, 'right');

    const tableData = data.contributions.map((c) => [
      this.formatDate(c.created_at),
      this.formatTime(c.created_at),
      money.format(c.amount),
      this.capitalizeFirst(c.payment_method).replace('_', ' '),
      this.capitalizeFirst(c.status),
      c.reference_id.length > 18 ? c.reference_id.substring(0, 18) + '…' : c.reference_id,
    ]);

    autoTable(doc, {
      startY: tableStart + 4,
      margin: { left: margin, right: margin, top: 23, bottom: 21 },
      theme: 'plain',
      showHead: 'everyPage',
      rowPageBreak: 'avoid',
      head: [['Date', 'Time', 'Amount (NGN)', 'Method', 'Status', 'Reference']],
      body: tableData.length ? tableData : [[{ content: 'No contributions recorded.', colSpan: 6 }]],
      styles: {
        fontSize: 8.5,
        cellPadding: 2.5,
        valign: 'middle',
        overflow: 'linebreak',
        textColor: ink,
        lineColor: borderCol,
      },
      headStyles: { fillColor: evergreen, textColor: '#ffffff', fontStyle: 'bold' },
      alternateRowStyles: { fillColor: '#f3f8f5' },
      columnStyles: {
        0: { cellWidth: 26 },
        1: { cellWidth: 20 },
        2: { cellWidth: 30, halign: 'right', fontStyle: 'bold', textColor: forest },
        3: { cellWidth: 28 },
        4: { cellWidth: 22, halign: 'center' },
        5: { cellWidth: 'auto', fontSize: 7 },
      },
      didParseCell: ({ cell, column, section }) => {
        if (section !== 'body') return;
        // colour status badges
        if (column.index === 4) {
          cell.styles.fontStyle = 'bold';
          const val = cell.text[0]?.toLowerCase() ?? '';
          cell.styles.textColor =
            val === 'completed' ? forest :
            val === 'failed'    ? '#a02e41' :
                                  '#8c5a1c';
        }
      },
      willDrawPage: ({ pageNumber }) => {
        if (pageNumber === 1) return;
        // repeat header on continuation pages
        doc.setFillColor(evergreen);
        doc.rect(0, 0, pageWidth, 18, 'F');
        brand(margin, 11);
        txt('Contribution History  /  ' + data.groupName, pageWidth - margin, 11, 9, '#c8e9d8', false, 'right');
      },
    });

    // ── FOOTER (every page) ────────────────────────────────────────────────
    const pages = doc.getNumberOfPages();
    for (let page = 1; page <= pages; page++) {
      doc.setPage(page);
      doc.setDrawColor(borderCol);
      doc.line(margin, pageHeight - 16, pageWidth - margin, pageHeight - 16);
      txt(
        'Official contribution report from CollectiPay  •  support@collectipay.com  •  collectipay.com.ng',
        margin, pageHeight - 10, 7.5, muted
      );
      txt(page + ' / ' + pages, pageWidth - margin, pageHeight - 10, 8, ink, true, 'right');
    }

    // ── SAVE ───────────────────────────────────────────────────────────────
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
