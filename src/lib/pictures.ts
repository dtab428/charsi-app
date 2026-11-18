import { allowedImageUrl } from "./links";

export async function cardBlob(url: string): Promise<Blob> {
  if (!allowedImageUrl(url)) throw new Error("That picture isn’t from the catalog.");
  const response = await fetch(`/api/image?src=${encodeURIComponent(url)}`);
  if (!response.ok) throw new Error("The picture didn’t come through.");
  const blob = await response.blob();
  if (blob.type === "image/png") return blob;
  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const context = canvas.getContext("2d");
  if (!context) return blob;
  context.drawImage(bitmap, 0, 0);
  const png = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  return png ?? blob;
}

export async function firstCardBlob(urls: string[]): Promise<Blob> {
  let failure: unknown = new Error("The picture didn’t come through.");
  for (const url of urls) {
    if (!url) continue;
    try {
      return await cardBlob(url);
    } catch (error) {
      failure = error;
    }
  }
  throw failure;
}

export function downloadBlob(blob: Blob, filename: string) {
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

export async function copyBlob(blob: Blob) {
  const png = blob.type === "image/png" ? blob : await cardBlobToPng(blob);
  await navigator.clipboard.write([new ClipboardItem({ "image/png": png })]);
}

async function cardBlobToPng(blob: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const context = canvas.getContext("2d");
  if (!context) return blob;
  context.drawImage(bitmap, 0, 0);
  const png = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  return png ?? blob;
}
