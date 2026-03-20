// TEMPORARY INTERNAL EXPERIMENT TOOLING.
// Remove this file and the rest of src/internal-benchmark after the translation experiment.

import { countPromptTokens } from "../utils/ecoStats";
import type {
  BenchmarkMethod,
  BenchmarkPromptCase,
  BenchmarkVariant
} from "./types";

function createVariant(
  method: BenchmarkMethod,
  label: string,
  promptText: string,
  notes: string
): BenchmarkVariant {
  return {
    method,
    label,
    promptText,
    notes,
    inputTokens: countPromptTokens(promptText)
  };
}

export const INTERNAL_BENCHMARK_PROMPTS: readonly BenchmarkPromptCase[] = [
  {
    id: "writing-launch-copy",
    title: "Writing: Launch Copy",
    category: "writing",
    description:
      "Tests whether shorter or translated prompts still preserve voice, word limit, and product details.",
    comparisonGoal:
      "Compare token savings against whether the model keeps the tone friendly and the product details intact.",
    constraints: [
      {
        id: "writing-word-limit",
        label: "Word limit",
        type: "word_limit",
        details: "Keep the answer under 90 words.",
        target: 90
      },
      {
        id: "writing-required-content",
        label: "Required content",
        type: "required_content",
        details: "Must mention offline sync and collaboration."
      },
      {
        id: "writing-language",
        label: "Language requirement",
        type: "language_requirement",
        details: "Return the answer in English.",
        target: "English"
      }
    ],
    variants: {
      original_english: createVariant(
        "original_english",
        "Original English",
        "Write a friendly product launch blurb for a student note-taking app. Keep it under 90 words, mention offline sync and collaboration, and end on a hopeful tone for busy students.",
        "Baseline prompt with full phrasing."
      ),
      compressed_english: createVariant(
        "compressed_english",
        "Compressed English",
        "Write a friendly launch blurb for a student note-taking app. Under 90 words. Mention offline sync and collaboration. End with a hopeful tone for busy students.",
        "Compressed English version for direct token comparison."
      ),
      chinese_translated: createVariant(
        "chinese_translated",
        "Chinese Translated",
        "\u4e3a\u4e00\u6b3e\u5b66\u751f\u7b14\u8bb0\u5e94\u7528\u5199\u4e00\u6bb5\u53cb\u597d\u7684\u4ea7\u54c1\u53d1\u5e03\u6587\u6848\u3002\u63a7\u5236\u572890\u4e2a\u82f1\u6587\u5355\u8bcd\u4ee5\u5185\uff0c\u63d0\u5230\u79bb\u7ebf\u540c\u6b65\u548c\u534f\u4f5c\u529f\u80fd\uff0c\u5e76\u4ee5\u5bf9\u5fd9\u788c\u5b66\u751f\u5145\u6ee1\u5e0c\u671b\u7684\u8bed\u6c14\u7ed3\u5c3e\u3002",
        "Chinese prompt variant used for translation-efficiency testing."
      )
    }
  },
  {
    id: "strict-format-bullets",
    title: "Strict Formatting: Bullets",
    category: "strict-formatting",
    description:
      "Checks whether formatting-heavy instructions survive compression or translation.",
    comparisonGoal:
      "Measure whether token savings cause bullet count or bullet length constraints to fail.",
    constraints: [
      {
        id: "format-bullet-count",
        label: "Exact bullet count",
        type: "exact_bullet_count",
        details: "Return exactly 4 bullet points.",
        target: 4
      },
      {
        id: "format-bullet-length",
        label: "Format rule",
        type: "format_rule",
        details: "Each bullet must be 6 words or fewer."
      },
      {
        id: "format-no-intro",
        label: "Required format",
        type: "format_rule",
        details: "No intro sentence and no closing sentence."
      }
    ],
    variants: {
      original_english: createVariant(
        "original_english",
        "Original English",
        "Summarize the advantages of electric buses for a city council. Return exactly 4 bullet points, each bullet 6 words or fewer, with no intro sentence and no closing sentence.",
        "Baseline strict formatting prompt."
      ),
      compressed_english: createVariant(
        "compressed_english",
        "Compressed English",
        "Electric bus benefits for a city council. Exactly 4 bullets. Each bullet 6 words or fewer. No intro or closing sentence.",
        "Compressed English version."
      ),
      chinese_translated: createVariant(
        "chinese_translated",
        "Chinese Translated",
        "\u603b\u7ed3\u7535\u52a8\u516c\u4ea4\u8f66\u5bf9\u5e02\u8bae\u4f1a\u7684\u4f18\u52bf\u3002\u5fc5\u987b\u53ea\u8fd4\u56de4\u4e2a\u8981\u70b9\uff0c\u6bcf\u4e2a\u8981\u70b9\u4e0d\u8d85\u8fc76\u4e2a\u82f1\u6587\u5355\u8bcd\uff0c\u4e0d\u8981\u5199\u5f00\u5934\u53e5\u6216\u7ed3\u5c3e\u53e5\u3002",
        "Chinese variant focused on preserving exact formatting."
      )
    }
  },
  {
    id: "coding-python-helper",
    title: "Coding: Python Helper",
    category: "coding",
    description:
      "Tests whether code-only constraints and implementation details survive prompt shortening.",
    comparisonGoal:
      "Check whether translated prompts still keep code-only behavior and implementation correctness.",
    constraints: [
      {
        id: "coding-function-only",
        label: "Format rule",
        type: "format_rule",
        details: "Return code only, with no explanation."
      },
      {
        id: "coding-language",
        label: "Language requirement",
        type: "language_requirement",
        details: "Return Python only.",
        target: "Python"
      },
      {
        id: "coding-required-content",
        label: "Required content",
        type: "required_content",
        details: "Must include type hints and handle division by zero."
      }
    ],
    variants: {
      original_english: createVariant(
        "original_english",
        "Original English",
        "Write a Python function called rolling_average that accepts a list of floats and a window size, returns a list of rolling averages, includes type hints, handles division by zero or invalid window sizes safely, and returns code only with no explanation.",
        "Baseline coding prompt."
      ),
      compressed_english: createVariant(
        "compressed_english",
        "Compressed English",
        "Python only. Write rolling_average(values: list[float], window: int) -> list[float]. Return rolling averages, include type hints, handle invalid windows safely, and return code only.",
        "Compressed English coding prompt."
      ),
      chinese_translated: createVariant(
        "chinese_translated",
        "Chinese Translated",
        "\u53ea\u8fd4\u56dePython\u4ee3\u7801\u3002\u7f16\u5199\u51fd\u6570 rolling_average(values: list[float], window: int) -> list[float]\uff0c\u8ba1\u7b97\u6ed1\u52a8\u5e73\u5747\u503c\uff0c\u5fc5\u987b\u5305\u542b\u7c7b\u578b\u63d0\u793a\uff0c\u5e76\u5b89\u5168\u5904\u7406\u65e0\u6548\u7a97\u53e3\u5927\u5c0f\u6216\u9664\u96f6\u95ee\u9898\u3002",
        "Chinese prompt variant for coding benchmark."
      )
    }
  },
  {
    id: "json-release-brief",
    title: "JSON: Structured Output",
    category: "json",
    description:
      "Measures whether valid-JSON constraints survive translation or compression.",
    comparisonGoal:
      "Check if the model keeps strict JSON formatting when the prompt is translated.",
    constraints: [
      {
        id: "json-valid-only",
        label: "Valid JSON only",
        type: "valid_json_only",
        details: "Return valid JSON only, with no markdown fences."
      },
      {
        id: "json-required-fields",
        label: "Required content",
        type: "required_content",
        details: "Include keys: title, audience, launch_risks, next_steps."
      },
      {
        id: "json-language",
        label: "Language requirement",
        type: "language_requirement",
        details: "All string values must be English.",
        target: "English"
      }
    ],
    variants: {
      original_english: createVariant(
        "original_english",
        "Original English",
        "Return valid JSON only. Summarize a launch brief for a campus budgeting app with these keys: title, audience, launch_risks, next_steps. Use English strings only and do not include markdown fences.",
        "Baseline structured-output prompt."
      ),
      compressed_english: createVariant(
        "compressed_english",
        "Compressed English",
        "Valid JSON only. Campus budgeting app launch brief. Keys: title, audience, launch_risks, next_steps. English strings only. No markdown fences.",
        "Compressed English JSON prompt."
      ),
      chinese_translated: createVariant(
        "chinese_translated",
        "Chinese Translated",
        "\u53ea\u8fd4\u56de\u6709\u6548JSON\uff0c\u4e0d\u8981\u4f7f\u7528Markdown\u4ee3\u7801\u5757\u3002\u4e3a\u6821\u56ed\u9884\u7b97\u5e94\u7528\u751f\u6210\u53d1\u5e03\u6458\u8981\uff0c\u5fc5\u987b\u5305\u542b title\u3001audience\u3001launch_risks\u3001next_steps \u56db\u4e2a\u952e\uff0c\u5e76\u4e14\u6240\u6709\u5b57\u7b26\u4e32\u503c\u90fd\u4f7f\u7528\u82f1\u6587\u3002",
        "Chinese prompt variant for JSON-only testing."
      )
    }
  },
  {
    id: "analysis-vendor-choice",
    title: "Analysis: Vendor Choice",
    category: "analysis",
    description:
      "Tests whether recommendation quality and explicit tradeoff constraints remain intact.",
    comparisonGoal:
      "Compare whether the translated prompt keeps the recommendation, tradeoff framing, and risk callout.",
    constraints: [
      {
        id: "analysis-three-options",
        label: "Required content",
        type: "required_content",
        details: "Must compare exactly 3 vendor options."
      },
      {
        id: "analysis-risk",
        label: "Required content",
        type: "required_content",
        details: "Must include one risk for the recommended option."
      },
      {
        id: "analysis-word-limit",
        label: "Word limit",
        type: "word_limit",
        details: "Keep the answer under 150 words.",
        target: 150
      }
    ],
    variants: {
      original_english: createVariant(
        "original_english",
        "Original English",
        "Compare three analytics vendors for a small product team. Recommend one option, explain the tradeoffs briefly, include one risk for the recommended option, and keep the answer under 150 words.",
        "Baseline analysis prompt."
      ),
      compressed_english: createVariant(
        "compressed_english",
        "Compressed English",
        "Compare 3 analytics vendors for a small product team. Recommend 1, give brief tradeoffs, include 1 risk for the recommended option, under 150 words.",
        "Compressed English analysis prompt."
      ),
      chinese_translated: createVariant(
        "chinese_translated",
        "Chinese Translated",
        "\u6bd4\u8f83\u9002\u5408\u5c0f\u578b\u4ea7\u54c1\u56e2\u961f\u76843\u4e2a\u5206\u6790\u5de5\u5177\u4f9b\u5e94\u5546\u3002\u63a8\u8350\u5176\u4e2d1\u4e2a\uff0c\u7b80\u8981\u8bf4\u660e\u53d6\u820d\uff0c\u5e76\u6307\u51fa\u8be5\u63a8\u8350\u65b9\u6848\u76841\u4e2a\u98ce\u9669\u3002\u56de\u7b54\u63a7\u5236\u5728150\u4e2a\u82f1\u6587\u5355\u8bcd\u4ee5\u5185\u3002",
        "Chinese prompt variant for analysis testing."
      )
    }
  }
] as const;
