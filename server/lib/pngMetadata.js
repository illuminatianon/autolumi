import { PNG } from 'pngjs';

export async function getPngMetadata(buffer) {
  return new Promise((resolve, reject) => {
    const png = new PNG();

    png.parse(buffer, (error, data) => {
      if (error) {
        reject(error);
        return;
      }

      try {
        // Auto1111 stores the parameters in the "parameters" tEXt chunk
        const parameters = png.text.parameters;
        if (!parameters) {
          resolve({ prompt: "", negative_prompt: "" });
          return;
        }

        // Parse the parameters string
        // Format is typically: prompt\nNegative prompt: negative_prompt\nSteps: ...
        const parts = parameters.split('\nNegative prompt: ');
        const prompt = parts[0].trim();
        const negative_prompt = parts[1] ? parts[1].split('\n')[0].trim() : "";

        resolve({
          prompt,
          negative_prompt
        });
      } catch (err) {
        reject(err);
      }
    });
  });
}
