import { v4 as uuidv4 } from 'uuid';
import logger from './logger.js';

export class QueueManager {
  constructor(auto1111Client, imageManager, webSocketManager) {
    this.auto1111 = auto1111Client;
    this.imageManager = imageManager;
    this.webSocketManager = webSocketManager;
    this.activeConfigs = new Map();
    this.queue = [];
    this.processing = false;
    this.interval = null;
  }

  start() {
    if (this.interval) {
      return;
    }

    logger.info('Starting queue processor');
    this.interval = setInterval(() => this.processQueue(), 1000);
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
      logger.info('Stopped queue processor');
    }
  }

  async processQueue() {
    if (this.processing || this.queue.length === 0) {
      return;
    }

    try {
      this.processing = true;
      const configId = this.queue[0];
      const configEntry = this.activeConfigs.get(configId);

      if (!configEntry) {
        this.queue.shift(); // Remove invalid config from queue
        return;
      }
      logger.info('Proessing config: %o', configEntry);

      await this.processGeneration(configEntry);

      // Move the config to the end of the queue for round-robin processing
      this.queue.shift();
      this.queue.push(configId);

    } catch (error) {
      logger.error('Error processing queue:', error);
    } finally {
      this.processing = false;
    }
  }

  async addConfig(config) {
    const configId = config.id || uuidv4();
    const configEntry = {
      id: configId,
      status: 'active',
      config,
      addedAt: Date.now(),
      lastRun: null,
      completedRuns: 0,
      failedRuns: 0,
    };

    this.activeConfigs.set(configId, configEntry);
    this.queue.push(configId);

    this.broadcastQueueUpdate();
    return configEntry;
  }

  async removeConfig(configId) {
    if (!this.activeConfigs.has(configId)) {
      throw new Error(`Config ${configId} not found`);
    }

    this.activeConfigs.delete(configId);
    const queueIndex = this.queue.indexOf(configId);
    if (queueIndex !== -1) {
      this.queue.splice(queueIndex, 1);
    }

    this.broadcastQueueUpdate();
    return true;
  }

  broadcastQueueUpdate() {
    const status = this.getQueueStatus();
    this.webSocketManager.broadcast({
      type: 'queueUpdate',
      data: status,
    });
  }

  getQueueStatus() {
    return {
      activeConfigs: Array.from(this.activeConfigs.entries()).map(([id, config]) => ({
        id,
        name: config.config.name,
        status: config.status,
        completedRuns: config.completedRuns,
        failedRuns: config.failedRuns,
        lastRun: config.lastRun,
      })),
      queueLength: this.queue.length,
      processing: this.processing,
    };
  }

  async processGeneration(configEntry) {
    try {
      configEntry.status = 'processing';
      this.broadcastConfigUpdate(configEntry);

      // Access the config directly without the extra nesting
      if (configEntry.config.model) {
        await this.auto1111.setModel(configEntry.config.model);
      }

      // Generate the images
      const result = await this.auto1111.txt2img({
        ...configEntry.config,
      });

      // Process and save images using the correct config path
      const savedPaths = await this.imageManager.saveImages(
        configEntry.config.name,
        result.images,
      );

      // Update stats
      configEntry.completedRuns++;
      configEntry.status = 'active';
      configEntry.lastRun = Date.now();
      configEntry.lastImages = savedPaths;

      this.broadcastConfigUpdate(configEntry);

    } catch (error) {
      configEntry.failedRuns++;
      configEntry.status = 'active';
      configEntry.lastError = error.message;

      logger.error('Error in generation:', {
        configId: configEntry.id,
        error: error.message,
        config: configEntry.config, // Log the config structure for debugging
      });

      this.broadcastConfigUpdate(configEntry);
    }
  }

  broadcastConfigUpdate(configEntry) {
    this.webSocketManager.broadcastConfigUpdate(configEntry.id, {
      configId: configEntry.id,
      status: configEntry.status,
      completedRuns: configEntry.completedRuns,
      failedRuns: configEntry.failedRuns,
      lastRun: configEntry.lastRun,
      lastError: configEntry.lastError,
      lastImages: configEntry.lastImages,
    });
  }
}
