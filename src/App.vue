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

            <v-list lines="two">
              <v-list-item
                v-for="config in configs"
                :key="config.name"
                :title="config.name"
                :subtitle="`${config.width}x${config.height}, ${config.steps} steps`"
              >
                <template v-slot:append>
                  <v-btn
                    icon="mdi-pencil"
                    variant="text"
                    size="small"
                    @click="showConfigDialog(config)"
                  />
                  <v-btn
                    icon="mdi-delete"
                    variant="text"
                    color="error"
                    size="small"
                    @click="deleteConfig(config)"
                  />
                </template>
              </v-list-item>
            </v-list>
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

const handleConfigSave = (config) => {
  if (configDialog.value.config) {
    configStore.updateConfig(config);
  } else {
    configStore.addConfig(config);
  }
  configDialog.value.show = false;
};

const deleteConfig = (config) => {
  if (confirm(`Are you sure you want to delete "${config.name}"?`)) {
    configStore.deleteConfig(config);
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

onMounted(() => {
  // Initial check
  checkAuto1111Status();

  // Check every 30 seconds
  setInterval(checkAuto1111Status, 30000);
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
