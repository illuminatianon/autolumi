import axios from 'axios';

class GenerationService {
  constructor() {
    this.client = axios.create({
      baseURL: 'http://localhost:3001/api/generation'
    });
  }

  async queueGeneration(config) {
    try {
      // Ensure hires.fix parameters are properly set
      const generationConfig = {
        ...config,
        enable_hr: true,
        hr_second_pass_steps: config.hr_second_pass_steps || config.steps,
        hr_upscaler: config.hr_upscaler || 'R-ESRGAN 4x+',
        denoising_strength: config.denoising_strength ?? 0.7,
      };

      const response = await this.client.post('/txt2img', generationConfig);
      return response.data;
    } catch (error) {
      console.error('Error queueing generation:', error);
      throw error;
    }
  }

  async getJobStatus(jobId) {
    try {
      const response = await this.client.get(`/job/${jobId}`);
      return response.data;
    } catch (error) {
      console.error('Error getting job status:', error);
      throw error;
    }
  }

  async getQueueStatus() {
    try {
      const response = await this.client.get('/queue');
      return response.data;
    } catch (error) {
      console.error('Error getting queue status:', error);
      throw error;
    }
  }

  async queueUpscale(imagePath, config) {
    try {
      const response = await this.client.post('/upscale', {
        imagePath,
        config,
      });
      return response.data;
    } catch (error) {
      console.error('Error queueing upscale:', error);
      throw error;
    }
  }
}

export default new GenerationService();

export async function upscaleImage(imagePath, config) {
  const response = await fetch('/api/generation/upscale', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      imagePath,
      config,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to upscale image');
  }

  return response.json();
}
