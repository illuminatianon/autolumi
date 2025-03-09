import express from 'express';
import path from 'path';
import fs from 'fs';
import process from 'process';
import logger from '../lib/logger.js';

export const generationRouter = express.Router();

// Queue a txt2img generation job
generationRouter.post('/txt2img', async (req, res) => {
  try {
    const job = await req.services.queueManager.addJob({
      type: 'txt2img',
      config: req.body,
    });
    res.json(job);
  } catch (error) {
    logger.error('Error queueing generation:', error);
    res.status(500).json({ error: error.message });
  }
});

// Add upscale job to queue
generationRouter.post('/upscale', async (req, res) => {
  try {
    const { imagePath, config } = req.body;

    // Fix the path to be absolute
    const fullImagePath = path.join(process.cwd(), imagePath);

    // Validate request
    if (!imagePath) {
      logger.error('Missing imagePath in upscale request');
      return res.status(400).json({ error: 'Missing imagePath' });
    }

    // Check if file exists
    if (!fs.existsSync(fullImagePath)) {
      logger.error(`Image file not found: ${fullImagePath}`);
      return res.status(404).json({ error: 'Image file not found' });
    }

    const job = await req.services.queueManager.addJob({
      type: 'upscale',
      imagePath: fullImagePath,
      config,
    });

    logger.info('Queued upscale job:', job);
    res.json({ status: 'queued', job });
  } catch (error) {
    logger.error('Error in upscale endpoint:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get job status
generationRouter.get('/job/:jobId', async (req, res) => {
  try {
    const job = req.services.queueManager.getJobStatus(req.params.jobId);
    if (!job) {
      res.status(404).json({ error: 'Job not found' });
      return;
    }
    res.json(job);
  } catch (error) {
    logger.error('Error getting job status:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get queue status
generationRouter.get('/queue', async (req, res) => {
  try {
    const status = req.services.queueManager.getQueueStatus();
    res.json(status);
  } catch (error) {
    logger.error('Error getting queue status:', error);
    res.status(500).json({ error: error.message });
  }
});

// Cancel a job
generationRouter.delete('/job/:jobId', async (req, res) => {
  try {
    await req.services.queueManager.removeJob(req.params.jobId);
    res.status(204).send();
  } catch (error) {
    logger.error('Error canceling job:', error);
    res.status(error.message.includes('not found') ? 404 : 500)
      .json({ error: error.message });
  }
});
