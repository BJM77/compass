"use client";

import { useState } from 'react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, where } from 'firebase/firestore';
import { useAuth } from '@/contexts/auth-context';
import { FactFindingDoc } from '@/types/crm';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { FileText, Plus, Calendar, Building, Package, Download, ChevronRight, FileSearch } from 'lucide-react';
import { FactFindingForm } from './fact-finding-form';
import { format } from 'date-fns';

export function FactFindingHub() {
  const [selectedDoc, setSelectedDoc] = useState<FactFindingDoc | 'new' | null>(null);
  const db = useFirestore();
  const { user, isLeader, profile } = useAuth();

  // Query docs
  const docsQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return query(
      collection(db, 'factFindingDocs'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );
  }, [db, user]);

  const { data: docs, isLoading: loading } = useCollection<FactFindingDoc>(docsQuery);

  if (selectedDoc === 'new') {
    return <FactFindingForm onBack={() => setSelectedDoc(null)} />;
  }

  if (selectedDoc !== null) {
    return <FactFindingForm docId={selectedDoc.id} existingDoc={selectedDoc} onBack={() => setSelectedDoc(null)} />;
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h2 className="text-3xl font-black tracking-tight text-slate-800 flex items-center gap-3">
            <FileSearch className="w-8 h-8 text-primary" />
            Fact Finding Documents
          </h2>
          <p className="text-slate-500 mt-1 font-medium">Create and manage logistics discovery documents.</p>
        </div>
        <Button onClick={() => setSelectedDoc('new')} className="font-bold gap-2">
          <Plus className="w-4 h-4" />
          Create New Document
        </Button>
      </div>

      {loading ? (
        <div className="flex h-[400px] items-center justify-center text-slate-500 font-bold uppercase tracking-widest">
          Loading Documents...
        </div>
      ) : !docs || docs.length === 0 ? (
        <Card className="border-dashed border-2 border-slate-200 bg-slate-50">
          <CardContent className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-sm mb-4">
              <FileSearch className="w-8 h-8 text-slate-300" />
            </div>
            <h3 className="text-xl font-black text-slate-700 mb-2">No Documents Found</h3>
            <p className="text-slate-500 font-medium mb-6 max-w-md">
              You haven't created any Fact Finding documents yet. Create one to capture detailed logistics requirements for a prospect.
            </p>
            <Button onClick={() => setSelectedDoc('new')} className="font-bold gap-2">
              <Plus className="w-4 h-4" />
              Create First Document
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {docs.map(doc => (
            <Card key={doc.id} className="group hover:shadow-lg transition-all duration-300 border-slate-200 cursor-pointer overflow-hidden" onClick={() => setSelectedDoc(doc)}>
              <CardHeader className="bg-slate-50 border-b border-slate-100 pb-4">
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-lg font-black text-primary line-clamp-1">
                      {doc.companyName || 'Unnamed Company'}
                    </CardTitle>
                    <CardDescription className="flex items-center gap-1 mt-1 font-medium text-xs">
                      <Calendar className="w-3 h-3" />
                      {doc.createdAt ? format(doc.createdAt.toDate(), 'MMM d, yyyy') : 'Recently'}
                    </CardDescription>
                  </div>
                  <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center shadow-sm text-slate-400 group-hover:text-primary group-hover:scale-110 transition-all">
                    <ChevronRight className="w-4 h-4" />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-4 space-y-3">
                <div className="flex items-start gap-2">
                  <Package className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs font-bold text-slate-700 uppercase">Freight Type</p>
                    <p className="text-sm text-slate-600 font-medium line-clamp-1">{doc.freightType || 'Not specified'}</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Building className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs font-bold text-slate-700 uppercase">Locations</p>
                    <p className="text-sm text-slate-600 font-medium line-clamp-1">{doc.locations || 'Not specified'}</p>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="bg-slate-50/50 border-t border-slate-100 py-3 flex justify-between items-center">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">{doc.businessModel || 'B2B'}</span>
                <span className="text-xs font-black text-indigo-600">{doc.weeklyAmount || 'N/A'}</span>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
