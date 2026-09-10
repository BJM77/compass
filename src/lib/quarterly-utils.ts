export type FinancialQuarter = 'Q1' | 'Q2' | 'Q3' | 'Q4' | 'UNKNOWN';

export interface QuarterData {
  label: FinancialQuarter;
  year: number; // e.g., FY24 (starts April 2023)
}

export interface FinancialProgressTracking {
  currentQuarter: FinancialQuarter;
  financialYear: number;
  monthName: string;
  financialMonthIndex: number; // 1 (April) to 12 (March)
  totalFinancialMonths: number; // 12
  quarterMonthIndex: number; // 1, 2, or 3 within the quarter
  dayOfMonth: number; // e.g., 8
  daysInCurrentMonth: number; // e.g., 30
  exactElapsedMonths: number; // e.g., 5.267 (5 completed months + 8/30 of current month)
  yearProgressPct: number; // (exactElapsedMonths / 12) * 100 (e.g., 43.89%)
  eomYearProgressPct: number; // (financialMonthIndex / 12) * 100 (e.g., 50.0%)
  prevEomYearProgressPct: number; // ((financialMonthIndex - 1) / 12) * 100
  exactElapsedWeeks: number; // exact weeks elapsed since Apr 1
  completedWeeks: number; // full weeks completed since Apr 1
  weeklyYearProgressPct: number; // (completedWeeks / 52) * 100
  quarterProgressPct: number; // percentage through current quarter
}

/**
 * Maps a given Date to the custom financial quarter.
 * Q1: April - June
 * Q2: July - September
 * Q3: October - December
 * Q4: January - March
 */
export function getFinancialQuarter(date: Date): QuarterData {
  if (!date || isNaN(date.getTime())) return { label: 'UNKNOWN', year: 0 };
  
  const month = date.getMonth(); // 0-indexed (0 = Jan, 11 = Dec)
  const year = date.getFullYear();
  
  if (month >= 3 && month <= 5) return { label: 'Q1', year: year + 1 }; // Apr, May, Jun (e.g. Apr 2024 -> FY25)
  if (month >= 6 && month <= 8) return { label: 'Q2', year: year + 1 }; // Jul, Aug, Sep
  if (month >= 9 && month <= 11) return { label: 'Q3', year: year + 1 }; // Oct, Nov, Dec
  return { label: 'Q4', year: year }; // Jan, Feb, Mar (e.g. Jan 2024 -> FY24)
}

/**
 * Parses a week string (e.g., "2024-12", "2024-W12", "2024-12-01", etc.) or firebase timestamp 
 * and returns the quarter.
 * Q1: Weeks 1-13 (Apr - Jun)
 * Q2: Weeks 14-26 (Jul - Sep)
 * Q3: Weeks 27-39 (Oct - Dec)
 * Q4: Weeks 40-52 (Jan - Mar)
 */
export function getQuarterFromActivity(activity: any): QuarterData {
  if (!activity) return { label: 'UNKNOWN', year: 0 };

  // 1. Direct timestamp match
  if (activity.createdAt) {
    const d = activity.createdAt.toDate ? activity.createdAt.toDate() : new Date(activity.createdAt);
    if (!isNaN(d.getTime())) return getFinancialQuarter(d);
  }

  if (activity.uploadedAt) {
    const d = activity.uploadedAt.toDate ? activity.uploadedAt.toDate() : new Date(activity.uploadedAt);
    if (!isNaN(d.getTime())) return getFinancialQuarter(d);
  }

  // 2. Week string parsing
  if (activity.week && typeof activity.week === 'string') {
    const clean = activity.week.trim();
    
    // Check if ISO date "YYYY-MM-DD"
    if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) {
      const d = new Date(clean);
      if (!isNaN(d.getTime())) return getFinancialQuarter(d);
    }

    // Check financial week key format "YYYY-WW" (e.g. "2024-05", "2024-W05")
    const parts = clean.split('-');
    if (parts.length === 2) {
      const year = parseInt(parts[0], 10);
      const weekNum = parseInt(parts[1].replace(/[^0-9]/g, ''), 10);

      if (!isNaN(weekNum) && !isNaN(year)) {
        if (weekNum >= 1 && weekNum <= 13) return { label: 'Q1', year };
        if (weekNum >= 14 && weekNum <= 26) return { label: 'Q2', year };
        if (weekNum >= 27 && weekNum <= 39) return { label: 'Q3', year };
        if (weekNum >= 40) return { label: 'Q4', year };
      }
    }
  }

  // Fallback: If no date could be parsed, check current date
  return { label: 'UNKNOWN', year: 0 };
}

/**
 * Calculates current financial year calendar position:
 * Financial Year starts April 1st and ends March 31st.
 * - Month 1: April (Q1)
 * - Month 6: September (Q2)
 * - Month 9: December (Q3)
 * - Month 12: March (Q4)
 * 
 * Supports accurate day-prorated actual date calculations so target pacing
 * is not artificially punitive early in the month.
 */
export function getCurrentFinancialProgress(date: Date = new Date()): FinancialProgressTracking {
  const month = date.getMonth(); // 0 = Jan, 3 = Apr, 11 = Dec
  const year = date.getFullYear();
  const dayOfMonth = date.getDate();
  const daysInCurrentMonth = new Date(year, month + 1, 0).getDate();

  // Financial month index: April = 1, May = 2, ..., March = 12
  const financialMonthIndex = month >= 3 ? month - 3 + 1 : month + 9 + 1;
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  const monthName = monthNames[month];

  // Exact prorated months: (completed full months) + (day / totalDays in current month)
  const completedFullMonths = financialMonthIndex - 1;
  const currentMonthFraction = Math.min(1, Math.max(0, dayOfMonth / daysInCurrentMonth));
  const exactElapsedMonths = completedFullMonths + currentMonthFraction;

  let currentQuarter: FinancialQuarter = 'Q1';
  let quarterMonthIndex = 1;
  let financialYear = year;

  if (month >= 3 && month <= 5) {
    currentQuarter = 'Q1';
    quarterMonthIndex = month - 3 + 1; // 1, 2, 3 (Apr, May, Jun)
    financialYear = year + 1;
  } else if (month >= 6 && month <= 8) {
    currentQuarter = 'Q2';
    quarterMonthIndex = month - 6 + 1; // 1, 2, 3 (Jul, Aug, Sep)
    financialYear = year + 1;
  } else if (month >= 9 && month <= 11) {
    currentQuarter = 'Q3';
    quarterMonthIndex = month - 9 + 1; // 1, 2, 3 (Oct, Nov, Dec)
    financialYear = year + 1;
  } else {
    currentQuarter = 'Q4';
    quarterMonthIndex = month + 1; // 1, 2, 3 (Jan, Feb, Mar)
    financialYear = year;
  }

  const financialYearStart = new Date(financialYear - 1, 3, 1); // April 1st of the starting year
  // If financialYear is 2024, that means it started April 2023. Wait, financialYear in this app is the year it starts or ends?
  // If month is April 2024, year = 2024, financialYear = 2025.
  // So it started April 2024. Therefore start date is `new Date(financialYear - 1, 3, 1)`
  
  const fyStartYear = month >= 3 ? year : year - 1;
  const fyStartDate = new Date(fyStartYear, 3, 1);
  while (fyStartDate.getDay() !== 1) { // 1 = Monday
    fyStartDate.setDate(fyStartDate.getDate() - 1);
  }
  const diffTime = Math.max(0, date.getTime() - fyStartDate.getTime());
  const exactElapsedWeeks = diffTime / (1000 * 60 * 60 * 24 * 7);
  const completedWeeks = Math.floor(exactElapsedWeeks);

  const yearProgressPct = (exactElapsedMonths / 12) * 100;
  const eomYearProgressPct = (financialMonthIndex / 12) * 100;
  const prevEomYearProgressPct = (completedFullMonths / 12) * 100;
  const weeklyYearProgressPct = (completedWeeks / 52) * 100;
  const quarterProgressPct = ((quarterMonthIndex - 1 + currentMonthFraction) / 3) * 100;

  return {
    currentQuarter,
    financialYear,
    monthName,
    financialMonthIndex,
    totalFinancialMonths: 12,
    quarterMonthIndex,
    dayOfMonth,
    daysInCurrentMonth,
    exactElapsedMonths,
    exactElapsedWeeks,
    completedWeeks,
    yearProgressPct,
    eomYearProgressPct,
    prevEomYearProgressPct,
    weeklyYearProgressPct,
    quarterProgressPct
  };
}

/**
 * Calculates the expected YTD benchmark target for a given annual target
 * based on elapsed financial time.
 * @param annualTarget Total annual revenue target
 * @param date Reference date
 * @param useExactDate If true, prorates to the exact day of the month. If false, uses full month-end benchmark.
 */
export function calculateYtdExpectedTarget(
  annualTarget: number, 
  date: Date = new Date(),
  mode: boolean | 'EXACT_DAY' | 'EOM' | 'PREV_EOM' | 'WEEKLY' = true,
  manualYtdTarget?: number
): number {
  if (manualYtdTarget && manualYtdTarget > 0) {
    return manualYtdTarget;
  }

  const { exactElapsedMonths, financialMonthIndex, completedWeeks } = getCurrentFinancialProgress(date);
  
  if (mode === 'WEEKLY') {
    return (annualTarget / 52) * completedWeeks;
  }
  
  let months = exactElapsedMonths;
  if (mode === 'EOM') {
    months = financialMonthIndex;
  } else if (mode === 'PREV_EOM') {
    months = Math.max(0, financialMonthIndex - 1);
  }
  
  return (annualTarget / 12) * months;
}
