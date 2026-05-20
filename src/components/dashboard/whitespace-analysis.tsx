
"use client";

import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { 
  Loader2, FileDown, Target, Zap, TrendingUp, Search, 
  ShieldCheck, LayoutGrid, Box, Activity, Info, DollarSign,
  RotateCcw, Save
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useFirestore } from '@/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { jsPDF } from "jspdf";
import { cn } from '@/lib/utils';
import { addWeeks } from 'date-fns';

const SERVICES = ["Road", "Air", "B2C", "International", "Courier"];
const STATES = ["EXPAND", "MAINTAIN", "TARGET", "WHITE_SPACE"] as const;
const PRIORITIES = ["HIGH", "MEDIUM", "LOW"] as const;

type ServiceState = typeof STATES[number];
type Priority = typeof PRIORITIES[number];

interface ServiceConfig {
  state: ServiceState;
  priority: Priority;
  rationale: string;
  currentSpend: number | '';
  totalWallet: number | '';
}

const INITIAL_SERVICE_CONFIG = SERVICES.reduce((acc, service) => ({
  ...acc,
  [service]: { state: 'WHITE_SPACE', priority: 'LOW', rationale: '', currentSpend: '', totalWallet: '' }
}), {});

export function WhitespaceAnalysis({ userId }: { userId: string }) {
  const db = useFirestore();
  const { toast } = useToast();
  const [accountName, setAccountName] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  
  const [serviceConfigs, setServiceConfigs] = useState<Record<string, ServiceConfig>>(
    INITIAL_SERVICE_CONFIG as Record<string, ServiceConfig>
  );

  const updateService = (service: string, field: keyof ServiceConfig, value: any) => {
    setServiceConfigs(prev => ({
      ...prev,
      [service]: { ...prev[service], [field]: value }
    }));
  };

  const handleClear = () => {
    if (confirm("Clear all expansion data and start a new diagnostic?")) {
      setAccountName('');
      setServiceConfigs(INITIAL_SERVICE_CONFIG as Record<string, ServiceConfig>);
      toast({ title: "Analysis Cleared" });
    }
  };

  const handleExport = async () => {
    if (!accountName) {
      toast({ variant: "destructive", title: "Missing Account Name" });
      return;
    }
    setIsExporting(true);
    try {
      // 1. Generate PDF
      const pdf = new jsPDF();
      pdf.setFontSize(22); pdf.setFont("helvetica", "bold");
      pdf.text("WHITESPACE ANALYSIS REPORT", 20, 20);
      pdf.setFontSize(14); pdf.text(accountName.toUpperCase(), 20, 30);
      pdf.setDrawColor(0); pdf.line(20, 35, 190, 35);
      
      let y = 45;
      SERVICES.forEach(service => {
        const config = serviceConfigs[service];
        const spend = Number(config.currentSpend) || 0;
        const wallet = Number(config.totalWallet) || 0;
        const share = wallet > 0 ? (spend / wallet) * 100 : 0;
        pdf.setFontSize(10); pdf.setFont("helvetica", "bold");
        pdf.text(`${service.toUpperCase()}: ${config.state} (${config.priority} PRIORITY)`, 20, y);
        y += 5; pdf.setFont("helvetica", "normal");
        pdf.text(`Current: $${spend.toLocaleString()} | Total Wallet: $${wallet.toLocaleString()} | Share: ${share.toFixed(1)}%`, 20, y);
        y += 5;
        pdf.text(`Available Expansion: $${Math.max(0, wallet - spend).toLocaleString()}`, 20, y);
        y += 5;
        const lines = pdf.splitTextToSize(config.rationale || "No rationale provided.", 170);
        pdf.text(lines, 20, y);
        y += (lines.length * 5) + 10;
        if (y > 270) { pdf.addPage(); y = 20; }
      });

      pdf.save(`${accountName.replace(/\s+/g, '_')}_Whitespace_Plan.pdf`);

      // 2. Automate Save to Firestore (14 day retention)
      if (db && userId) {
        await addDoc(collection(db, 'whitespacePlans'), {
          userId,
          accountName: accountName.toUpperCase(),
          configs: serviceConfigs,
          createdAt: serverTimestamp(),
          expiresAt: addWeeks(new Date(), 2) // TTL Logic: 14 Days
        });
        toast({ title: "Analysis Archived", description: "Diagnostic saved to governance node for 14 days." });
      }

    } catch (e) {
      console.error(e);
      toast({ variant: "destructive", title: "Export/Sync Failed" });
    } finally {
      setIsExporting(false);
    }
  };

  const stateColors = {
    EXPAND: 'bg-blue-500 border-blue-600 text-white',
    MAINTAIN: 'bg-green-500 border-green-600 text-white',
    TARGET: 'bg-orange-500 border-orange-600 text-white',
    WHITE_SPACE: 'bg-slate-100 border-slate-200 text-slate-400'
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-20">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black uppercase text-primary flex items-center gap-3"><LayoutGrid className="w-8 h-8 text-accent" /> Whitespace Intelligence</h1>
          <p className="text-muted-foreground text-xs font-bold uppercase tracking-widest">Manual Strategic Expansion Diagnostic</p>
        </div>
        <div className="flex items-center gap-2 bg-white p-2 rounded-2xl border shadow-sm">
          <Input 
            placeholder="ACCOUNT NAME..." 
            value={accountName} 
            onChange={(e) => setAccountName(e.target.value.toUpperCase())} 
            className="w-[200px] md:w-[240px] h-10 font-black uppercase text-xs border-none bg-slate-50 focus-visible:ring-0" 
          />
          <div className="h-6 w-px bg-slate-200 mx-1" />
          <Button variant="ghost" onClick={handleClear} className="text-red-600 hover:bg-red-50 font-black h-10 px-2 text-[10px] uppercase">
            <RotateCcw className="w-3.5 h-3.5 mr-1" /> CLEAR
          </Button>
          <Button onClick={handleExport} disabled={!accountName || isExporting} className="bg-slate-900 text-white font-black h-10 px-3 text-[10px] uppercase shadow-md gap-2">
            {isExporting ? <Loader2 className="animate-spin w-3.5 h-3.5" /> : <FileDown className="w-3.5 h-3.5" />} EXPORT & ARCHIVE
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {SERVICES.map(service => {
          const config = serviceConfigs[service];
          const spend = Number(config.currentSpend) || 0;
          const wallet = Number(config.totalWallet) || 0;
          const sharePct = wallet > 0 ? (spend / wallet) * 100 : 0;
          return (
            <Card key={service} className="border shadow-sm p-6 space-y-4 bg-white hover:shadow-md transition-shadow">
              <div className="text-center space-y-2">
                <p className="text-xs font-black uppercase text-slate-400">{service}</p>
                <div className={cn("mx-auto w-12 h-12 rounded-xl flex items-center justify-center shadow-lg transition-colors", stateColors[config.state])}>
                  {service === 'Road' && <TrendingUp className="w-5 h-5" />}
                  {service === 'Air' && <Zap className="w-5 h-5" />}
                  {service === 'B2C' && <Target className="w-5 h-5" />}
                  {service === 'International' && <ShieldCheck className="w-5 h-5" />}
                  {service === 'Courier' && <Activity className="w-5 h-5" />}
                </div>
              </div>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-[9px] font-black uppercase text-slate-400">Strategy State</Label>
                  <Select value={config.state} onValueChange={(val: ServiceState) => updateService(service, 'state', val)}>
                    <SelectTrigger className="h-8 text-[9px] font-black uppercase"><SelectValue /></SelectTrigger>
                    <SelectContent>{STATES.map(s => <SelectItem key={s} value={s} className="text-[9px] uppercase font-bold">{s.replace('_', ' ')}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                
                <Separator />
                
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label className="text-[9px] font-black uppercase text-slate-400 flex items-center gap-1.5">
                      <DollarSign className="w-2.5 h-2.5" /> Current Spend
                    </Label>
                    <Input type="number" value={config.currentSpend} onChange={(e) => updateService(service, 'currentSpend', e.target.value === '' ? '' : parseFloat(e.target.value))} className="h-8 text-[10px] font-black" placeholder="$" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[9px] font-black uppercase text-slate-400 flex items-center gap-1.5">
                      <Box className="w-2.5 h-2.5" /> Total Wallet
                    </Label>
                    <Input type="number" value={config.totalWallet} onChange={(e) => updateService(service, 'totalWallet', e.target.value === '' ? '' : parseFloat(e.target.value))} className="h-8 text-[10px] font-black" placeholder="$" />
                  </div>
                </div>

                <div className="pt-2">
                  <div className="flex justify-between text-[8px] font-black uppercase mb-1">
                    <span>Wallet Share</span>
                    <span className="text-accent">{sharePct.toFixed(1)}%</span>
                  </div>
                  <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                    <div className="bg-accent h-full transition-all duration-500" style={{ width: `${Math.min(100, sharePct)}%` }} />
                  </div>
                  <p className="text-[8px] font-black text-slate-400 mt-1 uppercase text-right">
                    Gap: ${Math.max(0, wallet - spend).toLocaleString()}
                  </p>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <div className="grid grid-cols-1">
        <Card className="border shadow-xl p-8 bg-white">
          <div className="flex items-center gap-2 mb-8 text-primary">
             <Info className="w-4 h-4 text-accent" />
             <CardTitle className="text-sm font-black uppercase">Strategic Rationale & Barriers</CardTitle>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-8">
            {SERVICES.map(service => (
              <div key={service} className="space-y-3">
                <div className="flex justify-between items-center bg-slate-50 p-2 rounded-lg border">
                  <Label className="text-[10px] font-black uppercase text-primary">{service}</Label>
                  <div className="flex items-center gap-2">
                    <span className="text-[8px] font-black text-slate-400 uppercase">Priority:</span>
                    <Select value={serviceConfigs[service].priority} onValueChange={(val: Priority) => updateService(service, 'priority', val)}>
                      <SelectTrigger className="h-6 w-20 text-[8px] font-black uppercase border-none bg-white"><SelectValue /></SelectTrigger>
                      <SelectContent>{PRIORITIES.map(p => <SelectItem key={p} value={p} className="text-[8px] font-black uppercase">{p}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
                <Textarea 
                  placeholder="Document triggers and barriers..." 
                  value={serviceConfigs[service].rationale} 
                  onChange={(e) => updateService(service, 'rationale', e.target.value)} 
                  className="min-h-[140px] text-xs font-medium border-slate-200 focus:border-accent transition-all resize-none" 
                />
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
