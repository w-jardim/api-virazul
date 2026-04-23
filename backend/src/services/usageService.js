const { pool } = require('../config/db');

async function incrementUsage(accountId) {
  const month = new Date().getMonth() + 1;
  const year = new Date().getFullYear();

  await pool.query(
    `INSERT INTO usage_metrics (account_id, month, year, services_created)
     VALUES (?, ?, ?, 1)
     ON DUPLICATE KEY UPDATE services_created = services_created + 1`,
    [accountId, month, year]
  );
}

module.exports = { incrementUsage };
