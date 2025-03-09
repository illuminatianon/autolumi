import { apiService } from './api';

class GenerationService {
  async startContinuousGeneration(config) {
    const response = await apiService.post('/generation/start', config);
    return response.data;
  }

  async stopContinuousGeneration(configId) {
    const response = await apiService.post('/generation/stop', { configId });
    return response.data;
  }

  async getQueueStatus() {
    try {
      const response = await apiService.get('/generation/queue');
      return response.data;
    } catch (error) {
      console.error('Error getting queue status:', error);
      return { activeConfigs: [], queueLength: 0 };
    }
  }
}

export const generationService = new GenerationService();
