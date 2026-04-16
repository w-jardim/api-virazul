const repository = require('./planning.repository');
const { DURATION_ALLOWED } = require('../services/services.rules');
const { getTimeZoneDayRange, getTimeZoneMonthRange, toDateKeyInTimeZone } = require('../alerts/alerts.time');

const DEFAULT_GOAL = 120;

function toPositiveInt(value, fallback) {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    return fallback;
  }
  return parsed;
}

function uniqueValidDurations(values) {
  if (!Array.isArray(values)) {
    return [];
  }

  const set = new Set();
  for (const value of values) {
    const duration = Number(value);
    if (DURATION_ALLOWED.includes(duration)) {
      set.add(duration);
    }
  }

  return Array.from(set).sort((a, b) => a - b);
}

function normalizePlanningPreferences(raw) {
  let source = raw;
  if (typeof source === 'string') {
    try {
      source = JSON.parse(source);
    } catch (error) {
      source = {};
    }
  }
  source = source && typeof source === 'object' ? source : {};
  const preferred = uniqueValidDurations(source.preferred_durations);
  const avoided = uniqueValidDurations(source.avoided_durations);
  const preferredOnDaysOff = uniqueValidDurations(source.preferred_durations_on_days_off);
  const preferredOnWorkDays = uniqueValidDurations(source.preferred_durations_on_work_days);
  const maxSingleShiftHours =
    source.max_single_shift_hours === undefined || source.max_single_shift_hours === null
      ? null
      : toPositiveInt(source.max_single_shift_hours, null);

  return {
    preferred_durations: preferred,
    avoided_durations: avoided,
    preferred_durations_on_days_off: preferredOnDaysOff,
    preferred_durations_on_work_days: preferredOnWorkDays,
    max_single_shift_hours: maxSingleShiftHours,
  };
}

function getEffectiveDurations(preferences) {
  let durations = [...DURATION_ALLOWED];

  if (preferences.max_single_shift_hours) {
    durations = durations.filter((duration) => duration <= preferences.max_single_shift_hours);
  }

  if (preferences.avoided_durations.length > 0) {
    const avoided = new Set(preferences.avoided_durations);
    const filtered = durations.filter((duration) => !avoided.has(duration));
    if (filtered.length > 0) {
      durations = filtered;
    }
  }

  return durations.sort((a, b) => a - b);
}

function sortDurationsByPreference(durations, preferences, contextKey) {
  const contextual = preferences[contextKey];
  const preferred =
    Array.isArray(contextual) && contextual.length > 0
      ? contextual
      : preferences.preferred_durations;

  const preferredSet = new Set(preferred);
  return [...durations].sort((a, b) => {
    const ap = preferredSet.has(a) ? 1 : 0;
    const bp = preferredSet.has(b) ? 1 : 0;
    if (ap !== bp) {
      return bp - ap;
    }
    return a - b;
  });
}

function computeByDuration(remainingHours, durations) {
  const result = {};
  for (const duration of DURATION_ALLOWED) {
    if (!durations.includes(duration) || remainingHours <= 0) {
      result[String(duration)] = 0;
      continue;
    }
    result[String(duration)] = Math.ceil(remainingHours / duration);
  }
  return result;
}

function buildItemsFromCounts(countsByDuration) {
  return Object.entries(countsByDuration)
    .filter(([, count]) => count > 0)
    .map(([duration, count]) => ({ duration: Number(duration), count: Number(count) }))
    .sort((a, b) => b.duration - a.duration);
}

function buildCombinationResult(remainingHours, counts) {
  const items = buildItemsFromCounts(counts);
  const totalHours = items.reduce((sum, item) => sum + item.duration * item.count, 0);

  return {
    items,
    total_hours: totalHours,
    pending_hours: Math.max(remainingHours - totalHours, 0),
  };
}

function generateCombinationCandidates(remainingHours, durations) {
  if (remainingHours <= 0 || durations.length === 0) {
    return [];
  }

  const sorted = [...durations].sort((a, b) => b - a);
  const seen = new Set();
  const output = [];

  function walk(index, currentTotal, counts) {
    if (index === sorted.length) {
      if (currentTotal <= 0 || currentTotal > remainingHours) {
        return;
      }

      const key = JSON.stringify(counts);
      if (seen.has(key)) {
        return;
      }

      seen.add(key);
      output.push(buildCombinationResult(remainingHours, counts));
      return;
    }

    const duration = sorted[index];
    const maxCount = Math.floor((remainingHours - currentTotal) / duration);

    for (let count = maxCount; count >= 0; count -= 1) {
      const nextTotal = currentTotal + duration * count;
      if (nextTotal > remainingHours) {
        continue;
      }

      walk(index + 1, nextTotal, { ...counts, [duration]: count });
    }
  }

  walk(0, 0, {});

  if (output.length === 0) {
    return [{ items: [], total_hours: 0, pending_hours: remainingHours }];
  }

  output.sort((a, b) => {
    const aExact = a.pending_hours === 0 ? 0 : 1;
    const bExact = b.pending_hours === 0 ? 0 : 1;
    if (aExact !== bExact) {
      return aExact - bExact;
    }

    if (a.pending_hours !== b.pending_hours) {
      return a.pending_hours - b.pending_hours;
    }

    if (a.items.length !== b.items.length) {
      return a.items.length - b.items.length;
    }

    return b.total_hours - a.total_hours;
  });

  return output.slice(0, 8);
}

function computeHours(monthlyHours, goal) {
  const confirmedHours = Number(monthlyHours.confirmed_hours || 0);
  const waitingHours = Number(monthlyHours.waiting_hours || 0);
  const remainingHours = Math.max(goal - confirmedHours, 0);

  return {
    confirmed_hours: confirmedHours,
    waiting_hours: waitingHours,
    remaining_hours: remainingHours,
  };
}

function groupServicesByDate(services) {
  const grouped = new Map();
  for (const service of services) {
    const dateKey = toDateKeyInTimeZone(service.start_at);
    if (!grouped.has(dateKey)) {
      grouped.set(dateKey, []);
    }
    grouped.get(dateKey).push(service);
  }
  return grouped;
}

function chooseDurationForDay({ preferred, neutral, remaining }) {
  const ordered = [...preferred, ...neutral.filter((value) => !preferred.includes(value))];
  if (ordered.length === 0) {
    return null;
  }

  const fits = ordered.filter((duration) => duration <= remaining);
  if (fits.length > 0) {
    return fits[0];
  }

  return ordered[0];
}

function buildSuggestionReason({ isPreferred, hasOrdinary }) {
  if (hasOrdinary && isPreferred) {
    return 'compatível com preferências e sem conflito com escala do dia';
  }
  if (hasOrdinary) {
    return 'dia com escala existente, sem conflito para composição';
  }
  if (isPreferred) {
    return 'compatível com preferências do usuário';
  }
  return 'sugestão neutra baseada em disponibilidade';
}

function getConfidence({ isPreferred, hasOrdinary }) {
  if (isPreferred && !hasOrdinary) {
    return 0.85;
  }
  if (isPreferred && hasOrdinary) {
    return 0.75;
  }
  if (hasOrdinary) {
    return 0.6;
  }
  return 0.55;
}

async function getSummary(userId, now = new Date()) {
  const monthRange = getTimeZoneMonthRange(now);
  const preferencesRow = await repository.getUserPreferences(userId);
  const monthlyHours = await repository.getMonthlyHours(userId, monthRange.start, monthRange.end);

  const goal = toPositiveInt(preferencesRow?.monthly_hour_goal, DEFAULT_GOAL);
  const planningPreferences = normalizePlanningPreferences(preferencesRow?.planning_preferences || {});
  const effectiveDurations = getEffectiveDurations(planningPreferences);
  const hours = computeHours(monthlyHours, goal);

  // cap_gap_hours: hours that could not be scheduled because no available duration fits within the cap
  const { DURATION_ALLOWED } = require('../services/services.rules');
  const smallestAllowed = Math.min(...DURATION_ALLOWED);
  const capGapHours = hours.remaining_hours > 0 && hours.remaining_hours < smallestAllowed
    ? hours.remaining_hours
    : 0;

  return {
    goal,
    confirmed_hours: hours.confirmed_hours,
    waiting_hours: hours.waiting_hours,
    remaining_hours: hours.remaining_hours,
    cap_gap_hours: capGapHours,
    projection: {
      by_duration: computeByDuration(hours.remaining_hours, effectiveDurations),
      combinations: generateCombinationCandidates(hours.remaining_hours, effectiveDurations),
    },
    preferences: planningPreferences,
  };
}

async function getSuggestions(userId, now = new Date()) {
  const summary = await getSummary(userId, now);
  if (summary.remaining_hours <= 0) {
    return [];
  }

  const start = getTimeZoneDayRange(now).start;
  const end = new Date(start.getTime() + 35 * 24 * 60 * 60 * 1000);
  const services = await repository.getServicesInRange(userId, start, end);
  const servicesByDate = groupServicesByDate(services);

  const effective = getEffectiveDurations(summary.preferences);
  const preferredForDaysOff = sortDurationsByPreference(
    effective,
    summary.preferences,
    'preferred_durations_on_days_off'
  );
  const preferredForWorkDays = sortDurationsByPreference(
    effective,
    summary.preferences,
    'preferred_durations_on_work_days'
  );

  const suggestions = [];
  let remaining = summary.remaining_hours;

  for (let dayOffset = 0; dayOffset < 35 && suggestions.length < 10 && remaining > 0; dayOffset += 1) {
    const dayDate = new Date(start.getTime() + dayOffset * 24 * 60 * 60 * 1000);
    const dateKey = toDateKeyInTimeZone(dayDate);
    const dayServices = servicesByDate.get(dateKey) || [];

    const hasOrdinary = dayServices.some((item) => item.service_category === 'ORDINARY');
    const hasNonOrdinaryCommitment = dayServices.some((item) => item.service_category !== 'ORDINARY');
    if (hasNonOrdinaryCommitment) {
      continue;
    }
    const occupiedHours = dayServices.reduce((sum, item) => sum + Number(item.duration_hours || 0), 0);

    const preferredBase = hasOrdinary ? preferredForWorkDays : preferredForDaysOff;
    const neutralBase = effective.filter((duration) => duration + occupiedHours <= 24);
    if (neutralBase.length === 0) {
      continue;
    }
    const preferredFiltered = preferredBase.filter((duration) => duration + occupiedHours <= 24);
    const chosenDuration = chooseDurationForDay({
      preferred: preferredFiltered,
      neutral: neutralBase,
      remaining,
    });

    if (!chosenDuration) {
      continue;
    }

    const isPreferred = preferredBase.includes(chosenDuration);
    suggestions.push({
      date: dateKey,
      suggested_duration: chosenDuration,
      confidence: getConfidence({ isPreferred, hasOrdinary }),
      reason: buildSuggestionReason({ isPreferred, hasOrdinary }),
    });

    remaining = Math.max(remaining - chosenDuration, 0);
  }

  return suggestions;
}

module.exports = {
  DEFAULT_GOAL,
  normalizePlanningPreferences,
  getEffectiveDurations,
  sortDurationsByPreference,
  computeByDuration,
  generateCombinationCandidates,
  computeHours,
  getSummary,
  getSuggestions,
};
