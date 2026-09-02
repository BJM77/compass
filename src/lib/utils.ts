import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { format, startOfWeek, differenceInCalendarWeeks, isBefore } from "date-fns"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Determines the appropriate Tailwind col-span class for a widget
 * based on its configured width and the current screen size.
 */
export function getWidgetSpanClass(width: 1 | 2 | 3): string {
  // On small screens (mobile), we use a 2-column grid.
  // A widget configured as width: 3 will be forced to take up 2 columns.
  // width: 1 and width: 2 will take up 1 column each.
  if (width === 3) {
    return 'col-span-2 sm:col-span-2 md:col-span-3 lg:col-span-3';
  }
  // width: 2 also takes up 2 columns on mobile to keep them full-width.
  if (width === 2) {
    return 'col-span-2 sm:col-span-2 md:col-span-2 lg:col-span-2';
  }
  // width: 1 takes up 1 column on all screens.
  return 'col-span-1 sm:col-span-1 md:col-span-1 lg:col-span-1';
}

/**
 * Normalizes BDM/AM names to prevent duplicates (e.g. "Namra", "namra_khan", "BDM (Namra)" -> "Namra Khan").
 */
export function normalizeBdmName(name?: string, id?: string): string {
  const str = (name || id || '').trim();
  if (!str) return 'Unassigned';
  const lower = str.toLowerCase();

  if (lower.includes('namra') || lower.includes('khan')) return 'Namra Khan';
  if (lower.includes('jacqui') || lower.includes('tibos')) return 'Jacqui Tibos';
  if (lower.includes('joanne') || lower.includes('ballantyne')) return 'Joanne Ballantyne';
  if (lower.includes('joshua') || lower.includes('mostratos')) return 'Joshua Mostratos';
  if (lower.includes('rienzie') || lower.includes('delilkan')) return 'Rienzie Delilkan';
  if (lower.includes('isaac') || lower.includes('pina') || lower.includes('depina')) return 'Isaac De Pina';

  if (str.startsWith('BDM (') && str.endsWith(')')) {
    return str.substring(5, str.length - 1).trim();
  }

  return str;
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
 * Generate Salesforce Lightning URL for creating a new Lead with pre-populated field values.
 */
export function createSalesforceLeadUrl(lead: {
  companyName?: string;
  firstName?: string;
  lastName?: string;
  title?: string;
  phone?: string;
  email?: string;
  preferredContactMethod?: string;
  addressLine1?: string;
  addressLine2?: string;
  suburb?: string;
  state?: string;
  postcode?: string;
  country?: string;
  industry?: string;
  businessUnit?: string;
  services?: string[];
  freightProfile?: string;
  quoteNumber?: string;
  estimatedRevenue?: number;
  incumbent?: string;
  otherIncumbent?: string;
  leadSource?: string;
  leadType?: string;
  leadStatus?: string;
  leadTopic?: string;
  notes?: string;
}) {
  const streetParts = [lead.addressLine1, lead.addressLine2].filter(Boolean).join(', ');
  
  const values: Record<string, string> = {};
  if (lead.companyName) values['Company'] = lead.companyName;
  if (lead.firstName) values['FirstName'] = lead.firstName;
  if (lead.lastName) values['LastName'] = lead.lastName;
  if (lead.title) values['Title'] = lead.title;
  if (lead.phone) values['Phone'] = lead.phone;
  if (lead.email) values['Email'] = lead.email;
  if (streetParts) values['Street'] = streetParts;
  if (lead.suburb) values['City'] = lead.suburb;
  if (lead.state) values['State'] = lead.state;
  if (lead.postcode) values['PostalCode'] = lead.postcode;
  values['Country'] = lead.country || 'Australia';
  if (lead.leadSource) values['LeadSource'] = lead.leadSource;
  if (lead.leadStatus) values['Status'] = lead.leadStatus;
  if (lead.industry) values['Industry'] = lead.industry;
  if (lead.estimatedRevenue) values['AnnualRevenue'] = String(lead.estimatedRevenue);

  let descParts: string[] = [];
  if (lead.leadTopic) descParts.push(`Topic: ${lead.leadTopic}`);
  if (lead.businessUnit) descParts.push(`Business Unit: ${lead.businessUnit}`);
  if (lead.services && lead.services.length > 0) descParts.push(`Services: ${lead.services.join(', ')}`);
  if (lead.freightProfile) descParts.push(`Freight Profile: ${lead.freightProfile}`);
  if (lead.incumbent) descParts.push(`Incumbent: ${lead.incumbent}${lead.otherIncumbent ? ` (${lead.otherIncumbent})` : ''}`);
  if (lead.preferredContactMethod) descParts.push(`Preferred Contact: ${lead.preferredContactMethod}`);
  if (lead.quoteNumber) descParts.push(`Quote (QBL): ${lead.quoteNumber}`);
  if (lead.notes) descParts.push(`\nNotes:\n${lead.notes}`);

  if (descParts.length > 0) {
    values['Description'] = descParts.join('\n');
  }

  // Salesforce Lightning standard defaultFieldValues format: Field1=Val1,Field2=Val2
  // We construct the key=value pairs, escaping commas in the values with a backslash (\,),
  // and then URL-encode the entire parameter to prevent special characters (&, ?, #, etc.) from breaking the URL structure.
  const rawDefaultFields = Object.entries(values)
    .map(([k, v]) => {
      const cleanValue = String(v).replace(/,/g, '\\,');
      return `${k}=${cleanValue}`;
    })
    .join(',');

  const defaultFieldValues = encodeURIComponent(rawDefaultFields);

  return `https://teamglobalexp.lightning.force.com/lightning/o/Lead/new?nooverride=1&defaultFieldValues=${defaultFieldValues}`;
}

export function openSalesforceCreateLead(lead: Parameters<typeof createSalesforceLeadUrl>[0]) {
  const url = createSalesforceLeadUrl(lead);
  window.open(url, '_blank');
}

/**
 * Canonical week key for all Firestore weekly documents.
 * Uses Sunday as week start for consistent alignment across 
 * Monday Planning, Friday Synthesis, and GM Report aggregation.
 * Aligns with April to March Financial Year.
 */
export function getWeekForDate(date: Date): string {
  let currentYear = date.getFullYear();
  
  // Find first Sunday of April for current year
  let firstSundayOfApril = new Date(currentYear, 3, 1);
  while (firstSundayOfApril.getDay() !== 0) {
    firstSundayOfApril.setDate(firstSundayOfApril.getDate() + 1);
  }
  
  // If we are before the first Sunday of April this year, 
  // we belong to the previous financial year.
  if (isBefore(date, firstSundayOfApril)) {
    currentYear -= 1;
    firstSundayOfApril = new Date(currentYear, 3, 1);
    while (firstSundayOfApril.getDay() !== 0) {
      firstSundayOfApril.setDate(firstSundayOfApril.getDate() + 1);
    }
  }
  
  const weekNumber = differenceInCalendarWeeks(date, firstSundayOfApril, { weekStartsOn: 0 }) + 1;
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
  return getMonthWeeksForDate(new Date());
}

export function getMonthWeeksForDate(date: Date): string[] {
  const year = date.getFullYear();
  const month = date.getMonth();
  const weeks = new Set<string>();
  
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  for (let i = 1; i <= daysInMonth; i++) {
    const d = new Date(year, month, i);
    weeks.add(getWeekForDate(d));
  }
  
  return Array.from(weeks);
}

export function getMonthWeeksForWeek(weekKey: string): string[] {
  // Find a date that matches this weekKey
  const now = new Date();
  let searchDate = new Date(now.getFullYear(), 0, 1);
  let found = false;
  // Search up to 2 years back and 1 year forward
  for (let i = -700; i < 365; i++) {
    const d = new Date(now.getFullYear(), 0, i);
    if (getWeekForDate(d) === weekKey) {
      searchDate = d;
      found = true;
      break;
    }
  }
  if (!found) return [weekKey];
  return getMonthWeeksForDate(searchDate);
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

/**
 * Resolves the next financial week key after the given weekKey.
 * e.g., "2026-10" -> "2026-11". Gracefully transitions years by adding 7 days to a date in the given week.
 */
export function getNextWeekKey(weekKey: string): string {
  const [yearStr, weekStr] = weekKey.split('-');
  const year = parseInt(yearStr, 10);
  const weekNum = parseInt(weekStr, 10);

  if (isNaN(year) || isNaN(weekNum)) {
    return getWeekForDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000));
  }

  // Find a matching date for the weekKey (similar to getMonthWeeksForWeek)
  let searchDate = new Date(year, 3, 1); // Start around April of that financial year
  let found = false;
  for (let i = -10; i < 370; i++) {
    const d = new Date(year, 3, 1 + i);
    if (getWeekForDate(d) === weekKey) {
      searchDate = d;
      found = true;
      break;
    }
  }

  const nextWeekDate = new Date(searchDate.getTime() + 7 * 24 * 60 * 60 * 1000);
  return getWeekForDate(nextWeekDate);
}



export function getPreviousWeekKey(weekKey: string): string {
  const [yearStr, weekStr] = weekKey.split('-');
  const year = parseInt(yearStr, 10);
  const weekNum = parseInt(weekStr, 10);

  if (isNaN(year) || isNaN(weekNum)) {
    return getWeekForDate(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000));
  }

  // Find a matching date for the weekKey (similar to getNextWeekKey logic)
  let searchDate = new Date(year, 3, 1);
  for (let i = -10; i < 370; i++) {
    const d = new Date(year, 3, 1 + i);
    if (getWeekForDate(d) === weekKey) {
      searchDate = d;
      break;
    }
  }

  const prevWeekDate = new Date(searchDate.getTime() - 7 * 24 * 60 * 60 * 1000);
  return getWeekForDate(prevWeekDate);
}
