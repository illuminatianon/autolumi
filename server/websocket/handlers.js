// Handler for getting default configuration
async function handleGetDefaultConfig(ws, requestId) {
  try {
    const DEFAULT_GENERATION_PARAMS = {
      steps: 25,
      sampler_name: 'Euler a',
      cfg_scale: 10,
      width: 512,
      height: 512,
      batch_size: 1,
      prompt: '',
      negative_prompt: '',
      hr_resize_x: 0,
      hr_resize_y: 0,
      hr_denoising_strength: 0.7,
      hr_second_pass_steps: 20,
      hr_upscaler: '',
      upscale_tile_overlap: 64,
      upscale_scale_factor: 2.5,
      upscale_upscaler: '',
      upscale_denoising_strength: 0.15,
    };

    ws.send(JSON.stringify({
      type: 'response',
      requestId,
      data: DEFAULT_GENERATION_PARAMS,
    }));
  } catch (error) {
    ws.send(JSON.stringify({
      type: 'error',
      requestId,
      data: { message: error.message },
    }));
  }
}

// Add this handler for server status
async function handleGetServerStatus(ws, requestId, services) {
  try {
    const health = await services.auto1111.checkHealth();
    ws.send(JSON.stringify({
      type: 'response',
      requestId,
      data: health,
    }));
  } catch (error) {
    ws.send(JSON.stringify({
      type: 'error',
      requestId,
      data: {
        status: 'error',
        message: 'Auto1111 server not available',
      },
    }));
  }
}

// Add to your message handlers
const messageHandlers = {
  // ... other handlers ...
  getDefaultConfig: handleGetDefaultConfig,
  getServerStatus: handleGetServerStatus,
};
