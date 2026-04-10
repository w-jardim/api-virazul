const asyncHandler = require('../../utils/async-handler');
const service = require('./dashboard.service');

const summary = asyncHandler(async (req, res) => {
  const data = await service.getSummary(req.user.id);
  res.status(200).json({ data, meta: null, errors: null });
});

module.exports = {
  summary,
};
