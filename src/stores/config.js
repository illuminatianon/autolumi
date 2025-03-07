import { defineStore } from 'pinia';

export const useConfigStore = defineStore('config', {
  state: () => ({
    configs: [],
  }),

  actions: {
    addConfig(config) {
      const index = this.configs.findIndex(c => c.name === config.name);
      if (index !== -1) {
        throw new Error(`Configuration "${config.name}" already exists`);
      }
      this.configs.push(config);
    },

    updateConfig(config) {
      const index = this.configs.findIndex(c => c.name === config.name);
      if (index !== -1) {
        this.configs[index] = config;
      }
    },

    deleteConfig(config) {
      const index = this.configs.findIndex(c => c.name === config.name);
      if (index !== -1) {
        this.configs.splice(index, 1);
      }
    },

    getConfigByName(name) {
      return this.configs.find(c => c.name === name);
    }
  },

  persist: true
});
