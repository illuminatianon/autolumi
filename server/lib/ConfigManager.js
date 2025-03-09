import fs from 'fs/promises';
import path from 'path';
import logger from './logger.js';
import { v4 as uuidv4 } from 'uuid';

export class ConfigManager {
  constructor(dataDir) {
    this.configPath = path.join(dataDir, 'generation-configs.json');
  }

  async initialize() {
    try {
      await fs.access(this.configPath);
    } catch {
      // File doesn't exist, create it with empty configs
      await this.saveConfigs([]);
    }
  }

  async loadConfigs() {
    try {
      const data = await fs.readFile(this.configPath, 'utf8');
      const configs = JSON.parse(data);
      // Ensure each config has an id
      return configs.map(config => ({
        id: config.id || uuidv4(),
        ...config,
      }));
    } catch (error) {
      logger.error('Error loading configs:', error);
      return [];
    }
  }

  async saveConfigs(configs) {
    try {
      await fs.writeFile(this.configPath, JSON.stringify(configs, null, 2), 'utf8');
    } catch (error) {
      logger.error('Error saving configs:', error);
      throw new Error('Failed to save configurations');
    }
  }

  async addConfig(config) {
    const configs = await this.loadConfigs();
    if (configs.some(c => c.name === config.name)) {
      throw new Error(`Configuration "${config.name}" already exists`);
    }
    const configWithId = {
      id: config.id || uuidv4(),
      ...config,
    };
    configs.push(configWithId);
    await this.saveConfigs(configs);
    return configWithId;
  }

  async updateConfig(config) {
    const configs = await this.loadConfigs();
    const index = configs.findIndex(c => c.id === config.id);
    if (index === -1) {
      throw new Error(`Configuration "${config.name}" not found`);
    }
    configs[index] = config;
    await this.saveConfigs(configs);
    return config;
  }

  async deleteConfig(name) {
    const configs = await this.loadConfigs();
    const index = configs.findIndex(c => c.name === name);
    if (index === -1) {
      throw new Error(`Configuration "${name}" not found`);
    }
    configs.splice(index, 1);
    await this.saveConfigs(configs);
  }

  async getAllConfigs() {
    return this.loadConfigs();
  }
}
