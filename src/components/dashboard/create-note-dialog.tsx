"use client";

import { useState, useMemo } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, addDoc, serverTimestamp, query } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { ClipboardList, Loader2, PlusCircle } from 'lucide-react';

export function CreateNoteDialog() {
  const db = useFirestore();
  const { toast } = useToast();
  const { profile, isLeader } = useAuth();
  
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formState, setFormState] = useState({
    userId: 'all',
    title: '',
    content: ''
  });

  // Fetch all users to target
  const usersQuery = useMemoFirebase(() => {
    if (!db || !open) return null; // Only fetch when open
    return query(collection(db, 'users'));
  }, [db, open]);
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

  if (!isLeader) return null;

  const handleSave = async () => {
    if (!db || !profile) return;
    if (!formState.userId) {
      toast({ title: 'Error', description: 'Please select a recipient.', variant: 'destructive' });
      return;
    }
    if (!formState.title.trim()) {
      toast({ title: 'Error', description: 'Please provide a title.', variant: 'destructive' });
      return;
    }
    if (!formState.content.trim()) {
      toast({ title: 'Error', description: 'Please provide some content.', variant: 'destructive' });
      return;
    }

    setIsSubmitting(true);
    try {
      if (formState.userId === 'all') {
        // Broadcast to all
        await Promise.all(targetUsers.map(u => 
          addDoc(collection(db, 'ambdNotes'), {
            userId: u.id,
            userName: u.name,
            title: formState.title,
            content: formState.content,
            status: 'UNREAD',
            createdAt: serverTimestamp(),
            createdBy: profile.uid,
            createdByName: profile.name || 'System Admin'
          })
        ));
      } else {
        // Single user
        const targetUser = targetUsers.find(u => u.id === formState.userId);
        if (!targetUser) throw new Error("User not found");
        
        await addDoc(collection(db, 'ambdNotes'), {
          userId: targetUser.id,
          userName: targetUser.name,
          title: formState.title,
          content: formState.content,
          status: 'UNREAD',
          createdAt: serverTimestamp(),
          createdBy: profile.uid,
          createdByName: profile.name || 'System Admin'
        });
      }

      toast({
        title: 'Success',
        description: `Note ${formState.userId === 'all' ? 'broadcasted to all' : 'sent'} successfully.`,
      });
      
      setFormState({ userId: 'all', title: '', content: '' });
      setOpen(false);
    } catch (error) {
      console.error("Error saving note:", error);
      toast({
        title: 'Error',
        description: 'Failed to send note.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 text-indigo-600 border-indigo-200 hover:bg-indigo-50">
          <PlusCircle className="w-4 h-4" />
          <span className="hidden sm:inline">New Note</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-indigo-600" />
            Create AM/BD Note
          </DialogTitle>
          <DialogDescription>
            Send a new note or update to a specific team member or broadcast to all.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Recipient</label>
            <Select 
              value={formState.userId} 
              onValueChange={(val) => setFormState(s => ({ ...s, userId: val }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a recipient..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="font-bold text-indigo-600">Broadcast to All (AMs & BDMs)</SelectItem>
                {targetUsers.map(u => (
                  <SelectItem key={u.id} value={u.id}>{u.name} ({u.role})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Title / Subject</label>
            <Input 
              placeholder="e.g. Weekly Update, Urgent Action Required" 
              value={formState.title}
              onChange={(e) => setFormState(s => ({ ...s, title: e.target.value }))}
            />
          </div>
          
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Message Content</label>
            <Textarea 
              placeholder="Write your note here..." 
              className="min-h-[150px]"
              value={formState.content}
              onChange={(e) => setFormState(s => ({ ...s, content: e.target.value }))}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button 
            className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2"
            onClick={handleSave}
            disabled={isSubmitting}
          >
            {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
            Send Note
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
