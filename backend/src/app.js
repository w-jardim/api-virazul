const express = require('express');
const routes = require('./routes');
const notFound = require('./middlewares/not-found');
const errorHandler = require('./middlewares/error-handler');

const app = express();

app.disable('x-powered-by');
app.use(express.json());
app.use('/api/v1', routes);
app.use(notFound);
app.use(errorHandler);

module.exports = app;
