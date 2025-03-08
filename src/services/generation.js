import { cancelJob, getQueueStatus, queueGeneration, queueUpscale } from './api';

class GenerationService {
  async queueGeneration(config) {
    return await queueGeneration(config);
  }

  async getQueueStatus() {
    try {
      const response = await getQueueStatus();

      // Validate that we got a proper JSON response
      if (typeof response === 'string' && response.includes('<!DOCTYPE html>')) {
        console.error('Received HTML instead of JSON from queue status endpoint');
        return { jobs: [], completedJobs: [] }; // Return empty state
      }

      return response;
    } catch (error) {
      console.error('Error getting queue status:', error);
      // Return a default state instead of throwing
      return { jobs: [], completedJobs: [] };
    }
  }

  async queueUpscale(imagePath, config) {
    return await queueUpscale(imagePath, config);
  }

  async cancelJob(jobId) {
    try {
      await cancelJob(jobId);
    } catch (error) {
      console.error('Error canceling job:', error);
      throw error;
    }
  }
}

export default new GenerationService();
