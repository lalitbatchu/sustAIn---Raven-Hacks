import { encode } from "gpt-tokenizer/encoding/o200k_base";

export type EcoTotals = {
  totalTokens: number;
  totalOriginalTokens: number;
  totalCompressedTokens: number;
  compressionPercent: number;
  totalWater: number;
  totalEnergy: number;
};

type EcoPayload = {
  tokens: number;
  originalTokens: number;
  compressedTokens: number;
  compressionPercent: number;
  waterMl: number;
  energyWh: number;
};

const WATER_ML_PER_TOKEN = 1.04;
const ENERGY_WH_PER_TOKEN = 0.12;
const ECO_LOG_USER_ID_KEY = "ecoLogUserId";

const WORKER_URL = "https://backend.lalitbatchu.workers.dev";
const DEFAULT_TOTALS: EcoTotals = {
  totalTokens: 0,
  totalOriginalTokens: 0,
  totalCompressedTokens: 0,
  compressionPercent: 0,
  totalWater: 0,
  totalEnergy: 0
};

type LegacyTotals = {
  tokensSaved: number;
  waterMlSaved: number;
  energyWhSaved: number;
};

const DEFAULT_LEGACY_TOTALS: LegacyTotals = {
  tokensSaved: 0,
  waterMlSaved: 0,
  energyWhSaved: 0
};

export function countPromptTokens(text: string): number {
  try {
    return encode(text).length;
  } catch (error) {
    // Keep extension behavior resilient on unexpected editor artifacts.
    console.warn("SustAIn: tokenization failed, using char fallback", error);
    return Math.ceil(text.length / 4);
  }
}

export function calculateEcoStats(originalTokens: number, compressedTokens: number) {
  const tokens = Math.max(0, originalTokens - compressedTokens);
  const waterMl = tokens * WATER_ML_PER_TOKEN;
  const energyWh = tokens * ENERGY_WH_PER_TOKEN;
  const compressionPercent =
    originalTokens > 0 ? (tokens / originalTokens) * 100 : 0;

  return {
    tokens,
    originalTokens,
    compressedTokens,
    compressionPercent,
    waterMl,
    energyWh
  };
}

export function processSavings(originalText: string, compressedText: string) {
  const originalTokens = countPromptTokens(originalText);
  const compressedTokens = countPromptTokens(compressedText);
  return calculateEcoStats(originalTokens, compressedTokens);
}

function createEcoLogUserId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `eco-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

async function getOrCreateEcoLogUserId(): Promise<string> {
  const existingUserId = await new Promise<string | null>((resolve) => {
    chrome.storage.local.get([ECO_LOG_USER_ID_KEY], (items) => {
      const value = items[ECO_LOG_USER_ID_KEY];
      resolve(typeof value === "string" && value.trim().length > 0 ? value : null);
    });
  });

  if (existingUserId) {
    return existingUserId;
  }

  const nextUserId = createEcoLogUserId();
  await new Promise<void>((resolve) => {
    chrome.storage.local.set({ [ECO_LOG_USER_ID_KEY]: nextUserId }, () => resolve());
  });

  return nextUserId;
}

export async function logEcoStats(payload: EcoPayload): Promise<void> {
  const toNumber = (value: unknown) => {
    const parsed =
      typeof value === "number" ? value : Number.parseFloat(String(value ?? ""));
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const tokens = Math.max(0, toNumber(payload.tokens));
  const originalTokens = Math.max(0, toNumber(payload.originalTokens));
  const compressedTokens = Math.max(0, toNumber(payload.compressedTokens));
  const compressionPercent = Math.max(0, toNumber(payload.compressionPercent));
  const waterMl = Math.max(0, toNumber(payload.waterMl));
  const energyWh = Math.max(0, toNumber(payload.energyWh));

  if (
    tokens <= 0 &&
    originalTokens <= 0 &&
    compressedTokens <= 0 &&
    waterMl <= 0 &&
    energyWh <= 0
  ) {
    return;
  }

  const totals = await new Promise<EcoTotals & LegacyTotals>((resolve) => {
    chrome.storage.local.get({ ...DEFAULT_TOTALS, ...DEFAULT_LEGACY_TOTALS }, (items) => {
      resolve({
        totalTokens: Number(
          items.totalTokens ?? items.tokensSaved ?? DEFAULT_TOTALS.totalTokens
        ),
        totalOriginalTokens: Number(
          items.totalOriginalTokens ?? DEFAULT_TOTALS.totalOriginalTokens
        ),
        totalCompressedTokens: Number(
          items.totalCompressedTokens ?? DEFAULT_TOTALS.totalCompressedTokens
        ),
        compressionPercent: Number(
          items.compressionPercent ?? DEFAULT_TOTALS.compressionPercent
        ),
        totalWater: Number(
          items.totalWater ?? items.waterMlSaved ?? DEFAULT_TOTALS.totalWater
        ),
        totalEnergy: Number(
          items.totalEnergy ?? items.energyWhSaved ?? DEFAULT_TOTALS.totalEnergy
        ),
        tokensSaved: Number(items.tokensSaved ?? DEFAULT_LEGACY_TOTALS.tokensSaved),
        waterMlSaved: Number(items.waterMlSaved ?? DEFAULT_LEGACY_TOTALS.waterMlSaved),
        energyWhSaved: Number(items.energyWhSaved ?? DEFAULT_LEGACY_TOTALS.energyWhSaved)
      });
    });
  });

  const nextTotalOriginalTokens = totals.totalOriginalTokens + originalTokens;
  const nextTotalCompressedTokens =
    totals.totalCompressedTokens + compressedTokens;
  const nextCompressionPercent =
    nextTotalOriginalTokens > 0
      ? ((nextTotalOriginalTokens - nextTotalCompressedTokens) /
          nextTotalOriginalTokens) *
        100
      : compressionPercent;

  const nextTotals: EcoTotals = {
    totalTokens: totals.totalTokens + tokens,
    totalOriginalTokens: nextTotalOriginalTokens,
    totalCompressedTokens: nextTotalCompressedTokens,
    compressionPercent: nextCompressionPercent,
    totalWater: totals.totalWater + waterMl,
    totalEnergy: totals.totalEnergy + energyWh
  };

  await new Promise<void>((resolve) => {
    chrome.storage.local.set(
      {
        ...nextTotals,
        // Legacy aliases keep popup updates stable if any older UI path is still present.
        tokensSaved: nextTotals.totalTokens,
        waterMlSaved: nextTotals.totalWater,
        energyWhSaved: nextTotals.totalEnergy
      },
      () => resolve()
    );
  });

  console.log("EcoStats: totals updated", {
    totalTokens: nextTotals.totalTokens,
    totalOriginalTokens: nextTotals.totalOriginalTokens,
    totalCompressedTokens: nextTotals.totalCompressedTokens,
    compressionPercent: nextTotals.compressionPercent,
    totalWater: nextTotals.totalWater,
    totalEnergy: nextTotals.totalEnergy
  });

  chrome.runtime.sendMessage({
    type: "eco-totals-updated",
    payload: nextTotals
  });

  const userId = await getOrCreateEcoLogUserId();
  const workerPayload = {
    userId,
    tokens,
    originalTokens,
    compressedTokens
  };
  const fallbackCloudLog = () =>
    fetch(WORKER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(workerPayload)
    }).then((response) => {
      if (!response.ok) {
        throw new Error(`Cloud log failed with status ${response.status}`);
      }
    });

  try {
    chrome.runtime.sendMessage({ type: "eco-log", payload: workerPayload }, (response) => {
      if (chrome.runtime.lastError) {
        console.error("EcoStats cloud log failed", chrome.runtime.lastError);
        // Fallback to direct fetch from content script.
        fallbackCloudLog().catch((error) => {
          console.error("EcoStats cloud log failed", error);
        });
        return;
      }
      if (!response?.ok) {
        console.error("EcoStats cloud log failed", response);
        fallbackCloudLog().catch((error) => {
          console.error("EcoStats cloud log failed", error);
        });
      }
    });
  } catch (error) {
    console.error("EcoStats cloud log failed", error);
  }
}
