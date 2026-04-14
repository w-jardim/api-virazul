jest.mock('../../src/modules/alerts/alerts.repository', () => ({
  getTodayServices: jest.fn(),
  getOperationalPendingServices: jest.fn(),
  getFinancialPendingServices: jest.fn(),
  getAlertsByDedupeKeys: jest.fn(),
  insertAlertsBatch: jest.fn(),
  listActiveGeneratedAlerts: jest.fn(),
  softDeleteByIds: jest.fn(),
  listByUser: jest.fn(),
  findByIdAndUser: jest.fn(),
  markStatus: jest.fn(),
}));

const repository = require('../../src/modules/alerts/alerts.repository');
const service = require('../../src/modules/alerts/alerts.service');

describe('Alerts Service Unit', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('regra de identificacao de alerta do dia', () => {
    const now = new Date();
    expect(service.isDayAlertService({ start_at: now.toISOString() }, now)).toBe(true);
  });

  test('regra de pendencia operacional', () => {
    const past = new Date(Date.now() - 60 * 60 * 1000).toISOString();

    expect(
      service.isOperationalPendingService(
        { start_at: past, operational_status: 'TITULAR' },
        new Date()
      )
    ).toBe(true);

    expect(
      service.isOperationalPendingService(
        { start_at: past, operational_status: 'REALIZADO' },
        new Date()
      )
    ).toBe(false);
  });

  test('regra de pendencia financeira', () => {
    const now = new Date();
    const due = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString();

    expect(
      service.isFinancialPendingService(
        {
          operational_status: 'REALIZADO',
          financial_status: 'PREVISTO',
          payment_due_date: due,
        },
        now
      )
    ).toBe(true);

    expect(
      service.isFinancialPendingService(
        {
          operational_status: 'REALIZADO',
          financial_status: 'PAGO',
          payment_due_date: due,
        },
        now
      )
    ).toBe(false);
  });

  test('prevencao de duplicidade de alertas em lote', async () => {
    const referenceNow = new Date('2026-04-10T10:00:00.000-03:00');
    const today = referenceNow.toISOString();

    repository.getTodayServices.mockResolvedValue([
      {
        id: 1,
        service_type_id: 2,
        service_type_key: 'ras_voluntary',
        service_type_name: 'RAS Voluntario',
        start_at: today,
        operational_status: 'TITULAR',
        financial_status: 'PREVISTO',
        duration_hours: 12,
      },
    ]);
    repository.getOperationalPendingServices.mockResolvedValue([]);
    repository.getFinancialPendingServices.mockResolvedValue([]);

    repository.getAlertsByDedupeKeys
      .mockResolvedValueOnce([])
      .mockImplementationOnce(async (userId, keys) => keys.map((key) => ({ dedupe_key: key })));

    repository.insertAlertsBatch.mockResolvedValue();
    repository.listActiveGeneratedAlerts.mockResolvedValue([
      { id: 10, dedupe_key: 'u:90|t:DAY|s:1|r:2026-04-10' },
    ]);
    repository.softDeleteByIds.mockResolvedValue();

    await service.syncUserAlerts(90, referenceNow);
    await service.syncUserAlerts(90, new Date('2026-04-10T11:00:00.000-03:00'));

    expect(repository.insertAlertsBatch).toHaveBeenCalledTimes(2);
    expect(repository.insertAlertsBatch.mock.calls[0][0].length).toBe(1);
    expect(repository.insertAlertsBatch.mock.calls[1][0].length).toBe(0);
  });
});
