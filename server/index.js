import express from 'express';
import http from 'http';
import cors from 'cors';
import expressPino from 'express-pino-logger';
import path from 'path';
import env from 'dotenv';
import { fileURLToPath } from 'url';
import { QueueManager } from './lib/QueueManager.js';
import { Auto1111Client } from './lib/Auto1111Client.js';
import { ConfigManager } from './lib/ConfigManager.js';
import { ImageManager } from './lib/ImageManager.js';
import { WebSocketManager } from './lib/WebSocketManager.js';
import { configRouter } from './routes/config.js';
import { generationRouter } from './routes/generation.js';
import logger from './lib/logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const server = http.createServer(app);
const port = env.PORT || 3001;
const webSocketManager = new WebSocketManager();

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
const queueManager = new QueueManager(auto1111Client, imageManager, webSocketManager);

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
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  logger.error(err, 'Unhandled error');
  res.status(err.status || 500).json({
    error: {
      message: err.message || 'Internal Server Error',
      ...(process.env.NODE_ENV === 'development' ? { stack: err.stack } : {}),
    },
  });
});

// Initialize WebSocket handlers
function initializeWebSocketHandlers(webSocketManager, services) {
  // Config related handlers
  webSocketManager.registerHandler('getModels', () =>
    services.auto1111.getModels(),
  );

  webSocketManager.registerHandler('getSamplers', () =>
    services.auto1111.getSamplers(),
  );

  webSocketManager.registerHandler('getUpscalers', () =>
    services.auto1111.getUpscalers(),
  );

  webSocketManager.registerHandler('getLatentUpscaleModes', () =>
    services.auto1111.getLatentUpscaleModes(),
  );

  webSocketManager.registerHandler('setModel', ({ model_name }) =>
    services.auto1111.setModel(model_name),
  );

  webSocketManager.registerHandler('getConfigs', () =>
    services.configManager.getAllConfigs(),
  );

  webSocketManager.registerHandler('addConfig', (config) =>
    services.configManager.addConfig(config),
  );

  webSocketManager.registerHandler('updateConfig', ({ name, config }) =>
    services.configManager.updateConfig({ ...config, name }),
  );

  webSocketManager.registerHandler('deleteConfig', ({ name }) =>
    services.configManager.deleteConfig(name),
  );

  webSocketManager.registerHandler('getDefaultConfig', async () => {
    const { DEFAULT_GENERATION_PARAMS } = await import('./lib/types.js');
    return DEFAULT_GENERATION_PARAMS;
  });

  // Generation related handlers
  webSocketManager.registerHandler('startGeneration', (config) =>
    services.queueManager.addConfig(config),
  );

  webSocketManager.registerHandler('stopGeneration', ({ configId }) =>
    services.queueManager.removeConfig(configId),
  );

  webSocketManager.registerHandler('queueTxt2img', (config) =>
    services.queueManager.addJob({ type: 'txt2img', config }),
  );

  webSocketManager.registerHandler('queueUpscale', ({ imagePath, config }) =>
    services.queueManager.addJob({ type: 'upscale', imagePath, config }),
  );

  webSocketManager.registerHandler('cancelJob', ({ jobId }) =>
    services.queueManager.removeJob(jobId),
  );
}

// Initialize WebSocket after creating the HTTP server
webSocketManager.initialize(server);
initializeWebSocketHandlers(webSocketManager, {
  auto1111: auto1111Client,
  configManager,
  queueManager,
});

// Start server
server.listen(port, () => {
  logger.info(`Server running on port ${port}`);
  queueManager.start();
});
