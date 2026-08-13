'use client';

import React, { useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { FactFindingForm } from './fact-finding-form';
import { CallPlanViewer, WhitespaceViewer } from './document-viewers';
import { exportElementToPdf } from '@/lib/export-utils';
import { Download, Loader2, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface DocumentViewerPopupProps {
  isOpen: boolean;
  onClose: () => void;
  document: any;
  docType: 'whitespace' | 'callPlan' | 'factFinding';
}

export function DocumentViewerPopup({ isOpen, onClose, document: doc, docType }: DocumentViewerPopupProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);
  const { toast } = useToast();

  if (!doc) return null;

  const getDocTitle = () => {
    switch (docType) {
      case 'whitespace': return 'Whitespace Analysis';
      case 'callPlan': return 'Call Plan';
      case 'factFinding': return 'Fact Finding Report';
      default: return 'Document Preview';
    }
  };

  const getDocName = () => {
    return doc.accountName || doc.companyName || 'Document';
  };

  const handlePdfExport = async () => {
    if (!containerRef.current) return;
    setIsExporting(true);
    try {
      const filename = `${getDocName().replace(/\s+/g, '_')}_${docType}_export.pdf`;
      await exportElementToPdf(containerRef.current, filename);
      toast({
        title: "Export Success",
        description: `Successfully exported PDF document.`,
      });
    } catch (e) {
      console.error(e);
      toast({
        title: "Export Failed",
        description: "An error occurred while generating your PDF.",
        variant: "destructive"
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-5xl max-h-[90vh] p-0 flex flex-col overflow-hidden bg-white shadow-2xl border border-slate-200 rounded-2xl">
        <DialogHeader className="p-6 border-b border-slate-100 flex flex-row items-center justify-between shrink-0">
          <div>
            <DialogTitle className="text-xl font-black uppercase tracking-tight text-slate-800">
              {getDocTitle()}
            </DialogTitle>
            <DialogDescription className="font-bold text-xs uppercase text-slate-400 mt-1">
              Previewing: {getDocName()}
            </DialogDescription>
          </div>
          <div className="flex items-center gap-2 pr-6">
            <Button
              onClick={handlePdfExport}
              disabled={isExporting}
              size="sm"
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold gap-2 text-xs shadow-md border-none"
            >
              {isExporting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Download className="w-3.5 h-3.5" />
              )}
              Download PDF
            </Button>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50">
          <div ref={containerRef} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm print:shadow-none print:border-none">
            {docType === 'factFinding' && (
              <FactFindingForm existingDoc={doc} docId={doc.id} onBack={onClose} viewOnly={true} />
            )}
            {docType === 'callPlan' && (
              <CallPlanViewer callPlan={doc} />
            )}
            {docType === 'whitespace' && (
              <WhitespaceViewer whitespaceDoc={doc} />
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
