import { countPromptTokens } from "../utils/ecoStats";

export type TutorialComparisonStat = {
  label: string;
  value: string;
};

export type TutorialComparisonOutput = {
  title: string;
  excerpt: string;
  fullText: string;
};

const ORIGINAL_OUTPUT_TEXT =
  "Absolutely. What you're describing is the water cycle, also called the hydrologic cycle, and it constantly moves water between land, oceans, and atmosphere. The answer then walks through evaporation, condensation, precipitation, and why the cycle is essential for life.";

const COMPRESSED_OUTPUT_TEXT =
  "The process is called the water cycle, the continuous movement of water between Earth's surface, the atmosphere, and the ground. It then explains evaporation, cloud formation, precipitation, and why this cycle matters for fresh water, climate stability, agriculture, and ecosystems.";

const ORIGINAL_PROMPT_TEXT =
  "I am actually really very interested in understanding, in a detailed and step-by-step way, the process by which the water on Earth evaporates from oceans, lakes, and rivers, rises into the atmosphere to form clouds, and then eventually falls back to the ground as rain, snow, sleet, or hail, and I would like you to please explain why this process is so extremely important for all life on our planet.";

const COMPRESSED_PROMPT_TEXT =
  "Explain the water cycle step by step: evaporation from oceans, lakes, and rivers; rising into the atmosphere as water vapor; cloud formation; and precipitation back to Earth as rain, snow, sleet, or hail. Include why this process is important for all life on our planet.";

const originalTokenCount = countPromptTokens(ORIGINAL_PROMPT_TEXT);
const compressedTokenCount = countPromptTokens(COMPRESSED_PROMPT_TEXT);
const savedTokenCount = Math.max(0, originalTokenCount - compressedTokenCount);
const reductionPercent =
  originalTokenCount > 0
    ? Math.round(
        ((originalTokenCount - compressedTokenCount) / originalTokenCount) * 100
      )
    : 0;

export const TUTORIAL_COMPARISON_STATS: readonly TutorialComparisonStat[] = [
  { label: "Original", value: `${originalTokenCount} tokens` },
  { label: "Compressed", value: `${compressedTokenCount} tokens` },
  { label: "Reduction", value: `${reductionPercent}%` }
];

export const TUTORIAL_COMPARISON_OUTPUTS: readonly TutorialComparisonOutput[] = [
  {
    title: "Original Prompt Output",
    excerpt: ORIGINAL_OUTPUT_TEXT,
    fullText: ORIGINAL_OUTPUT_TEXT
  },
  {
    title: "Compressed Prompt Output",
    excerpt: COMPRESSED_OUTPUT_TEXT,
    fullText: COMPRESSED_OUTPUT_TEXT
  }
];

export const TUTORIAL_COMPARISON_VALIDATIONS: readonly string[] = [
  "Same explanation",
  "Same key ideas preserved",
  `${savedTokenCount} tokens saved`
];
