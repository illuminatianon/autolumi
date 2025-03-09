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

    async sendRequest(type, data = null) {
      try {
        return await webSocketService.sendRequest(type, data);
      } catch (error) {
        this.error = error.message;
        throw error;
      }
    },
  },
});
