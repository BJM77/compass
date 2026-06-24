import re
import sys

def patch_twiw():
    with open('src/components/dashboard/twiw-view.tsx', 'r') as f:
        content = f.read()
        
    # 1. Update imports
    lucide_import_pattern = r"import \{\s*(.*?)\s*\} from 'lucide-react';"
    match = re.search(lucide_import_pattern, content, re.DOTALL)
    if match:
        existing_imports = match.group(1)
        new_imports = existing_imports + ", Phone, Users, DollarSign, FileText, BarChart3, CheckCircle2, XCircle, Clock, RefreshCw, Shield"
        content = content.replace(match.group(0), f"import {{\n  {new_imports}\n}} from 'lucide-react';")

    # 2. Add KPIReview interface
    interface_injection = """
interface KPIReview {
  callsTarget: number;
  appointmentsTarget: number;
  proposalsTarget: number;
  dealsTarget: number;
  revenueTarget: number;
  callsActual: number;
  appointmentsActual: number;
  proposalsActual: number;
  dealsActual: number;
  revenueActual: number;
  kpiNotes: string;
}

interface TWIWViewProps {"""
    content = content.replace("interface TWIWViewProps {", interface_injection)

    # 3. Component setup
    setup_target = """export function TWIWView({ userId, isLeader }: TWIWViewProps) {
  const db = useFirestore();
  const { toast } = useToast();
  const currentWeek = getCurrentWeek();
  const { pipelineReviews: allDeals } = usePipelineData();
  const { profile, user } = useAuth();"""
    
    setup_replacement = """export function TWIWView({ userId, isLeader }: TWIWViewProps) {
  const db = useFirestore();
  const { toast } = useToast();
  const { profile, user, isGuest } = useAuth();
  const currentWeek = getCurrentWeek();
  const { pipelineReviews: allDeals } = usePipelineData();
  
  // Helper to get previous week key
  function getPreviousWeekKey(weekKey: string): string {
    const [yearStr, weekStr] = weekKey.split('-');
    const year = parseInt(yearStr, 10);
    const weekNum = parseInt(weekStr, 10);
    if (weekNum > 1) {
      return `${year}-${String(weekNum - 1).padStart(2, '0')}`;
    } else {
      return `${year - 1}-52`;
    }
  }
  const previousWeek = getPreviousWeekKey(currentWeek);
  
  const isRegisteredUser = !isGuest && (profile?.role === 'BDM' || profile?.role === 'ACCOUNT_MANAGER');"""
    content = content.replace(setup_target, setup_replacement)

    # 4. State & Effect injection
    state_injection = """
  // KPI Review State - only for registered users
  const [kpiReview, setKpiReview] = useState<KPIReview>({
    callsTarget: 0, appointmentsTarget: 0, proposalsTarget: 0, dealsTarget: 0, revenueTarget: 0,
    callsActual: 0, appointmentsActual: 0, proposalsActual: 0, dealsActual: 0, revenueActual: 0, kpiNotes: ''
  });
  const [previousFocusAccounts, setPreviousFocusAccounts] = useState<any[]>([]);

  useEffect(() => {
    async function loadPreviousFridayData() {
      if (!db || !userId || !isRegisteredUser) return;
      try {
        const { getDoc, getDocs, query, collection, where, doc } = await import('firebase/firestore');
        const prevCommitRef = doc(db, 'weeklyCommitments', `${userId}_${previousWeek}`);
        const prevCommitSnap = await getDoc(prevCommitRef);
        if (prevCommitSnap.exists()) {
          const prevData = prevCommitSnap.data();
          const kpiTargets = prevData.kpiTargets || {};
          setKpiReview(prev => ({
            ...prev,
            callsTarget: kpiTargets.callsToMake || 0,
            appointmentsTarget: kpiTargets.appointmentsToSet || 0,
            proposalsTarget: kpiTargets.proposalsToSend || 0,
            dealsTarget: kpiTargets.dealsToClose || 0,
            revenueTarget: kpiTargets.revenueTarget || 0
          }));
          setPreviousFocusAccounts(prevData.focusAccounts || []);
        }
        
        const prevProgressRef = doc(db, 'weeklyProgress', `${userId}_${previousWeek}`);
        const prevProgressSnap = await getDoc(prevProgressRef);
        if (prevProgressSnap.exists()) {
          const progressData = prevProgressSnap.data();
          setKpiReview(prev => ({
            ...prev,
            callsActual: progressData.calls || 0,
            appointmentsActual: progressData.apps || 0,
            proposalsActual: progressData.proposals || 0,
            dealsActual: progressData.deals || 0
          }));
        }
        
        const prevPipelineSnap = await getDocs(query(collection(db, 'pipelineReviews'), where('userId', '==', userId), where('week', '==', previousWeek)));
        const wonRevenue = prevPipelineSnap.docs.map(d => d.data()).filter(d => d.stage === 'Closed Won').reduce((sum, d) => sum + (Number(d.value) || 0), 0);
        setKpiReview(prev => ({ ...prev, revenueActual: wonRevenue || 0 }));
      } catch (error) { console.error(error); }
    }
    loadPreviousFridayData();
  }, [db, userId, previousWeek, isRegisteredUser]);

  const updateKPI = (field: keyof Omit<KPIReview, 'kpiNotes'>, value: number) => {
    if (!isRegisteredUser) return;
    setKpiReview(prev => ({ ...prev, [field]: value }));
  };
"""
    # Insert after Active Week State
    active_week_target = "const [selectedWeek, setSelectedWeek] = useState(currentWeek);"
    content = content.replace(active_week_target, active_week_target + "\n" + state_injection)

    # 5. Handle Save
    save_target = """        priorities: priorities.filter(p => p.text.trim()),
        status: submitState,"""
    save_replacement = """        priorities: priorities.filter(p => p.text.trim()),
        kpiReview: {
          targets: { calls: kpiReview.callsTarget, appointments: kpiReview.appointmentsTarget, proposals: kpiReview.proposalsTarget, deals: kpiReview.dealsTarget, revenue: kpiReview.revenueTarget },
          actuals: { calls: kpiReview.callsActual, appointments: kpiReview.appointmentsActual, proposals: kpiReview.proposalsActual, deals: kpiReview.dealsActual, revenue: kpiReview.revenueActual },
          notes: kpiReview.kpiNotes
        },
        status: submitState,"""
    content = content.replace(save_target, save_replacement)

    # 6. Replace `renderSubmissionForm` definition and add new renderers
    # The current one starts with: `function renderSubmissionForm() {` 
    # Or `const renderSubmissionForm = () => {`
    
    render_form_target = "function renderSubmissionForm() {"
    if render_form_target not in content:
        render_form_target = "const renderSubmissionForm = () => {"
        
    render_form_replacement = """
  const renderKPIReview = () => {
    if (!isRegisteredUser) return null;
    return (
      <Card className="border-slate-200 shadow-sm rounded-3xl overflow-hidden bg-white mb-6">
        <CardHeader className="bg-slate-50/50 border-b py-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm font-black uppercase tracking-wider text-slate-800 flex items-center gap-2">
                <Target className="w-4 h-4 text-emerald-600" /> Weekly KPI Review (vs Previous Friday's Plan)
              </CardTitle>
              <CardDescription className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                Review your performance against the KPI targets set last Friday
              </CardDescription>
            </div>
            <Badge className="bg-slate-100 text-slate-600 font-black text-[9px] uppercase">Week {previousWeek.split('-')[1]} Targets</Badge>
          </div>
        </CardHeader>
        <CardContent className="p-6 space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="space-y-2"><div className="flex items-center gap-2"><Phone className="w-4 h-4 text-blue-500" /><div className="text-[9px] font-black uppercase text-slate-500">Calls</div></div><div className="flex gap-2"><div className="flex-1"><div className="text-[8px] font-bold text-slate-400 uppercase">Target</div><div className="text-xl font-black text-slate-800">{kpiReview.callsTarget}</div></div><div className="flex-1"><div className="text-[8px] font-bold text-slate-400 uppercase">Actual</div><Input type="number" value={kpiReview.callsActual || ''} onChange={(e) => updateKPI('callsActual', parseInt(e.target.value) || 0)} className="h-9 text-lg font-black w-full" placeholder="0" /></div></div></div>
            <div className="space-y-2"><div className="flex items-center gap-2"><Users className="w-4 h-4 text-emerald-500" /><div className="text-[9px] font-black uppercase text-slate-500">Appts</div></div><div className="flex gap-2"><div className="flex-1"><div className="text-[8px] font-bold text-slate-400 uppercase">Target</div><div className="text-xl font-black text-slate-800">{kpiReview.appointmentsTarget}</div></div><div className="flex-1"><div className="text-[8px] font-bold text-slate-400 uppercase">Actual</div><Input type="number" value={kpiReview.appointmentsActual || ''} onChange={(e) => updateKPI('appointmentsActual', parseInt(e.target.value) || 0)} className="h-9 text-lg font-black w-full" placeholder="0" /></div></div></div>
            <div className="space-y-2"><div className="flex items-center gap-2"><FileText className="w-4 h-4 text-purple-500" /><div className="text-[9px] font-black uppercase text-slate-500">Proposals</div></div><div className="flex gap-2"><div className="flex-1"><div className="text-[8px] font-bold text-slate-400 uppercase">Target</div><div className="text-xl font-black text-slate-800">{kpiReview.proposalsTarget}</div></div><div className="flex-1"><div className="text-[8px] font-bold text-slate-400 uppercase">Actual</div><Input type="number" value={kpiReview.proposalsActual || ''} onChange={(e) => updateKPI('proposalsActual', parseInt(e.target.value) || 0)} className="h-9 text-lg font-black w-full" placeholder="0" /></div></div></div>
            <div className="space-y-2"><div className="flex items-center gap-2"><Award className="w-4 h-4 text-amber-500" /><div className="text-[9px] font-black uppercase text-slate-500">Wins</div></div><div className="flex gap-2"><div className="flex-1"><div className="text-[8px] font-bold text-slate-400 uppercase">Target</div><div className="text-xl font-black text-slate-800">{kpiReview.dealsTarget}</div></div><div className="flex-1"><div className="text-[8px] font-bold text-slate-400 uppercase">Actual</div><Input type="number" value={kpiReview.dealsActual || ''} onChange={(e) => updateKPI('dealsActual', parseInt(e.target.value) || 0)} className="h-9 text-lg font-black w-full" placeholder="0" /></div></div></div>
            <div className="space-y-2"><div className="flex items-center gap-2"><DollarSign className="w-4 h-4 text-emerald-500" /><div className="text-[9px] font-black uppercase text-slate-500">Revenue</div></div><div className="flex gap-2"><div className="flex-1"><div className="text-[8px] font-bold text-slate-400 uppercase">Target</div><div className="text-lg font-black text-slate-800">${(kpiReview.revenueTarget / 1000).toFixed(0)}K</div></div><div className="flex-1"><div className="text-[8px] font-bold text-slate-400 uppercase">Actual</div><Input type="number" value={kpiReview.revenueActual || ''} onChange={(e) => updateKPI('revenueActual', parseInt(e.target.value) || 0)} className="h-9 text-lg font-black w-full" placeholder="0" /></div></div></div>
          </div>
          <div className="space-y-2">
            <div className="text-[10px] font-black uppercase text-slate-500">Weekly KPI Notes & Commentary</div>
            <Textarea placeholder="Provide notes on your KPI performance this week..." value={kpiReview.kpiNotes} onChange={(e) => setKpiReview(prev => ({ ...prev, kpiNotes: e.target.value }))} className="min-h-[80px] text-xs font-medium rounded-xl" />
          </div>
          {previousFocusAccounts.length > 0 && (
            <div className="space-y-3 pt-4 border-t">
              <h4 className="text-xs font-black uppercase text-slate-700 flex items-center gap-2"><Target className="w-3.5 h-3.5 text-accent" /> Previous Week's Focus Accounts (from Friday Plan)</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {previousFocusAccounts.map((acc: any, idx: number) => (
                  <div key={idx} className="p-3 bg-slate-50 border rounded-xl">
                    <p className="font-bold text-slate-800">{acc.accountName}</p>
                    <div className="flex gap-2 mt-1 text-[10px] text-slate-500">
                      <Badge variant="outline" className="text-[7px] font-black uppercase">{acc.actionType}</Badge>
                      <span className="font-black">${(acc.eav || 0).toLocaleString()}</span>
                    </div>
                    {acc.aboutAccount && <p className="text-[10px] text-slate-600 mt-1 line-clamp-2">{acc.aboutAccount}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  const renderGuestView = () => (
    <div className="space-y-6">
      <Card className="border-slate-200 shadow-sm rounded-3xl overflow-hidden bg-white mb-6">
        <CardHeader className="bg-slate-50/50 border-b py-4">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-slate-400" />
            <CardTitle className="text-sm font-black uppercase tracking-wider text-slate-600">Guest Access</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-6 text-center">
          <div className="flex flex-col items-center gap-4 py-8">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center"><Shield className="w-8 h-8 text-slate-400" /></div>
            <div className="space-y-2 max-w-md">
              <h3 className="text-lg font-black text-slate-700">TWTW Report</h3>
              <p className="text-sm text-slate-500">As a guest user, you can submit your weekly TWTW report. KPI tracking and advanced features are available for registered BDM and AM users.</p>
              <Badge className="bg-emerald-500/10 text-emerald-600 font-black text-[9px] uppercase mt-2">Submit your weekly update below</Badge>
            </div>
          </div>
        </CardContent>
      </Card>
      {renderBasicTWTWForm()}
    </div>
  );

  const renderBasicTWTWForm = () => {
"""
    content = content.replace(render_form_target, render_form_replacement)
    
    # After renderBasicTWTWForm, it needs to be closed and called. We'll find where `renderSubmissionForm` is called.
    
    # 7. Update main render block
    main_render_target = """        {isLoading ? (
          <div className="flex justify-center items-center py-24"><Loader2 className="animate-spin text-primary w-8 h-8" /></div>
        ) : (
          renderSubmissionForm()
        )}"""
        
    main_render_replacement = """        {isLoading ? (
          <div className="flex justify-center items-center py-24"><Loader2 className="animate-spin text-primary w-8 h-8" /></div>
        ) : isRegisteredUser ? (
          <div className="space-y-6">
            {renderKPIReview()}
            {renderBasicTWTWForm()}
          </div>
        ) : (
          renderGuestView()
        )}"""
        
    content = content.replace(main_render_target, main_render_replacement)
    
    # Also in the TabsContent for "my-report" (leader view):
    my_report_target = """          <TabsContent value="my-report">
            {isLoading ? (
              <div className="flex justify-center items-center py-24"><Loader2 className="animate-spin text-primary w-8 h-8" /></div>
            ) : (
              renderSubmissionForm()
            )}
          </TabsContent>"""
          
    my_report_replacement = """          <TabsContent value="my-report">
            {isLoading ? (
              <div className="flex justify-center items-center py-24"><Loader2 className="animate-spin text-primary w-8 h-8" /></div>
            ) : (
              <div className="space-y-6">
                {renderKPIReview()}
                {renderBasicTWTWForm()}
              </div>
            )}
          </TabsContent>"""
    
    content = content.replace(my_report_target, my_report_replacement)

    # 8. Title update
    title_target = """          <p className="text-muted-foreground text-xs font-bold uppercase tracking-tight">
            Standardized Team Performance Reporting
          </p>"""
    title_replacement = """          <p className="text-muted-foreground text-xs font-bold uppercase tracking-tight">
            {isRegisteredUser ? 'Standardized Team Performance Reporting' : 'Guest Performance Reporting'}
          </p>"""
    content = content.replace(title_target, title_replacement)
    
    with open('src/components/dashboard/twiw-view.tsx', 'w') as f:
        f.write(content)

patch_twiw()
