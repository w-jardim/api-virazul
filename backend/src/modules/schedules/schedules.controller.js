const asyncHandler = require('../../utils/async-handler');
const service = require('./schedules.service');

const create = asyncHandler(async (req, res) => {
  const data = await service.create(req.user, req.body);
  res.status(201).json({ data, meta: null, errors: null });
});

module.exports = {
  create,
};
