import {
  AutoConfig,
  AutoTokenizer,
  BertForTokenClassification,
  env
} from "@huggingface/transformers";
import { Tiktoken } from "js-tiktoken/lite";
import o200k_base from "js-tiktoken/ranks/o200k_base";
import {
  CompressionCore,
  DEFAULT_LOCAL_MODEL_ID
} from "../compression-lib/compression-core.js";

export type CompressionJob = {
  text: string;
  rate: number;
  forceTokens?: string[];
  keepDigits?: boolean;
  chunkEndTokens?: string[];
};

export type CompressionProgressUpdate = {
  phase: "init" | "compress";
  message: string;
};

const MODEL_NAME = DEFAULT_LOCAL_MODEL_ID;
const DEFAULT_FORCE_TOKENS = [".", ";", "\n"];
const DEFAULT_CHUNK_END_TOKENS = [".", "\n"];

const oaiTokenizer = new Tiktoken(o200k_base);

let compressorPromise: Promise<CompressionCore.PromptCompressor> | null = null;

env.useBrowserCache = true;

const onnxWasmEnvironment = env.backends.onnx.wasm;
const localModelBaseUrl =
  typeof chrome !== "undefined" && chrome.runtime?.getURL
    ? chrome.runtime.getURL("models/")
    : typeof self !== "undefined" && "location" in self
      ? new URL("../models/", self.location.href).href
      : null;

if (localModelBaseUrl) {
  env.localModelPath = localModelBaseUrl;
  env.allowLocalModels = true;
  env.allowRemoteModels = false;
} else {
  env.allowLocalModels = false;
  env.allowRemoteModels = true;
}

if (onnxWasmEnvironment) {
  const assetBaseUrl =
    typeof chrome !== "undefined" && chrome.runtime?.getURL
      ? chrome.runtime.getURL("assets/")
      : typeof self !== "undefined" && "location" in self
        ? new URL("./", self.location.href).href
        : null;

  if (assetBaseUrl) {
    onnxWasmEnvironment.wasmPaths = {
      mjs: new URL("ort-wasm-simd-threaded.jsep.mjs", assetBaseUrl).href,
      wasm: new URL("ort-wasm-simd-threaded.jsep.wasm", assetBaseUrl).href
    };
  }
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function clampRate(value: unknown): number {
  const numeric =
    typeof value === "number" ? value : Number.parseFloat(String(value ?? ""));
  if (!Number.isFinite(numeric)) return 0.7;
  return Math.min(0.99, Math.max(0.05, numeric));
}

function emitProgress(
  onProgress: ((update: CompressionProgressUpdate) => void) | undefined,
  phase: CompressionProgressUpdate["phase"],
  message: string
) {
  onProgress?.({ phase, message });
}

async function createPromptCompressor(
  onProgress?: (update: CompressionProgressUpdate) => void
): Promise<CompressionCore.PromptCompressor> {
  emitProgress(onProgress, "init", "Loading model config");
  const config = await AutoConfig.from_pretrained(MODEL_NAME);

  const transformersJSConfig = {
    device: "wasm" as const,
    dtype: "fp32" as const
  };

  const sharedConfig = {
    ...config,
    "transformers.js_config": transformersJSConfig
  };

  emitProgress(onProgress, "init", "Loading tokenizer and model");
  const [tokenizer, pretrainedModel] = await Promise.all([
    AutoTokenizer.from_pretrained(MODEL_NAME, {
      config: sharedConfig
    }),
    BertForTokenClassification.from_pretrained(MODEL_NAME, {
      config: sharedConfig
    })
  ]);

  emitProgress(onProgress, "init", "Preparing compression engine");
  return new CompressionCore.PromptCompressor(
    pretrainedModel,
    tokenizer,
    CompressionCore.get_pure_tokens_bert_base_multilingual_cased,
    CompressionCore.is_begin_of_new_word_bert_base_multilingual_cased,
    oaiTokenizer,
    {
      max_batch_size: 50,
      max_force_token: 100,
      max_seq_length: 312
    },
    (...parts: unknown[]) => {
      const message = parts
        .map((part) => {
          if (typeof part === "string") return part;
          try {
            return JSON.stringify(part);
          } catch {
            return String(part);
          }
        })
        .join(" ");
      emitProgress(onProgress, "compress", message);
    }
  );
}

export async function warmCompressionEngine(
  onProgress?: (update: CompressionProgressUpdate) => void
): Promise<void> {
  await getPromptCompressor(onProgress);
}

async function getPromptCompressor(
  onProgress?: (update: CompressionProgressUpdate) => void
): Promise<CompressionCore.PromptCompressor> {
  if (!compressorPromise) {
    compressorPromise = createPromptCompressor(onProgress).catch((error) => {
      compressorPromise = null;
      throw error;
    });
  }

  return compressorPromise;
}

export async function compressTextWithEngine(
  job: CompressionJob,
  onProgress?: (update: CompressionProgressUpdate) => void
): Promise<string> {
  const compressor = await getPromptCompressor(onProgress);

  const normalizedText = String(job.text ?? "").trim();
  if (!normalizedText) return "";

  const safeRate = clampRate(job.rate);
  const forceTokens = isStringArray(job.forceTokens)
    ? job.forceTokens
    : DEFAULT_FORCE_TOKENS;
  const chunkEndTokens = isStringArray(job.chunkEndTokens)
    ? job.chunkEndTokens
    : DEFAULT_CHUNK_END_TOKENS;

  emitProgress(onProgress, "compress", "Running local compression");
  return compressor.compress(normalizedText, {
    rate: safeRate,
    forceTokens,
    forceReserveDigit: job.keepDigits ?? true,
    chunkEndTokens
  });
}
