const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const env = require('./config/env');
const routes = require('./routes');
const notFound = require('./middlewares/not-found');
const errorHandler = require('./middlewares/error-handler');
const AppError = require('./utils/app-error');
const requestId = require('./middlewares/request-id');
const requestLogger = require('./middlewares/request-logger');
const { globalApiLimiter } = require('./middlewares/rate-limiters');

const app = express();

function corsOrigin(origin, callback) {
  const whitelist = env.cors.origins;
  if (!origin) {
    return callback(null, true);
  }

  if (whitelist.includes('*') || whitelist.includes(origin)) {
    return callback(null, true);
  }

  return callback(
    new AppError('CORS_ORIGIN_NOT_ALLOWED', 'Origem nao permitida por CORS.', 403)
  );
}

app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(requestId);
app.use(requestLogger);
app.use(helmet());
app.use(
  cors({
    origin: corsOrigin,
    credentials: true,
  })
);
app.use(compression());
app.use(express.json({ limit: '1mb' }));
app.use('/api/v1', globalApiLimiter);
app.use('/api/v1', routes);
app.use(notFound);
app.use(errorHandler);

module.exports = app;
