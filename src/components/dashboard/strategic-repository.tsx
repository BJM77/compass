'use client';

import React, { useState } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { useCollection, useMemoFirebase, useFirestore } from '@/firebase';
import { collection, query, orderBy, limit } from 'firebase/firestore';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DocumentViewerPopup } from './document-viewer-popup';
import { FileSearch, PhoneCall, Map, Search, Loader2, Sparkles } from 'lucide-react';

export function StrategicRepository() {
  const { isLeader, user } = useAuth();
  const db = useFirestore();
  const [selectedDocument, setSelectedDocument] = useState<any | null>(null);
  const [popupOpen, setPopupOpen] = useState(false);
  const [docType, setDocType] = useState<'whitespace' | 'callPlan' | 'factFinding'>('whitespace');
  const [searchTerm, setSearchTerm] = useState('');

  // 1. Whitespace Reports Query
  const whitespaceQuery = useMemoFirebase(() => {
    if (!db || !isLeader) return null;
    return query(collection(db, 'whitespacePlans'), orderBy('createdAt', 'desc'), limit(500));
  }, [db, isLeader]);
  const { data: whitespaceDocs, isLoading: wsLoading } = useCollection(whitespaceQuery);

  // 2. Call Plans Query
  const callPlanQuery = useMemoFirebase(() => {
    if (!db || !isLeader) return null;
    return query(collection(db, 'callPlans'), orderBy('createdAt', 'desc'), limit(500));
  }, [db, isLeader]);
  const { data: callPlanDocs, isLoading: cpLoading } = useCollection(callPlanQuery);

  // 3. Fact Finding Docs Query
  const factFindingQuery = useMemoFirebase(() => {
    if (!db || !isLeader) return null;
    return query(collection(db, 'factFindingDocs'), orderBy('createdAt', 'desc'), limit(500));
  }, [db, isLeader]);
  const { data: factFindingDocs, isLoading: ffLoading } = useCollection(factFindingQuery);

  const openDocument = (doc: any, type: 'whitespace' | 'callPlan' | 'factFinding') => {
    setSelectedDocument(doc);
    setDocType(type);
    setPopupOpen(true);
  };

  const filterDocs = (docs: any[], type: 'whitespace' | 'callPlan' | 'factFinding') => {
    if (!docs) return [];
    return docs.filter(doc => {
      const name = type === 'whitespace' ? doc.accountName :
                  type === 'callPlan' ? doc.accountName :
                  doc.companyName;
      const owner = doc.userName || doc.userEmail || doc.userId || '';
      const matchesSearch = (name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                            (owner || '').toLowerCase().includes(searchTerm.toLowerCase());
      return matchesSearch;
    });
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div className="space-y-1">
          <h2 className="text-2xl font-black tracking-tight text-slate-800 flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-indigo-600" />
            Strategic Repository
          </h2>
          <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">
            Centralized intelligence portal for Whitespace Reports, Call Plans, and Fact Findings.
          </p>
        </div>
        <div className="relative w-full md:w-[320px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Search Account or Owner..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 h-10 w-full bg-slate-50 border-slate-200 focus-visible:ring-1 focus-visible:ring-indigo-500 font-medium text-xs rounded-xl"
          />
        </div>
      </div>

      <Tabs defaultValue="whitespace" className="w-full">
        <TabsList className="grid w-full grid-cols-3 max-w-xl bg-slate-100 p-1 rounded-xl mb-6">
          <TabsTrigger value="whitespace" className="rounded-lg text-xs font-black uppercase py-2">
            <Map className="w-3.5 h-3.5 mr-2 shrink-0" />
            Whitespace Reports
          </TabsTrigger>
          <TabsTrigger value="callplans" className="rounded-lg text-xs font-black uppercase py-2">
            <PhoneCall className="w-3.5 h-3.5 mr-2 shrink-0" />
            Call Plans
          </TabsTrigger>
          <TabsTrigger value="factfinding" className="rounded-lg text-xs font-black uppercase py-2">
            <FileSearch className="w-3.5 h-3.5 mr-2 shrink-0" />
            Fact Finding
          </TabsTrigger>
        </TabsList>

        <TabsContent value="whitespace">
          <DocumentList
            documents={filterDocs(whitespaceDocs || [], 'whitespace')}
            type="whitespace"
            onOpen={openDocument}
            isLoading={wsLoading}
          />
        </TabsContent>

        <TabsContent value="callplans">
          <DocumentList
            documents={filterDocs(callPlanDocs || [], 'callPlan')}
            type="callPlan"
            onOpen={openDocument}
            isLoading={cpLoading}
          />
        </TabsContent>

        <TabsContent value="factfinding">
          <DocumentList
            documents={filterDocs(factFindingDocs || [], 'factFinding')}
            type="factFinding"
            onOpen={openDocument}
            isLoading={ffLoading}
          />
        </TabsContent>
      </Tabs>

      <DocumentViewerPopup
        isOpen={popupOpen}
        onClose={() => setPopupOpen(false)}
        document={selectedDocument}
        docType={docType}
      />
    </div>
  );
}

// --- Helper List Component for each tab ---
interface DocumentListProps {
  documents: any[];
  type: 'whitespace' | 'callPlan' | 'factFinding';
  onOpen: (doc: any, type: 'whitespace' | 'callPlan' | 'factFinding') => void;
  isLoading: boolean;
}

function DocumentList({ documents, type, onOpen, isLoading }: DocumentListProps) {
  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-20 bg-white border rounded-2xl">
        <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
        <span className="ml-2 font-bold text-xs uppercase text-slate-400">Loading documents...</span>
      </div>
    );
  }

  if (documents.length === 0) {
    return (
      <div className="text-center py-20 bg-white border border-dashed rounded-2xl border-slate-200">
        <p className="text-xs font-bold uppercase text-slate-400 tracking-wider">No matching documents found.</p>
      </div>
    );
  }

  return (
    <Card className="border border-slate-200 shadow-sm rounded-xl overflow-hidden">
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 uppercase text-[9px] font-black tracking-widest text-slate-400">
              <tr>
                <th className="px-6 py-4 text-left">Account / Customer</th>
                <th className="px-6 py-4 text-left">Created By</th>
                <th className="px-6 py-4 text-left">Date Created</th>
                <th className="px-6 py-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {documents.map((doc) => {
                const name = type === 'whitespace' ? doc.accountName :
                            type === 'callPlan' ? doc.accountName :
                            doc.companyName;
                const owner = doc.userName || doc.userEmail || doc.userId || 'System';
                const createdAt = doc.createdAt?.toDate ? doc.createdAt.toDate().toLocaleDateString() : 'N/A';

                return (
                  <tr key={doc.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 font-black text-slate-800 uppercase tracking-tight">
                      {name || 'Unnamed Account'}
                    </td>
                    <td className="px-6 py-4 font-semibold text-slate-500">
                      {owner}
                    </td>
                    <td className="px-6 py-4 text-slate-400 font-medium">
                      {createdAt}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onOpen(doc, type)}
                        className="font-bold text-[10px] uppercase border-slate-200 text-slate-700 hover:bg-slate-50 h-8 rounded-lg"
                      >
                        View Report
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
