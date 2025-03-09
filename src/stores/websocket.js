import { defineStore } from 'pinia';
import { ref } from 'vue';
import { webSocketService } from '@/services/websocket';

export const useWebSocketStore = defineStore('websocket', () => {
  const connected = ref(false);
  const queueState = ref(null);

  async function connect() {
    try {
      await webSocketService.connect();
      connected.value = true;
    } catch (error) {
      connected.value = false;
      throw error;
    }
  }

  function handleQueueUpdate(data) {
    queueState.value = data;
  }

  async function sendRequest(type, data = null) {
    return webSocketService.sendRequest(type, data);
  }

  return {
    connected,
    queueState,
    connect,
    sendRequest,
    handleQueueUpdate,
  };
});
