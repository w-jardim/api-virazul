const express = require('express');
const authRoutes = require('../modules/auth/auth.routes');
const serviceTypesRoutes = require('../modules/service-types/service-types.routes');
const servicesRoutes = require('../modules/services/services.routes');
const alertsRoutes = require('../modules/alerts/alerts.routes');
const dashboardRoutes = require('../modules/dashboard/dashboard.routes');
const schedulesRoutes = require('../modules/schedules/schedules.routes');
const agendaRoutes = require('../modules/agenda/agenda.routes');
const planningRoutes = require('../modules/planning/planning.routes');
const db = require('../config/db');
const env = require('../config/env');

const router = express.Router();

router.get('/health', async (req, res) => {
  let dbStatus = 'up';

  try {
    await db.testConnection();
  } catch (error) {
    dbStatus = 'down';
  }

  const status = dbStatus === 'up' ? 'ok' : 'degraded';

  return res.status(200).json({
    data: {
      status,
      timestamp: new Date().toISOString(),
      environment: env.nodeEnv,
      database: dbStatus,
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

module.exports = router;
