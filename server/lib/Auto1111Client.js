import axios from 'axios';

export class Auto1111Client {
  constructor(config) {
    this.client = axios.create({
      baseURL: config.baseURL,
      timeout: 300000, // 5 minutes
    });
    this.samplers = [];
    this.models = [];
    console.log('Auto1111Client initialized with baseURL:', config.baseURL);
  }

  async initialize() {
    try {
      console.log('Attempting to connect to Auto1111 API...');
      const [samplers, models] = await Promise.all([
        this.client.get('/sdapi/v1/samplers'),
        this.client.get('/sdapi/v1/sd-models')
      ]);

      this.samplers = samplers.data;
      this.models = models.data;

      console.log('Successfully connected to Auto1111 API');
      console.log('Found samplers:', this.samplers);
      console.log('Found models:', this.models);

      return {
        samplers: this.samplers,
        models: this.models
      };
    } catch (error) {
      console.error('Auto1111 connection error:', {
        message: error.message,
        code: error.code,
        response: error.response ? {
          status: error.response.status,
          data: error.response.data
        } : 'No response',
        config: {
          url: error.config?.url,
          baseURL: error.config?.baseURL,
          method: error.config?.method
        }
      });
      throw new Error(`Failed to initialize Auto1111 client: ${error.message}`);
    }
  }

  async setModel(model_name) {
    try {
      await this.client.post('/sdapi/v1/options', {
        sd_model_checkpoint: model_name
      });
    } catch (error) {
      throw new Error(`Failed to set model: ${error.message}`);
    }
  }

  async txt2img(params) {
    try {
      const response = await this.client.post('/sdapi/v1/txt2img', params);
      return response.data;
    } catch (error) {
      throw new Error(`Failed to generate image: ${error.message}`);
    }
  }

  async img2img(params) {
    try {
      console.log('Sending img2img request with params:', {
        ...params,
        init_images: params.init_images ? [`${params.init_images[0].slice(0, 50)}...`] : undefined // Truncate base64 for logging
      });

      const response = await this.client.post('/sdapi/v1/img2img', params);
      return response.data;
    } catch (error) {
      console.error('Auto1111 img2img error:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        config: {
          url: error.config?.url,
          params: error.config?.data ? JSON.parse(error.config.data) : undefined
        }
      });
      throw new Error(`Failed to upscale image: ${error.message}`);
    }
  }

  async upscale(params) {
    try {
      const response = await this.client.post('/sdapi/v1/extra-single-image', params);
      return response.data;
    } catch (error) {
      throw new Error(`Failed to upscale image: ${error.message}`);
    }
  }

  async getUpscalers() {
    const response = await this.client.get('/sdapi/v1/upscalers');
    return response.data;
  }

  getAvailableSamplers() {
    return this.samplers;
  }

  getAvailableModels() {
    return this.models;
  }
}
