"use client";

import { useState, useMemo } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, query, where, orderBy } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ClipboardList, Plus, Trash2, Edit2, Calendar, User, Search, CheckCircle, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';

interface AMBDNote {
  id?: string;
  userId: string;
  userName: string;
  title: string;
  content: string;
  status: 'UNREAD' | 'READ';
  createdAt: any;
  readAt?: any;
  createdBy: string;
  createdByName: string;
}

export function AMBDManagement() {
  const db = useFirestore();
  const { toast } = useToast();
  const { profile } = useAuth();
  
  const [selectedNote, setSelectedNote] = useState<AMBDNote | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Advanced Filter State
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [filterUserId, setFilterUserId] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterContentQuery, setFilterContentQuery] = useState('');
  
  // Form State
  const [formState, setFormState] = useState({
    userId: '',
    title: '',
    content: ''
  });

  // Fetch all users to target
  const usersQuery = useMemoFirebase(() => {
    if (!db) return null;
    return query(collection(db, 'users'));
  }, [db]);
  const { data: allUsers } = useCollection(usersQuery);

  // Filter and de-duplicate targeted users (AMs and BDMs)
  const targetUsers = useMemo(() => {
    if (!allUsers) return [];
    const list = allUsers.filter(u => u.role === 'BDM' || u.role === 'ACCOUNT_MANAGER' || u.role === 'AM');
    
    const map = new Map<string, any>();
    list.forEach(u => {
      const key = (u.name || u.id || '').trim().toLowerCase();
      if (!key) return;
      const existing = map.get(key);
      if (!existing) {
        map.set(key, u);
      } else {
        const isRealUid = (id: string) => id.length === 28 && !id.includes('_');
        if (isRealUid(u.id) && !isRealUid(existing.id)) {
          map.set(key, u);
        }
      }
    });
    return Array.from(map.values());
  }, [allUsers]);

  // Fetch all AM/BD Notes
  const notesQuery = useMemoFirebase(() => {
    if (!db) return null;
    return query(collection(db, 'ambdNotes'), orderBy('createdAt', 'desc'));
  }, [db]);
  const { data: rawNotes, isLoading: isNotesLoading } = useCollection(notesQuery);

  const filteredNotes = useMemo(() => {
    if (!rawNotes) return [];
    let list = [...rawNotes];
    
    // Basic search query (covers name, title, and content)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(n => 
        n.userName?.toLowerCase().includes(q) || 
        n.title?.toLowerCase().includes(q) ||
        n.content?.toLowerCase().includes(q)
      );
    }
    
    // Advanced Filters
    if (showAdvancedFilters) {
      if (filterUserId !== 'all') {
        list = list.filter(n => n.userId === filterUserId);
      }
      
      if (filterStatus !== 'all') {
        list = list.filter(n => n.status === filterStatus);
      }
      
      if (filterContentQuery.trim()) {
        const q = filterContentQuery.toLowerCase();
        list = list.filter(n => n.content?.toLowerCase().includes(q));
      }
      
      if (filterStartDate) {
        const start = new Date(filterStartDate);
        list = list.filter(n => {
          const date = n.createdAt?.toDate ? n.createdAt.toDate() : new Date();
          return date >= start;
        });
      }
      
      if (filterEndDate) {
        const end = new Date(filterEndDate);
        end.setHours(23, 59, 59, 999);
        list = list.filter(n => {
          const date = n.createdAt?.toDate ? n.createdAt.toDate() : new Date();
          return date <= end;
        });
      }
    }
    
    return list as AMBDNote[];
  }, [rawNotes, searchQuery, showAdvancedFilters, filterUserId, filterStatus, filterContentQuery, filterStartDate, filterEndDate]);

  const handleStartCreate = () => {
    setFormState({
      userId: '',
      title: '',
      content: ''
    });
    setIsCreating(true);
    setSelectedNote(null);
    setIsEditing(true);
  };

  const handleSelectNote = (note: AMBDNote) => {
    setSelectedNote(note);
    setFormState({
      userId: note.userId,
      title: note.title || '',
      content: note.content || ''
    });
    setIsCreating(false);
    setIsEditing(false);
  };

  const handleStartEdit = (note: AMBDNote) => {
    setSelectedNote(note);
    setFormState({
      userId: note.userId,
      title: note.title || '',
      content: note.content || ''
    });
    setIsCreating(false);
    setIsEditing(true);
  };

  const handleSave = async () => {
    if (!db) return;
    if (!formState.userId) {
      toast({ variant: 'destructive', title: 'Validation Error', description: 'Please select a target user.' });
      return;
    }
    if (!formState.title.trim() || !formState.content.trim()) {
      toast({ variant: 'destructive', title: 'Validation Error', description: 'Please complete all fields.' });
      return;
    }

    const selectedUser = targetUsers.find(u => (u.id || u.uid) === formState.userId);
    const targetUserName = selectedUser?.name || 'Unknown User';

    try {
      const payload = {
        userId: formState.userId,
        userName: targetUserName,
        title: formState.title,
        content: formState.content,
        createdBy: profile?.uid || '',
        createdByName: profile?.name || 'Admin',
        updatedAt: serverTimestamp()
      };

      if (isCreating) {
        await addDoc(collection(db, 'ambdNotes'), {
          ...payload,
          status: 'UNREAD',
          createdAt: serverTimestamp()
        });
        toast({ title: 'Note Created', description: `Targeted note sent to ${targetUserName}.` });
      } else if (selectedNote?.id) {
        await updateDoc(doc(db, 'ambdNotes', selectedNote.id), payload);
        toast({ title: 'Note Updated', description: 'The note has been successfully updated.' });
      }
      setIsEditing(false);
      setIsCreating(false);
      setSelectedNote(null);
    } catch (e) {
      console.error(e);
      toast({ variant: 'destructive', title: 'Save Failed', description: 'Could not save targeted note.' });
    }
  };

  const handleDelete = async (noteId: string) => {
    if (!db || !confirm('Are you sure you want to delete this targeted note?')) return;
    try {
      await deleteDoc(doc(db, 'ambdNotes', noteId));
      toast({ title: 'Note Deleted' });
      setSelectedNote(null);
      setIsEditing(false);
      setIsCreating(false);
    } catch (e) {
      toast({ variant: 'destructive', title: 'Delete Failed' });
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black uppercase tracking-wider text-slate-900">AM/BD Notes & confirmations</h2>
          <p className="text-xs font-semibold text-slate-500">Send critical instructions and updates directly to AM/BDM dashboards.</p>
        </div>
        {!isEditing && (
          <Button onClick={handleStartCreate} className="bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold gap-2">
            <Plus className="w-4 h-4" /> Create Targeted Note
          </Button>
        )}
      </div>

      {!isEditing ? (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* List Sidebar */}
          <Card className="lg:col-span-1 border-none shadow-md bg-white rounded-3xl overflow-hidden">
            <CardHeader className="pb-3">
              <CardTitle className="text-xs font-black uppercase tracking-wider text-slate-900">Active Notes</CardTitle>
              <div className="relative mt-2">
                <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                <Input 
                  placeholder="Search notes..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 text-xs font-semibold rounded-xl border-slate-200"
                />
              </div>
              
              <div className="mt-2 flex justify-end">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                  className="text-[10px] font-black uppercase text-slate-500 hover:text-slate-800 h-7"
                >
                  {showAdvancedFilters ? 'Hide Advanced' : 'Advanced Search'}
                </Button>
              </div>

              {showAdvancedFilters && (
                <div className="mt-3 p-3 bg-slate-50 border rounded-2xl space-y-3 text-xs font-bold text-slate-700">
                  <div className="space-y-1">
                    <label className="text-[9px] uppercase font-black text-slate-400">Search Content</label>
                    <Input 
                      placeholder="Words inside note..." 
                      value={filterContentQuery}
                      onChange={(e) => setFilterContentQuery(e.target.value)}
                      className="text-xs font-semibold rounded-lg bg-white border-slate-200 h-8"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] uppercase font-black text-slate-400">Target User</label>
                    <Select value={filterUserId} onValueChange={setFilterUserId}>
                      <SelectTrigger className="h-8 rounded-lg text-xs font-bold border-slate-200 bg-white">
                        <SelectValue placeholder="All Users" />
                      </SelectTrigger>
                      <SelectContent className="max-h-[200px]">
                        <SelectItem value="all">All Users</SelectItem>
                        {targetUsers.map(u => (
                          <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] uppercase font-black text-slate-400">Status</label>
                    <Select value={filterStatus} onValueChange={setFilterStatus}>
                      <SelectTrigger className="h-8 rounded-lg text-xs font-bold border-slate-200 bg-white">
                        <SelectValue placeholder="All Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Status</SelectItem>
                        <SelectItem value="READ">Confirmed (Read)</SelectItem>
                        <SelectItem value="UNREAD">Pending (Unread)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-[9px] uppercase font-black text-slate-400">From Date</label>
                      <Input 
                        type="date"
                        value={filterStartDate}
                        onChange={(e) => setFilterStartDate(e.target.value)}
                        className="text-xs font-semibold rounded-lg bg-white border-slate-200 h-8"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] uppercase font-black text-slate-400">To Date</label>
                      <Input 
                        type="date"
                        value={filterEndDate}
                        onChange={(e) => setFilterEndDate(e.target.value)}
                        className="text-xs font-semibold rounded-lg bg-white border-slate-200 h-8"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-1.5 pt-1">
                    <Button 
                      variant="ghost" 
                      onClick={() => {
                        setFilterStartDate('');
                        setFilterEndDate('');
                        setFilterUserId('all');
                        setFilterStatus('all');
                        setFilterContentQuery('');
                      }} 
                      className="h-6 text-[9px] uppercase font-black text-slate-500 rounded-md"
                    >
                      Clear
                    </Button>
                  </div>
                </div>
              )}
            </CardHeader>
            <CardContent className="px-2">
              <div className="space-y-1 max-h-[500px] overflow-y-auto">
                {isNotesLoading ? (
                  <div className="p-4 text-center text-xs font-semibold text-slate-400">Loading...</div>
                ) : filteredNotes.length === 0 ? (
                  <div className="p-4 text-center text-xs font-semibold text-slate-400">No notes found</div>
                ) : (
                  filteredNotes.map((note) => {
                    const isSelected = selectedNote?.id === note.id;
                    return (
                      <button
                        key={note.id}
                        onClick={() => handleSelectNote(note)}
                        className={`w-full text-left p-3.5 rounded-2xl transition-all duration-200 border ${
                          isSelected 
                            ? 'bg-slate-900 text-white border-slate-900' 
                            : 'hover:bg-slate-50 border-transparent text-slate-800'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className={`text-[9px] font-black uppercase tracking-wider ${isSelected ? 'text-indigo-300' : 'text-indigo-600'}`}>
                            {note.userName}
                          </span>
                          <Badge className={`text-[8px] font-black uppercase tracking-wider ${
                            note.status === 'READ' ? 'bg-emerald-500/20 text-emerald-600 border-none' : 'bg-amber-500/20 text-amber-600 border-none'
                          }`}>
                            {note.status === 'READ' ? 'Confirmed' : 'Pending'}
                          </Badge>
                        </div>
                        <div className="text-xs font-black line-clamp-1 mb-0.5">{note.title}</div>
                        <div className={`text-[9px] font-semibold ${isSelected ? 'text-slate-300' : 'text-slate-500'}`}>
                          {note.createdAt?.toDate ? format(note.createdAt.toDate(), 'dd MMM yyyy, HH:mm') : 'Recently'}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </CardContent>
          </Card>

          {/* Details view */}
          <Card className="lg:col-span-3 border-none shadow-md bg-white rounded-3xl overflow-hidden min-h-[400px]">
            {selectedNote ? (
              <div>
                <CardHeader className="border-b border-slate-100 pb-4 bg-slate-50/50 flex flex-row justify-between items-center gap-4">
                  <div>
                    <CardTitle className="text-sm font-black uppercase tracking-wider text-slate-900">Targeted Update details</CardTitle>
                    <CardDescription className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">
                      Sent to {selectedNote.userName} by {selectedNote.createdByName}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button onClick={() => handleStartEdit(selectedNote)} variant="outline" size="sm" className="rounded-xl border-slate-200 text-xs font-bold gap-2">
                      <Edit2 className="w-3.5 h-3.5" /> Edit
                    </Button>
                    <Button onClick={() => selectedNote.id && handleDelete(selectedNote.id)} variant="destructive" size="sm" className="rounded-xl text-xs font-bold gap-2">
                      <Trash2 className="w-3.5 h-3.5" /> Delete
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="p-6 space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100 text-xs font-bold text-slate-700">
                    <div>
                      <span className="text-[9px] uppercase font-black text-slate-400 block mb-0.5">Target BDM/AM</span>
                      <span className="text-slate-900 font-extrabold">{selectedNote.userName}</span>
                    </div>
                    <div>
                      <span className="text-[9px] uppercase font-black text-slate-400 block mb-0.5">Date Sent</span>
                      <span className="text-slate-900 font-extrabold">
                        {selectedNote.createdAt?.toDate ? format(selectedNote.createdAt.toDate(), 'dd MMM yyyy, HH:mm') : 'Pending'}
                      </span>
                    </div>
                    <div>
                      <span className="text-[9px] uppercase font-black text-slate-400 block mb-0.5">Status</span>
                      <Badge className={`text-[9px] font-black uppercase tracking-wider ${
                        selectedNote.status === 'READ' ? 'bg-emerald-500/20 text-emerald-600 border-none' : 'bg-amber-500/20 text-amber-600 border-none'
                      }`}>
                        {selectedNote.status === 'READ' ? `Confirmed at ${selectedNote.readAt?.toDate ? format(selectedNote.readAt.toDate(), 'dd MMM yyyy, HH:mm') : ''}` : 'Pending Confirmation'}
                      </Badge>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <h3 className="text-xs font-black uppercase tracking-wider text-slate-400">Title</h3>
                    <p className="text-sm font-black text-slate-900">{selectedNote.title}</p>
                  </div>

                  <div className="space-y-2">
                    <h3 className="text-xs font-black uppercase tracking-wider text-slate-400">Content / Instruction</h3>
                    <p className="text-xs font-semibold text-slate-700 whitespace-pre-wrap leading-relaxed bg-slate-50/50 p-4 rounded-xl border border-slate-100">
                      {selectedNote.content}
                    </p>
                  </div>
                </CardContent>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-32 text-center space-y-4">
                <ClipboardList className="w-16 h-16 text-slate-200" />
                <div>
                  <h3 className="text-sm font-black uppercase tracking-wider text-slate-950">No note selected</h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                    Select a note from the list or create a new targeted message
                  </p>
                </div>
              </div>
            )}
          </Card>
        </div>
      ) : (
        /* Creating / Editing Form View */
        <Card className="border-none shadow-xl bg-white rounded-3xl overflow-hidden">
          <CardHeader className="bg-slate-900 text-white p-6">
            <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-indigo-400" />
              {isCreating ? 'Create Targeted Update' : 'Edit Targeted Update'}
            </CardTitle>
            <CardDescription className="text-slate-400 text-xs font-semibold mt-0.5">
              Fill in the form to target an instruction or note to an Account Manager or BDM.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50 p-6 rounded-2xl border border-slate-100">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-slate-900 block">Target BDM / Account Manager</label>
                <Select value={formState.userId} onValueChange={(val) => setFormState(prev => ({ ...prev, userId: val }))}>
                  <SelectTrigger className="rounded-xl text-xs font-bold border-slate-200 bg-white">
                    <SelectValue placeholder="Select Target User" />
                  </SelectTrigger>
                  <SelectContent>
                    {targetUsers.map(u => {
                      const uId = u.id || u.uid;
                      return (
                        <SelectItem key={uId} value={uId}>{u.name} ({u.role})</SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-slate-900 block">Title</label>
                <Input 
                  placeholder="e.g. Action Required: Customer Price Adjustment" 
                  value={formState.title}
                  onChange={(e) => setFormState(prev => ({ ...prev, title: e.target.value }))}
                  className="rounded-xl text-xs font-bold border-slate-200 bg-white" 
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-black uppercase text-slate-900 block">Instruction / Update Content</label>
              <Textarea 
                placeholder="Write the notes, updates, or action items here..."
                value={formState.content}
                onChange={(e) => setFormState(prev => ({ ...prev, content: e.target.value }))}
                className="rounded-2xl border-slate-200 text-xs font-semibold min-h-[180px]" 
              />
            </div>

            <div className="flex justify-end gap-3 pt-6 border-t border-slate-100">
              <Button onClick={() => {
                setIsEditing(false);
                setIsCreating(false);
              }} variant="ghost" className="rounded-xl text-xs font-bold uppercase tracking-wider">
                Cancel
              </Button>
              <Button onClick={handleSave} className="bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold uppercase tracking-wider px-6">
                Save & Broadcast Target
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
