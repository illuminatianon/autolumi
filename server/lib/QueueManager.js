import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { getPngMetadata } from './pngMetadata.js';
import { PNG } from 'pngjs';
import sharp from 'sharp';

export class QueueManager {
  constructor(auto1111Client, imageManager) {
    this.auto1111 = auto1111Client;
    this.imageManager = imageManager;
    this.generationQueue = [];
    this.priorityQueue = []; // For upscale jobs
    this.currentJob = null;
    this.jobMap = new Map(); // Track all jobs by ID
    this.isProcessing = false;
    this.jobs = new Map();
    this.queue = [];
    this.processing = false;
    this.interval = null;
  }

  start() {
    if (this.interval) return;
    console.log('Starting queue manager');

    this.interval = setInterval(async () => {
      if (this.processing || this.queue.length === 0) return;

      try {
        this.processing = true;
        const jobId = this.queue.shift();
        console.log('Processing job:', jobId);
        await this.processJob(jobId);
      } catch (error) {
        console.error('Error processing job:', error);
      } finally {
        this.processing = false;
      }
    }, 1000);
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  async addJob(job) {
    const jobId = uuidv4();
    const newJob = {
      id: jobId,
      status: 'pending',
      ...job
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
      console.error(`Error processing job ${jobId}:`, error);
      job.status = 'failed';
      job.error = error.message;
    } finally {
      // Clean up completed/failed jobs after a delay
      setTimeout(() => {
        this.jobs.delete(jobId);
      }, 5 * 60 * 1000); // Keep job status for 5 minutes

      // Continue processing if still running
      if (this.isProcessing) {
        this.processNextJob();
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

      console.log('Processing upscale job:', {
        originalPath: job.imagePath,
        extractedJobName: jobName
      });

      const imageBuffer = await fs.promises.readFile(job.imagePath);
      const metadata = await getImageMetadata(job.imagePath);
      console.log('Extracted metadata:', metadata);

      const base64Image = imageBuffer.toString('base64');
      const upscaleRequest = {
        init_images: [base64Image],
        script_name: "SD upscale",
        script_args: [
          null,
          job.config.upscale_tile_overlap || 64,
          job.config.upscale_upscaler || "4x-UltraSharp",
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
        sampler_name: "Euler a"
      };

      console.log('Upscale request:', {
        ...upscaleRequest,
        init_images: ['<base64 data omitted>'],
        prompt: upscaleRequest.prompt,
        negative_prompt: upscaleRequest.negative_prompt
      });

      // Process the upscale
      const result = await this.auto1111.img2img(upscaleRequest);

      if (!result.images?.[0]) {
        throw new Error('No image returned from upscale operation');
      }

      console.log('Upscale successful, saving result...');

      // Save the upscaled image using the ImageManager
      const [savedPath] = await this.imageManager.saveImages('upscaled', [result.images[0]]);
      console.log('Upscaled image saved to:', savedPath);

      // Update job with result
      job.upscaledPath = savedPath;
    } catch (error) {
      console.error('Error in upscale processing:', error);
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
        save_images: true,
      });

      // Skip the grid image if this was a batch generation
      const images = job.config.batch_size > 1 ? result.images.slice(1) : result.images;

      // Save images and update job
      const savedImages = await this.imageManager.saveImages(job.config.name, images);

      // Make sure we're returning the paths as strings
      job.images = savedImages.map(img => img.path);

      console.log('Generation job completed:', {
        jobId: job.id,
        numImages: images.length,
        savedPaths: job.images
      });

      return job;
    } catch (error) {
      console.error('Error in generation:', error);
      throw error;
    }
  }
}

async function getImageMetadata(imagePath) {
  try {
    const metadata = await sharp(imagePath).metadata();
    console.log('Image metadata:', metadata);

    // Find the parameters comment
    const parameters = metadata.comments?.find(c => c.keyword === 'parameters')?.text;

    if (parameters) {
      console.log('Found parameters:', parameters);
      const parts = parameters.split('\nNegative prompt:');
      return {
        prompt: parts[0].trim(),
        negative_prompt: parts[1] ? parts[1].split('\n')[0].trim() : ''
      };
    }

    console.log('No parameters found in image metadata');
    return { prompt: '', negative_prompt: '' };
  } catch (error) {
    console.error('Error reading image metadata:', error);
    return { prompt: '', negative_prompt: '' };
  }
}
