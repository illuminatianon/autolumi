import path from 'path';
import fs from 'fs';

export class ImageManager {
  constructor() {
    // Move up one level from server directory to project root
    const projectRoot = path.join(process.cwd(), '..');
    this.outputDir = path.join(projectRoot, 'data', 'output');
  }

  async initialize() {
    // Ensure output directory exists on startup
    try {
      await fs.promises.mkdir(this.outputDir, { recursive: true });
      console.log('Output directory initialized:', this.outputDir);
    } catch (err) {
      console.error('Failed to create output directory:', err);
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
      console.error('Failed to create job directory:', error);
      throw new Error(`Failed to create directory for job ${jobName}: ${error.message}`);
    }
  }

  async getNextFileNumber(jobDir) {
    try {
      const files = await fs.promises.readdir(jobDir);
      const numbers = files
        .map(f => parseInt(f.split('.')[0]))
        .filter(n => !isNaN(n));
      return numbers.length ? Math.max(...numbers) + 1 : 0;
    } catch (error) {
      console.error('Failed to read job directory:', error);
      return 0;
    }
  }

  async saveImage(jobName, imageData) {
    if (!imageData) {
      throw new Error('Image data is required');
    }
    try {
      const jobDir = await this.ensureJobDirectory(jobName);
      const nextNum = await this.getNextFileNumber(jobDir);
      const filename = `${nextNum.toString().padStart(5, '0')}.png`;
      const filePath = path.join(jobDir, filename);
      await fs.promises.writeFile(filePath, Buffer.from(imageData, 'base64'));
      return path.relative(this.outputDir, filePath);
    } catch (error) {
      console.error('Failed to save image:', error);
      throw new Error(`Failed to save image for job ${jobName}: ${error.message}`);
    }
  }

  async saveImages(jobName, images) {
    if (!Array.isArray(images)) {
      throw new Error('Images must be an array');
    }
    const paths = [];
    for (const imageData of images) {
      const path = await this.saveImage(jobName, imageData);
      paths.push(path);
    }
    return paths;
  }

  getImageUrl(relativePath) {
    return `/output/${relativePath}`;
  }
}
