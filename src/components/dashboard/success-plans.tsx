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
import { 
  ClipboardList, Plus, Trash2, FileDown, CheckCircle2, 
  XCircle, AlertCircle, Edit, Calendar, User, Search, RefreshCw 
} from 'lucide-react';
import { jsPDF } from "jspdf";
import { format } from 'date-fns';

interface SuccessPlan {
  id?: string;
  teamMemberId: string;
  teamMemberName: string;
  managerName: string;
  dateCommenced: string;
  checkInDate: string;
  purpose: string;
  measures: {
    measure: string;
    startingPoint: string;
    goal: string;
    result: string;
  }[];
  stopList: string[];
  startList: string[];
  continueList: string[];
  strategies: {
    strategy: string;
    achieving: 'Y' | 'N' | 'PENDING';
    detail: string;
  }[];
  measuresToAchieve: {
    measure: string;
    achieving: 'Y' | 'N' | 'PENDING';
    detail: string;
  }[];
  managerCommitments: {
    commitment: string;
    achieving: 'Y' | 'N' | 'PENDING';
    detail: string;
  }[];
  summary: string;
  status?: 'DRAFT' | 'FINALISED';
  createdBy: string;
  createdByName: string;
  createdAt: any;
}

const DEFAULT_PURPOSE = "The purpose of the Success Program is to support team members in our sales team so they can reach their potential as a successful member of our organisation and grow both personally and professionally. The Success Program is designed for both the Team Member and Manager and is tailored to highlight the strength and areas for improvement to ensure the minimum expectations are met.";

const STANDARD_MEASURES = [
  { category: "Revenue/Wins", name: "Number of Won Opportunities" },
  { category: "Revenue/Wins", name: "Portfolio Revenue Growth" },
  { category: "Revenue/Wins", name: "New Traded Revenue" },
  { category: "Productivity", name: "Average Events Daily" },
  { category: "Productivity", name: "F2F/Virtual New Business Meetings – Weekly average" },
  { category: "Productivity", name: "New Business Opportunities identified" },
  { category: "Productivity", name: "New prospecting calls" }
];

export function SuccessPlansView({ userId, isLeader }: { userId: string; isLeader: boolean }) {
  const db = useFirestore();
  const { toast } = useToast();
  const { profile } = useAuth();
  
  const [selectedPlan, setSelectedPlan] = useState<SuccessPlan | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  
  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUserFilter, setSelectedUserFilter] = useState<string>('all');

  // Load plans
  const successPlansQuery = useMemoFirebase(() => {
    if (!db) return null;
    if (isLeader) {
      return query(collection(db, 'successPlans'), orderBy('createdAt', 'desc'));
    } else {
      return query(
        collection(db, 'successPlans'), 
        where('createdBy', '==', userId),
        orderBy('createdAt', 'desc')
      );
    }
  }, [db, isLeader, userId]);
  const { data: rawPlans, isLoading: isPlansLoading } = useCollection(successPlansQuery);

  // Load system users
  const usersQuery = useMemoFirebase(() => {
    if (!db || !isLeader) return null;
    return query(collection(db, 'users'));
  }, [db, isLeader]);
  const { data: allUsers } = useCollection(usersQuery);

  // Filter plans based on roles & filters
  const visiblePlans = useMemo(() => {
    if (!rawPlans) return [];
    let list = [...rawPlans];
    
    // Non-leaders can only see plans they created
    if (!isLeader) {
      list = list.filter(plan => plan.createdBy === userId);
    } else if (selectedUserFilter !== 'all') {
      list = list.filter(plan => plan.teamMemberId === selectedUserFilter || plan.createdBy === selectedUserFilter);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(plan => 
        plan.teamMemberName?.toLowerCase().includes(q) || 
        plan.managerName?.toLowerCase().includes(q) ||
        plan.purpose?.toLowerCase().includes(q) ||
        plan.summary?.toLowerCase().includes(q)
      );
    }

    return list as SuccessPlan[];
  }, [rawPlans, isLeader, userId, selectedUserFilter, searchQuery]);

  // Form State
  const [formState, setFormState] = useState<Omit<SuccessPlan, 'createdBy' | 'createdByName' | 'createdAt'>>({
    teamMemberId: '',
    teamMemberName: '',
    managerName: '',
    dateCommenced: format(new Date(), 'yyyy-MM-dd'),
    checkInDate: '',
    purpose: DEFAULT_PURPOSE,
    measures: [],
    stopList: ['', '', ''],
    startList: ['', '', ''],
    continueList: ['', '', ''],
    strategies: [],
    measuresToAchieve: [],
    managerCommitments: [],
    summary: '',
    status: 'DRAFT'
  });

  const handleStartCreate = () => {
    setFormState({
      teamMemberId: isLeader ? '' : (profile?.uid || ''),
      teamMemberName: isLeader ? '' : (profile?.name || ''),
      managerName: '',
      dateCommenced: format(new Date(), 'yyyy-MM-dd'),
      checkInDate: '',
      purpose: DEFAULT_PURPOSE,
      measures: [
        { measure: 'Number of Won Opportunities', startingPoint: '', goal: '', result: '' },
        { measure: 'Portfolio Revenue Growth', startingPoint: '', goal: '', result: '' },
        { measure: 'New Traded Revenue', startingPoint: '', goal: '', result: '' },
        { measure: 'Average Events Daily', startingPoint: '', goal: '', result: '' }
      ],
      stopList: ['', '', ''],
      startList: ['', '', ''],
      continueList: ['', '', ''],
      strategies: [
        { strategy: '', achieving: 'PENDING', detail: '' }
      ],
      measuresToAchieve: [
        { measure: '', achieving: 'PENDING', detail: '' }
      ],
      managerCommitments: [
        { commitment: '', achieving: 'PENDING', detail: '' }
      ],
      summary: '',
      status: 'DRAFT'
    });
    setIsCreating(true);
    setSelectedPlan(null);
    setIsEditing(true);
  };

  const handleSelectPlan = (plan: SuccessPlan) => {
    setSelectedPlan(plan);
    setFormState({
      teamMemberId: plan.teamMemberId || '',
      teamMemberName: plan.teamMemberName || '',
      managerName: plan.managerName || '',
      dateCommenced: plan.dateCommenced || '',
      checkInDate: plan.checkInDate || '',
      purpose: plan.purpose || DEFAULT_PURPOSE,
      measures: plan.measures || [],
      stopList: plan.stopList?.length === 3 ? plan.stopList : [...(plan.stopList || []), '', '', ''].slice(0, 3),
      startList: plan.startList?.length === 3 ? plan.startList : [...(plan.startList || []), '', '', ''].slice(0, 3),
      continueList: plan.continueList?.length === 3 ? plan.continueList : [...(plan.continueList || []), '', '', ''].slice(0, 3),
      strategies: plan.strategies || [],
      measuresToAchieve: plan.measuresToAchieve || [],
      managerCommitments: plan.managerCommitments || [],
      summary: plan.summary || '',
      status: plan.status || 'FINALISED'
    });
    setIsCreating(false);
    setIsEditing(false);
  };

  const handleSave = async (targetStatus?: 'DRAFT' | 'FINALISED') => {
    if (!db) return;
    
    // Validation
    const memberName = isLeader 
      ? (allUsers?.find(u => u.uid === formState.teamMemberId)?.name || formState.teamMemberName)
      : (profile?.name || '');

    if (!formState.teamMemberId && isLeader) {
      toast({ variant: 'destructive', title: 'Validation Error', description: 'Please select a Team Member.' });
      return;
    }

    try {
      const finalStatus = targetStatus || formState.status || 'DRAFT';
      
      const payload = {
        ...formState,
        status: finalStatus,
        teamMemberName: memberName || 'Unknown Team Member',
        createdBy: profile?.uid || userId,
        createdByName: profile?.name || 'Unknown Manager',
        updatedAt: serverTimestamp()
      };

      if (isCreating) {
        const docRef = await addDoc(collection(db, 'successPlans'), {
          ...payload,
          createdAt: serverTimestamp()
        });
        toast({ title: 'Success Plan Created', description: 'Your new success plan has been saved.' });
        setIsCreating(false);
        setIsEditing(false);
      } else if (selectedPlan?.id) {
        await updateDoc(doc(db, 'successPlans', selectedPlan.id), payload);
        toast({ title: 'Success Plan Updated', description: 'The success plan details have been updated.' });
        setIsEditing(false);
      }
    } catch (error) {
      console.error(error);
      toast({ variant: 'destructive', title: 'Save Failed', description: 'An error occurred while saving the plan.' });
    }
  };

  const handleDelete = async (planId: string) => {
    if (!db || !confirm('Are you sure you want to delete this success plan?')) return;
    try {
      await deleteDoc(doc(db, 'successPlans', planId));
      toast({ title: 'Success Plan Deleted' });
      setSelectedPlan(null);
      setIsEditing(false);
      setIsCreating(false);
    } catch (error) {
      toast({ variant: 'destructive', title: 'Delete Failed' });
    }
  };

  // Helper functions to manage dynamic list arrays
  const addMeasureRow = () => {
    setFormState(prev => ({
      ...prev,
      measures: [...prev.measures, { measure: '', startingPoint: '', goal: '', result: '' }]
    }));
  };

  const removeMeasureRow = (index: number) => {
    setFormState(prev => ({
      ...prev,
      measures: prev.measures.filter((_, i) => i !== index)
    }));
  };

  const addStrategyRow = () => {
    setFormState(prev => ({
      ...prev,
      strategies: [...prev.strategies, { strategy: '', achieving: 'PENDING', detail: '' }]
    }));
  };

  const removeStrategyRow = (index: number) => {
    setFormState(prev => ({
      ...prev,
      strategies: prev.strategies.filter((_, i) => i !== index)
    }));
  };

  const addMeasuresToAchieveRow = () => {
    setFormState(prev => ({
      ...prev,
      measuresToAchieve: [...prev.measuresToAchieve, { measure: '', achieving: 'PENDING', detail: '' }]
    }));
  };

  const removeMeasuresToAchieveRow = (index: number) => {
    setFormState(prev => ({
      ...prev,
      measuresToAchieve: prev.measuresToAchieve.filter((_, i) => i !== index)
    }));
  };

  const addManagerCommitmentsRow = () => {
    setFormState(prev => ({
      ...prev,
      managerCommitments: [...prev.managerCommitments, { commitment: '', achieving: 'PENDING', detail: '' }]
    }));
  };

  const removeManagerCommitmentsRow = (index: number) => {
    setFormState(prev => ({
      ...prev,
      managerCommitments: prev.managerCommitments.filter((_, i) => i !== index)
    }));
  };

  // Export to PDF
  const handleExportPDF = (plan: SuccessPlan) => {
    try {
      const doc = new jsPDF();
      let y = 20;

      // Header
      doc.setFillColor(30, 41, 59); // Slate-800
      doc.rect(0, 0, 210, 35, 'F');
      
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text("SUCCESS PROGRAM - NORTH PARCEL SALES", 15, 15);
      
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.text(`Team Member: ${plan.teamMemberName}   |   Manager: ${plan.managerName || 'N/A'}`, 15, 25);
      doc.text(`Commenced: ${plan.dateCommenced}   |   Check-in: ${plan.checkInDate || 'N/A'}`, 15, 30);

      y = 45;
      doc.setTextColor(30, 41, 59);
      
      // Purpose
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text("Purpose", 15, y);
      y += 6;
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      const purposeLines = doc.splitTextToSize(plan.purpose || DEFAULT_PURPOSE, 180);
      doc.text(purposeLines, 15, y);
      y += (purposeLines.length * 5) + 8;

      // Measures
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text("Measures & Goals", 15, y);
      y += 6;

      // Measures Table header
      doc.setFontSize(9);
      doc.setFillColor(241, 245, 249);
      doc.rect(15, y - 4, 180, 7, 'F');
      doc.text("Measure", 17, y);
      doc.text("Starting Point", 90, y);
      doc.text("Goal (Oct 30)", 130, y);
      doc.text("Result", 170, y);
      y += 5;
      plan.measures?.forEach(m => {
        const measureLines: string[] = doc.splitTextToSize(m.measure || '', 70);
        const startingLines: string[] = doc.splitTextToSize(m.startingPoint || '-', 35);
        const goalLines: string[] = doc.splitTextToSize(m.goal || '-', 35);
        const resultLines: string[] = doc.splitTextToSize(m.result || '-', 20);

        const maxLines = Math.max(measureLines.length, startingLines.length, goalLines.length, resultLines.length);
        const rowHeight = maxLines * 5;

        if (y + rowHeight > 280) { 
          doc.addPage(); 
          y = 20; 
        }

        measureLines.forEach((line, idx) => doc.text(line, 17, y + idx * 5));
        startingLines.forEach((line, idx) => doc.text(line, 90, y + idx * 5));
        goalLines.forEach((line, idx) => doc.text(line, 130, y + idx * 5));
        resultLines.forEach((line, idx) => doc.text(line, 170, y + idx * 5));

        y += rowHeight + 2;
      });
      y += 6;

      // Stop, Start, Continue
      if (y > 240) { doc.addPage(); y = 20; }
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text("Performance Review (Stop, Start, Continue)", 15, y);
      y += 6;

      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text("STOP Doing:", 15, y);
      doc.setFont('helvetica', 'normal');
      let stopOffset = 5;
      plan.stopList?.forEach((item, idx) => {
        if (item) {
          const lines: string[] = doc.splitTextToSize(`${idx + 1}. ${item}`, 175);
          lines.forEach(line => {
            doc.text(line, 20, y + stopOffset);
            stopOffset += 5;
          });
        }
      });
      y += stopOffset + 2;

      doc.setFont('helvetica', 'bold');
      doc.text("START Doing:", 15, y);
      doc.setFont('helvetica', 'normal');
      let startOffset = 5;
      plan.startList?.forEach((item, idx) => {
        if (item) {
          const lines: string[] = doc.splitTextToSize(`${idx + 1}. ${item}`, 175);
          lines.forEach(line => {
            doc.text(line, 20, y + startOffset);
            startOffset += 5;
          });
        }
      });
      y += startOffset + 2;

      doc.setFont('helvetica', 'bold');
      doc.text("CONTINUE Doing:", 15, y);
      doc.setFont('helvetica', 'normal');
      let contOffset = 5;
      plan.continueList?.forEach((item, idx) => {
        if (item) {
          const lines: string[] = doc.splitTextToSize(`${idx + 1}. ${item}`, 175);
          lines.forEach(line => {
            doc.text(line, 20, y + contOffset);
            contOffset += 5;
          });
        }
      });
      y += contOffset + 5;

      // Strategies / Required commitments
      const renderSectionTable = (title: string, items: { strategy?: string; commitment?: string; measure?: string; achieving: string; detail: string }[]) => {
        if (y > 250) { doc.addPage(); y = 20; }
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.text(title, 15, y);
        y += 6;

        doc.setFontSize(9);
        doc.setFillColor(241, 245, 249);
        doc.rect(15, y - 4, 180, 7, 'F');
        doc.text("Item / Description", 17, y);
        doc.text("Achieving (Y/N)", 120, y);
        doc.text("Details", 150, y);
        y += 5;

        items.forEach(item => {
          const desc = item.strategy || item.commitment || item.measure || '';
          const detail = item.detail || '-';

          const descLines: string[] = doc.splitTextToSize(desc, 95);
          const detailLines: string[] = doc.splitTextToSize(detail, 40);
          
          const maxLines = Math.max(descLines.length, detailLines.length);
          const rowHeight = maxLines * 5;

          if (y + rowHeight > 280) { 
            doc.addPage(); 
            y = 20; 
          }

          descLines.forEach((line, i) => {
            doc.text(line, 17, y + (i * 5));
          });

          doc.text(item.achieving === 'Y' ? 'Yes' : item.achieving === 'N' ? 'No' : 'Pending', 120, y);

          detailLines.forEach((line, i) => {
            doc.text(line, 150, y + (i * 5));
          });

          y += rowHeight + 2;
        });
        y += 6;
      };

      if (plan.strategies?.length) renderSectionTable("Strategies to Achieve & Exceed Goals", plan.strategies);
      if (plan.measuresToAchieve?.length) renderSectionTable("Measures to Achieve Goals", plan.measuresToAchieve);
      if (plan.managerCommitments?.length) renderSectionTable("Required Commitments from Manager", plan.managerCommitments);

      if (y > 230) { doc.addPage(); y = 20; }
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text("Summary / Comments", 15, y);
      y += 6;
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      const summaryLines = doc.splitTextToSize(plan.summary || 'No summary comments provided.', 180);
      doc.text(summaryLines, 15, y);

      doc.save(`Success_Plan_${plan.teamMemberName.replace(/\s+/g, '_')}.pdf`);
      toast({ title: 'PDF Exported successfully!' });
    } catch (e) {
      console.error(e);
      toast({ variant: 'destructive', title: 'Export Failed', description: 'Failed to generate PDF' });
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-2">
      {/* HEADER SECTION */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-900 text-white rounded-3xl p-6 shadow-xl border border-slate-800">
        <div>
          <h1 className="text-2xl font-black tracking-tight uppercase flex items-center gap-2">
            <ClipboardList className="w-7 h-7 text-indigo-400" />
            Success Programs
          </h1>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">
            Tailored Development & Performance Trackers
          </p>
        </div>
        {!isEditing && (
          <Button onClick={handleStartCreate} className="bg-indigo-600 hover:bg-indigo-500 font-bold uppercase tracking-wider text-xs rounded-xl shadow-lg shadow-indigo-500/20 gap-2 shrink-0">
            <Plus className="w-4 h-4" /> Create Success Plan
          </Button>
        )}
      </div>

      {/* VIEWS SWITCH */}
      {!isEditing ? (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* SIDEBAR: LIST OF PLANS */}
          <Card className="lg:col-span-1 border-none shadow-md bg-white rounded-3xl overflow-hidden">
            <CardHeader className="border-b border-slate-100 pb-4">
              <CardTitle className="text-xs font-black uppercase tracking-widest text-slate-900">Success Plans Ledger</CardTitle>
              <CardDescription className="text-[10px] font-bold text-muted-foreground uppercase">
                {visiblePlans.length} active programs loaded
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              {/* Leader Filters */}
              {isLeader && (
                <div className="space-y-2">
                  <label className="text-[9px] font-black uppercase text-slate-400">Team Member Filter</label>
                  <Select value={selectedUserFilter} onValueChange={setSelectedUserFilter}>
                    <SelectTrigger className="rounded-xl text-xs font-bold border-slate-200">
                      <SelectValue placeholder="All Members" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Members</SelectItem>
                      {allUsers?.map(u => (
                        <SelectItem key={u.uid} value={u.uid}>{u.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Text Search */}
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input 
                  placeholder="Search plans..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 rounded-xl text-xs font-bold border-slate-200 bg-slate-50/50"
                />
              </div>

              {/* Plans List */}
              <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
                {isPlansLoading ? (
                  <div className="text-center py-8 text-xs font-bold text-slate-400 animate-pulse">Loading Plans...</div>
                ) : visiblePlans.length === 0 ? (
                  <div className="text-center py-8 text-xs font-bold text-slate-400">No Success Plans Found</div>
                ) : (
                  visiblePlans.map(plan => {
                    const isSelected = selectedPlan?.id === plan.id;
                    return (
                      <button
                        key={plan.id}
                        onClick={() => handleSelectPlan(plan)}
                        className={`w-full text-left p-3.5 rounded-2xl border transition-all flex flex-col gap-1.5 ${
                          isSelected 
                            ? 'bg-slate-900 border-slate-950 text-white shadow-lg' 
                            : 'bg-slate-50/50 border-slate-100 hover:bg-slate-50 hover:border-slate-200 text-slate-900'
                        }`}
                      >
                        <div className="flex justify-between items-start w-full">
                          <span className="text-xs font-black uppercase tracking-tight">{plan.teamMemberName}</span>
                          <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded ${
                            isSelected ? 'bg-slate-800 text-indigo-400' : 'bg-indigo-50 text-indigo-600'
                          }`}>
                            Active
                          </span>
                        </div>
                        <div className={`text-[10px] font-bold ${isSelected ? 'text-slate-400' : 'text-slate-500'}`}>
                          Commenced: {plan.dateCommenced || 'N/A'}
                        </div>
                        <div className={`text-[9px] font-medium leading-normal line-clamp-2 ${isSelected ? 'text-slate-300' : 'text-slate-600'}`}>
                          Manager: {plan.managerName || 'Not Assigned'}
                        </div>
                        <div className="mt-2">
                          <Badge className={`text-[9px] font-black uppercase tracking-wider ${
                            (plan.status || 'FINALISED') === 'DRAFT' 
                              ? 'bg-amber-100 text-amber-800 border-amber-200' 
                              : 'bg-emerald-100 text-emerald-800 border-emerald-200'
                          }`}>
                            {(plan.status || 'FINALISED') === 'DRAFT' ? 'Draft' : 'Finalised'}
                          </Badge>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </CardContent>
          </Card>

          {/* MAIN DETAIL PANEL */}
          <Card className="lg:col-span-3 border-none shadow-md bg-white rounded-3xl overflow-hidden min-h-[500px]">
            {selectedPlan ? (
              <div>
                <CardHeader className="border-b border-slate-100 pb-4 bg-slate-50/50 flex flex-row justify-between items-center gap-4">
                  <div>
                    <div className="flex items-center gap-3">
                      <CardTitle className="text-sm font-black uppercase tracking-wider text-slate-900">
                        Success Program Details
                      </CardTitle>
                      <Badge className={`text-[9px] font-black uppercase tracking-wider ${
                        (selectedPlan.status || 'FINALISED') === 'DRAFT' 
                          ? 'bg-amber-100 text-amber-800 border-amber-200' 
                          : 'bg-emerald-100 text-emerald-800 border-emerald-200'
                      }`}>
                        {(selectedPlan.status || 'FINALISED') === 'DRAFT' ? 'Draft' : 'Finalised'}
                      </Badge>
                    </div>
                    <CardDescription className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">
                      Created by {selectedPlan.createdByName}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button onClick={() => handleExportPDF(selectedPlan)} variant="outline" size="sm" className="rounded-xl border-slate-200 text-xs font-bold gap-2">
                      <FileDown className="w-3.5 h-3.5" /> PDF
                    </Button>
                    {(isLeader || selectedPlan.createdBy === userId) && (
                      <>
                        <Button onClick={() => setIsEditing(true)} size="sm" className="bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold gap-2">
                          <Edit className="w-3.5 h-3.5" /> Edit Plan
                        </Button>
                        <Button onClick={() => selectedPlan.id && handleDelete(selectedPlan.id)} variant="destructive" size="sm" className="rounded-xl text-xs font-bold gap-2">
                          <Trash2 className="w-3.5 h-3.5" /> Delete
                        </Button>
                      </>
                    )}
                  </div>
                </CardHeader>

                <CardContent className="p-6 space-y-8">
                  {/* Info Header */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100 text-xs font-bold text-slate-700">
                    <div>
                      <span className="text-[9px] uppercase font-black text-slate-400 block mb-0.5">Team Member</span>
                      <span className="text-slate-900 font-extrabold">{selectedPlan.teamMemberName}</span>
                    </div>
                    <div>
                      <span className="text-[9px] uppercase font-black text-slate-400 block mb-0.5">Manager</span>
                      <span className="text-slate-900 font-extrabold">{selectedPlan.managerName || 'Not Assigned'}</span>
                    </div>
                    <div>
                      <span className="text-[9px] uppercase font-black text-slate-400 block mb-0.5">Commencement Date</span>
                      <span className="text-slate-900 font-extrabold">{selectedPlan.dateCommenced || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="text-[9px] uppercase font-black text-slate-400 block mb-0.5">Check-in Date</span>
                      <span className="text-slate-900 font-extrabold">{selectedPlan.checkInDate || 'N/A'}</span>
                    </div>
                  </div>

                  {/* Purpose */}
                  <div>
                    <h3 className="text-xs font-black uppercase tracking-wider text-indigo-600 mb-2">Program Purpose</h3>
                    <p className="text-xs font-semibold leading-relaxed text-slate-600 bg-slate-50/50 p-4 rounded-2xl border border-slate-100/50">
                      {selectedPlan.purpose}
                    </p>
                  </div>

                  {/* Measures Ledger */}
                  <div>
                    <h3 className="text-xs font-black uppercase tracking-wider text-indigo-600 mb-3">Measures & Benchmarks</h3>
                    <div className="border border-slate-100 rounded-2xl overflow-hidden shadow-sm">
                      <Table>
                        <TableHeader className="bg-slate-50">
                          <TableRow>
                            <TableHead className="text-[10px] font-black uppercase text-slate-900">Measure</TableHead>
                            <TableHead className="text-[10px] font-black uppercase text-slate-900">Starting Point</TableHead>
                            <TableHead className="text-[10px] font-black uppercase text-slate-900">Goal by 30 Oct 2026</TableHead>
                            <TableHead className="text-[10px] font-black uppercase text-slate-900">Result</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {selectedPlan.measures?.map((m, idx) => (
                            <TableRow key={idx} className="hover:bg-slate-50/50">
                              <TableCell className="text-xs font-bold text-slate-900">{m.measure}</TableCell>
                              <TableCell className="text-xs font-semibold text-slate-600">{m.startingPoint || '-'}</TableCell>
                              <TableCell className="text-xs font-semibold text-slate-600">{m.goal || '-'}</TableCell>
                              <TableCell className="text-xs font-semibold text-slate-600">{m.result || '-'}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>

                  {/* Stop Start Continue */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-red-50/30 border border-red-100 p-4 rounded-2xl space-y-3 min-w-0">
                      <h4 className="text-[10px] font-black uppercase tracking-widest text-red-600 flex items-center gap-1.5">
                        <AlertCircle className="w-3.5 h-3.5" /> Stop Doing
                      </h4>
                      <ul className="text-xs font-semibold text-slate-700 space-y-1.5 list-decimal pl-4 break-words">
                        {selectedPlan.stopList?.map((item, idx) => item && <li key={idx}>{item}</li>)}
                      </ul>
                    </div>

                    <div className="bg-emerald-50/30 border border-emerald-100 p-4 rounded-2xl space-y-3 min-w-0">
                      <h4 className="text-[10px] font-black uppercase tracking-widest text-emerald-600 flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Start Doing
                      </h4>
                      <ul className="text-xs font-semibold text-slate-700 space-y-1.5 list-decimal pl-4 break-words">
                        {selectedPlan.startList?.map((item, idx) => item && <li key={idx}>{item}</li>)}
                      </ul>
                    </div>

                    <div className="bg-blue-50/30 border border-blue-100 p-4 rounded-2xl space-y-3 min-w-0">
                      <h4 className="text-[10px] font-black uppercase tracking-widest text-blue-600 flex items-center gap-1.5">
                        <RefreshCw className="w-3.5 h-3.5" /> Continue Doing
                      </h4>
                      <ul className="text-xs font-semibold text-slate-700 space-y-1.5 list-decimal pl-4 break-words">
                        {selectedPlan.continueList?.map((item, idx) => item && <li key={idx}>{item}</li>)}
                      </ul>
                    </div>
                  </div>

                  {/* Strategies */}
                  <div>
                    <h3 className="text-xs font-black uppercase tracking-wider text-indigo-600 mb-3">Committed Strategies</h3>
                    <div className="border border-slate-100 rounded-2xl overflow-hidden shadow-sm">
                      <Table>
                        <TableHeader className="bg-slate-50">
                          <TableRow>
                            <TableHead className="text-[10px] font-black uppercase text-slate-900">Strategy</TableHead>
                            <TableHead className="text-[10px] font-black uppercase text-slate-900 w-32 text-center">Achieving</TableHead>
                            <TableHead className="text-[10px] font-black uppercase text-slate-900">Details</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {selectedPlan.strategies?.map((item, idx) => (
                            <TableRow key={idx} className="hover:bg-slate-50/50">
                              <TableCell className="text-xs font-bold text-slate-900 max-w-[300px] break-words">{item.strategy || '-'}</TableCell>
                              <TableCell className="text-center">
                                <Badge className={`font-black text-[9px] uppercase tracking-wider ${
                                  item.achieving === 'Y' ? 'bg-emerald-500/20 text-emerald-600 border-none' : 
                                  item.achieving === 'N' ? 'bg-red-500/20 text-red-600 border-none' : 'bg-slate-100 text-slate-500 border-none'
                                }`}>
                                  {item.achieving === 'Y' ? 'Yes' : item.achieving === 'N' ? 'No' : 'Pending'}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-xs font-semibold text-slate-600 max-w-[250px] break-words">{item.detail || '-'}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>

                  {/* Required commitments */}
                  <div>
                    <h3 className="text-xs font-black uppercase tracking-wider text-indigo-600 mb-3">Required Commitments from Manager</h3>
                    <div className="border border-slate-100 rounded-2xl overflow-hidden shadow-sm">
                      <Table>
                        <TableHeader className="bg-slate-50">
                          <TableRow>
                            <TableHead className="text-[10px] font-black uppercase text-slate-900">Commitment</TableHead>
                            <TableHead className="text-[10px] font-black uppercase text-slate-900 w-32 text-center">Achieving</TableHead>
                            <TableHead className="text-[10px] font-black uppercase text-slate-900">Details</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {selectedPlan.managerCommitments?.map((item, idx) => (
                            <TableRow key={idx} className="hover:bg-slate-50/50">
                              <TableCell className="text-xs font-bold text-slate-900 max-w-[300px] break-words">{item.commitment || '-'}</TableCell>
                              <TableCell className="text-center">
                                <Badge className={`font-black text-[9px] uppercase tracking-wider ${
                                  item.achieving === 'Y' ? 'bg-emerald-500/20 text-emerald-600 border-none' : 
                                  item.achieving === 'N' ? 'bg-red-500/20 text-red-600 border-none' : 'bg-slate-100 text-slate-500 border-none'
                                }`}>
                                  {item.achieving === 'Y' ? 'Yes' : item.achieving === 'N' ? 'No' : 'Pending'}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-xs font-semibold text-slate-600 max-w-[250px] break-words">{item.detail || '-'}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>

                  {/* Summary */}
                  {selectedPlan.summary && (
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-1">
                      <span className="text-[10px] uppercase font-black text-slate-400 block mb-1">Plan Summary & Key Takeaways</span>
                      <p className="text-xs font-bold text-slate-900 leading-relaxed">
                        {selectedPlan.summary}
                      </p>
                    </div>
                  )}
                </CardContent>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-40 text-center space-y-4">
                <ClipboardList className="w-16 h-16 text-slate-200" />
                <div>
                  <h3 className="text-sm font-black uppercase tracking-wider text-slate-950">No plan selected</h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                    Select a plan from the list or create a new success plan
                  </p>
                </div>
                <Button onClick={handleStartCreate} className="bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold">
                  Create Success Plan
                </Button>
              </div>
            )}
          </Card>
        </div>
      ) : (
        /* EDITING / CREATING FORM VIEW */
        <Card className="border-none shadow-xl bg-white rounded-3xl overflow-hidden">
          <CardHeader className="bg-slate-900 text-white p-6">
            <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-indigo-400" />
              {isCreating ? 'Create Success Plan' : 'Edit Success Plan'}
            </CardTitle>
            <CardDescription className="text-slate-400 text-xs font-semibold mt-0.5">
              Please fill out all the requirements for the North Parcel Sales template.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6 space-y-8">
            
            {/* Meta Inputs */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 bg-slate-50 p-6 rounded-2xl border border-slate-100">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-slate-900 block">Team Member</label>
                {isLeader ? (
                  <Select value={formState.teamMemberId} onValueChange={(val) => {
                    const selected = allUsers?.find(u => u.uid === val);
                    setFormState(prev => ({ ...prev, teamMemberId: val, teamMemberName: selected?.name || '' }));
                  }}>
                    <SelectTrigger className="rounded-xl text-xs font-bold border-slate-200 bg-white">
                      <SelectValue placeholder="Select Team Member" />
                    </SelectTrigger>
                    <SelectContent>
                      {allUsers?.map(u => (
                        <SelectItem key={u.uid} value={u.uid}>{u.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input value={profile?.name || ''} disabled className="rounded-xl text-xs font-bold border-slate-200 bg-slate-100" />
                )}
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-slate-900 block">Manager</label>
                <Input 
                  placeholder="Manager's Name" 
                  value={formState.managerName}
                  onChange={(e) => setFormState(prev => ({ ...prev, managerName: e.target.value }))}
                  className="rounded-xl text-xs font-bold border-slate-200 bg-white" 
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-slate-900 block">Date Commenced</label>
                <Input 
                  type="date"
                  value={formState.dateCommenced}
                  onChange={(e) => setFormState(prev => ({ ...prev, dateCommenced: e.target.value }))}
                  className="rounded-xl text-xs font-bold border-slate-200 bg-white" 
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-slate-900 block">Check-in Date</label>
                <Input 
                  type="date"
                  value={formState.checkInDate}
                  onChange={(e) => setFormState(prev => ({ ...prev, checkInDate: e.target.value }))}
                  className="rounded-xl text-xs font-bold border-slate-200 bg-white" 
                />
              </div>
            </div>

            {/* Purpose */}
            <div className="space-y-2">
              <label className="text-xs font-black uppercase text-slate-900 flex items-center gap-1.5">
                Purpose
              </label>
              <Textarea 
                value={formState.purpose} 
                onChange={(e) => setFormState(prev => ({ ...prev, purpose: e.target.value }))}
                className="rounded-2xl border-slate-200 text-xs font-bold min-h-[80px]"
              />
            </div>

            {/* Measures & Benchmarks Form Table */}
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <label className="text-xs font-black uppercase text-indigo-600 block">Measures & Benchmarks</label>
                <Button onClick={addMeasureRow} variant="outline" size="sm" className="rounded-xl border-slate-200 text-[10px] font-bold uppercase tracking-wider gap-1 h-8">
                  <Plus className="w-3.5 h-3.5" /> Add Row
                </Button>
              </div>
              
              <div className="border border-slate-100 rounded-2xl overflow-hidden shadow-sm">
                <Table>
                  <TableHeader className="bg-slate-50">
                    <TableRow>
                      <TableHead className="text-[10px] font-black uppercase text-slate-900">Measure</TableHead>
                      <TableHead className="text-[10px] font-black uppercase text-slate-900">Starting Point</TableHead>
                      <TableHead className="text-[10px] font-black uppercase text-slate-900">Goal by 30 Oct 2026</TableHead>
                      <TableHead className="text-[10px] font-black uppercase text-slate-900">Result</TableHead>
                      <TableHead className="w-16 text-center"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {formState.measures.map((row, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="p-2">
                          <Textarea 
                            value={row.measure}
                            onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
                              const updated = [...formState.measures];
                              updated[idx].measure = e.target.value;
                              setFormState(prev => ({ ...prev, measures: updated }));
                            }}
                            placeholder="e.g. Portfolio Revenue Growth"
                            className="rounded-lg text-xs border-slate-200 bg-white min-h-[38px] resize-y py-1.5 font-semibold"
                            rows={1}
                          />
                        </TableCell>
                        <TableCell className="p-2">
                          <Textarea 
                            value={row.startingPoint}
                            onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
                              const updated = [...formState.measures];
                              updated[idx].startingPoint = e.target.value;
                              setFormState(prev => ({ ...prev, measures: updated }));
                            }}
                            className="rounded-lg text-xs border-slate-200 bg-white min-h-[38px] resize-y py-1.5 font-semibold"
                            rows={1}
                          />
                        </TableCell>
                        <TableCell className="p-2">
                          <Textarea 
                            value={row.goal}
                            onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
                              const updated = [...formState.measures];
                              updated[idx].goal = e.target.value;
                              setFormState(prev => ({ ...prev, measures: updated }));
                            }}
                            className="rounded-lg text-xs border-slate-200 bg-white min-h-[38px] resize-y py-1.5 font-semibold"
                            rows={1}
                          />
                        </TableCell>
                        <TableCell className="p-2">
                          <Textarea 
                            value={row.result}
                            onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
                              const updated = [...formState.measures];
                              updated[idx].result = e.target.value;
                              setFormState(prev => ({ ...prev, measures: updated }));
                            }}
                            className="rounded-lg text-xs border-slate-200 bg-white min-h-[38px] resize-y py-1.5 font-semibold"
                            rows={1}
                          />
                        </TableCell>
                        <TableCell className="text-center p-2">
                          <Button variant="ghost" onClick={() => removeMeasureRow(idx)} className="h-8 w-8 p-0 text-red-500 hover:text-red-700">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Standard Measure Quick Select Library */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100/50 space-y-2">
                <span className="text-[9px] uppercase font-black text-slate-400 block">💡 Quick Insert Measure Template</span>
                <div className="flex flex-wrap gap-2">
                  {STANDARD_MEASURES.map((item, index) => (
                    <button
                      key={index}
                      type="button"
                      onClick={() => {
                        setFormState(prev => ({
                          ...prev,
                          measures: [...prev.measures, { measure: item.name, startingPoint: '', goal: '', result: '' }]
                        }));
                        toast({ title: 'Measure added', description: `Added "${item.name}"` });
                      }}
                      className="px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider bg-white border border-slate-200 hover:border-slate-400 rounded-lg text-slate-700 transition-all flex items-center gap-1"
                    >
                      <Plus className="w-2.5 h-2.5" /> {item.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Stop, Start, Continue Form */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-red-50/20 border border-red-100 p-5 rounded-2xl space-y-4">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-red-600 flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4" /> Stop Doing (Challenges & Pitfalls)
                </h4>
                <div className="space-y-3">
                  {[0, 1, 2].map((idx) => (
                    <Textarea
                      key={idx}
                      placeholder={`${idx + 1}. Item to STOP doing`}
                      value={formState.stopList[idx] || ''}
                      onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
                        const updated = [...formState.stopList];
                        updated[idx] = e.target.value;
                        setFormState(prev => ({ ...prev, stopList: updated }));
                      }}
                      className="rounded-xl text-xs border-slate-200 bg-white min-h-[38px] resize-y py-1.5 font-semibold"
                      rows={1}
                    />
                  ))}
                </div>
              </div>

              <div className="bg-emerald-50/20 border border-emerald-100 p-5 rounded-2xl space-y-4">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-emerald-600 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" /> Start Doing (New Activities)
                </h4>
                <div className="space-y-3">
                  {[0, 1, 2].map((idx) => (
                    <Textarea
                      key={idx}
                      placeholder={`${idx + 1}. Item to START doing`}
                      value={formState.startList[idx] || ''}
                      onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
                        const updated = [...formState.startList];
                        updated[idx] = e.target.value;
                        setFormState(prev => ({ ...prev, startList: updated }));
                      }}
                      className="rounded-xl text-xs border-slate-200 bg-white min-h-[38px] resize-y py-1.5 font-semibold"
                      rows={1}
                    />
                  ))}
                </div>
              </div>

              <div className="bg-blue-50/20 border border-blue-100 p-5 rounded-2xl space-y-4">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-blue-600 flex items-center gap-1.5">
                  <RefreshCw className="w-4 h-4" /> Continue Doing (Core Strengths)
                </h4>
                <div className="space-y-3">
                  {[0, 1, 2].map((idx) => (
                    <Textarea
                      key={idx}
                      placeholder={`${idx + 1}. Item to CONTINUE doing`}
                      value={formState.continueList[idx] || ''}
                      onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
                        const updated = [...formState.continueList];
                        updated[idx] = e.target.value;
                        setFormState(prev => ({ ...prev, continueList: updated }));
                      }}
                      className="rounded-xl text-xs border-slate-200 bg-white min-h-[38px] resize-y py-1.5 font-semibold"
                      rows={1}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Dynamic strategies, measures to achieve, commitments */}
            <div className="space-y-8">
              {/* Strategies to achieve goals */}
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-black uppercase text-slate-900">Committed Strategies to Achieve & Exceed Goals</label>
                  <Button onClick={addStrategyRow} variant="outline" size="sm" className="rounded-xl border-slate-200 text-[10px] font-bold uppercase tracking-wider gap-1 h-8">
                    <Plus className="w-3.5 h-3.5" /> Add Strategy
                  </Button>
                </div>
                <div className="border border-slate-100 rounded-2xl overflow-hidden shadow-sm">
                  <Table>
                    <TableHeader className="bg-slate-50">
                      <TableRow>
                        <TableHead className="text-[10px] font-black uppercase text-slate-900">Your Strategy</TableHead>
                        <TableHead className="text-[10px] font-black uppercase text-slate-900 w-44">Achieving Y/N</TableHead>
                        <TableHead className="text-[10px] font-black uppercase text-slate-900">Details</TableHead>
                        <TableHead className="w-16 text-center"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {formState.strategies.map((row, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="p-2">
                            <Textarea 
                              value={row.strategy}
                              onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
                                const updated = [...formState.strategies];
                                updated[idx].strategy = e.target.value;
                                setFormState(prev => ({ ...prev, strategies: updated }));
                              }}
                              placeholder="Describe your strategy"
                              className="rounded-lg text-xs border-slate-200 bg-white min-h-[38px] resize-y py-1.5 font-semibold"
                              rows={1}
                            />
                          </TableCell>
                          <TableCell className="p-2">
                            <Select value={row.achieving} onValueChange={(val) => {
                              const updated = [...formState.strategies];
                              updated[idx].achieving = val as 'Y' | 'N' | 'PENDING';
                              setFormState(prev => ({ ...prev, strategies: updated }));
                            }}>
                              <SelectTrigger className="rounded-lg text-xs font-bold border-slate-200 bg-white h-9">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="PENDING">Pending</SelectItem>
                                <SelectItem value="Y">Yes</SelectItem>
                                <SelectItem value="N">No</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell className="p-2">
                            <Textarea 
                              value={row.detail}
                              onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
                                const updated = [...formState.strategies];
                                updated[idx].detail = e.target.value;
                                setFormState(prev => ({ ...prev, strategies: updated }));
                              }}
                              placeholder="Include detail / progress notes"
                              className="rounded-lg text-xs border-slate-200 bg-white min-h-[38px] resize-y py-1.5 font-semibold"
                              rows={1}
                            />
                          </TableCell>
                          <TableCell className="text-center p-2">
                            <Button variant="ghost" onClick={() => removeStrategyRow(idx)} className="h-8 w-8 p-0 text-red-500 hover:text-red-700">
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>

              {/* Measures to achieve goals */}
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-black uppercase text-slate-900">Measures to Achieve Goals</label>
                  <Button onClick={addMeasuresToAchieveRow} variant="outline" size="sm" className="rounded-xl border-slate-200 text-[10px] font-bold uppercase tracking-wider gap-1 h-8">
                    <Plus className="w-3.5 h-3.5" /> Add Measure
                  </Button>
                </div>
                <div className="border border-slate-100 rounded-2xl overflow-hidden shadow-sm">
                  <Table>
                    <TableHeader className="bg-slate-50">
                      <TableRow>
                        <TableHead className="text-[10px] font-black uppercase text-slate-900">Measures</TableHead>
                        <TableHead className="text-[10px] font-black uppercase text-slate-900 w-44">Achieving Y/N</TableHead>
                        <TableHead className="text-[10px] font-black uppercase text-slate-900">Details</TableHead>
                        <TableHead className="w-16 text-center"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {formState.measuresToAchieve.map((row, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="p-2">
                            <Textarea 
                              value={row.measure}
                              onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
                                const updated = [...formState.measuresToAchieve];
                                updated[idx].measure = e.target.value;
                                setFormState(prev => ({ ...prev, measuresToAchieve: updated }));
                              }}
                              placeholder="Describe measure details"
                              className="rounded-lg text-xs border-slate-200 bg-white min-h-[38px] resize-y py-1.5 font-semibold"
                              rows={1}
                            />
                          </TableCell>
                          <TableCell className="p-2">
                            <Select value={row.achieving} onValueChange={(val) => {
                              const updated = [...formState.measuresToAchieve];
                              updated[idx].achieving = val as 'Y' | 'N' | 'PENDING';
                              setFormState(prev => ({ ...prev, measuresToAchieve: updated }));
                            }}>
                              <SelectTrigger className="rounded-lg text-xs font-bold border-slate-200 bg-white h-9">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="PENDING">Pending</SelectItem>
                                <SelectItem value="Y">Yes</SelectItem>
                                <SelectItem value="N">No</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell className="p-2">
                            <Textarea 
                              value={row.detail}
                              onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
                                const updated = [...formState.measuresToAchieve];
                                updated[idx].detail = e.target.value;
                                setFormState(prev => ({ ...prev, measuresToAchieve: updated }));
                              }}
                              placeholder="Include details"
                              className="rounded-lg text-xs border-slate-200 bg-white min-h-[38px] resize-y py-1.5 font-semibold"
                              rows={1}
                            />
                          </TableCell>
                          <TableCell className="text-center p-2">
                            <Button variant="ghost" onClick={() => removeMeasuresToAchieveRow(idx)} className="h-8 w-8 p-0 text-red-500 hover:text-red-700">
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>

              {/* Commitments from Manager */}
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-black uppercase text-slate-900">Required commitments from your Manager</label>
                  <Button onClick={addManagerCommitmentsRow} variant="outline" size="sm" className="rounded-xl border-slate-200 text-[10px] font-bold uppercase tracking-wider gap-1 h-8">
                    <Plus className="w-3.5 h-3.5" /> Add Commitment
                  </Button>
                </div>
                <div className="border border-slate-100 rounded-2xl overflow-hidden shadow-sm">
                  <Table>
                    <TableHeader className="bg-slate-50">
                      <TableRow>
                        <TableHead className="text-[10px] font-black uppercase text-slate-900">Commitments</TableHead>
                        <TableHead className="text-[10px] font-black uppercase text-slate-900 w-44">Achieving Y/N</TableHead>
                        <TableHead className="text-[10px] font-black uppercase text-slate-900">Details</TableHead>
                        <TableHead className="w-16 text-center"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {formState.managerCommitments.map((row, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="p-2">
                            <Textarea 
                              value={row.commitment}
                              onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
                                const updated = [...formState.managerCommitments];
                                updated[idx].commitment = e.target.value;
                                setFormState(prev => ({ ...prev, managerCommitments: updated }));
                              }}
                              placeholder="Describe manager's required commitments"
                              className="rounded-lg text-xs border-slate-200 bg-white min-h-[38px] resize-y py-1.5 font-semibold"
                              rows={1}
                            />
                          </TableCell>
                          <TableCell className="p-2">
                            <Select value={row.achieving} onValueChange={(val) => {
                              const updated = [...formState.managerCommitments];
                              updated[idx].achieving = val as 'Y' | 'N' | 'PENDING';
                              setFormState(prev => ({ ...prev, managerCommitments: updated }));
                            }}>
                              <SelectTrigger className="rounded-lg text-xs font-bold border-slate-200 bg-white h-9">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="PENDING">Pending</SelectItem>
                                <SelectItem value="Y">Yes</SelectItem>
                                <SelectItem value="N">No</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell className="p-2">
                            <Textarea 
                              value={row.detail}
                              onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
                                const updated = [...formState.managerCommitments];
                                updated[idx].detail = e.target.value;
                                setFormState(prev => ({ ...prev, managerCommitments: updated }));
                              }}
                              placeholder="Include progress/detail notes"
                              className="rounded-lg text-xs border-slate-200 bg-white min-h-[38px] resize-y py-1.5 font-semibold"
                              rows={1}
                            />
                          </TableCell>
                          <TableCell className="text-center p-2">
                            <Button variant="ghost" onClick={() => removeManagerCommitmentsRow(idx)} className="h-8 w-8 p-0 text-red-500 hover:text-red-700">
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>

            {/* Summary Comments */}
            <div className="space-y-2">
              <label className="text-xs font-black uppercase text-slate-900 block">Summary</label>
              <Textarea 
                placeholder="Write summary notes / coaching feedback / executive review"
                value={formState.summary}
                onChange={(e) => setFormState(prev => ({ ...prev, summary: e.target.value }))}
                className="rounded-2xl border-slate-200 text-xs font-semibold min-h-[120px]" 
              />
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-6 border-t border-slate-100">
              <Button onClick={() => {
                setIsEditing(false);
                setIsCreating(false);
              }} variant="ghost" className="rounded-xl text-xs font-bold uppercase tracking-wider">
                Cancel
              </Button>
              <Button onClick={() => handleSave('DRAFT')} variant="outline" className="border-slate-300 text-slate-700 rounded-xl text-xs font-bold uppercase tracking-wider px-6">
                Save as Draft
              </Button>
              <Button onClick={() => handleSave('FINALISED')} className="bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold uppercase tracking-wider px-6">
                Finalise Plan
              </Button>
            </div>

          </CardContent>
        </Card>
      )}
    </div>
  );
}
