const asyncHandler = require('../../utils/async-handler');
const service = require('./service-types.service');

const list = asyncHandler(async (req, res) => {
  const data = await service.list();
  res.status(200).json({ data, meta: null, errors: null });
});

const create = asyncHandler(async (req, res) => {
  const data = await service.create(req.user, req.body);
  res.status(201).json({ data, meta: null, errors: null });
});

module.exports = {
  list,
  create,
};
