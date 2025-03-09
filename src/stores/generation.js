import { defineStore } from 'pinia';
import { generationService } from '@/services/generation';
import logger from '@/lib/logger';

export const useGenerationStore = defineStore('generation', {
  state: () => ({
    activeConfigs: [],
    queueOrder: [],
    isProcessing: false,
    pollingInterval: null,
    error: null,
  }),

  getters: {
    runningConfigs: (state) => state.activeConfigs.length,
    isConfigActive: (state) => (configId) => 
      state.activeConfigs.some(config => config.id === configId),
  },

  actions: {
    async startPolling() {
      if (this.pollingInterval) return;
      
      this.pollingInterval = setInterval(async () => {
        await this.updateQueueStatus();
      }, 1000);
    },

    stopPolling() {
      if (this.pollingInterval) {
        clearInterval(this.pollingInterval);
        this.pollingInterval = null;
      }
    },

    async updateQueueStatus() {
      try {
        const status = await generationService.getQueueStatus();
        this.activeConfigs = status.activeConfigs;
        this.queueOrder = status.queueOrder;
        this.isProcessing = status.currentlyProcessing;
      } catch (error) {
        logger.error('Failed to update queue status:', error);
        this.error = error.message;
      }
    },

    async startConfig(config) {
      try {
        const result = await generationService.startContinuousGeneration(config);
        await this.updateQueueStatus();
        return result;
      } catch (error) {
        logger.error('Failed to start config:', error);
        this.error = error.message;
        throw error;
      }
    },

    async stopConfig(configId) {
      try {
        await generationService.stopContinuousGeneration(configId);
        await this.updateQueueStatus();
      } catch (error) {
        logger.error('Failed to stop config:', error);
        this.error = error.message;
        throw error;
      }
    },
  },
});