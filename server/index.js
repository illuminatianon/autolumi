import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { QueueManager } from './lib/QueueManager.js';
import { Auto1111Client } from './lib/Auto1111Client.js';
import { ConfigManager } from './lib/ConfigManager.js';
import { ImageManager } from './lib/ImageManager.js';
import { configRouter } from './routes/config.js';
import { generationRouter } from './routes/generation.js';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const port = process.env.PORT || 3001;

// Initialize services
const auto1111Client = new Auto1111Client({
  baseURL: process.env.AUTO1111_API_URL || 'http://127.0.0.1:7860'
});

const dataDir = path.join(__dirname, '..', 'data');
const configManager = new ConfigManager(dataDir);
const imageManager = new ImageManager(path.join(dataDir, 'output'));
const queueManager = new QueueManager(auto1111Client, imageManager);

// Initialize managers
await Promise.all([
  configManager.initialize(),
  imageManager.initialize()
]);

// Middleware
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());

// Serve output directory
app.use('/output', express.static(path.join(dataDir, 'output')));

// Add services to request
app.use((req, res, next) => {
  req.services = {
    auto1111: auto1111Client,
    queueManager,
    configManager,
    imageManager
  };
  next();
});

// Routes
app.use('/api/config', configRouter);
app.use('/api/generation', generationRouter);

// Error handling
app.use((err, req, res) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    error: {
      message: err.message || 'Internal Server Error',
      ...(process.env.NODE_ENV === 'development' ? { stack: err.stack } : {})
    }
  });
});

// Start server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
  queueManager.start();
});
