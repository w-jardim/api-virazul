const logger = require('../../utils/logger');
const service = require('./services.service');

const SIX_HOURS_MS = 6 * 60 * 60 * 1000;

function runSyncCycle() {
  return service
    .syncFinancialStatusByCalendar(new Date())
    .then((result) => {
      logger.info('services.financial_status_sync.ok', result);
      return result;
    })
    .catch((error) => {
      logger.error('services.financial_status_sync.error', {
        message: error.message,
      });
    });
}

function startFinancialStatusScheduler() {
  void runSyncCycle();
  const intervalId = setInterval(() => {
    void runSyncCycle();
  }, SIX_HOURS_MS);

  return intervalId;
}

module.exports = {
  startFinancialStatusScheduler,
};
