const service = require('./analytics.service');

async function user(req, res, next) {
  try {
    const userId = req.user && req.user.id;
    const data = await service.getUserAnalytics(userId, req.query);
    return res.status(200).json({ data, meta: null, errors: null });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  user,
};
