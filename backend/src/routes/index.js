const express = require('express');
const authRoutes = require('../modules/auth/auth.routes');
const serviceTypesRoutes = require('../modules/service-types/service-types.routes');
const servicesRoutes = require('../modules/services/services.routes');
const alertsRoutes = require('../modules/alerts/alerts.routes');
const dashboardRoutes = require('../modules/dashboard/dashboard.routes');
const schedulesRoutes = require('../modules/schedules/schedules.routes');
const agendaRoutes = require('../modules/agenda/agenda.routes');
const planningRoutes = require('../modules/planning/planning.routes');
const financeRoutes = require('../modules/finance/finance.routes');
const reportsRoutes = require('../modules/reports/reports.routes');
const pricingRoutes = require('../modules/pricing/pricing.routes');
const adminRoutes = require('../modules/admin/admin.routes');
const db = require('../config/db');
const env = require('../config/env');

const router = express.Router();

router.get('/health', (req, res) => {
  return res.status(200).json({
    data: {
      status: 'ok',
      timestamp: new Date().toISOString(),
      environment: env.nodeEnv,
    },
    meta: null,
    errors: null,
  });
});

router.get('/ready', async (req, res) => {
  let dbStatus = 'up';
  let configStatus = 'ok';

  try {
    await db.testConnection();
  } catch (error) {
    dbStatus = 'down';
  }

  try {
    if (!env.jwt.secret || !env.db.host) {
      throw new Error('Config invalida');
    }
  } catch (error) {
    configStatus = 'invalid';
  }

  const ready = dbStatus === 'up' && configStatus === 'ok';

  return res.status(ready ? 200 : 503).json({
    data: {
      status: ready ? 'ready' : 'not_ready',
      timestamp: new Date().toISOString(),
      environment: env.nodeEnv,
      checks: {
        database: dbStatus,
        config: configStatus,
      },
    },
    meta: null,
    errors: null,
  });
});

router.use('/auth', authRoutes);
router.use('/service-types', serviceTypesRoutes);
router.use('/services', servicesRoutes);
router.use('/alerts', alertsRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/schedules', schedulesRoutes);
router.use('/agenda', agendaRoutes);
router.use('/planning', planningRoutes);
router.use('/finance', financeRoutes);
router.use('/reports', reportsRoutes);
router.use('/pricing', pricingRoutes);
router.use('/admin', adminRoutes);

module.exports = router;
