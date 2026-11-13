import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { Worker } from "node:worker_threads";

export type Vectors = ReadonlyMap<string, Float32Array>;

const cacheSize = 8_192;
const cacheTtl = 15 * 60_000;
const keyFor = (text: string) => createHash("sha256").update(text).digest("base64url");

export class LocalEmbeddings {
  private worker?: Worker;
  private pending?: Promise<void>;
  private retryAt = 0;
  private readonly cache = new Map<string, { vector: Float32Array; expiresAt: number }>();

  readonly directory: string;
  constructor(directory: string) { this.directory = directory; }

  get(texts: string[]): Vectors | Promise<Vectors> {
    const now = Date.now();
    const vectors = new Map<string, Float32Array>();
    const missing: { key: string; text: string }[] = [];
    for (const [key, entry] of this.cache) {
      if (entry.expiresAt <= now) this.cache.delete(key);
    }
    for (const text of texts) {
      const key = keyFor(text);
      const cached = this.cache.get(key);
      if (cached) vectors.set(text, cached.vector);
      else missing.push({ key, text });
    }
    if (!missing.length || now < this.retryAt || !existsSync(join(this.directory, "model_quantized.onnx"))) return vectors;
    if (this.pending) return this.pending.then(() => this.get(texts));

    const batch = missing.slice(0, cacheSize);
    const result = this.encode(batch.map(entry => entry.text)).then(encoded => {
      const expiresAt = Date.now() + cacheTtl;
      for (const [i, entry] of batch.entries()) {
        this.cache.set(entry.key, { vector: encoded[i], expiresAt });
        vectors.set(entry.text, encoded[i]);
      }
      for (const key of this.cache.keys()) {
        if (this.cache.size <= cacheSize) break;
        this.cache.delete(key);
      }
    }).catch(() => {
      this.retryAt = Date.now() + 30_000;
      if (this.worker) void this.worker.terminate();
      this.worker = undefined;
      console.warn("Meet local embeddings unavailable. Using text matching for now.");
    });
    this.pending = result;
    return result.finally(() => { this.pending = undefined; }).then(() => vectors);
  }

  private async encode(texts: string[]): Promise<Float32Array[]> {
    if (!this.worker) {
      const worker = new Worker(resolve("lib/community/pilot/embedding-worker.cjs"), {
        workerData: this.directory, env: {},
      });
      worker.on("error", () => { if (this.worker === worker) this.worker = undefined; });
      worker.on("exit", () => { if (this.worker === worker) this.worker = undefined; });
      this.worker = worker;
    }
    const worker = this.worker;
    worker.ref();
    return new Promise((done, reject) => {
      const cleanup = () => {
        clearTimeout(timer);
        worker.removeListener("message", receive);
        worker.removeListener("error", fail);
        worker.removeListener("exit", fail);
        worker.unref();
      };
      const receive = (vectors: Float32Array[] | null) => {
        if (!vectors || vectors.length !== texts.length) { fail(); return; }
        cleanup();
        done(vectors);
      };
      const fail = () => { cleanup(); reject(new Error("Local embedding failed")); };
      const timer = setTimeout(fail, 10_000);
      worker.once("message", receive);
      worker.once("error", fail);
      worker.once("exit", fail);
      try { worker.postMessage(texts); }
      catch { fail(); }
    });
  }
}

// The page and API can have separate Next.js bundles within the same Node process.
const shared = globalThis as typeof globalThis & { sundaysEmbeddings?: LocalEmbeddings };

export function localEmbeddings(env: Record<string, string | undefined>) {
  if (env.COMMUNITY_PILOT_EMBEDDINGS === "off") return;
  const directory = resolve(env.COMMUNITY_PILOT_MODEL_DIR || ".sundays-pilot/models/minilm-l6-v2");
  if (shared.sundaysEmbeddings?.directory !== directory) shared.sundaysEmbeddings = new LocalEmbeddings(directory);
  return shared.sundaysEmbeddings;
}
