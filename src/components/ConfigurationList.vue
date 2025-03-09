<template>
  <v-card>
    <v-card-title class="d-flex align-center justify-space-between">
      <span>Generation Configs</span>
      <v-btn
        color="primary"
        prepend-icon="mdi-plus"
        @click="$emit('new-config')"
      >
        New Config
      </v-btn>
    </v-card-title>

    <v-card-text>
      <v-alert
        v-if="configStore.error"
        type="error"
        class="mb-4"
      >
        {{ configStore.error }}
      </v-alert>

      <v-progress-linear
        v-if="configStore.loading"
        indeterminate
      />

      <v-list v-else>
        <v-list-item
          v-for="config in configs"
          :key="config.id"
          :title="config.name"
          :subtitle="config.prompt"
        >
          <template #append>
            <v-btn-group>
              <v-btn
                :icon="isConfigActive(config.id) ? 'mdi-stop' : 'mdi-play'"
                :color="isConfigActive(config.id) ? 'error' : 'success'"
                @click="toggleConfig(config)"
              />
              <v-btn
                icon="mdi-pencil"
                @click="$emit('edit-config', config)"
              />
              <v-btn
                icon="mdi-content-copy"
                @click="$emit('duplicate-config', config)"
              />
              <v-btn
                icon="mdi-delete"
                @click="$emit('delete-config', config)"
              />
            </v-btn-group>
          </template>
          <template #subtitle>
            <div class="text-caption">
              {{ config.prompt }}
            </div>
            <div
              v-if="isConfigActive(config.id)"
              class="text-caption text-primary"
            >
              {{ getConfigStatus(config.id) }}
            </div>
          </template>
        </v-list-item>
      </v-list>

      <div
        v-if="!configStore.loading && !configStore.error && configs.length === 0"
        class="text-center pa-4"
      >
        No configurations found. Click "New Config" to create one.
      </div>
    </v-card-text>
  </v-card>
</template>

<script setup>
import { onMounted } from 'vue';
import { useConfigStore } from '@/stores/config';
import { useGenerationStore } from '@/stores/generation';
import { storeToRefs } from 'pinia';
import { useWebSocketStore } from '@/stores/websocket';

const configStore = useConfigStore();
const generationStore = useGenerationStore();

const { configs } = storeToRefs(configStore);
const { activeConfigs } = storeToRefs(generationStore);

const emit = defineEmits(['new-config', 'edit-config', 'duplicate-config', 'delete-config', 'error']);

onMounted(async () => {
  try {
    const wsStore = useWebSocketStore();
    await wsStore.ensureConnection();
    await configStore.fetchConfigs();
  } catch (error) {
    console.error('Error fetching configs:', error);
    emit('error', error);
  }
});

const isConfigActive = (configId) => generationStore.isConfigActive(configId);

const getConfigStatus = (configId) => {
  if (!isConfigActive(configId)) return '';
  const config = activeConfigs.value.get(configId);
  if (!config) return '';
  return `Runs: ${config.completedRuns || 0} | Failures: ${config.failedRuns || 0}`;
};

const toggleConfig = async (config) => {
  try {
    if (isConfigActive(config.id)) {
      await generationStore.stopConfig(config.id);
    } else {
      await generationStore.startConfig(config);
    }
  } catch (error) {
    console.error('Error toggling config:', error);
    emit('error', error);
  }
};
</script>
