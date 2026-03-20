import type { StorageState } from "./storage";

type EcoDisplaySource = Pick<
  StorageState,
  "totalTokens" | "compressionPercent" | "totalWater" | "totalEnergy"
>;

type SplitLabel = {
  value: string;
  rest: string;
};

export function getEcoDisplayStats(source: EcoDisplaySource) {
  return {
    ...source,
    compressionLabel: `${Math.max(0, source.compressionPercent).toFixed(0)}%`,
    tokensLabel: `${Math.max(0, Math.round(source.totalTokens)).toLocaleString()} tokens saved`,
    waterLabel: `${source.totalWater.toFixed(1)} ml water`,
    energyLabel: `${source.totalEnergy.toFixed(2)} Wh energy`
  };
}

export function splitMetricLabel(text: string): SplitLabel {
  const match = text.match(/^([0-9]+(?:\.[0-9]+)?)\s+(.*)$/i);
  if (!match) {
    return { value: text, rest: "" };
  }

  return {
    value: match[1],
    rest: match[2]
  };
}
