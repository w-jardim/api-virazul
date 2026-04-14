const adminService = require('./admin.service');

async function getStats(req, res, next) {
  try {
    const stats = await adminService.getStats();
    return res.status(200).json({ data: stats, meta: null, errors: null });
  } catch (error) {
    return next(error);
  }
}

async function listUsers(req, res, next) {
  try {
    const users = await adminService.listUsers();
    return res.status(200).json({ data: users, meta: null, errors: null });
  } catch (error) {
    return next(error);
  }
}

async function createUser(req, res, next) {
  try {
    const user = await adminService.createUser(req.body);
    return res.status(201).json({ data: user, meta: null, errors: null });
  } catch (error) {
    return next(error);
  }
}

async function updateUser(req, res, next) {
  try {
    const user = await adminService.updateUser(Number(req.params.id), req.body);
    return res.status(200).json({ data: user, meta: null, errors: null });
  } catch (error) {
    return next(error);
  }
}

async function deleteUser(req, res, next) {
  try {
    await adminService.deleteUser(Number(req.params.id));
    return res.status(204).json({ data: null, meta: null, errors: null });
  } catch (error) {
    return next(error);
  }
}

async function changeSubscription(req, res, next) {
  try {
    const user = await adminService.changeSubscription(Number(req.params.id), req.body.subscription);
    return res.status(200).json({ data: user, meta: null, errors: null });
  } catch (error) {
    return next(error);
  }
}

async function changePaymentStatus(req, res, next) {
  try {
    const user = await adminService.changePaymentStatus(Number(req.params.id), req.body.payment_status);
    return res.status(200).json({ data: user, meta: null, errors: null });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  getStats,
  listUsers,
  createUser,
  updateUser,
  deleteUser,
  changeSubscription,
  changePaymentStatus,
};
