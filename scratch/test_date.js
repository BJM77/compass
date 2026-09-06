const { differenceInCalendarWeeks, isBefore, startOfWeek, addDays, format } = require('date-fns');

function getWeekForDate(date) {
  let currentYear = date.getFullYear();
  
  let firstSundayOfApril = new Date(currentYear, 3, 1);
  while (firstSundayOfApril.getDay() !== 0) {
    firstSundayOfApril.setDate(firstSundayOfApril.getDate() + 1);
  }
  
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

const now = new Date('2026-09-06T09:41:09+08:00');
const week = getWeekForDate(now);
console.log('Today is:', now.toString());
console.log('Current week calculated as:', week);

// Let's find the start and end dates for week 2026-23
let searchDate = new Date(2026, 3, 1);
let startOfWk23 = null;
for(let i=0; i<365; i++) {
  const d = new Date(2026, 3, 1 + i);
  if (getWeekForDate(d) === '2026-23') {
    startOfWk23 = d;
    break;
  }
}
const endOfWk23 = addDays(startOfWk23, 6);
console.log('Week 2026-23 starts on:', format(startOfWk23, 'yyyy-MM-dd (EEEE)'));
console.log('Week 2026-23 ends on:', format(endOfWk23, 'yyyy-MM-dd (EEEE)'));

