import { defineStore } from 'pinia';
import { useWebSocketStore } from './websocket';

export const useConfigStore = defineStore('config', {
  state: () => ({
    configs: [],
    loading: false,
    error: null,
  }),

  getters: {
    getConfigByName: (state) => (name) =>
      state.configs.find(c => c.name === name),
  },

  actions: {
    async fetchConfigs() {
      const wsStore = useWebSocketStore();
      this.loading = true;
      try {
        const configs = await wsStore.sendRequest('getConfigs');
        this.configs = configs;
      } catch (error) {
        console.error('Error fetching configs:', error);
        this.error = error.message;
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
