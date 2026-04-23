const AppError = require('../../utils/app-error');
const logger = require('../../utils/logger');
const env = require('../../config/env');
const billingRepo = require('./billing.repository');
const subscriptionsRepo = require('../subscriptions/subscriptions.repository');

const MP_STATUS_MAP = {
  approved: 'approved',
  pending: 'pending',
  in_process: 'in_process',
  authorized: 'pending',
  rejected: 'rejected',
  cancelled: 'cancelled',
  refunded: 'refunded',
  charged_back: 'refunded',
};

async function startTrial(userId) {
  const existing = await subscriptionsRepo.findCurrentByUserId(userId);
  if (existing) {
    logger.info('billing.trial.already_exists', { user_id: userId, sub_id: existing.id });
    return existing;
  }

  const trialDays = env.billing.trialDays;
  const subId = await subscriptionsRepo.createTrialSubscription(userId, trialDays);

  await subscriptionsRepo.syncLegacyUserFields(userId, {
    subscription: 'plan_pro',
    paymentStatus: 'pending',
    paymentDueDate: null,
  });

  logger.info('billing.trial.started', { user_id: userId, subscription_id: subId, trial_days: trialDays });
  return { id: subId };
}

async function getSubscriptionStatus(userId) {
  const sub = await subscriptionsRepo.findCurrentByUserId(userId);

  if (!sub) {
    return buildFreeResponse();
  }

  if (sub.status === 'trialing' && sub.trial_ends_at && new Date() > new Date(sub.trial_ends_at)) {
    await subscriptionsRepo.updateSubscriptionStatus(sub.id, 'expired');
    await subscriptionsRepo.syncLegacyUserFields(userId, { subscription: 'plan_free' });
    sub.status = 'expired';
  }

  const latestPayment = await billingRepo.findLatestPaymentByUserId(userId);

  return {
    plan: sub.plan || 'plan_free',
    plan_name: sub.plan_name || sub.plan || 'Free',
    plan_price_cents: sub.price_cents || 0,
    status: sub.status,
    started_at: sub.started_at || null,
    trial_ends_at: sub.trial_ends_at || null,
    current_period_start: sub.current_period_start || null,
    current_period_end: sub.current_period_end || null,
    next_billing_at: sub.current_period_end || null,
    canceled_at: sub.canceled_at || null,
    latest_payment: latestPayment
      ? {
          status: latestPayment.status,
          amount_cents: latestPayment.amount_cents,
          payment_method: latestPayment.payment_method,
          paid_at: latestPayment.paid_at,
          created_at: latestPayment.created_at,
        }
      : null,
  };
}

function buildFreeResponse() {
  return {
    plan: 'plan_free',
    plan_name: 'Free',
    plan_price_cents: 0,
    status: 'active',
    started_at: null,
    trial_ends_at: null,
    current_period_start: null,
    current_period_end: null,
    next_billing_at: null,
    canceled_at: null,
    latest_payment: null,
  };
}

async function createCheckoutPremium(userId, userEmail) {
  const mp = env.mercadoPago;
  if (!mp || !mp.accessToken) {
    throw new AppError('BILLING_NOT_CONFIGURED', 'Gateway de pagamento nao configurado.', 503);
  }

  const plan = await billingRepo.findPlanByCode('plan_pro');
  if (!plan) {
    throw new AppError('BILLING_PLAN_NOT_FOUND', 'Plano Pro nao encontrado.', 404);
  }

  const sub = await subscriptionsRepo.findCurrentByUserId(userId);
  const amountCents = plan.price_cents || env.billing.premiumPriceCents;
  const amountBRL = amountCents / 100;

  const paymentDbId = await billingRepo.createPayment({
    userId,
    subscriptionId: sub ? sub.id : null,
    gateway: 'mercadopago',
    amountCents,
    currency: 'BRL',
    status: 'pending',
  });

  const backUrl = mp.backUrl || 'http://localhost:3000';
  const preferenceBody = {
    items: [
      {
        id: 'plan_pro',
        title: `Virazul - ${plan.name}`,
        quantity: 1,
        unit_price: amountBRL,
        currency_id: 'BRL',
      },
    ],
    payer: { email: userEmail },
    external_reference: String(paymentDbId),
    back_urls: {
      success: `${backUrl}/billing/success`,
      failure: `${backUrl}/billing/failure`,
      pending: `${backUrl}/billing/pending`,
    },
    auto_return: 'approved',
    notification_url: mp.webhookUrl || undefined,
  };

  const response = await fetch('https://api.mercadopago.com/checkout/preferences', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${mp.accessToken}`,
    },
    body: JSON.stringify(preferenceBody),
  });

  if (!response.ok) {
    const errText = await response.text();
    logger.error('billing.checkout.mp_error', { status: response.status, body: errText, user_id: userId });
    throw new AppError('BILLING_CHECKOUT_FAILED', 'Erro ao criar checkout. Tente novamente.', 502);
  }

  const preference = await response.json();
  logger.info('billing.checkout.created', { user_id: userId, preference_id: preference.id, payment_db_id: paymentDbId });

  return {
    checkout_url: preference.init_point,
    preference_id: preference.id,
    payment_id: paymentDbId,
  };
}

async function createPixCharge(userId, userEmail) {
  const mp = env.mercadoPago;
  if (!mp || !mp.accessToken) {
    throw new AppError('BILLING_NOT_CONFIGURED', 'Gateway de pagamento nao configurado.', 503);
  }

  const plan = await billingRepo.findPlanByCode('plan_pro');
  if (!plan) {
    throw new AppError('BILLING_PLAN_NOT_FOUND', 'Plano Pro nao encontrado.', 404);
  }

  const sub = await subscriptionsRepo.findCurrentByUserId(userId);
  const amountCents = plan.price_cents || env.billing.premiumPriceCents;
  const amountBRL = amountCents / 100;

  const paymentDbId = await billingRepo.createPayment({
    userId,
    subscriptionId: sub ? sub.id : null,
    gateway: 'mercadopago',
    amountCents,
    currency: 'BRL',
    status: 'pending',
    paymentMethod: 'pix',
  });

  const pixBody = {
    transaction_amount: amountBRL,
    payment_method_id: 'pix',
    payer: { email: userEmail },
    external_reference: String(paymentDbId),
    notification_url: mp.webhookUrl || undefined,
    description: `Virazul - ${plan.name}`,
  };

  const response = await fetch('https://api.mercadopago.com/v1/payments', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${mp.accessToken}`,
      'X-Idempotency-Key': `pix-uid${userId}-pay${paymentDbId}`,
    },
    body: JSON.stringify(pixBody),
  });

  if (!response.ok) {
    const errText = await response.text();
    logger.error('billing.pix.mp_error', { status: response.status, body: errText, user_id: userId });
    throw new AppError('BILLING_PIX_FAILED', 'Erro ao gerar Pix. Tente novamente.', 502);
  }

  const mpPayment = await response.json();

  await billingRepo.updatePayment(paymentDbId, {
    gateway_payment_id: String(mpPayment.id),
    raw_payload_json: mpPayment,
  });

  const txData = (mpPayment.point_of_interaction && mpPayment.point_of_interaction.transaction_data) || {};
  logger.info('billing.pix.created', { user_id: userId, mp_payment_id: mpPayment.id, payment_db_id: paymentDbId });

  return {
    payment_id: paymentDbId,
    mp_payment_id: mpPayment.id,
    status: mpPayment.status,
    qr_code: txData.qr_code || null,
    qr_code_base64: txData.qr_code_base64 || null,
    ticket_url: txData.ticket_url || null,
  };
}

async function cancelUserSubscription(userId) {
  const sub = await subscriptionsRepo.findCurrentByUserId(userId);
  if (!sub) {
    throw new AppError('BILLING_NO_SUBSCRIPTION', 'Nenhuma assinatura encontrada.', 404);
  }

  if (sub.plan === 'plan_free' || sub.plan === 'plan_partner') {
    throw new AppError(
      'BILLING_FREE_ADMIN_ONLY',
      'O plano Free é uma cortesia administrativa e só pode ser alterado por um administrador.',
      400
    );
  }

  if (sub.plan === 'plan_pro' && sub.status === 'trialing') {
    throw new AppError(
      'BILLING_TRIAL_NOT_CANCELABLE',
      'O período de teste permanece ativo até o vencimento e não pode ser cancelado por autoatendimento.',
      400
    );
  }

  if (['canceled', 'expired'].includes(sub.status)) {
    throw new AppError('BILLING_ALREADY_CANCELED', 'Assinatura ja esta cancelada ou expirada.', 400);
  }

  if (sub.plan !== 'plan_pro') {
    throw new AppError(
      'BILLING_PLAN_NOT_CANCELABLE',
      'Somente assinaturas Pro podem ser canceladas por autoatendimento.',
      400
    );
  }

  await subscriptionsRepo.cancelSubscription(sub.id);
  await subscriptionsRepo.syncLegacyUserFields(userId, {
    subscription: 'plan_pro',
    paymentStatus: 'cancelled',
    paymentDueDate: null,
  });

  logger.info('billing.subscription.canceled', {
    user_id: userId,
    sub_id: sub.id,
    legacy_subscription: 'plan_pro',
  });

  return { canceled: true };
}

async function handleMercadoPagoWebhook(eventId, eventType, payloadJson) {
  const event = await billingRepo.createWebhookEvent({
    gateway: 'mercadopago',
    eventId: String(eventId),
    eventType,
    payloadJson,
  });

  if (!event) {
    logger.warn('billing.webhook.insert_failed', { event_id: eventId });
    return { status: 'error' };
  }

  if (event.processed) {
    logger.info('billing.webhook.already_processed', { event_id: eventId, db_id: event.id });
    return { status: 'already_processed' };
  }

  try {
    const action = payloadJson.action || '';
    const dataId = payloadJson.data && payloadJson.data.id ? String(payloadJson.data.id) : null;

    if ((eventType === 'payment' || action.startsWith('payment.')) && dataId) {
      await processMpPaymentEvent(dataId);
    }

    await billingRepo.markWebhookProcessed(event.id);
    logger.info('billing.webhook.processed', { event_id: eventId, db_id: event.id, type: eventType });
    return { status: 'processed' };
  } catch (err) {
    logger.error('billing.webhook.process_error', { event_id: eventId, db_id: event.id, error: err.message });
    throw err;
  }
}

async function processMpPaymentEvent(mpPaymentId) {
  const mp = env.mercadoPago;
  if (!mp || !mp.accessToken) {
    throw new Error('Mercado Pago not configured');
  }

  const response = await fetch(`https://api.mercadopago.com/v1/payments/${mpPaymentId}`, {
    headers: { Authorization: `Bearer ${mp.accessToken}` },
  });

  if (!response.ok) {
    throw new Error(`MP API error fetching payment ${mpPaymentId}: ${response.status}`);
  }

  const mpPayment = await response.json();
  const mpStatus = mpPayment.status;
  const externalRef = mpPayment.external_reference;
  const ourStatus = MP_STATUS_MAP[mpStatus] || 'pending';

  logger.info('billing.payment.fetched', { mp_id: mpPaymentId, mp_status: mpStatus, ext_ref: externalRef });

  let payment = await billingRepo.findPaymentByGatewayId('mercadopago', mpPaymentId);

  if (!payment && externalRef) {
    const refId = parseInt(externalRef, 10);
    if (!isNaN(refId)) {
      payment = await billingRepo.findPaymentById(refId);
    }
  }

  if (payment) {
    await billingRepo.updatePayment(payment.id, {
      status: ourStatus,
      gateway_payment_id: mpPaymentId,
      payment_method: mpPayment.payment_type_id || null,
      paid_at: mpStatus === 'approved' ? new Date() : null,
      raw_payload_json: mpPayment,
    });
  } else {
    logger.warn('billing.webhook.payment_not_found', { mp_id: mpPaymentId, ext_ref: externalRef });
    return;
  }

  if (mpStatus === 'approved') {
    await activateSubscriptionForPayment(payment.id, mpPayment);
  } else if (mpStatus === 'rejected' || mpStatus === 'cancelled') {
    await handleFailedPayment(payment);
  }
}

async function activateSubscriptionForPayment(paymentDbId, mpPayment) {
  const payment = await billingRepo.findPaymentById(paymentDbId);
  if (!payment) return;

  const userId = payment.user_id;
  const now = new Date();
  const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  let sub = payment.subscription_id
    ? await subscriptionsRepo.findById(payment.subscription_id)
    : await subscriptionsRepo.findCurrentByUserId(userId);

  if (sub) {
    await subscriptionsRepo.updateSubscriptionCycle(sub.id, {
      status: 'active',
      plan: 'plan_pro',
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
    });
    await subscriptionsRepo.attachGatewayData(sub.id, {
      gateway: 'mercadopago',
      gatewayCustomerId: null,
      gatewaySubscriptionId: String(mpPayment.id),
    });
  } else {
    const newSubId = await subscriptionsRepo.createSubscription({
      userId,
      plan: 'plan_pro',
      status: 'active',
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
    });
    await subscriptionsRepo.attachGatewayData(newSubId, {
      gateway: 'mercadopago',
      gatewayCustomerId: null,
      gatewaySubscriptionId: String(mpPayment.id),
    });
  }

  await subscriptionsRepo.syncLegacyUserFields(userId, {
    subscription: 'plan_pro',
    paymentStatus: 'paid',
    paymentDueDate: periodEnd.toISOString().slice(0, 10),
  });

  logger.info('billing.subscription.activated', { user_id: userId, period_end: periodEnd });
}

async function handleFailedPayment(payment) {
  const userId = payment.user_id;
  const sub = payment.subscription_id
    ? await subscriptionsRepo.findById(payment.subscription_id)
    : await subscriptionsRepo.findCurrentByUserId(userId);

  if (sub && sub.status === 'active') {
    await subscriptionsRepo.updateSubscriptionStatus(sub.id, 'past_due');
    await subscriptionsRepo.syncLegacyUserFields(userId, { paymentStatus: 'rejected' });
    logger.warn('billing.subscription.past_due', { user_id: userId, sub_id: sub.id });
  }
}

module.exports = {
  startTrial,
  getSubscriptionStatus,
  createCheckoutPremium,
  createPixCharge,
  cancelUserSubscription,
  handleMercadoPagoWebhook,
};
