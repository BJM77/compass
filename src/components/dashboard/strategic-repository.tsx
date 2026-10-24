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

  const usersQuery = useMemoFirebase(() => db ? collection(db, 'users') : null, [db]);
  const { data: users } = useCollection(usersQuery);

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
      
      let owner = doc.userName || doc.userEmail;
      if (!owner && doc.userId && users) {
        const u = users.find((u: any) => u.id === doc.userId || u.uid === doc.userId);
        if (u && u.name) {
          owner = u.name;
        }
      }
      owner = owner || doc.userId || '';

      const matchesSearch = (name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                            (owner || '').toLowerCase().includes(searchTerm.toLowerCase());
      return matchesSearch;
    });
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card p-6 rounded-2xl border border-border shadow-sm">
        <div className="space-y-1">
          <h2 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-accent" />
            Strategic Repository
          </h2>
          <p className="text-muted-foreground text-xs font-bold uppercase tracking-wide">
            Centralized intelligence portal for Whitespace Reports, Call Plans, and Fact Findings.
          </p>
        </div>
        <div className="relative w-full md:w-[320px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search Account or Owner..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 h-10 w-full bg-secondary/60 border-border focus-visible:ring-1 focus-visible:ring-accent font-medium text-xs rounded-xl"
          />
        </div>
      </div>

      <Tabs defaultValue="whitespace" className="w-full">
        <TabsList className="grid w-full grid-cols-3 max-w-xl bg-secondary p-1 rounded-xl mb-6">
          <TabsTrigger value="whitespace" className="rounded-lg text-xs font-semibold py-2">
            <Map className="w-3.5 h-3.5 mr-2 shrink-0" />
            Whitespace Reports
          </TabsTrigger>
          <TabsTrigger value="callplans" className="rounded-lg text-xs font-semibold py-2">
            <PhoneCall className="w-3.5 h-3.5 mr-2 shrink-0" />
            Call Plans
          </TabsTrigger>
          <TabsTrigger value="factfinding" className="rounded-lg text-xs font-semibold py-2">
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
            users={users || []}
          />
        </TabsContent>

        <TabsContent value="callplans">
          <DocumentList
            documents={filterDocs(callPlanDocs || [], 'callPlan')}
            type="callPlan"
            onOpen={openDocument}
            isLoading={cpLoading}
            users={users || []}
          />
        </TabsContent>

        <TabsContent value="factfinding">
          <DocumentList
            documents={filterDocs(factFindingDocs || [], 'factFinding')}
            type="factFinding"
            onOpen={openDocument}
            isLoading={ffLoading}
            users={users || []}
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
  users?: any[];
}

function DocumentList({ documents, type, onOpen, isLoading, users }: DocumentListProps) {
  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-20 bg-card border rounded-2xl">
        <Loader2 className="w-6 h-6 animate-spin text-accent" />
        <span className="ml-2 font-bold text-xs uppercase text-muted-foreground">Loading documents...</span>
      </div>
    );
  }

  if (documents.length === 0) {
    return (
      <div className="text-center py-20 bg-card border border-dashed rounded-2xl border-border">
        <p className="text-xs font-bold uppercase text-muted-foreground tracking-wide">No matching documents found.</p>
      </div>
    );
  }

  return (
    <Card className="border border-border shadow-sm rounded-xl overflow-hidden">
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-secondary/60 border-b border-border text-xs font-semibold text-muted-foreground">
              <tr>
                <th className="px-6 py-4 text-left">Account / Customer</th>
                <th className="px-6 py-4 text-left">Created By</th>
                <th className="px-6 py-4 text-left">Date Created</th>
                <th className="px-6 py-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60 bg-card">
              {documents.map((doc) => {
                const name = type === 'whitespace' ? doc.accountName :
                            type === 'callPlan' ? doc.accountName :
                            doc.companyName;
                            
                let owner = doc.userName || doc.userEmail;
                if (!owner && doc.userId && users) {
                  const u = users.find((u: any) => u.id === doc.userId || u.uid === doc.userId);
                  if (u && u.name) {
                    owner = u.name;
                  }
                }
                owner = owner || doc.userId || 'System';
                const createdAt = doc.createdAt?.toDate ? doc.createdAt.toDate().toLocaleDateString() : 'N/A';

                return (
                  <tr key={doc.id} className="hover:bg-secondary/30 transition-colors">
                    <td className="px-6 py-4 font-semibold text-foreground tracking-tight">
                      {name || 'Unnamed Account'}
                    </td>
                    <td className="px-6 py-4 font-semibold text-muted-foreground">
                      {owner}
                    </td>
                    <td className="px-6 py-4 text-muted-foreground font-medium">
                      {createdAt}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onOpen(doc, type)}
                        className="font-bold text-xs border-border text-foreground/85 hover:bg-secondary/60 h-8 rounded-lg"
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
