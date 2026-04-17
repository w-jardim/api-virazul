const env = require('../config/env');

function serializeError(error) {
  if (!error) {
    return null;
  }

  return {
    name: error.name,
    message: error.message,
    code: error.code,
    stack: env.nodeEnv === 'production' ? undefined : error.stack,
  };
}

function write(level, message, context = {}) {
  const payload = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...context,
  };

  const line = JSON.stringify(payload);
  if (level === 'error') {
    console.error(line);
  } else {
    console.log(line);
  }
}

function info(message, context) {
  write('info', message, context);
}

function warn(message, context) {
  write('warn', message, context);
}

function error(message, context = {}) {
  write('error', message, {
    ...context,
    error: serializeError(context.error),
  });
}

module.exports = {
  info,
  warn,
  error,
};
