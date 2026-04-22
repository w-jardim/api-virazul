module.exports = function checkAccountStatus(req, res, next) {
  if (!req.user) return next();

  const status = req.account?.status;

  if (status === 'banned') {
    return res.status(403).json({ error: 'Conta banida' });
  }

  if (status === 'suspended') {
    return res.status(403).json({ error: 'Conta suspensa' });
  }

  if (status === 'past_due') {
    req.limitedAccess = true;
  }

  return next();
};
