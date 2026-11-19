type Box = { x: number; y: number; w: number; h: number };

function prepare(image: ImageBitmap, box: Box, targetWidth: number, contrast: boolean): Promise<Blob> {
  const sx = Math.max(0, Math.round(image.width * box.x));
  const sy = Math.max(0, Math.round(image.height * box.y));
  const sw = Math.max(1, Math.min(image.width - sx, Math.round(image.width * box.w)));
  const sh = Math.max(1, Math.min(image.height - sy, Math.round(image.height * box.h)));
  const scale = targetWidth / sw;
  const canvas = document.createElement("canvas");
  canvas.width = targetWidth;
  canvas.height = Math.max(40, Math.round(sh * scale));
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return Promise.reject(new Error("The photo couldn’t be prepared."));
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(image, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  if (contrast) {
    const frame = context.getImageData(0, 0, canvas.width, canvas.height);
    const { data } = frame;
    let min = 255;
    let max = 0;
    for (let index = 0; index < data.length; index += 4) {
      const value = Math.round(0.299 * (data[index] ?? 0) + 0.587 * (data[index + 1] ?? 0) + 0.114 * (data[index + 2] ?? 0));
      data[index] = value;
      if (value < min) min = value;
      if (value > max) max = value;
    }
    const span = Math.max(1, max - min);
    for (let index = 0; index < data.length; index += 4) {
      const value = Math.round((((data[index] ?? 0) - min) * 255) / span);
      data[index] = value;
      data[index + 1] = value;
      data[index + 2] = value;
    }
    context.putImageData(frame, 0, 0);
  }
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("The photo couldn’t be prepared."))), "image/jpeg", 0.92);
  });
}

export function singleCardFrame(width: number, height: number): boolean {
  if (width < 1 || height < 1) return false;
  const ratio = width / height;
  return ratio > 0.55 && ratio < 0.92;
}

export async function cardBands(file: File): Promise<{ name: Blob; number: Blob; spread: boolean }> {
  const image = await createImageBitmap(file);
  try {
    const name = await prepare(image, { x: 0.04, y: 0.03, w: 0.89, h: 0.09 }, 1400, false);
    const number = await prepare(image, { x: 0, y: 0.93, w: 1, h: 0.07 }, 1400, true);
    return { name, number, spread: !singleCardFrame(image.width, image.height) };
  } finally {
    image.close();
  }
}
