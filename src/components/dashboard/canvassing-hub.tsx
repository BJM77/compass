"use client";

import { useState, useMemo } from 'react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, deleteDoc, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '@/contexts/auth-context';
import { CanvassLead } from '@/types/crm';
import { CanvassLeadForm } from './canvass-lead-form';
import CanvassMapView from './canvass-map-view';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Plus, 
  Search, 
  MapPin, 
  Compass, 
  ExternalLink, 
  Phone, 
  Mail, 
  Edit3, 
  Trash2, 
  CheckCircle2, 
  Building2, 
  Truck, 
  Navigation, 
  Share2, 
  Filter, 
  Check, 
  Clock, 
  DollarSign,
  Layers,
  Sparkles
} from 'lucide-react';
import { openSalesforceCreateLead, openSalesforceSearch } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { format } from 'date-fns';

export function CanvassingHub() {
  const { profile, isLeader, user } = useAuth();
  const db = useFirestore();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<'NEW_LEAD' | 'VIEW_LEADS'>('VIEW_LEADS');
  const [editingLead, setEditingLead] = useState<CanvassLead | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBu, setSelectedBu] = useState<string>('ALL');
  const [syncFilter, setSyncFilter] = useState<'ALL' | 'SYNCED' | 'DRAFT'>('ALL');
  const [scopeFilter, setScopeFilter] = useState<'MY' | 'ALL'>('MY');
  const [viewMode, setViewMode] = useState<'LIST' | 'MAP'>('LIST');

  // Query Canvassing Leads from Firestore
  const leadsQuery = useMemoFirebase(() => {
    if (!db) return null;
    return query(collection(db, 'canvass_leads'), orderBy('createdAt', 'desc'));
  }, [db]);

  const { data: rawLeads, isLoading } = useCollection<CanvassLead>(leadsQuery);

  // Filter leads
  const filteredLeads = useMemo(() => {
    if (!rawLeads) return [];
    return rawLeads.filter(lead => {
      // User / Scope Filter
      if (scopeFilter === 'MY' && !isLeader && lead.userId && lead.userId !== user?.uid) {
        return false;
      }
      if (scopeFilter === 'MY' && isLeader && lead.userId && lead.userId !== user?.uid) {
        return false;
      }

      // Sync filter
      if (syncFilter === 'SYNCED' && !lead.inSalesforce) return false;
      if (syncFilter === 'DRAFT' && lead.inSalesforce) return false;

      // BU filter
      if (selectedBu !== 'ALL' && lead.businessUnit !== selectedBu) return false;

      // Search term
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const matchName = lead.companyName?.toLowerCase().includes(term);
        const matchContact = `${lead.firstName || ''} ${lead.lastName || ''}`.toLowerCase().includes(term);
        const matchSuburb = lead.suburb?.toLowerCase().includes(term);
        const matchState = lead.state?.toLowerCase().includes(term);
        const matchRep = lead.userName?.toLowerCase().includes(term);
        if (!matchName && !matchContact && !matchSuburb && !matchState && !matchRep) return false;
      }

      return true;
    });
  }, [rawLeads, scopeFilter, syncFilter, selectedBu, searchTerm, user?.uid, isLeader]);

  // Quick stats
  const totalLeads = rawLeads?.length || 0;
  const myLeads = rawLeads?.filter(l => l.userId === user?.uid).length || 0;
  const syncedCount = rawLeads?.filter(l => l.inSalesforce).length || 0;
  const pendingCount = totalLeads - syncedCount;

  const handleDeleteLead = async (leadId: string, companyName: string) => {
    if (!db) return;
    try {
      await deleteDoc(doc(db, 'canvass_leads', leadId));
      toast({ title: 'Lead Deleted', description: `${companyName} was removed.` });
    } catch (e: any) {
      toast({ title: 'Error deleting lead', description: e.message, variant: 'destructive' });
    }
  };

  const handleToggleSalesforce = async (lead: CanvassLead) => {
    if (!db) return;
    try {
      const nextStatus = !lead.inSalesforce;
      await updateDoc(doc(db, 'canvass_leads', lead.id), {
        inSalesforce: nextStatus,
        syncedAt: nextStatus ? serverTimestamp() : null,
      });
      toast({
        title: nextStatus ? 'Marked Synced' : 'Marked Draft',
        description: `${lead.companyName} status updated.`,
      });
    } catch (e: any) {
      toast({ title: 'Update failed', description: e.message, variant: 'destructive' });
    }
  };

  const handlePushToSalesforce = (lead: CanvassLead) => {
    openSalesforceCreateLead({
      companyName: lead.companyName,
      firstName: lead.firstName,
      lastName: lead.lastName || 'Lead',
      title: lead.title,
      phone: lead.phone,
      email: lead.email,
      preferredContactMethod: lead.preferredContactMethod,
      addressLine1: lead.addressLine1,
      addressLine2: lead.addressLine2,
      suburb: lead.suburb,
      state: lead.state,
      postcode: lead.postcode,
      country: lead.country,
      industry: lead.industry,
      businessUnit: lead.businessUnit,
      services: lead.services,
      freightProfile: lead.freightProfile,
      quoteNumber: lead.quoteNumber,
      estimatedRevenue: lead.estimatedRevenue,
      incumbent: lead.incumbent,
      otherIncumbent: lead.otherIncumbent,
      leadSource: lead.leadSource,
      leadType: lead.leadType,
      leadStatus: lead.leadStatus,
      leadTopic: lead.leadTopic,
      notes: lead.notes ? `${lead.notes}\n[Logged via Compass Canvassing]` : '[Logged via Compass Canvassing]'
    });
  };

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 pb-20">
      
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-6 rounded-2xl shadow-xl border border-indigo-900/40 relative overflow-hidden">
        <div className="absolute -right-10 -bottom-10 opacity-10 pointer-events-none">
          <Compass className="h-64 w-64 text-white" />
        </div>

        <div className="space-y-1.5 z-10">
          <div className="flex items-center gap-2.5">
            <span className="p-2 bg-amber-500/20 border border-amber-500/40 rounded-lg text-amber-400">
              <Navigation className="h-6 w-6" />
            </span>
            <h1 className="text-2xl font-black tracking-tight">Field Canvassing & Lead Scout</h1>
            <Badge variant="outline" className="border-amber-400/40 text-amber-300 bg-amber-400/10 text-xs">
              GPS Enabled
            </Badge>
          </div>
          <p className="text-sm text-slate-300 max-w-2xl">
            Instant on-site lead capture for field reps with 1-Click Salesforce upload.
          </p>
        </div>

        <div className="flex items-center gap-2.5 z-10">
          <Button
            onClick={() => {
              setEditingLead(null);
              setActiveTab('NEW_LEAD');
            }}
            className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-bold shadow-lg gap-2 h-11 px-5 rounded-xl transition-transform active:scale-95"
          >
            <Plus className="h-5 w-5" />
            <span>New Field Lead</span>
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)} className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-6 h-12 bg-slate-100/50">
          <TabsTrigger value="NEW_LEAD" className="font-bold uppercase tracking-wider text-xs">New Lead</TabsTrigger>
          <TabsTrigger value="VIEW_LEADS" className="font-bold uppercase tracking-wider text-xs">View Leads</TabsTrigger>
        </TabsList>

        <TabsContent value="NEW_LEAD" className="mt-0">
          <CanvassLeadForm
            initialLead={editingLead}
            onSaved={() => {
              setActiveTab('VIEW_LEADS');
              setEditingLead(null);
            }}
            onCancel={() => {
              setActiveTab('VIEW_LEADS');
              setEditingLead(null);
            }}
          />
        </TabsContent>

        <TabsContent value="VIEW_LEADS" className="mt-0 space-y-6">

      {/* Stats Counter Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 md:gap-4">
        <Card className="p-4 shadow-sm border-l-4 border-l-blue-500">
          <div className="text-xs text-muted-foreground font-medium">My Captured Leads</div>
          <div className="text-2xl font-black mt-1 text-foreground">{myLeads}</div>
          <div className="text-[11px] text-muted-foreground mt-0.5">Logged by you</div>
        </Card>

        <Card className="p-4 shadow-sm border-l-4 border-l-indigo-500">
          <div className="text-xs text-muted-foreground font-medium">Team Total Leads</div>
          <div className="text-2xl font-black mt-1 text-foreground">{totalLeads}</div>
          <div className="text-[11px] text-muted-foreground mt-0.5">Across all territories</div>
        </Card>

        <Card className="p-4 shadow-sm border-l-4 border-l-emerald-500">
          <div className="text-xs text-muted-foreground font-medium">Synced to Salesforce</div>
          <div className="text-2xl font-black mt-1 text-emerald-600">{syncedCount}</div>
          <div className="text-[11px] text-emerald-600 font-semibold mt-0.5">
            {totalLeads > 0 ? `${Math.round((syncedCount / totalLeads) * 100)}% Uploaded` : '0%'}
          </div>
        </Card>

        <Card className="p-4 shadow-sm border-l-4 border-l-amber-500">
          <div className="text-xs text-muted-foreground font-medium">Awaiting SF Upload</div>
          <div className="text-2xl font-black mt-1 text-amber-600">{pendingCount}</div>
          <div className="text-[11px] text-amber-600 font-medium mt-0.5">1-Click ready</div>
        </Card>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-card p-3.5 rounded-xl border shadow-xs">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search company, contact, suburb..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="pl-9 h-9 text-xs"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          {isLeader && (
            <Select value={scopeFilter} onValueChange={(v: 'MY' | 'ALL') => setScopeFilter(v)}>
              <SelectTrigger className="h-9 text-xs w-[120px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="MY">My Leads</SelectItem>
                <SelectItem value="ALL">All Team</SelectItem>
              </SelectContent>
            </Select>
          )}

          <Select value={syncFilter} onValueChange={(v: 'ALL' | 'SYNCED' | 'DRAFT') => setSyncFilter(v)}>
            <SelectTrigger className="h-9 text-xs w-[130px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Status</SelectItem>
              <SelectItem value="DRAFT">Pending SF</SelectItem>
              <SelectItem value="SYNCED">In Salesforce</SelectItem>
            </SelectContent>
          </Select>

          <Select value={selectedBu} onValueChange={setSelectedBu}>
            <SelectTrigger className="h-9 text-xs w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Business Units</SelectItem>
              <SelectItem value="Priority Services">Priority Services</SelectItem>
              <SelectItem value="IPEC Road Services">IPEC Road Services</SelectItem>
              <SelectItem value="TGE Courier">TGE Courier</SelectItem>
              <SelectItem value="International Air & Sea">International Air & Sea</SelectItem>
              <SelectItem value="Contract Logistics">Contract Logistics</SelectItem>
            </SelectContent>
          </Select>

          {isLeader && (
            <div className="flex bg-slate-100 p-0.5 rounded-lg border">
              <button
                onClick={() => setViewMode('LIST')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  viewMode === 'LIST' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                List
              </button>
              <button
                onClick={() => setViewMode('MAP')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  viewMode === 'MAP' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Map
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Leads List / Cards */}
      {viewMode === 'MAP' && isLeader ? (
        <div className="h-[600px] w-full mt-4">
          <CanvassMapView leads={filteredLeads} />
        </div>
      ) : filteredLeads.length === 0 ? (
        <Card className="p-12 text-center border-dashed">
          <Compass className="h-12 w-12 text-muted-foreground mx-auto mb-3 opacity-40 animate-pulse" />
          <h3 className="font-bold text-base">No canvassed leads found</h3>
          <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
            {searchTerm || syncFilter !== 'ALL' || selectedBu !== 'ALL'
              ? 'Try adjusting your filters or search terms.'
              : 'Tap "New Lead" to log your first on-site customer discovery!'}
          </p>
          <Button
            onClick={() => setActiveTab('NEW_LEAD')}
            size="sm"
            className="mt-4 gap-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold"
          >
            <Plus className="h-4 w-4" />
            <span>Add First Lead</span>
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredLeads.map(lead => {
            const hasLocation = Boolean(lead.latitude && lead.longitude);
            const addressString = [lead.addressLine1, lead.suburb, lead.state, lead.postcode].filter(Boolean).join(', ');

            return (
              <Card key={lead.id} className="flex flex-col justify-between hover:border-primary/50 transition-all shadow-sm group">
                <CardHeader className="p-4 pb-2 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-sm line-clamp-1 group-hover:text-primary transition-colors">
                          {lead.companyName}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground font-medium">
                        {lead.firstName ? `${lead.firstName} ` : ''}{lead.lastName}
                        {lead.title ? ` • ${lead.title}` : ''}
                      </div>
                    </div>

                    <div>
                      {lead.inSalesforce ? (
                        <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300 border-emerald-300 text-[10px] gap-1 shrink-0">
                          <CheckCircle2 className="h-3 w-3" /> Synced
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300 border-amber-300 text-[10px] shrink-0">
                          Draft
                        </Badge>
                      )}
                    </div>
                  </div>

                  {lead.businessUnit && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      <Badge variant="secondary" className="text-[10px] font-normal">
                        {lead.businessUnit}
                      </Badge>
                      {lead.estimatedRevenue && (
                        <Badge variant="outline" className="text-[10px] text-emerald-600 border-emerald-300 font-semibold">
                          ${lead.estimatedRevenue.toLocaleString()}/yr
                        </Badge>
                      )}
                      {lead.incumbent && (
                        <Badge variant="outline" className="text-[10px] text-slate-600 dark:text-slate-400">
                          vs {lead.incumbent}
                        </Badge>
                      )}
                    </div>
                  )}
                </CardHeader>

                <CardContent className="p-4 pt-1 space-y-3 text-xs">
                  {/* Address & GPS Row */}
                  <div className="p-2.5 bg-muted/40 rounded-lg space-y-1.5">
                    <div className="flex items-start gap-2 text-muted-foreground">
                      <MapPin className="h-3.5 w-3.5 shrink-0 text-red-500 mt-0.5" />
                      <span className="line-clamp-2 leading-tight">
                        {addressString || 'Address not entered'}
                      </span>
                    </div>

                    {hasLocation && (
                      <div className="flex items-center justify-between text-[11px] pt-1 border-t border-border/50">
                        <span className="text-muted-foreground">GPS Coordinates</span>
                        <a
                          href={`https://www.google.com/maps/search/?api=1&query=${lead.latitude},${lead.longitude}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 font-semibold hover:underline flex items-center gap-1"
                        >
                          Google Maps <ExternalLink className="h-2.5 w-2.5" />
                        </a>
                      </div>
                    )}
                  </div>

                  {/* Contact shortcuts */}
                  <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
                    {lead.phone ? (
                      <a href={`tel:${lead.phone}`} className="flex items-center gap-1 hover:text-foreground font-medium">
                        <Phone className="h-3 w-3 text-blue-600" />
                        <span>{lead.phone}</span>
                      </a>
                    ) : (
                      <span className="text-muted-foreground/60 italic">No phone</span>
                    )}

                    {lead.email ? (
                      <a href={`mailto:${lead.email}`} className="flex items-center gap-1 hover:text-foreground font-medium">
                        <Mail className="h-3 w-3 text-indigo-600" />
                        <span className="max-w-[120px] truncate">{lead.email}</span>
                      </a>
                    ) : (
                      <span className="text-muted-foreground/60 italic">No email</span>
                    )}
                  </div>

                  {/* Notes snippet */}
                  {lead.notes && (
                    <p className="text-[11px] text-muted-foreground bg-muted/20 p-2 rounded line-clamp-2 italic">
                      "{lead.notes}"
                    </p>
                  )}

                  {/* Rep & Date info */}
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground/70 pt-1">
                    <span>Rep: {lead.userName || 'Unknown'}</span>
                    <span>
                      {lead.createdAt?.toDate ? format(lead.createdAt.toDate(), 'dd MMM yyyy') : 'Recently'}
                    </span>
                  </div>

                  {/* Action Buttons */}
                  <div className="pt-2 border-t flex items-center justify-between gap-1.5">
                    <Button
                      size="sm"
                      onClick={() => handlePushToSalesforce(lead)}
                      className="flex-1 h-8 text-xs bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold gap-1 shadow-xs"
                      title="Open Salesforce Lead creation with pre-filled fields"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      <span>1-Click SF</span>
                    </Button>

                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => {
                        setEditingLead(lead);
                        setActiveTab('NEW_LEAD');
                      }} 
                      className="gap-1 text-xs font-semibold hover:bg-blue-50 hover:text-blue-600"
                    >
                      <Edit3 className="h-3.5 w-3.5" /> Edit
                    </Button>

                    <Button
                      size="sm"
                      variant={lead.inSalesforce ? 'outline' : 'ghost'}
                      onClick={() => handleToggleSalesforce(lead)}
                      className={`h-8 w-8 p-0 ${lead.inSalesforce ? 'text-emerald-600' : 'text-muted-foreground'}`}
                      title={lead.inSalesforce ? 'Mark as Unsynced' : 'Mark as Synced in Salesforce'}
                    >
                      <Check className="h-3.5 w-3.5" />
                    </Button>

                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Canvassed Lead?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to delete <strong>{lead.companyName}</strong>? This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDeleteLead(lead.id, lead.companyName)}
                            className="bg-red-600 hover:bg-red-700 text-white"
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
      </TabsContent>
      </Tabs>
    </div>
  );
}
