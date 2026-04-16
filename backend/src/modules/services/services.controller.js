const asyncHandler = require('../../utils/async-handler');
const service = require('./services.service');

const create = asyncHandler(async (req, res) => {
  const data = await service.create(req.user, req.body);
  res.status(201).json({ data, meta: null, errors: null });
});

const previewFinancial = asyncHandler(async (req, res) => {
  const data = await service.previewFinancial(req.user, req.body);
  res.status(200).json({ data, meta: null, errors: null });
});

const list = asyncHandler(async (req, res) => {
  const data = await service.list(req.user, req.query);
  res.status(200).json({ data, meta: null, errors: null });
});

const getDateRange = asyncHandler(async (req, res) => {
  const data = await service.getDateRange(req.user, req.query);
  res.status(200).json({ data, meta: null, errors: null });
});

const getById = asyncHandler(async (req, res) => {
  const data = await service.getById(req.user, req.params.id);
  res.status(200).json({ data, meta: null, errors: null });
});

const update = asyncHandler(async (req, res) => {
  const data = await service.update(req.user, req.params.id, req.body);
  res.status(200).json({ data, meta: null, errors: null });
});

const transition = asyncHandler(async (req, res) => {
  const data = await service.transition(req.user, req.params.id, req.body);
  res.status(200).json({ data, meta: null, errors: null });
});

const confirmPayment = asyncHandler(async (req, res) => {
  const data = await service.confirmPayment(req.user, req.params.id, req.body);
  res.status(200).json({ data, meta: null, errors: null });
});

const promoteReservation = asyncHandler(async (req, res) => {
  const data = await service.promoteReservation(req.user, req.params.id, req.body);
  res.status(200).json({ data, meta: null, errors: null });
});

const remove = asyncHandler(async (req, res) => {
  await service.remove(req.user, req.params.id);
  res.status(204).send();
});

module.exports = {
  create,
  previewFinancial,
  list,
  getDateRange,
  getById,
  update,
  transition,
  confirmPayment,
  promoteReservation,
  remove,
};
