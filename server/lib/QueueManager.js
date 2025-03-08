import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { getPngMetadata } from './pngMetadata.js';  // We'll need to create this

export class QueueManager {
  constructor(auto1111Client, imageManager) {
    this.auto1111 = auto1111Client;
    this.imageManager = imageManager;
    this.generationQueue = [];
    this.priorityQueue = []; // For upscale jobs
    this.currentJob = null;
    this.jobMap = new Map(); // Track all jobs by ID
    this.isProcessing = false;
  }

  start() {
    console.log('Starting queue processor...');
    this.isProcessing = true;
    this.processNextJob();
  }

  stop() {
    console.log('Stopping queue processor...');
    this.isProcessing = false;
  }

  addGenerationJob(config) {
    const job = {
      id: uuidv4(),
      type: 'generation',
      status: 'pending',
      timestamp: new Date(),
      config,
      images: [],
    };

    this.generationQueue.push(job);
    this.jobMap.set(job.id, job);

    // Start processing if not already processing
    if (!this.currentJob) {
      this.processNextJob();
    }

    return job;
  }

  addUpscaleJob(imagePath, config) {
    const job = {
      id: uuidv4(),
      type: 'upscale',
      status: 'pending',
      timestamp: new Date(),
      imagePath,
      config,
    };

    this.priorityQueue.push(job);
    this.jobMap.set(job.id, job);

    // Start processing if not already processing
    if (!this.currentJob) {
      this.processNextJob();
    }

    return job;
  }

  getJobStatus(jobId) {
    return this.jobMap.get(jobId);
  }

  getQueueStatus() {
    return {
      currentJob: this.currentJob,
      priorityQueueLength: this.priorityQueue.length,
      generationQueueLength: this.generationQueue.length,
      jobs: Array.from(this.jobMap.values()),
    };
  }

  async processNextJob() {
    if (!this.isProcessing || this.currentJob) return;

    // Priority queue (upscale jobs) takes precedence
    const job = this.priorityQueue.shift() || this.generationQueue.shift();
    if (!job) {
      // No jobs to process, check again in a second
      setTimeout(() => this.processNextJob(), 1000);
      return;
    }

    this.currentJob = job;
    job.status = 'processing';

    try {
      if (job.type === 'upscale') {
        await this.processUpscaleJob(job);
      } else {
        await this.processGenerationJob(job);
      }
      job.status = 'completed';
    } catch (error) {
      console.error(`Error processing ${job.type} job:`, error);
      job.status = 'failed';
      job.error = error.message;
    } finally {
      this.currentJob = null;
      // Clean up completed/failed jobs after a delay
      setTimeout(() => {
        this.jobMap.delete(job.id);
      }, 5 * 60 * 1000); // Keep job status for 5 minutes

      // Continue processing if still running
      if (this.isProcessing) {
        this.processNextJob();
      }
    }
  }

  async processUpscaleJob(job) {
    try {
      // Read the image file and its metadata
      const imageBuffer = await fs.promises.readFile(job.imagePath);
      const metadata = await getPngMetadata(imageBuffer);

      console.log('Original image metadata:', {
        prompt: metadata.prompt,
        negative_prompt: metadata.negative_prompt
      });

      const base64Image = imageBuffer.toString('base64');

      // Prepare the upscale request
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
        // Use the original prompts from the PNG metadata
        prompt: metadata.prompt || "",
        negative_prompt: metadata.negative_prompt || "",
        steps: 20,
        cfg_scale: 7,
        width: 512,
        height: 512,
        restore_faces: false,
        sampler_name: "Euler a"
      };

      console.log('Starting upscale job with params:', {
        script_name: upscaleRequest.script_name,
        script_args: upscaleRequest.script_args,
        denoising_strength: upscaleRequest.denoising_strength,
        prompt: upscaleRequest.prompt,
        negative_prompt: upscaleRequest.negative_prompt
      });

      // Process the upscale
      const result = await this.auto1111.img2img(upscaleRequest);

      if (!result.images?.[0]) {
        throw new Error('No image returned from upscale operation');
      }

      console.log('Upscale successful, saving result...');

      // Extract the job name from the image path
      const normalizedPath = job.imagePath.replace(/\\/g, '/');
      const pathParts = normalizedPath.split('/');
      const jobName = pathParts[pathParts.indexOf('output') + 1];

      // Save the upscaled image using the ImageManager
      const [savedPath] = await this.imageManager.saveImages(jobName, [result.images[0]]);
      console.log('Upscaled image saved to:', savedPath);

      // Update job with result
      job.upscaledPath = savedPath;
    } catch (error) {
      console.error('Error in upscale processing:', error);
      throw error;
    }
  }

  async processGenerationJob(job) {
    // Set the model if specified
    if (job.config.model) {
      await this.auto1111.setModel(job.config.model);
    }

    // Generate the images
    const result = await this.auto1111.txt2img({
      ...job.config,
      save_images: true,
    });

    // Save images and update job
    job.images = await this.imageManager.saveImages(job.config.name, result.images);
  }
}
