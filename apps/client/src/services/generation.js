import { webSocketService } from './websocket';

class GenerationService {
  async startContinuousGeneration(config) {
    return webSocketService.startGeneration(config);
  }

  async stopContinuousGeneration(configId) {
    return webSocketService.stopGeneration(configId);
  }

  async getQueueStatus() {
    // Since queue status is now handled via WebSocket state,
    // we can return the current state directly
    return webSocketService.wsState.value.queueStatus;
  }

  async cancelJob(jobId) {
    return webSocketService.cancelJob(jobId);
  }
}

export const generationService = new GenerationService();
