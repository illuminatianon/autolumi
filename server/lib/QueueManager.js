import { v4 as uuidv4 } from 'uuid';
import sharp from 'sharp';
import logger from './logger.js';

export class QueueManager {
  constructor(auto1111Client, imageManager, webSocketManager) {
    this.auto1111 = auto1111Client;
    this.imageManager = imageManager;
    this.webSocketManager = webSocketManager;
    this.activeConfigs = new Map(); // Stores running configs by ID
    this.queue = [];                // Array of config IDs in order
    this.processing = false;
    this.interval = null;
  }

  start() {
    if (this.interval) return;
    logger.info('Starting queue manager');

    this.interval = setInterval(async () => {
      if (this.processing || this.queue.length === 0) return;

      try {
        this.processing = true;
        const configId = this.queue.shift(); // Get next config from queue
        const config = this.activeConfigs.get(configId);

        if (config) {
          await this.processGeneration(config);
          // Put it back at the end of the queue
          this.queue.push(configId);
        }
      } catch (error) {
        logger.error('Error processing generation:', error);
      } finally {
        this.processing = false;
      }
    }, 1000);
  }

  async addConfig(config) {
    const configEntry = {
      id: uuidv4(),
      status: 'active',
      config,
      addedAt: Date.now(),
      lastRun: null,
      completedRuns: 0,
      failedRuns: 0,
    };

    this.activeConfigs.set(configEntry.id, configEntry);
    this.queue.push(configEntry.id);

    this.broadcastQueueUpdate();
    return configEntry;
  }

  removeConfig(configId) {
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

  async processGeneration(configEntry) {
    try {
      configEntry.status = 'processing';
      this.broadcastQueueUpdate();

      // Set the model if specified
      if (configEntry.config.model) {
        await this.auto1111.setModel(configEntry.config.model);
      }

      // Generate the images
      const result = await this.auto1111.txt2img({
        ...configEntry.config,
      });

      // Skip the grid image if this was a batch generation
      const images = configEntry.config.batch_size > 100 ?
        result.images.slice(1) :
        result.images;

      // Save images
      const savedPaths = await this.imageManager.saveImages(
        configEntry.config.name,
        images,
      );

      // Update stats
      configEntry.completedRuns++;
      configEntry.status = 'active';
      configEntry.lastImages = savedPaths.map(path =>
        `/data/output/${path.replace(/\\/g, '/')}`,
      );

      logger.info({
        configId: configEntry.id,
        configName: configEntry.config.name,
        imagesGenerated: images.length,
        totalRuns: configEntry.completedRuns,
      }, 'Generation completed');

      configEntry.status = 'active';
      this.broadcastQueueUpdate();

    } catch (error) {
      configEntry.failedRuns++;
      configEntry.status = 'active'; // Keep active even if it failed
      configEntry.lastError = error.message;
      this.broadcastQueueUpdate();

      logger.error({
        configId: configEntry.id,
        configName: configEntry.config.name,
        error: error.message,
      }, 'Generation failed');
    }
  }

  getQueueStatus() {
    // Convert activeConfigs to jobs array with the expected structure
    const jobs = Array.from(this.activeConfigs.values()).map(config => ({
      id: config.id,
      status: this.processing && this.queue[0] === config.id ? 'processing' : 'pending',
      config: {
        name: config.config.name,
        // Include other necessary config fields
      },
      error: config.lastError,
      timestamp: config.lastRun || config.addedAt,
      images: config.lastImages || [],
    }));

    return {
      jobs,
      completedJobs: [], // If you want to track completed jobs separately
    };
  }

  broadcastQueueUpdate() {
    const status = this.getQueueStatus();
    this.webSocketManager.broadcast('queueUpdate', status);
  }
}

async function getImageMetadata(imagePath) {
  try {
    const metadata = await sharp(imagePath).metadata();

    // Find the parameters comment
    const parameters = metadata.comments?.find(c => c.keyword === 'parameters')?.text;

    if (parameters) {
      const parts = parameters.split('\nNegative prompt:');
      return {
        prompt: parts[0].trim(),
        negative_prompt: parts[1] ? parts[1].split('\n')[0].trim() : '',
      };
    }

    return { prompt: '', negative_prompt: '' };
  } catch (error) {
    return { prompt: '', negative_prompt: '' };
  }
}
