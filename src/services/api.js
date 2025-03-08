import axios from 'axios';

// Create an axios instance with default config
const apiService = axios.create({
  baseURL: 'http://localhost:3001/api',
  timeout: 30000, // 30 second timeout
  headers: {
    'Content-Type': 'application/json'
  }
});

// Generation
async function queueGeneration(config) {
  const response = await apiService.post('/generation/txt2img', config);
  return response.data;
}

async function queueUpscale(imagePath, config) {
  const response = await apiService.post('/generation/upscale', {
    imagePath,
    config
  });
  return response.data;
}

async function getJobStatus(jobId) {
  const response = await apiService.get(`/generation/job/${jobId}`);
  return response.data;
}

async function getQueueStatus() {
  const response = await apiService.get('/generation/queue');
  return response.data;
}

async function cancelJob(jobId) {
  const response = await apiService.delete(`/generation/job/${jobId}`);
  return response.data;
}

// Config/Status
async function getAvailableModels() {
  const response = await apiService.get('/config/models');
  return response.data;
}

async function getAvailableSamplers() {
  const response = await apiService.get('/config/samplers');
  return response.data;
}

async function getAvailableUpscalers() {
  const response = await apiService.get('/config/upscalers');
  return response.data;
}

async function getServerStatus() {
  const response = await apiService.get('/config/health');
  return response.data;
}

async function getDefaultConfig() {
  const response = await apiService.get('/config/defaults');
  return response.data;
}

async function getUpscalers() {
  const response = await apiService.get('/config/upscalers');
  return response.data;
}

async function getLatentUpscaleModes() {
  const response = await apiService.get('/config/latent-upscale-modes');
  return response.data;
}

export {
  apiService,
  queueGeneration,
  queueUpscale,
  getJobStatus,
  getQueueStatus,
  getAvailableModels,
  getAvailableSamplers,
  getAvailableUpscalers,
  getServerStatus,
  getDefaultConfig,
  getUpscalers,
  getLatentUpscaleModes,
  cancelJob
};
