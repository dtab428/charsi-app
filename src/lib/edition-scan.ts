import sharp from "sharp";

// Wizards-era 1st Edition scans put the black "Edition 1" stamp in the
// left margin, just under the art frame and beside the yellow bar.
// pokemontcg.io usually publishes that scan for both sizes, so Unlimited
// has nothing else to show until the stamp is covered.
export function editionStampBox(width: number, height: number): { left: number; top: number; width: number; height: number } | null {
  if (width < 40 || height < 50) return null;
  const left = Math.round(width * 0.028);
  const top = Math.round(height * 0.52);
  const boxWidth = Math.max(6, Math.round(width * 0.102));
  const boxHeight = Math.max(6, Math.round(height * 0.065));
  if (left < 0 || top < 0 || left + boxWidth > width || top + boxHeight > height) return null;
  return { left, top, width: boxWidth, height: boxHeight };
}

function meanOf(data: Buffer, channels: number): [number, number, number] | null {
  const pixels = Math.floor(data.length / channels);
  if (pixels === 0) return null;
  let r = 0;
  let g = 0;
  let b = 0;
  let kept = 0;
  for (let i = 0; i < pixels; i += 1) {
    const offset = i * channels;
    const pr = data[offset] ?? 0;
    const pg = data[offset + 1] ?? 0;
    const pb = data[offset + 2] ?? 0;
    if (Math.min(pr, pg, pb) < 170 || Math.max(pr, pg, pb) - Math.min(pr, pg, pb) > 28) continue;
    r += pr;
    g += pg;
    b += pb;
    kept += 1;
  }
  if (kept < 8) return null;
  return [r / kept, g / kept, b / kept];
}

function clamp(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}

export async function coverEditionStamp(input: Buffer): Promise<Buffer> {
  const source = sharp(input, { failOn: "none" }).rotate();
  const meta = await source.metadata();
  const width = meta.width ?? 0;
  const height = meta.height ?? 0;
  const box = editionStampBox(width, height);
  if (!box) return input;

  const sampleTop = Math.min(height - 2, box.top + box.height + 2);
  const sampleHeight = Math.max(2, Math.min(Math.round(height * 0.018), height - sampleTop));
  const below = await sharp(input, { failOn: "none" })
    .rotate()
    .extract({ left: box.left, top: sampleTop, width: box.width, height: sampleHeight })
    .raw()
    .toBuffer({ resolveWithObject: true });
  const paper = meanOf(below.data, below.info.channels);
  if (!paper) return input;

  const feather = height < 400 ? 1 : Math.max(2, Math.round(height * 0.004));
  const overlay = Buffer.alloc(box.width * box.height * 4);
  for (let y = 0; y < box.height; y += 1) {
    for (let x = 0; x < box.width; x += 1) {
      const edge = Math.min(x, box.width - 1 - x, y, box.height - 1 - y);
      const alpha = edge >= feather ? 255 : Math.round((edge / feather) * 255);
      const out = (y * box.width + x) * 4;
      overlay[out] = clamp(paper[0]);
      overlay[out + 1] = clamp(paper[1]);
      overlay[out + 2] = clamp(paper[2]);
      overlay[out + 3] = alpha;
    }
  }
  const layer = await sharp(overlay, { raw: { width: box.width, height: box.height, channels: 4 } }).png().toBuffer();
  return sharp(input, { failOn: "none" }).rotate().composite([{ input: layer, left: box.left, top: box.top }]).jpeg({ quality: 86 }).toBuffer();
}
