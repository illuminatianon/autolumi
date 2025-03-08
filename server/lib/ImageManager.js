import fs from 'fs/promises';
import path from 'path';

export class ImageManager {
  constructor(dataDir) {
    this.outputDir = path.join(dataDir, 'output');
  }

  async initialize() {
    try {
      await fs.mkdir(this.outputDir, { recursive: true });
    } catch (error) {
      console.error('Error initializing image manager:', error);
      throw error;
    }
  }

  async ensureJobDirectory(jobName) {
    const jobDir = path.join(this.outputDir, jobName);
    await fs.mkdir(jobDir, { recursive: true });
    return jobDir;
  }

  async saveImage(jobName, imageData, index) {
    try {
      console.log('Saving image:', {
        jobName,
        imageDataType: typeof imageData,
        imageDataLength: imageData?.length
      });

      if (!imageData) {
        throw new Error('No image data provided');
      }

      const jobDir = await this.ensureJobDirectory(jobName);
      const fileName = `${String(index).padStart(5, '0')}.png`;
      const filePath = path.join(jobDir, fileName);

      // Auto1111 returns raw base64 strings, so we need to convert them to buffers
      const imageBuffer = Buffer.from(imageData, 'base64');
      await fs.writeFile(filePath, imageBuffer);

      // Return the relative path from the output directory
      return path.join(jobName, fileName);
    } catch (error) {
      console.error('Error saving image:', error);
      throw error;
    }
  }

  async saveImages(jobName, images) {
    console.log('Saving images:', {
      jobName,
      imagesLength: images?.length,
      firstImageType: images?.[0] ? typeof images[0] : 'undefined'
    });

    if (!Array.isArray(images) || images.length === 0) {
      console.warn('No images to save');
      return [];
    }

    const savedPaths = [];
    for (let i = 0; i < images.length; i++) {
      const relativePath = await this.saveImage(jobName, images[i], i);
      savedPaths.push(relativePath);
    }
    return savedPaths;
  }

  getImageUrl(relativePath) {
    return `/output/${relativePath}`;
  }
}
