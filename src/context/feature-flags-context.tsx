import React, { createContext, useContext, useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { FeatureFlag, FeatureFlagsDocument, Role } from "@/types/feature-flags";

interface UserContext {
  id?: string;
  role?: Role;
}

interface FeatureFlagsContextType {
  flags: Record<string, FeatureFlag>;
  loading: boolean;
  isFeatureEnabled: (key: string, user?: UserContext) => boolean;
}

const FeatureFlagsContext = createContext<FeatureFlagsContextType>({
  flags: {},
  loading: true,
  isFeatureEnabled: () => false,
});

export const evaluateFeatureFlag = (
  flag: FeatureFlag | undefined,
  user?: UserContext
): boolean => {
  if (!flag) return false;

  // Precedence 1: Global Disabled
  if (!flag.enabled) return false;

  // Precedence 2: User-specific Override
  if (flag.rollout?.userIds && user?.id) {
    if (flag.rollout.userIds.includes(user.id)) return true;
  }

  // Precedence 3: Role-specific Override
  if (flag.rollout?.roles && user?.role) {
    if (flag.rollout.roles.includes(user.role)) return true;
  }

  // Precedence 4: Fallback based on denyByDefault
  // If denyByDefault is false (e.g. UI feature), missing specific rollout means allowed globally if enabled.
  // If denyByDefault is true (e.g. AI cost feature), missing targeted rollout means denied unless role/user matched.
  if (flag.denyByDefault) {
    // If it has explicit role/user rollout targeting, but user didn't match, deny
    const hasTargeting = (flag.rollout?.roles && flag.rollout.roles.length > 0) ||
                         (flag.rollout?.userIds && flag.rollout.userIds.length > 0);
    return !hasTargeting;
  }

  return true;
};

export const FeatureFlagsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [flags, setFlags] = useState<Record<string, FeatureFlag>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const docRef = doc(db, "appSettings", "featureFlags");
    const unsubscribe = onSnapshot(
      docRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data() as FeatureFlagsDocument;
          setFlags(data.flags || {});
        } else {
          setFlags({});
        }
        setLoading(false);
      },
      (error) => {
        console.error("Error listening to featureFlags settings doc:", error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const isFeatureEnabled = (key: string, user?: UserContext): boolean => {
    const flag = flags[key];
    if (!flag) {
      // Default fallback if flag config document doesn't define this key yet
      return false;
    }
    return evaluateFeatureFlag(flag, user);
  };

  return (
    <FeatureFlagsContext.Provider value={{ flags, loading, isFeatureEnabled }}>
      {children}
    </FeatureFlagsContext.Provider>
  );
};

export const useFeatureFlags = () => useContext(FeatureFlagsContext);
