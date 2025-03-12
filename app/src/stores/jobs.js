import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { useWebSocketStore } from './websocket';

export const useJobStore = defineStore('jobs', () => {
  const wsStore = useWebSocketStore();

  // State
  const activeJobs = ref(new Map());
  const serverStatus = ref({
    connected: false,
    processing: false,
    currentJobId: null,
    upscaleQueueLength: 0,
    auto1111Status: null,
  });

  // Computed
  const currentJob = computed(() =>
    serverStatus.value.currentJobId
      ? activeJobs.value.get(serverStatus.value.currentJobId)
      : null,
  );

  const generationJobs = computed(() =>
    Array.from(activeJobs.value.values())
      .filter(job => job.type === 'generation'),
  );

  const upscaleJobs = computed(() =>
    Array.from(activeJobs.value.values())
      .filter(job => job.type === 'upscale'),
  );

  const isProcessing = computed(() => serverStatus.value.processing);

  // Methods
  function updateJob(job) {
    activeJobs.value.set(job.id, job);
  }

  function removeJob(jobId) {
    activeJobs.value.delete(jobId);
  }

  function updateServerStatus(status) {
    serverStatus.value = {
      ...serverStatus.value,
      ...status,
    };

    // Update active jobs from status
    status.jobStatus?.activeJobs?.forEach(job => {
      activeJobs.value.set(job.id, job);
    });
  }

  // WebSocket handlers
  function setupWebSocketHandlers() {
    wsStore.onMessage('jobUpdate', (job) => {
      updateJob(job);
    });

    wsStore.onMessage('jobRemoved', ({ jobId }) => {
      removeJob(jobId);
    });

    wsStore.onMessage('serverStatus', (status) => {
      updateServerStatus(status);
    });
  }

  // Actions
  async function startGeneration(config) {
    const response = await wsStore.sendRequest('startGeneration', config);
    if (response?.id) {
      activeJobs.value.set(config.id, {
        id: response.id,
        configId: config.id,
        status: 'starting',
        config,
      });
    }
    return response;
  }

  async function queueUpscale(imagePath, config) {
    return wsStore.sendRequest('queueUpscale', { imagePath, config });
  }

  async function cancelJob(jobId) {
    await wsStore.sendRequest('cancelJob', { jobId });
    activeJobs.value.delete(jobId);
  }

  async function refreshServerStatus() {
    return wsStore.sendRequest('getServerStatus');
  }

  // Setup handlers when store is created
  setupWebSocketHandlers();

  return {
    // State
    activeJobs,
    serverStatus,

    // Computed
    currentJob,
    generationJobs,
    upscaleJobs,
    isProcessing,

    // Methods
    startGeneration,
    queueUpscale,
    cancelJob,
    refreshServerStatus,
  };
});
