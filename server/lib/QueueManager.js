import { v4 as uuidv4 } from 'uuid';
import logger from './logger.js';

export class QueueManager {
  constructor(auto1111Client, imageManager, webSocketManager) {
    this.auto1111 = auto1111Client;
    this.imageManager = imageManager;
    this.webSocketManager = webSocketManager;
    this.activeConfigs = new Map();
    this.configQueue = [];
    this.priorityQueue = [];
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
    if (this.processing) {
      return;
    }

    try {
      this.processing = true;

      // Process priority tasks (like upscales) first
      if (this.priorityQueue.length > 0) {
        const task = this.priorityQueue.shift();
        await this.processPriorityTask(task);
        return;
      }

      // Process continuous configs if no priority tasks
      if (this.configQueue.length > 0) {
        const configId = this.configQueue[0];
        const configEntry = this.activeConfigs.get(configId);

        if (!configEntry) {
          this.configQueue.shift();
          return;
        }

        logger.info('Processing config: %s', configEntry.config.config.name);
        await this.processGeneration(configEntry);

        // Move to end of queue for round-robin
        this.configQueue.shift();
        this.configQueue.push(configId);
      }
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
    this.configQueue.push(configId);

    this.broadcastQueueUpdate();
    return configEntry;
  }

  async removeConfig(configId) {
    if (!this.activeConfigs.has(configId)) {
      throw new Error(`Config ${configId} not found`);
    }

    const configEntry = this.activeConfigs.get(configId);
    configEntry.status = 'stopped';

    // Broadcast the stopped status before removing
    this.broadcastConfigUpdate(configEntry);

    this.activeConfigs.delete(configId);
    const queueIndex = this.configQueue.indexOf(configId);
    if (queueIndex !== -1) {
      this.configQueue.splice(queueIndex, 1);
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
      configQueueLength: this.configQueue.length,
      priorityQueueLength: this.priorityQueue.length,
      processing: this.processing,
    };
  }

  async processGeneration(configEntry) {
    try {
      configEntry.status = 'processing';
      this.broadcastConfigUpdate(configEntry);

      if (configEntry.config.config.model) {
        await this.auto1111.setModel(configEntry.config.config.model);
      }

      // Generate the images
      const result = await this.auto1111.txt2img({
        ...configEntry.config.config,
      });

      // Process and save images using the correct config path
      const savedPaths = await this.imageManager.saveImages(
        configEntry.config.config.name,
        result.images,
      );

      // Update stats
      configEntry.completedRuns++;
      configEntry.status = 'active';
      configEntry.lastRun = Date.now();
      configEntry.lastImages = savedPaths;

      // Broadcast job completion with saved images
      this.webSocketManager.broadcastJobCompleted({
        id: configEntry.id,
        config: configEntry.config,  // Maintain nested config structure
        images: savedPaths,
        timestamp: Date.now(),
      });

      this.broadcastConfigUpdate(configEntry);

    } catch (error) {
      configEntry.failedRuns++;
      configEntry.status = 'active';
      configEntry.lastError = error.message;

      logger.error('Error in generation:', {
        configId: configEntry.id,
        error: error.message,
        config: configEntry.config,
      });

      this.broadcastConfigUpdate(configEntry);
    }
  }

  broadcastConfigUpdate(configEntry) {
    this.webSocketManager.broadcastConfigUpdate(configEntry.id, {
      id: configEntry.id,
      configId: configEntry.id,
      status: configEntry.status,
      completedRuns: configEntry.completedRuns,
      failedRuns: configEntry.failedRuns,
      lastRun: configEntry.lastRun,
      lastError: configEntry.lastError,
      lastImages: configEntry.lastImages,
      config: configEntry.config,  // Include the full config
    });
  }

  async queueUpscale(imagePath, config) {
    const taskId = uuidv4();
    const task = {
      id: taskId,
      type: 'upscale',
      imagePath,
      config,
      addedAt: Date.now(),
    };

    this.priorityQueue.push(task);
    this.broadcastQueueUpdate();
    return task;
  }

  async processPriorityTask(task) {
    try {
      if (task.type === 'upscale') {
        const result = await this.auto1111.upscale({
          image_path: task.imagePath,
          ...task.config,
        });

        const savedPaths = await this.imageManager.saveImages(
          'upscaled',
          result.images,
        );

        this.webSocketManager.broadcast({
          type: 'upscaleComplete',
          data: {
            taskId: task.id,
            images: savedPaths,
            timestamp: Date.now(),
          },
        });
      }
    } catch (error) {
      logger.error('Error processing priority task:', {
        taskId: task.id,
        type: task.type,
        error: error.message,
      });

      this.webSocketManager.broadcast({
        type: 'taskError',
        data: {
          taskId: task.id,
          error: error.message,
        },
      });
    }
  }
}
