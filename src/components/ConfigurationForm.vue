<script setup>
import { computed, onMounted, ref } from 'vue';
import { useConfigStore } from '@/stores/config';
import { storeToRefs } from 'pinia';

const props = defineProps({
  config: {
    type: Object,
    default: () => null,
  },
});

const emit = defineEmits(['save', 'error', 'cancel']);

const configStore = useConfigStore();
const { models, samplers, upscalers, hrUpscalers, loading } = storeToRefs(configStore);

const form = ref(null);
const isEditing = computed(() => !!props.config);

const defaultForm = ref({
  name: '',
  model: '',
  steps: 25,
  sampler_name: '',
  cfg_scale: 10,
  width: 512,
  height: 512,
  batch_size: 1,
  prompt: '',
  negative_prompt: '',
  hr_resize_x: 0,
  hr_resize_y: 0,
  hr_denoising_strength: 0.7,
  hr_second_pass_steps: 20,
  hr_upscaler: '',
  upscale_tile_overlap: 64,
  upscale_scale_factor: 2.5,
  upscale_upscaler: '',
  upscale_denoising_strength: 0.15,
});

const formData = ref({ ...defaultForm.value });

const validateUniqueName = (value) => {
  if (!value) return true;
  return configStore.isNameUnique(value, props.config) || 'Configuration name must be unique';
};

const handleSubmit = async () => {
  const isValid = await form.value?.validate();

  if (isValid?.valid) {
    try {
      emit('save', { ...formData.value });
    } catch (error) {
      emit('error', error);
    }
  }
};

const handleCancel = () => {
  emit('cancel');
};

const updateSteps = (value) => {
  formData.value.steps = value;
  formData.value.hr_second_pass_steps = value;
};

onMounted(async () => {
  try {
    // Load all options in parallel
    await Promise.all([
      configStore.loadModelOptions(),
      configStore.loadSamplerOptions(),
      configStore.loadUpscalerOptions(),
    ]);

    // Get defaults
    const defaults = await configStore.getDefaultConfig();
    defaultForm.value = {
      ...defaultForm.value,
      ...defaults,
    };

    // Set initial form data
    formData.value = props.config ? { ...props.config } : { ...defaultForm.value };

    // Set default values if none selected
    if (!formData.value.model && models.value.length > 0) {
      formData.value.model = models.value[0].title;
    }
    if (!formData.value.sampler_name && samplers.value.length > 0) {
      formData.value.sampler_name = samplers.value[0];
    }
    if (!formData.value.hr_upscaler && hrUpscalers.value.length > 0) {
      formData.value.hr_upscaler = hrUpscalers.value[0];
    }
    if (!formData.value.upscale_upscaler && upscalers.value.length > 0) {
      formData.value.upscale_upscaler = upscalers.value[0].name;
    }
  } catch (error) {
    emit('error', error);
  }
});
</script>

<template>
  <v-card :loading="loading">
    <v-card-title>
      <span v-if="isEditing">Edit Configuration</span>
      <span v-else>New Configuration</span>
    </v-card-title>

    <v-form
      ref="form"
      @submit.prevent="handleSubmit"
    >
      <v-card-text>
        <v-text-field
          v-model="formData.name"
          label="Configuration Name"
          :rules="[v => !!v || 'Name is required', validateUniqueName]"
          required
        />

        <v-select
          v-model="formData.model"
          :items="models"
          item-title="model_name"
          item-value="title"
          label="Model"
          :rules="[v => !!v || 'Model is required']"
          required
          :loading="!models.length"
          persistent-hint
          hint="The model will be loaded when generation starts"
        />

        <v-textarea
          v-model="formData.prompt"
          label="Prompt"
          :rules="[v => !!v || 'Prompt is required']"
          required
          rows="3"
        />

        <v-textarea
          v-model="formData.negative_prompt"
          label="Negative Prompt"
          rows="2"
        />

        <v-row>
          <v-col cols="6">
            <v-text-field
              v-model.number="formData.steps"
              label="Steps"
              type="number"
              min="1"
              max="150"
              :rules="[v => v >= 1 && v <= 150 || 'Steps must be between 1 and 150']"
              @update:model-value="updateSteps"
            />
          </v-col>
          <v-col cols="6">
            <v-text-field
              v-model.number="formData.cfg_scale"
              label="CFG Scale"
              type="number"
              min="1"
              max="30"
              step="0.5"
              :rules="[v => v >= 1 && v <= 30 || 'CFG Scale must be between 1 and 30']"
            />
          </v-col>
        </v-row>

        <v-row>
          <v-col cols="6">
            <v-text-field
              v-model.number="formData.width"
              label="Width"
              type="number"
              min="64"
              max="2048"
              step="64"
              :rules="[v => v >= 64 && v <= 2048 && v % 64 === 0 || 'Width must be between 64 and 2048 and divisible by 64']"
            />
          </v-col>
          <v-col cols="6">
            <v-text-field
              v-model.number="formData.height"
              label="Height"
              type="number"
              min="64"
              max="2048"
              step="64"
              :rules="[v => v >= 64 && v <= 2048 && v % 64 === 0 || 'Height must be between 64 and 2048 and divisible by 64']"
            />
          </v-col>
        </v-row>

        <v-row>
          <v-col cols="6">
            <v-select
              v-model="formData.sampler_name"
              :items="samplers"
              label="Sampler"
              :rules="[v => !!v || 'Sampler is required']"
              required
              :loading="!samplers.length"
            />
          </v-col>
          <v-col cols="6">
            <v-text-field
              v-model.number="formData.batch_size"
              label="Batch Size"
              type="number"
              min="1"
              max="8"
              :rules="[v => v >= 1 && v <= 8 || 'Batch size must be between 1 and 8']"
            />
          </v-col>
        </v-row>

        <v-divider class="my-4" />
        <h3 class="text-h6 mb-2">Hiresfix Settings</h3>

        <v-row>
          <v-col cols="6">
            <v-text-field
              v-model.number="formData.hr_resize_x"
              label="Target Width"
              type="number"
              min="64"
              max="2048"
              step="64"
              :rules="[v => !v || (v >= 64 && v <= 2048 && v % 64 === 0) || 'Width must be between 64 and 2048 and divisible by 64']"
            />
          </v-col>
          <v-col cols="6">
            <v-text-field
              v-model.number="formData.hr_resize_y"
              label="Target Height"
              type="number"
              min="64"
              max="2048"
              step="64"
              :rules="[v => !v || (v >= 64 && v <= 2048 && v % 64 === 0) || 'Height must be between 64 and 2048 and divisible by 64']"
            />
          </v-col>
        </v-row>

        <v-row>
          <v-col cols="6">
            <v-text-field
              v-model.number="formData.hr_second_pass_steps"
              label="Hires Steps"
              type="number"
              min="1"
              :rules="[v => !v || v > 0 || 'Steps must be greater than 0']"
            />
          </v-col>
          <v-col cols="6">
            <v-select
              v-model="formData.hr_upscaler"
              :items="hrUpscalers"
              label="Hires Upscaler"
              :rules="[v => !v || !!v || 'Upscaler is required']"
            />
          </v-col>
        </v-row>

        <v-row>
          <v-col cols="12">
            <v-text-field
              v-model.number="formData.hr_denoising_strength"
              label="Hires Denoising Strength"
              type="number"
              min="0"
              max="1"
              step="0.01"
              :rules="[v => !v || (v >= 0 && v <= 1) || 'Denoising strength must be between 0 and 1']"
              hint="Lower values preserve more details, higher values allow more changes"
              persistent-hint
            />
          </v-col>
        </v-row>

        <!-- Upscale Settings -->
        <v-divider class="my-4" />
        <h3 class="text-h6 mb-2">Upscale Settings</h3>

        <v-row>
          <v-col cols="6">
            <v-text-field
              v-model.number="formData.upscale_tile_overlap"
              label="Tile Overlap"
              type="number"
              min="0"
              max="256"
              step="8"
              :rules="[v => v >= 0 && v <= 256 || 'Tile overlap must be between 0 and 256']"
              hint="Higher values reduce seams but increase processing time"
              persistent-hint
            />
          </v-col>
          <v-col cols="6">
            <v-text-field
              v-model.number="formData.upscale_scale_factor"
              label="Scale Factor"
              type="number"
              min="1"
              max="4"
              step="0.1"
              :rules="[v => v >= 1 && v <= 4 || 'Scale factor must be between 1 and 4']"
            />
          </v-col>
        </v-row>

        <v-row>
          <v-col cols="6">
            <v-select
              v-model="formData.upscale_upscaler"
              :items="upscalers"
              label="Upscaler"
              :rules="[v => !!v || 'Upscaler is required']"
            />
          </v-col>
          <v-col cols="6">
            <v-text-field
              v-model.number="formData.upscale_denoising_strength"
              label="Denoising Strength"
              type="number"
              min="0"
              max="1"
              step="0.01"
              :rules="[v => v >= 0 && v <= 1 || 'Denoising strength must be between 0 and 1']"
              hint="Lower values preserve more details"
              persistent-hint
            />
          </v-col>
        </v-row>
      </v-card-text>

      <v-card-actions>
        <v-spacer />
        <v-btn
          color="error"
          variant="text"
          @click="handleCancel"
          :disabled="loading"
        >
          Cancel
        </v-btn>
        <v-btn
          color="primary"
          type="submit"
          :loading="loading"
        >
          {{ isEditing ? 'Update' : 'Save' }}
        </v-btn>
      </v-card-actions>
    </v-form>
  </v-card>
</template>
