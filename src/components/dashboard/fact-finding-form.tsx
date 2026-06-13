"use client";

import { useState, useEffect } from 'react';
import { useFirestore } from '@/firebase';
import { collection, addDoc, updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '@/contexts/auth-context';
import { FactFindingDoc } from '@/types/crm';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { ArrowLeft, Save, Printer, Loader2, FileText, CheckCircle2, Building, Package, Map, Truck, Info, Check } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

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
  { id: 'tom-road-express', name: 'Road Express', speed: 'Tomorrow Road & Air', provider: 'Priority Services', tier: 'B2C', weight: 'Upto 22kg or 120cm Total', freight: 'Satchels - Parcels - Cartons - Skids - Pallets', color: 'bg-emerald-800 border-emerald-900 text-white' },

  // 1-8 Days
  { id: 'road-express-1-8', name: 'Road Express', speed: '1-8 Days Road', provider: 'IPEC Road Services', tier: 'B2B', weight: 'All Weights', freight: 'Satchels - Parcels - Cartons - Skids - Pallets', color: 'bg-amber-500 border-amber-600 text-slate-900' },

  // Courier
  { id: 'courier-network', name: 'Courier Network', speed: 'Courier', provider: 'TGE Courier', tier: 'B2B', weight: 'All Weights', freight: 'Satchels - Parcels - Cartons - Skids - Pallets', color: 'bg-zinc-600 border-zinc-700 text-white' }
];

const AUSTRALIA_STATES = [
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
}

export function FactFindingForm({ docId, existingDoc, onBack }: Props) {
  const db = useFirestore();
  const { user } = useAuth();
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);

  const [formData, setFormData] = useState<Partial<FactFindingDoc>>({
    companyName: '',
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
    serviceNotes: {}
  });

  useEffect(() => {
    if (existingDoc) {
      setFormData({
        ...existingDoc,
        selectedStatesFrom: existingDoc.selectedStatesFrom || (existingDoc.mapDirection !== 'TO' ? existingDoc.selectedStates || [] : []),
        selectedStatesTo: existingDoc.selectedStatesTo || (existingDoc.mapDirection === 'TO' ? existingDoc.selectedStates || [] : []),
        mapNotesFrom: existingDoc.mapNotesFrom || '',
        mapNotesTo: existingDoc.mapNotesTo || '',
        serviceNotes: existingDoc.serviceNotes || {}
      });
    }
  }, [existingDoc]);

  const handleChange = (field: keyof FactFindingDoc, value: any) => {
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
    setFormData(prev => ({
      ...prev,
      serviceNotes: { ...(prev.serviceNotes || {}), [serviceId]: value }
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

  const handleSave = async () => {
    if (!db || !user) return;
    
    if (!formData.companyName) {
      toast({ title: "Validation Error", description: "Company Name is required", variant: "destructive" });
      return;
    }

    setIsSaving(true);
    try {
      if (docId) {
        await updateDoc(doc(db, 'factFindingDocs', docId), {
          ...formData,
        });
        toast({ title: "Updated", description: "Fact Finding document updated successfully." });
      } else {
        await addDoc(collection(db, 'factFindingDocs'), {
          ...formData,
          userId: user.uid,
          createdAt: serverTimestamp()
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

  const handleExportPDF = () => {
    window.print();
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-12">
      {/* Header - Hidden on Print */}
      <div className="print:hidden flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 rounded-xl shadow-sm border border-slate-200">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack} className="rounded-full">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h2 className="text-xl font-black text-slate-800">
              {docId ? 'Edit Fact Finding' : 'New Fact Finding'}
            </h2>
            <p className="text-xs font-medium text-slate-500">
              {formData.companyName || 'Untitled Document'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          {docId && (
            <Button type="button" variant="outline" onClick={() => {
              window.dispatchEvent(new CustomEvent('switch-view', {
                detail: {
                  view: 'CALL_PLANNING',
                  params: { type: 'fact-finding', data: formData }
                }
              }));
            }} className="flex-1 sm:flex-none gap-2 font-bold bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100">
              Prepare Call Plan
            </Button>
          )}
          <Button variant="outline" onClick={handleExportPDF} className="flex-1 sm:flex-none gap-2 font-bold text-slate-700">
            <Printer className="w-4 h-4" />
            Export PDF
          </Button>
          <Button onClick={handleSave} disabled={isSaving} className="flex-1 sm:flex-none gap-2 font-bold shadow-md">
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Document
          </Button>
        </div>
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
          
          <Card className="border-slate-200 shadow-sm print:shadow-none print:border-none print:break-inside-avoid">
            <CardHeader className="bg-slate-50/50 border-b border-slate-100 print:bg-transparent print:border-slate-300 print:px-0">
              <CardTitle className="text-lg font-black text-slate-800 flex items-center gap-2">
                <Building className="w-5 h-5 text-primary print:text-slate-900" />
                1. General Business Profile
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-6 print:px-0">
              <div className="space-y-2">
                <Label className="font-bold text-slate-700">Company Name *</Label>
                <Input 
                   value={formData.companyName} 
                  onChange={e => handleChange('companyName', e.target.value)} 
                  placeholder="Enter company name"
                  className="font-medium print:border-0 print:border-b print:rounded-none print:px-0 print:text-lg print:shadow-none"
                />
              </div>

              <div className="space-y-2">
                <Label className="font-bold text-slate-700">Please tell me about your business?</Label>
                <p className="text-xs text-slate-500 font-medium mb-2 print:hidden">Who, What, How, Why, When, Website URL, Shipping Platform</p>
                <Textarea 
                  value={formData.businessDetails} 
                  onChange={e => handleChange('businessDetails', e.target.value)} 
                  placeholder="Business details..."
                  className="min-h-[120px] font-medium print:border-none print:resize-none print:p-0 print:shadow-none"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label className="font-bold text-slate-700">Currently Using (Provider)</Label>
                  <Input value={formData.currentlyUsing} onChange={e => handleChange('currentlyUsing', e.target.value)} className="print:border-0 print:border-b print:rounded-none print:px-0 print:shadow-none" />
                </div>
                <div className="space-y-2">
                  <Label className="font-bold text-slate-700">Key Decision Maker Name</Label>
                  <Input value={formData.keyDecisionMaker || ''} onChange={e => handleChange('keyDecisionMaker', e.target.value)} className="print:border-0 print:border-b print:rounded-none print:px-0 print:shadow-none" placeholder="e.g. John Doe (Director)" />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label className="font-bold text-slate-700">Incumbent Competitor</Label>
                  <Input value={formData.incumbentCompetitor || ''} onChange={e => handleChange('incumbentCompetitor', e.target.value)} className="print:border-0 print:border-b print:rounded-none print:px-0 print:shadow-none" placeholder="Incumbent provider details..." />
                </div>
                <div className="space-y-2">
                  <Label className="font-bold text-slate-700">Contract End Date / Renewal Timeline</Label>
                  <Input value={formData.contractEndDate || ''} onChange={e => handleChange('contractEndDate', e.target.value)} className="print:border-0 print:border-b print:rounded-none print:px-0 print:shadow-none" placeholder="e.g. Dec 2026 or 2026-12-31" />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label className="font-bold text-slate-700">Business Model</Label>
                  <div className="print:hidden">
                    <Select value={formData.businessModel} onValueChange={v => handleChange('businessModel', v)}>
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
                    <Checkbox id="securityConcern" checked={formData.securityConcern} onCheckedChange={(c) => handleChange('securityConcern', !!c)} className="print:border-slate-500" />
                    <Label htmlFor="securityConcern" className="font-bold text-xs text-slate-700 cursor-pointer">Freight security is a concern</Label>
                  </div>
                  <div className="flex items-center space-x-3 bg-slate-50/50 p-3 rounded-xl border border-slate-100">
                    <Checkbox id="highValueFreight" checked={formData.highValueFreight} onCheckedChange={(c) => handleChange('highValueFreight', !!c)} className="print:border-slate-500" />
                    <Label htmlFor="highValueFreight" className="font-bold text-xs text-slate-700 cursor-pointer">Sends High Value freight</Label>
                  </div>
                  <div className="flex items-center space-x-3 bg-slate-50/50 p-3 rounded-xl border border-slate-100">
                    <Checkbox id="dangerousGoods" checked={formData.dangerousGoods} onCheckedChange={(c) => handleChange('dangerousGoods', !!c)} className="print:border-slate-500" />
                    <Label htmlFor="dangerousGoods" className="font-bold text-xs text-slate-700 cursor-pointer">Sends Dangerous Goods</Label>
                  </div>
                  <div className="flex items-center space-x-3 bg-slate-50/50 p-3 rounded-xl border border-slate-100">
                    <Checkbox id="internationalFreight" checked={formData.internationalFreight} onCheckedChange={(c) => handleChange('internationalFreight', !!c)} className="print:border-slate-500" />
                    <Label htmlFor="internationalFreight" className="font-bold text-xs text-slate-700 cursor-pointer">Uses International Freight</Label>
                  </div>
                </div>

                {formData.internationalFreight && (
                  <div className="mt-4 p-4 bg-indigo-50/30 rounded-xl border border-indigo-100/50 grid grid-cols-1 md:grid-cols-2 gap-4 print:p-0 print:bg-transparent print:border-none print:mt-2">
                    <div className="space-y-2">
                      <Label className="font-bold text-xs text-indigo-900 print:text-slate-700">International Type (Sea/Air)</Label>
                      <Input value={formData.internationalType} onChange={e => handleChange('internationalType', e.target.value)} className="bg-white print:border-0 print:border-b print:rounded-none print:px-0 print:shadow-none print:bg-transparent" />
                    </div>
                    <div className="space-y-2">
                      <Label className="font-bold text-xs text-indigo-900 print:text-slate-700">Intl Size (Parcels/Cartons/Pallets/Containers)</Label>
                      <Input value={formData.internationalSize} onChange={e => handleChange('internationalSize', e.target.value)} className="bg-white print:border-0 print:border-b print:rounded-none print:px-0 print:shadow-none print:bg-transparent" />
                    </div>
                  </div>
                )}
              </div>

              <div className="border-t border-slate-100 pt-6 mt-6">
                <h3 className="text-sm font-black uppercase text-indigo-900 tracking-wider mb-4">Advanced Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2 md:col-span-2">
                    <Label className="font-bold text-slate-700">Primary Pain Points</Label>
                    <Textarea value={formData.painPoints} onChange={e => handleChange('painPoints', e.target.value)} className="min-h-[80px] print:border-none print:resize-none print:p-0 print:shadow-none" />
                  </div>
                  <div className="space-y-2">
                    <Label className="font-bold text-slate-700">Special Handling Requirements</Label>
                    <Input value={formData.specialHandling} onChange={e => handleChange('specialHandling', e.target.value)} className="print:border-0 print:border-b print:rounded-none print:px-0 print:shadow-none" />
                  </div>
                  <div className="space-y-2">
                    <Label className="font-bold text-slate-700">Loading Dock Capabilities</Label>
                    <Input value={formData.loadingDock} onChange={e => handleChange('loadingDock', e.target.value)} className="print:border-0 print:border-b print:rounded-none print:px-0 print:shadow-none" />
                  </div>
                  <div className="space-y-2">
                    <Label className="font-bold text-slate-700">Seasonal Fluctuations</Label>
                    <Input value={formData.seasonalFluctuations} onChange={e => handleChange('seasonalFluctuations', e.target.value)} className="print:border-0 print:border-b print:rounded-none print:px-0 print:shadow-none" />
                  </div>
                  <div className="space-y-2">
                    <Label className="font-bold text-slate-700">Trading Terms Expected</Label>
                    <Input value={formData.tradingTerms} onChange={e => handleChange('tradingTerms', e.target.value)} className="print:border-0 print:border-b print:rounded-none print:px-0 print:shadow-none" />
                  </div>
                </div>
              </div>

            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-sm print:shadow-none print:border-none print:break-inside-avoid print:mt-8">
            <CardHeader className="bg-slate-50/50 border-b border-slate-100 print:bg-transparent print:border-slate-300 print:px-0">
              <CardTitle className="text-lg font-black text-slate-800 flex items-center gap-2">
                <Package className="w-5 h-5 text-primary print:text-slate-900" />
                2. Domestic Freight Profile & Shipping Map
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-6 print:px-0">
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <Label className="font-bold text-slate-700">Type of Freight</Label>
                  <Input placeholder="Sameday, Priority, Road..." value={formData.freightType} onChange={e => handleChange('freightType', e.target.value)} className="print:border-0 print:border-b print:rounded-none print:px-0 print:shadow-none" />
                </div>
                <div className="space-y-2">
                  <Label className="font-bold text-slate-700">Size of Freight</Label>
                  <Input placeholder="Dimensions/Weight" value={formData.freightSize} onChange={e => handleChange('freightSize', e.target.value)} className="print:border-0 print:border-b print:rounded-none print:px-0 print:shadow-none" />
                </div>
                <div className="space-y-2">
                  <Label className="font-bold text-slate-700">Weekly Amount</Label>
                  <Input placeholder="e.g. $5,000 or 50 items" value={formData.weeklyAmount} onChange={e => handleChange('weeklyAmount', e.target.value)} className="print:border-0 print:border-b print:rounded-none print:px-0 print:shadow-none" />
                </div>
              </div>

              {/* Map & Destination Lanes Visuals */}
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="font-bold text-slate-700">% Staying in WA?</Label>
                      <Input type="number" placeholder="%" value={formData.waPercentage} onChange={e => handleChange('waPercentage', e.target.value)} className="print:border-0 print:border-b print:rounded-none print:px-0 print:shadow-none" />
                    </div>
                    <div className="space-y-2">
                      <Label className="font-bold text-slate-700">% Overnight?</Label>
                      <Input type="number" placeholder="%" value={formData.overnightPercentage} onChange={e => handleChange('overnightPercentage', e.target.value)} className="print:border-0 print:border-b print:rounded-none print:px-0 print:shadow-none" />
                    </div>
                  </div>
                  <div className="flex items-center space-x-3 bg-slate-50 p-3 rounded-lg border border-slate-100 print:bg-transparent print:border-none print:p-0 justify-center">
                    <Checkbox 
                      id="hasData" 
                      checked={formData.hasData} 
                      onCheckedChange={(c) => handleChange('hasData', !!c)} 
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
                        onChange={e => handleChange('mapNotesFrom', e.target.value)}
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
                        onChange={e => handleChange('mapNotesTo', e.target.value)}
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
          <Card className="border-slate-200 shadow-sm print:shadow-none print:border-none print:break-inside-avoid print:mt-8">
            <CardHeader className="bg-slate-50/50 border-b border-slate-100 print:bg-transparent print:border-slate-300 print:px-0">
              <CardTitle className="text-lg font-black text-slate-800 flex items-center gap-2">
                <Truck className="w-5 h-5 text-primary print:text-slate-900" />
                3. TGE Parcel Network Western Australia Services
              </CardTitle>
              <CardDescription className="print:hidden">
                Click on the services that the client requires. Highlighted services will save to the document.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6 space-y-6 print:px-0">
              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-inner bg-slate-50/20 p-4">
                
                {/* Visual Header */}
                <div className="bg-emerald-950 text-white py-3 px-4 text-center rounded-lg font-black text-lg mb-6 shadow-sm flex items-center justify-center gap-2 print:border print:border-slate-300 print:text-black print:bg-transparent">
                  <Truck className="w-5 h-5" />
                  Team Global Express Parcel Network Western Australia
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
                              <Textarea
                                placeholder={`Add notes about ${s.name}...`}
                                value={(formData.serviceNotes || {})[s.id] || ''}
                                onChange={e => handleServiceNote(s.id, e.target.value)}
                                onClick={e => e.stopPropagation()}
                                className="text-xs font-medium rounded-lg border-orange-200 bg-orange-50 focus:border-orange-400 min-h-[60px]"
                                rows={2}
                              />
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
                              <Textarea
                                placeholder={`Add notes about ${s.name}...`}
                                value={(formData.serviceNotes || {})[s.id] || ''}
                                onChange={e => handleServiceNote(s.id, e.target.value)}
                                onClick={e => e.stopPropagation()}
                                className="text-xs font-medium rounded-lg border-indigo-200 bg-indigo-50 focus:border-indigo-400 min-h-[60px]"
                                rows={2}
                              />
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
                              <Textarea
                                placeholder={`Add notes about ${s.name}...`}
                                value={(formData.serviceNotes || {})[s.id] || ''}
                                onChange={e => handleServiceNote(s.id, e.target.value)}
                                onClick={e => e.stopPropagation()}
                                className="text-xs font-medium rounded-lg border-amber-200 bg-amber-50 focus:border-amber-400 min-h-[60px]"
                                rows={2}
                              />
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
                              <Textarea
                                placeholder={`Add notes about ${s.name}...`}
                                value={(formData.serviceNotes || {})[s.id] || ''}
                                onChange={e => handleServiceNote(s.id, e.target.value)}
                                onClick={e => e.stopPropagation()}
                                className="text-xs font-medium rounded-lg border-zinc-200 bg-zinc-50 focus:border-zinc-400 min-h-[60px]"
                                rows={2}
                              />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                </div>

              </div>

              {/* Selected Services Print Version (Static List for PDF) */}
              <div className="hidden print:block border-t border-slate-300 pt-4">
                <h4 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-2">Required Carrier Services</h4>
                {formData.selectedServices && formData.selectedServices.length > 0 ? (
                  <div className="grid grid-cols-2 gap-2">
                    {formData.selectedServices.map(sid => {
                      const s = CARRIER_SERVICES.find(srv => srv.id === sid);
                      if (!s) return null;
                      const note = (formData.serviceNotes || {})[sid];
                      return (
                        <div key={sid} className="border border-slate-300 p-2 rounded text-xs">
                          <div className="flex justify-between">
                            <span className="font-bold">{s.name} ({s.speed})</span>
                            <span className="text-slate-500 font-medium">{s.weight}</span>
                          </div>
                          {note && <p className="mt-1 text-slate-600 font-medium whitespace-pre-wrap">{note}</p>}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs font-medium text-slate-400 italic">No carrier services selected</p>
                )}
              </div>

            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-sm print:shadow-none print:border-none print:break-inside-avoid print:mt-8">
            <CardHeader className="bg-slate-50/50 border-b border-slate-100 print:bg-transparent print:border-slate-300 print:px-0">
              <CardTitle className="text-lg font-black text-slate-800 flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-primary print:text-slate-900" />
                4. Expectations & Pain Points
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-6 print:px-0">
              <div className="space-y-2">
                <Label className="font-bold text-slate-700">What is your "Perfect World Situation"?</Label>
                <Textarea value={formData.perfectWorld} onChange={e => handleChange('perfectWorld', e.target.value)} className="print:border-none print:resize-none print:p-0 print:shadow-none" />
              </div>

              <div className="space-y-2">
                <Label className="font-bold text-slate-700">Delivery Expectation</Label>
                <Input value={formData.deliveryExpectation} onChange={e => handleChange('deliveryExpectation', e.target.value)} className="print:border-0 print:border-b print:rounded-none print:px-0 print:shadow-none" />
              </div>

              <div className="space-y-2">
                <Label className="font-bold text-slate-700">Do wholesale suppliers charge for delivery?</Label>
                <Input placeholder="Yes/No/Details" value={formData.wholesaleCharges} onChange={e => handleChange('wholesaleCharges', e.target.value)} className="print:border-0 print:border-b print:rounded-none print:px-0 print:shadow-none" />
              </div>
            </CardContent>
          </Card>

          {/* Bottom Save Button */}
          <div className="print:hidden flex flex-col sm:flex-row justify-between items-center gap-4 bg-white p-4 rounded-xl shadow-sm border border-slate-200">
            <p className="text-xs font-medium text-slate-500">Don't forget to save your changes before leaving this page.</p>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              {docId && (
                <Button type="button" variant="outline" onClick={() => {
                  window.dispatchEvent(new CustomEvent('switch-view', {
                    detail: {
                      view: 'CALL_PLANNING',
                      params: { type: 'fact-finding', data: formData }
                    }
                  }));
                }} className="flex-1 sm:flex-none gap-2 font-bold bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100">
                  Prepare Call Plan
                </Button>
              )}
              <Button variant="outline" onClick={handleExportPDF} className="flex-1 sm:flex-none gap-2 font-bold text-slate-700">
                <Printer className="w-4 h-4" />
                Export PDF
              </Button>
              <Button onClick={handleSave} disabled={isSaving} className="flex-1 sm:flex-none gap-2 font-bold shadow-md">
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Save Document
              </Button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
