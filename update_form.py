import re

with open("src/components/dashboard/fact-finding-form.tsx", "r") as f:
    content = f.read()

# 1. Imports
content = content.replace(
    "import { useState, useEffect, createContext, useContext, useRef, useMemo } from 'react';",
    "import { useState, useEffect, createContext, useContext, useRef, useMemo, forwardRef, useImperativeHandle } from 'react';"
)

# 2. Signature
content = content.replace(
    "export function FactFindingForm({ docId, existingDoc, onBack, viewOnly = false }: Props) {",
    """export interface FactFindingFormHandle {
  exportPdf: () => Promise<void>;
  exportReview: () => Promise<void>;
}

export const FactFindingForm = forwardRef<FactFindingFormHandle, Props>(
  function FactFindingForm({ docId, existingDoc, onBack, viewOnly = false }, ref) {"""
)

# 3. Add exportMode and exportContainerRef
content = content.replace(
    "const [printType, setPrintType] = useState<'FULL' | 'REVIEW' | null>(null);",
    """const [exportMode, setExportMode] = useState<'FULL' | 'REVIEW' | null>(null);
  const exportContainerRef = useRef<HTMLDivElement>(null);"""
)

# 4. Update handlers
handlers_old = """  const handleExportPDF = () => {
    setPrintType('FULL');
    const cleanup = () => {
      setPrintType(null);
      window.removeEventListener('afterprint', cleanup);
    };
    window.addEventListener('afterprint', cleanup);
    setTimeout(() => {
      window.print();
    }, 500);
  };

  const handleExportReview = () => {
    setPrintType('REVIEW');
    const cleanup = () => {
      setPrintType(null);
      window.removeEventListener('afterprint', cleanup);
    };
    window.addEventListener('afterprint', cleanup);
    setTimeout(() => {
      window.print();
    }, 500);
  };"""

handlers_new = """  const handleExportPDF = async () => {
    setExportMode('FULL');
    await new Promise(r => setTimeout(r, 300));
    if (exportContainerRef.current) {
      await exportElementToPdf(exportContainerRef.current, `${formData.companyName || 'FactFinding'}_Export.pdf`);
    }
    setExportMode(null);
  };

  const handleExportReview = async () => {
    setExportMode('REVIEW');
    await new Promise(r => setTimeout(r, 300));
    if (exportContainerRef.current) {
      await exportElementToPdf(exportContainerRef.current, `${formData.companyName || 'FactFinding'}_Review.pdf`);
    }
    setExportMode(null);
  };

  useImperativeHandle(ref, () => ({
    exportPdf: handleExportPDF,
    exportReview: handleExportReview,
  }));"""
content = content.replace(handlers_old, handlers_new)

# 5. JSX Wrap and hide
jsx_old = """    <ViewOnlyContext.Provider value={viewOnly}>
      <div className="print-content space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-12 overflow-x-hidden print:overflow-visible max-w-full">
        <div className={printType === 'REVIEW' ? 'print:hidden' : ''}>"""

jsx_new = """    <ViewOnlyContext.Provider value={viewOnly}>
      <div ref={exportContainerRef} className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-12 max-w-full bg-white text-slate-900">
        <div className={exportMode === 'REVIEW' ? 'hidden' : ''}>"""
content = content.replace(jsx_old, jsx_new)

# 6. Hide header during export
header_old = """        {/* Header - Hidden on Print */}
        <div className="print:hidden sticky top-0 z-40 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white/95 backdrop-blur-sm p-4 rounded-xl shadow-sm border border-slate-200">"""
header_new = """        {/* Header - Hidden on Export */}
        <div className={`${exportMode ? 'hidden' : ''} sticky top-0 z-40 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white/95 backdrop-blur-sm p-4 rounded-xl shadow-sm border border-slate-200`}>"""
content = content.replace(header_old, header_new)

# 7. Review sheet visible when exportMode === 'REVIEW'
review_old = """      {/* Export Review Sheet (Strictly formatted to fit a single page on print) */}
      {printType === 'REVIEW' && (
        <div className="hidden print:block print-fullscreen font-sans text-slate-800">"""
review_new = """      {/* Export Review Sheet (Strictly formatted to fit a single page on print) */}
      {exportMode === 'REVIEW' && (
        <div className="font-sans text-slate-800 bg-white p-8">"""
content = content.replace(review_old, review_new)

# 8. Close forwardRef
content = content.replace(
    "    </ViewOnlyContext.Provider>\n  );\n}\n",
    "    </ViewOnlyContext.Provider>\n  );\n});\n"
)

with open("src/components/dashboard/fact-finding-form.tsx", "w") as f:
    f.write(content)

print("Updated fact-finding-form.tsx")
