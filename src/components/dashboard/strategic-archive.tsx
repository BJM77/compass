"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { WhitespaceHistory } from "./whitespace-history";
import { AdminCallPlanning } from "./admin-call-planning";
import { Archive, LayoutGrid, PhoneCall } from "lucide-react";

interface StrategicArchiveProps {
  userId: string;
}

export function StrategicArchive({ userId }: StrategicArchiveProps) {
  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <h2 className="text-2xl font-black text-primary uppercase tracking-tight flex items-center gap-2">
          <Archive className="w-6 h-6 text-accent" />
          Strategic Archive
        </h2>
        <p className="text-muted-foreground font-bold uppercase text-[10px] tracking-widest mt-1">
          Historical repository of Call Plans and White Space expansion models
        </p>
      </div>

      <Tabs defaultValue="call_plans" className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-md mb-8 h-12 bg-slate-100 p-1">
          <TabsTrigger 
            value="call_plans" 
            className="font-black uppercase text-xs data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm rounded-md transition-all flex items-center gap-2 h-full"
          >
            <PhoneCall className="w-4 h-4" /> Call Plans
          </TabsTrigger>
          <TabsTrigger 
            value="white_space" 
            className="font-black uppercase text-xs data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm rounded-md transition-all flex items-center gap-2 h-full"
          >
            <LayoutGrid className="w-4 h-4" /> White Space
          </TabsTrigger>
        </TabsList>

        <TabsContent value="call_plans" className="mt-0 outline-none animate-in fade-in duration-500">
          <AdminCallPlanning />
        </TabsContent>

        <TabsContent value="white_space" className="mt-0 outline-none animate-in fade-in duration-500">
          <WhitespaceHistory userId={userId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
