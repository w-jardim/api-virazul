const planningService = require('../../src/modules/planning/planning.service');

describe('Planning Service Unit', () => {
  test('calculo de horas', () => {
    const hours = planningService.computeHours(
      { confirmed_hours: 72, waiting_hours: 16 },
      120
    );

    expect(hours).toEqual({
      confirmed_hours: 72,
      waiting_hours: 16,
      remaining_hours: 48,
    });
  });

  test('projecao por duracao considera duracoes validas', () => {
    const projection = planningService.computeByDuration(48, [6, 8, 12, 24]);
    expect(projection).toEqual({
      '6': 8,
      '8': 6,
      '12': 4,
      '24': 2,
    });
  });

  test('projecao por 6h', () => {
    expect(planningService.computeByDuration(18, [6, 8, 12, 24])['6']).toBe(3);
  });

  test('projecao por 8h', () => {
    expect(planningService.computeByDuration(18, [6, 8, 12, 24])['8']).toBe(3);
  });

  test('projecao por 12h', () => {
    expect(planningService.computeByDuration(18, [6, 8, 12, 24])['12']).toBe(2);
  });

  test('projecao por 24h', () => {
    expect(planningService.computeByDuration(18, [6, 8, 12, 24])['24']).toBe(1);
  });

  test('gera combinacoes sem ultrapassar a meta restante', () => {
    const combos = planningService.generateCombinationCandidates(48, [6, 8, 12, 24]);
    expect(combos.length).toBeGreaterThan(0);
    expect(combos.some((item) => item.total_hours === 48 && item.pending_hours === 0)).toBe(true);
    expect(combos.every((item) => item.total_hours <= 48)).toBe(true);
  });

  test('gera pendencia quando nenhuma combinacao fecha exatamente o restante', () => {
    const combos = planningService.generateCombinationCandidates(5, [6, 8, 12, 24]);
    expect(combos).toEqual([
      {
        items: [],
        total_hours: 0,
        pending_hours: 5,
      },
    ]);
  });

  test('normaliza preferencias com dados invalidos', () => {
    const normalized = planningService.normalizePlanningPreferences({
      preferred_durations: [8, 10, 12, 12],
      avoided_durations: [24, 7],
      max_single_shift_hours: 12,
    });

    expect(normalized.preferred_durations).toEqual([8, 12]);
    expect(normalized.avoided_durations).toEqual([24]);
    expect(normalized.max_single_shift_hours).toBe(12);
  });

  test('remaining_hours nao fica negativo quando meta ja foi superada', () => {
    const hours = planningService.computeHours(
      { confirmed_hours: 150, waiting_hours: 20 },
      120
    );

    expect(hours.confirmed_hours).toBe(150);
    expect(hours.waiting_hours).toBe(20);
    expect(hours.remaining_hours).toBe(0);
  });

  test('aplica preferencias em getEffectiveDurations', () => {
    const effective = planningService.getEffectiveDurations({
      preferred_durations: [8, 12],
      avoided_durations: [24],
      preferred_durations_on_days_off: [],
      preferred_durations_on_work_days: [],
      max_single_shift_hours: 12,
    });

    expect(effective).toEqual([6, 8, 12]);
  });

  test('comportamento neutro sem preferencias retorna todas duracoes validas', () => {
    const effective = planningService.getEffectiveDurations({
      preferred_durations: [],
      avoided_durations: [],
      preferred_durations_on_days_off: [],
      preferred_durations_on_work_days: [],
      max_single_shift_hours: null,
    });

    expect(effective).toEqual([6, 8, 12, 24]);
  });

  test('ordenacao por preferencia contextual', () => {
    const ordered = planningService.sortDurationsByPreference(
      [6, 8, 12, 24],
      {
        preferred_durations: [8],
        preferred_durations_on_days_off: [12],
        preferred_durations_on_work_days: [],
      },
      'preferred_durations_on_days_off'
    );

    expect(ordered[0]).toBe(12);
  });
});
