const asyncHandler = require('../../utils/async-handler');
const service = require('./agenda.service');

const day = asyncHandler(async (req, res) => {
  const data = await service.getDayAgenda(req.user, req.query);
  res.status(200).json({ data, meta: null, errors: null });
});

const week = asyncHandler(async (req, res) => {
  const data = await service.getWeekAgenda(req.user, req.query);
  res.status(200).json({ data, meta: null, errors: null });
});

const month = asyncHandler(async (req, res) => {
  const data = await service.getMonthAgenda(req.user, req.query);
  res.status(200).json({ data, meta: null, errors: null });
});

module.exports = {
  day,
  week,
  month,
};
