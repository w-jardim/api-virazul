const AppError = require('../../utils/app-error');
const logger = require('../../utils/logger');
const env = require('../../config/env');
const billingRepo = require('./billing.repository');
const subscriptionsRepo = require('../subscriptions/subscriptions.repository');
const { PLAN_DEFINITIONS } = require('../../constants/plans');
const { normalizePlanCode, resolveAccountAccess } = require('../../utils/plan-access');

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

const BILLABLE_PLANS = new Set(['plan_starter', 'plan_pro']);
const DEFAULT_CHECKOUT_PLAN = 'plan_pro';
const TRIAL_PLAN = 'plan_pro';

function resolveTargetPlan(planCode) {
  const normalized = normalizePlanCode(planCode, { fallback: DEFAULT_CHECKOUT_PLAN });
  if (!BILLABLE_PLANS.has(normalized)) {
    throw new AppError('BILLING_PLAN_NOT_SUPPORTED', 'Plano informado nao pode ser contratado.', 400);
  }
  return normalized;
}

function parsePaymentMeta(rawPayloadJson) {
  if (!rawPayloadJson) {
    return {};
  }

  if (typeof rawPayloadJson === 'object') {
    return rawPayloadJson;
  }

  try {
    return JSON.parse(rawPayloadJson);
  } catch (error) {
    return {};
  }
}

function buildPlanPricing(planCode, planRecord) {
  return {
    amountCents: planRecord?.price_cents || PLAN_DEFINITIONS[planCode]?.priceCents || env.billing.premiumPriceCents,
    name: planRecord?.name || PLAN_DEFINITIONS[planCode]?.name || planCode,
  };
}

function buildAccessFromSubscription(sub) {
  if (!sub) {
    return {
      basePlan: 'plan_free',
      partnerActive: false,
    };
  }

  return resolveAccountAccess({
    rawPlan: sub.raw_plan || sub.plan,
    userBasePlan: sub.raw_plan || sub.plan,
    subscriptionStatus: sub.status,
    currentPeriodEnd: sub.current_period_end || null,
    trialEndsAt: sub.trial_ends_at || null,
    partnerExpiresAt: sub.partner_expires_at || null,
  });
}

async function startTrial(userId) {
  const existing = await subscriptionsRepo.findCurrentByUserId(userId);
  if (existing) {
    logger.info('billing.trial.already_exists', { user_id: userId, sub_id: existing.id });
    return existing;
  }

  const trialDays = env.billing.trialDays;
  const subId = await subscriptionsRepo.createTrialSubscription(userId, trialDays);

  await subscriptionsRepo.syncLegacyUserFields(userId, {
    subscription: TRIAL_PLAN,
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
  const access = buildAccessFromSubscription(sub);

  return {
    plan: access.basePlan,
    plan_name: sub.plan_name || access.basePlan || 'Free',
    plan_price_cents: sub.price_cents || 0,
    status: sub.status,
    partner_active: access.partnerActive,
    partner_expires_at: sub.partner_expires_at || null,
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
    partner_active: false,
    partner_expires_at: null,
    started_at: null,
    trial_ends_at: null,
    current_period_start: null,
    current_period_end: null,
    next_billing_at: null,
    canceled_at: null,
    latest_payment: null,
  };
}

async function createCheckoutPremium(userId, userEmail, targetPlanInput = DEFAULT_CHECKOUT_PLAN) {
  const mp = env.mercadoPago;
  if (!mp || !mp.accessToken) {
    throw new AppError('BILLING_NOT_CONFIGURED', 'Gateway de pagamento nao configurado.', 503);
  }

  const targetPlan = resolveTargetPlan(targetPlanInput);
  const plan = await billingRepo.findPlanByCode(targetPlan);
  if (!plan) {
    throw new AppError('BILLING_PLAN_NOT_FOUND', 'Plano nao encontrado.', 404);
  }

  const sub = await subscriptionsRepo.findCurrentByUserId(userId);
  const pricing = buildPlanPricing(targetPlan, plan);
  const amountBRL = pricing.amountCents / 100;

  const paymentDbId = await billingRepo.createPayment({
    userId,
    subscriptionId: sub ? sub.id : null,
    gateway: 'mercadopago',
    amountCents: pricing.amountCents,
    currency: 'BRL',
    status: 'pending',
    rawPayloadJson: {
      plan_code: targetPlan,
    },
  });

  const backUrl = mp.backUrl || 'http://localhost:3000';
  const preferenceBody = {
    items: [
      {
        id: targetPlan,
        title: `Virazul - ${pricing.name}`,
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
  logger.info('billing.checkout.created', {
    user_id: userId,
    preference_id: preference.id,
    payment_db_id: paymentDbId,
    plan_code: targetPlan,
  });

  return {
    checkout_url: preference.init_point,
    preference_id: preference.id,
    payment_id: paymentDbId,
    plan_code: targetPlan,
  };
}

async function createPixCharge(userId, userEmail, targetPlanInput = DEFAULT_CHECKOUT_PLAN) {
  const mp = env.mercadoPago;
  if (!mp || !mp.accessToken) {
    throw new AppError('BILLING_NOT_CONFIGURED', 'Gateway de pagamento nao configurado.', 503);
  }

  const targetPlan = resolveTargetPlan(targetPlanInput);
  const plan = await billingRepo.findPlanByCode(targetPlan);
  if (!plan) {
    throw new AppError('BILLING_PLAN_NOT_FOUND', 'Plano nao encontrado.', 404);
  }

  const sub = await subscriptionsRepo.findCurrentByUserId(userId);
  const pricing = buildPlanPricing(targetPlan, plan);
  const amountBRL = pricing.amountCents / 100;

  const paymentDbId = await billingRepo.createPayment({
    userId,
    subscriptionId: sub ? sub.id : null,
    gateway: 'mercadopago',
    amountCents: pricing.amountCents,
    currency: 'BRL',
    status: 'pending',
    paymentMethod: 'pix',
    rawPayloadJson: {
      plan_code: targetPlan,
    },
  });

  const pixBody = {
    transaction_amount: amountBRL,
    payment_method_id: 'pix',
    payer: { email: userEmail },
    external_reference: String(paymentDbId),
    notification_url: mp.webhookUrl || undefined,
    description: `Virazul - ${pricing.name}`,
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
  logger.info('billing.pix.created', {
    user_id: userId,
    mp_payment_id: mpPayment.id,
    payment_db_id: paymentDbId,
    plan_code: targetPlan,
  });

  return {
    payment_id: paymentDbId,
    mp_payment_id: mpPayment.id,
    status: mpPayment.status,
    plan_code: targetPlan,
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

  const access = buildAccessFromSubscription(sub);

  if (access.partnerActive || access.basePlan === 'plan_free') {
    throw new AppError(
      'BILLING_FREE_ADMIN_ONLY',
      'A condicao partner e o plano Free so podem ser alterados por um administrador.',
      400
    );
  }

  if (access.basePlan === TRIAL_PLAN && sub.status === 'trialing') {
    throw new AppError(
      'BILLING_TRIAL_NOT_CANCELABLE',
      'O periodo de teste permanece ativo ate o vencimento e nao pode ser cancelado por autoatendimento.',
      400
    );
  }

  if (['canceled', 'expired'].includes(sub.status)) {
    throw new AppError('BILLING_ALREADY_CANCELED', 'Assinatura ja esta cancelada ou expirada.', 400);
  }

  if (!BILLABLE_PLANS.has(access.basePlan)) {
    throw new AppError(
      'BILLING_PLAN_NOT_CANCELABLE',
      'Somente planos comerciais pagos podem ser cancelados por autoatendimento.',
      400
    );
  }

  await subscriptionsRepo.cancelSubscription(sub.id);
  await subscriptionsRepo.syncLegacyUserFields(userId, {
    subscription: access.basePlan,
    paymentStatus: 'cancelled',
    paymentDueDate: null,
  });

  logger.info('billing.subscription.canceled', {
    user_id: userId,
    sub_id: sub.id,
    legacy_subscription: access.basePlan,
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
    if (!Number.isNaN(refId)) {
      payment = await billingRepo.findPaymentById(refId);
    }
  }

  if (!payment) {
    logger.warn('billing.webhook.payment_not_found', { mp_id: mpPaymentId, ext_ref: externalRef });
    return;
  }

  const paymentMeta = parsePaymentMeta(payment.raw_payload_json);
  const targetPlan = resolveTargetPlan(paymentMeta.plan_code || DEFAULT_CHECKOUT_PLAN);

  await billingRepo.updatePayment(payment.id, {
    status: ourStatus,
    gateway_payment_id: mpPaymentId,
    payment_method: mpPayment.payment_type_id || null,
    paid_at: mpStatus === 'approved' ? new Date() : null,
    raw_payload_json: mpPayment,
  });

  if (mpStatus === 'approved') {
    await activateSubscriptionForPayment(payment.id, mpPayment, targetPlan);
  } else if (mpStatus === 'rejected' || mpStatus === 'cancelled') {
    await handleFailedPayment(payment, targetPlan);
  }
}

async function activateSubscriptionForPayment(paymentDbId, mpPayment, targetPlan = DEFAULT_CHECKOUT_PLAN) {
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
      plan: targetPlan,
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
      partnerExpiresAt: null,
    });
    await subscriptionsRepo.attachGatewayData(sub.id, {
      gateway: 'mercadopago',
      gatewayCustomerId: null,
      gatewaySubscriptionId: String(mpPayment.id),
    });
  } else {
    const newSubId = await subscriptionsRepo.createSubscription({
      userId,
      plan: targetPlan,
      status: 'active',
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
      partnerExpiresAt: null,
    });
    await subscriptionsRepo.attachGatewayData(newSubId, {
      gateway: 'mercadopago',
      gatewayCustomerId: null,
      gatewaySubscriptionId: String(mpPayment.id),
    });
  }

  await subscriptionsRepo.syncLegacyUserFields(userId, {
    subscription: targetPlan,
    paymentStatus: 'paid',
    paymentDueDate: periodEnd.toISOString().slice(0, 10),
  });

  logger.info('billing.subscription.activated', {
    user_id: userId,
    period_end: periodEnd,
    plan_code: targetPlan,
  });
}

async function handleFailedPayment(payment, targetPlan = DEFAULT_CHECKOUT_PLAN) {
  const userId = payment.user_id;
  const sub = payment.subscription_id
    ? await subscriptionsRepo.findById(payment.subscription_id)
    : await subscriptionsRepo.findCurrentByUserId(userId);

  if (sub && sub.status === 'active') {
    await subscriptionsRepo.updateSubscriptionStatus(sub.id, 'past_due');
    await subscriptionsRepo.syncLegacyUserFields(userId, {
      subscription: targetPlan,
      paymentStatus: 'rejected',
    });
    logger.warn('billing.subscription.past_due', { user_id: userId, sub_id: sub.id, plan_code: targetPlan });
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
