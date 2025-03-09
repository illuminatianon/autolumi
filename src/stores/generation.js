import { defineStore } from 'pinia';
import { ref, computed, onUnmounted } from 'vue';
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
      // Add to activeConfigs immediately for better UX
      activeConfigs.value.set(config.id, {
        id: config.id,
        config: config,
        completedRuns: 0,
        failedRuns: 0,
        status: 'starting',
      });
    } catch (error) {
      console.error('Failed to start config:', error);
      throw error;
    }
  }

  async function stopConfig(configId) {
    try {
      await wsStore.sendRequest('stopConfig', { configId });
      // Don't remove immediately - wait for server confirmation via configUpdate
    } catch (error) {
      console.error('Failed to stop config:', error);
      throw error;
    }
  }

  function handleConfigUpdate(configEntry) {
    if (!configEntry?.id) return;

    // Ensure we have a valid config object
    if (!configEntry.config) {
      console.warn('Received config update without config object:', configEntry);
      return;
    }

    if (configEntry.status === 'stopped') {
      activeConfigs.value.delete(configEntry.id);
    } else {
      activeConfigs.value.set(configEntry.id, {
        id: configEntry.id,
        config: configEntry.config,
        status: configEntry.status || 'unknown',
        completedRuns: configEntry.completedRuns || 0,
        failedRuns: configEntry.failedRuns || 0,
      });
    }

    isProcessing.value = activeConfigs.value.size > 0;
  }

  function isConfigActive(configId) {
    return activeConfigs.value.has(configId);
  }

  const runningConfigs = computed(() => {
    const configs = Array.from(activeConfigs.value.values());
    return configs.filter(config => config.status !== 'stopped');
  });

  // Setup WebSocket message handling
  wsStore.onMessage('configUpdate', handleConfigUpdate);

  // Cleanup on store destruction
  onUnmounted(() => {
    wsStore.offMessage('configUpdate', handleConfigUpdate);
  });

  return {
    activeConfigs,
    isProcessing,
    runningConfigs,
    startConfig,
    stopConfig,
    handleConfigUpdate,
    isConfigActive,
  };
});
