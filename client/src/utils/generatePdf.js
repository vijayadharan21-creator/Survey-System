import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

/**
 * Exports a DOM element as a downloadable PDF document
 * @param {string|HTMLElement} target - The DOM element ID or element reference
 * @param {string} filename - Desired output filename (e.g., 'survey-report.pdf')
 */
export async function exportElementToPdf(target, filename = 'survey-report.pdf') {
  try {
    const element = typeof target === 'string' ? document.getElementById(target) : target;
    if (!element) {
      window.print();
      return;
    }

    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
      windowWidth: element.scrollWidth,
    });

    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();
    const margin = 10;
    const contentWidth = pdfWidth - margin * 2;
    const contentHeight = (canvas.height * contentWidth) / canvas.width;

    let heightLeft = contentHeight;
    let position = margin;

    pdf.addImage(imgData, 'PNG', margin, position, contentWidth, contentHeight);
    heightLeft -= (pdfHeight - margin * 2);

    while (heightLeft > 0) {
      position = heightLeft - contentHeight + margin;
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', margin, position, contentWidth, contentHeight);
      heightLeft -= (pdfHeight - margin * 2);
    }

    const finalName = filename.endsWith('.pdf') ? filename : `${filename}.pdf`;
    pdf.save(finalName);
  } catch (error) {
    console.error('PDF export error, falling back to window.print():', error);
    window.print();
  }
}
