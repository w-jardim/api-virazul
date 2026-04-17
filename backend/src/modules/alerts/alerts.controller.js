const asyncHandler = require('../../utils/async-handler');
const service = require('./alerts.service');

const list = asyncHandler(async (req, res) => {
  const data = await service.list(req.user.id, {
    type: req.query.type,
    status: req.query.status,
  });

  res.status(200).json({ data, meta: null, errors: null });
});

const read = asyncHandler(async (req, res) => {
  const data = await service.markRead(req.user.id, req.params.id);
  res.status(200).json({ data, meta: null, errors: null });
});

const dismiss = asyncHandler(async (req, res) => {
  const data = await service.dismiss(req.user.id, req.params.id);
  res.status(200).json({ data, meta: null, errors: null });
});

module.exports = {
  list,
  read,
  dismiss,
};
