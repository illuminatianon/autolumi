<template>
  <v-app>
    <!-- App Bar -->
    <v-app-bar>
      <v-app-bar-nav-icon @click="drawer = !drawer" />

      <v-app-bar-title>AutoLumi</v-app-bar-title>

      <v-spacer />

      <!-- Auto1111 Status -->
      <v-tooltip :text="auto1111Status.message">
        <template #activator="{ props }">
          <v-icon
            v-bind="props"
            :color="auto1111Status.color"
            :icon="auto1111Status.icon"
            class="mr-2"
          />
        </template>
      </v-tooltip>

      <!-- Queue Status -->
      <v-tooltip :text="queueStatusText">
        <template #activator="{ props }">
          <v-btn
            v-bind="props"
            icon="mdi-format-list-checks"
            class="mr-2"
            :badge="runningConfigs || undefined"
            :badge-color="isProcessing ? 'success' : undefined"
            @click="showQueue = !showQueue"
          />
        </template>
      </v-tooltip>

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

            <template #append>
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
          <v-col
            cols="12"
            md="4"
          >
            <configuration-list
              :configs="configs"
              @new-config="showConfigDialog()"
              @edit-config="editConfig"
              @duplicate-config="duplicateConfig"
              @delete-config="deleteConfig"
            />
          </v-col>

          <!-- Right side - Generated Images -->
          <v-col
            cols="12"
            md="8"
          >
            <generated-images-grid
              :images="recentImages"
              @image-click="handleImageClick"
            />
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
        <v-toolbar
          color="primary"
          class="text-white"
        >
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
          <v-col
            cols="12"
            md="8"
          >
            <v-img
              :src="`${imageDialog.image.path}`"
              class="bg-grey-lighten-2"
              max-height="80vh"
              contain
            />
          </v-col>
          <v-col
            cols="12"
            md="4"
            class="pa-4"
          >
            <h3 class="text-h6 mb-2">Generation Details</h3>
            <v-list density="compact">
              <v-list-item>
                <v-list-item-title class="text-caption text-medium-emphasis">Generated</v-list-item-title>
                <v-list-item-subtitle>{{
                    new Date(imageDialog.image.timestamp).toLocaleString()
                  }}
                </v-list-item-subtitle>
              </v-list-item>

              <v-list-item>
                <v-list-item-title class="text-caption text-medium-emphasis">Model</v-list-item-title>
                <v-list-item-subtitle>{{ imageDialog.image.config.model }}</v-list-item-subtitle>
              </v-list-item>

              <v-list-item>
                <v-list-item-title class="text-caption text-medium-emphasis">Size</v-list-item-title>
                <v-list-item-subtitle>{{ imageDialog.image.config.width }}x{{
                    imageDialog.image.config.height
                  }}
                </v-list-item-subtitle>
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
                <v-list-item-subtitle class="text-wrap">{{
                    imageDialog.image.config.negative_prompt
                  }}
                </v-list-item-subtitle>
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
import { computed, onMounted, ref, onUnmounted } from 'vue';
import { useConfigStore } from '@/stores/config';
import { useGenerationStore } from '@/stores/generation';
import { storeToRefs } from 'pinia';
import ConfigurationForm from '@/components/ConfigurationForm.vue';
import AppFooter from '@/components/AppFooter.vue';
import { getServerStatus } from '@/services/api';
import { generationService } from '@/services/generation';
import ConfigurationList from '@/components/ConfigurationList.vue';
import GeneratedImagesGrid from '@/components/GeneratedImagesGrid.vue';

const configStore = useConfigStore();
const generationStore = useGenerationStore();

const { configs } = storeToRefs(configStore);
const { activeConfigs, isProcessing } = storeToRefs(generationStore);

const runningConfigs = computed(() => activeConfigs.value.length);

const queueStatusText = computed(() => {
  if (runningConfigs.value === 0) return 'No active generations';
  return `${runningConfigs.value} config${runningConfigs.value > 1 ? 's' : ''} running`;
});

const drawer = ref(false);
const showSettings = ref(false);

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
        index: i,
      });
    }
  }
  return images.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
});

const auto1111Status = ref({
  color: 'warning',
  icon: 'mdi-sync',
  message: 'Checking Auto1111 connection...',
});

const configDialog = ref({
  show: false,
  config: null,
});

const showConfigDialog = (config = null) => {
  configDialog.value = {
    show: true,
    config,
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
      message: 'Server is connected',
    };
  } catch (error) {
    auto1111Status.value = {
      color: 'error',
      icon: 'mdi-alert-circle',
      message: 'Server is not connected',
    };
  }
};

const showQueue = ref(false);
const queueState = ref({
  jobs: [],
  completedJobs: [],
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
      !completedJobs.value.some(existing => existing.id === job.id),
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
  try {
    await generationService.cancelJob(job.id);
    // The next queue status poll will update the UI
  } catch (error) {
    console.error('Error canceling job:', error);
    // TODO: Show error notification
  }
};

const imageDialog = ref({
  show: false,
  image: null,
});

const showImageDetails = (image) => {
  imageDialog.value = {
    show: true,
    image,
  };
};

const selectedImage = ref(null);
const isUpscaling = ref(false);

async function handleUpscale(image) {
  if (isUpscaling.value) return;

  try {
    isUpscaling.value = true;
    selectedImage.value = image;

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

const completedJobs = ref([]);

const editConfig = async (config) => {
  configDialog.value = {
    show: true,
    config: { ...config }, // Clone the config to avoid direct mutations
  };
};

const duplicateConfig = async (config) => {
  const newConfig = {
    ...config,
    name: `${config.name} (Copy)`,
    id: undefined, // Remove ID so a new one will be generated
  };

  try {
    await configStore.addConfig(newConfig);
  } catch (error) {
    handleError(error);
  }
};

const handleImageClick = (image) => {
  showImageDetails(image);
};

// Add this computed property for recent images
const recentImages = computed(() => {
  // Take the first 50 images or adjust as needed
  return allImages.value.slice(0, 50);
});

onMounted(async () => {
  try {
    // Initial checks
    await checkAuto1111Status();
    await configStore.fetchConfigs();

    // Start polling for queue status
    const pollInterval = setInterval(pollQueueStatus, 5000);

    // Start polling for server status
    const statusInterval = setInterval(checkAuto1111Status, 5000);

    // Clean up intervals on component unmount
    onUnmounted(() => {
      clearInterval(pollInterval);
      clearInterval(statusInterval);
    });

    // Initial queue status check
    await pollQueueStatus();
  } catch (error) {
    console.error('Error during initialization:', error);
    handleError(error);
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
