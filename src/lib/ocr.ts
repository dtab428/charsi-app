import path from "node:path";
import { createWorker, PSM, type Worker } from "tesseract.js";

const globalOcr = globalThis as unknown as { charsiOcr?: Promise<Worker> };

function worker(): Promise<Worker> {
  if (!globalOcr.charsiOcr) {
    globalOcr.charsiOcr = createWorker("eng", 1, {
      cachePath: path.join(process.cwd(), "data/ocr"),
      gzip: false,
    });
  }
  return globalOcr.charsiOcr;
}

let chain: Promise<unknown> = Promise.resolve();

export function readImage(image: Buffer): Promise<string> {
  const run = chain.then(async () => {
    const reader = await worker();
    await reader.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_BLOCK });
    const result = await reader.recognize(image);
    return result.data.text ?? "";
  });
  chain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}
