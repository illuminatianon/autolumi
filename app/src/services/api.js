import { webSocketService } from './websocket';

// Generation
async function queueGeneration(config) {
  return webSocketService.queueTxt2img(config);
}

async function queueUpscale(imagePath, config) {
  return webSocketService.queueUpscale(imagePath, config);
}

async function cancelJob(jobId) {
  return webSocketService.cancelJob(jobId);
}

// Config/Status
async function getAvailableModels() {
  return webSocketService.getModels();
}

async function getAvailableSamplers() {
  return webSocketService.getSamplers();
}

async function getUpscalers() {
  return webSocketService.getUpscalers();
}

async function getLatentUpscaleModes() {
  return webSocketService.getLatentUpscaleModes();
}

export {
  queueGeneration,
  queueUpscale,
  getAvailableModels,
  getAvailableSamplers,
  getUpscalers,
  getLatentUpscaleModes,
  cancelJob,
};
