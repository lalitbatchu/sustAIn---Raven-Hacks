// TEMPORARY INTERNAL BENCHMARK TOOLING.
// Remove this file and the rest of src/internal-benchmark after the translation experiment.

export type BenchmarkCategory =
  | "writing"
  | "strict-formatting"
  | "coding"
  | "json"
  | "analysis";

export type BenchmarkMethod =
  | "original_english"
  | "compressed_english"
  | "chinese_translated";

export type ConstraintType =
  | "word_limit"
  | "exact_bullet_count"
  | "valid_json_only"
  | "language_requirement"
  | "format_rule"
  | "required_content";

export type ConstraintCheckStatus = "untested" | "pass" | "partial" | "fail";

export type BenchmarkConstraint = {
  id: string;
  label: string;
  type: ConstraintType;
  details: string;
  target?: number | string | string[];
};

export type BenchmarkVariant = {
  method: BenchmarkMethod;
  label: string;
  promptText: string;
  notes: string;
  inputTokens: number;
};

export type BenchmarkPromptCase = {
  id: string;
  title: string;
  category: BenchmarkCategory;
  description: string;
  comparisonGoal: string;
  constraints: BenchmarkConstraint[];
  variants: Record<BenchmarkMethod, BenchmarkVariant>;
};

export type BenchmarkMethodResult = {
  outputText: string;
  manualQualityRating: number | null;
  preservedConstraints: ConstraintCheckStatus;
};

export type BenchmarkPromptRecord = {
  promptId: string;
  category: BenchmarkCategory;
  methods: Record<BenchmarkMethod, BenchmarkMethodResult>;
  updatedAt: string | null;
};

export type BenchmarkState = {
  records: Record<string, BenchmarkPromptRecord>;
  lastExportedAt: string | null;
};

export type ExportedBenchmarkRow = {
  promptId: string;
  title: string;
  category: BenchmarkCategory;
  method: BenchmarkMethod;
  inputTokens: number;
  reductionVsOriginal: number;
  promptText: string;
  outputText: string;
  outputTokens: number;
  preservedConstraints: ConstraintCheckStatus;
  manualQualityRating: number | null;
  updatedAt: string | null;
};
