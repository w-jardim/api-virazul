const { pool } = require('../../config/db');

async function listAll() {
  const [rows] = await pool.query(
    `SELECT
       id,
       \`key\`,
       name,
       category,
       allows_reservation,
       requires_manual_value,
       counts_in_financial,
       shows_in_agenda,
       accounting_rules,
       created_at,
       updated_at
     FROM service_types
     ORDER BY name ASC`
  );

  return rows;
}

async function findByKey(key) {
  const [rows] = await pool.query(
    `SELECT id, \`key\`, name, category, allows_reservation, requires_manual_value,
            counts_in_financial, shows_in_agenda, accounting_rules, created_at, updated_at
       FROM service_types
      WHERE \`key\` = ?
      LIMIT 1`,
    [key]
  );

  return rows[0] || null;
}

async function findById(id) {
  const [rows] = await pool.query(
    `SELECT id, \`key\`, name, category, allows_reservation, requires_manual_value,
            counts_in_financial, shows_in_agenda, accounting_rules, created_at, updated_at
       FROM service_types
      WHERE id = ?
      LIMIT 1`,
    [id]
  );

  return rows[0] || null;
}

async function create(data) {
  const [result] = await pool.query(
    `INSERT INTO service_types (
      \`key\`, name, category, allows_reservation, requires_manual_value,
      counts_in_financial, shows_in_agenda, accounting_rules
    ) VALUES (?, ?, ?, ?, ?, ?, ?, CAST(? AS JSON))`,
    [
      data.key,
      data.name,
      data.category,
      Number(data.allows_reservation),
      Number(data.requires_manual_value),
      Number(data.counts_in_financial),
      Number(data.shows_in_agenda),
      JSON.stringify(data.accounting_rules || {}),
    ]
  );

  return findById(result.insertId);
}

module.exports = {
  listAll,
  findByKey,
  findById,
  create,
};
