const { pool } = require('../../config/db');

const VALID_RANK_GROUPS = [
  'OFICIAIS_SUPERIORES',
  'CAPITAO_TENENTE',
  'SUBTENENTE_SARGENTO',
  'CABO_SOLDADO',
];

const VALID_SERVICE_SCOPES = [
  'RAS_VOLUNTARY',
  'RAS_COMPULSORY',
  'PROEIS',
  'SEGURANCA_PRESENTE',
];

async function listBaseValues({ rankGroup, durationHours, date } = {}) {
  let sql = `
    SELECT id, rank_group, duration_hours, base_amount,
           effective_start_date, effective_end_date, is_active,
           created_at, updated_at
      FROM pricing_base_values
     WHERE is_active = 1
       AND effective_start_date <= COALESCE(?, CURRENT_DATE())
       AND (effective_end_date IS NULL OR effective_end_date >= COALESCE(?, CURRENT_DATE()))
  `;
  const params = [date || null, date || null];

  if (rankGroup) {
    sql += ' AND rank_group = ?';
    params.push(rankGroup);
  }
  if (durationHours) {
    sql += ' AND duration_hours = ?';
    params.push(Number(durationHours));
  }

  sql += ' ORDER BY rank_group, duration_hours, effective_start_date DESC';

  const [rows] = await pool.query(sql, params);
  return rows;
}

async function findActiveBaseValue(rankGroup, durationHours, referenceDate = null) {
  const [rows] = await pool.query(
    `SELECT id, rank_group, duration_hours, base_amount,
            effective_start_date, effective_end_date, is_active
       FROM pricing_base_values
      WHERE rank_group = ?
        AND duration_hours = ?
        AND is_active = 1
        AND effective_start_date <= COALESCE(?, CURRENT_DATE())
        AND (effective_end_date IS NULL OR effective_end_date >= COALESCE(?, CURRENT_DATE()))
      ORDER BY effective_start_date DESC, id DESC
      LIMIT 1`,
    [rankGroup, durationHours, referenceDate, referenceDate]
  );
  return rows[0] || null;
}

async function listFinancialRules({ serviceScope, date } = {}) {
  let sql = `
    SELECT id, service_scope, allow_transport, transport_amount,
           allow_meal, meal_amount,
           effective_start_date, effective_end_date, is_active,
           created_at, updated_at
      FROM service_type_financial_rules
     WHERE is_active = 1
       AND effective_start_date <= COALESCE(?, CURRENT_DATE())
       AND (effective_end_date IS NULL OR effective_end_date >= COALESCE(?, CURRENT_DATE()))
  `;
  const params = [date || null, date || null];

  if (serviceScope) {
    sql += ' AND service_scope = ?';
    params.push(serviceScope);
  }

  sql += ' ORDER BY service_scope, effective_start_date DESC';

  const [rows] = await pool.query(sql, params);
  return rows;
}

async function findActiveFinancialRule(serviceScope, referenceDate = null) {
  const [rows] = await pool.query(
    `SELECT id, service_scope, allow_transport, transport_amount,
            allow_meal, meal_amount,
            effective_start_date, effective_end_date, is_active
       FROM service_type_financial_rules
      WHERE service_scope = ?
        AND is_active = 1
        AND effective_start_date <= COALESCE(?, CURRENT_DATE())
        AND (effective_end_date IS NULL OR effective_end_date >= COALESCE(?, CURRENT_DATE()))
      ORDER BY effective_start_date DESC, id DESC
      LIMIT 1`,
    [serviceScope, referenceDate, referenceDate]
  );
  return rows[0] || null;
}

async function findUserRankGroup(userId) {
  const [rows] = await pool.query(
    'SELECT rank_group FROM users WHERE id = ? AND deleted_at IS NULL LIMIT 1',
    [userId]
  );
  return rows[0]?.rank_group || null;
}

module.exports = {
  VALID_RANK_GROUPS,
  VALID_SERVICE_SCOPES,
  listBaseValues,
  findActiveBaseValue,
  listFinancialRules,
  findActiveFinancialRule,
  findUserRankGroup,
};
