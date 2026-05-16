"use client";

import { useState } from 'react';
import { useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc, setDoc, serverTimestamp, deleteDoc } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Megaphone, XCircle, Loader2, Sparkles } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';

export function SystemBroadcast() {
  const db = useFirestore();
  const { toast } = useToast();
  const [message, setMessage] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

  const announcementDocRef = useMemoFirebase(() => {
    if (!db) return null;
    return doc(db, 'systemAnnouncements', 'current');
  }, [db]);
  const { data: activeAnnouncement } = useDoc(announcementDocRef);

  const handlePublish = async () => {
    if (!db || !message.trim()) return;
    setIsUpdating(true);
    try {
      await setDoc(doc(db, 'systemAnnouncements', 'current'), {
        message: message.trim(),
        active: true,
        updatedAt: serverTimestamp()
      });
      setMessage('');
      toast({ title: "Broadcast Active" });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleClear = async () => {
    if (!db) return;
    setIsUpdating(true);
    try {
      await deleteDoc(doc(db, 'systemAnnouncements', 'current'));
      toast({ title: "Broadcast Cleared" });
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <Card className="border-none shadow-xl bg-white overflow-hidden">
      <CardHeader className="bg-primary/5 border-b">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2 text-primary font-bold"><Megaphone className="w-5 h-5 text-accent" /> System Broadcast</CardTitle>
          {activeAnnouncement && <Badge className="bg-green-500 text-white animate-pulse">LIVE</Badge>}
        </div>
      </CardHeader>
      <CardContent className="pt-6 space-y-4">
        {activeAnnouncement ? (
          <div className="space-y-4">
            <div className="p-4 bg-accent/10 border border-accent/20 rounded-xl"><p className="text-sm font-medium">"{activeAnnouncement.message}"</p></div>
            <Button variant="outline" onClick={handleClear} disabled={isUpdating} className="w-full text-red-600 font-bold">{isUpdating ? <Loader2 className="animate-spin" /> : <XCircle className="mr-2 h-4 w-4" />} Deactivate</Button>
          </div>
        ) : (
          <div className="space-y-4">
            <Input placeholder="Message..." value={message} onChange={(e) => setMessage(e.target.value)} maxLength={140} className="h-12 border-primary/20"/>
            <Button className="w-full bg-accent text-white font-bold h-12" onClick={handlePublish} disabled={!message.trim() || isUpdating}>{isUpdating ? <Loader2 className="animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />} Publish</Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}