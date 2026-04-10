const AppError = require('../../utils/app-error');
const env = require('../../config/env');
const repository = require('./agenda.repository');
const { getTimeZoneDayRange, toDateKeyInTimeZone } = require('../alerts/alerts.time');

function isAdminMaster(user) {
  return user && user.role === 'ADMIN_MASTER';
}

function resolveTargetUserId(authUser, queryUserId) {
  const parsedUserId =
    queryUserId === undefined || queryUserId === null || queryUserId === ''
      ? null
      : Number(queryUserId);

  if (parsedUserId !== null && (!Number.isInteger(parsedUserId) || parsedUserId <= 0)) {
    throw new AppError('VALIDATION_ERROR', 'query.user_id deve ser inteiro positivo.', 400);
  }

  if (parsedUserId !== null && parsedUserId !== Number(authUser.id) && !isAdminMaster(authUser)) {
    throw new AppError('FORBIDDEN', 'Usuario comum nao pode consultar agenda de outro usuario.', 403);
  }

  return parsedUserId || Number(authUser.id);
}

function toAnchorDate(dateKey) {
  const [year, month, day] = String(dateKey)
    .split('-')
    .map((value) => Number(value));
  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
}

function toMonthAnchor(monthKey) {
  const [year, month] = String(monthKey)
    .split('-')
    .map((value) => Number(value));
  return new Date(Date.UTC(year, month - 1, 1, 12, 0, 0));
}

function splitByReservation(items) {
  return {
    confirmed: items.filter((item) => item.operational_status !== 'RESERVA'),
    reservations: items.filter((item) => item.operational_status === 'RESERVA'),
  };
}

function buildDateSeries(start, days) {
  const result = [];
  for (let index = 0; index < days; index += 1) {
    result.push(toDateKeyInTimeZone(new Date(start.getTime() + index * 24 * 60 * 60 * 1000), env.tz));
  }
  return result;
}

function groupByDate(items) {
  const grouped = {};
  for (const item of items) {
    const dateKey = toDateKeyInTimeZone(item.start_at, env.tz);
    if (!grouped[dateKey]) {
      grouped[dateKey] = [];
    }
    grouped[dateKey].push(item);
  }
  return grouped;
}

function resolveMonthRange(monthKey) {
  const monthStartAnchor = toMonthAnchor(monthKey);
  const startRange = getTimeZoneDayRange(monthStartAnchor, env.tz).start;
  const nextMonthAnchor = new Date(monthStartAnchor);
  nextMonthAnchor.setUTCMonth(nextMonthAnchor.getUTCMonth() + 1);
  const endRange = getTimeZoneDayRange(nextMonthAnchor, env.tz).start;
  return { start: startRange, end: endRange };
}

async function getDayAgenda(authUser, query) {
  const userId = resolveTargetUserId(authUser, query.user_id);
  const anchor = toAnchorDate(query.date);
  const range = getTimeZoneDayRange(anchor, env.tz);
  const items = await repository.listByUserInRange(userId, range.start, range.end);

  return {
    date: query.date,
    ...splitByReservation(items),
  };
}

async function getWeekAgenda(authUser, query) {
  const userId = resolveTargetUserId(authUser, query.user_id);
  const anchor = toAnchorDate(query.start);
  const dayRange = getTimeZoneDayRange(anchor, env.tz);
  const rangeStart = dayRange.start;
  const rangeEnd = new Date(rangeStart.getTime() + 7 * 24 * 60 * 60 * 1000);
  const items = await repository.listByUserInRange(userId, rangeStart, rangeEnd);
  const grouped = groupByDate(items);
  const dayKeys = buildDateSeries(rangeStart, 7);

  return {
    start: dayKeys[0],
    end: dayKeys[dayKeys.length - 1],
    days: dayKeys.map((date) => ({
      date,
      ...splitByReservation(grouped[date] || []),
    })),
  };
}

async function getMonthAgenda(authUser, query) {
  const userId = resolveTargetUserId(authUser, query.user_id);
  const { start, end } = resolveMonthRange(query.month);
  const items = await repository.listByUserInRange(userId, start, end);
  const grouped = groupByDate(items);
  const dates = Object.keys(grouped).sort();

  return {
    month: query.month,
    days: dates.map((date) => ({
      date,
      ...splitByReservation(grouped[date]),
    })),
  };
}

module.exports = {
  getDayAgenda,
  getWeekAgenda,
  getMonthAgenda,
  groupByDate,
};
