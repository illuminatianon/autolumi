import { defineStore } from 'pinia';
import { useWebSocketStore } from './websocket';

export const useConfigStore = defineStore('config', {
  state: () => ({
    configs: [],
    models: [],
    samplers: [],
    upscalers: [],
    latentModes: [],
    schedulers: [],
    loading: false,
    error: null,
  }),

  getters: {
    getConfigByName: (state) => (name) =>
      state.configs.find(c => c.name === name),

    getConfigById: (state) => (id) =>
      state.configs.find(c => c.id === id),

    isNameUnique: (state) => (name, excludeConfig = null) => {
      const existing = state.configs.find(c =>
        c.name === name && (!excludeConfig || c.id !== excludeConfig.id),
      );
      return !existing;
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

    async loadSchedulerOptions() {
      const wsStore = useWebSocketStore();
      try {
        this.loading = true;
        const response = await wsStore.sendRequest('getSchedulers');
        this.schedulers = response.map(scheduler => ({
          name: scheduler.name,
          title: scheduler.label || scheduler.name,
        }));
      } catch (error) {
        console.error('Error loading schedulers:', error);
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
        console.log('Fetching configurations...');
        const configs = await wsStore.sendRequest('getConfigs');
        console.log('Received configurations:', configs);

        if (Array.isArray(configs)) {
          // Ensure each config has an id
          this.configs = configs.map(config => ({
            id: config.id || crypto.randomUUID(),
            ...config,
          }));
        } else {
          console.error('Received invalid configs format:', configs);
          this.configs = [];
        }
      } catch (error) {
        console.error('Error fetching configs:', error);
        this.error = error.message;
        this.configs = [];
        throw error;
      } finally {
        this.loading = false;
      }
    },

    async addConfig(config) {
      const wsStore = useWebSocketStore();
      this.loading = true;
      try {
        const configWithId = {
          id: crypto.randomUUID(),
          ...config,
        };
        const newConfig = await wsStore.sendRequest('addConfig', configWithId);
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
        const updatedConfig = await wsStore.sendRequest('updateConfig', config);
        const index = this.configs.findIndex(c => c.id === config.id);
        if (index !== -1) {
          // Use Vue's reactivity system properly
          this.configs[index] = { ...updatedConfig };
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

    async deleteConfig(config) {
      const wsStore = useWebSocketStore();
      this.loading = true;
      try {
        await wsStore.sendRequest('deleteConfig', { name: config.name });
        const index = this.configs.findIndex(c => c.id === config.id);
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

    async loadOptions() {
      await Promise.all([
        this.loadModelOptions(),
        this.loadSamplerOptions(),
        this.loadUpscalerOptions(),
        this.loadSchedulerOptions(),
      ]);
    },
  },
});
