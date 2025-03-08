import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { getPngMetadata } from './pngMetadata.js';
import { PNG } from 'pngjs';

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
      console.log('Reading image from:', job.imagePath);

      // Create a PNG instance and read the file properly
      const png = new PNG();
      const metadata = await new Promise((resolve, reject) => {
        let chunks = [];
        fs.createReadStream(job.imagePath)
          .pipe(new PNG({
            filterType: -1,
            checkCRC: false  // Might help with some PNGs
          }))
          .on('metadata', function(metadata) {
            console.log('PNG metadata event:', metadata);
          })
          .on('parsed', function() {
            console.log('PNG parsed, data:', {
              width: this.width,
              height: this.height,
              gamma: this.gamma,
              chunks: chunks
            });
          })
          .on('data', function(chunk) {
            chunks.push(chunk);
          })
          .on('end', function() {
            console.log('PNG chunks:', chunks.map(c => ({
              type: c.name,
              data: c.data?.toString()
            })));
          })
          .on('error', reject);
      });

      // Read the file for base64
      const imageBuffer = await fs.promises.readFile(job.imagePath);
      const base64Image = imageBuffer.toString('base64');

      // Prepare the upscale request with the metadata we found
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
        prompt: png.text?.parameters ? png.text.parameters.split('\nNegative prompt:')[0].trim() : "",
        negative_prompt: png.text?.parameters ?
          (png.text.parameters.includes('Negative prompt:') ?
            png.text.parameters.split('Negative prompt:')[1].split('\n')[0].trim() : "")
          : "",
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
      job.images = await this.imageManager.saveImages(job.config.name, images);
    } catch (error) {
      console.error('Error in generation:', error);
      throw error;
    }
  }
}

async function extractPngMetadata(buffer) {
  return new Promise((resolve, reject) => {
    const png = new PNG();
    png.parse(buffer, (error, data) => {
      if (error) {
        reject(error);
        return;
      }

      try {
        const parameters = png.text.parameters;
        if (!parameters) {
          resolve({ prompt: "", negative_prompt: "" });
          return;
        }

        const parts = parameters.split('\nNegative prompt: ');
        const prompt = parts[0].trim();
        const negative_prompt = parts[1] ? parts[1].split('\n')[0].trim() : "";

        resolve({
          prompt,
          negative_prompt
        });
      } catch (err) {
        reject(err);
      }
    });
  });
}
