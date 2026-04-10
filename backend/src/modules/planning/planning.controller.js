const asyncHandler = require('../../utils/async-handler');
const service = require('./planning.service');

const summary = asyncHandler(async (req, res) => {
  const data = await service.getSummary(req.user.id);
  res.status(200).json({ data, meta: null, errors: null });
});

const suggestions = asyncHandler(async (req, res) => {
  const data = await service.getSuggestions(req.user.id);
  res.status(200).json({ data, meta: null, errors: null });
});

module.exports = {
  summary,
  suggestions,
};
