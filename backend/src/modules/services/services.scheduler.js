const logger = require('../../utils/logger');
const service = require('./services.service');

const ONE_HOUR_MS = 1 * 60 * 60 * 1000;

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
  }, ONE_HOUR_MS);

  return intervalId;
}

module.exports = {
  startFinancialStatusScheduler,
};
