"use client";

import { useState, useMemo } from 'react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection } from 'firebase/firestore';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format, isSameDay } from 'date-fns';
import { Search, Calendar, FileSearch, ArrowUpDown } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';

interface FFNote {
  docId: string;
  companyName: string;
  note: string;
  createdAt: Date;
  createdByName: string;
  createdBy: string;
}

export function FFAdminHub() {
  const db = useFirestore();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDate, setFilterDate] = useState('');
  const [filterOwner, setFilterOwner] = useState('all');
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' }>({ key: 'createdAt', direction: 'desc' });

  const ffQuery = useMemoFirebase(() => {
    if (!db) return null;
    return collection(db, 'factFindingDocs');
  }, [db]);
  const { data: rawFFDocs, isLoading } = useCollection(ffQuery);

  const allNotes = useMemo(() => {
    if (!rawFFDocs) return [];
    const notes: FFNote[] = [];
    rawFFDocs.forEach((doc: any) => {
      if (doc.archivedNotes && Array.isArray(doc.archivedNotes)) {
        doc.archivedNotes.forEach((n: any) => {
          notes.push({
            docId: doc.id,
            companyName: doc.companyName || doc.customerName || 'Unknown Company',
            note: n.note || '',
            createdAt: n.createdAt?.toDate ? n.createdAt.toDate() : new Date(n.createdAt),
            createdByName: n.createdByName || 'Unknown User',
            createdBy: n.createdBy || '',
          });
        });
      }
    });
    return notes;
  }, [rawFFDocs]);

  const uniqueOwners = useMemo(() => {
    const owners = new Set<string>();
    allNotes.forEach(n => owners.add(n.createdByName));
    return Array.from(owners).sort();
  }, [allNotes]);

  const filteredAndSortedNotes = useMemo(() => {
    let list = [...allNotes];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(n => 
        n.companyName.toLowerCase().includes(q) || 
        n.note.toLowerCase().includes(q) ||
        n.createdByName.toLowerCase().includes(q)
      );
    }

    if (filterOwner !== 'all') {
      list = list.filter(n => n.createdByName === filterOwner);
    }

    if (filterDate) {
      const targetDate = new Date(filterDate);
      list = list.filter(n => isSameDay(n.createdAt, targetDate));
    }

    list.sort((a, b) => {
      let valA: any = a[sortConfig.key as keyof FFNote];
      let valB: any = b[sortConfig.key as keyof FFNote];
      
      if (sortConfig.key === 'createdAt') {
        valA = valA.getTime();
        valB = valB.getTime();
      } else if (typeof valA === 'string') {
        valA = valA.toLowerCase();
        valB = valB.toLowerCase();
      }

      if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
      if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });

    return list;
  }, [allNotes, searchQuery, filterOwner, filterDate, sortConfig]);

  const toggleSort = (key: string) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const handleCompanyClick = (docId: string) => {
    window.dispatchEvent(new CustomEvent('switch-view', {
      detail: {
        view: 'FACT_FINDING',
        params: { docId }
      }
    }));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight flex items-center gap-2">
            <FileSearch className="w-6 h-6 text-accent" /> Fact Finding Admin
          </h1>
          <p className="text-sm text-muted-foreground font-medium">Review and audit all historical Fact Finding notes across the team.</p>
        </div>
      </div>

      <Card className="border-border shadow-sm">
        <CardHeader className="bg-secondary/30 border-b border-border/60 pb-4">
          <div className="flex flex-col lg:flex-row gap-4 items-end">
            <div className="flex-1 w-full space-y-1">
              <label className="text-xs font-semibold text-muted-foreground">Search Notes / Company</label>
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Search..." 
                  className="pl-9 h-10 border-border"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
            
            <div className="w-full lg:w-48 space-y-1">
              <label className="text-xs font-semibold text-muted-foreground">Filter Owner</label>
              <Select value={filterOwner} onValueChange={setFilterOwner}>
                <SelectTrigger className="h-10 bg-card">
                  <SelectValue placeholder="All Owners" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Owners</SelectItem>
                  {uniqueOwners.map(owner => (
                    <SelectItem key={owner} value={owner}>{owner}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="w-full lg:w-48 space-y-1">
              <label className="text-xs font-semibold text-muted-foreground">Filter Day</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input 
                  type="date"
                  className="pl-9 h-10 border-border"
                  value={filterDate}
                  onChange={e => setFilterDate(e.target.value)}
                />
              </div>
            </div>
            
            {(filterDate || filterOwner !== 'all' || searchQuery) && (
              <Button 
                variant="ghost" 
                onClick={() => { setFilterDate(''); setFilterOwner('all'); setSearchQuery(''); }}
                className="h-10 text-xs font-bold text-muted-foreground hover:text-foreground"
              >
                Clear
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="rounded-md border-0">
            <Table>
              <TableHeader className="bg-secondary/50">
                <TableRow>
                  <TableHead className="w-[180px]">
                    <Button variant="ghost" onClick={() => toggleSort('createdAt')} className="h-8 flex items-center gap-1 text-xs font-semibold text-muted-foreground p-0 hover:bg-transparent">
                      Date & Time <ArrowUpDown className="w-3 h-3 ml-1" />
                    </Button>
                  </TableHead>
                  <TableHead className="w-[150px]">
                    <Button variant="ghost" onClick={() => toggleSort('createdByName')} className="h-8 flex items-center gap-1 text-xs font-semibold text-muted-foreground p-0 hover:bg-transparent">
                      Owner <ArrowUpDown className="w-3 h-3 ml-1" />
                    </Button>
                  </TableHead>
                  <TableHead className="w-[200px]">
                    <Button variant="ghost" onClick={() => toggleSort('companyName')} className="h-8 flex items-center gap-1 text-xs font-semibold text-muted-foreground p-0 hover:bg-transparent">
                      Company <ArrowUpDown className="w-3 h-3 ml-1" />
                    </Button>
                  </TableHead>
                  <TableHead className="text-xs font-semibold uppercase text-muted-foreground py-3">Note</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Loading notes...</TableCell></TableRow>
                ) : filteredAndSortedNotes.length === 0 ? (
                  <TableRow><TableCell colSpan={4} className="p-4"><EmptyState compact className="border-none" title="No notes found" description="No notes match your criteria." /></TableCell></TableRow>
                ) : (
                  filteredAndSortedNotes.map((note, idx) => (
                    <TableRow key={idx} className="hover:bg-secondary/30 transition-colors">
                      <TableCell className="align-top py-4">
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-foreground">{format(note.createdAt, 'MMM d, yyyy')}</span>
                          <span className="text-xs text-muted-foreground font-medium">{format(note.createdAt, 'h:mm a')}</span>
                        </div>
                      </TableCell>
                      <TableCell className="align-top py-4">
                        <Badge variant="outline" className="bg-card border-border text-foreground/85 shadow-sm">{note.createdByName}</Badge>
                      </TableCell>
                      <TableCell className="align-top py-4">
                        <button 
                          onClick={() => handleCompanyClick(note.docId)}
                          className="text-sm font-bold text-accent hover:text-primary hover:underline text-left"
                        >
                          {note.companyName}
                        </button>
                      </TableCell>
                      <TableCell className="align-top py-4">
                        <p className="text-sm text-foreground/85 whitespace-pre-wrap leading-relaxed">{note.note}</p>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
