"use client";

import { useState, useEffect, createContext, useContext, useRef, useMemo, forwardRef, useImperativeHandle } from 'react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, query, orderBy, limit, where } from 'firebase/firestore';
import { useAuth } from '@/contexts/auth-context';
import { FactFindingDoc } from '@/types/crm';
import { FactFindingDocSchema, validateDocument } from '@/lib/schemas';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input as UIInput } from '@/components/ui/input';
import { Textarea as UITextarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select as UISelect, SelectContent, SelectItem, SelectTrigger as UISelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox as UICheckbox } from '@/components/ui/checkbox';
import { ArrowLeft, Save, Printer, Loader2, FileText, CheckCircle2, Building, Package, Map, Truck, Info, Check, Coins, Edit2, Trash2, Copy, LayoutGrid, Eye } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { deduplicateUsers } from '@/lib/utils';
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { WhitespaceAnalysis } from './whitespace-analysis';
import { WhitespaceViewer } from './document-viewers';
import { printHtmlInNewWindow } from '@/lib/print-utils';
import { exportElementToPdf } from '@/lib/export-utils';

const CARRIER_SERVICES = [
  // Next Available
  { id: 'na-time-sensitive', name: 'Time Sensitive', speed: 'Next Available Road & Air', provider: 'Priority Services', tier: 'Premium Services', weight: 'Any Weight Appropriate For Vehicle', freight: 'Satchels - Parcels - Cartons - Skids - Pallets', color: 'bg-emerald-800 border-emerald-900 text-white' },
  { id: 'na-same-day', name: 'Same-Day', speed: 'Next Available Road & Air', provider: 'Priority Services', tier: 'Premium Services', weight: 'Any Weight Appropriate For Vehicle', freight: 'Satchels - Parcels - Cartons - Skids - Pallets', color: 'bg-emerald-800 border-emerald-900 text-white' },
  { id: 'na-highly-monitored', name: 'Highly Monitored', speed: 'Next Available Road & Air', provider: 'Priority Services', tier: 'Premium Services', weight: 'Any Weight Appropriate For Vehicle', freight: 'Satchels - Parcels - Cartons - Skids - Pallets', color: 'bg-emerald-800 border-emerald-900 text-white' },
  { id: 'na-high-value', name: 'High Value', speed: 'Next Available Road & Air', provider: 'Priority Services', tier: 'Premium Services', weight: 'Any Weight Appropriate For Vehicle', freight: 'Satchels - Parcels - Cartons - Skids - Pallets', color: 'bg-emerald-800 border-emerald-900 text-white' },
  { id: 'na-hand-2-hand', name: 'Hand 2 Hand', speed: 'Next Available Road & Air', provider: 'Priority Services', tier: 'Premium Services', weight: 'Any Weight Appropriate For Vehicle', freight: 'Satchels - Parcels - Cartons - Skids - Pallets', color: 'bg-emerald-800 border-emerald-900 text-white' },
  { id: 'na-tae', name: 'TAE', speed: 'Next Available Road & Air', provider: 'Priority Services', tier: 'Premium Services', weight: 'Any Weight Appropriate For Vehicle', freight: 'Satchels - Parcels - Cartons - Skids - Pallets', color: 'bg-emerald-800 border-emerald-900 text-white' },

  // Tomorrow
  { id: 'tom-intl-air-sea', name: 'International Air & Sea', speed: 'Tomorrow Road & Air', provider: 'Priority Services', tier: 'International Air & Sea', weight: 'Pallet Restrictions', freight: 'Parcels - Cartons - Skids', color: 'bg-sky-600 border-sky-700 text-white' },
  { id: 'tom-priority-air-express', name: 'Priority Air Express', speed: 'Tomorrow Road & Air', provider: 'Priority Services', tier: 'B2B', weight: 'All Weights', freight: 'Satchels - Parcels - Cartons - Skids - Pallets', color: 'bg-emerald-800 border-emerald-900 text-white' },
  { id: 'tom-road-express', name: 'Business to Consumer', speed: 'Tomorrow Road & Air', provider: 'Priority Services', tier: 'B2C', weight: 'Upto 22kg or 120cm Total', freight: 'Satchels - Parcels - Cartons - Skids - Pallets', color: 'bg-emerald-800 border-emerald-900 text-white' },

  // 1-8 Days
  { id: 'road-express-1-8', name: 'Road Express', speed: '1-8 Days Road', provider: 'IPEC Road Services', tier: 'B2B', weight: 'All Weights', freight: 'Satchels - Parcels - Cartons - Skids - Pallets', color: 'bg-amber-500 border-amber-600 text-slate-900' },

  // Courier
  { id: 'courier-network', name: 'Courier Network', speed: 'Courier', provider: 'TGE Courier', tier: 'B2B', weight: 'All Weights', freight: 'Satchels - Parcels - Cartons - Skids - Pallets', color: 'bg-zinc-600 border-zinc-700 text-white' }
];

const AUSTRALIA_STATES = [
  { id: 'PILBARA', name: 'Pilbara', capital: 'Port Hedland', dist: '1,600 km', x: 80, y: 200, path: '' },
  { id: 'WA', name: 'Western Australia', capital: 'Perth', dist: 'Intra-WA', x: 105, y: 330, path: 'M 40,150 L 160,150 L 160,390 L 100,390 C 80,395 75,375 60,385 C 40,385 35,365 30,345 C 20,325 20,275 15,255 C 10,225 30,175 40,150 Z' },
  { id: 'NT', name: 'Northern Territory', capital: 'Darwin', dist: '2,600 km', x: 235, y: 175, path: 'M 160,150 L 250,150 C 240,165 260,180 255,190 C 265,200 250,220 250,270 L 160,270 Z' },
  { id: 'SA', name: 'South Australia', capital: 'Adelaide', dist: '2,100 km', x: 245, y: 360, path: 'M 160,270 L 250,270 L 250,300 L 270,300 L 270,390 C 230,390 220,400 210,380 C 200,370 180,380 160,380 Z' },
  { id: 'QLD', name: 'Queensland', capital: 'Brisbane', dist: '3,600 km', x: 380, y: 280, path: 'M 250,150 C 265,140 280,110 290,80 C 300,95 310,120 315,140 C 325,145 335,160 345,170 C 355,190 370,210 380,240 C 385,270 380,300 385,320 L 370,360 L 250,360 Z' },
  { id: 'NSW', name: 'New South Wales', capital: 'Sydney', dist: '3,300 km', x: 360, y: 375, path: 'M 250,360 L 370,360 L 360,410 L 275,410 L 270,390 L 250,390 Z' },
  { id: 'ACT', name: 'Australian Capital Territory', capital: 'Canberra', dist: '3,100 km', x: 345, y: 390, path: 'M 328,392 A 4,4 0 1,1 328,391.9 Z' },
  { id: 'VIC', name: 'Victoria', capital: 'Melbourne', dist: '2,700 km', x: 310, y: 420, path: 'M 270,410 L 275,410 L 360,410 C 350,430 330,445 300,440 C 285,435 275,425 270,410 Z' },
  { id: 'TAS', name: 'Tasmania', capital: 'Hobart', dist: '3,000 km', x: 315, y: 480, path: 'M 295,465 L 325,465 L 320,490 L 290,490 Z' }
];

interface Props {
  docId?: string;
  existingDoc?: FactFindingDoc;
  onBack: () => void;
  viewOnly?: boolean;
}

const ViewOnlyContext = createContext<boolean>(false);

const Input = (props: any) => {
  const viewOnly = useContext(ViewOnlyContext);
  return <UIInput {...props} disabled={viewOnly || props.disabled} />;
};

const Checkbox = (props: any) => {
  const viewOnly = useContext(ViewOnlyContext);
  return <UICheckbox {...props} disabled={viewOnly || props.disabled} />;
};

const Select = (props: any) => {
  const viewOnly = useContext(ViewOnlyContext);
  return <UISelect {...props} disabled={viewOnly || props.disabled} />;
};

const SelectTrigger = (props: any) => {
  const viewOnly = useContext(ViewOnlyContext);
  return <UISelectTrigger {...props} disabled={viewOnly || props.disabled} />;
};

const Textarea = (props: any) => {
  const viewOnly = useContext(ViewOnlyContext);
  const val = props.value || '';
  return (
    <div className="w-full relative">
      <UITextarea {...props} disabled={viewOnly || props.disabled} className={`print:hidden ${props.className || ''}`} />
      <div className="hidden print:block whitespace-pre-wrap break-words text-xs py-1.5 px-0 border-b border-slate-300 min-h-[20px] text-slate-900 font-medium">
        {val ? val : <span className="text-slate-400 italic">None specified</span>}
      </div>
    </div>
  );
};

function getSalesforceSearchUrl(companyName: string) {
  if (!companyName) return '#';
  const cleanTerm = companyName.split(' (')[0].split(' - ')[0].trim();
  return `https://teamglobalexp.lightning.force.com/_ui/search/ui/UnifiedSearchResults?searchType=2&str=${encodeURIComponent(cleanTerm)}`;
}

function escapeHtml(s: string | undefined | null): string {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildPrintHtml(
  formData: Partial<FactFindingDoc>,
  userName: string,
  mode: 'FULL' | 'REVIEW'
): { title: string; bodyHtml: string } {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10);
  const prefix = mode === 'REVIEW' ? 'Fact Finding Review' : 'Fact Finding';
  const title = `${prefix} - ${formData.companyName || 'Untitled'} - ${dateStr}`;

  const row = (label: string, value?: string | null) => {
    if (!value || !String(value).trim()) return '';
    return `<div class="row"><div class="label">${escapeHtml(label)}</div><div class="value">${escapeHtml(value)}</div></div>`;
  };

  const section = (heading: string, inner: string) => {
    if (!inner.trim()) return '';
    return `<section class="section"><h2>${escapeHtml(heading)}</h2>${inner}</section>`;
  };

  // Full report
  const fullBody = `
    <div class="header">
      <div>
        <h1>Fact Finding Report</h1>
        <div class="label">Client / Prospect</div>
        <div style="font-size:16px;font-weight:800;">${escapeHtml(formData.companyName || 'Untitled')}</div>
      </div>
      <div class="header-meta">
        <div class="label">Prepared by</div>
        <div style="font-weight:800;">${escapeHtml(userName)}</div>
        <div style="margin-top:4px;color:#64748b;">${now.toLocaleDateString()}</div>
        <div style="margin-top:2px;color:#64748b;">Stage: ${escapeHtml(formData.stage || 'New')}</div>
      </div>
    </div>

    ${section('1. General Business Profile', `
      ${row('Business Details', formData.businessDetails)}
      ${row('Currently Using', formData.currentlyUsing)}
      ${row('Key Decision Maker', formData.keyDecisionMaker)}
      ${row('Incumbent Competitor', formData.incumbentCompetitor)}
      ${row('Contract End Date', formData.contractEndDate)}
      ${row('Business Model', formData.businessModel)}
    `)}

    ${section('2. Domestic Freight Profile', `
      ${row('Freight Type', formData.freightType)}
      ${row('Freight Size', formData.freightSize)}
      ${row('Locations', formData.locations)}
      ${row('WA %', formData.waPercentage)}
      ${row('Overnight %', formData.overnightPercentage)}
      ${row('Special Handling', formData.specialHandling)}
      ${row('Loading Dock', formData.loadingDock)}
      ${row('Seasonal Fluctuations', formData.seasonalFluctuations)}
    `)}

    ${section('3. Expectations & Pain Points', `
      ${row('Perfect World Situation', formData.perfectWorld)}
      ${row('Delivery Expectation', formData.deliveryExpectation)}
      ${row('Pain Points', formData.painPoints)}
      ${row('Wholesale Charges', formData.wholesaleCharges)}
      ${row('Trading Terms', formData.tradingTerms)}
    `)}

    ${formData.currentCustomer ? section('4. Down Trading', `
      ${row('Reason Down Trading', formData.reasonDownTrading)}
      ${row('Last Face to Face', formData.lastFaceToFaceMeeting)}
      ${row('Next Face to Face', formData.nextFaceToFaceMeeting)}
      ${row('What Could We Do?', formData.whatCouldWeDo)}
    `) : ''}

    ${formData.selectedServices && formData.selectedServices.length > 0 ? section('5. Required Carrier Services',
      `<ul style="list-style-type:none; padding-left:0; margin:0;">${formData.selectedServices.map((sid: string) => {
        const s = CARRIER_SERVICES.find(srv => srv.id === sid);
        const name = s ? s.name : sid;
        const note = (formData.serviceNotes || {})[sid] || '';
        const spendBand = (formData.serviceSpendBands || {})[sid] || '';
        let html = `<li style="margin-bottom:12px; padding:12px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px;">`;
        html += `<div style="font-weight:800; font-size:14px; color:#0f172a;">${escapeHtml(name)}</div>`;
        if (spendBand) {
          html += `<div style="font-size:12px; font-weight:700; color:#3b82f6; margin-top:4px;">Spend Band: ${escapeHtml(spendBand)}</div>`;
        }
        if (note) {
          html += `<div style="margin-top:6px; font-size:13px; color:#475569; white-space:pre-wrap;">${escapeHtml(note)}</div>`;
        }
        html += `</li>`;
        return html;
      }).join('')}</ul>`
    ) : ''}

    ${formData.archivedNotes && formData.archivedNotes.length > 0 ? section('6. Historical Notes',
      formData.archivedNotes.map((n: any) => `
        <div class="note">
          <div class="note-meta">
            <span>${escapeHtml(n.createdByName || 'Unknown')}</span>
            <span>${n.createdAt?.toDate ? n.createdAt.toDate().toLocaleDateString() : ''}</span>
          </div>
          <div class="value">${escapeHtml(n.note)}</div>
        </div>
      `).join('')
    ) : ''}

    <div class="footer">
      <span>BDM Compass — Confidential</span>
      <span>Generated ${now.toLocaleString()}</span>
    </div>
  `;

  // Review sheet (condensed)
  const reviewBody = `
    <div class="header">
      <div>
        <h1>Fact Finding — Review</h1>
        <div class="label">Client / Prospect</div>
        <div style="font-size:16px;font-weight:800;">${escapeHtml(formData.companyName || 'Untitled')}</div>
      </div>
      <div class="header-meta">
        <div class="label">Prepared by</div>
        <div style="font-weight:800;">${escapeHtml(userName)}</div>
        <div style="margin-top:4px;color:#64748b;">${now.toLocaleDateString()}</div>
      </div>
    </div>

    ${section('Summary', `
      ${row('Business Details', formData.businessDetails)}
      ${row('Key Decision Maker', formData.keyDecisionMaker)}
      ${row('Incumbent Competitor', formData.incumbentCompetitor)}
    `)}

    ${section('Freight Snapshot', `
      ${row('Freight Type', formData.freightType)}
      ${row('Locations', formData.locations)}
      ${row('WA %', formData.waPercentage)}
      ${row('Overnight %', formData.overnightPercentage)}
    `)}

    ${section('Key Pain Points', `
      ${row('Pain Points', formData.painPoints)}
      ${row('Perfect World', formData.perfectWorld)}
      ${row('Delivery Expectation', formData.deliveryExpectation)}
    `)}

    <div class="footer">
      <span>BDM Compass — Review Sheet</span>
      <span>Generated ${now.toLocaleString()}</span>
    </div>
  `;

  return {
    title,
    bodyHtml: mode === 'REVIEW' ? reviewBody : fullBody,
  };
}

export interface FactFindingFormHandle {
  exportPdf: () => Promise<void>;
  exportReview: () => Promise<void>;
}

export const FactFindingForm = forwardRef<FactFindingFormHandle, Props>(
  function FactFindingForm({ docId, existingDoc, onBack, viewOnly = false }, ref) {
  const db = useFirestore();
  const { user, isLeader, isSuperAdmin, profile } = useAuth();
  const isElevated = isLeader || isSuperAdmin;
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const canEdit = !viewOnly;
  const [isEditingOwner, setIsEditingOwner] = useState(false);

  // Whitespace Modal States
  const [isWsFormOpen, setIsWsFormOpen] = useState(false);
  const [isViewWsOpen, setIsViewWsOpen] = useState(false);
  const [isExportingWsPdf, setIsExportingWsPdf] = useState(false);
  const wsPrintContainerRef = useRef<HTMLDivElement>(null);

  const usersQuery = useMemoFirebase(() => {
    if (!db) return null;
    return collection(db, 'users');
  }, [db]);
  const { data: users } = useCollection(usersQuery);

  // Form State
  const [formData, setFormData] = useState<Partial<FactFindingDoc>>({
    companyName: existingDoc?.companyName || '',
    pricingInfo: '',
    businessDetails: '',
    currentlyUsing: '',
    keyDecisionMaker: '',
    incumbentCompetitor: '',
    contractEndDate: '',
    businessModel: '',
    freightType: '',
    freightSize: '',
    weeklyAmount: '',
    locations: '',
    waPercentage: '',
    overnightPercentage: '',
    hasData: false,
    perfectWorld: '',
    deliveryExpectation: '',
    wholesaleCharges: '',
    urgentDeliveries: '',
    securityConcern: false,
    highValueFreight: false,
    dangerousGoods: false,
    // New fields for down trading
    currentCustomer: false,
    reasonDownTrading: '',
    lastFaceToFaceMeeting: '',
    nextFaceToFaceMeeting: '',
    whatCouldWeDo: '',
    internationalFreight: false,
    internationalType: '',
    internationalSize: '',
    painPoints: '',
    specialHandling: '',
    loadingDock: '',
    seasonalFluctuations: '',
    tradingTerms: '',
    selectedServices: [],
    selectedStates: [],
    mapDirection: 'FROM',
    selectedStatesFrom: [],
    selectedStatesTo: [],
    mapNotesFrom: '',
    mapNotesTo: '',
    serviceNotes: {},
    serviceSpendBands: {},
    isArchived: false,
    stage: 'New',
    currentNote: '',
    archivedNotes: [],
    inSalesforce: false
  });

  // Query Whitespace Plans for this account
  const effectiveUserId = user?.uid || profile?.uid;

  const whitespaceQuery = useMemoFirebase(() => {
    if (!db || !effectiveUserId) return null;
    const targetName = (formData.companyName || existingDoc?.companyName || '').trim();
    if (targetName) {
      return query(
        collection(db, 'whitespacePlans'),
        where('accountName', '==', targetName),
        limit(5)
      );
    }
    // If no specific company name typed yet, only subscribe to user's recent plans capped at 25
    return query(
      collection(db, 'whitespacePlans'),
      where('userId', '==', effectiveUserId),
      orderBy('createdAt', 'desc'),
      limit(25)
    );
  }, [db, effectiveUserId, formData.companyName, existingDoc?.companyName]);

  const { data: allWhitespacePlans } = useCollection(whitespaceQuery);

  const matchingWhitespaceDoc = useMemo(() => {
    if (!allWhitespacePlans || allWhitespacePlans.length === 0) return null;
    const targetName = (formData.companyName || existingDoc?.companyName || '').trim().toUpperCase();
    if (!targetName) return null;
    return allWhitespacePlans.find((p: any) => 
      p.accountName?.trim().toUpperCase() === targetName ||
      targetName.includes(p.accountName?.trim().toUpperCase()) ||
      p.accountName?.trim().toUpperCase().includes(targetName)
    ) || null;
  }, [allWhitespacePlans, formData.companyName, existingDoc?.companyName]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    if (existingDoc) {
      setFormData({
        ...existingDoc,
        selectedStatesFrom: existingDoc.selectedStatesFrom || (existingDoc.mapDirection !== 'TO' ? existingDoc.selectedStates || [] : []),
        selectedStatesTo: existingDoc.selectedStatesTo || (existingDoc.mapDirection === 'TO' ? existingDoc.selectedStates || [] : []),
        mapNotesFrom: existingDoc.mapNotesFrom || '',
        mapNotesTo: existingDoc.mapNotesTo || '',
        serviceNotes: existingDoc.serviceNotes || {},
        serviceSpendBands: existingDoc.serviceSpendBands || {},
        currentNote: existingDoc.currentNote || '',
        archivedNotes: existingDoc.archivedNotes || [],
        inSalesforce: existingDoc.inSalesforce || false
      });
    }
  }, [existingDoc]);

  const handleChange = (field: keyof FactFindingDoc, value: any) => {
    const isPricingField = field === 'pricingInfo';
    const allowed = isPricingField ? isLeader : canEdit;
    if (!allowed) return;
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleToggleService = (serviceId: string) => {
    const current = formData.selectedServices || [];
    const updated = current.includes(serviceId)
      ? current.filter(id => id !== serviceId)
      : [...current, serviceId];
    handleChange('selectedServices', updated);
  };

  const handleServiceNote = (serviceId: string, value: string) => {
    if (!canEdit) return;
    setFormData(prev => ({
      ...prev,
      serviceNotes: { ...(prev.serviceNotes || {}), [serviceId]: value }
    }));
  };

  const handleServiceSpendBand = (serviceId: string, value: string) => {
    if (!canEdit) return;
    setFormData(prev => ({
      ...prev,
      serviceSpendBands: { ...(prev.serviceSpendBands || {}), [serviceId]: value }
    }));
  };

  const handleServiceAdminNote = (serviceId: string, value: string) => {
    if (!isLeader) return;
    setFormData(prev => ({
      ...prev,
      serviceAdminNotes: { ...(prev.serviceAdminNotes || {}), [serviceId]: value }
    }));
  };

  const updateCombinedLocations = (fromStates: string[], toStates: string[]) => {
    const parts: string[] = [];
    if (fromStates.length > 0) {
      parts.push(`WA to ${fromStates.join(', ')}`);
    }
    if (toStates.length > 0) {
      parts.push(`${toStates.join(', ')} to WA`);
    }
    handleChange('locations', parts.join(' | '));
  };

  const handleToggleStateFrom = (stateId: string) => {
    const current = formData.selectedStatesFrom || [];
    const updated = current.includes(stateId)
      ? current.filter(id => id !== stateId)
      : [...current, stateId];
    
    setFormData(prev => {
      const next = { ...prev, selectedStatesFrom: updated };
      updateCombinedLocations(updated, next.selectedStatesTo || []);
      return next;
    });
  };

  const handleToggleStateTo = (stateId: string) => {
    const current = formData.selectedStatesTo || [];
    const updated = current.includes(stateId)
      ? current.filter(id => id !== stateId)
      : [...current, stateId];
    
    setFormData(prev => {
      const next = { ...prev, selectedStatesTo: updated };
      updateCombinedLocations(next.selectedStatesFrom || [], updated);
      return next;
    });
  };

  const handleSave = async (shouldClose = false) => {
    if (!db || !user) return;
    
    if (!formData.companyName) {
      toast({ title: "Validation Error", description: "Company Name is required", variant: "destructive" });
      return;
    }

    // Validate Down Trading fields when Current Customer is ticked
    if (formData.currentCustomer) {
      const missing: string[] = [];
      if (!formData.reasonDownTrading?.trim()) missing.push('Reason Down Trading');
      if (!formData.lastFaceToFaceMeeting) missing.push('Last Face to Face Meeting');
      if (!formData.nextFaceToFaceMeeting) missing.push('Next Face to Face Meeting');
      if (!formData.whatCouldWeDo?.trim()) missing.push('What Could We Do?');
      if (missing.length > 0) {
        toast({
          title: "Down Trading Fields Required",
          description: `Please complete: ${missing.join(', ')}`,
          variant: "destructive"
        });
        return;
      }
    }

    setIsSaving(true);
    try {
      const notesToArchive = [...(formData.archivedNotes || [])];
      if (formData.currentNote?.trim()) {
        notesToArchive.push({
          note: formData.currentNote.trim(),
          createdAt: new Date(),
          createdByName: profile?.name || user?.email || 'Unknown User',
          createdBy: user?.uid || ''
        });
      }

      const rawPayload = {
        ...formData,
        userId: formData.userId || user.uid,
        currentNote: '',
        archivedNotes: notesToArchive
      };

      const savePayload = validateDocument(FactFindingDocSchema.partial(), rawPayload, 'factFindingDoc');

      if (docId) {
        await updateDoc(doc(db, 'factFindingDocs', docId), {
          ...savePayload,
          lastModifiedAt: serverTimestamp()
        });
        setFormData(prev => ({
          ...prev,
          currentNote: '',
          archivedNotes: notesToArchive
        }));
        toast({ title: "Updated", description: "Fact Finding document updated successfully." });
        if (shouldClose) {
          onBack();
        }
      } else {
        await addDoc(collection(db, 'factFindingDocs'), {
          ...savePayload,
          userId: formData.userId || user.uid,
          createdAt: serverTimestamp(),
          lastModifiedAt: serverTimestamp()
        });
        toast({ title: "Saved", description: "Fact Finding document saved successfully." });
        onBack(); // Go back to hub after creating
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!docId || !db) return;
    
    setIsSaving(true);
    try {
      await deleteDoc(doc(db, 'factFindingDocs', docId));
      toast({ title: "Deleted", description: "Fact Finding document deleted successfully." });
      onBack();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
      setIsSaving(false);
    }
  };

  const handleExportPDF = async () => {
    if (!formData.companyName?.trim() && !formData.businessDetails?.trim()) {
      toast({
        variant: 'destructive',
        title: 'Nothing to export',
        description: 'Fill in at least the company name or business details first.',
      });
      return;
    }
    
    try {
      const { title, bodyHtml } = buildPrintHtml(formData, profile?.name || user?.email || '', 'FULL');
      printHtmlInNewWindow({ title, bodyHtml });
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Export failed',
        description: err?.message || 'Could not open print window.',
      });
    }
  };

  const handleExportReview = async () => {
    if (!formData.companyName?.trim() && !formData.businessDetails?.trim()) {
      toast({
        variant: 'destructive',
        title: 'Nothing to export',
        description: 'Fill in at least the company name or business details first.',
      });
      return;
    }
    
    try {
      const { title, bodyHtml } = buildPrintHtml(formData, profile?.name || user?.email || '', 'REVIEW');
      printHtmlInNewWindow({ title, bodyHtml });
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Export failed',
        description: err?.message || 'Could not open print window.',
      });
    }
  };

  useImperativeHandle(ref, () => ({
    exportPdf: handleExportPDF,
    exportReview: handleExportReview,
  }));

  return (
    <ViewOnlyContext.Provider value={viewOnly}>
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-12 max-w-full bg-white text-slate-900">
        <div>
        {/* Header - Hidden on Export */}
        <div className={`sticky top-0 z-40 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white/95 backdrop-blur-sm p-4 rounded-xl shadow-sm border border-slate-200`}>
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack} className="rounded-full">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h2 className="text-xl font-black text-slate-800">
              {docId ? 'Edit Fact Finding' : 'New Fact Finding'}
            </h2>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xs font-medium text-slate-500 break-words max-w-full">
                {formData.companyName || 'Untitled Document'}
              </p>
              {docId && (
                <div className="flex items-center gap-2 ml-2 pl-2 border-l border-slate-200">
                  <span className="text-xs text-slate-500">Owner:</span>
                  {isEditingOwner ? (
                    <Select value={formData.userId} onValueChange={async (val: string) => { 
                      handleChange('userId', val); 
                      setIsEditingOwner(false); 
                      if (docId) {
                        try {
                          await updateDoc(doc(db, 'factFindingDocs', docId), {
                            userId: val,
                            lastModifiedAt: serverTimestamp()
                          });
                          toast({ title: "Owner Changed", description: "Document ownership updated successfully." });
                        } catch (err: any) {
                          toast({ title: "Error", description: err.message, variant: "destructive" });
                        }
                      }
                    }}>
                      <SelectTrigger className="h-6 text-xs w-[140px]">
                        <SelectValue placeholder="Select User" />
                      </SelectTrigger>
                      <SelectContent>
                        {deduplicateUsers(users || []).map((u: any) => (
                          <SelectItem key={u.id} value={u.id}>{u.name || u.email || 'Unknown User'}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <div className="flex items-center gap-1">
                      <span className="text-xs font-bold text-slate-700">
                        {users?.find((u: any) => u.id === formData.userId)?.name || 'Unknown'}
                      </span>
                      <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => setIsEditingOwner(true)}>
                        <Edit2 className="h-3 w-3 text-slate-500" />
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
        {!viewOnly && (
          <div className="flex flex-wrap items-center justify-end gap-2 w-full sm:w-auto mt-4 sm:mt-0">
            {docId && isLeader && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button type="button" variant="outline" className="flex-1 sm:flex-none gap-2 font-bold text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700">
                    <Trash2 className="w-4 h-4" />
                    Delete
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This action cannot be undone. This will permanently delete this Fact Finding document.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700 text-white">
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
            {docId && (
              <Button type="button" variant="outline" onClick={() => {
                window.dispatchEvent(new CustomEvent('switch-view', {
                  detail: {
                    view: 'CALL_PLANNING',
                    params: { type: 'fact-finding', data: { ...formData, docId } }
                  }
                }));
              }} className="flex-1 sm:flex-none gap-2 font-bold bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100">
                Prepare Call Plan
              </Button>
            )}
            <Button 
              variant={formData.isArchived ? "secondary" : "outline"} 
              onClick={() => setFormData(prev => ({ ...prev, isArchived: !prev.isArchived }))} 
              className="flex-1 sm:flex-none gap-2 font-bold text-slate-700 border-slate-300"
            >
              {formData.isArchived ? "Unarchive" : "Archive"}
            </Button>
            <Button variant="outline" onClick={handleExportPDF} className="flex-1 sm:flex-none gap-2 font-bold text-slate-700">
              <Printer className="w-4 h-4" />
              Export PDF
            </Button>
            <Button variant="outline" onClick={handleExportReview} className="flex-1 sm:flex-none gap-2 font-bold text-indigo-700 bg-indigo-50 border-indigo-200 hover:bg-indigo-100">
              <Printer className="w-4 h-4" />
              Export Review
            </Button>
            <Button onClick={() => handleSave(false)} disabled={isSaving || !canEdit} variant="outline" className="flex-1 sm:flex-none gap-2 font-bold text-slate-700 border-slate-300">
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save Document
            </Button>
            <Button onClick={() => handleSave(true)} disabled={isSaving || !canEdit} className="flex-1 sm:flex-none gap-2 font-bold shadow-md bg-emerald-600 hover:bg-emerald-700 text-white border-none">
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              Save & Close
            </Button>
          </div>
        )}
      </div>

      {/* Print Header - Visible ONLY on Print */}
      <div className="hidden print:block mb-8 border-b-2 border-slate-900 pb-4">
        <h1 className="text-4xl font-black text-slate-900 tracking-tight">Fact Finding Report</h1>
        <div className="flex justify-between items-end mt-4">
          <div>
            <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">Client / Prospect</p>
            <h2 className="text-2xl font-bold text-slate-800">{formData.companyName || '____________________'}</h2>
          </div>
          <div className="text-right">
            <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">Date</p>
            <p className="text-lg font-bold text-slate-800">{new Date().toLocaleDateString()}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Main Form Content */}
        <div className="lg:col-span-12 space-y-6">
          
          <Card className="border-slate-200 shadow-sm print:shadow-none print:border-none">
            <CardHeader className="bg-slate-50/50 border-b border-slate-100 print:bg-transparent print:border-b-2 print:border-slate-800 print:px-0 print:py-2">
              <CardTitle className="text-lg font-black text-slate-800 flex items-center gap-2">
                <Building className="w-5 h-5 text-primary print:text-slate-900" />
                1. General Business Profile
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-6 print:px-0 print:py-3 print:space-y-4">
              <div className="space-y-2">
                <Label className="font-bold text-slate-700">Company Name *</Label>
                <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
                  <div className="flex gap-2 flex-1 w-full">
                    <Input 
                      value={formData.companyName} 
                      onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => handleChange('companyName', e.target.value)} 
                      placeholder="Enter company name"
                      className="font-medium print:border-0 print:border-b print:rounded-none print:px-0 print:text-lg print:shadow-none flex-1"
                    />
                    {formData.companyName && (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => window.open(getSalesforceSearchUrl(formData.companyName || ''), '_blank')}
                        className="gap-2 font-bold text-[#00a1e0] border-[#00a1e0]/20 hover:bg-[#00a1e0]/10 hover:text-[#00a1e0] shrink-0 print:hidden"
                        title="Search Company in Salesforce"
                      >
                        <Building className="w-4 h-4" />
                        Salesforce
                      </Button>
                    )}
                  </div>
                  <div className="flex items-center space-x-2 bg-slate-50 border border-slate-200 px-4 py-2 rounded-xl h-10 print:hidden shrink-0">
                    <Checkbox 
                      id="inSalesforce"
                      checked={!!formData.inSalesforce}
                      onCheckedChange={(checked: boolean | 'indeterminate') => handleChange('inSalesforce', !!checked)}
                    />
                    <Label htmlFor="inSalesforce" className="text-sm font-black text-slate-700 cursor-pointer pt-0.5">In Salesforce</Label>
                  </div>
                </div>
                {/* Stage Pipeline */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mt-6 p-4 bg-slate-50 border border-slate-200 rounded-xl shadow-inner print:p-0 print:bg-transparent print:border-none print:mt-2">
                  <div className="flex items-center space-x-2 sm:pr-4 sm:border-r border-slate-300 print:border-none">
                    <Checkbox 
                      id="currentCustomer"
                      checked={!!formData.currentCustomer}
                      onCheckedChange={(checked: boolean | 'indeterminate') => handleChange('currentCustomer', !!checked)}
                    />
                    <Label htmlFor="currentCustomer" className="text-sm font-black text-indigo-700 cursor-pointer print:text-xs">Current Customer</Label>
                  </div>
                  <div className="flex flex-wrap gap-2 print:hidden">
                    {['New', 'Meeting', 'Proposal Required', 'Proposal Sent', 'Signed', 'Credit Check', 'Account Setup', 'Customer Training', 'Trading'].map(s => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => handleChange('stage', s)}
                        className={`px-3 py-1.5 text-xs font-bold rounded-full transition-all border ${
                          formData.stage === s 
                            ? 'bg-primary text-white border-primary shadow-md scale-105' 
                            : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-100 hover:text-slate-800'
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                  <div className="hidden print:block text-xs font-bold text-slate-800">
                    Stage: <span className="font-black text-indigo-900">{formData.stage || 'Not specified'}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-2 print:hidden bg-indigo-50/50 p-4 rounded-xl border border-indigo-100">
                <Label className="font-bold text-slate-700 flex justify-between items-center">
                  <span>Current Note / Quick Update</span>
                  <span className="text-[10px] text-indigo-600 font-bold uppercase tracking-wider">Archives on save</span>
                </Label>
                <div className="flex gap-3 items-end">
                  <Textarea 
                    value={formData.currentNote || ''} 
                    onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => handleChange('currentNote', e.target.value)} 
                    placeholder="Enter quick update note..."
                    className="min-h-[60px] text-xs font-semibold bg-white border-slate-200 focus:border-indigo-400 flex-1"
                    rows={2}
                  />
                  {formData.currentNote?.trim() && (
                    <Button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(formData.currentNote || '');
                        toast({ title: "Note Copied", description: "Text copied to clipboard. Opening Salesforce search..." });
                        window.open(getSalesforceSearchUrl(formData.companyName || ''), '_blank');
                      }}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold gap-2 shrink-0 h-10 px-4 rounded-xl shadow-md transition-all text-xs"
                    >
                      <Copy className="w-4 h-4" />
                      Copy & Search
                    </Button>
                  )}
                </div>

                {formData.archivedNotes && formData.archivedNotes.length > 0 && (
                  <div className="mt-3 p-3 bg-white rounded-lg border border-indigo-100/80 shadow-sm space-y-1">
                    <span className="text-[9px] uppercase font-black text-indigo-500 block">Last Saved Note:</span>
                    <p className="text-xs font-semibold text-slate-800 whitespace-pre-wrap break-words leading-relaxed">
                      {formData.archivedNotes[formData.archivedNotes.length - 1].note}
                    </p>
                    <div className="text-[9px] text-slate-400 font-bold uppercase tracking-wider flex justify-between pt-1 border-t border-slate-50">
                      <span>By {formData.archivedNotes[formData.archivedNotes.length - 1].createdByName}</span>
                      <span>
                        {(() => {
                          const noteObj = formData.archivedNotes[formData.archivedNotes.length - 1];
                          return noteObj.createdAt ? (
                            noteObj.createdAt.toDate 
                              ? format(noteObj.createdAt.toDate(), 'MMM d, yyyy h:mm a') 
                              : format(new Date(noteObj.createdAt), 'MMM d, yyyy h:mm a')
                          ) : 'Recently';
                        })()}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label className="font-bold text-slate-700">Please tell me about your business?</Label>
                <p className="text-xs text-slate-500 font-medium mb-2 print:hidden">Who, What, How, Why, When, Website URL, Shipping Platform</p>
                <Textarea 
                  value={formData.businessDetails} 
                  onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => handleChange('businessDetails', e.target.value)} 
                  placeholder="Business details..."
                  className="min-h-[120px] font-medium print:border-none print:resize-none print:p-0 print:shadow-none"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label className="font-bold text-slate-700">Currently Using (Provider)</Label>
                  <Input value={formData.currentlyUsing} onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => handleChange('currentlyUsing', e.target.value)} className="print:border-0 print:border-b print:rounded-none print:px-0 print:shadow-none" />
                </div>
                <div className="space-y-2">
                  <Label className="font-bold text-slate-700">Key Decision Maker Name</Label>
                  <Input value={formData.keyDecisionMaker || ''} onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => handleChange('keyDecisionMaker', e.target.value)} className="print:border-0 print:border-b print:rounded-none print:px-0 print:shadow-none" placeholder="e.g. John Doe (Director)" />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label className="font-bold text-slate-700">Incumbent Competitor</Label>
                  <Input value={formData.incumbentCompetitor || ''} onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => handleChange('incumbentCompetitor', e.target.value)} className="print:border-0 print:border-b print:rounded-none print:px-0 print:shadow-none" placeholder="Incumbent provider details..." />
                </div>
                <div className="space-y-2">
                  <Label className="font-bold text-slate-700">Contract End Date / Renewal Timeline</Label>
                  <Input value={formData.contractEndDate || ''} onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => handleChange('contractEndDate', e.target.value)} className="print:border-0 print:border-b print:rounded-none print:px-0 print:shadow-none" placeholder="e.g. Dec 2026 or 2026-12-31" />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label className="font-bold text-slate-700">Business Model</Label>
                  <div className="print:hidden">
                    <Select value={formData.businessModel} onValueChange={(v: string) => handleChange('businessModel', v)}>
                      <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="B2B">B2B</SelectItem>
                        <SelectItem value="eCommerce">eCommerce</SelectItem>
                        <SelectItem value="Both">Both (B2B & eCommerce)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="hidden print:block font-medium text-lg pt-2">{formData.businessModel || '_________________'}</div>
                </div>
              </div>

              <div className="border-t border-slate-100 pt-6 mt-6">
                <h3 className="text-sm font-black uppercase text-indigo-900 tracking-wider mb-4">Operational Needs</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="flex items-center space-x-3 bg-slate-50/50 p-3 rounded-xl border border-slate-100">
                    <Checkbox id="securityConcern" checked={formData.securityConcern} onCheckedChange={(c: boolean | 'indeterminate') => handleChange('securityConcern', !!c)} className="print:border-slate-500" />
                    <Label htmlFor="securityConcern" className="font-bold text-xs text-slate-700 cursor-pointer">Freight security is a concern</Label>
                  </div>
                  <div className="flex items-center space-x-3 bg-slate-50/50 p-3 rounded-xl border border-slate-100">
                    <Checkbox id="highValueFreight" checked={formData.highValueFreight} onCheckedChange={(c: boolean | 'indeterminate') => handleChange('highValueFreight', !!c)} className="print:border-slate-500" />
                    <Label htmlFor="highValueFreight" className="font-bold text-xs text-slate-700 cursor-pointer">Sends High Value freight</Label>
                  </div>
                  <div className="flex items-center space-x-3 bg-slate-50/50 p-3 rounded-xl border border-slate-100">
                    <Checkbox id="dangerousGoods" checked={formData.dangerousGoods} onCheckedChange={(c: boolean | 'indeterminate') => handleChange('dangerousGoods', !!c)} className="print:border-slate-500" />
                    <Label htmlFor="dangerousGoods" className="font-bold text-xs text-slate-700 cursor-pointer">Sends Dangerous Goods</Label>
                  </div>
                  <div className="flex items-center space-x-3 bg-slate-50/50 p-3 rounded-xl border border-slate-100">
                    <Checkbox id="internationalFreight" checked={formData.internationalFreight} onCheckedChange={(c: boolean | 'indeterminate') => handleChange('internationalFreight', !!c)} className="print:border-slate-500" />
                    <Label htmlFor="internationalFreight" className="font-bold text-xs text-slate-700 cursor-pointer">Uses International Freight</Label>
                  </div>
                </div>

                {formData.internationalFreight && (
                  <div className="mt-4 p-4 bg-indigo-50/30 rounded-xl border border-indigo-100/50 grid grid-cols-1 md:grid-cols-2 gap-4 print:p-0 print:bg-transparent print:border-none print:mt-2">
                    <div className="space-y-2">
                      <Label className="font-bold text-xs text-indigo-900 print:text-slate-700">International Type (Sea/Air)</Label>
                      <Input value={formData.internationalType} onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => handleChange('internationalType', e.target.value)} className="bg-white print:border-0 print:border-b print:rounded-none print:px-0 print:shadow-none print:bg-transparent" />
                    </div>
                    <div className="space-y-2">
                      <Label className="font-bold text-xs text-indigo-900 print:text-slate-700">Intl Size (Parcels/Cartons/Pallets/Containers)</Label>
                      <Input value={formData.internationalSize} onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => handleChange('internationalSize', e.target.value)} className="bg-white print:border-0 print:border-b print:rounded-none print:px-0 print:shadow-none print:bg-transparent" />
                    </div>
                  </div>
                )}
              </div>

              <div className="border-t border-slate-100 pt-6 mt-6">
                <h3 className="text-sm font-black uppercase text-indigo-900 tracking-wider mb-4">Advanced Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2 md:col-span-2">
                    <Label className="font-bold text-slate-700">Primary Pain Points</Label>
                    <Textarea value={formData.painPoints} onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => handleChange('painPoints', e.target.value)} className="min-h-[80px] print:border-none print:resize-none print:p-0 print:shadow-none" />
                  </div>
                  <div className="space-y-2">
                    <Label className="font-bold text-slate-700">Special Handling Requirements</Label>
                    <Input value={formData.specialHandling} onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => handleChange('specialHandling', e.target.value)} className="print:border-0 print:border-b print:rounded-none print:px-0 print:shadow-none" />
                  </div>
                  <div className="space-y-2">
                    <Label className="font-bold text-slate-700">Loading Dock Capabilities</Label>
                    <Input value={formData.loadingDock} onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => handleChange('loadingDock', e.target.value)} className="print:border-0 print:border-b print:rounded-none print:px-0 print:shadow-none" />
                  </div>
                  <div className="space-y-2">
                    <Label className="font-bold text-slate-700">Seasonal Fluctuations</Label>
                    <Input value={formData.seasonalFluctuations} onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => handleChange('seasonalFluctuations', e.target.value)} className="print:border-0 print:border-b print:rounded-none print:px-0 print:shadow-none" />
                  </div>
                  <div className="space-y-2">
                    <Label className="font-bold text-slate-700">Trading Terms Expected</Label>
                    <Input value={formData.tradingTerms} onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => handleChange('tradingTerms', e.target.value)} className="print:border-0 print:border-b print:rounded-none print:px-0 print:shadow-none" />
                  </div>
                </div>
              </div>

            </CardContent>
          </Card>


          <Card className="border-slate-200 shadow-sm print:shadow-none print:border-none print:mt-4">
            <CardHeader className="bg-slate-50/50 border-b border-slate-100 print:bg-transparent print:border-b-2 print:border-slate-800 print:px-0 print:py-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <CardTitle className="text-lg font-black text-slate-800 flex items-center gap-2">
                  <Package className="w-5 h-5 text-primary print:text-slate-900" />
                  2. Domestic Freight Profile & Shipping Map
                </CardTitle>

                {/* Right-Justified White Space Action Buttons */}
                <div className="flex items-center gap-2 self-start sm:self-auto print:hidden">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsWsFormOpen(true)}
                    className="gap-2 font-bold bg-amber-50 border-amber-200 text-amber-900 hover:bg-amber-100 h-9 text-xs shadow-sm"
                  >
                    <LayoutGrid className="w-3.5 h-3.5 text-amber-600" />
                    White Space
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsViewWsOpen(true)}
                    className="gap-2 font-bold bg-cyan-50 border-cyan-200 text-cyan-900 hover:bg-cyan-100 h-9 text-xs shadow-sm"
                  >
                    <Eye className="w-3.5 h-3.5 text-cyan-600" />
                    View WS
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6 space-y-6 print:px-0">
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <Label className="font-bold text-slate-700">Type of Freight</Label>
                  <Input placeholder="Sameday, Priority, Road..." value={formData.freightType} onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => handleChange('freightType', e.target.value)} className="print:border-0 print:border-b print:rounded-none print:px-0 print:shadow-none" />
                </div>
                <div className="space-y-2">
                  <Label className="font-bold text-slate-700">Size of Freight</Label>
                  <Input placeholder="Dimensions/Weight" value={formData.freightSize} onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => handleChange('freightSize', e.target.value)} className="print:border-0 print:border-b print:rounded-none print:px-0 print:shadow-none" />
                </div>
                <div className="space-y-2">
                  <Label className="font-bold text-slate-700">EAV</Label>
                  <Input placeholder="e.g. $5,000 or 50 items" value={formData.weeklyAmount} onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => handleChange('weeklyAmount', e.target.value)} className="print:border-0 print:border-b print:rounded-none print:px-0 print:shadow-none" />
                </div>
              </div>

              {/* Map & Destination Lanes Visuals */}
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="font-bold text-slate-700">% Staying in WA?</Label>
                      <Input type="number" placeholder="%" value={formData.waPercentage} onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => handleChange('waPercentage', e.target.value)} className="print:border-0 print:border-b print:rounded-none print:px-0 print:shadow-none" />
                    </div>
                    <div className="space-y-2">
                      <Label className="font-bold text-slate-700">% Overnight?</Label>
                      <Input type="number" placeholder="%" value={formData.overnightPercentage} onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => handleChange('overnightPercentage', e.target.value)} className="print:border-0 print:border-b print:rounded-none print:px-0 print:shadow-none" />
                    </div>
                  </div>
                  <div className="flex items-center space-x-3 bg-slate-50 p-3 rounded-lg border border-slate-100 print:bg-transparent print:border-none print:p-0 justify-center">
                    <Checkbox 
                      id="hasData" 
                      checked={formData.hasData} 
                      onCheckedChange={(c: boolean | 'indeterminate') => handleChange('hasData', !!c)} 
                      className="print:border-slate-500"
                    />
                    <Label htmlFor="hasData" className="font-bold text-slate-700 cursor-pointer">
                      3mths Data available (Excel/CSV)?
                    </Label>
                  </div>
                </div>

                {/* Dual Maps Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 print:hidden">
                  
                  {/* MAP 1: OUTBOUND */}
                  <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-200/60 flex flex-col items-center space-y-4">
                    <div className="text-center">
                      <span className="text-[10px] font-black tracking-widest uppercase text-slate-400">Interactive Shipping Map</span>
                      <h4 className="text-xs font-bold text-slate-700 mb-1">Origin Perth (WA) Destination Lanes</h4>
                      <p className="text-[10px] text-red-600 font-bold uppercase tracking-wide">OUTBOUND (FROM PERTH)</p>
                    </div>
                    <div className="relative w-full max-w-[280px] aspect-[420/520]">
                      <svg viewBox="0 0 420 520" className="w-full h-full select-none">
                        {/* State Paths */}
                        {AUSTRALIA_STATES.map((state) => {
                          if (!state.path) return null;
                          const isSelected = formData.selectedStatesFrom?.includes(state.id);
                          const isWA = state.id === 'WA';
                          return (
                            <g key={`from-${state.id}`} className="cursor-pointer" onClick={() => handleToggleStateFrom(state.id)}>
                              <path
                                d={state.path}
                                className={`transition-all duration-300 stroke-white stroke-2 ${
                                  isWA
                                    ? 'fill-indigo-600/20 hover:fill-indigo-600/30'
                                    : isSelected
                                    ? 'fill-red-500 hover:fill-red-600'
                                    : 'fill-slate-200 hover:fill-slate-300'
                                }`}
                              />
                              <title>{state.name} ({state.id})</title>
                            </g>
                          );
                        })}

                        {/* Perth Origin Point */}
                        <circle cx={95} cy={330} r={6} className="fill-indigo-600 stroke-white stroke-2 animate-pulse" />
                        <text x={95} y={320} className="text-[9px] font-black fill-indigo-800 text-anchor-middle">PERTH</text>

                        {/* Pilbara Origin Point */}
                        <g className="cursor-pointer" onClick={() => handleToggleStateFrom('PILBARA')}>
                          <circle cx={80} cy={200} r={5} className={`${formData.selectedStatesFrom?.includes('PILBARA') ? 'fill-red-500 animate-pulse' : 'fill-slate-400'} stroke-white stroke-1.5`} />
                          <text x={80} y={190} className="text-[8px] font-black fill-slate-700" textAnchor="middle">PILBARA</text>
                        </g>

                        {/* Connection Lanes */}
                        {AUSTRALIA_STATES.map((state) => {
                          if (state.id === 'WA' || !formData.selectedStatesFrom?.includes(state.id)) return null;
                          const mx = (95 + state.x) / 2;
                          const my = (330 + state.y) / 2 - 40;
                          return (
                            <g key={`lane-from-${state.id}`}>
                              <path
                                d={`M 95,330 Q ${mx},${my} ${state.x},${state.y}`}
                                fill="none"
                                stroke="#ef4444"
                                strokeWidth="2.5"
                                strokeDasharray="4 3"
                                className="animate-[dash_2s_linear_infinite]"
                              />
                              <circle cx={state.x} cy={state.y} r={4} className="fill-indigo-600 stroke-white stroke-1.5" />
                              <text x={state.x} y={state.y - 8} className="text-[8px] font-bold fill-slate-700 text-center" textAnchor="middle">
                                {state.id}: {state.dist}
                              </text>
                            </g>
                          );
                        })}
                      </svg>
                    </div>
                    <div className="flex flex-wrap gap-1 justify-center">
                      {AUSTRALIA_STATES.map((state) => {
                        const isSelected = formData.selectedStatesFrom?.includes(state.id);
                        if (state.id === 'WA') return null;
                        return (
                          <button
                            key={`btn-from-${state.id}`}
                            type="button"
                            onClick={() => handleToggleStateFrom(state.id)}
                            className={`text-[10px] font-bold px-2 py-0.5 rounded transition-all ${
                              isSelected ? 'bg-red-500 text-white shadow-sm' : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                            }`}
                          >
                            {state.id}
                          </button>
                        );
                      })}
                    </div>
                    <div className="w-full pt-2">
                      <Label className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Locations not near Capital City / Unique Notes</Label>
                      <Textarea 
                        placeholder="e.g. Bunbury, Kalgoorlie, Port Hedland..." 
                        value={formData.mapNotesFrom || ''} 
                        onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => handleChange('mapNotesFrom', e.target.value)}
                        className="mt-1.5 text-xs font-medium rounded-xl border-slate-200"
                        rows={2}
                      />
                    </div>
                  </div>

                  {/* MAP 2: INBOUND */}
                  <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-200/60 flex flex-col items-center space-y-4">
                    <div className="text-center">
                      <span className="text-[10px] font-black tracking-widest uppercase text-slate-400">Interactive Shipping Map</span>
                      <h4 className="text-xs font-bold text-slate-700 mb-1">Destination Perth (WA)</h4>
                      <p className="text-[10px] text-orange-600 font-bold uppercase tracking-wide">INBOUND (TO PERTH)</p>
                    </div>
                    <div className="relative w-full max-w-[280px] aspect-[420/520]">
                      <svg viewBox="0 0 420 520" className="w-full h-full select-none">
                        {/* State Paths */}
                        {AUSTRALIA_STATES.map((state) => {
                          if (!state.path) return null;
                          const isSelected = formData.selectedStatesTo?.includes(state.id);
                          const isWA = state.id === 'WA';
                          return (
                            <g key={`to-${state.id}`} className="cursor-pointer" onClick={() => handleToggleStateTo(state.id)}>
                              <path
                                d={state.path}
                                className={`transition-all duration-300 stroke-white stroke-2 ${
                                  isWA
                                    ? 'fill-indigo-600/20 hover:fill-indigo-600/30'
                                    : isSelected
                                    ? 'fill-orange-500 hover:fill-orange-600'
                                    : 'fill-slate-200 hover:fill-slate-300'
                                }`}
                              />
                              <title>{state.name} ({state.id})</title>
                            </g>
                          );
                        })}

                        {/* Perth Destination Point */}
                        <circle cx={95} cy={330} r={6} className="fill-indigo-600 stroke-white stroke-2 animate-pulse" />
                        <text x={95} y={320} className="text-[9px] font-black fill-indigo-800 text-anchor-middle">PERTH</text>

                        {/* Pilbara Destination Point */}
                        <g className="cursor-pointer" onClick={() => handleToggleStateTo('PILBARA')}>
                          <circle cx={80} cy={200} r={5} className={`${formData.selectedStatesTo?.includes('PILBARA') ? 'fill-orange-500 animate-pulse' : 'fill-slate-400'} stroke-white stroke-1.5`} />
                          <text x={80} y={190} className="text-[8px] font-black fill-slate-700" textAnchor="middle">PILBARA</text>
                        </g>

                        {/* Connection Lanes */}
                        {AUSTRALIA_STATES.map((state) => {
                          if (state.id === 'WA' || !formData.selectedStatesTo?.includes(state.id)) return null;
                          const mx = (95 + state.x) / 2;
                          const my = (330 + state.y) / 2 - 40;
                          return (
                            <g key={`lane-to-${state.id}`}>
                              <path
                                d={`M 95,330 Q ${mx},${my} ${state.x},${state.y}`}
                                fill="none"
                                stroke="#f97316"
                                strokeWidth="2.5"
                                strokeDasharray="4 3"
                                className="animate-[dash_2s_linear_reverse_infinite]"
                              />
                              <circle cx={state.x} cy={state.y} r={4} className="fill-indigo-600 stroke-white stroke-1.5" />
                              <text x={state.x} y={state.y - 8} className="text-[8px] font-bold fill-slate-700 text-center" textAnchor="middle">
                                {state.id}: {state.dist}
                              </text>
                            </g>
                          );
                        })}
                      </svg>
                    </div>
                    <div className="flex flex-wrap gap-1 justify-center">
                      {AUSTRALIA_STATES.map((state) => {
                        const isSelected = formData.selectedStatesTo?.includes(state.id);
                        if (state.id === 'WA') return null;
                        return (
                          <button
                            key={`btn-to-${state.id}`}
                            type="button"
                            onClick={() => handleToggleStateTo(state.id)}
                            className={`text-[10px] font-bold px-2 py-0.5 rounded transition-all ${
                              isSelected ? 'bg-orange-500 text-white shadow-sm' : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                            }`}
                          >
                            {state.id}
                          </button>
                        );
                      })}
                    </div>
                    <div className="w-full pt-2">
                      <Label className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Locations not near Capital City / Unique Notes</Label>
                      <Textarea 
                        placeholder="e.g. Albany, Geraldton, Broome..." 
                        value={formData.mapNotesTo || ''} 
                        onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => handleChange('mapNotesTo', e.target.value)}
                        className="mt-1.5 text-xs font-medium rounded-xl border-slate-200"
                       />
                    </div>
                  </div>
                </div>
              </div>

              {/* Selected Lanes & Map Notes Print Version (Static List for PDF) */}
              <div className="hidden print:block border-t border-slate-300 pt-4 space-y-4">
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <h5 className="text-xs font-bold text-slate-700 uppercase tracking-widest mb-1">Outbound Lanes (From Perth)</h5>
                    <p className="text-sm font-bold text-slate-900">{(formData.selectedStatesFrom || []).join(', ') || 'None selected'}</p>
                    {formData.mapNotesFrom && (
                      <div className="mt-2">
                        <p className="text-[10px] font-bold text-slate-500 uppercase">Locations not near Capital City / Unique Notes:</p>
                        <p className="text-xs font-medium text-slate-800 whitespace-pre-wrap">{formData.mapNotesFrom}</p>
                      </div>
                    )}
                  </div>
                  <div>
                    <h5 className="text-xs font-bold text-slate-700 uppercase tracking-widest mb-1">Inbound Lanes (To Perth)</h5>
                    <p className="text-sm font-bold text-slate-900">{(formData.selectedStatesTo || []).join(', ') || 'None selected'}</p>
                    {formData.mapNotesTo && (
                      <div className="mt-2">
                        <p className="text-[10px] font-bold text-slate-500 uppercase">Locations not near Capital City / Unique Notes:</p>
                        <p className="text-xs font-medium text-slate-800 whitespace-pre-wrap">{formData.mapNotesTo}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

            </CardContent>
          </Card>

          {/* Clickable Carrier Services Grid (TGE WA Network) */}
          <Card className="border-slate-200 shadow-sm print:shadow-none print:border-none print:mt-4">
            <CardHeader className="bg-slate-50/50 border-b border-slate-100 print:bg-transparent print:border-b-2 print:border-slate-800 print:px-0 print:py-2">
              <CardTitle className="text-lg font-black text-slate-800 flex items-center gap-2">
                <Truck className="w-5 h-5 text-primary print:text-slate-900" />
                3. TGE Parcel Network Western Australia Services
              </CardTitle>
              <CardDescription className="print:hidden">
                Click on the services that the client requires. Highlighted services will save to the document.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6 space-y-6 print:px-0 print:py-2 print:space-y-3">
              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-inner bg-slate-50/20 p-4 print:hidden">
                
                {/* Visual Header */}
                <div className="bg-emerald-950 text-white py-3 px-4 text-center rounded-lg font-black text-lg mb-6 shadow-sm flex items-center justify-center gap-2 print:border print:border-slate-300 print:text-black print:bg-transparent">
                  <Truck className="w-5 h-5" />
                  Team Global Express Parcel Network Western Australia
                </div>

                {/* Pricing Information (Restricted to Admin/Leader edit, visible to all) */}
                <div className="mb-6 p-4 rounded-xl border border-emerald-200 bg-emerald-50/30 shadow-sm print:border-slate-300 print:bg-transparent">
                  <Label className="text-xs font-black uppercase text-emerald-800 tracking-wider flex items-center gap-1.5 mb-2">
                    <Coins className="w-4 h-4 text-emerald-600" />
                    Pricing & Rate Agreement Info (Leaders & Site Admins Only Edit)
                  </Label>
                  {isLeader ? (
                    <Textarea
                      placeholder="Enter pricing notes, discount agreements, or custom rate structure details..."
                      value={formData.pricingInfo || ''}
                      onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => handleChange('pricingInfo', e.target.value)}
                      className="text-xs font-medium rounded-xl border-emerald-200 bg-white"
                      rows={3}
                    />
                  ) : (
                    <div className="bg-white border border-emerald-100 rounded-xl p-3 text-xs text-slate-700 whitespace-pre-wrap min-h-[60px] font-medium">
                      {formData.pricingInfo || "No pricing information has been recorded yet."}
                    </div>
                  )}
                </div>

                {/* 1 Column Layout */}
                <div className="grid grid-cols-1 gap-4">
                  
                  {/* Speed Column: Next Available Road & Air */}
                  <div className="space-y-4">
                    <div className="bg-emerald-800 text-white font-black text-xs py-2 px-3 rounded-md text-center shadow-sm uppercase tracking-wider">
                      Next Available Road & Air
                    </div>
                    <div className="bg-emerald-900/10 p-2 rounded-lg space-y-2 border border-emerald-900/5 min-h-[300px]">
                      <span className="text-[10px] font-black text-emerald-800 uppercase tracking-widest block text-center mb-1">Priority Services / Premium</span>
                      {CARRIER_SERVICES.filter(s => s.speed.startsWith('Next Available')).map(s => {
                        const isSelected = formData.selectedServices?.includes(s.id);
                        return (
                          <div key={s.id} className="space-y-1.5">
                            <div
                              onClick={() => handleToggleService(s.id)}
                              className={`p-3 rounded-lg border-2 cursor-pointer transition-all flex flex-col justify-between ${
                                isSelected
                                  ? 'bg-orange-500 border-orange-600 text-white shadow-md scale-[1.02]'
                                  : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700 hover:scale-[1.01]'
                              }`}
                            >
                              <div className="flex justify-between items-start mb-1">
                                <span className="text-xs font-black tracking-tight">{s.name}</span>
                                {isSelected && <Check className="w-3.5 h-3.5 shrink-0" />}
                              </div>
                              <span className="text-[8px] font-bold opacity-80 leading-tight">{s.weight}</span>
                            </div>
                            {isSelected && (
                              <div className="space-y-3 pt-2">
                                <div className="space-y-1" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                                  <Label className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Spend Band Rate</Label>
                                  <Select 
                                    value={(formData.serviceSpendBands || {})[s.id] || ''} 
                                    onValueChange={(val: string) => handleServiceSpendBand(s.id, val)}
                                  >
                                    <SelectTrigger className="h-8 text-xs bg-zinc-50 border-zinc-200">
                                      <SelectValue placeholder="Select Spend Band" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="SB 1">SB 1</SelectItem>
                                      <SelectItem value="SB 2">SB 2</SelectItem>
                                      <SelectItem value="SB 3">SB 3</SelectItem>
                                      <SelectItem value="SB 4">SB 4</SelectItem>
                                      <SelectItem value="SB 5">SB 5</SelectItem>
                                      <SelectItem value="SB 6">SB 6</SelectItem>
                                      <SelectItem value="SB 7">SB 7</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                                <Textarea
                                  placeholder={`Add notes about ${s.name}...`}
                                  value={(formData.serviceNotes || {})[s.id] || ''}
                                  onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => handleServiceNote(s.id, e.target.value)}
                                  onClick={(e: React.MouseEvent) => e.stopPropagation()}
                                  className="text-xs font-medium rounded-lg border-orange-200 bg-orange-50 focus:border-orange-400 min-h-[60px]"
                                  rows={2}
                                />
                                {((formData.serviceNotes || {})[s.id] || '').trim() !== '' && (
                                  <div className="mt-2 pl-3 border-l-2 border-emerald-500 space-y-1">
                                    <Label className="text-[9px] font-black uppercase text-emerald-800 tracking-wider block">Admin Information</Label>
                                    {isLeader ? (
                                      <Textarea
                                        placeholder="Add restricted admin/leader info..."
                                        value={(formData.serviceAdminNotes || {})[s.id] || ''}
                                        onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => handleServiceAdminNote(s.id, e.target.value)}
                                        onClick={(e: React.MouseEvent) => e.stopPropagation()}
                                        className="text-xs font-medium rounded-lg border-slate-200 bg-white focus:border-slate-400 min-h-[50px]"
                                        rows={2}
                                      />
                                    ) : (
                                      <div className="bg-emerald-50/50 border border-emerald-100 rounded-lg p-2 text-[10px] text-emerald-850 font-medium">
                                        {(formData.serviceAdminNotes || {})[s.id] || "No admin notes recorded."}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Speed Column: Tomorrow Road & Air */}
                  <div className="space-y-4">
                    <div className="bg-emerald-800 text-white font-black text-xs py-2 px-3 rounded-md text-center shadow-sm uppercase tracking-wider">
                      Tomorrow Road & Air
                    </div>
                    <div className="bg-emerald-900/10 p-2 rounded-lg space-y-2 border border-emerald-900/5 min-h-[300px]">
                      <span className="text-[10px] font-black text-emerald-800 uppercase tracking-widest block text-center mb-1">Priority Services</span>
                      {CARRIER_SERVICES.filter(s => s.speed.startsWith('Tomorrow')).map(s => {
                        const isSelected = formData.selectedServices?.includes(s.id);
                        const isIntl = s.id === 'tom-intl-air-sea';
                        return (
                          <div key={s.id} className="space-y-1.5">
                            <div
                              onClick={() => handleToggleService(s.id)}
                              className={`p-3 rounded-lg border-2 cursor-pointer transition-all flex flex-col justify-between ${
                                isSelected
                                  ? 'bg-indigo-600 border-indigo-700 text-white shadow-md scale-[1.02]'
                                  : isIntl
                                  ? 'bg-sky-50 hover:bg-sky-100 border-sky-200 text-sky-900'
                                  : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700 hover:scale-[1.01]'
                              }`}
                            >
                              <div className="flex justify-between items-start mb-1">
                                <div className="flex flex-col">
                                  <span className="text-[8px] font-black uppercase opacity-75">{s.tier}</span>
                                  <span className="text-xs font-black tracking-tight">{s.name}</span>
                                </div>
                                {isSelected && <Check className="w-3.5 h-3.5 shrink-0" />}
                              </div>
                              <span className="text-[8px] font-bold opacity-80 leading-tight">{s.weight}</span>
                            </div>
                            {isSelected && (
                              <div className="space-y-3 pt-2">
                                <div className="space-y-1" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                                  <Label className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Spend Band Rate</Label>
                                  <Select 
                                    value={(formData.serviceSpendBands || {})[s.id] || ''} 
                                    onValueChange={(val: string) => handleServiceSpendBand(s.id, val)}
                                  >
                                    <SelectTrigger className="h-8 text-xs bg-zinc-50 border-zinc-200">
                                      <SelectValue placeholder="Select Spend Band" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="SB 1">SB 1</SelectItem>
                                      <SelectItem value="SB 2">SB 2</SelectItem>
                                      <SelectItem value="SB 3">SB 3</SelectItem>
                                      <SelectItem value="SB 4">SB 4</SelectItem>
                                      <SelectItem value="SB 5">SB 5</SelectItem>
                                      <SelectItem value="SB 6">SB 6</SelectItem>
                                      <SelectItem value="SB 7">SB 7</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                                <Textarea
                                  placeholder={`Add notes about ${s.name}...`}
                                  value={(formData.serviceNotes || {})[s.id] || ''}
                                  onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => handleServiceNote(s.id, e.target.value)}
                                  onClick={(e: React.MouseEvent) => e.stopPropagation()}
                                  className="text-xs font-medium rounded-lg border-indigo-200 bg-indigo-50 focus:border-indigo-400 min-h-[60px]"
                                  rows={2}
                                />
                                {((formData.serviceNotes || {})[s.id] || '').trim() !== '' && (
                                  <div className="mt-2 pl-3 border-l-2 border-emerald-500 space-y-1">
                                    <Label className="text-[9px] font-black uppercase text-emerald-800 tracking-wider block">Admin Information</Label>
                                    {isLeader ? (
                                      <Textarea
                                        placeholder="Add restricted admin/leader info..."
                                        value={(formData.serviceAdminNotes || {})[s.id] || ''}
                                        onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => handleServiceAdminNote(s.id, e.target.value)}
                                        onClick={(e: React.MouseEvent) => e.stopPropagation()}
                                        className="text-xs font-medium rounded-lg border-slate-200 bg-white focus:border-slate-400 min-h-[50px]"
                                        rows={2}
                                      />
                                    ) : (
                                      <div className="bg-emerald-50/50 border border-emerald-100 rounded-lg p-2 text-[10px] text-emerald-850 font-medium">
                                        {(formData.serviceAdminNotes || {})[s.id] || "No admin notes recorded."}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Speed Column: 1 - 8 Days Road */}
                  <div className="space-y-4">
                    <div className="bg-amber-500 text-slate-950 font-black text-xs py-2 px-3 rounded-md text-center shadow-sm uppercase tracking-wider">
                      1 - 8 Days Road
                    </div>
                    <div className="bg-amber-500/10 p-2 rounded-lg space-y-2 border border-amber-500/5 min-h-[300px]">
                      <span className="text-[10px] font-black text-amber-800 uppercase tracking-widest block text-center mb-1">IPEC Road Services</span>
                      {CARRIER_SERVICES.filter(s => s.speed.startsWith('1-8 Days')).map(s => {
                        const isSelected = formData.selectedServices?.includes(s.id);
                        return (
                          <div key={s.id} className="space-y-1.5">
                            <div
                              onClick={() => handleToggleService(s.id)}
                              className={`p-3 rounded-lg border-2 cursor-pointer transition-all flex flex-col justify-between ${
                                isSelected
                                  ? 'bg-amber-500 border-amber-600 text-slate-950 shadow-md scale-[1.02]'
                                  : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700 hover:scale-[1.01]'
                              }`}
                            >
                              <div className="flex justify-between items-start mb-1">
                                <div className="flex flex-col">
                                  <span className="text-[8px] font-black uppercase opacity-75">{s.tier}</span>
                                  <span className="text-xs font-black tracking-tight">{s.name}</span>
                                </div>
                                {isSelected && <Check className="w-3.5 h-3.5 shrink-0" />}
                              </div>
                              <span className="text-[8px] font-bold opacity-80 leading-tight">{s.weight}</span>
                            </div>
                            {isSelected && (
                              <div className="space-y-3 pt-2">
                                <div className="space-y-1" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                                  <Label className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Spend Band Rate</Label>
                                  <Select 
                                    value={(formData.serviceSpendBands || {})[s.id] || ''} 
                                    onValueChange={(val: string) => handleServiceSpendBand(s.id, val)}
                                  >
                                    <SelectTrigger className="h-8 text-xs bg-zinc-50 border-zinc-200">
                                      <SelectValue placeholder="Select Spend Band" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="SB 1">SB 1</SelectItem>
                                      <SelectItem value="SB 2">SB 2</SelectItem>
                                      <SelectItem value="SB 3">SB 3</SelectItem>
                                      <SelectItem value="SB 4">SB 4</SelectItem>
                                      <SelectItem value="SB 5">SB 5</SelectItem>
                                      <SelectItem value="SB 6">SB 6</SelectItem>
                                      <SelectItem value="SB 7">SB 7</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                                <Textarea
                                  placeholder={`Add notes about ${s.name}...`}
                                  value={(formData.serviceNotes || {})[s.id] || ''}
                                  onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => handleServiceNote(s.id, e.target.value)}
                                  onClick={(e: React.MouseEvent) => e.stopPropagation()}
                                  className="text-xs font-medium rounded-lg border-amber-200 bg-amber-50 focus:border-amber-400 min-h-[60px]"
                                  rows={2}
                                />
                                {((formData.serviceNotes || {})[s.id] || '').trim() !== '' && (
                                  <div className="mt-2 pl-3 border-l-2 border-emerald-500 space-y-1">
                                    <Label className="text-[9px] font-black uppercase text-emerald-800 tracking-wider block">Admin Information</Label>
                                    {isLeader ? (
                                      <Textarea
                                        placeholder="Add restricted admin/leader info..."
                                        value={(formData.serviceAdminNotes || {})[s.id] || ''}
                                        onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => handleServiceAdminNote(s.id, e.target.value)}
                                        onClick={(e: React.MouseEvent) => e.stopPropagation()}
                                        className="text-xs font-medium rounded-lg border-slate-200 bg-white focus:border-slate-400 min-h-[50px]"
                                        rows={2}
                                      />
                                    ) : (
                                      <div className="bg-emerald-50/50 border border-emerald-100 rounded-lg p-2 text-[10px] text-emerald-850 font-medium">
                                        {(formData.serviceAdminNotes || {})[s.id] || "No admin notes recorded."}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Speed Column: Courier */}
                  <div className="space-y-4">
                    <div className="bg-zinc-700 text-white font-black text-xs py-2 px-3 rounded-md text-center shadow-sm uppercase tracking-wider">
                      Courier Network
                    </div>
                    <div className="bg-zinc-700/10 p-2 rounded-lg space-y-2 border border-zinc-700/5 min-h-[300px]">
                      <span className="text-[10px] font-black text-zinc-700 uppercase tracking-widest block text-center mb-1">TGE Courier</span>
                      {CARRIER_SERVICES.filter(s => s.speed.startsWith('Courier')).map(s => {
                        const isSelected = formData.selectedServices?.includes(s.id);
                        return (
                          <div key={s.id} className="space-y-1.5">
                            <div
                              onClick={() => handleToggleService(s.id)}
                              className={`p-3 rounded-lg border-2 cursor-pointer transition-all flex flex-col justify-between ${
                                isSelected
                                  ? 'bg-zinc-700 border-zinc-800 text-white shadow-md scale-[1.02]'
                                  : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700 hover:scale-[1.01]'
                              }`}
                            >
                              <div className="flex justify-between items-start mb-1">
                                <div className="flex flex-col">
                                  <span className="text-[8px] font-black uppercase opacity-75">{s.tier}</span>
                                  <span className="text-xs font-black tracking-tight">{s.name}</span>
                                </div>
                                {isSelected && <Check className="w-3.5 h-3.5 shrink-0" />}
                              </div>
                              <span className="text-[8px] font-bold opacity-80 leading-tight">{s.weight}</span>
                            </div>
                            {isSelected && (
                              <div className="space-y-3 pt-2">
                                <div className="space-y-1" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                                  <Label className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Spend Band Rate</Label>
                                  <Select 
                                    value={(formData.serviceSpendBands || {})[s.id] || ''} 
                                    onValueChange={(val: string) => handleServiceSpendBand(s.id, val)}
                                  >
                                    <SelectTrigger className="h-8 text-xs bg-zinc-50 border-zinc-200">
                                      <SelectValue placeholder="Select Spend Band" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="SB 1">SB 1</SelectItem>
                                      <SelectItem value="SB 2">SB 2</SelectItem>
                                      <SelectItem value="SB 3">SB 3</SelectItem>
                                      <SelectItem value="SB 4">SB 4</SelectItem>
                                      <SelectItem value="SB 5">SB 5</SelectItem>
                                      <SelectItem value="SB 6">SB 6</SelectItem>
                                      <SelectItem value="SB 7">SB 7</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                                <Textarea
                                  placeholder={`Add notes about ${s.name}...`}
                                  value={(formData.serviceNotes || {})[s.id] || ''}
                                  onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => handleServiceNote(s.id, e.target.value)}
                                  onClick={(e: React.MouseEvent) => e.stopPropagation()}
                                  className="text-xs font-medium rounded-lg border-zinc-200 bg-zinc-50 focus:border-zinc-400 min-h-[60px]"
                                  rows={2}
                                />
                                {((formData.serviceNotes || {})[s.id] || '').trim() !== '' && (
                                  <div className="mt-2 pl-3 border-l-2 border-emerald-500 space-y-1">
                                    <Label className="text-[9px] font-black uppercase text-emerald-800 tracking-wider block">Admin Information</Label>
                                    {isLeader ? (
                                      <Textarea
                                        placeholder="Add restricted admin/leader info..."
                                        value={(formData.serviceAdminNotes || {})[s.id] || ''}
                                        onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => handleServiceAdminNote(s.id, e.target.value)}
                                        onClick={(e: React.MouseEvent) => e.stopPropagation()}
                                        className="text-xs font-medium rounded-lg border-slate-200 bg-white focus:border-slate-400 min-h-[50px]"
                                        rows={2}
                                      />
                                    ) : (
                                      <div className="bg-emerald-50/50 border border-emerald-100 rounded-lg p-2 text-[10px] text-emerald-850 font-medium">
                                        {(formData.serviceAdminNotes || {})[s.id] || "No admin notes recorded."}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                </div>



              </div>

              {/* Selected Services Print Version (Clean Static List for PDF) */}
              <div className="hidden print:block pt-1 space-y-3">
                <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider mb-2">Required Carrier Services</h4>
                {formData.selectedServices && formData.selectedServices.length > 0 ? (
                  <div className="grid grid-cols-2 gap-3">
                    {formData.selectedServices.map(sid => {
                      const s = CARRIER_SERVICES.find(srv => srv.id === sid);
                      if (!s) return null;
                      const note = (formData.serviceNotes || {})[sid];
                      const adminNote = (formData.serviceAdminNotes || {})[sid];
                      return (
                        <div key={sid} className="border border-slate-300 p-2.5 rounded-lg text-xs bg-slate-50/30">
                          <div className="flex justify-between items-start">
                            <span className="font-black text-slate-900">{s.name} ({s.speed})</span>
                            <span className="text-slate-600 font-bold text-[10px]">{s.weight}</span>
                          </div>
                          {note && <p className="mt-1.5 text-slate-700 font-medium whitespace-pre-wrap text-[11px] leading-snug">{note}</p>}
                          {adminNote && (
                            <div className="mt-2 pt-1.5 border-t border-slate-200">
                              <span className="text-[8px] font-black uppercase text-emerald-800 block">Admin Information</span>
                              <p className="text-slate-700 font-medium whitespace-pre-wrap text-[10px] leading-snug">{adminNote}</p>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs font-medium text-slate-400 italic">No carrier services selected</p>
                )}

                {formData.pricingInfo && (
                  <div className="mt-3 border-t border-slate-200 pt-2">
                    <h5 className="text-[11px] font-black text-slate-800 uppercase tracking-wider mb-1">Pricing & Rate Agreement Info</h5>
                    <p className="text-xs font-medium text-slate-700 whitespace-pre-wrap">{formData.pricingInfo}</p>
                  </div>
                )}
              </div>

            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-sm print:shadow-none print:border-none print:mt-4">
            <CardHeader className="bg-slate-50/50 border-b border-slate-100 print:bg-transparent print:border-b-2 print:border-slate-800 print:px-0 print:py-2">
              <CardTitle className="text-lg font-black text-slate-800 flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-primary print:text-slate-900" />
                4. Expectations & Pain Points
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-6 print:px-0 print:py-2 print:space-y-3">
              <div className="space-y-2">
                <Label className="font-bold text-slate-700">What is your "Perfect World Situation"?</Label>
                <Textarea value={formData.perfectWorld} onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => handleChange('perfectWorld', e.target.value)} className="print:border-none print:resize-none print:p-0 print:shadow-none" />
              </div>

              <div className="space-y-2">
                <Label className="font-bold text-slate-700">Delivery Expectation</Label>
                <Input value={formData.deliveryExpectation} onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => handleChange('deliveryExpectation', e.target.value)} className="print:border-0 print:border-b print:rounded-none print:px-0 print:shadow-none" />
              </div>

              <div className="space-y-2">
                <Label className="font-bold text-slate-700">Do wholesale suppliers charge for delivery?</Label>
                <Input placeholder="Yes/No/Details" value={formData.wholesaleCharges} onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => handleChange('wholesaleCharges', e.target.value)} className="print:border-0 print:border-b print:rounded-none print:px-0 print:shadow-none" />
              </div>
            </CardContent>
          </Card>

          {/* Down Trading Section - visible only if Current Customer */}
          {formData.currentCustomer && (
            <Card className="border-slate-200 shadow-sm print:shadow-none print:border-none print:mt-4">
              <CardHeader className="bg-slate-50/50 border-b border-slate-100 print:bg-transparent print:border-b-2 print:border-slate-800 print:px-0 print:py-2">
                <CardTitle className="text-lg font-black text-slate-800 flex items-center gap-2">
                  5. Down Trading
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-6 print:px-0 print:py-2 print:space-y-3">
                <div className="space-y-2">
                  <Label className="font-bold text-slate-700">Reason Down Trading (Notes)</Label>
                  <Textarea
                    value={formData.reasonDownTrading}
                    onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => handleChange('reasonDownTrading', e.target.value)}
                    placeholder="Enter reason for down trading"
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label className="font-bold text-slate-700">Last Face to Face Meeting (Date)</Label>
                    <Input
                      type="date"
                      value={formData.lastFaceToFaceMeeting}
                      onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => handleChange('lastFaceToFaceMeeting', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="font-bold text-slate-700">Next Face to Face Meeting (Date)</Label>
                    <Input
                      type="date"
                      value={formData.nextFaceToFaceMeeting}
                      onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => handleChange('nextFaceToFaceMeeting', e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="font-bold text-slate-700">What Could we do? (Notes)</Label>
                  <Textarea
                    value={formData.whatCouldWeDo}
                    onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => handleChange('whatCouldWeDo', e.target.value)}
                    placeholder="Enter suggestions"
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Archived Notes Section */}
          <Card className="border-slate-200 shadow-sm print:shadow-none print:border-none print:mt-4">
            <CardHeader className="bg-slate-50/50 border-b border-slate-100 print:bg-transparent print:border-b-2 print:border-slate-800 print:px-0 print:py-2">
              <CardTitle className="text-lg font-black text-slate-800 flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary print:text-slate-900" />
                7. Archived Notes
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4 print:px-0">
              {formData.archivedNotes && formData.archivedNotes.length > 1 ? (
                <div className="space-y-3">
                  {formData.archivedNotes.slice(0, -1).reverse().map((noteObj, idx) => (
                    <div key={idx} className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-1.5 break-words">
                      <div className="flex justify-between items-center text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                        <span>By {noteObj.createdByName}</span>
                        <span>
                          {noteObj.createdAt ? (
                            noteObj.createdAt.toDate 
                              ? format(noteObj.createdAt.toDate(), 'MMM d, yyyy h:mm a') 
                              : format(new Date(noteObj.createdAt), 'MMM d, yyyy h:mm a')
                          ) : 'Recently'}
                        </span>
                      </div>
                      <p className="text-xs font-semibold text-slate-800 leading-relaxed whitespace-pre-wrap">
                        {noteObj.note}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400 italic font-semibold">Older historical notes will appear here once new updates are saved.</p>
              )}
            </CardContent>
          </Card>

          {/* Bottom Save Button */}
          {!viewOnly && (
            <div className="print:hidden flex flex-col sm:flex-row justify-between items-center gap-4 bg-white p-4 rounded-xl shadow-sm border border-slate-200">
              <p className="text-xs font-medium text-slate-500 text-center sm:text-left">Don't forget to save your changes before leaving this page.</p>
              <div className="flex flex-wrap items-center justify-center sm:justify-end gap-2 w-full sm:w-auto">
                {docId && (
                  <Button type="button" variant="outline" onClick={() => {
                    window.dispatchEvent(new CustomEvent('switch-view', {
                      detail: {
                        view: 'CALL_PLANNING',
                        params: { type: 'fact-finding', data: { ...formData, docId } }
                      }
                    }));
                  }} className="flex-1 sm:flex-none gap-2 font-bold bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100">
                    Prepare Call Plan
                  </Button>
                )}
                <Button 
                  variant={formData.isArchived ? "secondary" : "outline"} 
                  onClick={() => setFormData(prev => ({ ...prev, isArchived: !prev.isArchived }))} 
                  className="flex-1 sm:flex-none gap-2 font-bold text-slate-700 border-slate-300"
                >
                  {formData.isArchived ? "Unarchive" : "Archive"}
                </Button>
                <Button variant="outline" onClick={handleExportPDF} className="flex-1 sm:flex-none gap-2 font-bold text-slate-700">
                  <Printer className="w-4 h-4" />
                  Export PDF
                </Button>
                <Button variant="outline" onClick={handleExportReview} className="flex-1 sm:flex-none gap-2 font-bold text-indigo-700 bg-indigo-50 border-indigo-200 hover:bg-indigo-100">
                  <Printer className="w-4 h-4" />
                  Export Review
                </Button>
                <Button onClick={() => handleSave(false)} disabled={isSaving || !canEdit} variant="outline" className="flex-1 sm:flex-none gap-2 font-bold text-slate-700 border-slate-300">
                  {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Save Document
                </Button>
                <Button onClick={() => handleSave(true)} disabled={isSaving || !canEdit} className="flex-1 sm:flex-none gap-2 font-bold shadow-md bg-emerald-600 hover:bg-emerald-700 text-white border-none">
                  {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  Save & Close
                </Button>
              </div>
            </div>
          )}

        </div>
      </div>

      </div>



        {/* White Space Form Dialog */}
        <Dialog open={isWsFormOpen} onOpenChange={setIsWsFormOpen}>
          <DialogContent className="max-w-6xl max-h-[92vh] overflow-y-auto p-6 bg-slate-50/50">
            <DialogHeader className="mb-4">
              <DialogTitle className="text-xl font-black uppercase text-slate-800 flex items-center gap-2">
                <LayoutGrid className="w-5 h-5 text-amber-600" />
                White Space Analysis — {formData.companyName || 'Lead Diagnostic'}
              </DialogTitle>
              <DialogDescription className="text-xs">
                Complete and save the strategic service expansion matrix for this account.
              </DialogDescription>
            </DialogHeader>

            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <WhitespaceAnalysis
                userId={formData.userId || user?.uid || profile?.uid || ''}
                initialAccountName={formData.companyName || ''}
                onSaved={() => {
                  setIsWsFormOpen(false);
                  toast({ title: "White Space Completed", description: "White space diagnostic saved for this account." });
                }}
              />
            </div>
          </DialogContent>
        </Dialog>

        {/* View WS Modal (Editable & Printable) */}
        <Dialog open={isViewWsOpen} onOpenChange={setIsViewWsOpen}>
          <DialogContent className="max-w-5xl max-h-[92vh] p-0 flex flex-col overflow-hidden bg-white shadow-2xl border border-slate-200 rounded-2xl">
            <DialogHeader className="p-6 border-b border-slate-100 flex flex-row items-center justify-between shrink-0">
              <div>
                <DialogTitle className="text-xl font-black uppercase tracking-tight text-slate-800 flex items-center gap-2">
                  <LayoutGrid className="w-5 h-5 text-cyan-600" />
                  White Space Diagnostic
                </DialogTitle>
                <DialogDescription className="font-bold text-xs uppercase text-slate-400 mt-1">
                  Account: {formData.companyName || 'Document'}
                </DialogDescription>
              </div>
              <div className="flex items-center gap-2 pr-6">
                {matchingWhitespaceDoc && (
                  <Button
                    onClick={async () => {
                      if (!wsPrintContainerRef.current) return;
                      setIsExportingWsPdf(true);
                      try {
                        const filename = `${(formData.companyName || 'Account').replace(/\s+/g, '_')}_whitespace_export.pdf`;
                        await exportElementToPdf(wsPrintContainerRef.current, filename);
                        toast({ title: "PDF Exported", description: "Whitespace PDF generated successfully." });
                      } catch (err: any) {
                        toast({ variant: "destructive", title: "PDF Export Failed", description: err.message });
                      } finally {
                        setIsExportingWsPdf(false);
                      }
                    }}
                    disabled={isExportingWsPdf}
                    size="sm"
                    className="bg-cyan-600 hover:bg-cyan-700 text-white font-bold gap-2 text-xs shadow-md border-none"
                  >
                    {isExportingWsPdf ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Printer className="w-3.5 h-3.5" />}
                    Export PDF
                  </Button>
                )}
              </div>
            </DialogHeader>

            <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50">
              {matchingWhitespaceDoc ? (
                <div className="space-y-6">
                  {/* Embedded Editable Whitespace Component */}
                  <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                    <WhitespaceAnalysis
                      userId={matchingWhitespaceDoc.userId || formData.userId || user?.uid || profile?.uid || ''}
                      initialAccountName={matchingWhitespaceDoc.accountName || formData.companyName || ''}
                      initialDocId={matchingWhitespaceDoc.id}
                      initialConfigs={matchingWhitespaceDoc.configs}
                      onSaved={() => {
                        toast({ title: "White Space Updated", description: "Changes have been successfully saved." });
                      }}
                    />
                  </div>

                  {/* Printable Ref Container for Clean PDF Generation */}
                  <div className="hidden">
                    <div ref={wsPrintContainerRef} className="bg-white p-6">
                      <WhitespaceViewer whitespaceDoc={matchingWhitespaceDoc} />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-16 bg-white rounded-2xl border-2 border-dashed border-slate-200 p-8 space-y-4">
                  <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
                    <LayoutGrid className="w-8 h-8" />
                  </div>
                  <div>
                    <h3 className="text-base font-black uppercase text-slate-700">No White Space Found</h3>
                    <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto font-medium">
                      No White Space analysis has been completed yet for <span className="font-bold text-slate-700">"{formData.companyName || 'this account'}"</span>.
                    </p>
                  </div>
                  <Button
                    onClick={() => {
                      setIsViewWsOpen(false);
                      setIsWsFormOpen(true);
                    }}
                    className="bg-amber-600 hover:bg-amber-700 text-white font-black text-xs uppercase h-10 px-6 gap-2 shadow-md"
                  >
                    <LayoutGrid className="w-4 h-4" />
                    Complete White Space Now
                  </Button>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </ViewOnlyContext.Provider>
  );
});
