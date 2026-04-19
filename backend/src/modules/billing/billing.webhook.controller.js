const crypto = require('crypto');
const billingService = require('./billing.service');
const logger = require('../../utils/logger');
const env = require('../../config/env');

async function handleMercadoPago(req, res) {
  // Respond immediately — MP requires fast ACK
  res.status(200).json({ received: true });

  try {
    const mp = env.mercadoPago;

    if (mp && mp.webhookSecret) {
      const xSignature = req.headers['x-signature'] || '';
      const xRequestId = req.headers['x-request-id'] || '';
      const dataId =
        req.body && req.body.data && req.body.data.id
          ? String(req.body.data.id)
          : req.query.id || '';

      if (!validateMpSignature(xSignature, xRequestId, dataId, mp.webhookSecret)) {
        logger.warn('billing.webhook.invalid_signature', { x_request_id: xRequestId });
        return;
      }
    }

    const body = req.body || {};
    const eventId = body.id ? String(body.id) : req.query.id || '';
    const eventType = body.type || body.topic || 'unknown';
    const action = body.action || '';

    if (!eventId) {
      logger.warn('billing.webhook.missing_event_id', { body });
      return;
    }

    logger.info('billing.webhook.received', { event_id: eventId, type: eventType, action });

    await billingService.handleMercadoPagoWebhook(eventId, eventType, body);
  } catch (err) {
    logger.error('billing.webhook.error', { error: err.message });
  }
}

function validateMpSignature(xSignature, xRequestId, dataId, secret) {
  if (!xSignature) return false;
  try {
    const parts = {};
    xSignature.split(';').forEach((part) => {
      const eq = part.indexOf('=');
      if (eq > 0) {
        parts[part.slice(0, eq).trim()] = part.slice(eq + 1).trim();
      }
    });
    const { ts, v1 } = parts;
    if (!ts || !v1) return false;
    const manifest = `id:${dataId};request-id:${xRequestId};ts:${ts};`;
    const expected = crypto.createHmac('sha256', secret).update(manifest).digest('hex');
    const expectedBuf = Buffer.from(expected);
    const v1Buf = Buffer.from(v1);
    if (expectedBuf.length !== v1Buf.length) return false;
    return crypto.timingSafeEqual(expectedBuf, v1Buf);
  } catch {
    return false;
  }
}

module.exports = { handleMercadoPago };
