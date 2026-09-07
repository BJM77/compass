import { useFeatureFlags } from "@/context/feature-flags-context";
import { Role } from "@/types/feature-flags";

export const useFeatureFlag = (key: string, user?: { id?: string; role?: Role }): boolean => {
  const { isFeatureEnabled } = useFeatureFlags();
  return isFeatureEnabled(key, user);
};
