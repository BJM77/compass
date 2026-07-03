"use client";

import { useState, useMemo } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection } from 'firebase/firestore';
import { TerritoryPlaybook } from './territory-playbook';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { BookOpen, User } from 'lucide-react';

export function PlaybookView() {
  const { profile, isLeader } = useAuth();
  const db = useFirestore();

  // Load all users for selection if leader
  const usersQuery = useMemoFirebase(() => {
    if (!db || !isLeader) return null;
    return collection(db, 'users');
  }, [db, isLeader]);

  const { data: usersList } = useCollection(usersQuery);

  const bdmsAndAMs = useMemo(() => {
    if (!usersList) return [];
    return usersList.filter(u => u.role === 'BDM' || u.role === 'ACCOUNT_MANAGER');
  }, [usersList]);

  const [selectedUserId, setSelectedUserId] = useState<string>('');

  const activeUser = useMemo(() => {
    if (!isLeader) return profile;
    if (!selectedUserId && bdmsAndAMs.length > 0) {
      return bdmsAndAMs[0];
    }
    return bdmsAndAMs.find(u => u.id === selectedUserId) || bdmsAndAMs[0] || profile;
  }, [isLeader, selectedUserId, bdmsAndAMs, profile]);

  return (
    <div className="space-y-6 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h2 className="text-3xl font-black tracking-tight text-slate-800 flex items-center gap-3">
            <BookOpen className="w-8 h-8 text-primary" />
            Territory Playbooks
          </h2>
          <p className="text-slate-500 mt-1 font-medium">
            {isLeader ? "Review playbooks and active patches for team members." : "Your active patch playbooks and winning messages."}
          </p>
        </div>

        {isLeader && bdmsAndAMs.length > 0 && (
          <div className="w-full md:w-64 flex flex-col gap-1.5 shrink-0">
            <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Select Team Member</label>
            <Select 
              value={selectedUserId || (bdmsAndAMs[0]?.id || '')} 
              onValueChange={setSelectedUserId}
            >
              <SelectTrigger className="bg-white font-bold text-slate-700 rounded-xl shadow-sm border-slate-200">
                <SelectValue placeholder="Select user" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                {bdmsAndAMs.map(u => (
                  <SelectItem key={u.id} value={u.id} className="font-bold text-slate-700 rounded-lg">
                    {u.name || u.email || 'Unknown User'} ({u.role?.replace('_', ' ')})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6">
        {activeUser ? (
          <div className="space-y-4">
            {isLeader && (
              <div className="bg-white border border-slate-200/60 rounded-3xl p-4 flex items-center gap-3 shadow-sm">
                <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-bold uppercase">
                  {activeUser.name?.charAt(0) || <User className="w-5 h-5" />}
                </div>
                <div>
                  <h3 className="font-black text-slate-800 text-sm">{activeUser.name || 'Unknown'}</h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                    Role: {activeUser.role?.replace('_', ' ')} | Territory: {activeUser.territory?.replace('_', ' ') || 'NONE'}
                  </p>
                </div>
              </div>
            )}
            <TerritoryPlaybook 
              territory={activeUser.territory || 'FLEX'} 
              zones={activeUser.zones || []} 
            />
          </div>
        ) : (
          <div className="text-center py-20 bg-white border border-dashed rounded-2xl text-slate-400 font-bold">
            No active playbook.
          </div>
        )}
      </div>
    </div>
  );
}
