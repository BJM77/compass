"use client";

import { useMemo } from 'react';
import { deduplicateUsers, normalizeBdmName } from '@/lib/utils';

export interface IdentityAuditResult {
  validUidSet: Set<string>;
  knownLegacyIds: Set<string>;
  normalizedNameToUserMap: Map<string, any>;
  dedupedUsers: any[];
  userCount: number;
  duplicateNameWarnings: { name: string; docs: any[] }[];
  isValidUserId: (userId?: string | null) => { isValid: boolean; isAuthUid: boolean; isKnownLegacy: boolean; resolvedName?: string };
}

/**
 * Shared identity audit hook that builds the authorized UID pool from users registry once.
 * Provides instant checking for whether an ID on a page is an Auth UID, recognized legacy ID, or orphaned.
 */
export function useIdentityAudit(users: any[] | null | undefined): IdentityAuditResult {
  return useMemo(() => {
    const validUidSet = new Set<string>();
    const knownLegacyIds = new Set<string>();
    const normalizedNameToUserMap = new Map<string, any>();
    const nameOccurrences = new Map<string, any[]>();

    if (!users || !Array.isArray(users)) {
      return {
        validUidSet,
        knownLegacyIds,
        normalizedNameToUserMap,
        dedupedUsers: [],
        userCount: 0,
        duplicateNameWarnings: [],
        isValidUserId: () => ({ isValid: false, isAuthUid: false, isKnownLegacy: false }),
      };
    }

    // Detect duplicates in raw collection (same normalized name or multiple docs)
    users.forEach(u => {
      const norm = normalizeBdmName(u.name || '', u.id);
      if (!nameOccurrences.has(norm)) {
        nameOccurrences.set(norm, []);
      }
      nameOccurrences.get(norm)!.push(u);
    });

    const duplicateNameWarnings: { name: string; docs: any[] }[] = [];
    nameOccurrences.forEach((docs, norm) => {
      if (docs.length > 1 && norm && norm !== 'unknown') {
        duplicateNameWarnings.push({ name: norm, docs });
      }
    });

    // Deduplicate users preferring Auth UID
    const dedupedUsers = deduplicateUsers(users);

    dedupedUsers.forEach(u => {
      const id = u.id || u.uid;
      if (id) {
        validUidSet.add(id);
      }
      const norm = normalizeBdmName(u.name || '', id);
      if (norm) {
        normalizedNameToUserMap.set(norm, u);
      }
    });

    // Helper to evaluate any incoming ID
    const isValidUserId = (userId?: string | null) => {
      if (!userId) return { isValid: false, isAuthUid: false, isKnownLegacy: false };
      const trimmed = userId.trim();
      const isAuthUid = validUidSet.has(trimmed) && trimmed.length >= 20;
      const isKnown = validUidSet.has(trimmed);

      // Find resolved user name if present
      let resolvedName: string | undefined;
      for (const u of dedupedUsers) {
        if (u.id === trimmed || u.uid === trimmed) {
          resolvedName = u.name;
          break;
        }
      }

      return {
        isValid: isKnown,
        isAuthUid,
        isKnownLegacy: isKnown && !isAuthUid,
        resolvedName
      };
    };

    return {
      validUidSet,
      knownLegacyIds,
      normalizedNameToUserMap,
      dedupedUsers,
      userCount: dedupedUsers.length,
      duplicateNameWarnings,
      isValidUserId
    };
  }, [users]);
}
