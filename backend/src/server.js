const app = require('./app');
const env = require('./config/env');
const logger = require('./utils/logger');

const server = app.listen(env.port, () => {
  logger.info('app.start', {
    port: env.port,
    environment: env.nodeEnv,
    timezone: env.tz,
  });
});

module.exports = server;
