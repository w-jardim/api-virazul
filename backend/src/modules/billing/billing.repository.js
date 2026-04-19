const { pool } = require('../../config/db');

async function findPlanByCode(code) {
  const [rows] = await pool.query(
    'SELECT * FROM plans WHERE code = ? AND is_active = 1 LIMIT 1',
    [code]
  );
  return rows[0] || null;
}

async function findAllActivePlans() {
  const [rows] = await pool.query(
    'SELECT * FROM plans WHERE is_active = 1 ORDER BY price_cents ASC'
  );
  return rows;
}

async function createPayment({
  userId,
  subscriptionId,
  gateway,
  gatewayPaymentId,
  externalReference,
  paymentMethod,
  amountCents,
  currency,
  status,
  dueAt,
  rawPayloadJson,
}) {
  const [result] = await pool.query(
    `INSERT INTO payments
       (user_id, subscription_id, gateway, gateway_payment_id, external_reference,
        payment_method, amount_cents, currency, status, due_at, raw_payload_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      userId,
      subscriptionId || null,
      gateway || 'mercadopago',
      gatewayPaymentId || null,
      externalReference || null,
      paymentMethod || null,
      amountCents || 0,
      currency || 'BRL',
      status || 'pending',
      dueAt || null,
      rawPayloadJson ? JSON.stringify(rawPayloadJson) : null,
    ]
  );
  return result.insertId;
}

async function updatePayment(id, fields) {
  const allowed = ['status', 'gateway_payment_id', 'payment_method', 'paid_at', 'raw_payload_json'];
  const updates = [];
  const values = [];
  for (const key of allowed) {
    if (fields[key] !== undefined) {
      updates.push(`${key} = ?`);
      const val = fields[key];
      values.push(
        val !== null && typeof val === 'object' && !(val instanceof Date)
          ? JSON.stringify(val)
          : val
      );
    }
  }
  if (updates.length === 0) return;
  updates.push('updated_at = CURRENT_TIMESTAMP');
  values.push(id);
  await pool.query(`UPDATE payments SET ${updates.join(', ')} WHERE id = ?`, values);
}

async function findPaymentById(id) {
  const [rows] = await pool.query('SELECT * FROM payments WHERE id = ? LIMIT 1', [id]);
  return rows[0] || null;
}

async function findPaymentByGatewayId(gateway, gatewayPaymentId) {
  const [rows] = await pool.query(
    'SELECT * FROM payments WHERE gateway = ? AND gateway_payment_id = ? LIMIT 1',
    [gateway, gatewayPaymentId]
  );
  return rows[0] || null;
}

async function findLatestPaymentByUserId(userId) {
  const [rows] = await pool.query(
    'SELECT * FROM payments WHERE user_id = ? ORDER BY created_at DESC LIMIT 1',
    [userId]
  );
  return rows[0] || null;
}

async function createWebhookEvent({ gateway, eventId, eventType, payloadJson }) {
  await pool.query(
    'INSERT IGNORE INTO webhook_events (gateway, event_id, event_type, payload_json) VALUES (?, ?, ?, ?)',
    [gateway, eventId, eventType, JSON.stringify(payloadJson)]
  );
  const [rows] = await pool.query(
    'SELECT id, processed FROM webhook_events WHERE gateway = ? AND event_id = ? LIMIT 1',
    [gateway, eventId]
  );
  return rows[0] || null;
}

async function markWebhookProcessed(id) {
  await pool.query(
    'UPDATE webhook_events SET processed = 1, processed_at = NOW() WHERE id = ?',
    [id]
  );
}

module.exports = {
  findPlanByCode,
  findAllActivePlans,
  createPayment,
  updatePayment,
  findPaymentById,
  findPaymentByGatewayId,
  findLatestPaymentByUserId,
  createWebhookEvent,
  markWebhookProcessed,
};
