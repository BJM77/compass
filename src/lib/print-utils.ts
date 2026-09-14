// src/lib/print-utils.ts

/**
 * Opens a new window, renders the given HTML, and triggers the print dialog.
 * This completely bypasses any React Dialog, portal, or layout issue.
 */
export function printHtmlInNewWindow(options: {
  title: string;
  bodyHtml: string;
  // Optional CSS string injected into <style>
  css?: string;
}): void {
  const { title, bodyHtml, css = '' } = options;

  // Open a new window synchronously (must be within the click handler to avoid popup blockers)
  const printWindow = window.open('', '_blank', 'width=900,height=1000');

  if (!printWindow) {
    throw new Error(
      'Popup blocked. Please allow popups for this site so the PDF can be generated.'
    );
  }

  const defaultCss = `
    @page { size: A4 portrait; margin: 12mm; }
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #0f172a;
      margin: 0;
      padding: 0;
      font-size: 11px;
      line-height: 1.5;
      background: #fff;
    }
    h1 { font-size: 22px; font-weight: 900; text-transform: uppercase; letter-spacing: -0.5px; margin: 0 0 8px 0; }
    h2 { font-size: 12px; font-weight: 900; text-transform: uppercase; letter-spacing: 1.5px; color: #1e40af; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px; margin: 20px 0 10px 0; }
    h3 { font-size: 11px; font-weight: 900; margin: 12px 0 6px 0; }
    p, div { margin: 0; }
    .header { border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 18px; display: flex; justify-content: space-between; align-items: flex-end; }
    .header-meta { text-align: right; font-size: 10px; }
    .header-meta .label { font-size: 8px; font-weight: 900; text-transform: uppercase; letter-spacing: 1.5px; color: #64748b; }
    .row { margin-bottom: 8px; page-break-inside: avoid; }
    .row .label { font-size: 8px; font-weight: 900; text-transform: uppercase; letter-spacing: 1.5px; color: #64748b; }
    .row .value { font-size: 11px; white-space: pre-wrap; word-break: break-word; }
    .section { margin-bottom: 18px; page-break-inside: avoid; }
    .footer { margin-top: 24px; padding-top: 8px; border-top: 1px solid #e2e8f0; font-size: 8px; text-transform: uppercase; letter-spacing: 1.5px; color: #94a3b8; display: flex; justify-content: space-between; }
    ul { margin: 4px 0; padding-left: 18px; }
    li { font-size: 11px; margin-bottom: 2px; }
    .note { border-left: 2px solid #cbd5e1; padding: 4px 0 4px 10px; margin-bottom: 8px; page-break-inside: avoid; }
    .note-meta { font-size: 8px; font-weight: 900; text-transform: uppercase; letter-spacing: 1px; color: #64748b; display: flex; justify-content: space-between; margin-bottom: 3px; }
  `;

  printWindow.document.open();
  // Gather all stylesheets from the parent window
  const styles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
    .map((el) => el.outerHTML)
    .join('\n');

  printWindow.document.write(`<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(title)}</title>
    ${styles}
    <style>${defaultCss}${css}</style>
  </head>
  <body>
    ${bodyHtml}
    <script>
      window.onload = function () {
        // Small delay so fonts/layout settle before the print dialog opens
        setTimeout(function () {
          window.focus();
          window.print();
        }, 250);
        
        window.onafterprint = function () {
          setTimeout(function () { window.close(); }, 200);
        };
      };
      
      // Fallback in case onload misses
      setTimeout(function () {
        window.focus();
        window.print();
      }, 500);
    </script>
  </body>
</html>`);
  printWindow.document.close();
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
