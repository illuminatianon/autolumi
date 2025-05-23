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
    if (!config.id) {
      throw new Error('Configuration must have an ID');
    }

    const configEntry = {
      id: config.id,  // Use the persistent ID from the saved config
      status: 'active',
      config,
      addedAt: Date.now(),
      lastRun: null,
      completedRuns: 0,
      failedRuns: 0,
    };

    this.activeConfigs.set(config.id, configEntry);
    this.configQueue.push(config.id);

    this.broadcastQueueUpdate();
    return configEntry;
  }

  async removeConfig(configId) {
    if (!this.activeConfigs.has(configId)) {
      throw new Error(`Configuration ${configId} not found in active configs`);
    }

    this.activeConfigs.delete(configId);

    // Remove from queue if present
    const queueIndex = this.configQueue.indexOf(configId);
    if (queueIndex !== -1) {
      this.configQueue.splice(queueIndex, 1);
    }

    // Broadcast the removal to ensure UI updates
    this.webSocketManager.broadcastConfigUpdate(configId, {
      id: configId,
      status: 'stopped',
      removed: true,  // Add a flag to indicate complete removal
    });

    // Broadcast updated queue status
    this.broadcastQueueStatus();
  }

  broadcastQueueStatus() {
    const status = this.getQueueStatus();
    this.webSocketManager.broadcast({
      type: 'queueStatus',
      data: status,
    });
  }

  getQueueStatus() {
    // Filter only actually running or queued jobs
    const activeJobs = Array.from(this.activeConfigs.values())
      .filter(config => config.status === 'processing' || config.status === 'queued');

    return {
      jobs: activeJobs.map(config => ({
        id: config.id,
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
    if (!configEntry) return;

    this.webSocketManager.broadcastConfigUpdate(configEntry.id, {
      id: configEntry.id,
      configId: configEntry.id,
      status: configEntry.status,
      completedRuns: configEntry.completedRuns,
      failedRuns: configEntry.failedRuns,
      lastRun: configEntry.lastRun,
      lastError: configEntry.lastError,
      lastImages: configEntry.lastImages,
      config: configEntry.config,
    });

    // Also broadcast updated queue status
    this.broadcastQueueStatus();
  }

  // Keep temporary IDs for upscale tasks
  async queueUpscale(imagePath, config) {
    const taskId = uuidv4();  // Temporary ID for one-time task
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
        // Read image metadata to get prompts
        const metadata = await this.imageManager.readImageMetadata(task.imagePath);

        // Prepare img2img parameters with original prompts
        const img2imgParams = {
          init_images: [task.imagePath],
          prompt: metadata.prompt || '',
          negative_prompt: metadata.negative_prompt || '',
          script_name: 'SD upscale',
          script_args: [
            // Add upscale script parameters
            task.config.upscale_upscaler || '',
            task.config.upscale_scale_factor || 2.0,
            task.config.upscale_denoising_strength || 0.15,
            task.config.upscale_tile_overlap || 64,
          ],
        };

        const result = await this.auto1111.img2img(img2imgParams);

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
            metadata: {
              prompt: metadata.prompt,
              negative_prompt: metadata.negative_prompt,
            },
          },
        });
      }
    } catch (error) {
      logger.error('Error processing priority task:', {
        taskId: task.id,
        type: task.type,
        error: error.message,
        imagePath: task.imagePath,
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
