import { useState, useEffect } from 'react';
import { useFirestore } from '@/firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Save, Trash2, Plus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

const BUSINESS_UNITS = ['Road Express', 'Ecommerce', 'Priority B2B', 'Courier', 'Premium', 'Freight'];

export function TwiwEditDialog({ submission, open, onOpenChange }: { submission: any, open: boolean, onOpenChange: (open: boolean) => void }) {
  const db = useFirestore();
  const { toast } = useToast();
  const [wins, setWins] = useState<any[]>([]);
  const [risks, setRisks] = useState<any[]>([]);
  const [updates, setUpdates] = useState('');
  const [projectedWins, setProjectedWins] = useState<any[]>([]);
  const [priorities, setPriorities] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (submission) {
      setWins(submission.wins || []);
      setRisks(submission.risks || []);
      setUpdates(submission.updates || '');
      setProjectedWins(submission.projectedWins || []);
      setPriorities(submission.priorities || []);
    }
  }, [submission]);

  if (!submission) return null;

  const handleSave = async () => {
    if (!db) return;
    setIsSaving(true);
    try {
      await setDoc(doc(db, 'twiwSubmissions', submission.id), {
        wins: wins.filter(w => w.customer.trim()),
        risks: risks.filter(r => r.account.trim()),
        updates: updates.trim(),
        projectedWins: projectedWins.filter(p => p.account.trim()),
        priorities: priorities.filter(p => p.trim()),
        updatedAt: serverTimestamp()
      }, { merge: true });
      toast({ title: "Submission Updated", description: "The report has been successfully updated." });
      onOpenChange(false);
    } catch (e) {
      toast({ variant: "destructive", title: "Failed to update submission" });
    } finally {
      setIsSaving(false);
    }
  };

  const updateWinField = (id: string, field: string, val: any) => setWins(wins.map(w => w.id === id ? { ...w, [field]: val } : w));
  const removeWinRow = (id: string) => setWins(wins.filter(w => w.id !== id));
  const addWinRow = () => setWins([...wins, { id: crypto.randomUUID(), customer: '', value: 0, updateText: '', businessUnits: [], salespersonName: '' }]);
  const toggleBusinessUnit = (id: string, bu: string) => {
    setWins(wins.map(w => {
      if (w.id !== id) return w;
      const bus = w.businessUnits || [];
      const newBus = bus.includes(bu) ? bus.filter((b: string) => b !== bu) : [...bus, bu];
      return { ...w, businessUnits: newBus };
    }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Submission - {submission.userName || submission.email}</DialogTitle>
          <DialogDescription>Modifying the TWTW report for this user.</DialogDescription>
        </DialogHeader>
        <div className="space-y-6 py-4">
          
          <div className="space-y-2">
            <h3 className="text-sm font-bold uppercase">Key Wins</h3>
            <div className="space-y-2">
              {wins.map((w, idx) => (
                <div key={w.id} className="p-3 bg-slate-50 border rounded-lg space-y-2 relative">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold">Win #{idx + 1}</span>
                    <Button variant="ghost" size="icon" onClick={() => removeWinRow(w.id)} className="h-6 w-6 text-red-500"><Trash2 className="w-3 h-3" /></Button>
                  </div>
                  <Input value={w.customer} onChange={e => updateWinField(w.id, 'customer', e.target.value)} placeholder="Customer" className="h-8 text-xs" />
                  <div className="flex gap-2">
                    <Input type="number" value={w.value || ''} onChange={e => updateWinField(w.id, 'value', parseFloat(e.target.value) || 0)} placeholder="Value" className="h-8 text-xs w-1/3" />
                    <Input value={w.salespersonName} onChange={e => updateWinField(w.id, 'salespersonName', e.target.value)} placeholder="Salesperson" className="h-8 text-xs flex-1" />
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {BUSINESS_UNITS.map(bu => (
                      <Badge key={bu} variant={(w.businessUnits || []).includes(bu) ? 'default' : 'outline'} className="cursor-pointer text-[9px] px-1 py-0" onClick={() => toggleBusinessUnit(w.id, bu)}>{bu}</Badge>
                    ))}
                  </div>
                  <Input value={w.updateText} onChange={e => updateWinField(w.id, 'updateText', e.target.value)} placeholder="Update text" className="h-8 text-xs" maxLength={200} />
                </div>
              ))}
              <Button onClick={addWinRow} variant="outline" size="sm" className="w-full text-xs"><Plus className="w-3 h-3 mr-1" /> Add Win</Button>
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-bold uppercase">Major Updates</h3>
            <Textarea value={updates} onChange={e => setUpdates(e.target.value)} placeholder="Key updates..." rows={4} className="text-xs" />
          </div>

        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={isSaving}>{isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />} Save Changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
