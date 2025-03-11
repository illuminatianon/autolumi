<script setup>
import { computed, onMounted, ref, onUnmounted } from 'vue';
import { useConfigStore } from '@/stores/config';
import { useGenerationStore } from '@/stores/generation';
import { useWebSocketStore } from '@/stores/websocket';
import { useJobStore } from '@/stores/jobs';
import { storeToRefs } from 'pinia';
import ConfigurationForm from '@/components/ConfigurationForm.vue';
import AppFooter from '@/components/AppFooter.vue';
import ConfigurationList from '@/components/ConfigurationList.vue';
import GeneratedImagesGrid from '@/components/GeneratedImagesGrid.vue';
import JobStatus from '@/components/JobStatus.vue';
import { webSocketService } from '@/services/websocket';

const configStore = useConfigStore();
const generationStore = useGenerationStore();
const wsStore = useWebSocketStore();
const jobStore = useJobStore();

// Use storeToRefs for reactive store properties
const { configs } = storeToRefs(configStore);
const { activeConfigs, isProcessing } = storeToRefs(generationStore);
const { currentJob, serverStatus } = storeToRefs(jobStore);

// Initialize other reactive refs
const drawer = ref(false);
const showQueue = ref(false);
const configDialog = ref({
  show: false,
  config: null,
});

const auto1111Status = computed(() => {
  const status = serverStatus.value.auto1111Status;
  if (!status) {
    return {
      color: 'warning',
      icon: 'mdi-cloud-question',
      message: 'Checking connection...',
    };
  }

  return {
    color: status.connected ? 'success' : 'error',
    icon: status.connected ? 'mdi-check-circle' : 'mdi-alert-circle',
    message: status.connected ? 'Server is connected' : 'Server is not connected',
  };
});

const runningConfigs = computed(() => generationStore.runningConfigs?.length || 0);

const activeJobsCount = computed(() => {
  return runningConfigs.value || 0;
});

const queueStatus = computed(() => {
  const count = activeJobsCount.value;
  return {
    count,
    color: count > 0 ? 'primary' : 'success',
  };
});

const queueTooltipContent = computed(() => {
  const jobs = generationStore.runningConfigs || [];
  if (jobs.length === 0) {
    return 'No active generations';
  }

  return jobs.map(job => {
    if (!job?.config?.name) {
      return 'Unknown configuration';
    }
    return `${job.config.name}: ${job.status === 'processing' ? 'Generating' : 'Queued'}`;
  }).join('\n');
});

const showSettings = ref(false);
const completedJobs = ref([]);

const handleJobsCompleted = (newJobs) => {
  completedJobs.value.unshift(...newJobs);
};

const allImages = computed(() => {
  const images = [];
  for (const job of completedJobs.value) {
    for (let i = 0; i < job.images.length; i++) {
      images.push({
        id: `${job.id}_${i}`,
        path: job.images[i],
        // Access config properties directly without extra nesting
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

const showConfigDialog = (config = null) => {
  configDialog.value = {
    show: true,
    config,
  };
};

const handleConfigSave = async (config) => {
  if (configDialog.value.config) {
    await configStore.updateConfig({
      ...config,
      id: configDialog.value.config.id,
    });
  } else {
    await configStore.addConfig(config);
  }
  configDialog.value.show = false;
};

const deleteConfig = async (config) => {
  if (confirm(`Are you sure you want to delete "${config.name}"?`)) {
    await configStore.deleteConfig(config);
  }
};

const handleError = (error) => {
  console.error('Error:', error);
  // TODO: Add proper error notification here
  // For now, you could use a simple alert or implement a snackbar
};

// Check Auto1111 status periodically
const checkAuto1111Status = async () => {
  try {
    const status = await webSocketService.checkServerStatus();
    auto1111Status.value = {
      color: status.status === 'ok' ? 'success' : 'error',
      icon: status.status === 'ok' ? 'mdi-check-circle' : 'mdi-alert-circle',
      message: status.status === 'ok' ? 'Server is connected' : 'Server is not connected',
    };
  } catch (error) {
    auto1111Status.value = {
      color: 'error',
      icon: 'mdi-alert-circle',
      message: 'Server is not connected',
    };
    console.error('Server status check failed:', error);
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

  isUpscaling.value = true;
  selectedImage.value = image;
  // Close the lightbox if open
  imageDialog.value.show = false;

  isUpscaling.value = false;
  selectedImage.value = null;
}

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
  await configStore.addConfig(newConfig);
};

const handleImageClick = (image) => {
  showImageDetails(image);
};

// Add this computed property for recent images
const recentImages = computed(() => {
  // Take the first 50 images or adjust as needed
  return allImages.value.slice(0, 50);
});

let statusInterval;

const initializeApp = async () => {
  try {
    console.log('Initializing app...');
    await configStore.fetchConfigs();
    await jobStore.refreshServerStatus();
    await checkAuto1111Status();

    // Start polling for server status
    statusInterval = setInterval(checkAuto1111Status, 5000);
  } catch (error) {
    handleError(error);
  }
};

onMounted(() => {
  initializeApp();
});

onUnmounted(() => {
  if (statusInterval) {
    clearInterval(statusInterval);
  }
});
</script>

<template>
  <v-app>
    <!-- App Bar -->
    <v-app-bar>
      <v-app-bar-nav-icon @click="drawer = !drawer" />

      <v-app-bar-title>AutoLumi</v-app-bar-title>

      <v-spacer />

      <!-- Auto1111 Status -->
      <v-tooltip location="bottom">
        <template #activator="{ props }">
          <v-icon
            v-bind="props"
            :color="auto1111Status.color"
            :icon="auto1111Status.icon"
            class="mr-2"
          />
        </template>
        <span>{{ auto1111Status.message }}</span>
      </v-tooltip>

      <!-- Queue Status -->
      <v-tooltip location="bottom">
        <template #activator="{ props }">

          <v-badge

            :content="queueStatus.count.toString()"
            :color="queueStatus.color"
            location="top end"
          >
            <v-btn
              v-bind="props"
              :icon="queueStatus.count > 0 ? 'mdi-animation-play' : 'mdi-check-circle'"
              :color="queueStatus.color"
              class="position-relative"
              @click="showQueue = true"
            />
          </v-badge>
        </template>
        <div class="text-pre-wrap">
          <template v-if="queueStatus.count > 0">
            Active Generations:
            <div
              v-for="job in generationStore.runningConfigs"
              :key="job.id"
              class="pl-2"
            >
              • {{ job.config.name }}: {{ job.status === 'processing' ? 'Generating' : 'Queued' }}
            </div>
          </template>
          <template v-else>
            No active generations
          </template>
        </div>
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
              @error="handleError"
            />
          </v-col>

          <!-- Right side - Add JobStatus above GeneratedImagesGrid -->
          <v-col
            cols="12"
            md="8"
          >
            <job-status
              v-if="currentJob"
              :job="currentJob"
              @cancel="jobStore.cancelJob"
            />
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

<style scoped>
</style>
