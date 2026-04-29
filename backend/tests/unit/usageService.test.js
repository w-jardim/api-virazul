jest.mock('../../src/config/db', () => ({
  pool: {
    query: jest.fn(),
  },
}));

jest.mock('../../src/utils/logger', () => ({
  warn: jest.fn(),
}));

const { pool } = require('../../src/config/db');
const logger = require('../../src/utils/logger');
const { incrementUsage } = require('../../src/services/usageService');

describe('usage service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('incrementa uso quando usage_metrics existe', async () => {
    pool.query.mockResolvedValue([{ affectedRows: 1 }]);

    const result = await incrementUsage(5);

    expect(result).toBe(true);
    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO usage_metrics'),
      [5, expect.any(Number), expect.any(Number)]
    );
  });

  test('nao derruba fluxo quando usage_metrics falha', async () => {
    const error = Object.assign(new Error('Table usage_metrics does not exist'), { code: 'ER_NO_SUCH_TABLE' });
    pool.query.mockRejectedValue(error);

    const result = await incrementUsage(8);

    expect(result).toBe(false);
    expect(logger.warn).toHaveBeenCalledWith(
      'usage.increment.failed',
      expect.objectContaining({
        account_id: 8,
        error_message: 'Table usage_metrics does not exist',
        error_code: 'ER_NO_SUCH_TABLE',
      })
    );
  });
});
