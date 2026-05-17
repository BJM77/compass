import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { format, startOfWeek } from "date-fns"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Intelligent Salesforce Router
 * 
 * Priority 1: If a Salesforce Record ID is provided, navigate directly to the record.
 *   This is the most reliable method and should be used as BDMs populate SF IDs.
 *   Format: https://[org].lightning.force.com/lightning/r/[ID]/view
 * 
 * Priority 2: Fall back to SOSL search by account/opportunity name.
 *   Uses the stable UnifiedSearchResults endpoint which works across Lightning org versions.
 */
export function openSalesforceSearch(term: string, salesforceId?: string) {
  if (!term || term === 'TEAM CAMPAIGN') return;

  // If a Salesforce Record ID is stored, open the exact record — most reliable
  if (salesforceId && salesforceId.trim().length > 0) {
    const recordUrl = `https://teamglobalexp.lightning.force.com/lightning/r/${salesforceId.trim()}/view`;
    window.open(recordUrl, '_blank');
    return;
  }

  // Fallback: search by name using the stable SOSL search endpoint
  const cleanTerm = term.split(' (')[0].split(' - ')[0].trim();
  const searchUrl = `https://teamglobalexp.lightning.force.com/_ui/search/ui/UnifiedSearchResults?searchType=2&str=${encodeURIComponent(cleanTerm)}`;
  window.open(searchUrl, '_blank');
}

/**
 * Canonical week key for all Firestore weekly documents.
 * Uses Monday as week start for consistent alignment across 
 * Monday Planning, Friday Synthesis, and GM Report aggregation.
 */
export function getCurrentWeek(): string {
  return format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-ww');
}
