// ─────────────────────────────────────────────────────────────
// backend/src/app.js
// Express application setup, middlewares, and routes
// ─────────────────────────────────────────────────────────────

import express from 'express';
import cors from 'cors';
import v1Routes from './routes/v1.js';
import { errorHandler } from './middleware/errorHandler.js';

export const app = express();

// Global Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Mount Version 1 API routes
app.use('/api/v1', v1Routes);

// Catch 404 for undefined routes
app.use((req, res) => {
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: `The requested path ${req.originalUrl} does not exist.`,
    },
  });
});

// Central Error Handler Middleware
app.use(errorHandler);
