import { createHash } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

const revision = "751bff37182d3f1213fa05d7196b954e230abad9";
const base = `https://huggingface.co/Xenova/all-MiniLM-L6-v2/resolve/${revision}`;
const directory = resolve(process.env.COMMUNITY_PILOT_MODEL_DIR || ".sundays-pilot/models/minilm-l6-v2");
const files = [
  ["tokenizer.json", "da0e79933b9ed51798a3ae27893d3c5fa4a201126cef75586296df9b4d2c62a0"],
  ["tokenizer_config.json", "9261e7d79b44c8195c1cada2b453e55b00aeb81e907a6664974b4d7776172ab3"],
  ["onnx/model_quantized.onnx", "afdb6f1a0e45b715d0bb9b11772f032c399babd23bfc31fed1c170afc848bdb1"],
];
const digest = bytes => createHash("sha256").update(bytes).digest("hex");

await mkdir(directory, { recursive: true, mode: 0o700 });
for (const [file, expected] of files) {
  const dest = join(directory, file.split("/").at(-1));
  const existing = await readFile(dest).catch(error => {
    if (error.code !== "ENOENT") throw error;
  });
  if (existing && digest(existing) === expected) continue;
  const response = await fetch(`${base}/${file}`, { signal: AbortSignal.timeout(90_000) });
  if (!response.ok) throw new Error(`Model setup failed for ${file} (HTTP ${response.status})`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (digest(bytes) !== expected) throw new Error(`Checksum mismatch for ${file}`);
  const temporary = `${dest}.${process.pid}.tmp`;
  try {
    await writeFile(temporary, bytes, { mode: 0o600 });
    await rename(temporary, dest);
  } finally { await rm(temporary, { force: true }); }
}
console.log("Meet local model ready.");
