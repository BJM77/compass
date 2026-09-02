"use client";

import { useEffect, useState, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { CanvassLead } from '@/types/crm';
import { Badge } from '@/components/ui/badge';
import { 
  ExternalLink, 
  Building, 
  User, 
  Phone, 
  Navigation, 
  Clock, 
  MapPin, 
  Layers, 
  CheckCircle2, 
  Compass, 
  Globe2 
} from 'lucide-react';
import { openSalesforceCreateLead } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';

// Fix Leaflet's default icon path issues with Webpack/Next.js
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Custom icons for synced vs draft leads
const syncedIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const draftIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-orange.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

interface MapProps {
  leads: CanvassLead[];
}

// Controller to zoom or fly to locations
function MapBoundsController({ 
  leads, 
  targetLocation 
}: { 
  leads: CanvassLead[]; 
  targetLocation: [number, number] | null; 
}) {
  const map = useMap();

  useEffect(() => {
    if (targetLocation) {
      map.flyTo(targetLocation, 14, { duration: 1.2 });
      return;
    }

    const validLeads = leads.filter(l => l.latitude && l.longitude);
    if (validLeads.length > 0) {
      const bounds = L.latLngBounds(
        validLeads.map(l => [l.latitude!, l.longitude!])
      );
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
    } else {
      // Default to Australia bounds if no leads have GPS
      map.setView([-25.2744, 133.7751], 4);
    }
  }, [leads, targetLocation, map]);

  return null;
}

export default function CanvassMap({ leads }: MapProps) {
  const [showCoverageRadius, setShowCoverageRadius] = useState(true);
  const [selectedSuburb, setSelectedSuburb] = useState<string | null>(null);
  const [targetLocation, setTargetLocation] = useState<[number, number] | null>(null);

  const validLeads = useMemo(() => {
    return leads.filter(l => typeof l.latitude === 'number' && typeof l.longitude === 'number');
  }, [leads]);

  const missingGpsCount = leads.length - validLeads.length;

  // Aggregate visited areas by Suburb
  const suburbStats = useMemo(() => {
    const map = new Map<string, { count: number; lat: number; lng: number; state: string }>();
    validLeads.forEach(lead => {
      const suburbName = lead.suburb?.trim() || 'Unknown Suburb';
      const existing = map.get(suburbName);
      if (existing) {
        existing.count += 1;
      } else {
        map.set(suburbName, {
          count: 1,
          lat: lead.latitude!,
          lng: lead.longitude!,
          state: lead.state || ''
        });
      }
    });
    return Array.from(map.entries())
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.count - a.count);
  }, [validLeads]);

  const handleFocusSuburb = (suburb: typeof suburbStats[0]) => {
    if (selectedSuburb === suburb.name) {
      setSelectedSuburb(null);
      setTargetLocation(null);
    } else {
      setSelectedSuburb(suburb.name);
      setTargetLocation([suburb.lat, suburb.lng]);
    }
  };

  const displayedLeads = useMemo(() => {
    if (!selectedSuburb) return validLeads;
    return validLeads.filter(l => (l.suburb?.trim() || 'Unknown Suburb') === selectedSuburb);
  }, [validLeads, selectedSuburb]);

  return (
    <div className="space-y-3">
      {/* Map Header & Summary Toolbar */}
      <div className="bg-slate-900 text-white p-4 rounded-xl shadow-md border border-slate-800 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="p-2 bg-blue-500/20 border border-blue-400/30 rounded-lg text-blue-400">
              <Globe2 className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-base font-bold flex items-center gap-2">
                Canvassing Territory Footprint
                <Badge className="bg-blue-600 text-white hover:bg-blue-600 border-none text-[10px]">
                  {validLeads.length} Visited Locations Plotted
                </Badge>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Displaying GPS-verified discovery visits and active territory coverage zones.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowCoverageRadius(prev => !prev)}
              className={`h-8 text-xs font-semibold gap-1.5 border-slate-700 ${
                showCoverageRadius 
                  ? 'bg-blue-600/30 border-blue-500 text-blue-300 hover:bg-blue-600/40 hover:text-white' 
                  : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              <Layers className="h-3.5 w-3.5" />
              <span>{showCoverageRadius ? 'Coverage Radii: ON' : 'Coverage Radii: OFF'}</span>
            </Button>

            {selectedSuburb && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setSelectedSuburb(null);
                  setTargetLocation(null);
                }}
                className="h-8 text-xs text-amber-400 hover:text-amber-300 hover:bg-amber-400/10"
              >
                Reset Filter ({selectedSuburb})
              </Button>
            )}
          </div>
        </div>

        {/* Suburb Quick-Jump Pills */}
        {suburbStats.length > 0 && (
          <div className="pt-2 border-t border-slate-800/80">
            <div className="flex items-center gap-2 text-xs text-slate-400 mb-2">
              <MapPin className="h-3.5 w-3.5 text-amber-400" />
              <span className="font-semibold text-slate-300">Visited Suburbs ({suburbStats.length}):</span>
              <span className="text-[11px] text-slate-400">Click a suburb to zoom into that zone</span>
            </div>
            <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-1">
              {suburbStats.map(s => {
                const isSelected = selectedSuburb === s.name;
                return (
                  <button
                    key={s.name}
                    onClick={() => handleFocusSuburb(s)}
                    className={`text-xs px-2.5 py-1 rounded-lg font-medium transition-all flex items-center gap-1.5 ${
                      isSelected
                        ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                        : 'bg-slate-800/90 text-slate-300 hover:bg-slate-700 hover:text-white border border-slate-700/60'
                    }`}
                  >
                    <span>{s.name}</span>
                    {s.state && <span className="opacity-60 text-[10px] uppercase">({s.state})</span>}
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${isSelected ? 'bg-slate-950 text-white font-bold' : 'bg-slate-700 text-slate-200'}`}>
                      {s.count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {missingGpsCount > 0 && (
          <div className="text-[11px] text-slate-400 bg-slate-800/50 px-3 py-1.5 rounded-lg flex items-center gap-2">
            <Compass className="h-3.5 w-3.5 text-amber-400 shrink-0" />
            <span>
              {validLeads.length} leads plotted with GPS. ({missingGpsCount} leads logged without coordinates are listed in the Table view).
            </span>
          </div>
        )}
      </div>

      {/* Leaflet Interactive Map Container */}
      <div className="w-full h-[650px] rounded-2xl overflow-hidden border shadow-lg relative z-0">
        <MapContainer 
          center={[-25.2744, 133.7751]} 
          zoom={4} 
          scrollWheelZoom={true} 
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <MapBoundsController leads={displayedLeads} targetLocation={targetLocation} />

          {displayedLeads.map(lead => {
            const lat = lead.latitude!;
            const lng = lead.longitude!;

            return (
              <div key={lead.id}>
                {/* 500m Territory Coverage Footprint Circle */}
                {showCoverageRadius && (
                  <Circle
                    center={[lat, lng]}
                    radius={500}
                    pathOptions={{
                      color: lead.inSalesforce ? '#10b981' : '#f59e0b',
                      fillColor: lead.inSalesforce ? '#10b981' : '#f59e0b',
                      fillOpacity: 0.12,
                      weight: 1.5,
                      dashArray: lead.inSalesforce ? undefined : '4, 4'
                    }}
                  />
                )}

                <Marker 
                  position={[lat, lng]}
                  icon={lead.inSalesforce ? syncedIcon : draftIcon}
                >
                  <Popup className="custom-popup">
                    <div className="p-1 min-w-[240px] space-y-2">
                      <div className="border-b pb-2">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 font-bold text-sm text-slate-900 line-clamp-1">
                            <Building className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                            <span>{lead.companyName}</span>
                          </div>
                          <Badge 
                            variant="outline" 
                            className={`text-[9px] px-1.5 py-0 shrink-0 ${
                              lead.inSalesforce 
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-300' 
                                : 'bg-amber-50 text-amber-700 border-amber-300'
                            }`}
                          >
                            {lead.inSalesforce ? 'Synced SF' : 'Draft'}
                          </Badge>
                        </div>
                        <div className="text-xs text-slate-500 font-medium mt-0.5">
                          {lead.firstName ? `${lead.firstName} ` : ''}{lead.lastName}
                          {lead.title ? ` • ${lead.title}` : ''}
                        </div>
                      </div>

                      <div className="text-[11px] text-slate-600 space-y-1.5">
                        <div className="flex items-start gap-1.5">
                          <MapPin className="h-3.5 w-3.5 text-red-500 shrink-0 mt-0.5" />
                          <span className="leading-tight">
                            {[lead.addressLine1, lead.suburb, lead.state, lead.postcode].filter(Boolean).join(', ') || 'Address not entered'}
                          </span>
                        </div>

                        {lead.phone && (
                          <div className="flex items-center gap-1.5">
                            <Phone className="h-3 w-3 text-blue-600 shrink-0" />
                            <a href={`tel:${lead.phone}`} className="text-blue-600 font-medium hover:underline">
                              {lead.phone}
                            </a>
                          </div>
                        )}

                        <div className="flex items-center justify-between pt-1 text-[10px] text-slate-500 border-t border-slate-100">
                          <div className="flex items-center gap-1">
                            <User className="h-3 w-3 text-slate-400" />
                            <span>Rep: <strong>{lead.userName || 'Unknown'}</strong></span>
                          </div>
                          {lead.createdAt?.toDate && (
                            <div className="flex items-center gap-1 text-slate-600 font-medium">
                              <Clock className="h-3 w-3 text-slate-400" />
                              <span>{format(lead.createdAt.toDate(), 'dd MMM yyyy, h:mm a')}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {lead.businessUnit && (
                        <div className="flex flex-wrap gap-1 pt-1">
                          <Badge variant="secondary" className="text-[9px] px-1.5 py-0 font-normal">
                            {lead.businessUnit}
                          </Badge>
                          {lead.estimatedRevenue && (
                            <Badge variant="outline" className="text-[9px] px-1.5 py-0 text-emerald-600 border-emerald-300 font-semibold">
                              ${lead.estimatedRevenue.toLocaleString()}/yr
                            </Badge>
                          )}
                        </div>
                      )}

                      <div className="pt-2 border-t flex flex-col gap-1.5">
                        <Button 
                          size="sm" 
                          className="w-full h-7 text-[11px] bg-blue-600 hover:bg-blue-700 text-white font-semibold gap-1 shadow-xs"
                          onClick={() => {
                            openSalesforceCreateLead({
                              companyName: lead.companyName,
                              firstName: lead.firstName,
                              lastName: lead.lastName || 'Lead',
                              title: lead.title,
                              phone: lead.phone,
                              email: lead.email,
                              addressLine1: lead.addressLine1,
                              suburb: lead.suburb,
                              state: lead.state,
                              postcode: lead.postcode,
                              businessUnit: lead.businessUnit,
                              industry: lead.industry,
                              notes: lead.notes
                            });
                          }}
                        >
                          <ExternalLink className="h-3 w-3" />
                          <span>1-Click SF Upload</span>
                        </Button>

                        <a
                          href={`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[10px] text-center text-slate-500 hover:text-blue-600 font-medium py-0.5 flex items-center justify-center gap-1"
                        >
                          <Navigation className="h-3 w-3" />
                          <span>Get Directions (Google Maps)</span>
                        </a>
                      </div>
                    </div>
                  </Popup>
                </Marker>
              </div>
            );
          })}
        </MapContainer>
      </div>
    </div>
  );
}
