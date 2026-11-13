const { readFile } = require("node:fs/promises");
const { createRequire } = require("node:module");
const { join, resolve } = require("node:path");
const { parentPort, workerData: modelPath } = require("node:worker_threads");
const runtime = createRequire(resolve("scripts/pilot-runtime/package.json"));
const { Tokenizer } = runtime("@huggingface/tokenizers");
const { InferenceSession, Tensor } = runtime("onnxruntime-node");

async function load() {
  const json = async file => JSON.parse(await readFile(join(modelPath, file), "utf8"));
  const tokenizer = new Tokenizer(await json("tokenizer.json"), await json("tokenizer_config.json"));
  const session = await InferenceSession.create(join(modelPath, "model_quantized.onnx"), {
    executionProviders: ["cpu"], intraOpNumThreads: 2, interOpNumThreads: 1,
  });
  return { tokenizer, session };
}

async function embed(texts, { tokenizer, session }) {
  const encoded = texts.map(text => {
    const { ids } = tokenizer.encode(text, { add_special_tokens: true });
    return ids.length <= 256 ? ids : [...ids.slice(0, 255), ids.at(-1)];
  });
  const width = Math.max(...encoded.map(ids => ids.length));
  const dims = [texts.length, width];
  const input = new BigInt64Array(texts.length * width);
  const mask = new BigInt64Array(input.length);
  for (const [row, ids] of encoded.entries()) {
    for (let i = 0; i < ids.length; i++) {
      const position = row * width + i;
      input[position] = BigInt(ids[i]);
      mask[position] = BigInt(1);
    }
  }
  const { last_hidden_state: output } = await session.run({
    input_ids: new Tensor("int64", input, dims),
    attention_mask: new Tensor("int64", mask, dims),
    token_type_ids: new Tensor("int64", new BigInt64Array(input.length), dims),
  });
  const dimensions = output.dims[2];
  return encoded.map((ids, row) => {
    const vector = new Float32Array(dimensions);
    for (let i = 0; i < ids.length; i++) {
      const offset = (row * width + i) * dimensions;
      for (let j = 0; j < dimensions; j++) vector[j] += output.data[offset + j];
    }
    // Normalizing the sum is equivalent to normalizing the mean of the unpadded tokens.
    const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
    if (!Number.isFinite(norm) || !norm) throw new Error("Invalid embedding");
    return vector.map(value => value / norm);
  });
}

let model;
parentPort.on("message", async texts => {
  try {
    model ??= load();
    const encoder = await model;
    const vectors = [];
    for (let i = 0; i < texts.length; i += 12) {
      vectors.push(...await embed(texts.slice(i, i + 12), encoder));
    }
    parentPort.postMessage(vectors, vectors.map(vector => vector.buffer));
  } catch {
    parentPort.postMessage(null);
  }
});
