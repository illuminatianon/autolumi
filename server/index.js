import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import { QueueManager } from './lib/QueueManager.js';
import { Auto1111Client } from './lib/Auto1111Client.js';
import { configRouter } from './routes/config.js';
import { generationRouter } from './routes/generation.js';

const app = express();
const port = process.env.PORT || 3001;

// Initialize services
const auto1111Client = new Auto1111Client({
  baseURL: process.env.AUTO1111_API_URL || 'http://127.0.0.1:7860'
});

const queueManager = new QueueManager(auto1111Client);

// Middleware
app.use(cors());
app.use(morgan('dev'));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Make services available to routes
app.use((req, res, next) => {
  req.services = {
    auto1111: auto1111Client,
    queueManager
  };
  next();
});

// Routes
app.use('/api/config', configRouter);
app.use('/api/generation', generationRouter);

// Error handling
app.use((err, req, res, next) => {
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
