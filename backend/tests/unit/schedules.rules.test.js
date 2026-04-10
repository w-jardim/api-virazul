const { generateRecurringStartDates, hasTimeOverlap } = require('../../src/modules/schedules/schedules.rules');

describe('Schedules Rules Unit', () => {
  test('gerar recorrencia por dias da semana', () => {
    const dates = generateRecurringStartDates({
      startAt: '2026-04-13T08:00:00.000Z',
      weekdays: [1, 3, 5],
      periodDays: 7,
    });

    expect(dates.length).toBeGreaterThanOrEqual(3);
  });

  test('calculo de sobreposicao', () => {
    const overlap = hasTimeOverlap(
      { start: new Date('2026-04-10T08:00:00.000Z'), end: new Date('2026-04-10T14:00:00.000Z') },
      { start: new Date('2026-04-10T12:00:00.000Z'), end: new Date('2026-04-10T18:00:00.000Z') }
    );

    const noOverlap = hasTimeOverlap(
      { start: new Date('2026-04-10T08:00:00.000Z'), end: new Date('2026-04-10T14:00:00.000Z') },
      { start: new Date('2026-04-10T14:00:00.000Z'), end: new Date('2026-04-10T20:00:00.000Z') }
    );

    expect(overlap).toBe(true);
    expect(noOverlap).toBe(false);
  });
});
