import { sheetDate } from "./format";
import type { Finish } from "./format";
import { firstCardBlob } from "./pictures";
import { STAMP_BOX, stampLogo } from "./stamp-art";

export type SheetCell = {
  srcs: string[];
  name: string;
  line: string;
  finish: Finish | null;
  stamp: string;
  badge: boolean;
};

function drawStamp(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, logo: ImageBitmap) {
  const boxWidth = (width * STAMP_BOX.width) / 100;
  const boxHeight = (height * STAMP_BOX.height) / 100;
  const scale = Math.min(boxWidth / logo.width, boxHeight / logo.height);
  const drawWidth = logo.width * scale;
  const drawHeight = logo.height * scale;
  const right = x + width * (1 - STAMP_BOX.right / 100);
  const bottom = y + height * (1 - STAMP_BOX.bottom / 100);
  context.drawImage(logo, right - drawWidth, bottom - drawHeight, drawWidth, drawHeight);
}

async function loadLogo(id: string): Promise<ImageBitmap | null> {
  const src = stampLogo(id);
  if (!src) return null;
  try {
    const response = await fetch(src);
    return response.ok ? await createImageBitmap(await response.blob()) : null;
  } catch {
    return null;
  }
}

function drawPill(context: CanvasRenderingContext2D, x: number, y: number, text: string, fill: string, ink: string) {
  context.save();
  context.font = "600 10px sans-serif";
  const label = text.toUpperCase();
  const width = context.measureText(label).width + 16;
  context.fillStyle = fill;
  context.beginPath();
  context.roundRect(x + 6, y + 6, width, 18, 9);
  context.fill();
  context.fillStyle = ink;
  context.textBaseline = "middle";
  context.fillText(label, x + 14, y + 15.5);
  context.restore();
}

function wrap(context: CanvasRenderingContext2D, text: string, max: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (context.measureText(next).width > max && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines.slice(0, 2);
}

export async function renderSheet(cells: SheetCell[], title: string): Promise<Blob> {
  const columns = cells.length <= 1 ? 1 : cells.length <= 3 ? cells.length : cells.length <= 8 ? 4 : 5;
  const rows = Math.ceil(cells.length / columns);
  const cardWidth = 250;
  const cardHeight = 348;
  const labelHeight = 78;
  const gap = 22;
  const pad = 36;
  const header = 84;
  const width = pad * 2 + columns * cardWidth + (columns - 1) * gap;
  const height = pad + header + rows * (cardHeight + labelHeight) + (rows - 1) * gap + pad;

  const canvas = document.createElement("canvas");
  let scale = Math.min(2, window.devicePixelRatio || 1);
  while (width * height * scale * scale > 14_000_000 && scale > 0.7) scale *= 0.85;
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("The sheet couldn’t be drawn.");
  context.scale(scale, scale);
  context.fillStyle = "#16130f";
  context.fillRect(0, 0, width, height);

  context.fillStyle = "#f3ecdf";
  context.font = "italic 34px Georgia, serif";
  context.fillText(title.trim() || "Charsi", pad, pad + 36);
  context.fillStyle = "#d4a574";
  context.font = "15px Georgia, serif";
  context.fillText(sheetDate(), pad, pad + 60);

  const bitmaps = await Promise.all(
    cells.map(async (cell) => {
      try {
        const blob = await firstCardBlob(cell.srcs);
        return await createImageBitmap(blob);
      } catch {
        return null;
      }
    }),
  );
  const logos = new Map<string, ImageBitmap | null>();
  for (const id of new Set(cells.filter((cell) => cell.finish === "reverse" && cell.stamp).map((cell) => cell.stamp))) {
    logos.set(id, await loadLogo(id));
  }

  cells.forEach((cell, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    const x = pad + column * (cardWidth + gap);
    const y = pad + header + row * (cardHeight + labelHeight + gap);
    context.fillStyle = "#2a241e";
    context.fillRect(x, y, cardWidth, cardHeight);
    const bitmap = bitmaps[index];
    if (bitmap) {
      context.drawImage(bitmap, x, y, cardWidth, cardHeight);
      const logo = cell.finish === "reverse" && cell.stamp ? logos.get(cell.stamp) : null;
      if (logo) drawStamp(context, x, y, cardWidth, cardHeight, logo);
      if (cell.badge && cell.finish === "reverse" && !cell.stamp) drawPill(context, x, y, "Reverse", "#c6a15b", "#241c14");
      else if (cell.badge && cell.finish === "holo") {
        context.strokeStyle = "#f0d7a4";
        context.lineWidth = 2;
        context.strokeRect(x + 1, y + 1, cardWidth - 2, cardHeight - 2);
        drawPill(context, x, y, "Holo", "#f0d7a4", "#241c14");
      } else if (cell.badge && cell.finish === "normal") {
        drawPill(context, x, y, "Non-holo", "rgba(20,17,14,0.85)", "#f3ecdf");
      }
    } else {
      context.fillStyle = "#f3ecdf";
      context.font = "16px Georgia, serif";
      context.fillText("Picture missing", x + 16, y + cardHeight / 2);
    }
    context.fillStyle = "#f3ecdf";
    context.font = "16px Georgia, serif";
    const name = wrap(context, cell.name, cardWidth);
    name.forEach((line, lineIndex) => context.fillText(line, x, y + cardHeight + 24 + lineIndex * 20));
    context.fillStyle = "#d4a574";
    context.font = "13px Georgia, serif";
    context.fillText(cell.line, x, y + cardHeight + 24 + name.length * 20 + 4);
  });

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("The sheet couldn’t be saved.");
  return blob;
}
