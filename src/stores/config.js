import { defineStore } from 'pinia';
import { useWebSocketStore } from './websocket';

export const useConfigStore = defineStore('config', {
  state: () => ({
    configs: [],
    models: [],
    samplers: [],
    upscalers: [],
    latentModes: [],
    loading: false,
    error: null,
  }),

  getters: {
    getConfigByName: (state) => (name) =>
      state.configs.find(c => c.name === name),

    isNameUnique: (state) => (name, excludeConfig = null) => {
      const existing = state.configs.find(c => c.name === name);
      return !existing || (excludeConfig && existing.name === excludeConfig.name);
    },

    hrUpscalers: (state) => [
      ...state.latentModes.map(m => m.name),
      ...state.upscalers.map(u => u.name),
    ],
  },

  actions: {
    async loadModelOptions() {
      const wsStore = useWebSocketStore();
      try {
        this.loading = true;
        const response = await wsStore.sendRequest('getModels');
        this.models = response.map(model => model.model_name);
      } catch (error) {
        console.error('Error loading models:', error);
        this.error = error.message;
        throw error;
      } finally {
        this.loading = false;
      }
    },

    async loadSamplerOptions() {
      const wsStore = useWebSocketStore();
      try {
        this.loading = true;
        const response = await wsStore.sendRequest('getSamplers');
        this.samplers = response.map(sampler => sampler.name);
      } catch (error) {
        console.error('Error loading samplers:', error);
        this.error = error.message;
        throw error;
      } finally {
        this.loading = false;
      }
    },

    async loadUpscalerOptions() {
      const wsStore = useWebSocketStore();
      try {
        this.loading = true;
        const [latentModes, upscalers] = await Promise.all([
          wsStore.sendRequest('getLatentUpscaleModes'),
          wsStore.sendRequest('getUpscalers'),
        ]);
        this.latentModes = latentModes.map(mode => ({ name: mode.name }));
        this.upscalers = upscalers.map(upscaler => ({ name: upscaler.name }));
      } catch (error) {
        console.error('Error loading upscalers:', error);
        this.error = error.message;
        throw error;
      } finally {
        this.loading = false;
      }
    },

    async getDefaultConfig() {
      const wsStore = useWebSocketStore();
      try {
        this.loading = true;
        return await wsStore.sendRequest('getDefaultConfig');
      } catch (error) {
        console.error('Error getting default config:', error);
        this.error = error.message;
        throw error;
      } finally {
        this.loading = false;
      }
    },

    async fetchConfigs() {
      const wsStore = useWebSocketStore();
      this.loading = true;
      this.error = null;

      try {
        const configs = await wsStore.sendRequest('getConfigs');
        this.configs = Array.isArray(configs) ? configs : [];
      } catch (error) {
        console.error('Error fetching configs:', error);
        this.error = error.message;
        throw error;
      } finally {
        this.loading = false;
      }
    },

    async addConfig(config) {
      const wsStore = useWebSocketStore();
      this.loading = true;
      try {
        const newConfig = await wsStore.sendRequest('addConfig', config);
        this.configs.push(newConfig);
        return newConfig;
      } catch (error) {
        console.error('Error adding config:', error);
        this.error = error.message;
        throw error;
      } finally {
        this.loading = false;
      }
    },

    async updateConfig(config) {
      const wsStore = useWebSocketStore();
      this.loading = true;
      try {
        const updatedConfig = await wsStore.sendRequest('updateConfig', {
          name: config.name,
          config,
        });
        const index = this.configs.findIndex(c => c.name === config.name);
        if (index !== -1) {
          this.configs[index] = updatedConfig;
        }
        return updatedConfig;
      } catch (error) {
        console.error('Error updating config:', error);
        this.error = error.message;
        throw error;
      } finally {
        this.loading = false;
      }
    },

    async deleteConfig(name) {
      const wsStore = useWebSocketStore();
      this.loading = true;
      try {
        await wsStore.sendRequest('deleteConfig', { name });
        const index = this.configs.findIndex(c => c.name === name);
        if (index !== -1) {
          this.configs.splice(index, 1);
        }
      } catch (error) {
        console.error('Error deleting config:', error);
        this.error = error.message;
        throw error;
      } finally {
        this.loading = false;
      }
    },
  },
});
