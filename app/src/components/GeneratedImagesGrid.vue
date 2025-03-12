<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import { useWebSocketStore } from '@/stores/websocket';

const images = ref([]);
const wsStore = useWebSocketStore();

const emit = defineEmits(['image-click', 'upscale']);

function handleJobCompleted(jobData) {
  if (!jobData?.images?.length) return;

  const newImages = jobData.images.map((path, index) => ({
    id: `${jobData.id}_${index}`,
    path,
    jobName: jobData.config.name,
    timestamp: jobData.timestamp,
    config: jobData.config,
    jobId: jobData.id,
    index,
  }));

  // Add new images to the beginning of the array
  images.value.unshift(...newImages);
}

onMounted(() => {
  wsStore.onMessage('jobCompleted', handleJobCompleted);
});

onUnmounted(() => {
  wsStore.offMessage('jobCompleted', handleJobCompleted);
});
</script>

<template>
  <v-card class="generated-images-container">
    <v-card-title class="sticky-header">
      Generated Images
    </v-card-title>
    <v-card-text class="scrollable-content">
      <v-row>
        <v-col
          v-for="image in images"
          :key="image.id"
          cols="12"
          sm="6"
          md="4"
          lg="3"
        >
          <v-hover v-slot="{ isHovering, props }">
            <div
              v-bind="props"
              class="image-wrapper"
            >
              <v-img
                :src="image.path"
                contain
                class="rounded-lg cursor-pointer"
                @click="$emit('image-click', image)"
              >
                <template #placeholder>
                  <v-row
                    class="fill-height ma-0"
                    align="center"
                    justify="center"
                  >
                    <v-progress-circular
                      indeterminate
                      color="grey-lighten-5"
                    />
                  </v-row>
                </template>

                <!-- Overlay with actions -->
                <v-overlay
                  :model-value="isHovering"
                  contained
                  class="align-center justify-center"
                  scrim="#000000"
                  opacity="0.3"
                >
                  <v-btn
                    color="primary"
                    icon="mdi-arrow-up-bold"
                    variant="elevated"
                    @click.stop="$emit('upscale', image)"
                  />
                </v-overlay>
              </v-img>
            </div>
          </v-hover>
        </v-col>
      </v-row>
    </v-card-text>
  </v-card>
</template>

<style scoped>
.generated-images-container {
  height: calc(100vh - 140px); /* Adjust based on your app's header height */
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

.cursor-pointer {
  cursor: pointer;
}

.image-wrapper {
  position: relative;
  transition: transform 0.2s;
}

.image-wrapper:hover {
  transform: scale(1.02);
}
</style>
