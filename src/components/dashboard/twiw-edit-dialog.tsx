import { useState, useEffect } from 'react';
import { useFirestore } from '@/firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Save, Trash2, Plus, CalendarIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarUI } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

const BUSINESS_UNITS = ['Road Express', 'Ecommerce', 'Priority B2B', 'Courier', 'Premium', 'Freight'];

export function TwiwEditDialog({ submission, open, onOpenChange }: { submission: any, open: boolean, onOpenChange: (open: boolean) => void }) {
  const db = useFirestore();
  const { toast } = useToast();
  const [wins, setWins] = useState<any[]>([]);
  const [risks, setRisks] = useState<any[]>([]);
  const [updates, setUpdates] = useState('');
  const [majorUpdates, setMajorUpdates] = useState<any[]>([]);
  const [projectedWins, setProjectedWins] = useState<any[]>([]);
  const [priorities, setPriorities] = useState<any[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (submission) {
      setWins((submission.wins || []).map((w: any) => ({ ...w, id: w.id || crypto.randomUUID() })));
      setRisks((submission.risks || []).map((r: any) => ({ ...r, id: r.id || crypto.randomUUID() })));
      setUpdates(submission.updates || '');
      setMajorUpdates((submission.majorUpdates || []).map((m: any) => ({ ...m, id: m.id || crypto.randomUUID() })));
      setProjectedWins((submission.projectedWins || []).map((p: any) => ({ ...p, id: p.id || crypto.randomUUID() })));
      setPriorities((submission.priorities || []).map((pr: any) => ({ ...pr, id: pr.id || crypto.randomUUID() })));
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
        majorUpdates: majorUpdates.filter(m => m.customer.trim() || m.updateText.trim()),
        projectedWins: projectedWins.filter(p => p.account.trim()),
        priorities: priorities.filter(p => p.text.trim()),
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

  const updateField = (setter: any, items: any[], id: string, field: string, val: any) => {
    setter(items.map(i => i.id === id ? { ...i, [field]: val } : i));
  };
  
  const removeRow = (setter: any, items: any[], id: string) => setter(items.filter(i => i.id !== id));
  
  const addWinRow = () => setWins([...wins, { id: crypto.randomUUID(), customer: '', value: 0, updateText: '', businessUnits: [], salespersonName: '' }]);
  const addRiskRow = () => setRisks([...risks, { id: crypto.randomUUID(), account: '', value: 0, mitigation: '', salespersonName: '' }]);
  const addMajorUpdateRow = () => setMajorUpdates([...majorUpdates, { id: crypto.randomUUID(), customer: '', value: 0, updateText: '', businessUnits: [], salespersonName: '' }]);
  const addProjectedRow = () => setProjectedWins([...projectedWins, { id: crypto.randomUUID(), account: '', value: 0, expectedDate: format(new Date(), 'dd-MM-yyyy'), updateText: '', salespersonName: '' }]);
  const addPriorityRow = () => setPriorities([...priorities, { id: crypto.randomUUID(), text: '', salespersonName: '' }]);

  const toggleBU = (setter: any, items: any[], id: string, bu: string) => {
    setter(items.map(i => {
      if (i.id !== id) return i;
      const bus = i.businessUnits || [];
      const newBus = bus.includes(bu) ? bus.filter((b: string) => b !== bu) : [...bus, bu];
      return { ...i, businessUnits: newBus };
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
                    <Button variant="ghost" size="icon" onClick={() => removeRow(setWins, wins, w.id)} className="h-6 w-6 text-red-500"><Trash2 className="w-3 h-3" /></Button>
                  </div>
                  <Input value={w.customer} onChange={e => updateField(setWins, wins, w.id, 'customer', e.target.value)} placeholder="Customer" className="h-8 text-xs" />
                  <div className="flex gap-2">
                    <Input type="number" value={w.value || ''} onChange={e => updateField(setWins, wins, w.id, 'value', parseFloat(e.target.value) || 0)} placeholder="Value" className="h-8 text-xs w-1/3" />
                    <Input value={w.salespersonName} onChange={e => updateField(setWins, wins, w.id, 'salespersonName', e.target.value)} placeholder="Salesperson" className="h-8 text-xs flex-1" />
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {BUSINESS_UNITS.map(bu => (
                      <Badge key={bu} variant={(w.businessUnits || []).includes(bu) ? 'default' : 'outline'} className="cursor-pointer text-[9px] px-1 py-0" onClick={() => toggleBU(setWins, wins, w.id, bu)}>{bu}</Badge>
                    ))}
                  </div>
                  <Input value={w.updateText} onChange={e => updateField(setWins, wins, w.id, 'updateText', e.target.value)} placeholder="Update text" className="h-8 text-xs" maxLength={200} />
                </div>
              ))}
              <Button onClick={addWinRow} variant="outline" size="sm" className="w-full text-xs"><Plus className="w-3 h-3 mr-1" /> Add Win</Button>
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-bold uppercase">Major Updates</h3>
            {updates && majorUpdates.length === 0 && (
              <div className="p-3 bg-amber-50 border border-amber-100 rounded-lg">
                <p className="text-xs text-amber-800 font-medium mb-1">Legacy Update Format:</p>
                <Textarea value={updates} onChange={e => setUpdates(e.target.value)} rows={3} className="text-xs" />
              </div>
            )}
            <div className="space-y-2">
              {majorUpdates.map((m, idx) => (
                <div key={m.id} className="p-3 bg-slate-50 border rounded-lg space-y-2 relative">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold">Update #{idx + 1}</span>
                    <Button variant="ghost" size="icon" onClick={() => removeRow(setMajorUpdates, majorUpdates, m.id)} className="h-6 w-6 text-red-500"><Trash2 className="w-3 h-3" /></Button>
                  </div>
                  <Input value={m.customer} onChange={e => updateField(setMajorUpdates, majorUpdates, m.id, 'customer', e.target.value)} placeholder="Customer" className="h-8 text-xs" />
                  <div className="flex gap-2">
                    <Input type="number" value={m.value || ''} onChange={e => updateField(setMajorUpdates, majorUpdates, m.id, 'value', parseFloat(e.target.value) || 0)} placeholder="Value" className="h-8 text-xs w-1/3" />
                    <Input value={m.salespersonName} onChange={e => updateField(setMajorUpdates, majorUpdates, m.id, 'salespersonName', e.target.value)} placeholder="Salesperson" className="h-8 text-xs flex-1" />
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {BUSINESS_UNITS.map(bu => (
                      <Badge key={bu} variant={(m.businessUnits || []).includes(bu) ? 'default' : 'outline'} className="cursor-pointer text-[9px] px-1 py-0" onClick={() => toggleBU(setMajorUpdates, majorUpdates, m.id, bu)}>{bu}</Badge>
                    ))}
                  </div>
                  <Input value={m.updateText} onChange={e => updateField(setMajorUpdates, majorUpdates, m.id, 'updateText', e.target.value)} placeholder="Update text" className="h-8 text-xs" maxLength={200} />
                </div>
              ))}
              <Button onClick={addMajorUpdateRow} variant="outline" size="sm" className="w-full text-xs"><Plus className="w-3 h-3 mr-1" /> Add Major Update</Button>
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-bold uppercase">Churn Risks</h3>
            <div className="space-y-2">
              {risks.map((r, idx) => (
                <div key={r.id} className="p-3 bg-slate-50 border rounded-lg space-y-2 relative">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold">Risk #{idx + 1}</span>
                    <Button variant="ghost" size="icon" onClick={() => removeRow(setRisks, risks, r.id)} className="h-6 w-6 text-red-500"><Trash2 className="w-3 h-3" /></Button>
                  </div>
                  <Input value={r.account} onChange={e => updateField(setRisks, risks, r.id, 'account', e.target.value)} placeholder="Account" className="h-8 text-xs" />
                  <div className="flex gap-2">
                    <Input type="number" value={r.value || ''} onChange={e => updateField(setRisks, risks, r.id, 'value', parseFloat(e.target.value) || 0)} placeholder="Value" className="h-8 text-xs w-1/3" />
                    <Input value={r.salespersonName} onChange={e => updateField(setRisks, risks, r.id, 'salespersonName', e.target.value)} placeholder="Salesperson" className="h-8 text-xs flex-1" />
                  </div>
                  <Input value={r.mitigation} onChange={e => updateField(setRisks, risks, r.id, 'mitigation', e.target.value)} placeholder="Mitigation" className="h-8 text-xs" />
                </div>
              ))}
              <Button onClick={addRiskRow} variant="outline" size="sm" className="w-full text-xs"><Plus className="w-3 h-3 mr-1" /> Add Risk</Button>
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-bold uppercase">Projected Wins</h3>
            <div className="space-y-2">
              {projectedWins.map((p, idx) => {
                const dateParts = p.expectedDate ? p.expectedDate.split('-') : [];
                const selectedDate = dateParts.length === 3 ? new Date(parseInt(dateParts[2]), parseInt(dateParts[1]) - 1, parseInt(dateParts[0])) : undefined;
                return (
                <div key={p.id} className="p-3 bg-slate-50 border rounded-lg space-y-2 relative">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold">Projected #{idx + 1}</span>
                    <Button variant="ghost" size="icon" onClick={() => removeRow(setProjectedWins, projectedWins, p.id)} className="h-6 w-6 text-red-500"><Trash2 className="w-3 h-3" /></Button>
                  </div>
                  <Input value={p.account} onChange={e => updateField(setProjectedWins, projectedWins, p.id, 'account', e.target.value)} placeholder="Account" className="h-8 text-xs" />
                  <div className="flex gap-2">
                    <Input type="number" value={p.value || ''} onChange={e => updateField(setProjectedWins, projectedWins, p.id, 'value', parseFloat(e.target.value) || 0)} placeholder="Value" className="h-8 text-xs w-1/3" />
                    <Input value={p.salespersonName} onChange={e => updateField(setProjectedWins, projectedWins, p.id, 'salespersonName', e.target.value)} placeholder="Salesperson" className="h-8 text-xs flex-1" />
                  </div>
                  <div className="flex gap-2">
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className={cn("w-1/3 h-8 px-2 text-left font-normal text-xs bg-white", !p.expectedDate && "text-muted-foreground")}>
                          <CalendarIcon className="mr-2 h-3 w-3" />
                          {p.expectedDate ? p.expectedDate : <span>Pick date</span>}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <CalendarUI
                          mode="single"
                          selected={selectedDate}
                          onSelect={(d) => updateField(setProjectedWins, projectedWins, p.id, 'expectedDate', d ? format(d, 'dd-MM-yyyy') : '')}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <Input value={p.updateText} onChange={e => updateField(setProjectedWins, projectedWins, p.id, 'updateText', e.target.value)} placeholder="Update text" className="h-8 text-xs flex-1" maxLength={200} />
                  </div>
                </div>
              )})}
              <Button onClick={addProjectedRow} variant="outline" size="sm" className="w-full text-xs"><Plus className="w-3 h-3 mr-1" /> Add Projected Win</Button>
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-bold uppercase">Priorities</h3>
            <div className="space-y-2">
              {priorities.map((p, idx) => (
                <div key={p.id} className="p-3 bg-slate-50 border rounded-lg space-y-2 relative flex gap-2">
                  <Input value={p.text} onChange={e => updateField(setPriorities, priorities, p.id, 'text', e.target.value)} placeholder="Priority" className="h-8 text-xs flex-1" />
                  <Input value={p.salespersonName} onChange={e => updateField(setPriorities, priorities, p.id, 'salespersonName', e.target.value)} placeholder="Salesperson" className="h-8 text-xs w-[30%]" />
                  <Button variant="ghost" size="icon" onClick={() => removeRow(setPriorities, priorities, p.id)} className="h-8 w-8 text-red-500"><Trash2 className="w-3 h-3" /></Button>
                </div>
              ))}
              <Button onClick={addPriorityRow} variant="outline" size="sm" className="w-full text-xs"><Plus className="w-3 h-3 mr-1" /> Add Priority</Button>
            </div>
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
