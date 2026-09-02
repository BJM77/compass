"use client";

import { useState, useMemo } from 'react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection } from 'firebase/firestore';
import { CanvassLead } from '@/types/crm';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { 
  Clock, 
  User, 
  MapPin, 
  Building2, 
  Calendar, 
  ChevronRight, 
  Timer, 
  ExternalLink,
  CheckCircle2,
  Compass,
  Search
} from 'lucide-react';
import { format, differenceInMinutes, differenceInHours, isSameDay, isSameWeek, isSameMonth } from 'date-fns';
import { openSalesforceSearch } from '@/lib/utils';

interface CanvassTimelineViewProps {
  leads: CanvassLead[];
}

export function CanvassTimelineView({ leads }: CanvassTimelineViewProps) {
  const db = useFirestore();
  const [selectedUser, setSelectedUser] = useState<string>('ALL');
  const [timeframe, setTimeframe] = useState<'DAY' | 'WEEK' | 'MONTH'>('DAY');

  const usersQuery = useMemoFirebase(() => db ? collection(db, 'users') : null, [db]);
  const { data: allUsers } = useCollection<any>(usersQuery);

  const guestUserIds = useMemo(() => {
    const set = new Set<string>();
    allUsers?.forEach(u => {
      if ((u.role || '').toUpperCase() === 'GUEST') {
        set.add(u.id);
      }
    });
    return set;
  }, [allUsers]);

  // Extract unique user names for filter (excluding guests)
  const userList = useMemo(() => {
    const map = new Map<string, string>();
    leads.forEach(l => {
      if (l.userId && !guestUserIds.has(l.userId)) {
        const found = allUsers?.find(u => u.id === l.userId);
        map.set(l.userId, found?.name || l.userName || l.userId);
      }
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [leads, guestUserIds, allUsers]);

  // Filter and sort leads chronologically (newest to oldest or oldest to newest)
  const timelineData = useMemo(() => {
    let filtered = leads;
    if (selectedUser !== 'ALL') {
      filtered = filtered.filter(l => l.userId === selectedUser);
    }

    // Sort chronologically ascending for duration math, then reverse for display
    const sorted = [...filtered].sort((a, b) => {
      const timeA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : new Date(a.createdAt || 0).getTime();
      const timeB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : new Date(b.createdAt || 0).getTime();
      return timeA - timeB;
    });

    // Group leads by User and Date
    const groupedGroups: { [groupKey: string]: { dateTitle: string; userName: string; items: (CanvassLead & { timeSincePrevMinutes?: number })[] } } = {};

    let prevTime: Date | null = null;
    let prevUserId: string | null = null;

    sorted.forEach((lead) => {
      const dateObj = lead.createdAt?.toDate ? lead.createdAt.toDate() : new Date(lead.createdAt || Date.now());
      const userName = lead.userName || 'Field Rep';

      // Calculate time gap from previous lead of the SAME user
      let timeGap: number | undefined;
      if (prevUserId === lead.userId && prevTime) {
        timeGap = differenceInMinutes(dateObj, prevTime);
      }
      prevTime = dateObj;
      prevUserId = lead.userId;

      let groupKey = '';
      let dateTitle = '';

      if (timeframe === 'DAY') {
        groupKey = `${lead.userId}_${format(dateObj, 'yyyy-MM-dd')}`;
        dateTitle = format(dateObj, 'EEEE, dd MMMM yyyy');
      } else if (timeframe === 'WEEK') {
        groupKey = `${lead.userId}_week_${format(dateObj, 'yyyy-II')}`;
        dateTitle = `Week of ${format(dateObj, 'dd MMM yyyy')}`;
      } else {
        groupKey = `${lead.userId}_month_${format(dateObj, 'yyyy-MM')}`;
        dateTitle = format(dateObj, 'MMMM yyyy');
      }

      if (!groupedGroups[groupKey]) {
        groupedGroups[groupKey] = {
          dateTitle,
          userName,
          items: []
        };
      }

      groupedGroups[groupKey].items.push({
        ...lead,
        timeSincePrevMinutes: timeGap
      });
    });

    // Convert to array and reverse items inside groups for reverse-chronological display
    return Object.values(groupedGroups).map(group => ({
      ...group,
      items: group.items.reverse()
    })).reverse();
  }, [leads, selectedUser, timeframe]);

  // Overall metrics
  const totalVisits = leads.length;

  return (
    <div className="space-y-6">
      {/* Filters Header */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-card p-4 rounded-xl border shadow-sm">
        <div className="flex items-center gap-2">
          <Timer className="h-5 w-5 text-indigo-600" />
          <div>
            <h2 className="font-bold text-sm">Canvassing Activity Timeline</h2>
            <p className="text-xs text-muted-foreground">Track lead discovery intervals by Day, Week, or Month</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
          <Select value={selectedUser} onValueChange={setSelectedUser}>
            <SelectTrigger className="h-9 text-xs w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Representatives</SelectItem>
              {userList.map(u => (
                <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg border">
            <button
              onClick={() => setTimeframe('DAY')}
              className={`px-3 py-1 text-xs font-bold rounded-md transition-colors ${
                timeframe === 'DAY' ? 'bg-white dark:bg-slate-900 text-indigo-600 shadow-xs' : 'text-slate-500'
              }`}
            >
              Day
            </button>
            <button
              onClick={() => setTimeframe('WEEK')}
              className={`px-3 py-1 text-xs font-bold rounded-md transition-colors ${
                timeframe === 'WEEK' ? 'bg-white dark:bg-slate-900 text-indigo-600 shadow-xs' : 'text-slate-500'
              }`}
            >
              Week
            </button>
            <button
              onClick={() => setTimeframe('MONTH')}
              className={`px-3 py-1 text-xs font-bold rounded-md transition-colors ${
                timeframe === 'MONTH' ? 'bg-white dark:bg-slate-900 text-indigo-600 shadow-xs' : 'text-slate-500'
              }`}
            >
              Month
            </button>
          </div>
        </div>
      </div>

      {/* Timeline Stream */}
      {timelineData.length === 0 ? (
        <Card className="p-12 text-center border-dashed">
          <Clock className="h-10 w-10 text-muted-foreground mx-auto mb-2 opacity-40" />
          <h3 className="font-bold text-sm">No canvassing activity found</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Try selecting a different representative or timeframe.</p>
        </Card>
      ) : (
        <div className="space-y-6">
          {timelineData.map((group, gIdx) => (
            <Card key={gIdx} className="shadow-sm border-l-4 border-l-indigo-500 overflow-hidden">
              <CardHeader className="p-4 bg-slate-50/70 dark:bg-slate-900/50 border-b flex flex-row items-center justify-between">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-indigo-600" />
                  <span className="font-bold text-sm text-foreground">{group.userName}</span>
                  <Badge variant="secondary" className="text-[10px] bg-indigo-100 text-indigo-800 font-bold">
                    {group.dateTitle}
                  </Badge>
                </div>
                <Badge variant="outline" className="text-xs font-semibold">
                  {group.items.length} Canvassed Visit{group.items.length > 1 ? 's' : ''}
                </Badge>
              </CardHeader>

              <CardContent className="p-4 space-y-4">
                <div className="relative pl-6 border-l-2 border-slate-200 dark:border-slate-800 space-y-6">
                  {group.items.map((lead, idx) => {
                    const createdDate = lead.createdAt?.toDate ? lead.createdAt.toDate() : new Date(lead.createdAt || Date.now());
                    const formattedTime = format(createdDate, 'h:mm a');
                    
                    const searchTime = lead.searchTimestamp?.toDate 
                      ? format(lead.searchTimestamp.toDate(), 'h:mm a') 
                      : lead.searchTimestamp 
                        ? format(new Date(lead.searchTimestamp), 'h:mm a')
                        : null;

                    const completedTime = lead.formCompletedAt?.toDate
                      ? format(lead.formCompletedAt.toDate(), 'h:mm a')
                      : lead.formCompletedAt
                        ? format(new Date(lead.formCompletedAt), 'h:mm a')
                        : null;

                    return (
                      <div key={lead.id || idx} className="relative group">
                        {/* Timeline Node Icon */}
                        <div className="absolute -left-[31px] top-1 h-4 w-4 rounded-full bg-indigo-600 ring-4 ring-white dark:ring-slate-900 flex items-center justify-center text-white">
                          <div className="h-1.5 w-1.5 rounded-full bg-white" />
                        </div>

                        <div className="bg-muted/30 p-3.5 rounded-xl border hover:border-indigo-400 transition-all space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-sm text-foreground">{lead.companyName}</span>
                                {lead.inSalesforce ? (
                                  <Badge className="bg-emerald-100 text-emerald-800 text-[10px] gap-1">
                                    <CheckCircle2 className="h-3 w-3" /> Salesforce
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="text-[10px]">Draft</Badge>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {lead.firstName ? `${lead.firstName} ` : ''}{lead.lastName} • {lead.businessUnit || 'General'}
                              </p>
                            </div>

                            <div className="text-right">
                              <div className="text-xs font-bold text-indigo-600 flex items-center gap-1 justify-end">
                                <Clock className="h-3.5 w-3.5" />
                                {formattedTime}
                              </div>
                              {lead.timeSincePrevMinutes !== undefined && (
                                <p className="text-[10px] text-amber-600 font-semibold mt-0.5">
                                  ⏱️ +{lead.timeSincePrevMinutes} min since prev visit
                                </p>
                              )}
                            </div>
                          </div>

                          {/* Timestamps & Address Details */}
                          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t text-[11px] text-slate-600 dark:text-slate-400">
                            <div className="flex items-center gap-2">
                              <MapPin className="h-3.5 w-3.5 text-red-500 shrink-0" />
                              <span>{[lead.addressLine1, lead.suburb, lead.state].filter(Boolean).join(', ') || 'On-site'}</span>
                            </div>

                            <div className="flex items-center gap-3">
                              {searchTime && (
                                <span className="text-blue-600 font-medium">Arrival/Search: {searchTime}</span>
                              )}
                              {completedTime && (
                                <span className="text-emerald-600 font-medium">Completed: {completedTime}</span>
                              )}
                            </div>
                          </div>

                          {/* Notes snippet */}
                          {lead.notes && (
                            <p className="text-xs italic text-muted-foreground bg-card p-2 rounded-lg border line-clamp-2">
                              "{lead.notes}"
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
