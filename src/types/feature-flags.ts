export type Role = "admin" | "bdm" | "manager" | "executive";

export type RolloutStrategy = "global" | "role" | "user";

export type FeatureFlag = {
  key: string;
  enabled: boolean;
  rollout?: {
    strategy: RolloutStrategy;
    roles?: Role[];
    userIds?: string[];
  };
  denyByDefault: boolean;
  description?: string;
};

export type FeatureFlagsDocument = {
  flags: Record<string, FeatureFlag>;
  updatedAt?: string;
  updatedBy?: string;
};
