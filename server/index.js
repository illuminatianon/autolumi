import express from 'express';
import cors from 'cors';
import expressPino from 'express-pino-logger';
import path from 'path';
import env from 'dotenv';
import { fileURLToPath } from 'url';
import { QueueManager } from './lib/QueueManager.js';
import { Auto1111Client } from './lib/Auto1111Client.js';
import { ConfigManager } from './lib/ConfigManager.js';
import { ImageManager } from './lib/ImageManager.js';
import { configRouter } from './routes/config.js';
import { generationRouter } from './routes/generation.js';
import logger from './lib/logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const port = env.PORT || 3001;

// Initialize Pino logger middleware
const expressLogger = expressPino({
  logger,
  // Customize request logging
  autoLogging: {
    ignore: (req) => {
      // Don't log these endpoints
      return (
        // Queue status polling
        (req.method === 'GET' && req.url === '/api/generation/queue') ||
        // Health check endpoint
        (req.method === 'GET' && req.url === '/api/config/health')
      );
    },
  },
  // Don't log request/response body
  serializers: {
    req: (req) => ({
      method: req.method,
      url: req.url,
      remoteAddress: req.remoteAddress,
    }),
    res: (res) => ({
      statusCode: res.statusCode,
    }),
  },
});

// Initialize services
const auto1111Client = new Auto1111Client({
  baseURL: env.AUTO1111_API_URL || 'http://127.0.0.1:7860',
});

const dataDir = path.join(__dirname, '..', 'data');
const configManager = new ConfigManager(dataDir);
const imageManager = new ImageManager(path.join(dataDir, 'output'));
const queueManager = new QueueManager(auto1111Client, imageManager);

// Initialize managers
await Promise.all([
  configManager.initialize(),
  imageManager.initialize(),
]);

// Middleware
app.use(cors());
app.use(expressLogger); // Replace morgan with Pino
app.use(express.json());

// Serve output directory
app.use('/output', express.static(path.join(dataDir, 'output')));

// Add services to request
app.use((req, res, next) => {
  req.services = {
    auto1111: auto1111Client,
    queueManager,
    configManager,
    imageManager,
  };
  next();
});

// Routes
app.use('/api/config', configRouter);
app.use('/api/generation', generationRouter);

// Error handling
app.use((err, req, res) => {
  logger.error(err, 'Unhandled error');
  res.status(err.status || 500).json({
    error: {
      message: err.message || 'Internal Server Error',
      ...(process.env.NODE_ENV === 'development' ? { stack: err.stack } : {}),
    },
  });
});

// Start server
app.listen(port, () => {
  logger.info(`Server running on port ${port}`);
  queueManager.start();
});
