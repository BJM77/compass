"use client";

import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useFirestore, useCollection, useDoc, useMemoFirebase } from '@/firebase';
import { collection, doc } from 'firebase/firestore';
import { Shield, AlertCircle, Database, Clock, ServerCrash, CheckCircle2, TrendingUp, Info } from 'lucide-react';
import { format, differenceInDays } from 'date-fns';

export function DataHealthDashboard() {
  const db = useFirestore();

  // Fetch Settings for CRM Sync
  const settingsRef = useMemoFirebase(() => db ? doc(db, 'appSettings', 'global') : null, [db]);
  const { data: settingsData, isLoading: settingsLoading } = useDoc(settingsRef);

  // Fetch a sample of customers to determine "Stale Accounts"
  const customersRef = useMemoFirebase(() => db ? collection(db, 'customers') : null, [db]);
  const { data: customersData, isLoading: customersLoading } = useCollection(customersRef);

  // Calculate Health Metrics
  const metrics = useMemo(() => {
    if (!customersData || !settingsData) return null;

    const now = new Date();
    const lastSyncDate = settingsData?.lastCrmSync?.toDate ? settingsData.lastCrmSync.toDate() : null;
    const daysSinceSync = lastSyncDate ? differenceInDays(now, lastSyncDate) : Infinity;

    let staleAccountsCount = 0;
    let missingContactCount = 0;

    customersData.forEach((customer: any) => {
      // Mock logic: consider an account stale if it hasn't been updated in 30 days
      // and missing contact info if phone/email is blank
      const lastUpdate = customer.lastActivityDate?.toDate ? customer.lastActivityDate.toDate() : (customer.updatedAt?.toDate ? customer.updatedAt.toDate() : null);
      if (!lastUpdate || differenceInDays(now, lastUpdate) > 30) {
        staleAccountsCount++;
      }
      
      if (!customer.phone && !customer.email) {
        missingContactCount++;
      }
    });

    const totalAccounts = customersData.length || 1;
    const freshnessScore = Math.max(0, 100 - (staleAccountsCount / totalAccounts) * 50 - (daysSinceSync > 7 ? 20 : 0));

    return {
      lastSyncDate,
      daysSinceSync,
      totalAccounts,
      staleAccountsCount,
      missingContactCount,
      freshnessScore: Math.round(freshnessScore),
    };
  }, [customersData, settingsData]);

  if (customersLoading || settingsLoading) {
    return (
      <div className="w-full flex items-center justify-center p-12">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <Database className="w-8 h-8 text-indigo-400/50" />
          <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">Analyzing Data Health...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b border-slate-200 pb-6">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Shield className="w-6 h-6 text-indigo-600" />
            Data Health & Integrity
          </h1>
          <p className="text-sm text-slate-500 mt-1 max-w-2xl">
            Trust is built on accurate data. Monitor CRM sync status, stale accounts, and missing relationships to ensure platform reliability.
          </p>
        </div>
        
        {metrics && (
          <div className="flex items-center gap-3 bg-white px-4 py-2 rounded-xl shadow-sm border border-slate-200">
            <div className="text-right">
              <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Freshness Score</p>
              <p className={`text-2xl font-black ${metrics.freshnessScore >= 80 ? 'text-emerald-600' : metrics.freshnessScore >= 50 ? 'text-amber-500' : 'text-red-600'}`}>
                {metrics.freshnessScore}/100
              </p>
            </div>
            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${metrics.freshnessScore >= 80 ? 'bg-emerald-100 text-emerald-600' : metrics.freshnessScore >= 50 ? 'bg-amber-100 text-amber-600' : 'bg-red-100 text-red-600'}`}>
              {metrics.freshnessScore >= 80 ? <CheckCircle2 className="w-6 h-6" /> : <TrendingUp className="w-6 h-6" />}
            </div>
          </div>
        )}
      </div>

      {!metrics ? (
        <Card className="border-amber-200 bg-amber-50/50">
          <CardContent className="p-8 text-center text-amber-700">
            <AlertCircle className="w-8 h-8 mx-auto mb-3 opacity-50" />
            <p className="font-semibold">Unable to calculate metrics.</p>
            <p className="text-sm opacity-80 mt-1">Ensure CRM data has been imported and app settings are initialized.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* CRM Sync Status */}
          <Card className={`border-l-4 ${metrics.daysSinceSync <= 1 ? 'border-l-emerald-500' : metrics.daysSinceSync <= 7 ? 'border-l-amber-500' : 'border-l-red-500'}`}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-black uppercase tracking-wider text-slate-500 flex items-center gap-2">
                <Database className="w-4 h-4" />
                CRM Sync Pipeline
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black text-slate-900">
                  {metrics.lastSyncDate ? format(metrics.lastSyncDate, 'MMM d') : 'Never'}
                </span>
                <span className="text-sm font-medium text-slate-500">
                  {metrics.lastSyncDate ? format(metrics.lastSyncDate, 'h:mm a') : ''}
                </span>
              </div>
              <p className={`text-xs font-bold mt-2 ${metrics.daysSinceSync <= 1 ? 'text-emerald-600' : metrics.daysSinceSync <= 7 ? 'text-amber-600' : 'text-red-600'}`}>
                {metrics.daysSinceSync === 0 ? 'Synced today' : metrics.daysSinceSync === Infinity ? 'No sync record found' : `${metrics.daysSinceSync} days ago`}
              </p>
            </CardContent>
          </Card>

          {/* Stale Accounts */}
          <Card className={`border-l-4 ${metrics.staleAccountsCount === 0 ? 'border-l-emerald-500' : (metrics.staleAccountsCount / metrics.totalAccounts) < 0.2 ? 'border-l-amber-500' : 'border-l-red-500'}`}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-black uppercase tracking-wider text-slate-500 flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Stale Accounts (30d+)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black text-slate-900">
                  {metrics.staleAccountsCount}
                </span>
                <span className="text-sm font-medium text-slate-500">
                  / {metrics.totalAccounts} total
                </span>
              </div>
              <p className="text-xs font-medium text-slate-500 mt-2">
                Accounts with no logged activity or updates in over 30 days.
              </p>
            </CardContent>
          </Card>

          {/* Data Quality */}
          <Card className={`border-l-4 ${(metrics.missingContactCount / metrics.totalAccounts) < 0.1 ? 'border-l-emerald-500' : 'border-l-amber-500'}`}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-black uppercase tracking-wider text-slate-500 flex items-center gap-2">
                <ServerCrash className="w-4 h-4" />
                Missing Contacts
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black text-slate-900">
                  {metrics.missingContactCount}
                </span>
                <span className="text-sm font-medium text-slate-500">
                  accounts
                </span>
              </div>
              <p className="text-xs font-medium text-slate-500 mt-2">
                Customers missing both phone and email records.
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Import Diffing Stub */}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Info className="w-5 h-5 text-indigo-500" />
            Recent Import Diffs
          </CardTitle>
          <CardDescription>
            When CRM data is imported, see what changed before accepting it. (Coming Soon)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="bg-slate-50 border border-slate-100 rounded-xl p-8 text-center flex flex-col items-center">
            <Database className="w-8 h-8 text-slate-300 mb-3" />
            <h3 className="text-sm font-bold text-slate-900 mb-1">Import Diffing is active in background</h3>
            <p className="text-xs text-slate-500 max-w-md">
              The system is currently tracking snapshot changes between CRM uploads. The UI for approving and diffing changes will appear here in a future update.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
