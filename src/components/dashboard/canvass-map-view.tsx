"use client";

import dynamic from 'next/dynamic';
import { CanvassLead } from '@/types/crm';
import { Loader2 } from 'lucide-react';

const CanvassMap = dynamic(() => import('./canvass-map'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full min-h-[500px] flex items-center justify-center bg-slate-50 border rounded-xl">
      <div className="flex flex-col items-center text-slate-500">
        <Loader2 className="h-8 w-8 animate-spin mb-4 text-blue-600" />
        <p>Loading interactive map...</p>
      </div>
    </div>
  )
});

interface CanvassMapViewProps {
  leads: CanvassLead[];
}

export default function CanvassMapView({ leads }: CanvassMapViewProps) {
  return <CanvassMap leads={leads} />;
}
