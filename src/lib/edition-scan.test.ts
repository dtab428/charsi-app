import assert from "node:assert/strict";
import { test } from "node:test";
import sharp from "sharp";
import { coverEditionStamp, editionStampBox } from "./edition-scan";

test("covering the edition stamp leaves the rest of the scan alone", async () => {
  const width = 120;
  const height = 168;
  const box = editionStampBox(width, height);
  assert.ok(box);
  const raw = Buffer.alloc(width * height * 3, 210);
  raw[0] = 220;
  raw[1] = 30;
  raw[2] = 30;
  const cx = box.left + Math.floor(box.width / 2);
  const cy = box.top + Math.floor(box.height / 2);
  const stamp = (cy * width + cx) * 3;
  raw[stamp] = 8;
  raw[stamp + 1] = 8;
  raw[stamp + 2] = 8;
  const jpeg = await sharp(raw, { raw: { width, height, channels: 3 } }).jpeg().toBuffer();
  const covered = await coverEditionStamp(jpeg);
  const out = await sharp(covered).raw().toBuffer({ resolveWithObject: true });
  const at = (x: number, y: number) => {
    const i = (y * out.info.width + x) * out.info.channels;
    return [out.data[i] ?? 0, out.data[i + 1] ?? 0, out.data[i + 2] ?? 0];
  };
  const center = at(cx, cy);
  assert.ok(Math.min(...center) > 150, `stamp pixel stayed dark: ${center.join(",")}`);
  const corner = at(0, 0);
  assert.ok(corner[0] > corner[1] && corner[0] > corner[2]);
});
