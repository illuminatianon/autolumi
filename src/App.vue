<template>
  <v-app>
    <!-- App Bar -->
    <v-app-bar>
      <v-app-bar-nav-icon @click="drawer = !drawer" />

      <v-app-bar-title>AutoLumi</v-app-bar-title>

      <v-spacer />

      <!-- Auto1111 Status -->
      <v-tooltip :text="auto1111Status.message">
        <template v-slot:activator="{ props }">
          <v-icon
            v-bind="props"
            :color="auto1111Status.color"
            :icon="auto1111Status.icon"
            class="mr-2"
          />
        </template>
      </v-tooltip>

      <!-- Queue Status -->
      <v-btn
        icon="mdi-format-list-checks"
        class="mr-2"
        :badge="queueCount || undefined"
        :badge-color="isProcessing ? 'success' : undefined"
        @click="showQueue = !showQueue"
      />

      <!-- App Settings -->
      <v-btn
        icon="mdi-cog"
        @click="showSettings = true"
      />
    </v-app-bar>

    <!-- Navigation Drawer -->
    <v-navigation-drawer
      v-model="drawer"
      temporary
    >
      <v-list>
        <v-list-item
          prepend-icon="mdi-image-multiple"
          title="Generation"
          value="generation"
        />
      </v-list>
    </v-navigation-drawer>

    <!-- Queue Panel -->
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
          @click="showQueue = false"
        />
      </v-toolbar>

      <v-list>
        <template v-for="job in sortedJobs" :key="job.id">
          <v-list-item>
            <template v-slot:prepend>
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
                icon="mdi-check-circle"
                class="mr-2"
              />
              <v-icon
                v-else-if="job.status === 'failed'"
                color="error"
                icon="mdi-alert-circle"
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

            <template v-slot:append>
              <v-btn
                v-if="job.status === 'pending'"
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

    <v-main>
      <v-container fluid>
        <v-row>
          <!-- Left side - Configuration List -->
          <v-col cols="12" md="4">
            <div class="d-flex align-center justify-space-between mb-4">
              <h2 class="text-h5">Generation Configs</h2>
              <v-btn
                color="primary"
                prepend-icon="mdi-plus"
                @click="showConfigDialog()"
              >
                New Config
              </v-btn>
            </div>

            <v-list v-if="!configStore.loading" lines="two">
              <v-list-group
                v-for="config in configs"
                :key="config.name"
                :value="config.name"
              >
                <template v-slot:activator="{ props }">
                  <v-list-item
                    v-bind="props"
                    :title="config.name"
                    :subtitle="getConfigSummary(config)"
                  >
                    <template v-slot:prepend>
                      <v-btn
                        icon="mdi-play"
                        variant="text"
                        color="success"
                        size="small"
                        class="mr-2"
                        @click.stop="queueGeneration(config)"
                        :loading="isGenerating(config)"
                        :disabled="isGenerating(config)"
                      />
                    </template>

                    <template v-slot:append>
                      <v-btn
                        icon="mdi-pencil"
                        variant="text"
                        size="small"
                        @click.stop="showConfigDialog(config)"
                      />
                      <v-btn
                        icon="mdi-delete"
                        variant="text"
                        color="error"
                        size="small"
                        @click.stop="deleteConfig(config)"
                      />
                    </template>
                  </v-list-item>
                </template>

                <v-list-item>
                  <v-list-item-subtitle>
                    <div class="text-body-2 mt-2">
                      <div><strong>Initial Size:</strong> {{ config.width }}x{{ config.height }}</div>
                      <div><strong>Steps:</strong> {{ config.steps }}</div>
                      <div><strong>CFG Scale:</strong> {{ config.cfg_scale }}</div>
                      <div><strong>Sampler:</strong> {{ config.sampler_name }}</div>
                      <div><strong>Batch Size:</strong> {{ config.batch_size }}</div>
                      <div class="mt-2"><strong>Prompt:</strong></div>
                      <div class="text-wrapped">{{ config.prompt }}</div>
                      <div v-if="config.negative_prompt" class="mt-2"><strong>Negative Prompt:</strong></div>
                      <div v-if="config.negative_prompt" class="text-wrapped">{{ config.negative_prompt }}</div>
                    </div>
                  </v-list-item-subtitle>
                </v-list-item>
              </v-list-group>

              <v-list-item v-if="configs.length === 0">
                <v-list-item-title class="text-center text-medium-emphasis">
                  No configurations yet. Click "New Config" to create one.
                </v-list-item-title>
              </v-list-item>
            </v-list>

            <div v-else class="d-flex justify-center align-center" style="min-height: 200px">
              <v-progress-circular indeterminate />
            </div>

            <v-alert
              v-if="configStore.error"
              type="error"
              closable
              class="mt-4"
              @click:close="configStore.clearError()"
            >
              {{ configStore.error }}
            </v-alert>
          </v-col>

          <!-- Right side - Results -->
          <v-col cols="12" md="8">
            <h2 class="text-h5 mb-4">Generation Results</h2>
            <div v-if="!hasGeneratedImages" class="text-center pa-8">
              <v-alert type="info" text="No generated images yet. Select a configuration and click generate to start."/>
            </div>
            <!-- Results will be added here -->
          </v-col>
        </v-row>
      </v-container>
    </v-main>

    <!-- Configuration Dialog -->
    <v-dialog
      v-model="configDialog.show"
      max-width="800"
      persistent
    >
      <configuration-form
        v-if="configDialog.show"
        :config="configDialog.config"
        @save="handleConfigSave"
        @error="handleError"
        @cancel="configDialog.show = false"
      />
    </v-dialog>

    <app-footer />
  </v-app>
</template>

<script setup>
import { ref, computed, onMounted, watchEffect } from 'vue';
import { useConfigStore } from '@/stores/config';
import ConfigurationForm from '@/components/ConfigurationForm.vue';
import AppFooter from '@/components/AppFooter.vue';
import auto1111Service from '@/services/auto1111/service';
import generationService from '@/services/generation';

const configStore = useConfigStore();
const hasGeneratedImages = ref(false);
const drawer = ref(false);
const showSettings = ref(false);

const configs = computed(() => configStore.configs);

const auto1111Status = ref({
  color: 'warning',
  icon: 'mdi-sync',
  message: 'Checking Auto1111 connection...'
});

const configDialog = ref({
  show: false,
  config: null
});

const activeJobs = ref(new Map()); // Map<configName, jobId>
const jobStatuses = ref(new Map()); // Map<jobId, status>

const showConfigDialog = (config = null) => {
  configDialog.value = {
    show: true,
    config
  };
};

const handleConfigSave = async (config) => {
  try {
    if (configDialog.value.config) {
      await configStore.updateConfig(config);
    } else {
      await configStore.addConfig(config);
    }
    configDialog.value.show = false;
  } catch (error) {
    // Error is already handled by the store
  }
};

const deleteConfig = async (config) => {
  if (confirm(`Are you sure you want to delete "${config.name}"?`)) {
    try {
      await configStore.deleteConfig(config);
    } catch (error) {
      // Error is already handled by the store
    }
  }
};

const handleError = (error) => {
  console.error('Error:', error);
  // TODO: Show error notification
};

// Check Auto1111 status periodically
const checkAuto1111Status = async () => {
  try {
    await auto1111Service.client.get('/config/health');
    auto1111Status.value = {
      color: 'success',
      icon: 'mdi-check-circle',
      message: 'Auto1111 is connected'
    };
  } catch (error) {
    auto1111Status.value = {
      color: 'error',
      icon: 'mdi-alert-circle',
      message: 'Auto1111 is not connected'
    };
  }
};

const getConfigSummary = (config) => {
  const parts = [
    `Model: ${config.model}`,
    config.hr_resize_x && config.hr_resize_y
      ? `Target: ${config.hr_resize_x}x${config.hr_resize_y}`
      : 'No upscale'
  ];
  return parts.join(' • ');
};

const isGenerating = (config) => {
  const jobId = activeJobs.value.get(config.name);
  if (!jobId) return false;

  const status = jobStatuses.value.get(jobId);
  // Only show loading state when the job is actually processing
  return status?.status === 'processing';
};

const queueGeneration = async (config) => {
  try {
    const job = await generationService.queueGeneration(config);
    activeJobs.value.set(config.name, job.id);
    jobStatuses.value.set(job.id, job);
    startPollingJob(job.id);
  } catch (error) {
    console.error('Error queueing generation:', error);
    // TODO: Show error notification
  }
};

const pollInterval = ref(null);
const pollJobs = async () => {
  const jobIds = Array.from(jobStatuses.value.keys());
  let hasActiveJobs = false;

  for (const jobId of jobIds) {
    try {
      const status = await generationService.getJobStatus(jobId);

      // If the job no longer exists on the server, remove it from our tracking
      if (!status) {
        jobStatuses.value.delete(jobId);
        const configName = Array.from(activeJobs.value.entries())
          .find(([_, id]) => id === jobId)?.[0];
        if (configName) {
          activeJobs.value.delete(configName);
        }
        continue;
      }

      jobStatuses.value.set(jobId, status);

      if (['completed', 'failed'].includes(status.status)) {
        // Remove the job from activeJobs immediately
        const configName = Array.from(activeJobs.value.entries())
          .find(([_, id]) => id === jobId)?.[0];
        if (configName) {
          activeJobs.value.delete(configName);
        }

        // Remove the job from jobStatuses after a delay
        setTimeout(() => {
          jobStatuses.value.delete(jobId);
        }, 5000); // Keep completed/failed jobs visible for 5 seconds
      } else {
        hasActiveJobs = true;
      }
    } catch (error) {
      console.error('Error polling job status:', error);
      // If we can't get the status, assume the job is gone
      jobStatuses.value.delete(jobId);
      const configName = Array.from(activeJobs.value.entries())
        .find(([_, id]) => id === jobId)?.[0];
      if (configName) {
        activeJobs.value.delete(configName);
      }
    }
  }

  // If no more active jobs, stop polling
  if (!hasActiveJobs && pollInterval.value) {
    clearInterval(pollInterval.value);
    pollInterval.value = null;
  }
};

const startPollingJob = (jobId) => {
  // Start polling if not already polling
  if (!pollInterval.value) {
    pollInterval.value = setInterval(pollJobs, 1000);
  }
};

const showQueue = ref(false);
const queueCount = computed(() => jobStatuses.value.size);
const isProcessing = computed(() => Array.from(jobStatuses.value.values()).some(job => job.status === 'processing'));

const sortedJobs = computed(() => {
  return Array.from(jobStatuses.value.values()).sort((a, b) => {
    // Processing jobs first
    if (a.status === 'processing' && b.status !== 'processing') return -1;
    if (b.status === 'processing' && a.status !== 'processing') return 1;

    // Then pending jobs by timestamp
    if (a.status === 'pending' && b.status === 'pending') {
      return new Date(a.timestamp) - new Date(b.timestamp);
    }

    // Then completed/failed jobs by timestamp, newest first
    return new Date(b.timestamp) - new Date(a.timestamp);
  });
});

const getQueuePosition = (job) => {
  if (job.status !== 'pending') return '';
  const pending = Array.from(jobStatuses.value.values())
    .filter(j => j.status === 'pending')
    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  return pending.findIndex(j => j.id === job.id) + 1;
};

const getQueueProgress = (job) => {
  if (job.status !== 'pending') return 0;
  const position = getQueuePosition(job);
  const total = Array.from(jobStatuses.value.values())
    .filter(j => j.status === 'pending').length;
  return ((total - position + 1) / total) * 100;
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
  // TODO: Implement job cancellation
  console.log('Cancel job:', job.id);
};

onMounted(async () => {
  // Initial check
  checkAuto1111Status();

  // Check every 30 seconds
  setInterval(checkAuto1111Status, 30000);

  // Load configs
  await configStore.fetchConfigs();

  // Initial queue status check
  const queueStatus = await generationService.getQueueStatus();
  // TODO: Handle existing queue status
});
</script>

<style scoped>
.config-panel {
  border-right: 1px solid rgba(0, 0, 0, 0.12);
  min-height: calc(100vh - 40px);
}

@media (max-width: 960px) {
  .config-panel {
    border-right: none;
    border-bottom: 1px solid rgba(0, 0, 0, 0.12);
    min-height: auto;
  }
}
</style>
