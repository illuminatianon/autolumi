export class QueueManager {
  constructor(auto1111Client) {
    this.auto1111 = auto1111Client;
    this.generationQueue = [];
    this.upscaleQueue = [];
    this.isProcessing = false;
  }

  addGenerationJob(config) {
    const job = {
      id: Date.now().toString(),
      type: 'generation',
      config,
      status: 'pending',
      result: null,
      error: null,
      timestamp: new Date()
    };
    this.generationQueue.push(job);
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
      error: null,
      timestamp: new Date()
    };
    this.upscaleQueue.push(job);
    return job;
  }

  async processNextJob() {
    if (this.isProcessing) return;

    try {
      this.isProcessing = true;

      // Priority: process upscale jobs first
      const job = this.upscaleQueue.shift() || this.generationQueue.shift();
      if (!job) {
        this.isProcessing = false;
        return;
      }

      job.status = 'processing';

      if (job.type === 'upscale') {
        job.result = await this.auto1111.img2img({
          ...job.config,
          init_images: [job.image]
        });
      } else {
        job.result = await this.auto1111.txt2img(job.config);
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
    }
  }

  start() {
    // Process queue every 1 second
    setInterval(() => this.processNextJob(), 1000);
  }

  getJobStatus(jobId) {
    return [...this.generationQueue, ...this.upscaleQueue].find(job => job.id === jobId);
  }

  getQueueStatus() {
    return {
      generation: this.generationQueue.length,
      upscale: this.upscaleQueue.length,
      isProcessing: this.isProcessing
    };
  }
}
