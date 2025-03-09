import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { useWebSocketStore } from './websocket';

export const useGenerationStore = defineStore('generation', () => {
  const activeConfigs = ref(new Map());
  const isProcessing = ref(false);
  const wsStore = useWebSocketStore();

  async function startConfig(config) {
    try {
      await wsStore.sendRequest('startConfig', {
        id: config.id,
        config: config,
      });
    } catch (error) {
      console.error('Failed to start config:', error);
      throw error;
    }
  }

  async function stopConfig(configId) {
    try {
      await wsStore.sendRequest('stopConfig', { configId });
      activeConfigs.value.delete(configId);
    } catch (error) {
      console.error('Failed to stop config:', error);
      throw error;
    }
  }

  function handleConfigUpdate(configEntry) {
    activeConfigs.value.set(configEntry.id, {
      ...configEntry,
      config: configEntry.config,
    });
  }

  function isConfigActive(configId) {
    return activeConfigs.value.has(configId);
  }

  // Setup WebSocket subscription using the correct methods
  wsStore.onMessage('configUpdate', handleConfigUpdate);

  return {
    activeConfigs,
    isProcessing,
    startConfig,
    stopConfig,
    handleConfigUpdate,
    isConfigActive,
  };
});
