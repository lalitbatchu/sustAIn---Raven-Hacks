// TEMPORARY INTERNAL BENCHMARK TOOLING.
// Remove this file and the rest of src/internal-benchmark after the translation experiment.

import { countPromptTokens } from "../utils/ecoStats";
import { INTERNAL_BENCHMARK_PROMPTS } from "./dataset";
import type {
  BenchmarkMethod,
  BenchmarkMethodResult,
  BenchmarkPromptCase,
  BenchmarkPromptRecord,
  BenchmarkState,
  ExportedBenchmarkRow
} from "./types";

const STORAGE_KEY = "internal-benchmark-state-v1";
const STORAGE_KEY_V2 = "internal-benchmark-experiment-state-v2";

function createEmptyMethodResult(
  _prompt: BenchmarkPromptCase
): BenchmarkMethodResult {
  return {
    outputText: "",
    manualQualityRating: null,
    preservedConstraints: "untested"
  };
}

function createPromptRecord(prompt: BenchmarkPromptCase): BenchmarkPromptRecord {
  return {
    promptId: prompt.id,
    category: prompt.category,
    updatedAt: null,
    methods: {
      original_english: createEmptyMethodResult(prompt),
      compressed_english: createEmptyMethodResult(prompt),
      chinese_translated: createEmptyMethodResult(prompt)
    }
  };
}

export function createDefaultBenchmarkState(): BenchmarkState {
  return {
    records: Object.fromEntries(
      INTERNAL_BENCHMARK_PROMPTS.map((prompt) => [prompt.id, createPromptRecord(prompt)])
    ),
    lastExportedAt: null
  };
}

function canUseChromeStorage() {
  return typeof chrome !== "undefined" && Boolean(chrome.storage?.local);
}

export async function loadBenchmarkState(): Promise<BenchmarkState> {
  const defaults = createDefaultBenchmarkState();

  if (canUseChromeStorage()) {
    const stored = await new Promise<BenchmarkState | undefined>((resolve) => {
      chrome.storage.local.get([STORAGE_KEY_V2, STORAGE_KEY], (items) => {
        resolve(
          (items[STORAGE_KEY_V2] as BenchmarkState | undefined) ??
            (items[STORAGE_KEY] as BenchmarkState | undefined)
        );
      });
    });

    return mergeBenchmarkState(defaults, stored);
  }

  try {
    const raw =
      window.localStorage.getItem(STORAGE_KEY_V2) ??
      window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaults;
    return mergeBenchmarkState(defaults, JSON.parse(raw) as BenchmarkState);
  } catch {
    return defaults;
  }
}

export async function saveBenchmarkState(state: BenchmarkState): Promise<void> {
  if (canUseChromeStorage()) {
    await new Promise<void>((resolve) => {
      chrome.storage.local.set({ [STORAGE_KEY_V2]: state }, () => resolve());
    });
    return;
  }

  window.localStorage.setItem(STORAGE_KEY_V2, JSON.stringify(state));
}

export function mergeBenchmarkState(
  defaults: BenchmarkState,
  stored: BenchmarkState | undefined
): BenchmarkState {
  if (!stored) return defaults;

  const records = Object.fromEntries(
    INTERNAL_BENCHMARK_PROMPTS.map((prompt) => {
      const current = defaults.records[prompt.id];
      const incoming = stored.records?.[prompt.id];

      return [
        prompt.id,
        {
          ...current,
          updatedAt: incoming?.updatedAt ?? current.updatedAt,
          methods: {
            original_english: {
              ...current.methods.original_english,
              ...incoming?.methods?.original_english
            },
            compressed_english: {
              ...current.methods.compressed_english,
              ...incoming?.methods?.compressed_english
            },
            chinese_translated: {
              ...current.methods.chinese_translated,
              ...incoming?.methods?.chinese_translated
            }
          }
        }
      ];
    })
  );

  return {
    records,
    lastExportedAt: stored.lastExportedAt ?? defaults.lastExportedAt
  };
}

export function buildExportRows(state: BenchmarkState): ExportedBenchmarkRow[] {
  return INTERNAL_BENCHMARK_PROMPTS.flatMap((prompt) =>
    ([
      "original_english",
      "compressed_english",
      "chinese_translated"
    ] as BenchmarkMethod[]).map((method) => {
      const variant = prompt.variants[method];
      const result = state.records[prompt.id].methods[method];
      const originalTokens = prompt.variants.original_english.inputTokens;
      const outputTokens = result.outputText
        ? countPromptTokens(result.outputText)
        : 0;
      const reductionVsOriginal =
        method === "original_english" || originalTokens <= 0
          ? 0
          : Math.max(
              0,
              Math.round(((originalTokens - variant.inputTokens) / originalTokens) * 100)
            );

      return {
        promptId: prompt.id,
        title: prompt.title,
        category: prompt.category,
        method,
        inputTokens: variant.inputTokens,
        reductionVsOriginal,
        promptText: variant.promptText,
        outputText: result.outputText,
        outputTokens,
        preservedConstraints: result.preservedConstraints,
        manualQualityRating: result.manualQualityRating,
        updatedAt: state.records[prompt.id].updatedAt
      };
    })
  );
}

export async function exportBenchmarkResults(state: BenchmarkState): Promise<void> {
  const rows = buildExportRows(state);
  const payload = {
    exportedAt: new Date().toISOString(),
    rows
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json"
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "sustain-internal-benchmark-results.json";
  link.click();
  URL.revokeObjectURL(url);
}
