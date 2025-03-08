import fs from 'fs/promises';
import path from 'path';

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
      return JSON.parse(data);
    } catch (error) {
      console.error('Error loading configs:', error);
      return [];
    }
  }

  async saveConfigs(configs) {
    try {
      await fs.writeFile(this.configPath, JSON.stringify(configs, null, 2), 'utf8');
    } catch (error) {
      console.error('Error saving configs:', error);
      throw new Error('Failed to save configurations');
    }
  }

  async addConfig(config) {
    const configs = await this.loadConfigs();
    if (configs.some(c => c.name === config.name)) {
      throw new Error(`Configuration "${config.name}" already exists`);
    }
    configs.push(config);
    await this.saveConfigs(configs);
    return config;
  }

  async updateConfig(config) {
    const configs = await this.loadConfigs();
    const index = configs.findIndex(c => c.name === config.name);
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
