<script setup>
import { computed, onMounted, onUnmounted } from 'vue';
import { generationService } from '@/services/generation';
import { wsState, webSocketService } from '@/services/websocket';

const props = defineProps({
  modelValue: {
    type: Boolean,
    required: true,
  },
});

const emit = defineEmits(['update:modelValue', 'jobs-completed']);

const showQueue = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
});

const close = () => {
  showQueue.value = false;
};

const queueState = computed(() => wsState.value.queueStatus);

const sortedJobs = computed(() => {
  const jobs = queueState.value?.jobs || [];
  // Sort jobs: processing first, then pending
  return jobs.sort((a, b) => {
    if (a.status === 'processing') return -1;
    if (b.status === 'processing') return 1;
    if (a.status === 'pending' && b.status !== 'pending') return -1;
    if (b.status === 'pending' && a.status !== 'pending') return 1;
    return 0;
  });
});

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
  }
};

onMounted(() => {
  webSocketService.connect();
});

onUnmounted(() => {
  // WebSocket service will handle reconnection automatically
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
            <v-progress-circular
              v-else
              :rotate="-90"
              :size="24"
              :width="2"
              :model-value="getQueueProgress(job)"
              color="primary"
              class="mr-2"
            >
              {{ getQueuePosition(job) }}
            </v-progress-circular>
          </template>

          <v-list-item-title>{{ job.config.name }}</v-list-item-title>
          <v-list-item-subtitle>{{ getJobStatus(job) }}</v-list-item-subtitle>

          <template #append>
            <v-btn
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
