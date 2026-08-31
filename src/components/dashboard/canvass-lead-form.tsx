"use client";

import { useState, useEffect } from 'react';
import { useFirestore } from '@/firebase';
import { collection, addDoc, updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '@/contexts/auth-context';
import { CanvassLead } from '@/types/crm';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { 
  MapPin, 
  Navigation, 
  ExternalLink, 
  Save, 
  Loader2, 
  Building, 
  User, 
  Phone, 
  Mail, 
  Truck, 
  DollarSign, 
  CheckCircle2, 
  Sparkles, 
  Compass, 
  ArrowLeft,
  Share2,
  FileCheck
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { openSalesforceCreateLead, openSalesforceSearch } from '@/lib/utils';

const BUSINESS_UNITS = [
  'Priority Services',
  'IPEC Road Services',
  'TGE Courier',
  'International Air & Sea',
  'Contract Logistics'
];

const SERVICE_OPTIONS = [
  'Time Sensitive (Next Available)',
  'Same-Day Road & Air',
  'Priority Air Express (Overnight)',
  'Road Express (1-8 Days)',
  'Courier Network (B2B)',
  'International Air Express',
  'Sea Freight',
  'Heavy / Oversize Freight',
  'Dangerous Goods',
  'Temperature Controlled'
];

const FREIGHT_PROFILES = [
  'Satchels & Documents',
  'Cartons & Parcels',
  'Skids & Pallets',
  'Mixed Freight (Cartons + Pallets)',
  'Heavy Machinery / Out of Gauge',
  'Full Truck Load (FTL)'
];

const INCUMBENTS = [
  'StarTrack',
  'Australia Post',
  'Toll Group / Toll Express',
  'FedEx / TNT',
  'DHL Express',
  'CouriersPlease',
  'Northline',
  'Centurion',
  'Sadleirs',
  'Followmont',
  'Other / Local Carrier'
];

const INDUSTRIES = [
  'Manufacturing & Industrial',
  'Mining, Oil & Gas',
  'Retail & E-Commerce',
  'Automotive & Spare Parts',
  'Healthcare & Pharmaceuticals',
  'Wholesale & Distribution',
  'Technology & Electronics',
  'Construction & Building Supplies',
  'Agriculture & Food',
  'Professional Services'
];

const CONTACT_METHODS = [
  'Phone',
  'Email',
  'In Person Visit',
  'Virtual Meeting / Teams'
];

interface CanvassLeadFormProps {
  initialLead?: CanvassLead | null;
  onSaved?: (leadId: string) => void;
  onCancel?: () => void;
}

export function CanvassLeadForm({ initialLead, onSaved, onCancel }: CanvassLeadFormProps) {
  const { user, profile } = useAuth();
  const db = useFirestore();
  const { toast } = useToast();

  const [saving, setSaving] = useState(false);
  const [acquiringGps, setAcquiringGps] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);

  // Form State
  const [companyName, setCompanyName] = useState(initialLead?.companyName || '');
  const [leadTopic, setLeadTopic] = useState(initialLead?.leadTopic || '');
  const [firstName, setFirstName] = useState(initialLead?.firstName || '');
  const [lastName, setLastName] = useState(initialLead?.lastName || '');
  const [title, setTitle] = useState(initialLead?.title || '');
  const [phone, setPhone] = useState(initialLead?.phone || '');
  const [email, setEmail] = useState(initialLead?.email || '');
  const [preferredContactMethod, setPreferredContactMethod] = useState(initialLead?.preferredContactMethod || 'Phone');
  const [customerConsent, setCustomerConsent] = useState(initialLead?.customerConsent ?? true);
  
  // Location
  const [addressLine1, setAddressLine1] = useState(initialLead?.addressLine1 || '');
  const [addressLine2, setAddressLine2] = useState(initialLead?.addressLine2 || '');
  const [suburb, setSuburb] = useState(initialLead?.suburb || '');
  const [state, setState] = useState(initialLead?.state || 'WA');
  const [postcode, setPostcode] = useState(initialLead?.postcode || '');
  const [country, setCountry] = useState(initialLead?.country || 'Australia');
  const [latitude, setLatitude] = useState<number | undefined>(initialLead?.latitude);
  const [longitude, setLongitude] = useState<number | undefined>(initialLead?.longitude);
  const [gpsAccuracy, setGpsAccuracy] = useState<number | undefined>(initialLead?.gpsAccuracy);

  // Commercial / Freight Details
  const [industry, setIndustry] = useState(initialLead?.industry || 'Manufacturing & Industrial');
  const [businessUnit, setBusinessUnit] = useState(initialLead?.businessUnit || 'Priority Services');
  const [services, setServices] = useState<string[]>(initialLead?.services || []);
  const [freightProfile, setFreightProfile] = useState(initialLead?.freightProfile || '');
  const [quoteNumber, setQuoteNumber] = useState(initialLead?.quoteNumber || '');
  const [estimatedRevenue, setEstimatedRevenue] = useState<string>(
    initialLead?.estimatedRevenue ? String(initialLead.estimatedRevenue) : ''
  );
  const [incumbent, setIncumbent] = useState(initialLead?.incumbent || '');
  const [otherIncumbent, setOtherIncumbent] = useState(initialLead?.otherIncumbent || '');
  const [leadSource, setLeadSource] = useState(initialLead?.leadSource || 'Field Canvassing');
  const [leadType, setLeadType] = useState(initialLead?.leadType || 'Prospect');
  const [leadStatus, setLeadStatus] = useState(initialLead?.leadStatus || 'New');
  const [notes, setNotes] = useState(initialLead?.notes || '');
  const [inSalesforce, setInSalesforce] = useState(initialLead?.inSalesforce ?? false);

  // Auto-acquire GPS on mount if creating a new lead
  useEffect(() => {
    if (!initialLead?.id && !latitude) {
      handleGetLocation(false);
    }
  }, []);

  const toggleService = (svc: string) => {
    setServices(prev => 
      prev.includes(svc) ? prev.filter(s => s !== svc) : [...prev, svc]
    );
  };

  // GPS Acquisition & Reverse Geocoding
  const handleGetLocation = async (showToast = true) => {
    if (!navigator.geolocation) {
      setGpsError('Geolocation is not supported by your browser/device.');
      if (showToast) {
        toast({ title: 'GPS Unavailable', description: 'Geolocation is not supported by your device.', variant: 'destructive' });
      }
      return;
    }

    setAcquiringGps(true);
    setGpsError(null);

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const acc = Math.round(pos.coords.accuracy);

        setLatitude(lat);
        setLongitude(lng);
        setGpsAccuracy(acc);

        // Reverse Geocode using OpenStreetMap Nominatim
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&addressdetails=1`,
            { 
              headers: { 
                'Accept-Language': 'en-AU,en',
                'User-Agent': 'BDM-Compass-Sales-Canvassing-App/1.0'
              } 
            }
          );
          if (res.ok) {
            const data = await res.json();
            const addr = data.address || {};
            
            const road = [addr.house_number, addr.road].filter(Boolean).join(' ');
            const city = addr.suburb || addr.city || addr.town || addr.municipality || '';
            const pc = addr.postcode || '';
            const st = addr.state || '';

            if (road && !addressLine1) setAddressLine1(road);
            if (city && !suburb) setSuburb(city);
            if (pc && !postcode) setPostcode(pc);
            
            // Map Australian states
            if (st) {
              const upperSt = st.toUpperCase();
              if (upperSt.includes('WESTERN') || upperSt === 'WA') setState('WA');
              else if (upperSt.includes('NEW SOUTH') || upperSt === 'NSW') setState('NSW');
              else if (upperSt.includes('VICTORIA') || upperSt === 'VIC') setState('VIC');
              else if (upperSt.includes('QUEENSLAND') || upperSt === 'QLD') setState('QLD');
              else if (upperSt.includes('SOUTH') || upperSt === 'SA') setState('SA');
              else if (upperSt.includes('TASMANIA') || upperSt === 'TAS') setState('TAS');
              else if (upperSt.includes('NORTHERN') || upperSt === 'NT') setState('NT');
              else if (upperSt.includes('CAPITAL') || upperSt === 'ACT') setState('ACT');
            }

            if (showToast) {
              toast({
                title: '📍 Location Captured',
                description: `${road || 'Coordinates'} (${city || 'Nearby'}, ${acc}m accuracy)`
              });
            }
          }
        } catch (e) {
          console.warn('Reverse geocoding failed:', e);
        } finally {
          setAcquiringGps(false);
        }
      },
      (err) => {
        setAcquiringGps(false);
        setGpsError(err.message);
        if (showToast) {
          toast({ title: 'Location Error', description: err.message, variant: 'destructive' });
        }
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 }
    );
  };

  const getLeadPayload = () => {
    return {
      userId: user?.uid || '',
      userName: profile?.name || user?.displayName || 'Sales Rep',
      companyName: companyName.trim(),
      leadTopic: leadTopic.trim(),
      firstName: firstName.trim(),
      lastName: lastName.trim() || 'Lead',
      title: title.trim(),
      phone: phone.trim(),
      email: email.trim(),
      preferredContactMethod,
      customerConsent,
      addressLine1: addressLine1.trim(),
      addressLine2: addressLine2.trim(),
      suburb: suburb.trim(),
      state,
      postcode: postcode.trim(),
      country,
      latitude: latitude ?? null,
      longitude: longitude ?? null,
      gpsAccuracy: gpsAccuracy ?? null,
      industry,
      businessUnit,
      services,
      freightProfile,
      quoteNumber: quoteNumber.trim(),
      estimatedRevenue: estimatedRevenue ? parseFloat(estimatedRevenue) : null,
      incumbent,
      otherIncumbent: otherIncumbent.trim(),
      leadSource,
      leadType,
      leadStatus,
      notes: notes.trim(),
      inSalesforce,
      updatedAt: serverTimestamp(),
    };
  };

  const handleSave = async (andLaunchSalesforce = false) => {
    if (!companyName.trim()) {
      toast({ title: 'Company Name is Required', description: 'Please enter the prospect company name.', variant: 'destructive' });
      return;
    }
    if (!phone.trim() && !email.trim()) {
      toast({ title: 'Contact Info Required', description: 'Please provide at least a phone number or email address.', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      let leadId = initialLead?.id;
      const payload = getLeadPayload();

      if (leadId && db) {
        await updateDoc(doc(db, 'canvass_leads', leadId), payload);
        toast({ title: 'Lead Updated', description: `${companyName} has been saved.` });
      } else if (db) {
        const docRef = await addDoc(collection(db, 'canvass_leads'), {
          ...payload,
          createdAt: serverTimestamp(),
        });
        leadId = docRef.id;
        toast({ title: 'Lead Captured!', description: `${companyName} logged to Compass.` });
      }

      if (andLaunchSalesforce) {
        openSalesforceCreateLead({
          companyName,
          firstName,
          lastName: lastName || 'Lead',
          title,
          phone,
          email,
          preferredContactMethod,
          addressLine1,
          addressLine2,
          suburb,
          state,
          postcode,
          country,
          industry,
          businessUnit,
          services,
          freightProfile,
          quoteNumber,
          estimatedRevenue: estimatedRevenue ? parseFloat(estimatedRevenue) : undefined,
          incumbent,
          otherIncumbent,
          leadSource,
          leadType,
          leadStatus,
          leadTopic,
          notes: notes ? `${notes}\n[Captured on-site via Compass Canvassing]` : '[Captured on-site via Compass Canvassing]'
        });
      }

      if (onSaved && leadId) {
        onSaved(leadId);
      }
    } catch (err: any) {
      toast({ title: 'Error Saving Lead', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6 pb-20">
      {/* Top Header Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-card p-4 rounded-xl border shadow-sm sticky top-0 z-20 backdrop-blur-md bg-card/95">
        <div className="flex items-center gap-3">
          {onCancel && (
            <Button variant="ghost" size="icon" onClick={onCancel} className="h-9 w-9">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          )}
          <div>
            <h1 className="text-lg md:text-xl font-bold flex items-center gap-2">
              <Compass className="h-5 w-5 text-amber-500" />
              {initialLead?.id ? 'Edit Canvassed Lead' : 'Field Canvassing Lead Capture'}
            </h1>
            <p className="text-xs text-muted-foreground">Mobile-First Lead Entry with GPS & 1-Click Salesforce</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto mt-2 md:mt-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => handleSave(false)}
            disabled={saving}
            className="flex-1 md:flex-none gap-1.5"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4 text-emerald-600" />}
            <span>Save Draft</span>
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={() => handleSave(true)}
            disabled={saving}
            className="flex-1 md:flex-none gap-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-md font-semibold"
          >
            <ExternalLink className="h-4 w-4" />
            <span>1-Click SF Upload</span>
          </Button>
        </div>
      </div>

      {/* GPS Location Banner */}
      <Card className="border-blue-200 dark:border-blue-900 bg-gradient-to-r from-blue-50/70 to-indigo-50/50 dark:from-blue-950/20 dark:to-indigo-950/20">
        <CardContent className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="p-2.5 bg-blue-600 text-white rounded-lg shadow-sm">
              <MapPin className="h-5 w-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm">GPS Geolocation & Auto-Address</span>
                {latitude && longitude ? (
                  <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-300 text-[10px]">
                    📍 Coordinates Locked ({gpsAccuracy ? `±${gpsAccuracy}m` : 'Active'})
                  </Badge>
                ) : (
                  <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-300 text-[10px]">
                    Not captured yet
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {latitude && longitude
                  ? `Lat: ${latitude.toFixed(5)}, Lng: ${longitude.toFixed(5)} — Address auto-filled below`
                  : 'Tap button to acquire your current field position and fill street address.'}
              </p>
            </div>
          </div>

          <Button
            type="button"
            size="sm"
            variant={latitude ? 'outline' : 'default'}
            onClick={() => handleGetLocation(true)}
            disabled={acquiringGps}
            className="shrink-0 gap-1.5 w-full sm:w-auto"
          >
            {acquiringGps ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Locating...</span>
              </>
            ) : (
              <>
                <Navigation className="h-4 w-4 text-blue-600" />
                <span>{latitude ? 'Re-acquire GPS' : 'Get Current Location'}</span>
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Main Form Fields */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Section 1: Company & Contact Info */}
        <Card className="shadow-sm">
          <CardHeader className="pb-3 border-b bg-muted/20">
            <CardTitle className="text-sm font-bold flex items-center gap-2 text-foreground">
              <Building className="h-4 w-4 text-blue-600" />
              Lead & Company Information
            </CardTitle>
            <CardDescription className="text-xs">Directly maps to Salesforce Lead Header</CardDescription>
          </CardHeader>
          <CardContent className="p-4 space-y-4">
            <div>
              <Label className="text-xs font-semibold flex items-center justify-between">
                <span>Company Name *</span>
                <span className="text-[10px] text-muted-foreground font-normal">Required for Salesforce</span>
              </Label>
              <Input
                placeholder="e.g. West Coast Distribution Pty Ltd"
                value={companyName}
                onChange={e => setCompanyName(e.target.value)}
                className="mt-1 font-medium"
              />
            </div>

            <div>
              <Label className="text-xs font-semibold">Lead Topic / Opportunity Context</Label>
              <Input
                placeholder="e.g. Road Express pallet freight to Pilbara"
                value={leadTopic}
                onChange={e => setLeadTopic(e.target.value)}
                className="mt-1"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold">First Name</Label>
                <Input
                  placeholder="John"
                  value={firstName}
                  onChange={e => setFirstName(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs font-semibold">Last Name *</Label>
                <Input
                  placeholder="Smith"
                  value={lastName}
                  onChange={e => setLastName(e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold">Job Title / Role</Label>
                <Input
                  placeholder="e.g. Warehouse / Logistics Mgr"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs font-semibold">Preferred Contact Method</Label>
                <Select value={preferredContactMethod} onValueChange={setPreferredContactMethod}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CONTACT_METHODS.map(m => (
                      <SelectItem key={m} value={m}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold flex items-center gap-1.5">
                  <Phone className="h-3 w-3 text-muted-foreground" />
                  Phone / Mobile *
                </Label>
                <Input
                  type="tel"
                  placeholder="0412 345 678"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs font-semibold flex items-center gap-1.5">
                  <Mail className="h-3 w-3 text-muted-foreground" />
                  Email Address *
                </Label>
                <Input
                  type="email"
                  placeholder="john@example.com.au"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t text-xs">
              <span className="font-medium text-muted-foreground">Customer Consent Obtained?</span>
              <div className="flex items-center gap-2">
                <Switch checked={customerConsent} onCheckedChange={setCustomerConsent} />
                <span className="font-semibold text-[11px]">{customerConsent ? 'Yes' : 'No'}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Section 2: Address & Location Details */}
        <Card className="shadow-sm">
          <CardHeader className="pb-3 border-b bg-muted/20">
            <CardTitle className="text-sm font-bold flex items-center gap-2 text-foreground">
              <MapPin className="h-4 w-4 text-emerald-600" />
              Location & Site Address
            </CardTitle>
            <CardDescription className="text-xs">Pre-filled via GPS or manually editable</CardDescription>
          </CardHeader>
          <CardContent className="p-4 space-y-4">
            <div>
              <Label className="text-xs font-semibold">Address Line 1 (Street)</Label>
              <Input
                placeholder="e.g. 14 Logistics Boulevard"
                value={addressLine1}
                onChange={e => setAddressLine1(e.target.value)}
                className="mt-1"
              />
            </div>

            <div>
              <Label className="text-xs font-semibold">Address Line 2 (Unit / Building / Suite)</Label>
              <Input
                placeholder="e.g. Unit 4, Building B"
                value={addressLine2}
                onChange={e => setAddressLine2(e.target.value)}
                className="mt-1"
              />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="col-span-2 sm:col-span-1">
                <Label className="text-xs font-semibold">Suburb / City</Label>
                <Input
                  placeholder="Kewdale"
                  value={suburb}
                  onChange={e => setSuburb(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div className="col-span-1">
                <Label className="text-xs font-semibold">State</Label>
                <Select value={state} onValueChange={setState}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {['WA', 'NSW', 'VIC', 'QLD', 'SA', 'TAS', 'NT', 'ACT'].map(st => (
                      <SelectItem key={st} value={st}>{st}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-1">
                <Label className="text-xs font-semibold">Postcode</Label>
                <Input
                  placeholder="6105"
                  value={postcode}
                  onChange={e => setPostcode(e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold">Country</Label>
                <Input
                  value={country}
                  onChange={e => setCountry(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs font-semibold">Industry</Label>
                <Select value={industry} onValueChange={setIndustry}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {INDUSTRIES.map(ind => (
                      <SelectItem key={ind} value={ind}>{ind}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {latitude && longitude && (
              <div className="p-3 bg-muted/40 rounded-lg text-xs flex items-center justify-between border">
                <div className="flex items-center gap-2">
                  <Navigation className="h-4 w-4 text-blue-600" />
                  <span>Google Maps link ready</span>
                </div>
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 font-semibold hover:underline flex items-center gap-1"
                >
                  View Pin <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Section 3: Freight, Services & Business Profile */}
        <Card className="shadow-sm md:col-span-2">
          <CardHeader className="pb-3 border-b bg-muted/20">
            <CardTitle className="text-sm font-bold flex items-center gap-2 text-foreground">
              <Truck className="h-4 w-4 text-amber-600" />
              Freight Requirements & Commercial Scope
            </CardTitle>
            <CardDescription className="text-xs">Services interested in, freight types, and incumbent carrier</CardDescription>
          </CardHeader>
          <CardContent className="p-4 space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <Label className="text-xs font-semibold">Business Unit *</Label>
                <Select value={businessUnit} onValueChange={setBusinessUnit}>
                  <SelectTrigger className="mt-1 font-medium">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {BUSINESS_UNITS.map(bu => (
                      <SelectItem key={bu} value={bu}>{bu}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs font-semibold">Freight Profile / What moved?</Label>
                <Select value={freightProfile} onValueChange={setFreightProfile}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select freight type" />
                  </SelectTrigger>
                  <SelectContent>
                    {FREIGHT_PROFILES.map(fp => (
                      <SelectItem key={fp} value={fp}>{fp}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs font-semibold flex items-center gap-1">
                  <DollarSign className="h-3 w-3 text-emerald-600" />
                  Estimated Annual Spend ($)
                </Label>
                <Input
                  type="number"
                  placeholder="e.g. 50000"
                  value={estimatedRevenue}
                  onChange={e => setEstimatedRevenue(e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>

            {/* Services Multi-Select Chips */}
            <div>
              <Label className="text-xs font-semibold mb-2 block">What services are they interested in?</Label>
              <div className="flex flex-wrap gap-2">
                {SERVICE_OPTIONS.map(svc => {
                  const selected = services.includes(svc);
                  return (
                    <button
                      key={svc}
                      type="button"
                      onClick={() => toggleService(svc)}
                      className={`text-xs px-3 py-1.5 rounded-full border transition-all ${
                        selected
                          ? 'bg-blue-600 text-white border-blue-600 shadow-xs font-medium'
                          : 'bg-muted/40 hover:bg-muted text-muted-foreground border-border'
                      }`}
                    >
                      {selected ? '✓ ' : '+ '}{svc}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Incumbent & Competitors */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-3 border-t">
              <div>
                <Label className="text-xs font-semibold">Current Incumbent Carrier</Label>
                <Select value={incumbent} onValueChange={setIncumbent}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select incumbent" />
                  </SelectTrigger>
                  <SelectContent>
                    {INCUMBENTS.map(inc => (
                      <SelectItem key={inc} value={inc}>{inc}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {incumbent.includes('Other') && (
                <div>
                  <Label className="text-xs font-semibold">Other Incumbent Name</Label>
                  <Input
                    placeholder="Carrier Name"
                    value={otherIncumbent}
                    onChange={e => setOtherIncumbent(e.target.value)}
                    className="mt-1"
                  />
                </div>
              )}

              <div>
                <Label className="text-xs font-semibold">Quote Number (QBL if issued)</Label>
                <Input
                  placeholder="e.g. QBL-98214"
                  value={quoteNumber}
                  onChange={e => setQuoteNumber(e.target.value)}
                  className="mt-1"
                />
              </div>

              <div>
                <Label className="text-xs font-semibold">Lead Status</Label>
                <Select value={leadStatus} onValueChange={setLeadStatus}>
                  <SelectTrigger className="mt-1 font-medium">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {['New', 'Contacted', 'Qualified', 'Unqualified', 'Converted'].map(st => (
                      <SelectItem key={st} value={st}>{st}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Description / Field Notes */}
            <div className="pt-3 border-t">
              <Label className="text-xs font-semibold">Field Canvassing Notes & Follow-up Actions</Label>
              <Textarea
                rows={3}
                placeholder="Met with warehouse supervisor. Currently dispatching 15 pallets/wk with StarTrack to Sydney & Melbourne. Dissatisfied with DIFOT. Wants rate comparison next Tuesday."
                value={notes}
                onChange={e => setNotes(e.target.value)}
                className="mt-1 text-xs resize-y"
              />
            </div>

            {/* Salesforce Sync Status */}
            <div className="flex items-center justify-between p-3 bg-muted/40 rounded-lg border text-xs">
              <div className="flex items-center gap-2">
                <FileCheck className="h-4 w-4 text-blue-600" />
                <div>
                  <span className="font-semibold">Marked as Synced in Salesforce?</span>
                  <p className="text-[11px] text-muted-foreground">Toggle once uploaded or verified in Salesforce Leads</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={inSalesforce} onCheckedChange={setInSalesforce} />
                <span className="font-semibold text-xs">{inSalesforce ? 'Synced' : 'Draft'}</span>
              </div>
            </div>

          </CardContent>
        </Card>

      </div>

      {/* Bottom Action Bar */}
      <div className="p-4 bg-card rounded-xl border shadow-sm flex flex-col sm:flex-row items-center justify-end gap-3 mt-8">
        <Button
          type="button"
          variant="outline"
          size="lg"
          onClick={() => handleSave(false)}
          disabled={saving}
          className="w-full sm:w-auto"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4 mr-1 text-emerald-600" />}
          Save as Draft
        </Button>
        <Button
          type="button"
          size="lg"
          onClick={() => handleSave(true)}
          disabled={saving}
          className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-md"
        >
          <ExternalLink className="h-4 w-4 mr-1" />
          1-Click Salesforce Upload
        </Button>
      </div>

    </div>
  );
}
