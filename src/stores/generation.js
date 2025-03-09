import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { useWebSocketStore } from './websocket';

export const useGenerationStore = defineStore('generation', () => {
  const wsStore = useWebSocketStore();
  const activeConfigs = ref(new Map());

  const isConfigActive = (configId) => activeConfigs.value.has(configId);

  async function startConfig(config) {
    try {
      await wsStore.sendRequest('startConfig', { config });
      activeConfigs.value.set(config.id, config);
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

  return {
    activeConfigs,
    isConfigActive,
    startConfig,
    stopConfig,
  };
});
