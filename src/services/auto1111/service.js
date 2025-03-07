import axios from 'axios';
import { DEFAULT_TXT2IMG_PARAMS, DEFAULT_IMG2IMG_PARAMS, DEFAULT_UPSCALE_PARAMS } from './types';

class Auto1111Service {
  constructor() {
    this.client = axios.create({
      baseURL: 'http://localhost:3001/api',
      timeout: 300000 // 5 minutes
    });
    this.samplers = [];
    this.models = [];
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return;

    try {
      const response = await this.client.post('/config/initialize');
      this.samplers = response.data.samplers;
      this.models = response.data.models;
      this.initialized = true;
      return {
        samplers: this.samplers,
        models: this.models
      };
    } catch (error) {
      console.error('Failed to initialize Auto1111 service:', error);
      throw error;
    }
  }

  async setModel(model_name) {
    await this.initialize();
    await this.client.post('/config/models/active', { model_name });
  }

  async generateImage(params) {
    await this.initialize();
    const mergedParams = {
      ...DEFAULT_TXT2IMG_PARAMS,
      ...params
    };

    const response = await this.client.post('/generation/txt2img', mergedParams);
    return response.data;
  }

  async upscaleWithScript(imageData, config) {
    await this.initialize();
    const response = await this.client.post('/generation/upscale', {
      image: imageData,
      config: {
        ...DEFAULT_IMG2IMG_PARAMS,
        ...config,
        script_name: "SD upscale",
        script_args: [null, 64, "R-ESRGAN 4x+", 2.5]
      }
    });
    return response.data;
  }

  getAvailableSamplers() {
    return this.samplers;
  }

  getAvailableModels() {
    return this.models;
  }

  async getJobStatus(jobId) {
    const response = await this.client.get(`/generation/job/${jobId}`);
    return response.data;
  }

  async getQueueStatus() {
    const response = await this.client.get('/generation/queue');
    return response.data;
  }
}

// Create and export a singleton instance
const auto1111Service = new Auto1111Service();
export default auto1111Service;
