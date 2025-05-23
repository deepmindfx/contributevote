import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { Contribution } from "@/services/localStorage";
import { format } from "date-fns";

interface ExportContributionsProps {
  contribution: Contribution;
}

const ExportContributions = ({ contribution }: ExportContributionsProps) => {
  const generatePDF = () => {
    // Create new PDF document
    const doc = new jsPDF();
    
    // Add watermark logo
    const watermarkLogo = new Image();
    watermarkLogo.src = '/lovable-uploads/85c09632-4fd3-46fb-b70a-45daac74abfc.png';
    
    // Wait for logo to load
    watermarkLogo.onload = () => {
      // Add watermark
      doc.saveGraphicsState();
      doc.setGState(new doc.GState({ opacity: 0.05 }));
      doc.addImage(watermarkLogo, 'PNG', 40, 40, 130, 130);
      doc.restoreGraphicsState();
      
      // Add header logo
      const logo = new Image();
      logo.src = '/lovable-uploads/85c09632-4fd3-46fb-b70a-45daac74abfc.png';
      
      logo.onload = () => {
        // Add logo with proper dimensions
        doc.addImage(logo, 'PNG', 14, 10, 30, 30);
        
        // Add company name and title
        doc.setFontSize(24);
        doc.setTextColor(45, 174, 117); // Our brand green color
        doc.setFont('helvetica', 'bold');
        doc.text("CollectiPay", 50, 25);
        
        doc.setFontSize(16);
        doc.text("Contribution Statement", 50, 35);
        
        // Add subtitle
        doc.setFontSize(10);
        doc.setTextColor(100, 100, 100);
        doc.setFont('helvetica', 'normal');
        doc.text("Official Statement of Contributions", 50, 42);
        
        // Add group details with better styling
        doc.setFontSize(11);
        doc.setTextColor(60, 60, 60);
        
        // Create a styled box for group details
        doc.setFillColor(240, 240, 240);
        doc.roundedRect(14, 50, 183, 35, 3, 3, 'F');
        
        // Add group details with better spacing
        doc.text(`Group: ${contribution.name}`, 20, 60);
        doc.text(`Frequency: ${contribution.frequency}`, 20, 67);
        doc.text(`Target Amount: ₦${contribution.targetAmount.toLocaleString()}`, 20, 74);
        doc.text(`Current Amount: ₦${contribution.currentAmount.toLocaleString()}`, 20, 81);
        
        // Add contributors table with enhanced styling
        const contributors = contribution.contributors || [];
        const tableData = contributors.map(contributor => [
          contributor.name || 'Anonymous',
          `₦${contributor.amount.toLocaleString()}`,
          format(new Date(contributor.date), 'MMM d, yyyy'),
          contributor.anonymous ? 'Yes' : 'No'
        ]);
        
        autoTable(doc, {
          startY: 95,
          head: [['Contributor', 'Amount', 'Date', 'Anonymous']],
          body: tableData,
          theme: 'grid',
          headStyles: { 
            fillColor: [45, 174, 117],
            textColor: [255, 255, 255],
            fontStyle: 'bold',
            fontSize: 10,
            cellPadding: 6
          },
          styles: { 
            fontSize: 10,
            cellPadding: 6,
            lineColor: [200, 200, 200],
            lineWidth: 0.1
          },
          columnStyles: {
            0: { cellWidth: 70 },
            1: { cellWidth: 45, halign: 'right' },
            2: { cellWidth: 45, halign: 'center' },
            3: { cellWidth: 35, halign: 'center' }
          },
          alternateRowStyles: {
            fillColor: [248, 248, 248]
          },
          margin: { left: 14, right: 14 }
        });
        
        // Add summary section with better styling
        const finalY = (doc as any).lastAutoTable.finalY || 95;
        
        // Create a styled box for summary
        doc.setFillColor(240, 240, 240);
        doc.roundedRect(14, finalY + 5, 183, 25, 3, 3, 'F');
        
        doc.setTextColor(60, 60, 60);
        doc.setFontSize(10);
        doc.text(`Total Contributors: ${contributors.length}`, 20, finalY + 15);
        doc.text(`Total Amount: ₦${contribution.currentAmount.toLocaleString()}`, 20, finalY + 22);
        doc.text(`Generated on: ${format(new Date(), 'MMMM d, yyyy')}`, 20, finalY + 29);
        
        // Add footer
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        doc.text("This is an official statement from CollectiPay", 14, 280);
        doc.text("For any queries, please contact support@collectipay.com", 14, 285);
        
        // Save the PDF
        doc.save(`${contribution.name}-contributions.pdf`);
      };
    };
  };

  return (
    <Button 
      variant="outline" 
      size="sm" 
      onClick={generatePDF}
      className="flex items-center gap-2"
    >
      <Download className="h-4 w-4" />
      Export Statement
    </Button>
  );
};

export default ExportContributions; 