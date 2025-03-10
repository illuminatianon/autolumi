import path from 'path';
import fs from 'fs';
import logger from './logger.js';
import sharp from 'sharp';

export class ImageManager {
  constructor(outputDir) {
    this.outputDir = outputDir;
  }

  async initialize() {
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
      const files = await fs.promises.readdir(jobDir);
      const numbers = files
        .filter(f => f.endsWith('.png'))
        .map(f => parseInt(f.slice(0, 5), 10))
        .filter(n => !isNaN(n));
      return numbers.length > 0 ? numbers.length + 1 : 0;
    } catch (error) {
      if (error.code === 'ENOENT') {
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

      // Return the URL path instead of the relative path
      return `/data/output/${jobName}/${filename}`;
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

  async readImageMetadata(imagePath) {
    try {
      // Read PNG metadata using sharp or another image processing library
      const metadata = await sharp(imagePath).metadata();

      // Extract parameters from PNG text chunks
      // This depends on how AUTO1111 stores the metadata
      // You might need to adjust this based on the actual format
      const parameters = metadata.parameters || '';

      // Parse the parameters string to extract prompts
      const prompt = parameters.split('Negative prompt:')[0].trim();
      const negative_prompt = parameters.split('Negative prompt:')[1]?.split('Steps:')[0]?.trim() || '';

      return {
        prompt,
        negative_prompt,
      };
    } catch (error) {
      logger.error('Failed to read image metadata:', error);
      return {
        prompt: '',
        negative_prompt: '',
      };
    }
  }
}
