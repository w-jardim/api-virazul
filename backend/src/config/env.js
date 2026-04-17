const path = require('path');
const dotenv = require('dotenv');

function loadEnvFiles() {
  const nodeEnv = process.env.NODE_ENV || 'development';
  dotenv.config({ path: path.resolve(process.cwd(), `.env.${nodeEnv}`) });
  dotenv.config({ path: path.resolve(process.cwd(), '.env') });
}

function toNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toBool(value, fallback = false) {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
}

function asList(value, fallback = []) {
  if (!value || !String(value).trim()) {
    return fallback;
  }
  return String(value)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function validateRequired(requiredKeys) {
  const missing = requiredKeys.filter((key) => {
    const value = process.env[key];
    return value === undefined || value === null || String(value).trim() === '';
  });

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}

loadEnvFiles();

const nodeEnv = process.env.NODE_ENV || process.env.APP_ENV || 'development';
const required = [
  'DB_HOST',
  'DB_PORT',
  'DB_NAME',
  'DB_USER',
  'DB_PASSWORD',
  'JWT_SECRET',
  'JWT_EXPIRES_IN',
  'CORS_ORIGIN',
  'TZ',
  'NODE_ENV',
];

validateRequired(required);

const config = {
  port: toNumber(process.env.PORT, 3000),
  nodeEnv,
  db: {
    host: process.env.DB_HOST,
    port: toNumber(process.env.DB_PORT, 3306),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  },
  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN,
  },
  tz: process.env.TZ,
  cors: {
    origins: asList(process.env.CORS_ORIGIN, []),
  },
  rateLimit: {
    globalWindowMs: toNumber(process.env.RATE_LIMIT_GLOBAL_WINDOW_MS, 15 * 60 * 1000),
    globalMax: toNumber(process.env.RATE_LIMIT_GLOBAL_MAX, 300),
    loginWindowMs: toNumber(process.env.RATE_LIMIT_LOGIN_WINDOW_MS, 15 * 60 * 1000),
    loginMax: toNumber(process.env.RATE_LIMIT_LOGIN_MAX, 10),
  },
  subscription: {
    enforce: toBool(process.env.SUBSCRIPTION_ENFORCE, nodeEnv === 'production'),
    blockedStatuses: asList(process.env.SUBSCRIPTION_BLOCKED_STATUSES, [
      'suspended',
      'cancelled',
      'canceled',
      'inactive',
    ]).map((item) => item.toLowerCase()),
  },
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID || '',
    enabled: Boolean(process.env.GOOGLE_CLIENT_ID),
  },
};

module.exports = config;
module.exports.loadEnvFiles = loadEnvFiles;
module.exports.validateRequired = validateRequired;
