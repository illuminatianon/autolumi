export class QueueManager {
  constructor(auto1111Client, imageManager) {
    this.auto1111 = auto1111Client;
    this.imageManager = imageManager;
    this.generationQueue = [];
    this.upscaleQueue = [];
    this.isProcessing = false;
    this.jobs = new Map(); // Store all jobs by ID
  }

  addGenerationJob(config) {
    const job = {
      id: Date.now().toString(),
      type: 'generation',
      config,
      status: 'pending',
      result: null,
      images: [],
      error: null,
      timestamp: new Date()
    };
    this.generationQueue.push(job);
    this.jobs.set(job.id, job);
    return job;
  }

  addUpscaleJob(image, config) {
    const job = {
      id: Date.now().toString(),
      type: 'upscale',
      image,
      config,
      status: 'pending',
      result: null,
      images: [],
      error: null,
      timestamp: new Date()
    };
    this.upscaleQueue.push(job);
    this.jobs.set(job.id, job);
    return job;
  }

  async processNextJob() {
    if (this.isProcessing) return;

    let job = null;
    try {
      this.isProcessing = true;

      // Priority: process upscale jobs first
      job = this.upscaleQueue.shift() || this.generationQueue.shift();
      if (!job) {
        this.isProcessing = false;
        return;
      }

      job.status = 'processing';

      if (job.type === 'upscale') {
        console.log('Starting upscale...');
        const result = await this.auto1111.img2img({
          ...job.config,
          init_images: [job.image]
        });
        console.log('Upscale result structure:', Object.keys(result));

        // Save upscaled image
        if (result?.images?.length > 0) {
          console.log('Got upscale images, count:', result.images.length);
          console.log('First image type:', typeof result.images[0]);
          console.log('First image length:', result.images[0]?.length);
          job.images = await this.imageManager.saveImages(
            `${job.config.name}_upscaled`,
            result.images
          );
          job.result = result;
        } else {
          throw new Error('No images returned from upscale');
        }
      } else {
        console.log('Starting txt2img generation...');
        const result = await this.auto1111.txt2img(job.config);
        console.log('txt2img result structure:', Object.keys(result));

        // Save generated images
        if (result?.images?.length > 0) {
          console.log('Got generated images, count:', result.images.length);
          console.log('First image type:', typeof result.images[0]);
          console.log('First image length:', result.images[0]?.length);
          job.images = await this.imageManager.saveImages(
            job.config.name,
            result.images
          );
          job.result = result;
          console.log('Images saved:', job.images);
        } else {
          console.log('No images in result:', result);
          throw new Error('No images returned from generation');
        }
      }

      job.status = 'completed';
    } catch (error) {
      console.error('Job processing error:', error);
      if (job) {
        job.status = 'failed';
        job.error = error.message;
      }
    } finally {
      this.isProcessing = false;

      // Clean up old completed/failed jobs after 5 minutes
      if (job && ['completed', 'failed'].includes(job.status)) {
        setTimeout(() => {
          this.jobs.delete(job.id);
        }, 5 * 60 * 1000);
      }
    }
  }

  start() {
    // Process queue every 1 second
    setInterval(() => this.processNextJob(), 1000);
  }

  getJobStatus(jobId) {
    return this.jobs.get(jobId);
  }

  getQueueStatus() {
    const jobs = Array.from(this.jobs.values());
    return {
      generation: jobs.filter(j => j.type === 'generation' && j.status === 'pending').length,
      upscale: jobs.filter(j => j.type === 'upscale' && j.status === 'pending').length,
      processing: jobs.filter(j => j.status === 'processing').length,
      completed: jobs.filter(j => j.status === 'completed').length,
      failed: jobs.filter(j => j.status === 'failed').length,
      isProcessing: this.isProcessing
    };
  }
}
