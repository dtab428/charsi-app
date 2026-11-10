import { sheetDate } from "./format";
import { cardBlob } from "./pictures";

export type SheetCell = {
  src: string;
  name: string;
  line: string;
};

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
  context.fillText(title.trim() || "Surround", pad, pad + 36);
  context.fillStyle = "#d4a574";
  context.font = "15px Georgia, serif";
  context.fillText(sheetDate(), pad, pad + 60);

  const bitmaps = await Promise.all(
    cells.map(async (cell) => {
      try {
        const blob = await cardBlob(cell.src);
        return await createImageBitmap(blob);
      } catch {
        return null;
      }
    }),
  );

  cells.forEach((cell, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    const x = pad + column * (cardWidth + gap);
    const y = pad + header + row * (cardHeight + labelHeight + gap);
    context.fillStyle = "#2a241e";
    context.fillRect(x, y, cardWidth, cardHeight);
    const bitmap = bitmaps[index];
    if (bitmap) context.drawImage(bitmap, x, y, cardWidth, cardHeight);
    else {
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
