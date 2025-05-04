import { v4 as uuidv4 } from 'uuid';
import logger from './logger.js';

export class JobManager {
  constructor(auto1111Client, imageManager, webSocketManager) {
    this.auto1111 = auto1111Client;
    this.imageManager = imageManager;
    this.webSocketManager = webSocketManager;

    // Main job tracking
    this.activeJobs = new Map(); // All active jobs (generation and upscale)
    this.upscaleQueue = [];      // Queue only for upscale tasks

    // Processing state
    this.processing = false;
    this.currentJobId = null;
    this.interval = null;
  }

  start() {
    if (this.interval) return;
    logger.info('Starting job processor');
    this.interval = setInterval(() => this.processJobs(), 1000);
  }

  stop() {
    if (!this.interval) return;
    clearInterval(this.interval);
    this.interval = null;
    logger.info('Stopped job processor');
  }

  async getServerStatus() {
    const auto1111Status = await this.auto1111.checkHealth();
    return {
      status: 'ok',
      auto1111Status: {
        connected: auto1111Status.status === 'ok',
        status: auto1111Status.status,
        version: auto1111Status.version,
      },
      jobStatus: {
        activeJobs: Array.from(this.activeJobs.values()).map(job => ({
          id: job.id,
          type: job.type,
          name: job.config?.name || 'Upscale Task',
          status: job.status,
          progress: job.progress || 0,
          startedAt: job.startedAt,
          completedAt: job.completedAt,
          error: job.error,
        })),
        currentJobId: this.currentJobId,
        processing: this.processing,
        upscaleQueueLength: this.upscaleQueue.length,
      },
    };
  }

  async addGenerationJob(config) {
    if (!config.id) throw new Error('Configuration must have an ID');

    const jobId = config.id;
    const job = {
      id: jobId,
      type: 'generation',
      status: 'queued',
      config,
      addedAt: Date.now(),
      startedAt: null,
      completedAt: null,
      completedRuns: 0,
      failedRuns: 0,
      lastImages: null,
      error: null,
    };

    this.activeJobs.set(jobId, job);
    this.broadcastJobUpdate(job);
    return job;
  }

  async addUpscaleJob(imagePath, config) {
    const jobId = uuidv4();
    const job = {
      id: jobId,
      type: 'upscale',
      status: 'queued',
      imagePath,
      config,
      addedAt: Date.now(),
      startedAt: null,
      completedAt: null,
      error: null,
    };

    this.activeJobs.set(jobId, job);
    this.upscaleQueue.push(jobId);
    this.broadcastJobUpdate(job);
    return job;
  }

  async removeJob(jobId) {
    const job = this.activeJobs.get(jobId);
    if (!job) throw new Error(`Job ${jobId} not found`);

    // Remove from active jobs
    this.activeJobs.delete(jobId);

    // Remove from upscale queue if present
    if (job.type === 'upscale') {
      const queueIndex = this.upscaleQueue.indexOf(jobId);
      if (queueIndex !== -1) {
        this.upscaleQueue.splice(queueIndex, 1);
      }
    }

    // Broadcast removal
    this.webSocketManager.broadcast({
      type: 'jobRemoved',
      data: { jobId, type: job.type },
    });

    // Broadcast updated status
    this.broadcastServerStatus();
  }

  async processJobs() {
    if (this.processing) return;

    try {
      this.processing = true;

      // Process upscale jobs first
      if (this.upscaleQueue.length > 0) {
        const jobId = this.upscaleQueue[0];
        const job = this.activeJobs.get(jobId);
        if (job) {
          this.currentJobId = jobId;
          await this.processUpscaleJob(job);
          this.upscaleQueue.shift();
        }
        return;
      }

      // Process generation jobs
      const generationJobs = Array.from(this.activeJobs.values())
        .filter(job => job.type === 'generation' && job.status === 'queued');

      if (generationJobs.length > 0) {
        const job = generationJobs[0];
        this.currentJobId = job.id;
        await this.processGenerationJob(job);
      }

    } catch (error) {
      logger.error('Error processing jobs:', error);
    } finally {
      this.processing = false;
      this.currentJobId = null;
      this.broadcastServerStatus();
    }
  }

  async processGenerationJob(job) {
    try {
      job.status = 'processing';
      job.startedAt = Date.now();
      this.broadcastJobUpdate(job);

      if (job.config.model) {
        await this.auto1111.setModel(job.config.model);
      }

      const result = await this.auto1111.txt2img(job.config);
      const savedPaths = await this.imageManager.saveImages(
        job.config.name,
        result.images,
      );

      job.completedRuns++;
      job.status = 'completed';
      job.completedAt = Date.now();
      job.lastImages = savedPaths;

      this.broadcastJobUpdate(job);

    } catch (error) {
      job.failedRuns++;
      job.status = 'failed';
      job.error = error.message;
      job.completedAt = Date.now();

      logger.error('Generation job failed:', {
        jobId: job.id,
        error: error.message,
      });

      this.broadcastJobUpdate(job);
    }
  }

  async processUpscaleJob(job) {
    try {
      job.status = 'processing';
      job.startedAt = Date.now();
      this.broadcastJobUpdate(job);

      const metadata = await this.imageManager.readImageMetadata(job.imagePath);
      const result = await this.auto1111.img2img({
        init_images: [job.imagePath],
        prompt: metadata.prompt || '',
        negative_prompt: metadata.negative_prompt || '',
        script_name: 'SD upscale',
        script_args: [
          job.config.upscale_upscaler || '',
          job.config.upscale_scale_factor || 2.0,
          job.config.upscale_denoising_strength || 0.15,
          job.config.upscale_tile_overlap || 64,
        ],
      });

      const savedPaths = await this.imageManager.saveImages('upscaled', result.images);

      job.status = 'completed';
      job.completedAt = Date.now();
      job.outputPaths = savedPaths;

      this.broadcastJobUpdate(job);

    } catch (error) {
      job.status = 'failed';
      job.error = error.message;
      job.completedAt = Date.now();

      logger.error('Upscale job failed:', {
        jobId: job.id,
        error: error.message,
      });

      this.broadcastJobUpdate(job);
    }
  }

  broadcastJobUpdate(job) {
    this.webSocketManager.broadcast({
      type: 'jobUpdate',
      data: job,
    });
    this.broadcastServerStatus();
  }

  broadcastServerStatus() {
    this.getServerStatus().then(status => {
      this.webSocketManager.broadcast({
        type: 'serverStatus',
        data: status,
      });
    });
  }
}
