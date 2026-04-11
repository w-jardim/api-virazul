const reportsService = require('../../src/modules/reports/reports.service');

describe('Reports Service Unit', () => {
  test('calculo de taxa de conversao', () => {
    const metrics = reportsService.calculateReservationMetrics(
      [{ operational_status: 'RESERVA' }],
      [
        { new_operational_status: 'CONVERTIDO_TITULAR' },
        { new_operational_status: 'NAO_CONVERTIDO' },
      ]
    );

    expect(metrics.total_reservations).toBe(3);
    expect(metrics.converted_reservations).toBe(1);
    expect(metrics.non_converted_reservations).toBe(1);
    expect(metrics.conversion_rate).toBeCloseTo(33.33, 2);
  });

  test('agrupamento por status', () => {
    const grouped = reportsService.groupCountsByStatus(
      [{ operational_status: 'TITULAR' }, { operational_status: 'TITULAR' }, { operational_status: 'REALIZADO' }],
      'operational_status',
      ['TITULAR', 'REALIZADO', 'RESERVA']
    );

    expect(grouped).toEqual({
      TITULAR: 2,
      REALIZADO: 1,
      RESERVA: 0,
    });
  });

  test('calculo financeiro com overdue e percentuais', () => {
    const result = reportsService.calculateFinancialSummary(
      [
        {
          operational_status: 'REALIZADO',
          financial_status: 'PAGO',
          amount_total: 200,
          amount_paid: 200,
          amount_balance: 0,
          payment_due_date: '2026-05-10',
          service_type_key: 'ras_voluntary',
          service_type_category: 'RAS',
          counts_in_financial: 1,
        },
        {
          operational_status: 'TITULAR',
          financial_status: 'NAO_PAGO',
          amount_total: 100,
          amount_paid: 0,
          amount_balance: 100,
          payment_due_date: '2026-05-01',
          service_type_key: 'proeis',
          service_type_category: 'PROEIS',
          counts_in_financial: 1,
        },
      ],
      new Date('2026-05-30T12:00:00.000Z')
    );

    expect(result.summary.total_expected).toBe(300);
    expect(result.summary.total_received).toBe(200);
    expect(result.summary.total_pending).toBe(100);
    expect(result.summary.total_overdue).toBe(100);
    expect(result.summary.received_percentage).toBeCloseTo(66.67, 2);
    expect(result.summary.pending_percentage).toBeCloseTo(33.33, 2);
  });

  test('overdue com payment_due_date Date respeita data civil', () => {
    const now = new Date('2026-05-30T12:00:00.000Z');
    const result = reportsService.calculateFinancialSummary(
      [
        {
          operational_status: 'REALIZADO',
          financial_status: 'NAO_PAGO',
          amount_total: 100,
          amount_paid: 0,
          amount_balance: 100,
          payment_due_date: new Date('2026-05-30T00:00:00.000Z'),
          service_type_key: 'ras_voluntary',
          service_type_category: 'RAS',
          counts_in_financial: 1,
        },
      ],
      now
    );

    expect(result.summary.total_overdue).toBe(0);
  });

  test('agrupamento por tipo e top service type', () => {
    const result = reportsService.calculateFinancialSummary(
      [
        {
          operational_status: 'REALIZADO',
          financial_status: 'PAGO',
          amount_total: 210,
          amount_paid: 210,
          amount_balance: 0,
          payment_due_date: null,
          service_type_key: 'ras_voluntary',
          service_type_category: 'RAS',
          counts_in_financial: 1,
        },
        {
          operational_status: 'REALIZADO',
          financial_status: 'PAGO',
          amount_total: 120,
          amount_paid: 120,
          amount_balance: 0,
          payment_due_date: null,
          service_type_key: 'proeis',
          service_type_category: 'PROEIS',
          counts_in_financial: 1,
        },
      ],
      new Date('2026-05-30T12:00:00.000Z')
    );

    expect(result.by_service_type.ras_voluntary).toBe(210);
    expect(result.by_service_type.proeis).toBe(120);
    expect(result.summary.top_service_type).toBe('ras_voluntary');
  });

  test('exclui ordinaria e reserva do financeiro', () => {
    const result = reportsService.calculateFinancialSummary(
      [
        {
          operational_status: 'REALIZADO',
          financial_status: 'PAGO',
          amount_total: 500,
          amount_paid: 500,
          amount_balance: 0,
          payment_due_date: null,
          service_type_key: 'ordinary_shift',
          service_type_category: 'ORDINARY',
          counts_in_financial: 1,
        },
        {
          operational_status: 'RESERVA',
          financial_status: 'NAO_PAGO',
          amount_total: 100,
          amount_paid: 0,
          amount_balance: 100,
          payment_due_date: '2026-05-10',
          service_type_key: 'ras_voluntary',
          service_type_category: 'RAS',
          counts_in_financial: 1,
        },
      ],
      new Date('2026-05-30T12:00:00.000Z')
    );

    expect(result.summary.total_expected).toBe(0);
    expect(result.summary.total_pending).toBe(0);
    expect(result.by_service_type).toEqual({
      ras_voluntary: 0,
      ras_compulsory: 0,
      proeis: 0,
      ordinary_shift: 0,
      other: 0,
    });
  });
});
