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
  isLoading: boolean;
  activeUserId: string | null;
  setActiveUserId: (id: string | null) => void;
  simulationUid: string | null;
  setSimulationUid: (id: string | null) => void;
}

const PipelineContext = createContext<PipelineContextType>({
  pipelineReviews: [],
  weeklyProgresses: [],
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
      return query(collection(db, 'pipelineReviews'), where('week', '==', currentWeek));
    } else if (activeUserId) {
      // BDM or Leader simulating sees specific user deals
      return query(collection(db, 'pipelineReviews'), where('userId', '==', activeUserId), where('week', '==', currentWeek));
    }
    return null;
  }, [db, currentWeek, isLeader, activeUserId, simulationUid]);

  const { data: pipelineReviews, isLoading: isPipelineLoading } = useCollection(pipelineQuery);

  // Weekly Progress Query
  const progressQuery = useMemoFirebase(() => {
    if (!db) return null;
    if (isLeader && !simulationUid) {
      return query(collection(db, 'weeklyProgress'), where('week', '==', currentWeek));
    } else if (activeUserId) {
      return query(collection(db, 'weeklyProgress'), where('userId', '==', activeUserId), where('week', '==', currentWeek));
    }
    return null;
  }, [db, currentWeek, isLeader, activeUserId, simulationUid]);

  const { data: weeklyProgresses, isLoading: isProgressLoading } = useCollection(progressQuery);

  return (
    <PipelineContext.Provider value={{
      pipelineReviews: (pipelineReviews || []) as PipelineReview[],
      weeklyProgresses: (weeklyProgresses || []) as WeeklyProgress[],
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
