const asyncHandler = require('../../utils/async-handler');
const service = require('./schedules.service');

const create = asyncHandler(async (req, res) => {
  const data = await service.create(req.user, req.body);
  res.status(201).json({ data, meta: null, errors: null });
});

// ── schedule template ─────────────────────────────────────────────────────────

const getTemplate = asyncHandler(async (req, res) => {
  const data = await service.getTemplate(req.user.id);
  res.status(200).json({ data, meta: null, errors: null });
});

const saveTemplate = asyncHandler(async (req, res) => {
  const data = await service.saveTemplate(req.user.id, req.body);
  res.status(200).json({ data, meta: null, errors: null });
});

const deleteTemplate = asyncHandler(async (req, res) => {
  const data = await service.deleteTemplate(req.user.id);
  res.status(200).json({ data, meta: null, errors: null });
});

// ── calendar: compute work days from template for a given month ───────────────

const getCalendar = asyncHandler(async (req, res) => {
  const data = await service.getCalendar(req.user.id, req.query.month);
  res.status(200).json({ data, meta: null, errors: null });
});

module.exports = {
  create,
  getTemplate,
  saveTemplate,
  deleteTemplate,
  getCalendar,
};
