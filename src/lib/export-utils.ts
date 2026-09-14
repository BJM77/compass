import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

/**
 * Captures an HTML element and saves it as a PDF.
 */
export async function exportElementToPdf(element: HTMLElement, filename: string): Promise<void> {
  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    logging: false,
    backgroundColor: '#ffffff',
    onclone: (clonedDoc) => {
      // Replace every textarea with a div containing its value
      clonedDoc.querySelectorAll('textarea').forEach((ta) => {
        const div = clonedDoc.createElement('div');
        div.textContent = (ta as HTMLTextAreaElement).value;
        div.style.whiteSpace = 'pre-wrap';
        div.style.wordBreak = 'break-word';
        div.style.font = getComputedStyle(ta).font;
        div.style.color = getComputedStyle(ta).color;
        div.style.width = '100%';
        div.style.padding = '4px 0';
        ta.parentNode?.replaceChild(div, ta);
      });

      // Replace inputs with divs to prevent text from being vertically cropped by html2canvas
      clonedDoc.querySelectorAll('input').forEach((inputEl) => {
        if (['radio', 'checkbox', 'hidden', 'submit', 'button', 'file'].includes(inputEl.type)) return;
        
        const div = clonedDoc.createElement('div');
        div.textContent = inputEl.value;
        const styles = getComputedStyle(inputEl);
        
        div.style.font = styles.font;
        div.style.color = styles.color;
        div.style.width = styles.width;
        div.style.minHeight = styles.height;
        div.style.padding = styles.padding;
        div.style.margin = styles.margin;
        div.style.border = styles.border;
        div.style.borderRadius = styles.borderRadius;
        div.style.backgroundColor = styles.backgroundColor;
        div.style.boxSizing = styles.boxSizing;
        
        // Vertically center text to prevent bottom cropping
        div.style.display = 'flex';
        div.style.alignItems = 'center';
        div.style.overflow = 'hidden';
        div.style.whiteSpace = 'nowrap';
        
        inputEl.parentNode?.replaceChild(div, inputEl);
      });

      // Remove layout constraints that clip content (line-clamps, max-heights, hidden overflows, custom scrollbars)
      clonedDoc.querySelectorAll('[class*="line-clamp-"], [class*="max-h-"], [class*="overflow-"], [style*="overflow"]').forEach((el) => {
        const htmlEl = el as HTMLElement;
        htmlEl.style.maxHeight = 'none';
        htmlEl.style.overflow = 'visible';
        htmlEl.style.webkitLineClamp = 'none';
        htmlEl.style.textOverflow = 'clip';
      });

      // Disable contenteditable and strip focus rings/spinners
      clonedDoc.querySelectorAll('[contenteditable]').forEach((el) => {
        el.removeAttribute('contenteditable');
      });

      // Ensure any hidden scrollable parents render at full natural height
      clonedDoc.querySelectorAll('body, #__next, main, div').forEach((el) => {
        const htmlEl = el as HTMLElement;
        if (htmlEl.style && (htmlEl.style.overflowY === 'auto' || htmlEl.style.overflowY === 'scroll')) {
          htmlEl.style.overflowY = 'visible';
          htmlEl.style.height = 'auto';
        }
      });
    }
  });

  if (canvas.width < 10 || canvas.height < 10) {
    throw new Error('Export container rendered as empty. Content may be hidden or detached.');
  }

  // Also check the raw pixel data is not blank
  const ctx = canvas.getContext('2d');
  const sample = ctx?.getImageData(0, 0, Math.min(canvas.width, 100), Math.min(canvas.height, 100)).data;
  let nonWhitePixels = 0;
  if (sample) {
    for (let i = 0; i < sample.length; i += 4) {
      // Check if not pure white (255,255,255)
      if (sample[i] < 250 || sample[i + 1] < 250 || sample[i + 2] < 250) {
        nonWhitePixels++;
      }
    }
  }
  if (nonWhitePixels < 5) {
    throw new Error('Export container appears blank. Verify content is being rendered.');
  }

  const imgData = canvas.toDataURL('image/jpeg', 0.95);
  
  const pdfWidth = 595.28;
  const a4Height = 841.89; // Standard A4 height in pt
  const scaledImageHeight = (canvas.height * pdfWidth) / canvas.width;
  
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'a4'
  });

  let heightLeft = scaledImageHeight;
  let position = 0;

  // Add first page
  pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, scaledImageHeight);
  heightLeft -= a4Height;

  // Add subsequent pages if the content overflows A4 height
  while (heightLeft > 0) {
    position -= a4Height;
    pdf.addPage();
    pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, scaledImageHeight);
    heightLeft -= a4Height;
  }

  // Generate the Blob directly and use a manual anchor tag to ensure 
  // the correct filename and extension are always respected by the browser.
  const pdfBlob = pdf.output('blob');
  const url = URL.createObjectURL(pdfBlob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Downloads data as a CSV file.
 */
export function exportToCsv(headers: string[], rows: any[][], filename: string): void {
  const csvContent = [
    headers.map(h => `"${h.replace(/"/g, '""')}"`).join(','),
    ...rows.map(row => row.map(cell => `"${(cell ?? '').toString().replace(/"/g, '""')}"`).join(','))
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Downloads data as a JSON file.
 */
export function exportToJson(data: any, filename: string): void {
  const jsonContent = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
