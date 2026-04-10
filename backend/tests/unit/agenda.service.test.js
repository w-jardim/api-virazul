const { groupByDate } = require('../../src/modules/agenda/agenda.service');

describe('Agenda Service Unit', () => {
  test('agrupar servicos por dia', () => {
    const grouped = groupByDate([
      { id: 1, start_at: '2026-04-10T08:00:00.000Z' },
      { id: 2, start_at: '2026-04-10T12:00:00.000Z' },
      { id: 3, start_at: '2026-04-11T08:00:00.000Z' },
    ]);

    const keys = Object.keys(grouped).sort();

    expect(keys.length).toBe(2);
    expect(grouped[keys[0]].length).toBe(2);
    expect(grouped[keys[1]].length).toBe(1);
  });
});
