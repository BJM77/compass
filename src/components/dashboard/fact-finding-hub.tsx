"use client";

import { useState, useMemo } from 'react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, where } from 'firebase/firestore';
import { useAuth } from '@/contexts/auth-context';
import { FactFindingDoc } from '@/types/crm';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { FileText, Plus, Calendar, Building, Package, Download, ChevronRight, FileSearch, User, Search, LayoutGrid, List, Clock } from 'lucide-react';
import { FactFindingForm } from './fact-finding-form';
import { format } from 'date-fns';

export function FactFindingHub() {
  const [selectedDoc, setSelectedDoc] = useState<FactFindingDoc | 'new' | null>(null);
  
  // New State for Search, Filter, Sort, and View
  const [searchQuery, setSearchQuery] = useState('');
  const [userFilter, setUserFilter] = useState('all');
  const [sortUserDir, setSortUserDir] = useState<'asc' | 'desc' | 'none'>('none');
  const [viewMode, setViewMode] = useState<'card' | 'list'>('card');

  const db = useFirestore();
  const { user, isLeader, profile } = useAuth();

  // Query docs
  const docsQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    if (isLeader) {
      return query(
        collection(db, 'factFindingDocs'),
        orderBy('createdAt', 'desc')
      );
    }
    return query(
      collection(db, 'factFindingDocs'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );
  }, [db, user, isLeader]);

  const { data: docs, isLoading: loading } = useCollection<FactFindingDoc>(docsQuery);

  // Fetch users to resolve names for Leaders
  const usersQuery = useMemoFirebase(() => {
    if (!db || !isLeader) return null;
    return collection(db, 'users');
  }, [db, isLeader]);
  
  const { data: users } = useCollection(usersQuery);

  const userMap = useMemo(() => {
    if (!users) return {};
    return users.reduce((acc: Record<string, string>, u: any) => {
      acc[u.id] = u.name || u.email || 'Unknown User';
      return acc;
    }, {});
  }, [users]);

  // Derived unique users for filter dropdown
  const uniqueUsers = useMemo(() => {
    if (!docs) return [];
    const userIds = Array.from(new Set(docs.map(d => d.userId)));
    return userIds.map(id => ({ id, name: userMap[id] || 'Unknown User' }));
  }, [docs, userMap]);

  // Derived filtered & sorted docs
  const filteredAndSortedDocs = useMemo(() => {
    if (!docs) return [];
    let result = [...docs];

    // 1. Search (by company name or freight type)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(d => 
        (d.companyName || '').toLowerCase().includes(q) ||
        (d.freightType || '').toLowerCase().includes(q)
      );
    }

    // 2. Filter by User
    if (isLeader && userFilter !== 'all') {
      result = result.filter(d => d.userId === userFilter);
    }

    // 3. Sort by User
    if (isLeader && sortUserDir !== 'none') {
      result.sort((a, b) => {
        const nameA = userMap[a.userId] || '';
        const nameB = userMap[b.userId] || '';
        return sortUserDir === 'asc' ? nameA.localeCompare(nameB) : nameB.localeCompare(nameA);
      });
    }

    return result;
  }, [docs, searchQuery, userFilter, sortUserDir, isLeader, userMap]);

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
        <>
          {/* Controls Bar */}
          <div className="flex flex-col md:flex-row gap-4 items-end mb-4">
            <div className="relative flex-1 w-full md:max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
              <Input 
                placeholder="Search customer..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-10 border-slate-200"
              />
            </div>
            
            {isLeader && (
              <>
                <Select value={userFilter} onValueChange={setUserFilter}>
                  <SelectTrigger className="w-full md:w-[200px] h-10 border-slate-200">
                    <SelectValue placeholder="Filter by User" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Users</SelectItem>
                    {uniqueUsers.map(u => (
                      <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={sortUserDir} onValueChange={(v: any) => setSortUserDir(v)}>
                  <SelectTrigger className="w-full md:w-[180px] h-10 border-slate-200">
                    <SelectValue placeholder="Sort by User" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sort: Default (Date)</SelectItem>
                    <SelectItem value="asc">User Name (A-Z)</SelectItem>
                    <SelectItem value="desc">User Name (Z-A)</SelectItem>
                  </SelectContent>
                </Select>
              </>
            )}

            <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200 md:ml-auto w-full md:w-auto">
              <Button 
                variant="ghost" 
                size="sm" 
                className={`flex-1 md:flex-none px-3 py-1.5 h-8 transition-all ${viewMode === 'card' ? 'bg-white shadow-sm text-slate-900 font-bold' : 'text-slate-500 hover:text-slate-700'}`}
                onClick={() => setViewMode('card')}
              >
                <LayoutGrid className="w-4 h-4 mr-2" />
                Cards
              </Button>
              <Button 
                variant="ghost" 
                size="sm"
                className={`flex-1 md:flex-none px-3 py-1.5 h-8 transition-all ${viewMode === 'list' ? 'bg-white shadow-sm text-slate-900 font-bold' : 'text-slate-500 hover:text-slate-700'}`}
                onClick={() => setViewMode('list')}
              >
                <List className="w-4 h-4 mr-2" />
                List
              </Button>
            </div>
          </div>

          {filteredAndSortedDocs.length === 0 ? (
            <div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50">
              <p className="text-slate-500 font-bold">No documents match your search/filter criteria.</p>
              <Button variant="link" onClick={() => { setSearchQuery(''); setUserFilter('all'); }} className="mt-2">Clear Filters</Button>
            </div>
          ) : viewMode === 'list' ? (
            <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm">
              <Table>
                <TableHeader className="bg-slate-50/80">
                  <TableRow>
                    <TableHead className="font-bold">Customer</TableHead>
                    <TableHead className="font-bold">Freight Type</TableHead>
                    <TableHead className="font-bold">Locations</TableHead>
                    <TableHead className="font-bold">Model</TableHead>
                    <TableHead className="font-bold text-right">Value</TableHead>
                    {isLeader && <TableHead className="font-bold">Owner</TableHead>}
                    <TableHead className="font-bold">Created</TableHead>
                    <TableHead className="font-bold">Modified</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAndSortedDocs.map(doc => (
                    <TableRow key={doc.id} className="cursor-pointer hover:bg-slate-50 transition-colors" onClick={() => setSelectedDoc(doc)}>
                      <TableCell className="font-black text-primary">{doc.companyName || 'Unnamed'}</TableCell>
                      <TableCell className="text-slate-600">{doc.freightType || '-'}</TableCell>
                      <TableCell className="text-slate-600">{doc.locations || '-'}</TableCell>
                      <TableCell>
                        <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider bg-slate-100 px-2 py-1 rounded-md border border-slate-200">
                          {doc.businessModel || 'B2B'}
                        </span>
                      </TableCell>
                      <TableCell className="font-black text-indigo-600 text-right">{doc.weeklyAmount || '-'}</TableCell>
                      {isLeader && (
                        <TableCell>
                          <div className="flex items-center gap-1.5 text-xs text-slate-600 font-medium">
                            <User className="w-3 h-3 text-slate-400" />
                            {userMap[doc.userId] || 'Loading...'}
                          </div>
                        </TableCell>
                      )}
                      <TableCell className="text-slate-500 text-xs">
                        {doc.createdAt ? format(doc.createdAt.toDate(), 'MMM d, yyyy') : 'Recently'}
                      </TableCell>
                      <TableCell className="text-slate-500 text-xs font-semibold">
                        {doc.lastModifiedAt ? format(doc.lastModifiedAt.toDate(), 'MMM d, yyyy') : '-'}
                      </TableCell>
                      <TableCell>
                        <ChevronRight className="w-4 h-4 text-slate-400" />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredAndSortedDocs.map(doc => (
                <Card key={doc.id} className="group hover:shadow-lg transition-all duration-300 border-slate-200 cursor-pointer overflow-hidden" onClick={() => setSelectedDoc(doc)}>
                  <CardHeader className="bg-slate-50 border-b border-slate-100 pb-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-lg font-black text-primary line-clamp-1">
                          {doc.companyName || 'Unnamed Company'}
                        </CardTitle>
                        <CardDescription className="flex flex-col gap-1 mt-1 font-semibold text-xs text-slate-500">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-slate-400" />
                            <span>Created: {doc.createdAt ? format(doc.createdAt.toDate(), 'MMM d, yyyy') : 'Recently'}</span>
                          </span>
                          {doc.lastModifiedAt && (
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3 text-slate-400" />
                              <span>Modified: {format(doc.lastModifiedAt.toDate(), 'MMM d, yyyy')}</span>
                            </span>
                          )}
                          {isLeader && (
                            <span className="flex items-center gap-1 text-slate-500 font-bold mt-0.5">
                              <User className="w-3 h-3 text-slate-400" />
                              <span>Owner: {userMap[doc.userId] || 'Loading user...'}</span>
                            </span>
                          )}
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
        </>
      )}

      {/* Network Map Segment */}
      <div className="w-full flex flex-col items-center justify-center py-8 bg-white border border-slate-200/60 rounded-3xl p-6 shadow-sm gap-4">
        <div className="text-center space-y-1">
          <h3 className="text-base font-black text-slate-800 uppercase tracking-tight">Team Global Express Network Map</h3>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Western Australia logistics coverage and transit hub registry</p>
        </div>
        <img 
          src="/network-map.png" 
          alt="Team Global Express Parcel Network Western Australia" 
          className="w-full max-w-4xl rounded-2xl shadow-md border"
        />
      </div>
    </div>
  );
}
