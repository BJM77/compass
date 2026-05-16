import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { format, startOfWeek } from "date-fns"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Intelligent Salesforce Router
 * Reconfigured to use the Search Dispatcher protocol. 
 * This is the most robust method for Lightning as it forces Salesforce 
 * to handle the term (ID or Name) and redirect accordingly, avoiding "Page Not Found" 
 * errors caused by malformed direct record paths or incorrect object type assumptions.
 */
export function openSalesforceSearch(term: string) {
  if (!term || term === 'TEAM CAMPAIGN') return;
  
  // Clean the term: strip parentheticals or secondary IDs to get the core searchable entity
  // e.g. "AFGRI EQUIPMENT (UTAKARRA)" -> "AFGRI EQUIPMENT"
  // e.g. "0012P000002MRmUQAW" -> stays as ID (SF Search natively resolves IDs to records)
  const cleanTerm = term.split(' (')[0].split(' - ')[0].trim();
  
  // Lightning Global Search via Query Parameter - most reliable across org variations
  const searchUrl = `https://teamglobalexp.lightning.force.com/lightning/globalSearch/searchTerm?q=${encodeURIComponent(cleanTerm)}`;
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
