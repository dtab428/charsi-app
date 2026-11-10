import path from "node:path";
import { createWorker, type Worker } from "tesseract.js";

const globalOcr = globalThis as unknown as { surroundOcr?: Promise<Worker> };

function worker(): Promise<Worker> {
  if (!globalOcr.surroundOcr) {
    globalOcr.surroundOcr = createWorker("eng", 1, {
      cachePath: path.join(process.cwd(), "data/ocr"),
      gzip: false,
    });
  }
  return globalOcr.surroundOcr;
}

let chain: Promise<unknown> = Promise.resolve();

export function readImage(image: Buffer): Promise<string> {
  const run = chain.then(async () => {
    const reader = await worker();
    await reader.setParameters({ tessedit_pageseg_mode: "6" });
    const result = await reader.recognize(image);
    return result.data.text ?? "";
  });
  chain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}
