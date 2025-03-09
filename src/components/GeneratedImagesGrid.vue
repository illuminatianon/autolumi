<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import { useWebSocketStore } from '@/stores/websocket';

const images = ref([]);
const wsStore = useWebSocketStore();

const emit = defineEmits(['image-click']);

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
  <v-card>
    <v-card-title>Generated Images</v-card-title>
    <v-card-text>
      <v-row>
        <v-col
          v-for="image in images"
          :key="image.id"
          cols="12"
          sm="6"
          md="4"
          lg="3"
        >
          <v-img
            :src="'/data/output/'+image.path"

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
          </v-img>
        </v-col>
      </v-row>
    </v-card-text>
  </v-card>
</template>
