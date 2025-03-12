<script setup>
import { computed } from 'vue';

const props = defineProps({
  job: {
    type: Object,
    required: true
  }
});

const emit = defineEmits(['cancel']);

const statusColor = computed(() => {
  switch (props.job.status) {
    case 'processing': return 'info';
    case 'completed': return 'success';
    case 'failed': return 'error';
    default: return 'grey';
  }
});

const statusIcon = computed(() => {
  switch (props.job.status) {
    case 'processing': return 'mdi-cog-sync';
    case 'completed': return 'mdi-check-circle';
    case 'failed': return 'mdi-alert-circle';
    default: return 'mdi-clock-outline';
  }
});

const elapsedTime = computed(() => {
  if (!props.job.startedAt) return '0s';
  const end = props.job.completedAt || Date.now();
  const elapsed = Math.floor((end - props.job.startedAt) / 1000);
  return `${elapsed}s`;
});
</script>

<template>
  <v-card class="mb-4">
    <v-card-title class="d-flex align-center">
      <v-icon
        :color="statusColor"
        :icon="statusIcon"
        class="mr-2"
      />
      {{ job.type === 'generation' ? job.config.name : 'Upscaling Image' }}
      <v-spacer />
      <v-chip
        :color="statusColor"
        size="small"
      >
        {{ job.status }}
      </v-chip>
    </v-card-title>

    <v-card-text>
      <div v-if="job.type === 'generation'" class="text-caption">
        {{ job.config.prompt }}
      </div>
      
      <div class="d-flex align-center mt-2">
        <span class="text-caption">Time: {{ elapsedTime }}</span>
        <v-spacer />
        <v-btn
          v-if="job.status === 'processing'"
          color="error"
          variant="text"
          size="small"
          @click="emit('cancel', job.id)"
        >
          Cancel
        </v-btn>
      </div>

      <div v-if="job.error" class="error--text mt-2">
        {{ job.error }}
      </div>
    </v-card-text>
  </v-card>
</template>