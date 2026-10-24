import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy, deleteDoc, doc, Timestamp, updateDoc, serverTimestamp, limit } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { History, Trash2, Calendar, LayoutGrid, FileText, ChevronRight, Loader2, Info, AlertTriangle, Edit3, Search, Download, Target, ExternalLink, List, Table as TableIcon } from 'lucide-react';
import { useState, useMemo, useEffect } from 'react';
import { format } from 'date-fns';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAuth } from '@/contexts/auth-context';
import { Separator } from '@/components/ui/separator';
import { User as UserIcon } from 'lucide-react';
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useReportDiagnostic } from '@/hooks/use-diagnostics';
import { openSalesforceSearch } from '@/lib/utils';
import { useSharedOwnerDocs } from '@/hooks/use-data-shares';
import { SharedBadge } from './shared-badge';
import { jsPDF } from 'jspdf';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";

interface WhitespaceHistoryProps {
  userId: string;
}

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

export function WhitespaceHistory({ userId }: WhitespaceHistoryProps) {
  const db = useFirestore();
  const { isLeader, isSuperAdmin, user, profile } = useAuth();
  const isElevated = isLeader || isSuperAdmin;
  const { toast } = useToast();
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'card' | 'table'>('table');

  // Edit State
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editAccountName, setEditAccountName] = useState('');
  const [editConfigs, setEditConfigs] = useState<Record<string, ServiceConfig>>({});
  const [isSaving, setIsSaving] = useState(false);

  const effectiveUserId = userId || user?.uid || profile?.uid;

  const plansQuery = useMemoFirebase(() => {
    if (!db || !effectiveUserId) return null;
    if (isElevated) {
      return query(
        collection(db, 'whitespacePlans'),
        orderBy('createdAt', 'desc'),
        limit(500)
      );
    } else {
      return query(
        collection(db, 'whitespacePlans'),
        where('userId', '==', effectiveUserId),
        limit(500)
      );
    }
  }, [db, effectiveUserId, isElevated]);

  const { data: ownPlans, isLoading: ownLoading } = useCollection(plansQuery);
  // Plans other users have shared with me via the Access page (full access)
  const { data: sharedPlans, isLoading: sharedLoading } = useSharedOwnerDocs('whiteSpace', 'whitespacePlans', { max: 500 });
  const plans = useMemo(() => {
    if (!ownPlans) return ownPlans;
    if (isElevated || sharedPlans.length === 0) return ownPlans;
    const seen = new Set(ownPlans.map((p: any) => p.id));
    return [...ownPlans, ...sharedPlans.filter((p: any) => !seen.has(p.id))] as any[];
  }, [ownPlans, sharedPlans, isElevated]);
  const isLoading = ownLoading || sharedLoading;

  const usersQuery = useMemoFirebase(() => {
    if (!db || !isElevated) return null;
    return collection(db, 'users');
  }, [db, isElevated]);
  
  const { data: allUsers } = useCollection(usersQuery);

  const userMap = useMemo(() => {
    const map: Record<string, string> = { 'TEAM_NODE': 'TEAM BLUEPRINT' };
    allUsers?.forEach((u: any) => {
      map[u.id] = u.name;
    });
    return map;
  }, [allUsers]);

  // Keep plans active indefinitely (no auto-delete filtering)
  const activePlans = useMemo(() => {
    if (!plans) return [];
    if (isElevated) return plans;
    return plans.filter(p => p.userId === effectiveUserId || !!p.sharedByName);
  }, [plans, isElevated, effectiveUserId]);

  // Search filter by Company Name or User Name
  const filteredPlans = useMemo(() => {
    if (!activePlans) return [];
    const term = searchTerm.trim().toLowerCase();
    if (!term) return activePlans;

    return activePlans.filter(plan => {
      const accMatch = (plan.accountName || '').toLowerCase().includes(term);
      const userMatch = (userMap[plan.userId] || '').toLowerCase().includes(term);
      return accMatch || userMatch;
    });
  }, [activePlans, searchTerm, userMap]);

  // Report telemetry to Developer Diagnostics bus
  useReportDiagnostic(() => {
    const plansMissingAccount = (plans || []).filter(p => !p.accountName);
    const plansMissingUser = (plans || []).filter(p => !p.userId);

    return {
      pageName: 'White Space History (WHITESPACE_HISTORY)',
      reportedAt: new Date(),
      collections: [
        { 
          name: 'whitespacePlans', 
          count: plans?.length, 
          status: isLoading ? 'loading' : (plans ? 'ready' : 'empty'),
          sampleNames: plans?.slice(0, 4).map(p => p.accountName || 'Unnamed Plan')
        },
        { name: 'users', count: allUsers?.length, status: allUsers ? 'ready' : 'not-loaded' }
      ],
      customMetrics: {
        'Total Active Plans': filteredPlans.length,
        'Selected Plan ID': selectedPlanId || 'None',
        'Viewing Mode': isLeader ? 'All Team Plans' : 'Personal Plans'
      },
      issues: [
        ...(plansMissingAccount.length > 0 ? [{
          severity: 'warning' as const,
          category: 'schema' as const,
          title: 'Whitespace Plans Missing Account Name',
          detail: `${plansMissingAccount.length} plans have no accountName set.`,
          docIds: plansMissingAccount.slice(0, 5).map(p => p.id || '')
        }] : []),
        ...(plansMissingUser.length > 0 ? [{
          severity: 'error' as const,
          category: 'identity' as const,
          title: 'Whitespace Plans Missing User ID',
          detail: `${plansMissingUser.length} plans have no owner userId assigned.`,
          docIds: plansMissingUser.slice(0, 5).map(p => p.id || '')
        }] : [])
      ]
    };
  }, [plans, allUsers, isLoading, filteredPlans, selectedPlanId, isLeader]);

  const selectedPlan = filteredPlans.find(p => p.id === selectedPlanId) || plans?.find(p => p.id === selectedPlanId);

  // Export a whitespace plan to PDF for printing
  const handleExportPdf = (plan: any, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!plan || !plan.accountName) return;

    try {
      const pdf = new jsPDF();
      pdf.setFontSize(20); pdf.setFont("helvetica", "bold");
      pdf.text("WHITESPACE ANALYSIS DIAGNOSTIC", 20, 20);
      
      pdf.setFontSize(14);
      pdf.text(plan.accountName.toUpperCase(), 20, 30);
      
      pdf.setFontSize(10); pdf.setFont("helvetica", "normal");
      const ownerName = userMap[plan.userId] || 'Unknown User';
      const createdDateStr = plan.createdAt?.toDate ? format(plan.createdAt.toDate(), 'PPP') : 'N/A';
      pdf.text(`User / BDM: ${ownerName}  |  Generated: ${createdDateStr}`, 20, 37);
      
      pdf.setDrawColor(0); pdf.line(20, 42, 190, 42);
      
      let y = 52;
      const configs = plan.configs || {};
      SERVICES.forEach(service => {
        const config = configs[service] || { state: 'WHITE_SPACE', priority: 'LOW', rationale: '', currentSpend: 0, totalWallet: 0 };
        const spend = Number(config.currentSpend) || 0;
        const wallet = Number(config.totalWallet) || 0;
        const share = wallet > 0 ? (spend / wallet) * 100 : 0;
        
        pdf.setFontSize(11); pdf.setFont("helvetica", "bold");
        pdf.text(`${service.toUpperCase()}: ${config.state || 'WHITE_SPACE'} (${config.priority || 'LOW'} PRIORITY)`, 20, y);
        y += 6; 
        
        pdf.setFontSize(9); pdf.setFont("helvetica", "normal");
        pdf.text(`Current Spend: $${spend.toLocaleString()}  |  Total Wallet: $${wallet.toLocaleString()}  |  Share: ${share.toFixed(1)}%`, 20, y);
        y += 5;
        pdf.text(`Expansion Opportunity: $${Math.max(0, wallet - spend).toLocaleString()}`, 20, y);
        y += 5;
        
        const lines = pdf.splitTextToSize(`Rationale: ${config.rationale || "No documentation provided."}`, 170);
        pdf.text(lines, 20, y);
        y += (lines.length * 4.5) + 8;
        
        if (y > 270) { pdf.addPage(); y = 20; }
      });

      pdf.save(`${plan.accountName.replace(/\s+/g, '_')}_Whitespace_Diagnostic.pdf`);
      toast({ title: "PDF Exported", description: "Diagnostic record downloaded for printing." });
    } catch (err) {
      console.error("PDF Export Error:", err);
      toast({ variant: "destructive", title: "Export Failed", description: "Could not generate PDF file." });
    }
  };

  // Initialize edit form when selectedPlan or dialog open state changes
  useEffect(() => {
    if (selectedPlan && isEditDialogOpen) {
      setEditAccountName(selectedPlan.accountName || '');
      
      // Build configs map with fallbacks for initial loading safety
      const configsMap: Record<string, ServiceConfig> = {};
      SERVICES.forEach(service => {
        const existing = selectedPlan.configs?.[service] || {};
        configsMap[service] = {
          state: existing.state || 'WHITE_SPACE',
          priority: existing.priority || 'LOW',
          rationale: existing.rationale || '',
          currentSpend: existing.currentSpend !== undefined ? existing.currentSpend : '',
          totalWallet: existing.totalWallet !== undefined ? existing.totalWallet : '',
        };
      });
      setEditConfigs(configsMap);
    }
  }, [selectedPlan, isEditDialogOpen]);

  const handleDelete = async (id: string) => {
    if (!db) return;
    if (confirm("Permanently archive this diagnostic from the governance node?")) {
      await deleteDoc(doc(db, 'whitespacePlans', id));
      if (selectedPlanId === id) setSelectedPlanId(null);
      toast({ title: "Diagnostic Removed" });
    }
  };

  const handleUpdateConfig = (service: string, field: keyof ServiceConfig, value: any) => {
    setEditConfigs(prev => ({
      ...prev,
      [service]: {
        ...prev[service],
        [field]: value
      }
    }));
  };

  const handleSaveEdit = async () => {
    if (!db || !selectedPlanId) return;
    if (!editAccountName.trim()) {
      toast({ variant: "destructive", title: "Account Name required" });
      return;
    }

    setIsSaving(true);
    try {
      await updateDoc(doc(db, 'whitespacePlans', selectedPlanId), {
        accountName: editAccountName.toUpperCase(),
        configs: editConfigs,
        updatedAt: serverTimestamp()
      });
      toast({ title: "Diagnostic Updated", description: "Your changes have been saved." });
      setIsEditDialogOpen(false);
    } catch (e) {
      console.error(e);
      toast({ variant: "destructive", title: "Update Failed", description: "Failed to update whitespace plan." });
    } finally {
      setIsSaving(false);
    }
  };

  const canEdit = selectedPlan && (isElevated || !!selectedPlan.sharedByName || (user && selectedPlan.userId === user.uid) || (profile && selectedPlan.userId === profile.uid));
  const canDelete = selectedPlan && (isElevated || !!selectedPlan.sharedByName || (user && selectedPlan.userId === user.uid) || (profile && selectedPlan.userId === profile.uid));

  if (isLoading) return (
    <div className="flex flex-col items-center justify-center py-20 gap-4">
      <Loader2 className="w-10 h-10 text-accent animate-spin" />
      <p className="text-xs font-semibold text-muted-foreground">Accessing Expansion Archive...</p>
    </div>
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-in fade-in duration-700">
      {/* Sidebar: Archive List */}
      <div className="lg:col-span-4 space-y-4">
        <header className="px-1 flex justify-between items-center">
          <div>
            <h2 className="text-sm font-bold tracking-tighter text-primary flex items-center gap-2">
              <History className="w-4 h-4 text-accent" />
              Strategic Archive
            </h2>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide mt-0.5">Permanent Diagnostic Repository</p>
          </div>
          {/* View Toggle (List vs Card) */}
          <div className="flex items-center gap-1 bg-secondary p-1 rounded-xl border border-border">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setViewMode('card')}
              title="Card View"
              className={`h-7 w-7 rounded-lg transition-all ${viewMode === 'card' ? 'bg-card text-accent shadow-sm' : 'text-muted-foreground hover:text-foreground/85'}`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setViewMode('table')}
              title="List View"
              className={`h-7 w-7 rounded-lg transition-all ${viewMode === 'table' ? 'bg-card text-accent shadow-sm' : 'text-muted-foreground hover:text-foreground/85'}`}
            >
              <List className="w-3.5 h-3.5" />
            </Button>
          </div>
        </header>

        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder="Search company or user..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 h-10 text-xs border-primary/20 rounded-xl bg-card shadow-sm"
          />
        </div>

        <ScrollArea className="h-[650px] pr-4">
          {viewMode === 'table' ? (
            /* Compact List View */
            <div className="bg-card rounded-2xl border border-border overflow-hidden shadow-sm">
              <Table>
                <TableHeader className="bg-secondary/60">
                  <TableRow className="text-xs font-semibold border-b">
                    <TableHead className="py-2.5 pl-3">Account</TableHead>
                    <TableHead className="py-2.5 px-2 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPlans.map((plan) => {
                    const isPlanOwner = (user && plan.userId === user.uid) || (profile && plan.userId === profile.uid);
                    const canDeleteThisPlan = isElevated || isPlanOwner || !!plan.sharedByName;
                    const isSelected = selectedPlanId === plan.id;
                    return (
                      <TableRow
                        key={plan.id}
                        onClick={() => setSelectedPlanId(plan.id)}
                        className={`cursor-pointer transition-colors ${
                          isSelected ? 'bg-accent/10 font-semibold text-primary' : 'hover:bg-secondary/60'
                        }`}
                      >
                        <TableCell className="py-2.5 pl-3">
                          <p className={`text-xs leading-tight truncate max-w-[150px] ${isSelected ? 'font-semibold text-accent' : 'font-bold text-foreground'}`}>
                            {plan.accountName}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs font-bold text-muted-foreground">
                              {plan.createdAt?.toDate ? format(plan.createdAt.toDate(), 'MMM d') : ''}
                            </span>
                            <SharedBadge name={plan.sharedByName} />
                            {isElevated && plan.userId && (
                              <span className="text-xs font-bold text-accent truncate max-w-[90px]">
                                • {userMap[plan.userId] || 'Unknown'}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="py-2.5 px-2 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={(e) => handleExportPdf(plan, e)}
                              title="Export PDF / Print"
                              className="h-7 w-7 text-muted-foreground hover:text-accent hover:bg-accent/10 rounded-lg p-0"
                            >
                              <Download className="w-3.5 h-3.5" />
                            </Button>
                            {canDeleteThisPlan && (
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                onClick={(e) => { e.stopPropagation(); handleDelete(plan.id); }}
                                title="Delete Diagnostic"
                                className="h-7 w-7 text-muted-foreground/70 hover:text-destructive hover:bg-danger-soft rounded-lg p-0"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          ) : (
            /* Card View */
            <div className="grid gap-3">
              {filteredPlans.map((plan) => {
                const isPlanOwner = (user && plan.userId === user.uid) || (profile && plan.userId === profile.uid);
                const canDeleteThisPlan = isElevated || isPlanOwner || !!plan.sharedByName;
                return (
                  <div
                    key={plan.id}
                    onClick={() => setSelectedPlanId(plan.id)}
                    className={`w-full text-left cursor-pointer p-4 rounded-2xl border-2 transition-all group relative ${
                      selectedPlanId === plan.id 
                        ? 'border-accent bg-accent/5 shadow-lg' 
                        : 'border-border/60 bg-card hover:border-border'
                    }`}
                  >
                    <div className="flex justify-between items-center mb-2">
                      <div className="flex items-center gap-1.5">
                         <Calendar className="w-3 h-3 text-muted-foreground" />
                         <span className="text-xs font-bold text-muted-foreground uppercase">
                           {plan.createdAt?.toDate ? format(plan.createdAt.toDate(), 'MMM d, p') : 'Just now'}
                         </span>
                      </div>
                      {/* Action buttons (Export PDF & Delete Trash) - clearly separated */}
                      <div className="flex items-center gap-1">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={(e) => handleExportPdf(plan, e)}
                          title="Export PDF / Print"
                          className="h-7 w-7 text-muted-foreground hover:text-accent hover:bg-accent/10 rounded-lg p-0"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </Button>
                        {canDeleteThisPlan && (
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={(e) => { e.stopPropagation(); handleDelete(plan.id); }}
                            title="Delete Diagnostic"
                            className="h-7 w-7 text-muted-foreground/70 hover:text-destructive hover:bg-danger-soft rounded-lg p-0"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                    <p className="text-sm font-semibold text-primary leading-tight truncate pr-2">{plan.accountName}</p>
                    <SharedBadge name={plan.sharedByName} className="mt-1" />
                    {isElevated && plan.userId && (
                      <div className="flex items-center gap-1.5 mt-1.5">
                        <UserIcon className="w-3 h-3 text-accent" />
                        <span className="text-xs font-bold text-accent uppercase tracking-wide">{userMap[plan.userId] || 'Unknown User'}</span>
                      </div>
                    )}
                    <div className="mt-3 flex justify-between items-center">
                       <div className="flex gap-1">
                          {Object.keys(plan.configs || {}).slice(0, 3).map(s => (
                            <div key={s} className="w-2 h-2 rounded-full bg-accent/20" />
                          ))}
                       </div>
                       <ChevronRight className={`w-4 h-4 transition-transform ${selectedPlanId === plan.id ? 'translate-x-1 text-accent' : 'text-muted-foreground/70'}`} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {filteredPlans.length === 0 && (
            <div className="text-center py-20 bg-card rounded-2xl border-2 border-dashed">
              <FileText className="w-10 h-10 text-muted-foreground/30 mx-auto mb-4" />
              <p className="text-xs font-semibold text-muted-foreground leading-relaxed">
                No expansion plans match your search.
              </p>
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Main View: Plan Detail */}
      <div className="lg:col-span-8">
        {selectedPlan ? (
          <div className="space-y-6 animate-in slide-in-from-right-4 duration-500">
            <Card className="border-none shadow-2xl bg-card overflow-hidden">
               <CardHeader className="bg-panel text-panel-foreground pb-8">
                  <div className="flex justify-between items-start mb-4">
                     <Badge className="bg-accent text-accent-foreground border-none font-semibold text-xs">Diagnostic Record</Badge>
                     <Button 
                       onClick={(e) => handleExportPdf(selectedPlan, e)}
                       className="bg-white/10 hover:bg-white/20 text-white font-semibold text-xs h-8 px-3 gap-1.5 rounded-lg border border-white/20"
                     >
                       <Download className="w-3.5 h-3.5 text-accent" /> EXPORT PDF
                     </Button>
                  </div>
                  
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      {/* Active Salesforce Search Link */}
                      <button 
                        onClick={() => openSalesforceSearch(selectedPlan.accountName, selectedPlan.salesforceId)}
                        className="text-left group/sf flex items-center gap-3 transition-colors"
                        title="Click to search in Salesforce"
                      >
                        <CardTitle className="text-3xl font-black tabular-nums tracking-tight group-hover/sf:text-accent transition-colors flex items-center gap-2">
                          {selectedPlan.accountName}
                          <ExternalLink className="w-5 h-5 text-accent opacity-0 group-hover/sf:opacity-100 transition-opacity" />
                        </CardTitle>
                      </button>
                      <CardDescription className="text-panel-foreground/60 font-medium flex items-center gap-2 mt-1">
                        <Info className="w-3.5 h-3.5" /> 
                        {isLeader && selectedPlan.userId && (
                          <span className="font-bold text-accent mr-1">[{userMap[selectedPlan.userId] || 'Unknown User'}]</span>
                        )}
                        Synchronised on {selectedPlan.createdAt?.toDate ? format(selectedPlan.createdAt.toDate(), 'PPP') : 'today'}.
                      </CardDescription>
                    </div>

                    {canEdit && (
                      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
                        <DialogTrigger asChild>
                          <Button className="bg-accent hover:bg-accent/80 text-accent-foreground font-semibold text-xs h-10 px-4 gap-2 shadow-md">
                            <Edit3 className="w-3.5 h-3.5" /> EDIT DIAGNOSTIC
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                          <DialogHeader>
                            <DialogTitle className="text-xl font-bold text-primary">Edit Whitespace Diagnostic</DialogTitle>
                            <DialogDescription className="text-xs">Update account expansion diagnostics and rationale models.</DialogDescription>
                          </DialogHeader>

                          <div className="space-y-6 my-4">
                            <div className="space-y-2">
                              <Label className="text-xs font-semibold">Account Name</Label>
                              <Input 
                                value={editAccountName} 
                                onChange={(e) => setEditAccountName(e.target.value)} 
                                className="font-semibold text-xs"
                              />
                            </div>

                            <Separator />

                            <div className="space-y-6">
                              <h3 className="text-xs font-bold text-muted-foreground">Service Configuration Matrix</h3>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {SERVICES.map(service => {
                                  const config = editConfigs[service] || {
                                    state: 'WHITE_SPACE',
                                    priority: 'LOW',
                                    rationale: '',
                                    currentSpend: '',
                                    totalWallet: ''
                                  };
                                  return (
                                    <div key={service} className="p-4 border rounded-2xl bg-secondary/60 space-y-3">
                                      <h4 className="text-xs font-bold text-primary border-b pb-1">{service}</h4>
                                      
                                      <div className="grid grid-cols-2 gap-2">
                                        <div className="space-y-1">
                                          <Label className="text-xs font-semibold text-muted-foreground">Strategy State</Label>
                                          <Select 
                                            value={config.state} 
                                            onValueChange={(val: ServiceState) => handleUpdateConfig(service, 'state', val)}
                                          >
                                            <SelectTrigger className="h-8 text-xs font-semibold bg-card"><SelectValue /></SelectTrigger>
                                            <SelectContent>{STATES.map(s => <SelectItem key={s} value={s} className="text-xs uppercase font-bold">{s.replace('_', ' ')}</SelectItem>)}</SelectContent>
                                          </Select>
                                        </div>
                                        
                                        <div className="space-y-1">
                                          <Label className="text-xs font-semibold text-muted-foreground">Priority</Label>
                                          <Select 
                                            value={config.priority} 
                                            onValueChange={(val: Priority) => handleUpdateConfig(service, 'priority', val)}
                                          >
                                            <SelectTrigger className="h-8 text-xs font-semibold bg-card"><SelectValue /></SelectTrigger>
                                            <SelectContent>{PRIORITIES.map(p => <SelectItem key={p} value={p} className="text-xs uppercase font-bold">{p}</SelectItem>)}</SelectContent>
                                          </Select>
                                        </div>
                                      </div>

                                      <div className="grid grid-cols-2 gap-2">
                                        <div className="space-y-1">
                                          <Label className="text-xs font-semibold text-muted-foreground">Current Spend</Label>
                                          <Input 
                                            type="number" 
                                            value={config.currentSpend} 
                                            onChange={(e) => handleUpdateConfig(service, 'currentSpend', e.target.value === '' ? '' : parseFloat(e.target.value))} 
                                            className="h-8 text-xs font-semibold bg-card" 
                                            placeholder="$" 
                                          />
                                        </div>
                                        
                                        <div className="space-y-1">
                                          <Label className="text-xs font-semibold text-muted-foreground">Total Wallet</Label>
                                          <Input 
                                            type="number" 
                                            value={config.totalWallet} 
                                            onChange={(e) => handleUpdateConfig(service, 'totalWallet', e.target.value === '' ? '' : parseFloat(e.target.value))} 
                                            className="h-8 text-xs font-semibold bg-card" 
                                            placeholder="$" 
                                          />
                                        </div>
                                      </div>

                                      <div className="space-y-1">
                                        <Label className="text-xs font-semibold text-muted-foreground">Strategic Rationale</Label>
                                        <Textarea 
                                          value={config.rationale} 
                                          onChange={(e) => handleUpdateConfig(service, 'rationale', e.target.value)} 
                                          placeholder="Rationale & triggers..." 
                                          className="text-xs min-h-[60px] bg-card"
                                        />
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </div>

                          <DialogFooter>
                            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)} disabled={isSaving}>Cancel</Button>
                            <Button onClick={handleSaveEdit} disabled={isSaving} className="bg-panel text-panel-foreground">
                              {isSaving ? "Saving..." : "Save Changes"}
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    )}
                  </div>
               </CardHeader>
               <CardContent className="p-0">
                  <div className="divide-y border-b">
                    {Object.entries(selectedPlan.configs || {}).map(([service, config]: [string, any]) => {
                      const spend = Number(config.currentSpend) || 0;
                      const wallet = Number(config.totalWallet) || 0;
                      const sharePct = wallet > 0 ? (spend / wallet) * 100 : 0;
                      return (
                        <div key={service} className="p-6 grid grid-cols-1 md:grid-cols-4 gap-6 hover:bg-secondary/30 transition-colors">
                          <div className="space-y-1">
                             <p className="text-xs font-semibold text-muted-foreground">{service}</p>
                             <Badge variant="outline" className="text-xs font-semibold border-accent/30 text-accent">{config.state?.replace('_', ' ')}</Badge>
                          </div>
                          <div className="space-y-1">
                             <p className="text-xs font-bold text-muted-foreground uppercase">Priority</p>
                             <p className={`text-xs font-semibold ${config.priority === 'HIGH' ? 'text-warning-ink' : 'text-foreground/85'}`}>{config.priority}</p>
                          </div>
                          <div className="space-y-1">
                             <p className="text-xs font-bold text-muted-foreground uppercase">Financials</p>
                             <p className="text-xs font-medium text-foreground/75">
                               Spend: ${spend.toLocaleString()} / ${wallet.toLocaleString()} ({sharePct.toFixed(0)}%)
                             </p>
                          </div>
                          <div className="space-y-2">
                             <p className="text-xs font-bold text-muted-foreground uppercase">Strategic Rationale</p>
                             <p className="text-xs font-medium text-foreground/85 leading-relaxed italic">
                               "{config.rationale || 'No documentation provided.'}"
                             </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
               </CardContent>
            </Card>
          </div>
        ) : (
          <div className="h-full min-h-[500px] flex flex-col items-center justify-center bg-card rounded-3xl border-2 border-dashed border-border/60">
             <div className="w-20 h-20 rounded-full bg-secondary/60 flex items-center justify-center mb-6">
                <LayoutGrid className="w-10 h-10 text-muted-foreground/30" />
             </div>
             <h3 className="text-sm font-bold text-muted-foreground">Select a saved diagnostic</h3>
             <p className="text-xs font-bold text-muted-foreground/70 uppercase tracking-wide mt-2 text-center max-w-xs">
                Review historical whitespace diagnostics synced during your PDF export sessions.
             </p>
          </div>
        )}
      </div>
    </div>
  );
}
