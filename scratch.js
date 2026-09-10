const { isBefore, differenceInCalendarWeeks } = require('date-fns');

function getWeekForDate(date) {
  let currentYear = date.getFullYear();
  
  let week1Start = new Date(currentYear, 3, 1);
  while (week1Start.getDay() !== 1) {
    week1Start.setDate(week1Start.getDate() - 1);
  }
  
  if (isBefore(date, week1Start)) {
    currentYear -= 1;
    week1Start = new Date(currentYear, 3, 1);
    while (week1Start.getDay() !== 1) {
      week1Start.setDate(week1Start.getDate() - 1);
    }
  }
  
  const weekNumber = differenceInCalendarWeeks(date, week1Start, { weekStartsOn: 1 }) + 1;
  const paddedWeek = weekNumber.toString().padStart(2, '0');
  return `${currentYear}-${paddedWeek}`;
}

const testDate = new Date(2026, 8, 6); // Sept 6, 2026 (months are 0-indexed)
console.log("Sept 6, 2026 is week:", getWeekForDate(testDate));

const testDate2 = new Date(2026, 8, 7); // Sept 7, 2026 (Mon)
console.log("Sept 7, 2026 is week:", getWeekForDate(testDate2));
