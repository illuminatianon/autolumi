import { defineStore } from 'pinia';
import { useWebSocketStore } from './websocket';

export const useGenerationStore = defineStore('generation', {
  state: () => ({
    activeConfigs: [],
    queueOrder: [],
    jobs: [],
    completedJobs: [],
    isProcessing: false,
    error: null,
  }),

  getters: {
    runningConfigs: (state) => state.activeConfigs.length,
    isConfigActive: (state) => (configId) =>
      state.activeConfigs.some(config => config.id === configId),
  },

  actions: {
    init() {
      const wsStore = useWebSocketStore();
      // Subscribe to queue updates
      wsStore.subscribe('queueUpdate', (data) => {
        this.jobs = data.jobs;
        this.completedJobs = data.completedJobs;
        this.activeConfigs = data.activeConfigs;
        this.queueOrder = data.queueOrder;
        this.isProcessing = data.isProcessing;
      });
    },

    async startConfig(config) {
      const wsStore = useWebSocketStore();
      try {
        const result = await wsStore.sendRequest('startGeneration', config);
        return result;
      } catch (error) {
        console.error('Failed to start config:', error);
        this.error = error.message;
        throw error;
      }
    },

    async stopConfig(configId) {
      const wsStore = useWebSocketStore();
      try {
        await wsStore.sendRequest('stopGeneration', { configId });
      } catch (error) {
        console.error('Failed to stop config:', error);
        this.error = error.message;
        throw error;
      }
    },

    async cancelJob(jobId) {
      const wsStore = useWebSocketStore();
      try {
        await wsStore.sendRequest('cancelJob', { jobId });
      } catch (error) {
        console.error('Failed to cancel job:', error);
        this.error = error.message;
        throw error;
      }
    },
  },
});
