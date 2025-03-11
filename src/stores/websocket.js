import { defineStore } from 'pinia';
import { webSocketService } from '@/services/websocket';

export const useWebSocketStore = defineStore('websocket', {
  state: () => ({
    connected: false,
    error: null,
    queueStatus: {
      jobs: [],
      configQueueLength: 0,
      priorityQueueLength: 0,
      processing: false,
    },
  }),

  actions: {
    async connect() {
      try {
        await webSocketService.connect();
        this.connected = true;
        this.error = null;
      } catch (error) {
        this.connected = false;
        this.error = error.message;
        throw error;
      }
    },

    async ensureConnection() {
      if (!this.connected) {
        await this.connect();
      }
    },

    async sendRequest(type, data = null) {
      try {
        await this.ensureConnection();
        return await webSocketService.sendRequest(type, data);
      } catch (error) {
        console.error('WebSocket request failed:', error);
        throw error;
      }
    },

    onMessage(type, callback) {
      webSocketService.subscribe(type, callback);
    },

    offMessage(type, callback) {
      webSocketService.unsubscribe(type, callback);
    },

    handleQueueStatus(status) {
      this.queueStatus = status;
    },

    handleConfigUpdate(data) {
      if (data.removed) {
        // If config was removed, update queue status accordingly
        this.queueStatus.jobs = this.queueStatus.jobs.filter(job => job.id !== data.id);
      } else {
        // Update existing job or add new one
        const jobIndex = this.queueStatus.jobs.findIndex(job => job.id === data.id);
        if (jobIndex !== -1) {
          this.queueStatus.jobs[jobIndex] = { ...this.queueStatus.jobs[jobIndex], ...data };
        } else if (data.status === 'processing' || data.status === 'queued') {
          this.queueStatus.jobs.push(data);
        }
      }
    },
  },
});
