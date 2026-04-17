/**
 * schedules.template.js
 *
 * Pure functions that take a schedule template JSON and a month string (YYYY-MM)
 * and return an array of computed work-day entries.
 *
 * No DB access — these are deterministic calculations only.
 *
 * Supported template types:
 *   WEEKLY    - fixed weekdays each week
 *   BIWEEKLY  - two alternating week patterns (A/B) anchored to a reference date
 *   INTERVAL  - work N hours then off M hours, anchored to a reference date
 */

const TZ = process.env.TZ || 'America/Sao_Paulo';

// ── helpers ──────────────────────────────────────────────────────────────────

function daysInMonth(year, month) {
  return new Date(year, month, 0).getDate(); // month is 1-based
}

/**
 * ISO weekday in user's timezone: 1 = Monday … 7 = Sunday
 */
function isoWeekday(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  const short = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ,
    weekday: 'short',
  }).format(d);
  return { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 }[short];
}

function zeroPad(n) {
  return String(n).padStart(2, '0');
}

function dateStr(year, month, day) {
  return `${year}-${zeroPad(month)}-${zeroPad(day)}`;
}

/**
 * Returns the Monday of the ISO week that contains the given date string.
 * Used to determine A/B week for BIWEEKLY schedules.
 */
function mondayOfWeek(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  const dow = d.getDay(); // 0=Sun … 6=Sat
  const offset = dow === 0 ? -6 : 1 - dow; // shift to Monday
  const monday = new Date(d.getTime() + offset * 86400000);
  return monday.toISOString().slice(0, 10);
}

// ── per-type computers ────────────────────────────────────────────────────────

/**
 * WEEKLY: entries[] = [{ weekday, start_time, duration_hours }]
 */
function computeWeekly(template, year, month) {
  const result = [];
  const total = daysInMonth(year, month);
  const byWeekday = {};
  for (const e of (template.entries || [])) {
    byWeekday[e.weekday] = e;
  }

  for (let day = 1; day <= total; day++) {
    const ds = dateStr(year, month, day);
    const wd = isoWeekday(ds);
    if (byWeekday[wd]) {
      result.push({
        date: ds,
        start_time: byWeekday[wd].start_time || '07:00',
        duration_hours: byWeekday[wd].duration_hours,
      });
    }
  }
  return result;
}

/**
 * BIWEEKLY: reference_date (a Monday), week_a[], week_b[]
 * Weeks are identified by whether their Monday is an even or odd number of
 * weeks from reference_date.
 */
function computeBiweekly(template, year, month) {
  const result = [];
  const total = daysInMonth(year, month);
  const refMonday = mondayOfWeek(template.reference_date);
  const refMs = new Date(refMonday + 'T12:00:00').getTime();

  const byDayA = {};
  for (const e of (template.week_a || [])) byDayA[e.weekday] = e;
  const byDayB = {};
  for (const e of (template.week_b || [])) byDayB[e.weekday] = e;

  for (let day = 1; day <= total; day++) {
    const ds = dateStr(year, month, day);
    const weekMonday = mondayOfWeek(ds);
    const weekMs = new Date(weekMonday + 'T12:00:00').getTime();
    const diffWeeks = Math.round((weekMs - refMs) / (7 * 86400000));
    const isWeekA = (((diffWeeks % 2) + 2) % 2) === 0; // handles negative diff

    const wd = isoWeekday(ds);
    const byDay = isWeekA ? byDayA : byDayB;
    if (byDay[wd]) {
      result.push({
        date: ds,
        start_time: byDay[wd].start_time || '07:00',
        duration_hours: byDay[wd].duration_hours,
        week: isWeekA ? 'A' : 'B',
      });
    }
  }
  return result;
}

/**
 * INTERVAL: reference_date, start_time, work_hours, off_hours
 * The cycle starts at reference_date + start_time.
 * Each work shift begins at: reference + N * cycleMs, where N = 0,1,2…
 */
function computeInterval(template, year, month) {
  const result = [];
  const workH = Number(template.work_hours);
  const offH = Number(template.off_hours);
  const cycleMs = (workH + offH) * 3600000;

  if (!workH || !offH || !template.reference_date) return result;

  const refMs = new Date(`${template.reference_date}T${template.start_time || '07:00'}:00`).getTime();
  const monthStart = new Date(year, month - 1, 1).getTime();
  const monthEnd = new Date(year, month, 1).getTime(); // exclusive

  // Earliest shift that could overlap with the month
  const diffMs = monthStart - refMs;
  const floorsBack = Math.floor(diffMs / cycleMs);
  let candidate = refMs + floorsBack * cycleMs;

  // Step back one more to catch shifts that started before but extend into the month
  candidate -= cycleMs;

  while (candidate < monthEnd) {
    const shiftEnd = candidate + workH * 3600000;
    // Include if work period overlaps with the month
    if (shiftEnd > monthStart && candidate < monthEnd) {
      const d = new Date(candidate);
      // Convert to local date in TZ
      const ds = new Intl.DateTimeFormat('fr-CA', {
        timeZone: TZ,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(d);

      // Only include days within the target month
      const [y, m] = ds.split('-').map(Number);
      if (y === year && m === month) {
        result.push({
          date: ds,
          start_time: new Intl.DateTimeFormat('en-US', {
            timeZone: TZ,
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
          }).format(d).replace(/^24/, '00'),
          duration_hours: workH,
        });
      }
    }
    candidate += cycleMs;
  }

  return result;
}

// ── public API ────────────────────────────────────────────────────────────────

/**
 * Given a template object and a month string (YYYY-MM), returns an array of
 * { date, start_time, duration_hours } objects for every work day in that month.
 * Returns [] when the template is null/empty or type is unknown.
 */
function computeWorkDays(template, monthStr) {
  if (!template || !template.type) return [];

  const [year, month] = monthStr.split('-').map(Number);
  if (!year || !month) return [];

  switch (template.type) {
    case 'WEEKLY':
      return computeWeekly(template, year, month);
    case 'BIWEEKLY':
      return computeBiweekly(template, year, month);
    case 'INTERVAL':
      return computeInterval(template, year, month);
    default:
      return [];
  }
}

module.exports = { computeWorkDays };
