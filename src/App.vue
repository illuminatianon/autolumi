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
          </v-col>

          <!-- Right side - Results -->
          <v-col cols="12" md="8">
            <h2 class="text-h5 mb-4">Generation Results</h2>
            <div v-if="!hasGeneratedImages" class="text-center pa-8">
              <v-alert type="info" text="No generated images yet. Select a configuration and click generate to start."/>
            </div>
            <v-row v-else dense>
              <v-col
                v-for="image in allImages"
                :key="image.id"
                cols="6"
                sm="4"
                md="3"
                xl="2"
                class="pa-1"
              >
                <v-hover v-slot="{ isHovering, props }">
                  <v-card
                    v-bind="props"
                    :elevation="isHovering ? 8 : 2"
                    class="transition-swing"
                  >
                    <v-img
                      :src="`${image.path}`"
                      :aspect-ratio="image.config.width / image.config.height"
                      @click="showImageDetails(image)"
                    >
                      <template v-slot:placeholder>
                        <div class="d-flex align-center justify-center fill-height">
                          <v-progress-circular
                            indeterminate
                            color="primary"
                          />
                        </div>
                      </template>

                      <div
                        v-if="isHovering"
                        class="d-flex flex-column fill-height position-absolute"
                        style="background: rgba(0, 0, 0, 0.7); inset: 0;"
                      >
                        <v-card-title class="text-white text-subtitle-2 pt-2">{{ image.jobName }}</v-card-title>
                        <v-card-subtitle class="text-white text-caption pb-0">
                          {{ new Date(image.timestamp).toLocaleString() }}
                        </v-card-subtitle>
                        <v-spacer />
                        <v-card-actions>
                          <v-spacer />
                          <v-btn
                            variant="tonal"
                            color="primary"
                            size="small"
                            prepend-icon="mdi-arrow-up-bold"
                            @click.stop="handleUpscale(image)"
                          >
                            Upscale
                          </v-btn>
                        </v-card-actions>
                      </div>
                    </v-img>
                  </v-card>
                </v-hover>
              </v-col>
            </v-row>
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

    <!-- Image Details Dialog -->
    <v-dialog
      v-model="imageDialog.show"
      max-width="90vw"
      max-height="90vh"
    >
      <v-card v-if="imageDialog.image">
        <v-toolbar color="primary" class="text-white">
          <v-toolbar-title>{{ imageDialog.image.jobName }}</v-toolbar-title>
          <v-spacer />
          <v-btn
            icon="mdi-close"
            variant="text"
            color="white"
            @click="imageDialog.show = false"
          />
        </v-toolbar>

        <v-row no-gutters>
          <v-col cols="12" md="8">
            <v-img
              :src="`${imageDialog.image.path}`"
              class="bg-grey-lighten-2"
              max-height="80vh"
              contain
            />
          </v-col>
          <v-col cols="12" md="4" class="pa-4">
            <h3 class="text-h6 mb-2">Generation Details</h3>
            <v-list density="compact">
              <v-list-item>
                <v-list-item-title class="text-caption text-medium-emphasis">Generated</v-list-item-title>
                <v-list-item-subtitle>{{ new Date(imageDialog.image.timestamp).toLocaleString() }}</v-list-item-subtitle>
              </v-list-item>

              <v-list-item>
                <v-list-item-title class="text-caption text-medium-emphasis">Model</v-list-item-title>
                <v-list-item-subtitle>{{ imageDialog.image.config.model }}</v-list-item-subtitle>
              </v-list-item>

              <v-list-item>
                <v-list-item-title class="text-caption text-medium-emphasis">Size</v-list-item-title>
                <v-list-item-subtitle>{{ imageDialog.image.config.width }}x{{ imageDialog.image.config.height }}</v-list-item-subtitle>
              </v-list-item>

              <v-list-item>
                <v-list-item-title class="text-caption text-medium-emphasis">Steps</v-list-item-title>
                <v-list-item-subtitle>{{ imageDialog.image.config.steps }}</v-list-item-subtitle>
              </v-list-item>

              <v-list-item>
                <v-list-item-title class="text-caption text-medium-emphasis">CFG Scale</v-list-item-title>
                <v-list-item-subtitle>{{ imageDialog.image.config.cfg_scale }}</v-list-item-subtitle>
              </v-list-item>

              <v-list-item>
                <v-list-item-title class="text-caption text-medium-emphasis">Sampler</v-list-item-title>
                <v-list-item-subtitle>{{ imageDialog.image.config.sampler_name }}</v-list-item-subtitle>
              </v-list-item>

              <v-divider class="my-2" />

              <v-list-item>
                <v-list-item-title class="text-caption text-medium-emphasis">Prompt</v-list-item-title>
                <v-list-item-subtitle class="text-wrap">{{ imageDialog.image.config.prompt }}</v-list-item-subtitle>
              </v-list-item>

              <v-list-item v-if="imageDialog.image.config.negative_prompt">
                <v-list-item-title class="text-caption text-medium-emphasis">Negative Prompt</v-list-item-title>
                <v-list-item-subtitle class="text-wrap">{{ imageDialog.image.config.negative_prompt }}</v-list-item-subtitle>
              </v-list-item>
            </v-list>

            <v-card-actions>
              <v-spacer />
              <v-btn
                color="primary"
                prepend-icon="mdi-arrow-up-bold"
                @click="handleUpscale(imageDialog.image)"
              >
                Upscale
              </v-btn>
            </v-card-actions>
          </v-col>
        </v-row>
      </v-card>
    </v-dialog>

    <app-footer />
  </v-app>
</template>

<script setup>
import { ref, computed, onMounted, watchEffect } from 'vue';
import { useConfigStore } from '@/stores/config';
import ConfigurationForm from '@/components/ConfigurationForm.vue';
import AppFooter from '@/components/AppFooter.vue';
import {apiService, getServerStatus} from '@/services/api';
import generationService from '@/services/generation';

const configStore = useConfigStore();
const drawer = ref(false);
const showSettings = ref(false);

const configs = computed(() => configStore.configs);
const completedJobs = ref([]);
const allImages = computed(() => {
  const images = [];
  for (const job of completedJobs.value) {
    for (let i = 0; i < job.images.length; i++) {
      images.push({
        id: `${job.id}_${i}`,
        path: job.images[i],
        jobName: job.config.name,
        timestamp: job.timestamp,
        config: job.config,
        jobId: job.id,
        index: i
      });
    }
  }
  return images.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
});

const hasGeneratedImages = computed(() => allImages.value.length > 0);

const auto1111Status = ref({
  color: 'warning',
  icon: 'mdi-sync',
  message: 'Checking Auto1111 connection...'
});

const configDialog = ref({
  show: false,
  config: null
});

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
    await getServerStatus();
    auto1111Status.value = {
      color: 'success',
      icon: 'mdi-check-circle',
      message: 'Server is connected'
    };
  } catch (error) {
    auto1111Status.value = {
      color: 'error',
      icon: 'mdi-alert-circle',
      message: 'Server is not connected'
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

const queueCount = computed(() => queueState.value?.jobs?.length || 0);
const isProcessing = computed(() => queueState.value?.jobs?.some(job => job.status === 'processing') || false);

const isGenerating = (config) => {
  return queueState.value?.jobs?.some(job =>
    job.config.name === config.name &&
    (job.status === 'pending' || job.status === 'processing')
  ) || false;
};

const queueGeneration = async (config) => {
  try {
    await generationService.queueGeneration(config);
  } catch (error) {
    console.error('Error queueing generation:', error);
  }
};

const showQueue = ref(false);
const queueState = ref({
  jobs: [],
  completedJobs: []
});

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

    // Update completedJobs with any new completed jobs
    const newCompleted = (status.jobs || []).filter(job =>
      job.status === 'completed' &&
      !completedJobs.value.some(existing => existing.id === job.id)
    );

    if (newCompleted.length > 0) {
      completedJobs.value.unshift(...newCompleted);
    }
  } catch (error) {
    console.error('Error polling queue status:', error);
  }
};

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
  // TODO: Implement job cancellation
  console.log('Cancel job:', job.id);
};

const imageDialog = ref({
  show: false,
  image: null
});

const showImageDetails = (image) => {
  imageDialog.value = {
    show: true,
    image
  };
};

const selectedImage = ref(null);
const isUpscaling = ref(false);

async function handleUpscale(image) {
  if (isUpscaling.value) return;

  try {
    isUpscaling.value = true;
    selectedImage.value = image;

    // Get the upscale config from the original generation config
    const upscaleConfig = {
      upscale_tile_overlap: image.config.upscale_tile_overlap,
      upscale_upscaler: image.config.upscale_upscaler,
      upscale_scale_factor: image.config.upscale_scale_factor,
      upscale_denoising_strength: image.config.upscale_denoising_strength,
    };

    // Queue the upscale job
    const job = await generationService.queueUpscale(image.path, upscaleConfig);

    // Close the lightbox if open
    imageDialog.value.show = false;
  } catch (error) {
    console.error('Failed to upscale:', error);
    alert('Failed to upscale image: ' + error.message);
  } finally {
    isUpscaling.value = false;
    selectedImage.value = null;
  }
}

onMounted(async () => {
  try {
    // Initial checks
    await checkAuto1111Status();

    // Load configs
    await configStore.fetchConfigs();

    // Initial queue status check - do this once at startup
    try {
      const queueStatus = await generationService.getQueueStatus();
      if (queueStatus && typeof queueStatus !== 'string') {
        queueState.value = queueStatus;
      }
    } catch (error) {
      console.error('Initial queue status check failed:', error);
    }

    // Set up polling intervals with more reasonable frequencies
    setInterval(checkAuto1111Status, 30000); // Every 30 seconds is fine for server status
    setInterval(pollQueueStatus, 5000);      // Every 5 seconds for queue status
  } catch (error) {
    console.error('Error during initialization:', error);
  }
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

.position-relative {
  position: relative;
}

.position-absolute {
  position: absolute;
}
</style>
