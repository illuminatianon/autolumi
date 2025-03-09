<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { generationService } from '@/services/generation';

const props = defineProps({
  modelValue: {
    type: Boolean,
    required: true,
  },
});

const emit = defineEmits(['update:modelValue']);

const showQueue = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
});

const close = () => {
  showQueue.value = false;
};

const queueState = ref({
  jobs: [],
  completedJobs: [],
});

const sortedJobs = computed(() => queueState.value?.jobs || []);

const getQueuePosition = (job) => {
  if (job.status !== 'pending') return '';
  const pending = queueState.value?.jobs?.filter(j => j.status === 'pending') || [];
  return pending.findIndex(j => j.id === job.id) + 1;
};

const getQueueProgress = (job) => {
  if (job.status !== 'pending') return 0;
  const position = getQueuePosition(job);
  const total = queueState.value?.jobs?.filter(j => j.status === 'pending')?.length || 0;
  return total > 0 ? ((total - position + 1) / total) * 100 : 0;
};

const getJobStatus = (job) => {
  switch (job.status) {
    case 'pending':
      return `Queued (#${getQueuePosition(job)})`;
    case 'processing':
      return 'Generating...';
    case 'completed':
      return 'Completed';
    case 'failed':
      return `Failed: ${job.error}`;
    default:
      return job.status;
  }
};

const cancelJob = async (job) => {
  try {
    await generationService.cancelJob(job.id);
    // The next queue status poll will update the UI
  } catch (error) {
    console.error('Error canceling job:', error);
    // TODO: Show error notification
  }
};

const pollQueueStatus = async () => {
  try {
    const status = await generationService.getQueueStatus();
    if (!status) {
      console.warn('Received empty queue status');
      return;
    }

    // Check if the response is HTML (incorrect response)
    if (typeof status === 'string' && status.includes('<!DOCTYPE html>')) {
      console.error('Received HTML instead of JSON from queue status endpoint');
      return;
    }

    queueState.value = status;

    // Emit completed jobs for parent component
    const newCompleted = (status.jobs || []).filter(job =>
      job.status === 'completed' &&
      !queueState.value.completedJobs.some(existing => existing.id === job.id),
    );

    if (newCompleted.length > 0) {
      emit('jobs-completed', newCompleted);
    }
  } catch (error) {
    console.error('Error polling queue status:', error);
  }
};

let pollInterval;

onMounted(() => {
  pollQueueStatus();
  pollInterval = setInterval(pollQueueStatus, 5000);
});

onUnmounted(() => {
  if (pollInterval) {
    clearInterval(pollInterval);
  }
});
</script>

<template>
  <v-navigation-drawer
    v-model="showQueue"
    temporary
    location="right"
    width="400"
  >
    <v-toolbar color="primary">
      <v-toolbar-title class="text-white">Generation Queue</v-toolbar-title>
      <v-spacer />
      <v-btn
        icon="mdi-close"
        variant="text"
        color="white"
        @click="close"
      />
    </v-toolbar>

    <v-list>
      <template
        v-for="job in sortedJobs"
        :key="job.id"
      >
        <v-list-item>
          <template #prepend>
            <v-progress-circular
              v-if="job.status === 'processing'"
              indeterminate
              size="24"
              color="primary"
              class="mr-2"
            />
            <v-icon
              v-else-if="job.status === 'completed'"
              color="success"
              class="mr-2"
            >
              mdi-check-circle
            </v-icon>
            <v-icon
              v-else-if="job.status === 'failed'"
              color="error"
              class="mr-2"
            >
              mdi-alert-circle
            </v-icon>
          </template>

          <v-list-item-title>{{ job.config.name }}</v-list-item-title>
          <v-list-item-subtitle>{{ getJobStatus(job) }}</v-list-item-subtitle>

          <template #append>
            <v-progress-linear
              v-if="job.status === 'pending'"
              :model-value="getQueueProgress(job)"
              color="primary"
              height="4"
              class="mt-2"
            />
            <v-btn
              v-if="job.status !== 'completed'"
              icon="mdi-close"
              variant="text"
              size="small"
              color="error"
              @click="cancelJob(job)"
            />
          </template>
        </v-list-item>
      </template>

      <v-list-item v-if="sortedJobs.length === 0">
        <v-list-item-title class="text-center text-medium-emphasis">
          No jobs in queue
        </v-list-item-title>
      </v-list-item>
    </v-list>
  </v-navigation-drawer>
</template>
