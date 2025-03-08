/**
 * @typedef {Object} Txt2ImgParams
 * @property {string} prompt - The main prompt for image generation
 * @property {string} [negative_prompt] - Things to avoid in the generation
 * @property {number} [steps=20] - Number of sampling steps
 * @property {string} [sampler_name="Euler a"] - Name of the sampler to use
 * @property {number} [cfg_scale=7] - CFG scale factor
 * @property {number} [batch_size=1] - Number of images to generate
 * @property {number} [width=512] - Image width
 * @property {number} [height=512] - Image height
 * @property {boolean} [save_images=false] - Whether to save images on the server
 */

/**
 * @typedef {Object} Img2ImgParams
 * @property {string} prompt - The main prompt for image generation
 * @property {string} [negative_prompt] - Things to avoid in the generation
 * @property {string} init_images - Array of base64 encoded images
 * @property {number} [denoising_strength=0.75] - How much to modify the image
 * @property {string} [sampler_name="Euler a"] - Name of the sampler to use
 * @property {number} [steps=20] - Number of sampling steps
 * @property {number} [cfg_scale=7] - CFG scale factor
 * @property {boolean} [save_images=false] - Whether to save images on the server
 */

/**
 * @typedef {Object} UpscaleParams
 * @property {string} image - Base64 encoded image
 * @property {string} upscaler_1 - Name of the upscaler to use
 * @property {number} [upscaling_resize=2] - Scale factor
 * @property {boolean} [save_images=false] - Whether to save images on the server
 */

export const DEFAULT_TXT2IMG_PARAMS = {
  steps: 25,
  sampler_name: "Euler a",
  cfg_scale: 10,
  width: 512,
  height: 512,
  batch_size: 1,
  save_images: false,
  prompt: '',
  negative_prompt: '',
  // Hires.fix defaults
  hr_resize_x: 0,
  hr_resize_y: 0,
  hr_denoising_strength: 0.7,
  hr_second_pass_steps: 20,
  hr_upscaler: '',  // Will be set from available upscalers
  // Upscale defaults
  upscale_tile_overlap: 64,
  upscale_scale_factor: 2.5,
  upscale_upscaler: '',  // Will be set from available upscalers
  upscale_denoising_strength: 0.15,
};

export const DEFAULT_IMG2IMG_PARAMS = {
  steps: 25,
  sampler_name: "Euler a",
  cfg_scale: 7,
  denoising_strength: 0.75,
  save_images: false
};

export const DEFAULT_UPSCALE_PARAMS = {
  upscaling_resize: 2,
  save_images: false
};
