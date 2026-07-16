"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, Target, ShieldCheck, Zap, Anchor, Truck, Hammer, Info, Loader2 } from 'lucide-react';
import { Territory } from "@/contexts/auth-context";
import { useState, useEffect } from 'react';
import { useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';

interface TerritoryPlaybookProps {
  territory: Territory;
  zones: string[];
}

// DATA OBJECT: Pure data only (No icons/JSX to prevent Firestore assertion errors)
export const playbooks = {
  METRO_NORTH: {
    title: "Perth Metro North",
    description: "SME, trade, and repeat freight corridor.",
    target: "SME owners, workshops, light manufacturers",
    precincts: ["Osborne Park", "Malaga", "Wangara", "Gnangara", "Neerabup", "Bayswater"],
    wins: ["Speed to customer (Same-day)", "Reliability on repeat deliveries", "Contract logistics for SMEs"],
    specialisation: "Parcel, courier and same-day solutions",
    color: "bg-blue-500/10 text-blue-700 border-blue-200"
  },
  METRO_SOUTH: {
    title: "Perth Metro South",
    description: "Logistics, DCs, and airport flows.",
    target: "DC managers, logistics leads, air-freight importers",
    precincts: ["Kewdale", "Welshpool", "Forrestfield", "Canning Vale", "Maddington", "Bibra Lake"],
    wins: ["Capacity and volume reliability", "Air/sea integration", "Vendor reduction (Bundled solutions)"],
    specialisation: "Contract logistics and airport-linked distribution",
    color: "bg-emerald-500/10 text-emerald-700 border-emerald-200"
  },
  WESTERN_TRADE_COAST: {
    title: "Western Trade Coast",
    description: "Heavy industry, defence, and marine engineering.",
    target: "Refinery managers, shipbuilders, defence contractors",
    precincts: ["Kwinana Industrial Area", "AMC Henderson", "Rockingham (RIZ)", "Latitude 32"],
    wins: ["Project cargo mastery", "Port-centric logistics (Westport alignment)", "Long-term contract stability"],
    specialisation: "Heavy engineering and oversized transport",
    color: "bg-indigo-500/10 text-indigo-700 border-indigo-200"
  },
  REGIONAL: {
    title: "Regional WA (Flex)",
    description: "Resources, mining services, and processing.",
    target: "Mine sites, processors, project contractors",
    precincts: ["Kalgoorlie (Mungari)", "Bunbury (Kemerton)", "Collie (Shotts)", "Albany"],
    wins: ["Time-critical parts (Air)", "Remote accountability", "Shutdown logistics"],
    specialisation: "Mining services and time-critical remote freight",
    color: "bg-orange-500/10 text-orange-700 border-orange-200"
  },
  FLEX: {
    title: "Flex Pool",
    description: "Assigned by leadership based on capacity.",
    target: "Shared or project-based opportunities",
    precincts: ["Various"],
    wins: ["Agility", "Strategic focus", "Team collaboration"],
    specialisation: "Strategic project support",
    color: "bg-gray-500/10 text-gray-700 border-gray-200"
  }
};

export function TerritoryPlaybook({ territory, zones }: TerritoryPlaybookProps) {
  const db = useFirestore();
  const configRef = useMemoFirebase(() => db ? doc(db, 'strategyConfig', 'territoryPlaybooks') : null, [db]);
  const { data: config, isLoading } = useDoc(configRef);

  const [activePlaybook, setActivePlaybook] = useState<any>(null);

  useEffect(() => {
    const data = config?.data || playbooks;
    setActivePlaybook(data[territory] || data.FLEX);
  }, [config, territory]);

  const renderIcon = () => {
    switch(territory) {
      case 'WESTERN_TRADE_COAST': return <Anchor className="w-5 h-5" />;
      case 'REGIONAL': return <Hammer className="w-5 h-5" />;
      default: return <Truck className="w-5 h-5" />;
    }
  };

  if (isLoading || !activePlaybook) return (
    <div className="flex items-center justify-center p-12 bg-white rounded-2xl border border-dashed h-full">
      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
    </div>
  );

  return (
    <Card className="border shadow-md overflow-hidden h-full flex flex-col bg-white">
      <CardHeader className={`${activePlaybook.color} pb-4 border-b`}>
        <div className="flex justify-between items-start">
          <CardTitle className="text-xl font-bold flex items-center gap-2">
            {renderIcon()}
            {activePlaybook.title}
          </CardTitle>
          <Badge variant="outline" className="border-current font-bold uppercase tracking-widest text-[9px]">
            Active Patch
          </Badge>
        </div>
        <p className="text-sm opacity-90 mt-1 font-medium leading-tight">{activePlaybook.description}</p>
      </CardHeader>
      <CardContent className="pt-6 space-y-6 flex-1">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div>
              <h4 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2 mb-3">
                <MapPin className="w-3 h-3 text-accent" /> Industrial Precincts
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {activePlaybook.precincts?.map((item: any, idx: number) => (
                  <Badge key={idx} variant="secondary" className="bg-muted/50 text-muted-foreground text-[10px] font-bold">
                    <span>{typeof item === 'string' ? item : item.text || item.text || JSON.stringify(item)}</span>
                  </Badge>
                ))}
              </div>
            </div>

            {zones && zones.length > 0 && (
              <div className="p-3 rounded-xl bg-primary/5 border border-primary/10">
                <h4 className="text-[10px] font-bold uppercase tracking-widest text-primary flex items-center gap-2 mb-2">
                  <Zap className="w-3 h-3 text-yellow-500" /> Assigned Zones
                </h4>
                <div className="flex flex-wrap gap-1.5">
                  {zones.map((zone, idx) => (
                    <Badge key={idx} className="bg-primary text-white border-none text-[9px] font-bold">
                      {zone}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div>
              <h4 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2 mb-3">
                <ShieldCheck className="w-3 h-3 text-green-600" /> Winning Messages
              </h4>
              <ul className="space-y-2">
                {activePlaybook.wins?.map((win: string, idx: number) => (
                  <li key={idx} className="text-xs flex items-start gap-2 leading-tight font-bold text-foreground">
                    <div className="w-1.5 h-1.5 rounded-full bg-accent mt-1.5 shrink-0" />
                    {typeof win === 'string' ? win : (win as any).updateText || (win as any).customer || JSON.stringify(win)}
                  </li>
                ))}
              </ul>
            </div>

            <div className="pt-2">
              <h4 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2 mb-2">
                <Target className="w-3 h-3 text-red-500" /> Core Specialisation
              </h4>
              <p className="text-sm font-bold text-primary">{activePlaybook.specialisation}</p>
            </div>
          </div>
        </div>

        <div className="pt-4 border-t border-dashed mt-auto flex items-center justify-between">
          <div className="flex items-center gap-3 text-[10px] text-muted-foreground uppercase font-bold tracking-tight">
            <Info className="w-3.5 h-3.5 text-accent shrink-0" />
            <span>Target: <span className="text-foreground font-black">{activePlaybook.target}</span></span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}