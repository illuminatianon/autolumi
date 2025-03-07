import express from 'express';

export const configRouter = express.Router();

// Health check endpoint
configRouter.get('/health', async (req, res) => {
  try {
    const auto1111Health = await req.services.auto1111.client.get('/');
    res.json({
      status: 'ok',
      auto1111: {
        status: 'connected',
        url: req.services.auto1111.client.defaults.baseURL
      }
    });
  } catch (error) {
    res.json({
      status: 'warning',
      auto1111: {
        status: 'disconnected',
        url: req.services.auto1111.client.defaults.baseURL,
        error: error.message
      }
    });
  }
});

// Get available samplers
configRouter.get('/samplers', async (req, res) => {
  try {
    const samplers = req.services.auto1111.getAvailableSamplers();
    res.json(samplers);
  } catch (error) {
    console.error('Error getting samplers:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get available models
configRouter.get('/models', async (req, res) => {
  try {
    const models = req.services.auto1111.getAvailableModels();
    res.json(models);
  } catch (error) {
    console.error('Error getting models:', error);
    res.status(500).json({ error: error.message });
  }
});

// Set active model
configRouter.post('/models/active', async (req, res) => {
  try {
    const { model_name } = req.body;
    if (!model_name) {
      res.status(400).json({ error: 'model_name is required' });
      return;
    }
    await req.services.auto1111.setModel(model_name);
    res.json({ success: true });
  } catch (error) {
    console.error('Error setting model:', error);
    res.status(500).json({ error: error.message });
  }
});

// Initialize Auto1111 client
configRouter.post('/initialize', async (req, res) => {
  try {
    console.log('Initializing Auto1111 client...');
    const result = await req.services.auto1111.initialize();
    console.log('Auto1111 client initialized successfully');
    res.json(result);
  } catch (error) {
    console.error('Error initializing Auto1111:', error);
    res.status(500).json({
      error: error.message,
      details: {
        url: req.services.auto1111.client.defaults.baseURL,
        message: 'Make sure Stable Diffusion Web UI is running with the --api flag'
      }
    });
  }
});
