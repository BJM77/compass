"use client";

import React, { createContext, useContext } from 'react';
import { useAuth } from './auth-context';
import { useFirestore, useMemoFirebase, useCollection } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import { getCurrentWeek } from '@/lib/utils';
import { PipelineReview, WeeklyProgress } from '@/types/crm';

interface PipelineContextType {
  pipelineReviews: PipelineReview[];
  weeklyProgresses: WeeklyProgress[];
  allPipelineReviews: PipelineReview[];
  allWeeklyProgresses: WeeklyProgress[];
  isLoading: boolean;
  activeUserId: string | null;
  setActiveUserId: (id: string | null) => void;
  simulationUid: string | null;
  setSimulationUid: (id: string | null) => void;
}

const PipelineContext = createContext<PipelineContextType>({
  pipelineReviews: [],
  weeklyProgresses: [],
  allPipelineReviews: [],
  allWeeklyProgresses: [],
  isLoading: true,
  activeUserId: null,
  setActiveUserId: () => {},
  simulationUid: null,
  setSimulationUid: () => {},
});

export const PipelineProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isLeader } = useAuth();
  const db = useFirestore();
  const currentWeek = getCurrentWeek();

  // State for simulated user ID
  const [simulationUid, setSimulationUid] = React.useState<string | null>(null);
  
  const activeUserId = simulationUid || user?.uid || null;

  // Pipeline Reviews Query
  const pipelineQuery = useMemoFirebase(() => {
    if (!db) return null;
    if (isLeader && !simulationUid) {
      // Leader sees all deals if not simulating
      return query(collection(db, 'pipelineReviews'));
    } else if (activeUserId) {
      // BDM or Leader simulating sees specific user deals
      return query(collection(db, 'pipelineReviews'), where('userId', '==', activeUserId));
    }
    return null;
  }, [db, isLeader, activeUserId, simulationUid]);

  const { data: rawPipelineReviews, isLoading: isPipelineLoading } = useCollection(pipelineQuery);

  // Weekly Progress Query
  const progressQuery = useMemoFirebase(() => {
    if (!db) return null;
    if (isLeader && !simulationUid) {
      return query(collection(db, 'weeklyProgress'));
    } else if (activeUserId) {
      return query(collection(db, 'weeklyProgress'), where('userId', '==', activeUserId));
    }
    return null;
  }, [db, isLeader, activeUserId, simulationUid]);

  const { data: rawWeeklyProgresses, isLoading: isProgressLoading } = useCollection(progressQuery);

  const allPipelineReviews = (rawPipelineReviews || []).filter(
    (r: any) => !r.userName || r.userName.toUpperCase() !== 'JOHN THORNTON'
  ) as PipelineReview[];
  
  const allWeeklyProgresses = (rawWeeklyProgresses || []).filter(
    (r: any) => !r.userName || r.userName.toUpperCase() !== 'JOHN THORNTON'
  ) as WeeklyProgress[];

  const pipelineReviews = React.useMemo(() => {
    const latestMap = new Map<string, PipelineReview>();
    allPipelineReviews.forEach(r => {
      const key = r.salesforceId || r.accountMasterCode || r.id;
      if (!key) return;
      const existing = latestMap.get(key);
      if (!existing || (r.week || '') > (existing.week || '')) {
        latestMap.set(key, r);
      }
    });
    return Array.from(latestMap.values());
  }, [allPipelineReviews]);

  const weeklyProgresses = React.useMemo(() => {
    const latestUserMap = new Map<string, WeeklyProgress>();
    allWeeklyProgresses.forEach(r => {
      const existing = latestUserMap.get(r.userId);
      if (!existing || (r.week || '') > (existing.week || '')) {
        latestUserMap.set(r.userId, r);
      }
    });
    return Array.from(latestUserMap.values());
  }, [allWeeklyProgresses]);

  return (
    <PipelineContext.Provider value={{
      pipelineReviews,
      weeklyProgresses,
      allPipelineReviews,
      allWeeklyProgresses,
      isLoading: isPipelineLoading || isProgressLoading,
      activeUserId,
      setActiveUserId: setSimulationUid,
      simulationUid,
      setSimulationUid,
    }}>
      {children}
    </PipelineContext.Provider>
  );
};

export const usePipelineData = () => useContext(PipelineContext);
