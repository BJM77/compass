"use client";

import { useState } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, doc, setDoc, serverTimestamp, deleteDoc } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserPlus, Save, Loader2, ShieldCheck, Trash2, Edit3, DollarSign, Mail, Map, UserCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';

interface UserManagementProps {
  onSimulate?: (userId: string) => void;
}

export function UserManagement({ onSimulate }: UserManagementProps) {
  const { isGM } = useAuth();
  const db = useFirestore();
  const { toast } = useToast();
  const usersQuery = useMemoFirebase(() => db ? collection(db, 'users') : null, [db]);
  const { data: users, isLoading } = useCollection(usersQuery);

  const [formData, setFormData] = useState({ id: '', name: '', email: '', role: 'BDM', territory: 'FLEX', state: 'WA', target: '2500000' });
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!db || !formData.id) return;
    setIsSaving(true);
    try {
      const target = parseFloat(formData.target) || 0;
      await setDoc(doc(db, 'users', formData.id), { ...formData, target }, { merge: true });
      if (formData.role !== 'LEADER') {
        await setDoc(doc(db, 'bdmStats', formData.id), { 
          id: formData.id, 
          name: formData.name, 
          email: formData.email,
          territory: formData.territory, 
          state: formData.state,
          role: formData.role, 
          target, 
          updatedAt: serverTimestamp() 
        }, { merge: true });
      }
      toast({ title: "Node Provisioned" });
      setFormData({ id: '', name: '', email: '', role: 'BDM', territory: 'FLEX', state: 'WA', target: '2500000' });
    } catch (e) {
      toast({ variant: "destructive", title: "Save Failed" });
    } finally { setIsSaving(false); }
  };

  const handleEdit = (u: any) => {
    setFormData({ id: u.id, name: u.name, email: u.email || '', role: u.role, territory: u.territory || 'FLEX', state: u.state || 'WA', target: u.target?.toString() || '2500000' });
  };

  const handleRemove = async (u: any) => {
    if (!db) return;
    if(confirm(`Remove ${u.name}?`)) {
      await deleteDoc(doc(db, 'users', u.id));
      await deleteDoc(doc(db, 'bdmStats', u.id));
      toast({ title: "Removed" });
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
      {isGM && (
        <div className="lg:col-span-5">
          <Card className="border-none shadow-xl">
            <CardHeader className="bg-primary/5"><CardTitle className="text-xl font-bold flex items-center gap-2"><UserPlus className="w-5 h-5" /> Provisioning</CardTitle></CardHeader>
            <CardContent className="pt-6">
              <form onSubmit={handleSave} className="space-y-6">
                <div className="space-y-4">
                  <div className="space-y-1"><Label className="text-xs font-bold text-muted-foreground uppercase">Firebase UID</Label><Input value={formData.id} onChange={e => setFormData({...formData, id: e.target.value})} required /></div>
                  <div className="space-y-1"><Label className="text-xs font-bold text-muted-foreground uppercase">Full Name</Label><Input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} required /></div>
                  <div className="space-y-1"><Label className="text-xs font-bold text-muted-foreground uppercase">Email</Label><Input value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} required /></div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1"><Label className="text-xs font-bold text-muted-foreground uppercase">Role</Label><Select value={formData.role} onValueChange={v => setFormData({...formData, role: v})}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="BDM">BDM</SelectItem><SelectItem value="ACCOUNT_MANAGER">AM</SelectItem><SelectItem value="LEADER">Leader</SelectItem><SelectItem value="GM">GM</SelectItem></SelectContent></Select></div>
                    <div className="space-y-1"><Label className="text-xs font-bold text-muted-foreground uppercase">Territory</Label><Select value={formData.territory} onValueChange={v => setFormData({...formData, territory: v})}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="METRO_NORTH">North</SelectItem><SelectItem value="METRO_SOUTH">South</SelectItem><SelectItem value="WESTERN_TRADE_COAST">Trade Coast</SelectItem><SelectItem value="REGIONAL">Regional</SelectItem><SelectItem value="FLEX">Flex</SelectItem></SelectContent></Select></div>
                    <div className="space-y-1"><Label className="text-xs font-bold text-muted-foreground uppercase">State</Label><Select value={formData.state} onValueChange={v => setFormData({...formData, state: v})}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="WA">WA</SelectItem><SelectItem value="NSW">NSW</SelectItem><SelectItem value="QLD">QLD</SelectItem><SelectItem value="VIC">VIC</SelectItem><SelectItem value="SA">SA</SelectItem><SelectItem value="TAS">TAS</SelectItem></SelectContent></Select></div>
                  </div>
                  <div className="space-y-1"><Label className="text-xs font-bold text-muted-foreground uppercase">Target</Label><Input type="number" value={formData.target} onChange={e => setFormData({...formData, target: e.target.value})} required /></div>
                </div>
                <Button type="submit" className="w-full bg-primary font-bold h-12 uppercase" disabled={isSaving}>{isSaving ? <Loader2 className="animate-spin" /> : <><Save className="w-4 h-4 mr-2" /> Sync Node</>}</Button>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
      <div className={!isGM ? "lg:col-span-12" : "lg:col-span-7"}>
        <Card className="border-none shadow-xl overflow-hidden">
          <CardHeader className="border-b"><CardTitle className="text-xl font-bold flex items-center gap-2"><ShieldCheck className="text-green-600" /> Registry</CardTitle></CardHeader>
          <CardContent className="p-0">
            {isLoading ? <div className="py-20 text-center"><Loader2 className="animate-spin mx-auto" /></div> : (
              <div className="divide-y">{users?.map(u => (
                <div key={u.id} className="p-6 flex items-center justify-between hover:bg-slate-50 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-primary text-white flex items-center justify-center font-bold">{(u.name || 'U').charAt(0)}</div>
                    <div>
                      <div className="font-bold uppercase">{u.name} <Badge className="bg-accent text-[9px] uppercase ml-2">{u.role}</Badge></div>
                      <div className="text-[10px] text-muted-foreground font-black uppercase mt-1"><Mail className="w-3 h-3 inline mr-1" />{u.email} • <Map className="w-3 h-3 inline mx-1" />{u.territory} ({u.state || 'WA'}) • Target: ${(Number(u.target) || 0).toLocaleString()}</div>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    {onSimulate && u.role !== 'LEADER' && (
                      <Button 
                        size="icon" 
                        variant="ghost" 
                        className="text-accent hover:bg-accent/10" 
                        onClick={() => onSimulate(u.id)}
                        title="Simulate User View"
                      >
                        <UserCircle className="w-4 h-4" />
                      </Button>
                    )}
                    {isGM && (
                      <>
                        <Button size="icon" variant="ghost" onClick={() => handleEdit(u)} title="Edit User"><Edit3 className="w-4 h-4" /></Button>
                        <Button size="icon" variant="ghost" className="text-red-400" onClick={() => handleRemove(u)} title="Remove User"><Trash2 className="w-4 h-4" /></Button>
                      </>
                    )}
                  </div>
                </div>
              ))}</div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}