const financeService = require('../../src/modules/finance/finance.service');
const { toDateKeyInTimeZone } = require('../../src/modules/alerts/alerts.time');

function makeBaseService(overrides = {}) {
  return {
    id: 1,
    start_at: '2026-05-10T10:00:00.000Z',
    duration_hours: 12,
    operational_status: 'REALIZADO',
    financial_status: 'PAGO',
    amount_total: 200,
    amount_paid: 200,
    amount_balance: 0,
    payment_due_date: '2026-05-20',
    service_type_key: 'ras_voluntary',
    service_type_name: 'RAS Voluntario',
    counts_in_financial: 1,
    ...overrides,
  };
}

describe('Finance Service Unit', () => {
  test('calculo de total_received', () => {
    const summary = financeService.calculateSummaryFromServices(
      [
        makeBaseService({ financial_status: 'PAGO', amount_total: 300, amount_paid: 300, amount_balance: 0 }),
        makeBaseService({ id: 2, financial_status: 'NAO_PAGO', amount_total: 100, amount_paid: 0, amount_balance: 100 }),
      ],
      new Date('2026-05-30T12:00:00.000Z')
    );

    expect(summary.total_received).toBe(300);
  });

  test('PAGO inconsistente nao contamina total_received', () => {
    const summary = financeService.calculateSummaryFromServices(
      [
        makeBaseService({
          financial_status: 'PAGO',
          amount_total: 300,
          amount_paid: 100,
          amount_balance: 200,
        }),
      ],
      new Date('2026-05-30T12:00:00.000Z')
    );

    expect(summary.total_received).toBe(100);
  });

  test('calculo de total_pending', () => {
    const summary = financeService.calculateSummaryFromServices(
      [
        makeBaseService({ financial_status: 'NAO_PAGO', amount_total: 120, amount_paid: 0, amount_balance: 120 }),
        makeBaseService({ id: 2, financial_status: 'PAGO_PARCIAL', amount_total: 200, amount_paid: 120, amount_balance: 80 }),
      ],
      new Date('2026-05-30T12:00:00.000Z')
    );

    expect(summary.total_pending).toBe(200);
  });

  test('calculo de overdue', () => {
    const summary = financeService.calculateSummaryFromServices(
      [
        makeBaseService({
          financial_status: 'NAO_PAGO',
          amount_total: 150,
          amount_paid: 0,
          amount_balance: 150,
          payment_due_date: '2026-05-01',
        }),
        makeBaseService({
          id: 2,
          financial_status: 'NAO_PAGO',
          amount_total: 80,
          amount_paid: 0,
          amount_balance: 80,
          payment_due_date: '2026-06-15',
        }),
      ],
      new Date('2026-05-30T12:00:00.000Z')
    );

    expect(summary.total_overdue).toBe(150);
  });

  test('overdue respeita data local (vencimento hoje nao atrasa)', () => {
    const now = new Date('2026-05-30T12:00:00.000Z');
    const todayKey = toDateKeyInTimeZone(now);

    const summary = financeService.calculateSummaryFromServices(
      [
        makeBaseService({
          financial_status: 'NAO_PAGO',
          amount_total: 80,
          amount_paid: 0,
          amount_balance: 80,
          payment_due_date: todayKey,
        }),
      ],
      now
    );

    expect(summary.total_overdue).toBe(0);
  });

  test('agrupamento por tipo', () => {
    const grouped = financeService.groupByServiceType(
      [
        makeBaseService({ service_type_key: 'ras_voluntary', service_type_name: 'RAS Voluntario', amount_total: 100 }),
        makeBaseService({ id: 2, service_type_key: 'ras_voluntary', service_type_name: 'RAS Voluntario', financial_status: 'NAO_PAGO', amount_total: 90, amount_paid: 0, amount_balance: 90 }),
        makeBaseService({ id: 3, service_type_key: 'proeis', service_type_name: 'PROEIS', amount_total: 110 }),
      ],
      new Date('2026-05-30T12:00:00.000Z')
    );

    const ras = grouped.find((item) => item.service_type === 'ras_voluntary');
    const proeis = grouped.find((item) => item.service_type === 'proeis');

    expect(ras.total_expected).toBe(190);
    expect(ras.total_pending).toBe(90);
    expect(proeis.total_expected).toBe(110);
  });

  test('escala ordinaria e reserva nao entram no financeiro', () => {
    const summary = financeService.calculateSummaryFromServices(
      [
        makeBaseService({
          service_type_key: 'ordinary_shift',
          counts_in_financial: 0,
          amount_total: 999,
        }),
        makeBaseService({
          id: 2,
          operational_status: 'RESERVA',
          financial_status: 'PREVISTO',
          amount_total: 888,
        }),
      ],
      new Date('2026-05-30T12:00:00.000Z')
    );

    expect(summary.total_expected).toBe(0);
    expect(summary.total_pending).toBe(0);
  });

  test('RESERVA nao entra no consolidado principal', () => {
    const summary = financeService.calculateSummaryFromServices(
      [
        makeBaseService({
          operational_status: 'RESERVA',
          financial_status: 'PREVISTO',
          amount_total: 300,
        }),
      ],
      new Date('2026-05-30T12:00:00.000Z')
    );

    expect(summary.total_expected).toBe(0);
    expect(summary.by_status.PREVISTO).toBe(0);
  });

  test('ORDINARY category e counts_in_financial true ainda fica fora', () => {
    const summary = financeService.calculateSummaryFromServices(
      [
        makeBaseService({
          service_type_category: 'ORDINARY',
          counts_in_financial: 1,
          financial_status: 'PAGO',
          amount_total: 500,
        }),
      ],
      new Date('2026-05-30T12:00:00.000Z')
    );

    expect(summary.total_expected).toBe(0);
    expect(summary.total_received).toBe(0);
  });
});
