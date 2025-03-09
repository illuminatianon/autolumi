import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import sharp from 'sharp';
import logger from './logger.js';

export class QueueManager {
  constructor(auto1111Client, imageManager) {
    this.auto1111 = auto1111Client;
    this.imageManager = imageManager;
    this.generationQueue = [];
    this.priorityQueue = []; // For upscale jobs
    this.currentJob = null;
    this.isProcessing = false;
    this.jobs = new Map();
    this.queue = [];
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
        const jobId = this.queue.shift();
        logger.info('Processing job:', jobId);
        await this.processJob(jobId);
      } catch (error) {
        logger.error('Error processing job:', error);
      } finally {
        this.processing = false;
      }
    }, 1000);
  }

  async addJob(job) {
    const jobId = uuidv4();
    const newJob = {
      id: jobId,
      status: 'pending',
      ...job,
    };

    this.jobs.set(jobId, newJob);
    this.queue.push(jobId);

    return newJob;
  }

  getJobStatus(jobId) {
    return this.jobs.get(jobId);
  }

  getQueueStatus() {
    return {
      currentJob: this.currentJob,
      priorityQueueLength: this.priorityQueue.length,
      generationQueueLength: this.generationQueue.length,
      jobs: Array.from(this.jobs.values()),
    };
  }

  async processNextJob() {
    if (!this.isProcessing || this.currentJob) return;

    // Priority queue (upscale jobs) takes precedence
    const jobId = this.queue.shift() || this.generationQueue.shift();
    if (!jobId) {
      // No jobs to process, check again in a second
      setTimeout(() => this.processNextJob(), 1000);
      return;
    }

    this.currentJob = jobId;
    await this.processJob(jobId);
  }

  async processJob(jobId) {
    const job = this.jobs.get(jobId);
    if (!job) {
      logger.error(`Job ${jobId} not found`);
      throw new Error(`Job ${jobId} not found`);
    }

    try {
      job.status = 'processing';

      switch (job.type) {
        case 'txt2img':
          await this.processGenerationJob(job);
          break;
        case 'upscale':
          await this.processUpscaleJob(job);
          break;
        default:
          throw new Error(`Unknown job type: ${job.type}`);
      }

      job.status = 'completed';
    } catch (error) {
      logger.error(`Error processing job ${jobId}:`, error);
      job.status = 'failed';
      job.error = error.message;
    } finally {
      // Clean up completed/failed jobs after a delay
      setTimeout(() => {
        this.jobs.delete(jobId);
      }, 5 * 60 * 1000); // Keep job status for 5 minutes

      // Continue processing if still running
      if (this.isProcessing) {
        await this.processNextJob();  // Added await here
      }
    }
  }

  async processUpscaleJob(job) {
    try {
      // Extract the job name from the image path correctly
      // From something like: "C:/path/to/data/output/jobname/00001.png"
      const pathParts = job.imagePath.split(path.sep);
      const jobNameIndex = pathParts.indexOf('output') + 1;
      const jobName = pathParts[jobNameIndex];

      logger.info('Processing upscale job:', {
        originalPath: job.imagePath,
        extractedJobName: jobName,
      });

      const imageBuffer = await fs.promises.readFile(job.imagePath);
      const metadata = await getImageMetadata(job.imagePath);

      const base64Image = imageBuffer.toString('base64');
      const upscaleRequest = {
        init_images: [base64Image],
        script_name: 'SD upscale',
        script_args: [
          null,
          job.config.upscale_tile_overlap || 64,
          job.config.upscale_upscaler || '4x-UltraSharp',
          job.config.upscale_scale_factor || 2.5,
        ],
        denoising_strength: job.config.upscale_denoising_strength || 0.15,
        prompt: metadata.prompt,
        negative_prompt: metadata.negative_prompt,
        steps: 20,
        cfg_scale: 7,
        width: 512,
        height: 512,
        restore_faces: false,
        sampler_name: 'Euler a',
      };

      logger.info('Upscale request:', {
        ...upscaleRequest,
        init_images: ['<base64 data omitted>'],
        prompt: upscaleRequest.prompt,
        negative_prompt: upscaleRequest.negative_prompt,
      });

      // Process the upscale
      const result = await this.auto1111.img2img(upscaleRequest);

      if (!result.images?.[0]) {
        throw new Error('No image returned from upscale operation');
      }

      // Save the upscaled image using the ImageManager
      const [savedPath] = await this.imageManager.saveImages('upscaled', [result.images[0]]);

      // Update job with result
      job.upscaledPath = savedPath;
    } catch (error) {
      logger.error('Error in upscale processing:', error);
      throw error;
    }
  }

  async processGenerationJob(job) {
    try {
      // Set the model if specified
      if (job.config.model) {
        await this.auto1111.setModel(job.config.model);
      }

      // Generate the images
      const result = await this.auto1111.txt2img({
        ...job.config,
      });

      // Skip the grid image if this was a batch generation
      const images = job.config.batch_size > 100 ? result.images.slice(1) : result.images;
      // Save images and update job
      job.images = await this.imageManager.saveImages(job.config.name, images);

      // convert job.images to URLs by adding THE SERVER URL
      job.images = job.images.map(imagePath => `/data/output/${imagePath.replace(/\\/g, '/')}`);

      logger.info('Generation job completed:', {
        jobId: job.id,
        numImages: images.length,
        savedPaths: job.images,
      });

      return job;
    } catch (error) {
      logger.error('Error in generation:', error);
      throw error;
    }
  }

  async removeJob(jobId) {
    const job = this.jobs.get(jobId);
    if (!job) {
      throw new Error(`Job ${jobId} not found`);
    }

    // If this is the currently processing job, we can't cancel it
    if (this.currentJob === jobId) {
      throw new Error('Cannot cancel currently processing job');
    }

    // Remove from jobs map
    this.jobs.delete(jobId);

    // Remove from queue
    const queueIndex = this.queue.indexOf(jobId);
    if (queueIndex !== -1) {
      this.queue.splice(queueIndex, 1);
    }

    // Remove from generation queue if present
    const genQueueIndex = this.generationQueue.indexOf(jobId);
    if (genQueueIndex !== -1) {
      this.generationQueue.splice(genQueueIndex, 1);
    }

    // Remove from priority queue if present
    const priorityQueueIndex = this.priorityQueue.indexOf(jobId);
    if (priorityQueueIndex !== -1) {
      this.priorityQueue.splice(priorityQueueIndex, 1);
    }

    logger.info(`Removed job ${jobId} from queue`);
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
