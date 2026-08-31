"use client";

import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { CanvassLead } from '@/types/crm';
import { Badge } from '@/components/ui/badge';
import { ExternalLink, Building, User, Phone, Navigation } from 'lucide-react';
import { openSalesforceCreateLead } from '@/lib/utils';
import { Button } from '@/components/ui/button';

// Fix Leaflet's default icon path issues with Webpack/Next.js
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Custom icon for synced leads
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

// Helper to adjust map bounds to fit all markers
function MapBounds({ leads }: { leads: CanvassLead[] }) {
  const map = useMap();

  useEffect(() => {
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
  }, [leads, map]);

  return null;
}

export default function CanvassMap({ leads }: MapProps) {
  const validLeads = leads.filter(l => l.latitude && l.longitude);

  return (
    <div className="w-full h-full min-h-[500px] rounded-xl overflow-hidden border shadow-sm relative z-0">
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
        <MapBounds leads={validLeads} />

        {validLeads.map(lead => (
          <Marker 
            key={lead.id} 
            position={[lead.latitude!, lead.longitude!]}
            icon={lead.inSalesforce ? syncedIcon : draftIcon}
          >
            <Popup className="custom-popup">
              <div className="p-1 min-w-[200px]">
                <div className="flex items-center gap-2 font-bold text-sm text-slate-900 border-b pb-1.5 mb-1.5">
                  <Building className="h-3.5 w-3.5 text-blue-600" />
                  {lead.companyName}
                </div>
                
                <div className="text-[11px] text-slate-600 space-y-1 mt-2">
                  <div className="flex items-center gap-1.5">
                    <User className="h-3 w-3" />
                    <span>{lead.firstName} {lead.lastName}</span>
                  </div>
                  {lead.phone && (
                    <div className="flex items-center gap-1.5">
                      <Phone className="h-3 w-3" />
                      <span>{lead.phone}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-1.5">
                    <Navigation className="h-3 w-3" />
                    <span className="truncate">{lead.suburb}, {lead.state}</span>
                  </div>
                </div>

                <div className="mt-2.5 flex flex-wrap gap-1">
                  {lead.inSalesforce ? (
                    <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-300 text-[9px] px-1.5 py-0">
                      Synced
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-300 text-[9px] px-1.5 py-0">
                      Draft
                    </Badge>
                  )}
                  {lead.businessUnit && (
                    <Badge variant="secondary" className="text-[9px] px-1.5 py-0">
                      {lead.businessUnit}
                    </Badge>
                  )}
                </div>

                <div className="mt-3">
                  <Button 
                    size="sm" 
                    className="w-full h-7 text-[10px] bg-blue-600 hover:bg-blue-700 text-white gap-1"
                    onClick={() => {
                      // Generate and open Salesforce Lead URL
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
                        industry: lead.industry
                      });
                    }}
                  >
                    <ExternalLink className="h-3 w-3" />
                    Open in Salesforce
                  </Button>
                </div>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
