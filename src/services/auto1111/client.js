import axios from 'axios';

class Auto1111Client {
  constructor(baseURL = 'http://127.0.0.1:7860') {
    this.client = axios.create({
      baseURL,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  async txt2img(params) {
    const response = await this.client.post('/sdapi/v1/txt2img', params);
    return response.data;
  }

  async img2img(params) {
    const response = await this.client.post('/sdapi/v1/img2img', params);
    return response.data;
  }

  async upscaleSingle(params) {
    const response = await this.client.post('/sdapi/v1/extra-single-image', params);
    return response.data;
  }

  async getModels() {
    const response = await this.client.get('/sdapi/v1/sd-models');
    return response.data;
  }

  async getSamplers() {
    const response = await this.client.get('/sdapi/v1/samplers');
    return response.data;
  }

  async getUpscalers() {
    const response = await this.client.get('/sdapi/v1/upscalers');
    return response.data;
  }

  async getOptions() {
    const response = await this.client.get('/sdapi/v1/options');
    return response.data;
  }
}

export default Auto1111Client;
