import { defineStore } from 'pinia';
import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:3001/api'
});

export const useConfigStore = defineStore('config', {
  state: () => ({
    configs: [],
    loading: false,
    error: null
  }),

  actions: {
    async fetchConfigs() {
      this.loading = true;
      try {
        const response = await api.get('/config/generation');
        this.configs = response.data;
      } catch (error) {
        console.error('Error fetching configs:', error);
        this.error = error.message;
      } finally {
        this.loading = false;
      }
    },

    async addConfig(config) {
      this.loading = true;
      try {
        const response = await api.post('/config/generation', config);
        this.configs.push(response.data);
        return response.data;
      } catch (error) {
        console.error('Error adding config:', error);
        this.error = error.response?.data?.error || error.message;
        throw error;
      } finally {
        this.loading = false;
      }
    },

    async updateConfig(config) {
      this.loading = true;
      try {
        const response = await api.put(`/config/generation/${config.name}`, config);
        const index = this.configs.findIndex(c => c.name === config.name);
        if (index !== -1) {
          this.configs[index] = response.data;
        }
        return response.data;
      } catch (error) {
        console.error('Error updating config:', error);
        this.error = error.response?.data?.error || error.message;
        throw error;
      } finally {
        this.loading = false;
      }
    },

    async deleteConfig(config) {
      this.loading = true;
      try {
        await api.delete(`/config/generation/${config.name}`);
        const index = this.configs.findIndex(c => c.name === config.name);
        if (index !== -1) {
          this.configs.splice(index, 1);
        }
      } catch (error) {
        console.error('Error deleting config:', error);
        this.error = error.response?.data?.error || error.message;
        throw error;
      } finally {
        this.loading = false;
      }
    },

    getConfigByName(name) {
      return this.configs.find(c => c.name === name);
    },

    clearError() {
      this.error = null;
    }
  },

  persist: true
});
