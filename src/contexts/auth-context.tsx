"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';
import { User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { useUser, useFirestore } from '@/firebase';

export type UserRole = 'LEADER' | 'BDM' | 'ACCOUNT_MANAGER' | 'GM' | 'GUEST';
export type Territory = 'METRO_NORTH' | 'METRO_SOUTH' | 'WESTERN_TRADE_COAST' | 'REGIONAL' | 'FLEX';

export interface UserProfile {
  uid: string;
  name: string;
  role: UserRole;
  territory?: Territory;
  state?: 'WA' | 'SA' | 'QLD';
  zones?: string[];
  specialisation?: string;
  salesforceUserId?: string;
  planType?: string;
  assignedAgents?: string[];
  isMock?: boolean;
  target?: number;
  email?: string;
}

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  isLeader: boolean;
  isBDM: boolean;
  isAM: boolean;
  isGM: boolean;
  isGuest: boolean;
  setMockAuth: (profile: UserProfile | null) => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  isLeader: false,
  isBDM: false,
  isAM: false,
  isGM: false,
  isGuest: false,
  setMockAuth: () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user: firebaseUser, isUserLoading } = useUser();
  const db = useFirestore();
  
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [mockProfile, setMockProfile] = useState<UserProfile | null>(null);

  const setMockAuth = (profile: UserProfile | null) => {
    setMockProfile(profile);
  };

  useEffect(() => {
    async function fetchProfile() {
      // Handle mock profile first
      if (mockProfile) {
        setProfile(mockProfile);
        setProfileLoading(false);
        return;
      }

      // Wait for firebase user state to stabilize
      if (isUserLoading) {
        setProfileLoading(true);
        return;
      }

      // No user, no profile
      if (!firebaseUser) {
        setProfile(null);
        setProfileLoading(false);
        return;
      }

      // Load profile from firestore
      if (!db) return;

      try {
        const docRef = doc(db, 'users', firebaseUser.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setProfile({ uid: firebaseUser.uid, ...docSnap.data() } as UserProfile);
        } else {
          setProfile(null);
        }
      } catch (e) {
        console.error("AuthContext: Error fetching profile", e);
      } finally {
        setProfileLoading(false);
      }
    }

    fetchProfile();
  }, [firebaseUser, isUserLoading, db, mockProfile]);

  const value = {
    user: mockProfile ? ({ uid: mockProfile.uid, email: 'demo@example.com' } as User) : firebaseUser,
    profile,
    loading: isUserLoading || profileLoading,
    isLeader: profile?.role === 'LEADER' || profile?.role === 'GM' || firebaseUser?.uid === 'eFPAFC5wauPrnguvwzebKssdpSg2',
    isBDM: profile?.role === 'BDM',
    isAM: profile?.role === 'ACCOUNT_MANAGER',
    isGM: profile?.role === 'GM' || firebaseUser?.uid === 'eFPAFC5wauPrnguvwzebKssdpSg2',
    isGuest: profile?.role === 'GUEST',
    setMockAuth,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);
