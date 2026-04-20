jest.mock('../../src/modules/services/services.repository', () => ({
  syncPendingFinancialStatuses: jest.fn(),
  syncOverdueFinancialStatuses: jest.fn(),
}));

jest.mock('../../src/utils/timezone', () => ({
  toLocalDateKey: jest.fn(() => '2026-04-14'),
}));

const repository = require('../../src/modules/services/services.repository');
const service = require('../../src/modules/services/services.service');

describe('services calendar financial status sync', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('returns a no-op sync result after removing overdue calendar rule', async () => {
    const result = await service.syncFinancialStatusByCalendar(new Date('2026-04-14T10:00:00.000Z'));

    expect(repository.syncPendingFinancialStatuses).not.toHaveBeenCalled();
    expect(repository.syncOverdueFinancialStatuses).not.toHaveBeenCalled();
    expect(result).toEqual({
      date: '2026-04-14',
      pending_updated: 0,
      overdue_updated: 0,
    });
  });
});
