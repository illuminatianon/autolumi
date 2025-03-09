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
      <v-list>
        <v-list-item
          v-for="config in configs"
          :key="config.id"
          :active="isConfigActive(config.id)"
        >
          <template #prepend>
            <v-btn
              :icon="isConfigActive(config.id) ? 'mdi-stop' : 'mdi-play'"
              :color="isConfigActive(config.id) ? 'error' : 'success'"
              size="small"
              variant="text"
              @click="toggleConfig(config)"
            />
          </template>

          <v-list-item-title>{{ config.name }}</v-list-item-title>
          <v-list-item-subtitle>
            {{ config.model }} {{ config.hr_resize_x }}x{{ config.hr_resize_y }}
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
    </v-card-text>
  </v-card>
</template>

<script setup>
import { onMounted, onUnmounted } from 'vue';
import { useGenerationStore } from '@/stores/generation';
import { storeToRefs } from 'pinia';

const generationStore = useGenerationStore();
const { activeConfigs, isProcessing } = storeToRefs(generationStore);

const props = defineProps({
  configs: {
    type: Array,
    required: true,
  },
});

defineEmits(['new-config', 'edit-config', 'duplicate-config', 'delete-config']);

const isConfigActive = (configId) => generationStore.isConfigActive(configId);

const getConfigStatus = (configId) => {
  const config = activeConfigs.value.find(c => c.id === configId);
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
    // Error handling is done in the store
  }
};

onMounted(() => {
  generationStore.startPolling();
});

onUnmounted(() => {
  generationStore.stopPolling();
});
</script>
