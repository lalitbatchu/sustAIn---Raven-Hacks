// TEMPORARY INTERNAL EXPERIMENT TOOLING.
// Remove this file and the rest of src/internal-benchmark after the translation experiment.

import { useEffect, useMemo, useState } from "react";
import { Download, Eraser, FlaskConical, Languages, Sparkles } from "lucide-react";
import "../style.css";
import "./benchmark.css";
import { INTERNAL_BENCHMARK_PROMPTS } from "./dataset";
import {
  createDefaultBenchmarkState,
  exportBenchmarkResults,
  loadBenchmarkState,
  saveBenchmarkState
} from "./storage";
import type {
  BenchmarkMethod,
  BenchmarkMethodResult,
  BenchmarkPromptCase,
  BenchmarkState,
  ConstraintCheckStatus
} from "./types";
import { countPromptTokens } from "../utils/ecoStats";

const METHOD_ORDER: BenchmarkMethod[] = [
  "original_english",
  "compressed_english",
  "chinese_translated"
];

const QUALITY_OPTIONS = [1, 2, 3, 4, 5] as const;
const PRESERVATION_OPTIONS: ConstraintCheckStatus[] = [
  "untested",
  "pass",
  "partial",
  "fail"
];

const PRESERVATION_RANK: Record<ConstraintCheckStatus, number> = {
  untested: 0,
  pass: 3,
  partial: 2,
  fail: 1
};

function methodTitle(method: BenchmarkMethod) {
  switch (method) {
    case "original_english":
      return "Original English";
    case "compressed_english":
      return "Compressed English";
    case "chinese_translated":
      return "Chinese Translated";
  }
}

function methodDescription(method: BenchmarkMethod) {
  switch (method) {
    case "original_english":
      return "Full prompt baseline";
    case "compressed_english":
      return "Current compression path";
    case "chinese_translated":
      return "Translation experiment";
  }
}

function preservationLabel(status: ConstraintCheckStatus) {
  switch (status) {
    case "untested":
      return "Untested";
    case "pass":
      return "Pass";
    case "partial":
      return "Partial";
    case "fail":
      return "Fail";
  }
}

function qualityLabel(rating: number | null) {
  if (rating == null) return "Unrated";
  switch (rating) {
    case 1:
      return "Poor";
    case 2:
      return "Weak";
    case 3:
      return "Acceptable";
    case 4:
      return "Strong";
    case 5:
      return "Excellent";
    default:
      return `${rating}/5`;
  }
}

function reductionVsOriginal(
  prompt: BenchmarkPromptCase,
  method: BenchmarkMethod
) {
  const originalTokens = prompt.variants.original_english.inputTokens;
  const currentTokens = prompt.variants[method].inputTokens;

  if (method === "original_english" || originalTokens <= 0) {
    return 0;
  }

  return Math.max(
    0,
    Math.round(((originalTokens - currentTokens) / originalTokens) * 100)
  );
}

function formatWinner(methods: BenchmarkMethod[]) {
  if (methods.length === 0) return "Not enough data yet";
  return methods.map((method) => methodTitle(method)).join(" / ");
}

type VariantCardProps = {
  prompt: BenchmarkPromptCase;
  method: BenchmarkMethod;
};

function VariantCard({ prompt, method }: VariantCardProps) {
  const variant = prompt.variants[method];
  const reduction = reductionVsOriginal(prompt, method);

  return (
    <article className={`experiment-card experiment-variant-card is-${method}`}>
      <div className="experiment-card-topline">
        <div>
          <h3>{methodTitle(method)}</h3>
          <p>{methodDescription(method)}</p>
        </div>
        <div className="experiment-token-stack">
          <span>{variant.inputTokens} tokens</span>
          <strong>
            {method === "original_english" ? "Baseline" : `${reduction}% less`}
          </strong>
        </div>
      </div>

      <div className="experiment-prompt-box">
        <p>{variant.promptText}</p>
      </div>

      <div className="experiment-card-footnote">{variant.notes}</div>
    </article>
  );
}

type OutputCardProps = {
  method: BenchmarkMethod;
  prompt: BenchmarkPromptCase;
  result: BenchmarkMethodResult;
  onUpdateResult: (method: BenchmarkMethod, next: BenchmarkMethodResult) => void;
};

function OutputCard({
  method,
  prompt,
  result,
  onUpdateResult
}: OutputCardProps) {
  const outputTokens = useMemo(
    () => (result.outputText.trim() ? countPromptTokens(result.outputText) : 0),
    [result.outputText]
  );

  const update = (patch: Partial<BenchmarkMethodResult>) => {
    onUpdateResult(method, {
      ...result,
      ...patch
    });
  };

  return (
    <article className={`experiment-card experiment-output-card is-${method}`}>
      <div className="experiment-card-topline">
        <div>
          <h3>{methodTitle(method)}</h3>
          <p>{methodDescription(method)}</p>
        </div>
        <div className="experiment-output-meta">
          <span>Output</span>
          <strong>{outputTokens} tokens</strong>
        </div>
      </div>

      <label className="experiment-field">
        <span className="experiment-field-label">Model Output</span>
        <textarea
          value={result.outputText}
          onChange={(event) => update({ outputText: event.target.value })}
          placeholder={`Paste the ${methodTitle(method).toLowerCase()} output here...`}
          rows={12}
        />
      </label>

      <div className="experiment-control-block">
        <div className="experiment-field">
          <span className="experiment-field-label">Manual Quality</span>
          <div className="experiment-pill-row">
            {QUALITY_OPTIONS.map((rating) => (
              <button
                key={rating}
                className={`experiment-pill-button ${
                  result.manualQualityRating === rating ? "is-active" : ""
                }`}
                onClick={() =>
                  update({
                    manualQualityRating:
                      result.manualQualityRating === rating ? null : rating
                  })
                }
                type="button"
              >
                {rating}
              </button>
            ))}
          </div>
          <small>{qualityLabel(result.manualQualityRating)}</small>
        </div>

        <div className="experiment-field">
          <span className="experiment-field-label">Constraint Preservation</span>
          <div className="experiment-pill-row is-wide">
            {PRESERVATION_OPTIONS.map((status) => (
              <button
                key={status}
                className={`experiment-pill-button ${
                  result.preservedConstraints === status ? "is-active" : ""
                }`}
                onClick={() => update({ preservedConstraints: status })}
                type="button"
              >
                {preservationLabel(status)}
              </button>
            ))}
          </div>
          <small>
            Check whether the main prompt constraints still held for this output.
          </small>
        </div>
      </div>

      <div className="experiment-card-footnote">
        Input: {prompt.variants[method].inputTokens} tokens
        {method === "original_english"
          ? " | Baseline"
          : ` | ${reductionVsOriginal(prompt, method)}% less than original`}
      </div>
    </article>
  );
}

function buildSummary(prompt: BenchmarkPromptCase, record: BenchmarkState["records"][string]) {
  const methods = METHOD_ORDER.map((method) => {
    const variant = prompt.variants[method];
    const result = record.methods[method];
    return {
      method,
      inputTokens: variant.inputTokens,
      reduction: reductionVsOriginal(prompt, method),
      outputTokens: result.outputText.trim() ? countPromptTokens(result.outputText) : 0,
      hasOutput: Boolean(result.outputText.trim()),
      quality: result.manualQualityRating,
      preservation: result.preservedConstraints,
      preservationRank: PRESERVATION_RANK[result.preservedConstraints]
    };
  });

  const lowestInput = Math.min(...methods.map((item) => item.inputTokens));
  const lowestInputMethods = methods
    .filter((item) => item.inputTokens === lowestInput)
    .map((item) => item.method);

  const ratedMethods = methods.filter((item) => item.quality != null);
  const bestQualityScore =
    ratedMethods.length > 0
      ? Math.max(...ratedMethods.map((item) => item.quality ?? 0))
      : null;
  const bestQualityMethods =
    bestQualityScore == null
      ? []
      : ratedMethods
          .filter((item) => item.quality === bestQualityScore)
          .map((item) => item.method);

  const testedPreservationMethods = methods.filter(
    (item) => item.preservation !== "untested"
  );
  const bestPreservationScore =
    testedPreservationMethods.length > 0
      ? Math.max(...testedPreservationMethods.map((item) => item.preservationRank))
      : null;
  const bestPreservationMethods =
    bestPreservationScore == null
      ? []
      : testedPreservationMethods
          .filter((item) => item.preservationRank === bestPreservationScore)
          .map((item) => item.method);

  const chinese = methods.find((item) => item.method === "chinese_translated")!;
  const compressed = methods.find((item) => item.method === "compressed_english")!;

  const readyForVerdict =
    methods.every((item) => item.hasOutput) &&
    chinese.quality != null &&
    compressed.quality != null &&
    chinese.preservation !== "untested" &&
    compressed.preservation !== "untested";

  let verdict =
    "Paste outputs for all three variants, then rate quality and constraints to unlock a recommendation.";

  if (readyForVerdict) {
    const chineseWinsTokens = chinese.inputTokens < compressed.inputTokens;
    const chineseKeepsQuality =
      (chinese.quality ?? 0) >= (compressed.quality ?? 0);
    const chineseKeepsConstraints =
      chinese.preservationRank >= compressed.preservationRank;

    if (chineseWinsTokens && chineseKeepsQuality && chineseKeepsConstraints) {
      verdict =
        "Chinese currently looks worth deeper testing: it saves more input tokens without losing your current quality or constraint marks.";
    } else if (chineseWinsTokens) {
      verdict =
        "Chinese saves more input tokens, but compressed English is currently holding quality or constraints more reliably.";
    } else {
      verdict =
        "Compressed English currently looks like the better tradeoff: it stays lean without adding a translation step.";
    }
  }

  return {
    outputsCaptured: methods.filter((item) => item.hasOutput).length,
    ratingsCaptured: methods.filter((item) => item.quality != null).length,
    constraintChecksCaptured: methods.filter((item) => item.preservation !== "untested")
      .length,
    lowestInput: {
      value: lowestInput,
      methods: lowestInputMethods
    },
    bestQuality: {
      value: bestQualityScore,
      methods: bestQualityMethods
    },
    bestPreservation: {
      value: bestPreservationScore,
      methods: bestPreservationMethods
    },
    verdict
  };
}

export default function BenchmarkApp() {
  const [state, setState] = useState<BenchmarkState>(createDefaultBenchmarkState());
  const [selectedPromptId, setSelectedPromptId] = useState(
    INTERNAL_BENCHMARK_PROMPTS[0]?.id ?? ""
  );
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let mounted = true;

    void loadBenchmarkState().then((nextState) => {
      if (!mounted) return;
      setState(nextState);
      setLoaded(true);
    });

    return () => {
      mounted = false;
    };
  }, []);

  const selectedPrompt =
    INTERNAL_BENCHMARK_PROMPTS.find((prompt) => prompt.id === selectedPromptId) ??
    INTERNAL_BENCHMARK_PROMPTS[0];

  const selectedRecord = state.records[selectedPrompt.id];

  const commitState = (nextState: BenchmarkState) => {
    setState(nextState);
    void saveBenchmarkState(nextState);
  };

  const updateMethodResult = (
    method: BenchmarkMethod,
    nextResult: BenchmarkMethodResult
  ) => {
    commitState({
      ...state,
      records: {
        ...state.records,
        [selectedPrompt.id]: {
          ...selectedRecord,
          updatedAt: new Date().toISOString(),
          methods: {
            ...selectedRecord.methods,
            [method]: nextResult
          }
        }
      }
    });
  };

  const resetSelectedPrompt = () => {
    const defaults = createDefaultBenchmarkState();
    commitState({
      ...state,
      records: {
        ...state.records,
        [selectedPrompt.id]: defaults.records[selectedPrompt.id]
      }
    });
  };

  const exportResults = async () => {
    await exportBenchmarkResults(state);
    commitState({
      ...state,
      lastExportedAt: new Date().toISOString()
    });
  };

  const summary = useMemo(
    () => buildSummary(selectedPrompt, selectedRecord),
    [selectedPrompt, selectedRecord]
  );

  if (!loaded) {
    return <div className="benchmark-loading">Loading internal experiment...</div>;
  }

  return (
    <div className="benchmark-shell">
      <aside className="benchmark-sidebar">
        <div className="benchmark-sidebar-header">
          <div className="benchmark-badge">
            <FlaskConical size={16} />
            <span>Temporary Internal Experiment</span>
          </div>
          <h1>SustAIn Prompt Experiment</h1>
          <p>
            Quick check for whether Chinese prompt translation beats compressed
            English on token savings without clearly hurting output quality.
          </p>
        </div>

        <div className="benchmark-sidebar-card">
          <span className="experiment-field-label">Fast Workflow</span>
          <ol className="benchmark-steps-list">
            <li>Pick one prompt.</li>
            <li>Run the 3 prompt variants in the same model.</li>
            <li>Paste the outputs and click one quality score plus one constraint check.</li>
            <li>Read the winner panel.</li>
          </ol>
        </div>

        <div className="benchmark-prompt-list">
          {INTERNAL_BENCHMARK_PROMPTS.map((prompt) => (
            <button
              key={prompt.id}
              className={`benchmark-prompt-button ${
                prompt.id === selectedPrompt.id ? "is-active" : ""
              }`}
              onClick={() => setSelectedPromptId(prompt.id)}
              type="button"
            >
              <span className="benchmark-prompt-category">{prompt.category}</span>
              <strong>{prompt.title}</strong>
              <small>{prompt.comparisonGoal}</small>
            </button>
          ))}
        </div>
      </aside>

      <main className="benchmark-main">
        <header className="benchmark-main-header">
          <div>
            <div className="benchmark-inline-badge">
              <Languages size={14} />
              <span>Original vs Compressed vs Chinese</span>
            </div>
            <h2>{selectedPrompt.title}</h2>
            <p>{selectedPrompt.description}</p>
          </div>

          <div className="benchmark-toolbar">
            <button
              className="benchmark-toolbar-button"
              onClick={resetSelectedPrompt}
              type="button"
            >
              <Eraser size={14} />
              <span>Reset Prompt</span>
            </button>
            <button
              className="benchmark-toolbar-button is-primary"
              onClick={() => void exportResults()}
              type="button"
            >
              <Download size={14} />
              <span>Export JSON</span>
            </button>
          </div>
        </header>

        <section className="experiment-card-grid">
          {METHOD_ORDER.map((method) => (
            <VariantCard key={method} method={method} prompt={selectedPrompt} />
          ))}
        </section>

        <section className="experiment-output-grid">
          {METHOD_ORDER.map((method) => (
            <OutputCard
              key={method}
              method={method}
              prompt={selectedPrompt}
              result={selectedRecord.methods[method]}
              onUpdateResult={updateMethodResult}
            />
          ))}
        </section>

        <section className="experiment-summary-layout">
          <article className="experiment-card experiment-summary-card">
            <div className="experiment-summary-header">
              <div>
                <span className="experiment-field-label">Automatic Summary</span>
                <h3>Current Winner Panel</h3>
              </div>
              <div className="benchmark-inline-badge">
                <Sparkles size={14} />
                <span>Decision Aid</span>
              </div>
            </div>

            <div className="experiment-summary-metrics">
              <div className="experiment-summary-metric">
                <span>Lowest input tokens</span>
                <strong>{formatWinner(summary.lowestInput.methods)}</strong>
                <small>{summary.lowestInput.value} tokens</small>
              </div>
              <div className="experiment-summary-metric">
                <span>Best manual quality</span>
                <strong>{formatWinner(summary.bestQuality.methods)}</strong>
                <small>
                  {summary.bestQuality.value == null
                    ? "Rate the outputs to compare"
                    : `${summary.bestQuality.value}/5`}
                </small>
              </div>
              <div className="experiment-summary-metric">
                <span>Best constraint preservation</span>
                <strong>{formatWinner(summary.bestPreservation.methods)}</strong>
                <small>
                  {summary.bestPreservation.value == null
                    ? "Mark one constraint result"
                    : "Best current mark"}
                </small>
              </div>
            </div>

            <div className="experiment-summary-readiness">
              <span>{summary.outputsCaptured}/3 outputs captured</span>
              <span>{summary.ratingsCaptured}/3 quality ratings</span>
              <span>{summary.constraintChecksCaptured}/3 constraint checks</span>
            </div>

            <div className="experiment-verdict-box">
              <span className="experiment-field-label">Current Call</span>
              <p>{summary.verdict}</p>
            </div>
          </article>

          <article className="experiment-card experiment-summary-card">
            <span className="experiment-field-label">What To Watch</span>
            <h3>Key Constraints</h3>
            <ul className="experiment-constraint-list">
              {selectedPrompt.constraints.map((constraint) => (
                <li key={constraint.id}>{constraint.details}</li>
              ))}
            </ul>
            <div className="experiment-card-footnote">
              Last export: {state.lastExportedAt ?? "Not exported yet"}
            </div>
          </article>
        </section>
      </main>
    </div>
  );
}
