import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

export type CollectionKind = "raw" | "graded";

export type CollectionEntry = {
  id: string;
  cardId: string;
  kind: CollectionKind;
  company: string | null;
  grade: string | null;
  printing: string | null;
  quantity: number;
  addedAt: number;
};

export type NewEntry = Omit<CollectionEntry, "id" | "addedAt">;

const MAX_ENTRIES = 2000;
const MAX_QUANTITY = 999;
export type Bucket = "collections" | "wishlists";
const queues = new Map<string, Promise<unknown>>();

function fileFor(userId: string, bucket: Bucket): string {
  if (!/^[a-z0-9]{1,32}$/.test(userId)) throw new Error("bad user");
  return path.join(process.cwd(), ".data", bucket, `${userId}.json`);
}

async function read(userId: string, bucket: Bucket): Promise<CollectionEntry[]> {
  try {
    const parsed = JSON.parse(await fs.readFile(fileFor(userId, bucket), "utf8")) as unknown;
    return Array.isArray(parsed) ? (parsed as CollectionEntry[]) : [];
  } catch {
    return [];
  }
}

async function write(userId: string, bucket: Bucket, entries: CollectionEntry[]): Promise<void> {
  const target = fileFor(userId, bucket);
  await fs.mkdir(path.dirname(target), { recursive: true });
  const temp = `${target}.${process.pid}.${crypto.randomUUID()}.tmp`;
  await fs.writeFile(temp, JSON.stringify(entries), { mode: 0o600 });
  await fs.rename(temp, target);
}

function serial<T>(userId: string, bucket: Bucket, task: () => Promise<T>): Promise<T> {
  const key = `${bucket}:${userId}`;
  const run = (queues.get(key) ?? Promise.resolve()).catch(() => undefined).then(task);
  queues.set(key, run);
  return run;
}

export function listCollection(userId: string, bucket: Bucket = "collections"): Promise<CollectionEntry[]> {
  return read(userId, bucket);
}

export function addToCollection(userId: string, entry: NewEntry, bucket: Bucket = "collections"): Promise<CollectionEntry[]> {
  return serial(userId, bucket, async () => {
    const entries = await read(userId, bucket);
    const match = entries.find(
      (current) => current.cardId === entry.cardId && current.kind === entry.kind && current.company === entry.company && current.grade === entry.grade && (current.printing ?? null) === entry.printing,
    );
    if (match) {
      match.quantity = Math.min(MAX_QUANTITY, match.quantity + entry.quantity);
    } else {
      if (entries.length >= MAX_ENTRIES) throw new Error("full");
      entries.push({ ...entry, quantity: Math.min(MAX_QUANTITY, entry.quantity), id: crypto.randomUUID(), addedAt: Date.now() });
    }
    await write(userId, bucket, entries);
    return entries;
  });
}

export function setQuantity(userId: string, id: string, quantity: number, bucket: Bucket = "collections"): Promise<CollectionEntry[]> {
  return serial(userId, bucket, async () => {
    const entries = await read(userId, bucket);
    const entry = entries.find((current) => current.id === id);
    if (entry) entry.quantity = Math.max(1, Math.min(MAX_QUANTITY, quantity));
    await write(userId, bucket, entries);
    return entries;
  });
}

export function removeFromCollection(userId: string, id: string, bucket: Bucket = "collections"): Promise<CollectionEntry[]> {
  return serial(userId, bucket, async () => {
    const entries = (await read(userId, bucket)).filter((current) => current.id !== id);
    await write(userId, bucket, entries);
    return entries;
  });
}
