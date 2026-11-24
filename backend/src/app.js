const cors = require('cors');
const express = require('express');
const helmet = require('helmet');
const { mentorRouter } = require('./routes/mentor');

function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors({
    origin: process.env.FRONTEND_ORIGIN || 'http://localhost:3000',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Authorization', 'Content-Type'],
  }));
  app.use(express.json({ limit: '100kb' }));

  app.get('/health', (_request, response) => {
    response.json({ status: 'ok' });
  });
  app.use('/api/mentor', mentorRouter);

  app.use((_request, response) => {
    response.status(404).json({ error: 'Route introuvable.' });
  });

  app.use((error, _request, response, _next) => {
    if (response.headersSent) return;
    const status = Number.isInteger(error.status) ? error.status : 500;
    if (status >= 500) console.error(error);
    response.status(status).json({
      error: status >= 500 ? 'Une erreur interne est survenue.' : error.message,
    });
  });

  return app;
}

module.exports = { createApp };
