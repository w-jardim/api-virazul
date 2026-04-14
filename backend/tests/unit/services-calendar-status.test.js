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

  test('moves statuses to pendente and em_atraso based on payment_due_date window', async () => {
    repository.syncPendingFinancialStatuses.mockResolvedValue(3);
    repository.syncOverdueFinancialStatuses.mockResolvedValue(2);

    const result = await service.syncFinancialStatusByCalendar(new Date('2026-04-14T10:00:00.000Z'));

    expect(repository.syncPendingFinancialStatuses).toHaveBeenCalledWith('2026-04-14');
    expect(repository.syncOverdueFinancialStatuses).toHaveBeenCalledWith('2026-04-14');
    expect(result).toEqual({
      date: '2026-04-14',
      pending_updated: 3,
      overdue_updated: 2,
    });
  });
});
