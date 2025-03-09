import path from 'path';
import fs from 'fs';
import logger from './logger.js';

export class ImageManager {
  constructor(outputDir) {
    this.outputDir = outputDir;
  }

  async initialize() {
    // Ensure output directory exists on startup
    try {
      await fs.promises.mkdir(this.outputDir, { recursive: true });
      logger.info('Output directory initialized:', this.outputDir);
    } catch (err) {
      logger.error('Failed to create output directory:', err);
      throw err;
    }
  }

  async ensureJobDirectory(jobName) {
    if (!jobName) {
      throw new Error('Job name is required');
    }
    const jobDir = path.join(this.outputDir, jobName);
    try {
      await fs.promises.mkdir(jobDir, { recursive: true });
      return jobDir;
    } catch (error) {
      logger.error('Failed to create job directory:', error);
      throw new Error(`Failed to create directory for job ${jobName}: ${error.message}`);
    }
  }

  async getNextImageNumber(jobDir) {
    try {
      // Read all files in the job directory
      const files = await fs.promises.readdir(jobDir);

      // Filter for PNG files and extract numbers
      const numbers = files
        .filter(f => f.endsWith('.png'))
        .map(f => parseInt(f.slice(0, 5), 10)) // Get first 5 digits
        .filter(n => !isNaN(n));

      // Return count + 1, or 0 if no files
      return numbers.length > 0 ? numbers.length + 1 : 0;
    } catch (error) {
      if (error.code === 'ENOENT') {
        // Directory doesn't exist yet, start at 1
        return 0;
      }
      logger.error('Failed to read job directory:', error);
      throw error;
    }
  }

  async saveImage(jobName, imageData) {
    if (!imageData) {
      throw new Error('Image data is required');
    }
    try {
      const jobDir = await this.ensureJobDirectory(jobName);
      const nextNum = await this.getNextImageNumber(jobDir);
      const filename = `${nextNum.toString().padStart(5, '0')}.png`;
      const filePath = path.join(jobDir, filename);
      await fs.promises.writeFile(filePath, Buffer.from(imageData, 'base64'));
      return path.relative(this.outputDir, filePath);
    } catch (error) {
      logger.error('Failed to save image: %o', {
        error: error.message,
        jobName,
        stack: error.stack,
        code: error.code,
      });
      throw new Error(`Failed to save image for job ${jobName}: ${error.message}`);
    }
  }

  async saveImages(jobName, images) {
    const savedPaths = [];

    for (let i = 0; i < images.length; i++) {
      const savedPath = await this.saveImage(jobName, images[i]);
      savedPaths.push(savedPath);
    }
    return savedPaths;
  }
}
