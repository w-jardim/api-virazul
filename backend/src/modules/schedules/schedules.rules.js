const env = require('../../config/env');

const DAY_MS = 24 * 60 * 60 * 1000;
const ISO_WEEKDAYS = [1, 2, 3, 4, 5, 6, 7];

function addHours(dateValue, hours) {
  const start = new Date(dateValue);
  return new Date(start.getTime() + Number(hours) * 60 * 60 * 1000);
}

function hasTimeOverlap(intervalA, intervalB) {
  return intervalA.start < intervalB.end && intervalA.end > intervalB.start;
}

function getIsoWeekdayInTimeZone(dateValue, timeZone = env.tz) {
  const short = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
  }).format(new Date(dateValue));

  const map = {
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
    Sun: 7,
  };

  return map[short];
}

function uniqSortedDates(dateValues) {
  const seen = new Set();
  const values = [];

  for (const dateValue of dateValues) {
    const key = new Date(dateValue).toISOString();
    if (!seen.has(key)) {
      seen.add(key);
      values.push(new Date(dateValue));
    }
  }

  values.sort((a, b) => a.getTime() - b.getTime());
  return values;
}

function generateRecurringStartDates({ startAt, weekdays, periodDays }) {
  const start = new Date(startAt);
  if (!weekdays || weekdays.length === 0) {
    return [start];
  }

  const limit = Number(periodDays || 30);
  const allowedDays = new Set(weekdays.map(Number));
  const generated = [];

  for (let offset = 0; offset < limit; offset += 1) {
    const candidate = new Date(start.getTime() + offset * DAY_MS);
    const weekday = getIsoWeekdayInTimeZone(candidate);
    if (allowedDays.has(weekday)) {
      generated.push(candidate);
    }
  }

  return uniqSortedDates(generated);
}

module.exports = {
  ISO_WEEKDAYS,
  addHours,
  hasTimeOverlap,
  generateRecurringStartDates,
};
