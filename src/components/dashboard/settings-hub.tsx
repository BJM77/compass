
"use client";

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { useFirestore } from '@/firebase';
import { doc, getDoc, setDoc, serverTimestamp, collection, query, orderBy, limit, getDocs, writeBatch } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';

import {
  User, Bell, Sparkles, BarChart3, Link2,
  ShieldCheck, Lock, Trash2, Save,
  Loader2, Copy, Check, RefreshCw, Moon, Sun, Globe, Users, Activity, LayoutDashboard,
  LayoutGrid, GripVertical, EyeOff
} from 'lucide-react';

import { ReportingToolsSettings, CustomDashboard, ReportWidget } from './reporting-tools-settings';

export interface DashboardWidgetConfig {
  id: string;
  name: string;
  width: 1 | 2 | 3;
  visible: boolean;
}

interface AppSettings {
  displayName: string;
  email: string;
  notifyEmail: string;
  weeklyDigestEnabled: boolean;
  digestDayOfWeek: string;
  escalationAlertsEnabled: boolean;
  escalationWeeksThreshold: number;
  pushNotificationsEnabled: boolean;
  leaderPulseEnabled: boolean;
  aiModel: string;
  briefCacheTTLDays: number;
  promptTone: string;
  aiUsageLoggingEnabled: boolean;
  autoGenerateBriefs: boolean;
  stallingDaysThreshold: number;
  deadRolloverCount: number;
  gracePeriodDays: number;
  velocityAuditDays: number;
  weightRevenue: number;
  weightActivity: number;
  weightBehaviour: number;
  salesforceOrgUrl: string;
  crmSyncSchedule: string;
  duplicateDetectionMode: string;
  autoPurgeEnabled: boolean;
  accentColour: string;
  uiDensity: string;
  dateFormat: string;
  sessionTimeoutMinutes: number;
  customDashboards: CustomDashboard[];
  reportWidgets: ReportWidget[];
  dashboardLayout?: DashboardWidgetConfig[];
}

export const DEFAULT_DASHBOARD_LAYOUT: DashboardWidgetConfig[] = [
  { id: 'kpi-cards', name: 'KPI Summary Cards (Rev YTD, Forecast, Yield, Velocity)', width: 3, visible: true },
  { id: 'crm-summary', name: 'CRM Performance Summary Panel (My Perf / Team Combined)', width: 3, visible: true },
  { id: 'smart-goals', name: 'SMART Goals Tracker', width: 2, visible: true },
  { id: 'next-best-actions', name: 'Next Best Actions Recommendation Card', width: 1, visible: true },
  { id: 'strategic-nudge', name: 'Strategic Nudge (30-60-90 Success Plan)', width: 1, visible: true },
  { id: 'behavioral-pulse', name: 'Behavioral Pulse & Alerts', width: 1, visible: true },
  { id: 'voice-logger', name: 'Voice-to-Text Outcome Logger', width: 1, visible: true },
  { id: 'habit-tracker', name: 'Rapid Habit Tracker', width: 1, visible: true },
  { id: 'historical-activity', name: 'Historical Activity Tracker', width: 1, visible: true },
  { id: 'territory-playbook', name: 'Territory Playbook (Flex Pool)', width: 2, visible: true },
  { id: 'monday-planning', name: 'Monday Planning (Weekly Goals)', width: 3, visible: false },
  { id: 'customer-review', name: 'Customers Table (Pipeline Review)', width: 3, visible: false },
  { id: 'pipeline-review', name: 'Opportunities Table & AI Whisperer', width: 3, visible: false },
  { id: 'friday-fw', name: 'Friday FW', width: 3, visible: false },
  { id: 'twiw', name: 'The Week That Was (TWTW)', width: 3, visible: true },
  { id: 'call-prep', name: 'Call Prep / Call Planning', width: 3, visible: false },
  { id: 'success-plan', name: 'Success Plan Details (Onboarding)', width: 3, visible: false },
];

const DEFAULTS: AppSettings = {
  displayName: '',
  email: '',
  notifyEmail: '',
  weeklyDigestEnabled: true,
  digestDayOfWeek: 'monday',
  escalationAlertsEnabled: true,
  escalationWeeksThreshold: 2,
  pushNotificationsEnabled: false,
  leaderPulseEnabled: true,
  aiModel: 'googleai/gemini-2.5-flash',
  briefCacheTTLDays: 7,
  promptTone: 'elite',
  aiUsageLoggingEnabled: true,
  autoGenerateBriefs: false,
  stallingDaysThreshold: 14,
  deadRolloverCount: 3,
  gracePeriodDays: 1,
  velocityAuditDays: 21,
  weightRevenue: 50,
  weightActivity: 30,
  weightBehaviour: 20,
  salesforceOrgUrl: 'https://teamglobalexp.lightning.force.com',
  crmSyncSchedule: 'manual',
  duplicateDetectionMode: 'code_and_name',
  autoPurgeEnabled: false,
  accentColour: '#2563eb',
  uiDensity: 'comfortable',
  dateFormat: 'yyyy-MM-dd',
  sessionTimeoutMinutes: 480,
  customDashboards: [],
  reportWidgets: [],
  dashboardLayout: DEFAULT_DASHBOARD_LAYOUT,
};

const SECTIONS = [
  { id: 'profile',      label: 'My Profile',       icon: User,       leaderOnly: false },
  { id: 'notifications',label: 'Notifications',    icon: Bell,       leaderOnly: false },
  { id: 'dashboard-design', label: 'Dashboard Design', icon: LayoutGrid, leaderOnly: true },
  { id: 'reporting',    label: 'Reporting Tools',  icon: LayoutDashboard, leaderOnly: true  },
  { id: 'ai',           label: 'AI & Intelligence', icon: Sparkles,  leaderOnly: true  },
  { id: 'scoring',      label: 'Scoring Weights',  icon: BarChart3,  leaderOnly: true  },
  { id: 'governance',   label: 'Data Governance',  icon: ShieldCheck,leaderOnly: true  },
  { id: 'api',          label: 'API Access',       icon: Link2,      leaderOnly: true  },
  { id: 'login-log',    label: 'Login Log',        icon: Users,      leaderOnly: true  },
  { id: 'danger',       label: 'Danger Zone',      icon: Trash2,     leaderOnly: true  },
];

function SectionCard({ title, description, icon: Icon, children, badge }: {
  title: string; description?: string; icon: any; children: React.ReactNode; badge?: string;
}) {
  return (
    <Card className="border border-slate-200 shadow-sm bg-white overflow-hidden">
      <CardHeader className="bg-slate-50 border-b border-slate-100 py-4 px-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Icon className="w-4 h-4 text-primary" />
            </div>
            <div>
              <CardTitle className="text-sm font-black uppercase tracking-widest text-primary">{title}</CardTitle>
              {description && <CardDescription className="text-[11px] mt-0.5">{description}</CardDescription>}
            </div>
          </div>
          {badge && <Badge className="text-[9px] font-black uppercase bg-accent/10 text-accent border-accent/20">{badge}</Badge>}
        </div>
      </CardHeader>
      <CardContent className="p-6 space-y-6">{children}</CardContent>
    </Card>
  );
}

function SettingRow({ label, description, children }: { label: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-6">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-slate-800">{label}</p>
        {description && <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">{description}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

export function SettingsHub() {
  const { profile, isLeader: isAuthLeader, isGM, user } = useAuth();
  const isLeader = isAuthLeader || isGM;
  const db = useFirestore();
  const { toast } = useToast();

  const [settings, setSettings] = useState<AppSettings>({
    ...DEFAULTS,
    displayName: profile?.name || '',
    email: profile?.email || '',
    notifyEmail: profile?.email || '',
  });

  const [activeSection, setActiveSection] = useState('profile');
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isDirty, setIsDirty] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showDangerConfirm, setShowDangerConfirm] = useState(false);
  const [dangerConfirmText, setDangerConfirmText] = useState('');
  const [logs, setLogs] = useState<any[]>([]);
  const [userLogs, setUserLogs] = useState<any[]>([]);

  useEffect(() => {
    if (activeSection === 'login-log' && isLeader && db) {
      getDocs(collection(db, 'users')).then(snap => {
        const ul = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setUserLogs(ul);
      });
    }
  }, [activeSection, isLeader, db]);

  useEffect(() => {
    async function load() {
      if (!db || !user) return;
      try {
        const personalDoc = await getDoc(doc(db, 'appSettings', user.uid));
        const globalDoc = isLeader ? await getDoc(doc(db, 'appSettings', 'global')) : null;
        const personal = personalDoc.exists() ? personalDoc.data() : {};
        const global = globalDoc?.exists() ? globalDoc.data() : {};

        setSettings(prev => ({ ...prev, ...global, ...personal }));
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, [db, user, isLeader]);

  const set = useCallback(<K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    setIsDirty(true);
  }, []);

  const copyToClipboard = async (text: string) => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      setCopied(true);
      toast({ title: "Copied!", description: "API node address copied to clipboard." });
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast({ variant: "destructive", title: "Copy Failed", description: "Standard security policy blocked clipboard access. Please manually copy the code." });
    }
  };

  const handleWeightChange = (field: 'weightRevenue' | 'weightActivity' | 'weightBehaviour', val: number) => {
    const others = (['weightRevenue', 'weightActivity', 'weightBehaviour'] as const).filter(k => k !== field);
    const remainder = 100 - val;
    const currentOtherTotal = settings[others[0]] + settings[others[1]];
    const ratio0 = currentOtherTotal > 0 ? settings[others[0]] / currentOtherTotal : 0.5;
    const new0 = Math.round(remainder * ratio0);
    const new1 = remainder - new0;
    setSettings(prev => ({ ...prev, [field]: val, [others[0]]: new0, [others[1]]: new1 }));
    setIsDirty(true);
  };

  const handleSave = async () => {
    if (!db || !user) return;
    setIsSaving(true);
    try {
      const personalKeys: (keyof AppSettings)[] = ['displayName', 'notifyEmail', 'weeklyDigestEnabled', 'pushNotificationsEnabled', 'accentColour', 'uiDensity', 'dateFormat', 'sessionTimeoutMinutes'];
      const personal: Partial<AppSettings> = {};
      personalKeys.forEach(k => { (personal as any)[k] = settings[k]; });
      await setDoc(doc(db, 'appSettings', user.uid), { ...personal, updatedAt: serverTimestamp() }, { merge: true });

      if (isLeader) {
        const globalKeys: (keyof AppSettings)[] = ['escalationAlertsEnabled', 'escalationWeeksThreshold', 'leaderPulseEnabled', 'aiModel', 'briefCacheTTLDays', 'promptTone', 'aiUsageLoggingEnabled', 'autoGenerateBriefs', 'stallingDaysThreshold', 'deadRolloverCount', 'gracePeriodDays', 'velocityAuditDays', 'weightRevenue', 'weightActivity', 'weightBehaviour', 'salesforceOrgUrl', 'crmSyncSchedule', 'duplicateDetectionMode', 'autoPurgeEnabled', 'customDashboards', 'reportWidgets', 'dashboardLayout'];
        const global: Partial<AppSettings> = {};
        globalKeys.forEach(k => { (global as any)[k] = settings[k]; });
        await setDoc(doc(db, 'appSettings', 'global'), { ...global, updatedAt: serverTimestamp() }, { merge: true });
      }

      setIsDirty(false);
      toast({ title: 'Settings Saved' });
    } catch (e) {
      toast({ variant: "destructive", title: "Save Failed" });
    } finally {
      setIsSaving(false);
    }
  };

  const fetchLogs = async () => {
    if (!db) return;
    const q = query(collection(db, 'aiUsageLogs'), orderBy('calledAt', 'desc'), limit(10));
    const snap = await getDocs(q);
    setLogs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  };

  const visibleSections = SECTIONS.filter(s => !s.leaderOnly || isLeader);

  if (isLoading) return <div className="flex items-center justify-center py-20"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="w-full space-y-8 pb-20">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">Governance Node</p>
          <h1 className="text-3xl font-black uppercase tracking-tight text-primary">System Config</h1>
        </div>
        {isDirty && (
          <Button onClick={handleSave} disabled={isSaving} className="bg-accent font-black h-11 px-6 shadow-lg gap-2">
            {isSaving ? <Loader2 className="animate-spin w-4 h-4" /> : <Save className="w-4 h-4" />}
            Save Changes
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-8">
        <nav className="space-y-1">
          {visibleSections.map(s => (
            <button
              key={s.id}
              onClick={() => setActiveSection(s.id)}
              className={cn(
                'w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all text-xs font-black uppercase tracking-wider',
                activeSection === s.id ? 'bg-primary text-white shadow-lg' : 'text-slate-500 hover:bg-slate-100'
              )}
            >
              <s.icon className="w-4 h-4" /> {s.label}
            </button>
          ))}
        </nav>

        <div className="space-y-6">
          {activeSection === 'profile' && (
            <SectionCard title="My Identity" icon={User}>
              <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-xl border">
                <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center text-white font-black text-2xl shadow-lg">
                  {settings.displayName?.charAt(0)}
                </div>
                <div>
                  <p className="font-black text-lg uppercase">{settings.displayName}</p>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase">{profile?.role} · {profile?.territory}</p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase">Display Name</Label><Input value={settings.displayName} onChange={e => set('displayName', e.target.value)} className="font-bold" /></div>
                <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase">Notify Email</Label><Input value={settings.notifyEmail} onChange={e => set('notifyEmail', e.target.value)} className="font-bold" /></div>
              </div>
            </SectionCard>
          )}

          {activeSection === 'notifications' && (
            <SectionCard title="Alert Preferences" icon={Bell}>
              <SettingRow label="Weekly Performance Digest" description="Receive your strategic priority summary every Monday morning.">
                <Switch checked={settings.weeklyDigestEnabled} onCheckedChange={v => set('weeklyDigestEnabled', v)} />
              </SettingRow>
              <SettingRow label="Escalation Alerts" description="Notify leadership if activity targets are missed for 2+ weeks.">
                <Switch checked={settings.escalationAlertsEnabled} onCheckedChange={v => set('escalationAlertsEnabled', v)} />
              </SettingRow>
            </SectionCard>
          )}

          {activeSection === 'reporting' && isLeader && (
            <ReportingToolsSettings 
              dashboards={settings.customDashboards}
              widgets={settings.reportWidgets}
              onDashboardsChange={(d) => set('customDashboards', d)}
              onWidgetsChange={(w) => set('reportWidgets', w)}
            />
          )}

          {activeSection === 'dashboard-design' && isLeader && (
            <SectionCard 
              title="Dashboard Designer" 
              description="Customize the layout, widget widths, and order for all BDM and AM dashboards globally. Drag cards to reorder." 
              icon={LayoutGrid}
            >
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                {/* Configuration side */}
                <div className="space-y-4">
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-400">Layout Configurations</h3>
                  <div className="space-y-2">
                    {(settings.dashboardLayout || DEFAULT_DASHBOARD_LAYOUT).map((widget, index) => {
                      const layout = settings.dashboardLayout || DEFAULT_DASHBOARD_LAYOUT;
                      return (
                        <div
                          key={widget.id}
                          draggable
                          onDragStart={(e) => {
                            e.dataTransfer.setData('text/plain', String(index));
                          }}
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={(e) => {
                            e.preventDefault();
                            const draggedIdx = Number(e.dataTransfer.getData('text/plain'));
                            if (isNaN(draggedIdx) || draggedIdx === index) return;
                            const newLayout = [...layout];
                            const [draggedItem] = newLayout.splice(draggedIdx, 1);
                            newLayout.splice(index, 0, draggedItem);
                            set('dashboardLayout', newLayout);
                          }}
                          className={cn(
                            "flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-white border border-slate-200 rounded-xl shadow-sm hover:shadow-md transition-all cursor-move",
                            !widget.visible && "opacity-60 bg-slate-50"
                          )}
                        >
                          <div className="flex items-center gap-2.5">
                            <GripVertical className="w-4 h-4 text-slate-400 shrink-0 cursor-grab" />
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-slate-800 truncate">{widget.name}</p>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <span className={cn(
                                  "text-[8px] font-black uppercase px-1 py-0.5 rounded",
                                  widget.visible ? "bg-emerald-50 text-emerald-600 border border-emerald-200" : "bg-slate-100 text-slate-500 border border-slate-200"
                                )}>
                                  {widget.visible ? 'Visible' : 'Hidden'}
                                </span>
                                <span className="text-[8px] font-bold text-slate-400">
                                  {widget.width} Column{widget.width > 1 ? 's' : ''} wide
                                </span>
                              </div>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-3 self-end sm:self-auto shrink-0">
                            {/* Width Selector */}
                            <div className="flex rounded-lg border border-slate-200 p-0.5 bg-slate-50">
                              {[1, 2, 3].map(w => (
                                <button
                                  key={w}
                                  onClick={() => {
                                    const newLayout = layout.map(item => 
                                      item.id === widget.id ? { ...item, width: w as 1 | 2 | 3 } : item
                                    );
                                    set('dashboardLayout', newLayout);
                                  }}
                                  className={cn(
                                    "px-2 py-0.5 text-[9px] font-black rounded-md transition-colors",
                                    widget.width === w ? "bg-white text-primary shadow-sm" : "text-slate-400 hover:text-slate-700"
                                  )}
                                >
                                  {w} Col
                                </button>
                              ))}
                            </div>

                            {/* Visibility Switch */}
                            <Switch 
                              checked={widget.visible} 
                              onCheckedChange={(checked) => {
                                const newLayout = layout.map(item => 
                                  item.id === widget.id ? { ...item, visible: checked } : item
                                );
                                set('dashboardLayout', newLayout);
                              }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Live Preview side */}
                <div className="border border-slate-200 bg-slate-50 rounded-2xl p-4 flex flex-col h-fit">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xs font-black uppercase tracking-wider text-slate-400">Grid Layout Preview</h3>
                    <Badge className="bg-slate-200 text-slate-700 border-none font-bold text-[8px] uppercase">3-Col Grid</Badge>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-2">
                    {(settings.dashboardLayout || DEFAULT_DASHBOARD_LAYOUT)
                      .filter(widget => widget.visible)
                      .map((widget) => (
                        <div
                          key={widget.id}
                          className={cn(
                            "p-3 rounded-lg border border-slate-200 bg-white shadow-sm flex flex-col justify-between min-h-[70px] relative transition-all",
                            widget.width === 1 ? "col-span-1" : widget.width === 2 ? "col-span-2" : "col-span-3"
                          )}
                        >
                          <p className="text-[10px] font-bold text-slate-700 leading-tight uppercase truncate">{widget.name.split(' (')[0]}</p>
                          <div className="flex justify-between items-center mt-2">
                            <span className="text-[8px] font-black text-slate-400 bg-slate-100 px-1 py-0.5 rounded">Span {widget.width}</span>
                            <span className="w-2.5 h-2.5 rounded-full bg-primary/20 animate-pulse" />
                          </div>
                        </div>
                      ))}
                    {(settings.dashboardLayout || DEFAULT_DASHBOARD_LAYOUT).filter(w => w.visible).length === 0 && (
                      <div className="col-span-3 p-8 border-2 border-dashed border-slate-200 rounded-xl text-center text-xs font-bold text-slate-400 uppercase">
                        All widgets hidden
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </SectionCard>
          )}

          {activeSection === 'ai' && isLeader && (
            <SectionCard title="Intelligence Engine" icon={Sparkles}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-black uppercase">AI Model Preference</Label>
                    <Select value={settings.aiModel} onValueChange={v => set('aiModel', v)}>
                      <SelectTrigger className="font-bold"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="googleai/gemini-2.5-flash" className="font-bold">Gemini 2.5 Flash</SelectItem>
                        <SelectItem value="googleai/gemini-2.5-pro" className="font-bold">Gemini 2.5 Pro</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="p-4 bg-primary/5 rounded-xl border border-primary/10">
                   <div className="flex items-center justify-between mb-4">
                      <p className="text-[10px] font-black uppercase">Usage Audit</p>
                      <Button variant="ghost" size="sm" onClick={fetchLogs} className="h-6 text-[9px] font-black">REFRESH</Button>
                   </div>
                   <ScrollArea className="h-32 text-[10px]">
                      {logs.map(log => <div key={log.id} className="mb-2 pb-2 border-b border-primary/10 flex justify-between"><span>{log.flow}</span><span className="font-bold">~{Math.round(log.inputTokenEstimate || 0)} tokens</span></div>)}
                   </ScrollArea>
                </div>
              </div>
            </SectionCard>
          )}

          {activeSection === 'scoring' && isLeader && (
            <SectionCard title="Performance Weights" icon={BarChart3} description="Configure how the Composite Leaderboard index is calculated.">
              <div className="space-y-8 pt-4">
                <div className="space-y-3">
                  <div className="flex justify-between font-black text-xs"><span>REVENUE ACHIEVEMENT</span><span className="text-primary">{settings.weightRevenue}%</span></div>
                  <Slider value={[settings.weightRevenue]} onValueChange={([v]) => handleWeightChange('weightRevenue', v)} min={0} max={100} step={5} />
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between font-black text-xs"><span>ACTIVITY VELOCITY</span><span className="text-accent">{settings.weightActivity}%</span></div>
                  <Slider value={[settings.weightActivity]} onValueChange={([v]) => handleWeightChange('weightActivity', v)} min={0} max={100} step={5} />
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between font-black text-xs"><span>PROFESSIONAL BEHAVIOUR</span><span className="text-green-600">{settings.weightBehaviour}%</span></div>
                  <Slider value={[settings.weightBehaviour]} onValueChange={([v]) => handleWeightChange('weightBehaviour', v)} min={0} max={100} step={5} />
                </div>
              </div>
            </SectionCard>
          )}

          {activeSection === 'api' && isLeader && (
            <SectionCard title="API Access" icon={Link2} description="Manage secure integration nodes.">
               <div className="space-y-4">
                  <div className="bg-slate-50 p-4 rounded-xl border">
                    <Label className="text-[10px] font-black uppercase">Enterprise Node ID</Label>
                    <div className="flex gap-2 mt-2">
                      <code className="flex-1 p-2 bg-white border rounded font-mono text-[10px] truncate">
                        bdm_compass_{user?.uid?.slice(0, 16)}_secure
                      </code>
                      <Button 
                        variant="outline" 
                        size="sm"
                        className="h-8"
                        onClick={() => copyToClipboard(`bdm_compass_${user?.uid}_${Date.now()}`)}
                      >
                        {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      </Button>
                    </div>
                  </div>
                  <SettingRow label="Webhook Alerts" description="Push daily activity recap to external endpoints.">
                     <Switch disabled />
                  </SettingRow>
               </div>
            </SectionCard>
          )}

          {activeSection === 'login-log' && isLeader && (
            <SectionCard title="Active User Sessions" icon={Users} description="View last login timestamps for all users.">
              <div className="space-y-4">
                 <div className="flex items-center justify-between p-4 bg-slate-50 border rounded-xl mb-4">
                   <div className="flex items-center gap-3">
                     <Activity className="w-5 h-5 text-indigo-500" />
                     <div>
                       <p className="text-xs font-black uppercase text-slate-800">Session Monitor</p>
                       <p className="text-[10px] text-slate-500">Real-time authentication log</p>
                     </div>
                   </div>
                 </div>
                 <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
                   {userLogs.sort((a, b) => ((b.lastLoginAt?.toMillis?.() || 0) - (a.lastLoginAt?.toMillis?.() || 0))).map(u => (
                     <div key={u.id} className="flex items-center justify-between p-4 bg-white border shadow-sm rounded-xl">
                       <div className="flex items-center gap-3">
                         <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center font-black text-slate-400">
                           {u.name?.charAt(0) || u.email?.charAt(0) || '?'}
                         </div>
                         <div>
                           <p className="text-sm font-bold text-slate-800">{u.name || u.email}</p>
                           <p className="text-[10px] uppercase font-bold text-slate-500">{u.role || 'User'}</p>
                         </div>
                       </div>
                       <div className="text-right">
                         <p className="text-xs font-black text-slate-700">
                           {u.lastLoginAt ? new Date(u.lastLoginAt.toMillis()).toLocaleString('en-AU') : 'Never Logged In'}
                         </p>
                         {u.isOnline && <Badge className="mt-1 text-[9px] bg-emerald-100 text-emerald-700 border-emerald-200">Online Recently</Badge>}
                       </div>
                     </div>
                   ))}
                   {userLogs.length === 0 && (
                     <div className="p-8 text-center text-slate-400 text-xs font-bold uppercase tracking-widest">
                       No user data found
                     </div>
                   )}
                 </div>
              </div>
            </SectionCard>
          )}

          {activeSection === 'danger' && isLeader && (
            <SectionCard title="Danger Zone" icon={Trash2}>
              <div className="space-y-4">
                 <div className="p-4 border-2 border-red-100 bg-red-50 rounded-2xl flex items-center justify-between">
                    <div><p className="text-sm font-black text-red-900 uppercase">Wipe Territory Pipeline</p><p className="text-[11px] text-red-700">Irreversibly delete all active opportunities.</p></div>
                    <Button variant="destructive" onClick={() => setShowDangerConfirm(true)} className="font-black text-xs px-6">EXECUTE WIPE</Button>
                 </div>
              </div>
            </SectionCard>
          )}
        </div>
      </div>

      <Dialog open={showDangerConfirm} onOpenChange={setShowDangerConfirm}>
        <DialogContent className="rounded-3xl p-8">
           <DialogHeader>
              <DialogTitle className="text-2xl font-black uppercase tracking-tight text-red-600">Strict Auth Protocol</DialogTitle>
              <DialogDescription className="font-bold">Type <span className="text-red-600">DELETE CONFIRMED</span> to proceed.</DialogDescription>
           </DialogHeader>
           <Input value={dangerConfirmText} onChange={e => setDangerConfirmText(e.target.value)} placeholder="Type confirmation phrase..." className="h-12 border-red-200" />
           <DialogFooter>
              <Button variant="ghost" onClick={() => setShowDangerConfirm(false)} className="font-black">CANCEL</Button>
              <Button variant="destructive" disabled={dangerConfirmText !== 'DELETE CONFIRMED' || isSaving} onClick={async () => {
                 if (!db) return;
                 setIsSaving(true);
                 try {
                   const snap = await getDocs(collection(db, 'pipelineReviews'));
                   if (snap.empty) {
                     toast({ title: 'Pipeline Already Empty' });
                     setShowDangerConfirm(false);
                     return;
                   }
                   const BATCH_SIZE = 400;
                   let count = 0;
                   for (let i = 0; i < snap.docs.length; i += BATCH_SIZE) {
                     const batch = writeBatch(db);
                     const chunk = snap.docs.slice(i, i + BATCH_SIZE);
                     chunk.forEach(d => batch.delete(d.ref));
                     await batch.commit();
                     count += chunk.length;
                   }
                   toast({ title: '✅ Pipeline Wiped', description: `Permanently deleted ${count} opportunities.` });
                   setShowDangerConfirm(false);
                   setDangerConfirmText('');
                 } catch (e: any) {
                   toast({ variant: 'destructive', title: 'Wipe Failed', description: e?.message });
                 } finally {
                   setIsSaving(false);
                 }
              }} className="font-black">
                 {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                 PERMANENT PURGE
              </Button>
           </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
