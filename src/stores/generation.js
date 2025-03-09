import { defineStore } from 'pinia';
import { ref, computed, onUnmounted } from 'vue';
import { useWebSocketStore } from './websocket';

export const useGenerationStore = defineStore('generation', () => {
  const wsStore = useWebSocketStore();
  const activeConfigs = ref(new Map());

  const isConfigActive = (configId) => activeConfigs.value.has(configId);

  const runningConfigs = computed(() => {
    return Array.from(activeConfigs.value.values());
  });

  async function startConfig(config) {
    try {
      const response = await wsStore.sendRequest('startConfig', { config });
      activeConfigs.value.set(config.id, {
        ...config,
        completedRuns: 0,
        failedRuns: 0,
        status: 'active',
      });
      return response;
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

  // Handle WebSocket updates
  const handleConfigUpdate = (data) => {
    const { configId, status, completedRuns, failedRuns } = data;
    if (activeConfigs.value.has(configId)) {
      const config = activeConfigs.value.get(configId);
      activeConfigs.value.set(configId, {
        ...config,
        status,
        completedRuns,
        failedRuns,
      });
    }
  };

  // Subscribe to updates
  wsStore.onMessage('configUpdate', handleConfigUpdate);

  // Cleanup subscription on store destruction
  onUnmounted(() => {
    wsStore.offMessage('configUpdate', handleConfigUpdate);
  });

  return {
    activeConfigs,
    runningConfigs,
    isConfigActive,
    startConfig,
    stopConfig,
  };
});
