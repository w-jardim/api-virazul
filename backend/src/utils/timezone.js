const env = require('../config/env');
const alertsTime = require('../modules/alerts/alerts.time');

function toUTC(date) {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) throw new Error('Invalid date');
  return new Date(d.toISOString());
}

function toLocalDateKey(date, tz = env.tz) {
  return alertsTime.toDateKeyInTimeZone(date, tz);
}

function getStartOfDay(date, tz = env.tz) {
  const range = alertsTime.getTimeZoneDayRange(date, tz);
  return range.start;
}

function getEndOfDay(date, tz = env.tz) {
  const range = alertsTime.getTimeZoneDayRange(date, tz);
  return range.end;
}

function toISOStringSafe(date) {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

module.exports = {
  toUTC,
  toLocalDateKey,
  getStartOfDay,
  getEndOfDay,
  toISOStringSafe,
};
