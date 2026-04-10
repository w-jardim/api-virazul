const env = require('../../config/env');

function getTimeZoneParts(date = new Date(), timeZone = env.tz) {
  const baseDate = new Date(date);
  if (Number.isNaN(baseDate.getTime())) {
    throw new Error('Invalid date value for timezone calculation');
  }

  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(baseDate);
  const read = (type) => Number(parts.find((item) => item.type === type).value);

  return {
    year: read('year'),
    month: read('month'),
    day: read('day'),
    hour: read('hour'),
    minute: read('minute'),
    second: read('second'),
  };
}

function getTimeZoneOffsetMs(date = new Date(), timeZone = env.tz) {
  const parts = getTimeZoneParts(date, timeZone);
  const asUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second
  );

  const aligned = new Date(date);
  aligned.setMilliseconds(0);
  return asUtc - aligned.getTime();
}

function getTimeZoneDayRange(date = new Date(), timeZone = env.tz) {
  const parts = getTimeZoneParts(date, timeZone);
  const utcMidnightGuess = Date.UTC(parts.year, parts.month - 1, parts.day, 0, 0, 0);
  const offsetMs = getTimeZoneOffsetMs(new Date(utcMidnightGuess), timeZone);
  const start = new Date(utcMidnightGuess - offsetMs);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);

  return { start, end };
}

function getTimeZoneMonthRange(date = new Date(), timeZone = env.tz) {
  const parts = getTimeZoneParts(date, timeZone);
  const monthStartGuess = Date.UTC(parts.year, parts.month - 1, 1, 0, 0, 0);
  const monthOffset = getTimeZoneOffsetMs(new Date(monthStartGuess), timeZone);
  const start = new Date(monthStartGuess - monthOffset);

  const nextMonthGuess = Date.UTC(parts.year, parts.month, 1, 0, 0, 0);
  const nextMonthOffset = getTimeZoneOffsetMs(new Date(nextMonthGuess), timeZone);
  const end = new Date(nextMonthGuess - nextMonthOffset);

  return { start, end };
}

function toDateKeyInTimeZone(date = new Date(), timeZone = env.tz) {
  const parts = getTimeZoneParts(date, timeZone);
  const yyyy = String(parts.year);
  const mm = String(parts.month).padStart(2, '0');
  const dd = String(parts.day).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

module.exports = {
  getTimeZoneParts,
  getTimeZoneOffsetMs,
  getTimeZoneDayRange,
  getTimeZoneMonthRange,
  toDateKeyInTimeZone,
};
