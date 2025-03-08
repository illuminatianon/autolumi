import express from 'express';
import path from 'path';
import fs from 'fs';

export const generationRouter = express.Router();

// Queue a txt2img generation job
generationRouter.post('/txt2img', async (req, res) => {
  try {
    const job = await req.services.queueManager.addJob({
      type: 'txt2img',
      config: req.body
    });
    res.json(job);
  } catch (error) {
    console.error('Error queueing generation:', error);
    res.status(500).json({ error: error.message });
  }
});

// Add upscale job to queue
generationRouter.post('/upscale', async (req, res) => {
  try {
    const { imagePath, config } = req.body;

    console.log('Upscale request received:', {
      imagePath,
      config: {
        ...config,
        // Log specific upscale params
        upscale_tile_overlap: config.upscale_tile_overlap,
        upscale_upscaler: config.upscale_upscaler,
        upscale_scale_factor: config.upscale_scale_factor,
        upscale_denoising_strength: config.upscale_denoising_strength
      }
    });

    // Fix the path to be absolute - go up one level from server to project root
    const fullImagePath = path.join(process.cwd(), '..', 'data', 'output', imagePath);
    console.log('Full image path:', fullImagePath);

    // Validate request
    if (!imagePath) {
      console.error('Missing imagePath in upscale request');
      return res.status(400).json({ error: 'Missing imagePath' });
    }

    // Check if file exists
    if (!fs.existsSync(fullImagePath)) {
      console.error(`Image file not found: ${fullImagePath}`);
      return res.status(404).json({ error: 'Image file not found' });
    }

    const job = await req.services.queueManager.addJob({
      type: 'upscale',
      imagePath: fullImagePath,
      config
    });

    console.log('Queued upscale job:', job);
    res.json({ status: 'queued', job });
  } catch (error) {
    console.error('Error in upscale endpoint:', error);
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
    console.error('Error getting job status:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get queue status
generationRouter.get('/queue', async (req, res) => {
  try {
    const status = req.services.queueManager.getQueueStatus();
    res.json(status);
  } catch (error) {
    console.error('Error getting queue status:', error);
    res.status(500).json({ error: error.message });
  }
});
