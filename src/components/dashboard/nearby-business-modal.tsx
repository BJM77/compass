"use client";

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { 
  Building2, 
  MapPin, 
  Search, 
  Loader2, 
  ExternalLink, 
  Sparkles, 
  Navigation,
  CheckCircle2,
  Edit3
} from 'lucide-react';
import { openSalesforceSearch } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

interface NearbyBusiness {
  name: string;
  type?: string;
  street?: string;
  suburb?: string;
  postcode?: string;
  distanceMeter?: number;
}

interface NearbyBusinessModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  latitude?: number;
  longitude?: number;
  onSelectBusiness: (data: {
    companyName: string;
    street?: string;
    suburb?: string;
    postcode?: string;
    searchTimestamp: Date;
  }) => void;
}

export function NearbyBusinessModal({
  open,
  onOpenChange,
  latitude,
  longitude,
  onSelectBusiness
}: NearbyBusinessModalProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [businesses, setBusinesses] = useState<NearbyBusiness[]>([]);
  const [manualName, setManualName] = useState('');
  const [selectedName, setSelectedName] = useState<string | null>(null);

  useEffect(() => {
    if (open && latitude && longitude) {
      fetchNearbyBusinesses(latitude, longitude);
    }
  }, [open, latitude, longitude]);

  const fetchNearbyBusinesses = async (lat: number, lng: number) => {
    setLoading(true);
    setBusinesses([]);
    try {
      // Overpass API query for named nodes/ways within 75m
      const query = `[out:json];(node(around:75,${lat},${lng})["name"];way(around:75,${lat},${lng})["name"];);out tags;`;
      const res = await fetch(`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`);
      
      if (!res.ok) throw new Error('Overpass API returned status ' + res.status);
      
      const data = await res.json();
      const items: NearbyBusiness[] = [];
      const seenNames = new Set<string>();

      if (data?.elements && Array.isArray(data.elements)) {
        for (const el of data.elements) {
          const tags = el.tags || {};
          const name = tags.name;
          if (name && !seenNames.has(name.toLowerCase())) {
            seenNames.add(name.toLowerCase());
            items.push({
              name,
              type: tags.shop || tags.amenity || tags.office || tags.craft || tags.building || 'Commercial',
              street: tags['addr:street'] ? `${tags['addr:housenumber'] || ''} ${tags['addr:street']}`.trim() : undefined,
              suburb: tags['addr:suburb'] || tags['addr:city'],
              postcode: tags['addr:postcode']
            });
          }
        }
      }

      setBusinesses(items);
    } catch (e) {
      console.warn('Overpass lookup failed, falling back gracefully:', e);
      // Fallback empty, user can type manually
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (bizName: string, street?: string, suburb?: string, postcode?: string) => {
    const searchTime = new Date();
    onSelectBusiness({
      companyName: bizName,
      street,
      suburb,
      postcode,
      searchTimestamp: searchTime
    });

    // 1-Click Salesforce Company Search Popup
    toast({
      title: `Selected: ${bizName}`,
      description: `Opening Salesforce Account/Lead Search in popup window...`,
    });

    openSalesforceSearch(bizName);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md w-full sm:rounded-2xl shadow-2xl border border-indigo-100 dark:border-indigo-900">
        <DialogHeader className="space-y-1.5 pb-2 border-b">
          <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
            <Building2 className="h-5 w-5" />
            <DialogTitle className="text-lg font-bold">Nearby Businesses (50m GPS)</DialogTitle>
          </div>
          <DialogDescription className="text-xs">
            Select a commercial location near your coordinates to auto-check Salesforce.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2 max-h-[60vh] overflow-y-auto">
          {/* Location Badge */}
          {latitude && longitude ? (
            <div className="flex items-center justify-between text-xs p-2.5 bg-muted/40 rounded-xl border">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-red-500 animate-pulse" />
                <span className="font-semibold text-muted-foreground">
                  Lat: {latitude.toFixed(5)}, Lng: {longitude.toFixed(5)}
                </span>
              </div>
              <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-300 font-bold">
                📍 Live GPS
              </Badge>
            </div>
          ) : (
            <div className="text-xs p-3 bg-amber-50 text-amber-800 rounded-xl border border-amber-200">
              Acquiring GPS position... Please allow location access.
            </div>
          )}

          {/* Loading State */}
          {loading ? (
            <div className="py-8 text-center space-y-2">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-indigo-600" />
              <p className="text-xs font-semibold text-muted-foreground">Searching 50m radius for commercial sites...</p>
            </div>
          ) : businesses.length > 0 ? (
            <div className="space-y-2">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                Discovered Places Nearby ({businesses.length})
              </span>
              <div className="space-y-2">
                {businesses.map((b, idx) => (
                  <Card 
                    key={idx} 
                    className="p-3 hover:border-indigo-500 hover:shadow-md transition-all cursor-pointer group"
                    onClick={() => handleSelect(b.name, b.street, b.suburb, b.postcode)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <div className="font-bold text-sm text-foreground group-hover:text-indigo-600 transition-colors">
                          {b.name}
                        </div>
                        {b.street && (
                          <p className="text-xs text-muted-foreground">{b.street} {b.suburb ? `, ${b.suburb}` : ''}</p>
                        )}
                      </div>
                      <Button size="sm" variant="outline" className="h-7 text-[11px] gap-1 shrink-0 group-hover:bg-indigo-600 group-hover:text-white font-semibold">
                        <ExternalLink className="h-3 w-3" />
                        Select & SF Search
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          ) : (
            <div className="p-4 text-center border border-dashed rounded-xl space-y-1">
              <p className="text-xs text-muted-foreground font-medium">No named commercial listings found in 50m radius.</p>
              <p className="text-[11px] text-slate-500">Enter company name manually below.</p>
            </div>
          )}

          {/* Manual Input Section */}
          <div className="pt-3 border-t space-y-2">
            <span className="text-xs font-bold flex items-center gap-1.5 text-foreground">
              <Edit3 className="h-3.5 w-3.5 text-blue-600" />
              Enter Business Name Manually
            </span>
            <div className="flex gap-2">
              <Input
                placeholder="e.g. Acme Industrial Logistics"
                value={manualName}
                onChange={e => setManualName(e.target.value)}
                className="text-xs h-9"
              />
              <Button
                size="sm"
                disabled={!manualName.trim()}
                onClick={() => handleSelect(manualName.trim())}
                className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold gap-1 shrink-0"
              >
                <Search className="h-3.5 w-3.5" />
                SF Search
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter className="pt-2 border-t">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} className="text-xs text-muted-foreground">
            Skip / Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
