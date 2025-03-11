export const DEFAULT_GENERATION_PARAMS = {
  steps: 25,
  sampler_name: 'Euler a',
  cfg_scale: 10,
  width: 512,
  height: 512,
  batch_size: 1,
  save_images: false,
  prompt: '',
  negative_prompt: '',
  scheduler: 'Automatic',
  // Hires.fix defaults
  hr_resize_x: 0,
  hr_resize_y: 0,
  hr_denoising_strength: 0.7,
  hr_second_pass_steps: 20,
  hr_upscaler: '',
  // Upscale defaults
  upscale_tile_overlap: 64,
  upscale_scale_factor: 2.5,
  upscale_upscaler: '',
  upscale_denoising_strength: 0.15,
};
