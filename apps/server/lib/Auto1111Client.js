import axios from 'axios';
import logger from './logger.js';

export class Auto1111Client {
  constructor(config) {
    this.client = axios.create({
      baseURL: config.baseURL,
      timeout: 300000, // 5 minutes
    });

    logger.info('Auto1111Client initialized with baseURL: %s', config.baseURL);
  }

  async getSamplers() {
    try {
      const response = await this.client.get('/sdapi/v1/samplers');
      return response.data;
    } catch (error) {
      logger.error('Failed to get samplers: %s', error);
      throw error;
    }
  }

  async getModels() {
    try {
      const response = await this.client.get('/sdapi/v1/sd-models');
      return response.data;
    } catch (error) {
      logger.error('Failed to get models: %s', error);
      throw error;
    }
  }

  async setModel(model_name) {
    try {
      await this.client.post('/sdapi/v1/options', {
        sd_model_checkpoint: model_name,
      });
    } catch (error) {
      throw new Error(`Failed to set model: ${error.message}`);
    }
  }

  async txt2img(params) {
    try {
      // Inject hard-coded parameters
      const enhancedParams = {
        ...params,
        scheduler: 'Automatic',
        enable_hr: true,  // Enable Hires.fix
      };

      logger.info('Sending txt2img request with params: %o', enhancedParams);
      const response = await this.client.post('/sdapi/v1/txt2img', enhancedParams);
      return response.data;
    } catch (error) {
      logger.error('Auto1111 txt2img error: %o', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
      });
      throw new Error(`Failed to generate image: ${error.message}`);
    }
  }

  async img2img(params) {
    try {
      logger.info('Sending img2img request: %o', {
        ...params,
        init_images: params.init_images ? ['<base64 data>'] : undefined,
        script_args: params.script_args,
      });
      const response = await this.client.post('/sdapi/v1/img2img', params);
      return response.data;
    } catch (error) {
      logger.error('Auto1111 img2img error:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
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
    try {
      const response = await this.client.get('/sdapi/v1/upscalers');
      return response.data;
    } catch (error) {
      logger.error('Failed to get upscalers: %s', error);
      throw error;
    }
  }

  async getLatentUpscaleModes() {
    try {
      const response = await this.client.get('/sdapi/v1/latent-upscale-modes');
      return response.data;
    } catch (error) {
      logger.error('Failed to get latent upscale modes: %s', error);
      throw error;
    }
  }

  async checkHealth() {
    try {
      // Get memory information
      const memoryResponse = await this.client.get('/sdapi/v1/memory');

      // Get progress information
      const progressResponse = await this.client.get('/sdapi/v1/progress?skip_current_image=false');

      return {
        status: 'ok',
        memory: memoryResponse.data,
        progress: progressResponse.data,
        version: 'Auto1111'
      };
    } catch (error) {
      logger.error('Health check failed: %s', error.message);
      return {
        status: 'error',
        message: 'Auto1111 server not available',
      };
    }
  }

  async getSchedulers() {
    try {
      const response = await this.client.get('/sdapi/v1/schedulers');
      return response.data;
    } catch (error) {
      logger.error('Failed to get schedulers:', error);
      throw error;
    }
  }
}
