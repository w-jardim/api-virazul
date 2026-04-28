const { pool } = require('../config/db');
const logger = require('../utils/logger');

async function incrementUsage(accountId) {
  const month = new Date().getMonth() + 1;
  const year = new Date().getFullYear();

  try {
    await pool.query(
      `INSERT INTO usage_metrics (account_id, month, year, services_created)
       VALUES (?, ?, ?, 1)
       ON DUPLICATE KEY UPDATE services_created = services_created + 1`,
      [accountId, month, year]
    );
    return true;
  } catch (error) {
    logger.warn('usage.increment.failed', {
      account_id: accountId,
      error_message: error.message,
      error_code: error.code || null,
    });
    return false;
  }
}

module.exports = { incrementUsage };
