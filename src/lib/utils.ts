import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { format, startOfWeek, differenceInCalendarWeeks, isBefore } from "date-fns"

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
export function getWeekForDate(date: Date): string {
  let currentYear = date.getFullYear();
  
  // Find first Monday of April for current year
  let firstMondayOfApril = new Date(currentYear, 3, 1);
  while (firstMondayOfApril.getDay() !== 1) {
    firstMondayOfApril.setDate(firstMondayOfApril.getDate() + 1);
  }
  
  // If we are before the first Monday of April this year, 
  // we belong to the previous financial year.
  if (isBefore(date, firstMondayOfApril)) {
    currentYear -= 1;
    firstMondayOfApril = new Date(currentYear, 3, 1);
    while (firstMondayOfApril.getDay() !== 1) {
      firstMondayOfApril.setDate(firstMondayOfApril.getDate() + 1);
    }
  }
  
  const weekNumber = differenceInCalendarWeeks(date, firstMondayOfApril, { weekStartsOn: 1 }) + 1;
  const paddedWeek = weekNumber.toString().padStart(2, '0');
  return `${currentYear}-${paddedWeek}`;
}

/**
 * Canonical week key for all Firestore weekly documents.
 */
export function getCurrentWeek(): string {
  return getWeekForDate(new Date());
}

/**
 * Returns all financial week keys that fall within the current calendar month.
 */
export function getCurrentMonthWeeks(): string[] {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const weeks = new Set<string>();
  
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  for (let i = 1; i <= daysInMonth; i++) {
    const d = new Date(year, month, i);
    weeks.add(getWeekForDate(d));
  }
  
  return Array.from(weeks);
}

/**
 * Dynamically formats currency amounts (EAV):
 * - If < $1,000, returns raw value: e.g., "$500"
 * - If >= $1,000 and < $1,000,000, formats in thousands: e.g., "$15k", "$200k"
 * - If >= $1,000,000, formats in millions: e.g., "$1.2M", "$12.0M"
 */
export function formatEAV(val: number): string {
  const absoluteValue = Math.abs(val);
  if (absoluteValue >= 1000000) {
    const formatted = (val / 1000000).toFixed(1);
    // Remove trailing .0 if present
    return `$${formatted.endsWith('.0') ? formatted.slice(0, -2) : formatted}M`;
  }
  if (absoluteValue >= 1000) {
    return `$${(val / 1000).toFixed(0)}K`;
  }
  return `$${val.toFixed(0)}`;
}

