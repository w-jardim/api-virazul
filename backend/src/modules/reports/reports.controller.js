const asyncHandler = require('../../utils/async-handler');
const service = require('./reports.service');

const operational = asyncHandler(async (req, res) => {
  const data = await service.getOperationalReport(req.user.id, req.query);
  res.status(200).json({ data, meta: null, errors: null });
});

const financial = asyncHandler(async (req, res) => {
  const data = await service.getFinancialReport(req.user.id, req.query);
  res.status(200).json({ data, meta: null, errors: null });
});

module.exports = {
  operational,
  financial,
};
