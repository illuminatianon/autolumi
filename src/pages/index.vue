<template>
  <v-layout>
    <template #sidebar>
      <v-expansion-panels>
        <v-expansion-panel>
          <v-expansion-panel-title>
            New Configuration
          </v-expansion-panel-title>
          <v-expansion-panel-text>
            <ConfigurationForm @save="saveConfig" @error="showError" />
          </v-expansion-panel-text>
        </v-expansion-panel>

        <v-expansion-panel>
          <v-expansion-panel-title>
            Saved Configurations ({{ configs.length }})
          </v-expansion-panel-title>
          <v-expansion-panel-text>
            <v-list v-if="configs.length">
              <v-list-item v-for="config in configs" :key="config.name" :title="config.name"
                :subtitle="truncatePrompt(config.prompt)">
                <template #append>
                  <v-btn icon="mdi-pencil" variant="text" size="small" @click="editConfig(config)" />
                  <v-btn icon="mdi-delete" variant="text" size="small" color="error" @click="confirmDelete(config)" />
                  <v-btn icon="mdi-play" variant="text" size="small" color="success"
                    :loading="isGenerating && selectedConfig?.name === config.name"
                    @click="generateFromConfig(config)" />
                </template>
              </v-list-item>
            </v-list>
            <v-alert v-else type="info" text="No configurations saved yet. Create a new one to get started." />
          </v-expansion-panel-text>
        </v-expansion-panel>
      </v-expansion-panels>

      <v-dialog v-model="editDialog" max-width="600px">
        <ConfigurationForm v-if="editDialog" :config="selectedConfig" @save="updateConfig" @error="showError" />
      </v-dialog>

      <v-dialog v-model="deleteDialog" max-width="400px">
        <v-card>
          <v-card-title>Delete Configuration</v-card-title>
          <v-card-text>
            Are you sure you want to delete "{{ selectedConfig?.name }}"?
          </v-card-text>
          <v-card-actions>
            <v-spacer />
            <v-btn color="grey" variant="text" @click="deleteDialog = false">
              Cancel
            </v-btn>
            <v-btn color="error" @click="deleteConfig">
              Delete
            </v-btn>
          </v-card-actions>
        </v-card>
      </v-dialog>
    </template>

    <template #default>
      <!-- Main content area -->
      <v-row>
        <v-col cols="12">
          <v-card>
            <v-card-title class="d-flex align-center">
              Generation Results
              <v-spacer />
              <v-btn v-if="generatedImages.length" icon="mdi-delete-sweep" variant="text" @click="clearResults" />
            </v-card-title>
            <v-card-text>
              <div v-if="generatedImages.length" class="d-flex flex-wrap gap-4">
                <v-card v-for="(image, index) in generatedImages" :key="index" width="256" class="ma-2">
                  <v-img :src="'data:image/png;base64,' + image" aspect-ratio="1" cover />
                  <v-card-actions>
                    <v-btn icon="mdi-arrow-up-bold" variant="text" :loading="isUpscaling && upscalingIndex === index"
                      @click="upscaleImage(image, index)" />
                    <v-btn icon="mdi-download" variant="text" @click="downloadImage(image, index)" />
                  </v-card-actions>
                </v-card>
              </div>
              <div v-else class="text-center pa-4">
                No generated images yet. Select a configuration and click generate to start.
              </div>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>

      <!-- Error Snackbar -->
      <v-snackbar v-model="showSnackbar" :color="snackbarColor" :timeout="3000">
        {{ snackbarText }}
        <template v-slot:actions>
          <v-btn color="white" variant="text" @click="showSnackbar = false">
            Close
          </v-btn>
        </template>
      </v-snackbar>
    </template>
  </v-layout>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useConfigStore } from '@/stores/config';
import ConfigurationForm from '@/components/ConfigurationForm.vue';


const configStore = useConfigStore();
const configs = computed(() => configStore.configs);
const selectedConfig = ref(null);
const editDialog = ref(false);
const deleteDialog = ref(false);
const generatedImages = ref([]);

// Loading states
const isGenerating = ref(false);
const isUpscaling = ref(false);
const upscalingIndex = ref(-1);

// Snackbar
const showSnackbar = ref(false);
const snackbarText = ref('');
const snackbarColor = ref('success');

const showError = (error) => {
  snackbarText.value = error.message || 'An error occurred';
  snackbarColor.value = 'error';
  showSnackbar.value = true;
};

const showSuccess = (message) => {
  snackbarText.value = message;
  snackbarColor.value = 'success';
  showSnackbar.value = true;
};

const saveConfig = (config) => {
  try {
    configStore.addConfig(config);
    showSuccess('Configuration saved successfully');
  } catch (error) {
    showError(error);
  }
};

const editConfig = (config) => {
  selectedConfig.value = { ...config };
  editDialog.value = true;
};

const updateConfig = (config) => {
  try {
    configStore.updateConfig(config);
    editDialog.value = false;
    showSuccess('Configuration updated successfully');
  } catch (error) {
    showError(error);
  }
};

const confirmDelete = (config) => {
  selectedConfig.value = config;
  deleteDialog.value = true;
};

const deleteConfig = () => {
  try {
    configStore.deleteConfig(selectedConfig.value);
    deleteDialog.value = false;
    showSuccess('Configuration deleted successfully');
  } catch (error) {
    showError(error);
  }
};

const generateFromConfig = async (config) => {
  if (isGenerating.value) return;

  isGenerating.value = true;
  selectedConfig.value = config;
  try {
    const result = await auto1111Service.generateImage(config);
    generatedImages.value = result.images;
    showSuccess('Images generated successfully');
  } catch (error) {
    showError(error);
  } finally {
    isGenerating.value = false;
  }
};

const upscaleImage = async (imageData, index) => {
  if (isUpscaling.value) return;

  isUpscaling.value = true;
  upscalingIndex.value = index;
  try {
    const result = await auto1111Service.upscaleWithScript(imageData);
    if (result.images?.[0]) {
      generatedImages.value.push(result.images[0]);
      showSuccess('Image upscaled successfully');
    }
  } catch (error) {
    showError(error);
  } finally {
    isUpscaling.value = false;
    upscalingIndex.value = -1;
  }
};

const downloadImage = (imageData, index) => {
  const link = document.createElement('a');
  link.href = `data:image/png;base64,${imageData}`;
  link.download = `generated-${index}.png`;
  link.click();
};

const clearResults = () => {
  generatedImages.value = [];
};

const truncatePrompt = (prompt) => {
  if (!prompt) return '';
  return prompt.length > 50 ? prompt.substring(0, 47) + '...' : prompt;
};
</script>

<style scoped>
.gap-4 {
  gap: 1rem;
}
</style>
