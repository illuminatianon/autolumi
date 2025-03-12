<script setup>
import { onMounted } from 'vue';
import { useConfigStore } from '@/stores/config';
import { useJobStore } from '@/stores/jobs';
import { storeToRefs } from 'pinia';

const configStore = useConfigStore();
const jobStore = useJobStore();

const { configs } = storeToRefs(configStore);

const emit = defineEmits(['new-config', 'edit-config', 'duplicate-config', 'delete-config', 'error']);

onMounted(async () => {
  try {
    await configStore.fetchConfigs();
  } catch (error) {
    console.error('Error fetching configs:', error);
    emit('error', error);
  }
});

const toggleConfig = async (config) => {
  try {
    if (configStore.isConfigActive(config.id)) {
      await jobStore.cancelJob(config.id);
    } else {
      await jobStore.startGeneration(config);
    }
  } catch (error) {
    console.error('Error toggling config:', error);
    emit('error', error);
  }
};
</script>

<template>
  <v-card class="configuration-list-container">
    <v-card-title class="sticky-header d-flex align-center justify-space-between">
      <span>Generation Configs</span>
      <v-btn
        color="primary"
        prepend-icon="mdi-plus"
        @click="$emit('new-config')"
      >
        New Config
      </v-btn>
    </v-card-title>

    <v-card-text class="scrollable-content">
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
        >
          <template #prepend>
            <v-btn
              :icon="configStore.isConfigActive(config.id) ? 'mdi-stop' : 'mdi-play'"
              :color="configStore.isConfigActive(config.id) ? 'error' : 'success'"
              variant="text"
              @click="toggleConfig(config)"
            />
          </template>
          <template #append>
            <v-menu>
              <template #activator="{ props }">
                <v-btn
                  icon="mdi-dots-vertical"
                  v-bind="props"
                  variant="text"
                />
              </template>

              <v-list>
                <v-list-item
                  prepend-icon="mdi-pencil"
                  title="Edit"
                  @click="$emit('edit-config', config)"
                />
                <v-list-item
                  prepend-icon="mdi-content-copy"
                  title="Duplicate"
                  @click="$emit('duplicate-config', config)"
                />
                <v-list-item
                  prepend-icon="mdi-delete"
                  title="Delete"
                  color="error"
                  @click="$emit('delete-config', config)"
                />
              </v-list>
            </v-menu>
          </template>
          <template #subtitle>
            <div class="text-caption">
              {{ config.model }} {{ config.hr_resize_x }} x {{ config.hr_resize_y }}
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

<style scoped>
.configuration-list-container {
  height: calc(100vh - 140px);
  display: flex;
  flex-direction: column;
}

.sticky-header {
  position: sticky;
  top: 0;
  z-index: 1;
}

.scrollable-content {
  flex-grow: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 16px;
}
</style>
