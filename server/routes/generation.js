import express from 'express';
import path from 'path';

export const generationRouter = express.Router();

// Queue a txt2img generation job
generationRouter.post('/txt2img', async (req, res) => {
  try {
    const job = req.services.queueManager.addGenerationJob(req.body);
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
    if (!imagePath || !config) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    // Convert relative path to absolute path using the correct data directory
    const projectRoot = path.join(process.cwd(), '..');
    const fullImagePath = path.join(projectRoot, 'data', 'output', imagePath);

    // Add to priority queue
    const job = req.services.queueManager.addUpscaleJob(fullImagePath, config);
    res.json(job);
  } catch (error) {
    console.error('Error queueing upscale:', error);
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
