<template>
  <v-card :loading="loading">
    <v-card-title>
      <span v-if="isEditing">Edit Configuration</span>
      <span v-else>New Configuration</span>
    </v-card-title>

    <v-form @submit.prevent="handleSubmit" ref="form">
      <v-card-text>
        <v-text-field v-model="formData.name" label="Configuration Name"
          :rules="[v => !!v || 'Name is required', validateUniqueName]" required />

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

        <v-textarea v-model="formData.prompt" label="Prompt" :rules="[v => !!v || 'Prompt is required']" required
          rows="3" />

        <v-textarea v-model="formData.negative_prompt" label="Negative Prompt" rows="2" />

        <v-row>
          <v-col cols="6">
            <v-text-field v-model.number="formData.steps" label="Steps" type="number" min="1" max="150"
              :rules="[v => v >= 1 && v <= 150 || 'Steps must be between 1 and 150']" />
          </v-col>
          <v-col cols="6">
            <v-text-field v-model.number="formData.cfg_scale" label="CFG Scale" type="number" min="1" max="30" step="0.5"
              :rules="[v => v >= 1 && v <= 30 || 'CFG Scale must be between 1 and 30']" />
          </v-col>
        </v-row>

        <v-row>
          <v-col cols="6">
            <v-text-field v-model.number="formData.width" label="Width" type="number" min="64" max="2048" step="64"
              :rules="[v => v >= 64 && v <= 2048 && v % 64 === 0 || 'Width must be between 64 and 2048 and divisible by 64']" />
          </v-col>
          <v-col cols="6">
            <v-text-field v-model.number="formData.height" label="Height" type="number" min="64" max="2048" step="64"
              :rules="[v => v >= 64 && v <= 2048 && v % 64 === 0 || 'Height must be between 64 and 2048 and divisible by 64']" />
          </v-col>
        </v-row>

        <v-row>
          <v-col cols="6">
            <v-select v-model="formData.sampler_name" :items="samplers" label="Sampler"
              :rules="[v => !!v || 'Sampler is required']" required :loading="!samplers.length" />
          </v-col>
          <v-col cols="6">
            <v-text-field v-model.number="formData.batch_size" label="Batch Size" type="number" min="1" max="8"
              :rules="[v => v >= 1 && v <= 8 || 'Batch size must be between 1 and 8']" />
          </v-col>
        </v-row>

        <!-- Hires.fix Settings -->
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
              :rules="[v => v >= 64 && v <= 2048 && v % 64 === 0 || 'Width must be between 64 and 2048 and divisible by 64']"
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
              :rules="[v => v >= 64 && v <= 2048 && v % 64 === 0 || 'Height must be between 64 and 2048 and divisible by 64']"
            />
          </v-col>
        </v-row>

        <v-row>
          <v-col cols="12">
            <v-text-field
              v-model.number="formData.denoising_strength"
              label="Denoising Strength"
              type="number"
              min="0"
              max="1"
              step="0.01"
              :rules="[v => v >= 0 && v <= 1 || 'Denoising strength must be between 0 and 1']"
              hint="Lower values preserve more details, higher values allow more changes"
              persistent-hint
            />
          </v-col>
        </v-row>
      </v-card-text>

      <v-card-actions>
        <v-spacer />
        <v-btn color="error" variant="text" @click="handleCancel" :disabled="loading">
          Cancel
        </v-btn>
        <v-btn color="primary" type="submit" :loading="loading">
          {{ isEditing ? 'Update' : 'Save' }}
        </v-btn>
      </v-card-actions>
    </v-form>
  </v-card>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useConfigStore } from '@/stores/config';
import { DEFAULT_TXT2IMG_PARAMS } from '@/services/auto1111/types';
import auto1111Service from '@/services/auto1111/service';

const props = defineProps({
  config: {
    type: Object,
    default: () => null
  }
});

const emit = defineEmits(['save', 'error', 'cancel']);

const configStore = useConfigStore();
const form = ref(null);
const loading = ref(false);
const isEditing = computed(() => !!props.config);
const samplers = ref([]);
const models = ref([]);
const upscalers = ref([
  'Latent',
  'Latent (antialiased)',
  'Latent (bicubic)',
  'Latent (bicubic antialiased)',
  'Latent (nearest)',
  'Latent (nearest-exact)',
  'None',
  'Lanczos',
  'Nearest',
  'ESRGAN_4x',
  'R-ESRGAN 4x+',
  'R-ESRGAN 4x+ Anime6B'
]);

const defaultForm = {
  name: '',
  model: '',
  ...DEFAULT_TXT2IMG_PARAMS,
  prompt: '',
  negative_prompt: '',
  // Hires.fix defaults - enable_hr will be set to true when sending to API
  hr_resize_x: 0,
  hr_resize_y: 0,
  denoising_strength: 0.7
};

const formData = ref({ ...defaultForm });

const validateUniqueName = (value) => {
  if (!value) return true;
  const existing = configStore.getConfigByName(value);
  if (existing && (!props.config || existing.name !== props.config.name)) {
    return 'Configuration name must be unique';
  }
  return true;
};

const resetForm = () => {
  if (isEditing.value) {
    formData.value = { ...props.config };
  } else {
    formData.value = { ...defaultForm };
  }
  form.value?.resetValidation();
};

const handleSubmit = async () => {
  const { valid } = await form.value.validate();

  if (valid) {
    loading.value = true;
    try {
      emit('save', { ...formData.value });
    } catch (error) {
      emit('error', error);
    } finally {
      loading.value = false;
    }
  }
};

const handleCancel = () => {
  emit('cancel');
};

onMounted(async () => {
  loading.value = true;
  try {
    await auto1111Service.initialize();
    samplers.value = auto1111Service.getAvailableSamplers().map(s => s.name);
    models.value = auto1111Service.getAvailableModels().map(m => ({
      title: m.model_name,
      model_name: m.model_name
    }));
  } catch (error) {
    emit('error', error);
  } finally {
    loading.value = false;
  }

  if (props.config) {
    formData.value = { ...props.config };
  }
});
</script>
