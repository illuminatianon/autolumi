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
          :active="isConfigActive(config.id)"
        >
          <template #prepend>
            <v-btn
              :icon="isConfigActive(config.id) ? 'mdi-pause' : 'mdi-play'"
              :color="isConfigActive(config.id) ? 'primary' : 'success'"
              size="small"
              variant="text"
              @click="toggleConfig(config)"
            />
          </template>

          <v-list-item-title>{{ config.name }}</v-list-item-title>
          <v-list-item-subtitle>
            {{ config.model }} {{ config.hr_resize_x }}x{{ config.hr_resize_y }}
            <span
              v-if="getConfigStatus(config.id)"
              class="text-medium-emphasis"
            >
              | {{ getConfigStatus(config.id) }}
            </span>
          </v-list-item-subtitle>
          <template #append>
            <v-menu>
              <template #activator="{ props }">
                <v-btn
                  icon="mdi-dots-vertical"
                  variant="text"
                  v-bind="props"
                />
              </template>

              <v-list>
                <v-list-item
                  prepend-icon="mdi-pencil"
                  @click="$emit('edit-config', config)"
                >
                  Edit
                </v-list-item>
                <v-list-item
                  prepend-icon="mdi-content-copy"
                  @click="$emit('duplicate-config', config)"
                >
                  Duplicate
                </v-list-item>
                <v-list-item
                  prepend-icon="mdi-delete"
                  color="error"
                  @click="$emit('delete-config', config)"
                >
                  Delete
                </v-list-item>
              </v-list>
            </v-menu>
          </template>

          <template #subtitle>
            <div v-if="isConfigActive(config.id)">
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
import { ref, onMounted } from 'vue';
import { useConfigStore } from '@/stores/config';
import { useGenerationStore } from '@/stores/generation';
import { storeToRefs } from 'pinia';

const configStore = useConfigStore();
const generationStore = useGenerationStore();

const { configs } = storeToRefs(configStore);
const { activeConfigs } = storeToRefs(generationStore);

const emit = defineEmits(['new-config', 'edit-config', 'duplicate-config', 'delete-config', 'error']);

onMounted(async () => {
  try {
    await configStore.fetchConfigs();
  } catch (error) {
    emit('error', error);
  }
});

const isConfigActive = (configId) => generationStore.isConfigActive(configId);

const getConfigStatus = (configId) => {
  const config = activeConfigs.value.get(configId);
  if (!config) return '';
  return `Runs: ${config.completedRuns} | Failures: ${config.failedRuns}`;
};

const toggleConfig = async (config) => {
  try {
    if (isConfigActive(config.id)) {
      await generationStore.stopConfig(config.id);
    } else {
      await generationStore.startConfig(config);
    }
  } catch (error) {
    emit('error', error);
  }
};
</script>
