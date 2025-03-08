import axios from 'axios';

class ApiService {
  constructor() {
    this.client = axios.create({
      baseURL: 'http://localhost:3001/api'
    });
  }

  // Generation
  async queueGeneration(config) {
    const response = await this.client.post('/generation/txt2img', config);
    return response.data;
  }

  async queueUpscale(imagePath, config) {
    const response = await this.client.post('/generation/upscale', {
      imagePath,
      config
    });
    return response.data;
  }

  async getJobStatus(jobId) {
    const response = await this.client.get(`/generation/job/${jobId}`);
    return response.data;
  }

  async getQueueStatus() {
    const response = await this.client.get('/generation/queue');
    return response.data;
  }

  // Config/Status
  async getAvailableModels() {
    const response = await this.client.get('/config/models');
    return response.data;
  }

  async getAvailableSamplers() {
    const response = await this.client.get('/config/samplers');
    return response.data;
  }

  async getAvailableUpscalers() {
    const response = await this.client.get('/config/upscalers');
    return response.data;
  }

  async getServerStatus() {
    const response = await this.client.get('/config/health');
    return response.data;
  }

  async getDefaultConfig() {
    const response = await this.client.get('/config/defaults');
    return response.data;
  }
}

export default new ApiService();
