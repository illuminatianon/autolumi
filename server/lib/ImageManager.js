import path from 'path';
import fs from 'fs';

export class ImageManager {
  constructor(outputDir) {
    this.outputDir = outputDir;
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

  async getNextImageNumber() {
    try {
      const files = await fs.promises.readdir(this.outputDir);
      if (files.length === 0) return 1;

      const numbers = files
        .filter(f => f.endsWith('.png'))
        .map(f => parseInt(f.split('.')[0], 10))
        .filter(n => !isNaN(n));

      return numbers.length > 0 ? Math.max(...numbers) + 1 : 1;
    } catch (error) {
      console.error('Failed to read job directory:', error);
      return 1;
    }
  }

  async saveImage(jobName, imageData) {
    if (!imageData) {
      throw new Error('Image data is required');
    }
    try {
      const jobDir = await this.ensureJobDirectory(jobName);
      const nextNum = await this.getNextImageNumber();
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
    const savedPaths = [];

    // Create job directory
    const jobDir = path.join(this.outputDir, jobName);
    await fs.promises.mkdir(jobDir, { recursive: true });

    for (let i = 0; i < images.length; i++) {
      try {
        // Get next number synchronously for this batch
        const number = String(i + 1).padStart(5, '0');
        const filename = `${number}.png`;
        const filePath = path.join(jobDir, filename);

        // Save the image
        await this.saveBase64Image(images[i], filePath);

        // Get file info
        const stats = await fs.promises.stat(filePath);
        savedPaths.push({
          path: path.join(jobName, filename), // Relative path
          date: stats.mtime.getTime(),
          name: filename
        });
      } catch (error) {
        console.error(`Error saving image ${i} for job ${jobName}:`, error);
      }
    }

    return savedPaths;
  }

  async saveBase64Image(base64Data, filePath) {
    const imageData = base64Data.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(imageData, 'base64');
    await fs.promises.writeFile(filePath, buffer);
  }

  getImageUrl(relativePath) {
    return `/output/${relativePath}`;
  }
}
