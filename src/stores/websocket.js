import { defineStore } from 'pinia';
import { webSocketService } from '@/services/websocket';

export const useWebSocketStore = defineStore('websocket', {
  state: () => ({
    connected: false,
    error: null,
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
  },
});
