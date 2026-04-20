const service = require('./user-analytics.service');

async function overview(req, res, next) {
  try {
    const data = await service.getOverview(req.query);
    return res.status(200).json({ data, meta: null, errors: null });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  overview,
};
