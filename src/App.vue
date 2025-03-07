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

const queueGeneration = (config) => {
  // TODO: Implement generation queueing
  console.log('Queueing generation for config:', config.name);
};

onMounted(async () => {
  // Initial check
  checkAuto1111Status();

  // Check every 30 seconds
  setInterval(checkAuto1111Status, 30000);

  // Load configs
  await configStore.fetchConfigs();
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
