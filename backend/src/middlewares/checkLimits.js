const { pool } = require('../config/db');
const { PLANS } = require('../constants/plans');

module.exports = async function checkLimits(req, res, next) {
  if (req.plan === 'preview') return next();

  if (req.limitedAccess) {
    return res.status(403).json({ error: 'Pagamento pendente' });
  }

  const config = PLANS[req.plan];

  if (!config || config.service_limit === Infinity) return next();

  if (config.service_limit === 0) {
    return res.status(403).json({ error: 'Plano não permite criação de serviços' });
  }

  try {
    const month = new Date().getMonth() + 1;
    const year = new Date().getFullYear();

    const [rows] = await pool.query(
      `SELECT services_created FROM usage_metrics
       WHERE account_id = ? AND month = ? AND year = ?`,
      [req.user.id, month, year]
    );

    const count = rows[0]?.services_created || 0;

    if (count >= config.service_limit) {
      return res.status(403).json({ error: 'Limite mensal atingido' });
    }

    req.usage = count;
    return next();
  } catch (err) {
    return next(err);
  }
};
