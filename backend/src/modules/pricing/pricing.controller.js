const asyncHandler = require('../../utils/async-handler');
const service = require('./pricing.service');

const listBaseValues = asyncHandler(async (req, res) => {
  const data = await service.listBaseValues(req.query);
  res.status(200).json({ data, meta: null, errors: null });
});

const listFinancialRules = asyncHandler(async (req, res) => {
  const data = await service.listFinancialRules(req.query);
  res.status(200).json({ data, meta: null, errors: null });
});

const preview = asyncHandler(async (req, res) => {
  const data = await service.preview(req.query);
  res.status(200).json({ data, meta: null, errors: null });
});

module.exports = {
  listBaseValues,
  listFinancialRules,
  preview,
};
