import axios from 'axios';
import { DEFAULT_TXT2IMG_PARAMS, DEFAULT_IMG2IMG_PARAMS, DEFAULT_UPSCALE_PARAMS } from './types';

class Auto1111Service {
  constructor() {
    this.client = axios.create({
      baseURL: 'http://127.0.0.1:7860'
    });
    this.upscalers = [];
    this.samplers = [];
    this.models = [];
  }

  async initialize() {
    try {
      const [upscalersRes, samplersRes, modelsRes] = await Promise.all([
        this.client.get('/sdapi/v1/upscalers'),
        this.client.get('/sdapi/v1/samplers'),
        this.client.get('/sdapi/v1/sd-models')
      ]);

      this.upscalers = upscalersRes.data.map(u => u.name);
      this.samplers = samplersRes.data.map(s => s.name);
      this.models = modelsRes.data.map(m => ({
        title: m.model_name,
        model_name: m.model_name
      }));

      return {
        upscalers: this.upscalers,
        samplers: this.samplers,
        models: this.models
      };
    } catch (error) {
      console.error('Failed to initialize Auto1111 service:', error);
      throw error;
    }
  }

  getUpscalers() {
    return this.upscalers;
  }

  getSamplers() {
    return this.samplers;
  }

  getModels() {
    return this.models;
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
