const asyncHandler = require('../../utils/async-handler');
const service = require('./finance.service');

const summary = asyncHandler(async (req, res) => {
  const data = await service.getSummary(req.user.id, req.query);
  res.status(200).json({ data, meta: null, errors: null });
});

const report = asyncHandler(async (req, res) => {
  const data = await service.getReport(req.user.id, req.query);
  res.status(200).json({ data, meta: null, errors: null });
});

module.exports = {
  summary,
  report,
};
