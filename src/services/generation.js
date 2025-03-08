import axios from 'axios';

class GenerationService {
  constructor() {
    this.client = axios.create({
      baseURL: 'http://localhost:3001/api/generation'
    });
  }

  async queueGeneration(config) {
    try {
      const response = await this.client.post('/txt2img', {
        ...config,
        enable_hr: true // Always enable hiresfix
      });
      return response.data;
    } catch (error) {
      console.error('Error queueing generation:', error);
      throw error;
    }
  }

  async getJobStatus(jobId) {
    try {
      const response = await this.client.get(`/job/${jobId}`);
      return response.data;
    } catch (error) {
      console.error('Error getting job status:', error);
      throw error;
    }
  }

  async getQueueStatus() {
    try {
      const response = await this.client.get('/queue');
      return response.data;
    } catch (error) {
      console.error('Error getting queue status:', error);
      throw error;
    }
  }
}

export default new GenerationService();
