import { describe, it, expect } from "vitest";
import { normalizeBdmName, isUserSubmissionMatch } from "../utils";

describe("Namra Khan Identity & Data Matching Audit", () => {
  const namraUser = {
    id: "namra-khan-uid-123",
    name: "Namra Khan",
    allIds: ["namra-khan-uid-123", "namra_legacy_id"],
  };

  it("normalizes variations of Namra's name accurately", () => {
    expect(normalizeBdmName("Namra Khan")).toBe("Namra Khan");
    expect(normalizeBdmName("namra")).toBe("Namra Khan");
    expect(normalizeBdmName("Khan, Namra")).toBe("Namra Khan");
    expect(normalizeBdmName("BDM (Namra Khan)")).toBe("Namra Khan");
  });

  it("matches Namra's submissions by Auth UID", () => {
    const sub = {
      userId: "namra-khan-uid-123",
      userName: "Namra Khan",
      salespersonName: "Namra Khan",
    };
    expect(isUserSubmissionMatch(namraUser, sub)).toBe(true);
  });

  it("matches Namra's submissions by document ID prefix", () => {
    const sub = {
      id: "namra-khan-uid-123_2026-36",
      userId: "namra-khan-uid-123",
    };
    expect(isUserSubmissionMatch(namraUser, sub)).toBe(true);
  });

  it("matches Namra's legacy submission entries by name fallback", () => {
    const sub = {
      userId: "old_namra_id",
      salespersonName: "Namra Khan",
    };
    expect(isUserSubmissionMatch(namraUser, sub)).toBe(true);
  });
});
