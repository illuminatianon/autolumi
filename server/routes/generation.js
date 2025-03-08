import express from 'express';

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
    const { image, config } = req.body;
    const job = req.services.queueManager.addUpscaleJob(image, config);
    res.json(job);
  } catch (error) {
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
