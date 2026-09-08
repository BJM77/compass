import { describe, it, expect } from "vitest";
import { 
  getFinancialQuarter, 
  getQuarterFromActivity, 
  getCurrentFinancialProgress, 
  calculateYtdExpectedTarget 
} from "../quarterly-utils";

describe("Quarterly Financial Date & Activity Utils", () => {
  it("should map calendar dates correctly to financial quarters (Apr-Mar)", () => {
    // Q1: April - June
    const aprDate = new Date(2024, 3, 15); // April 15, 2024
    expect(getFinancialQuarter(aprDate).label).toBe("Q1");

    // Q2: July - September
    const augDate = new Date(2024, 7, 20); // August 20, 2024
    expect(getFinancialQuarter(augDate).label).toBe("Q2");

    // Q3: October - December
    const novDate = new Date(2024, 10, 10); // November 10, 2024
    expect(getFinancialQuarter(novDate).label).toBe("Q3");

    // Q4: January - March
    const febDate = new Date(2025, 1, 5); // February 5, 2025
    expect(getFinancialQuarter(febDate).label).toBe("Q4");
  });

  it("should map financial week keys (YYYY-WW) correctly into quarters", () => {
    // Q1: Weeks 1 - 13
    expect(getQuarterFromActivity({ week: "2024-01" }).label).toBe("Q1");
    expect(getQuarterFromActivity({ week: "2024-13" }).label).toBe("Q1");

    // Q2: Weeks 14 - 26
    expect(getQuarterFromActivity({ week: "2024-14" }).label).toBe("Q2");
    expect(getQuarterFromActivity({ week: "2024-26" }).label).toBe("Q2");

    // Q3: Weeks 27 - 39
    expect(getQuarterFromActivity({ week: "2024-27" }).label).toBe("Q3");
    expect(getQuarterFromActivity({ week: "2024-39" }).label).toBe("Q3");

    // Q4: Weeks 40 - 52
    expect(getQuarterFromActivity({ week: "2024-40" }).label).toBe("Q4");
    expect(getQuarterFromActivity({ week: "2024-52" }).label).toBe("Q4");
  });

  it("should handle ISO date strings and firestore timestamps", () => {
    expect(getQuarterFromActivity({ week: "2024-05-15" }).label).toBe("Q1");
    const mockTimestamp = {
      toDate: () => new Date(2024, 6, 15), // July 15 -> Q2
    };
    expect(getQuarterFromActivity({ createdAt: mockTimestamp }).label).toBe("Q2");
  });

  it("should calculate financial month index, current quarter, and YTD pacing progress", () => {
    // September 15 (Month 6 of FY, Q2 Month 3, halfway through Sept)
    const septDate = new Date(2024, 8, 15); // Month 8 (0-indexed = Sept)
    const progress = getCurrentFinancialProgress(septDate);

    expect(progress.currentQuarter).toBe("Q2");
    expect(progress.monthName).toBe("September");
    expect(progress.financialMonthIndex).toBe(6);
    expect(progress.quarterMonthIndex).toBe(3);
    expect(progress.exactElapsedMonths).toBeCloseTo(5.5); // 5 prior months + 15/30
    expect(progress.yearProgressPct).toBeCloseTo(45.83, 1);
    expect(progress.eomYearProgressPct).toBeCloseTo(50.0);

    // Day-exact target: $1,200,000 * (5.5 / 12) = $550,000
    const exactExpected = calculateYtdExpectedTarget(1200000, septDate, 'EXACT_DAY');
    expect(exactExpected).toBe(550000);

    // EOM target: $1,200,000 * (6 / 12) = $600,000
    const eomExpected = calculateYtdExpectedTarget(1200000, septDate, 'EOM');
    expect(eomExpected).toBe(600000);
  });

  it("should calculate January financial progress (Month 10 of FY, Q4 Month 1)", () => {
    // Jan 10 (9 prior months + 10/31 days)
    const janDate = new Date(2025, 0, 10); // Month 0 (0-indexed = Jan)
    const progress = getCurrentFinancialProgress(janDate);

    expect(progress.currentQuarter).toBe("Q4");
    expect(progress.monthName).toBe("January");
    expect(progress.financialMonthIndex).toBe(10);
    expect(progress.quarterMonthIndex).toBe(1);

    // EOM target: $1,200,000 * (10 / 12) = $1,000,000
    const eomExpected = calculateYtdExpectedTarget(1200000, janDate, 'EOM');
    expect(eomExpected).toBe(1000000);

    // Day-Exact target: $1,200,000 * ((9 + 10/31) / 12) = $932,258.06
    const exactExpected = calculateYtdExpectedTarget(1200000, janDate, 'EXACT_DAY');
    expect(exactExpected).toBeCloseTo(932258.06, 1);
  });
});
