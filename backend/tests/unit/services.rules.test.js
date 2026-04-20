const {
  isValidDuration,
  calculateAmounts,
  assertAmountIntegrity,
  validatePaidPartial,
  validatePaid,
  isOperationalTransitionAllowed,
  assertFinancialCompatibilityWithOperational,
} = require('../../src/modules/services/services.rules');

describe('Services Rules Unit', () => {
  test('validacao de duracao', () => {
    expect(isValidDuration(6)).toBe(true);
    expect(isValidDuration(8)).toBe(true);
    expect(isValidDuration(10)).toBe(false);
  });

  test('calculo de amount_balance', () => {
    const amounts = calculateAmounts({
      amount_base: 100,
      amount_meal: 20,
      amount_transport: 10,
      amount_additional: 5,
      amount_discount: 15,
      amount_paid: 50,
    });

    expect(amounts.amount_total).toBe(120);
    expect(amounts.amount_balance).toBe(70);
  });

  test('regra de PAGO_PARCIAL', () => {
    expect(validatePaidPartial({ amount_paid: 10, amount_balance: 20 })).toBe(true);
    expect(validatePaidPartial({ amount_paid: 0, amount_balance: 20 })).toBe(false);
  });

  test('regra de PAGO', () => {
    expect(validatePaid({ amount_total: 100, amount_balance: 0, amount_paid: 100 })).toBe(true);
    expect(validatePaid({ amount_total: 100, amount_balance: 0, amount_paid: 50 })).toBe(false);
    expect(validatePaid({ amount_total: 0, amount_balance: 0, amount_paid: 0 })).toBe(true);
  });

  test('validacao de transicoes', () => {
    expect(isOperationalTransitionAllowed('RESERVA', 'CONVERTIDO_TITULAR')).toBe(true);
    expect(isOperationalTransitionAllowed('RESERVA', 'REALIZADO')).toBe(false);
    expect(isOperationalTransitionAllowed('CONVERTIDO_TITULAR', 'REALIZADO')).toBe(true);
  });

  test('integridade de valores financeiros', () => {
    expect(() =>
      assertAmountIntegrity({
        amount_total: 100,
        amount_paid: 20,
        amount_balance: 80,
      })
    ).not.toThrow();

    expect(() =>
      assertAmountIntegrity({
        amount_total: -1,
        amount_paid: 0,
        amount_balance: 0,
      })
    ).toThrow();
  });

  test('compatibilidade financeiro x operacional para reserva', () => {
    expect(() => assertFinancialCompatibilityWithOperational('RESERVA', 'RECEBIDO')).toThrow();
    expect(() => assertFinancialCompatibilityWithOperational('RESERVA', 'PENDENTE')).not.toThrow();
  });
});
