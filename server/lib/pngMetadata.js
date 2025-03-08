import { PNG } from 'pngjs';

export async function getPngMetadata(buffer) {
  return new Promise((resolve, reject) => {
    const png = new PNG();

    png.parse(buffer, (error, data) => {
      if (error) {
        console.error('PNG parsing error:', error);
        resolve({ prompt: '', negative_prompt: '' });
        return;
      }

      try {
        // Check if text chunks exist at all
        if (!png.text || !png.text.parameters) {
          console.log('No text metadata found in PNG');
          resolve({ prompt: '', negative_prompt: '' });
          return;
        }

        const parameters = png.text;
        console.log('Found PNG parameters:', parameters);

        // Parse the parameters string
        const parts = parameters.split('\nNegative prompt: ');
        const prompt = parts[0].trim();
        const negative_prompt = parts[1] ? parts[1].split('\n')[0].trim() : '';

        resolve({
          prompt,
          negative_prompt,
        });
      } catch (err) {
        console.error('Error parsing PNG metadata:', err);
        resolve({ prompt: '', negative_prompt: '' });
      }
    });
  });
}
