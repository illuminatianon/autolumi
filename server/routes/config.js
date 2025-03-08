import express from 'express';

export const configRouter = express.Router();

// Health check endpoint
configRouter.get('/health', async (req, res) => {
  try {
    // Use the auto1111 client to check connection
    await req.services.auto1111.initialize();
    res.json({ status: 'ok' });
  } catch (error) {
    console.error('Health check failed:', error);
    res.status(503).json({
      status: 'error',
      message: error.message
    });
  }
});

// Get available samplers
configRouter.get('/samplers', async (req, res) => {
  try {
    const samplers = await req.services.auto1111.getAvailableSamplers();
    res.json(samplers);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get available models
configRouter.get('/models', async (req, res) => {
  try {
    const models = await req.services.auto1111.getAvailableModels();
    res.json(models);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get available upscalers
configRouter.get('/upscalers', async (req, res) => {
  try {
    const upscalers = await req.services.auto1111.getUpscalers();
    res.json(upscalers);
  } catch (error) {
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
    const result = await req.services.auto1111.initialize();
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

// Generation Configs CRUD endpoints
configRouter.get('/generation', async (req, res) => {
  try {
    const configs = await req.services.configManager.getAllConfigs();
    res.json(configs);
  } catch (error) {
    console.error('Error getting configs:', error);
    res.status(500).json({ error: error.message });
  }
});

configRouter.post('/generation', async (req, res) => {
  try {
    const config = await req.services.configManager.addConfig(req.body);
    res.json(config);
  } catch (error) {
    console.error('Error adding config:', error);
    res.status(error.message.includes('already exists') ? 409 : 500)
      .json({ error: error.message });
  }
});

configRouter.put('/generation/:name', async (req, res) => {
  try {
    const config = await req.services.configManager.updateConfig({
      ...req.body,
      name: req.params.name
    });
    res.json(config);
  } catch (error) {
    console.error('Error updating config:', error);
    res.status(error.message.includes('not found') ? 404 : 500)
      .json({ error: error.message });
  }
});

configRouter.delete('/generation/:name', async (req, res) => {
  try {
    await req.services.configManager.deleteConfig(req.params.name);
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting config:', error);
    res.status(error.message.includes('not found') ? 404 : 500)
      .json({ error: error.message });
  }
});

configRouter.get('/defaults', async (req, res) => {
  try {
    // Import from our backend types
    const { DEFAULT_GENERATION_PARAMS } = await import('../lib/types.js');
    res.json(DEFAULT_GENERATION_PARAMS);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
