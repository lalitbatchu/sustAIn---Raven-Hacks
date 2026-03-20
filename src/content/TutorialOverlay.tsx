import { useEffect, useRef, useState, type CSSProperties } from "react";
import { setGeminiPromptValue } from "../utils/geminiDomUtils";
import { setPromptValue } from "../utils/domUtils";
import {
  TUTORIAL_COMPARISON_OUTPUTS,
  TUTORIAL_COMPARISON_STATS,
  TUTORIAL_COMPARISON_VALIDATIONS
} from "./tutorialComparisonData";
import {
  DEFAULT_STORAGE_STATE,
  getStorage,
  setStorage,
  type StorageState
} from "../utils/storage";

type TutorialStep = {
  title: string;
  content: string;
  emphasis?: string;
  buttonText?: string;
  waitForAction?: "compress" | "undo";
};

type EditableElement = HTMLTextAreaElement | HTMLElement;
type ConfettiOptions = {
  particleCount: number;
  spread: number;
  origin: { y: number };
  colors: string[];
};

const HOSTNAME = window.location.hostname;
const IS_CHATGPT =
  HOSTNAME === "chatgpt.com" || HOSTNAME.endsWith(".chatgpt.com");
const IS_GEMINI = HOSTNAME === "gemini.google.com";
const IS_CLAUDE = HOSTNAME === "claude.ai" || HOSTNAME.endsWith(".claude.ai");
const IS_GROK = HOSTNAME === "grok.com" || HOSTNAME.endsWith(".grok.com");
const IS_COPILOT = HOSTNAME === "copilot.microsoft.com";
const IS_DEEPSEEK = HOSTNAME === "chat.deepseek.com";
const IS_PERPLEXITY =
  HOSTNAME === "perplexity.ai" || HOSTNAME === "www.perplexity.ai";

const SAMPLE_TEXT =
  "I am actually really very interested in understanding, in a detailed and step-by-step way, the process by which the water on Earth evaporates from oceans, lakes, and rivers, rises into the atmosphere to form clouds, and then eventually falls back to the ground as rain, snow, sleet, or hail, and I would like you to please explain why this process is so extremely important for all life on our planet.";
const COMPARE_RESULTS_STEP_INDEX = 3;
const COMPRESSION_LEVEL_STEP_INDEX = 5;
const STATS_PREVIEW_STEP_INDEX = 6;
const TUTORIAL_RUNTIME_FLAG = "__petTutorialKeepVisible";
const COMPARISON_TRANSITION_MS = 220;
const TUTORIAL_DROPDOWN_OPEN_EVENT = "eco-tutorial-open-compression-menu";
const TUTORIAL_DROPDOWN_CLOSE_EVENT = "eco-tutorial-close-compression-menu";

const TUTORIAL_STEPS: TutorialStep[] = [
  {
    title: "SustAIn",
    content:
      "SustAIn shortens AI prompts so you can fit more instructions within model limits and reduce token usage, while also lowering the energy and water used by large AI models.",
    buttonText: "Start Tutorial"
  },
  {
    title: "Let's Try a Sample",
    content:
      "To see how much you can save, we need a long, inefficient prompt. Don't worry about typing it, we'll paste it for you.",
    buttonText: "Paste Sample Prompt"
  },
  {
    title: "Compress the Prompt",
    content:
      'Click the green "Compress" button below to shorten this prompt and save tokens.',
    waitForAction: "compress"
  },
  {
    title: "Compare the Results",
    content:
      "These are real outputs from the original and compressed versions of the same prompt. Even though the compressed prompt looks less natural, the model still understands the key instructions and produces a very similar response.",
    buttonText: "Next"
  },
  {
    title: "Undo Capability",
    content:
      "Not happy with the result? You can always click Undo to revert to your original text.",
    waitForAction: "undo"
  },
  {
    title: "Choose Compression Level",
    content: "Use the dropdown next to Compress to choose your compression level.",
    emphasis:
      "The compressed prompt may look less natural to you, but models can still read the key instructions effectively.",
    buttonText: "Next"
  },
  {
    title: "Track Your Usage & Impact Savings",
    content:
      "Click the extension icon in your toolbar to view your usage and savings stats and customize your settings.",
    buttonText: "Next"
  },
  {
    title: "You're All Set!",
    content:
      "You're ready to start reducing token usage and lowering the environmental cost of AI. Your prompts stay private, and the tool does not collect personal data.",
    buttonText: "Finish & Start Saving"
  }
];

const launchConfetti = ({
  particleCount,
  spread,
  origin,
  colors
}: ConfettiOptions) => {
  const canvas = document.createElement("canvas");
  canvas.style.position = "fixed";
  canvas.style.inset = "0";
  canvas.style.width = "100vw";
  canvas.style.height = "100vh";
  canvas.style.pointerEvents = "none";
  // Keep z-index in browser-safe range; values above 2147483647 can overflow.
  canvas.style.zIndex = "2147483647";

  (document.body ?? document.documentElement).appendChild(canvas);
  const context = canvas.getContext("2d");
  if (!context) {
    canvas.remove();
    return;
  }

  const dpr = window.devicePixelRatio || 1;
  let width = window.innerWidth;
  let height = window.innerHeight;
  const resize = () => {
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  resize();
  window.addEventListener("resize", resize);

  const spreadRadians = (spread * Math.PI) / 180;
  const originX = width / 2;
  const originY = Math.max(0, height * origin.y);

  type Particle = {
    x: number;
    y: number;
    vx: number;
    vy: number;
    size: number;
    rotation: number;
    rotationSpeed: number;
    swayPhase: number;
    swayAmplitude: number;
    gravity: number;
    drag: number;
    age: number;
    maxAge: number;
    color: string;
  };

  const particles: Particle[] = Array.from({ length: particleCount }, () => {
    const xJitter = (Math.random() - 0.5) * width * 0.45;
    const angle = -Math.PI / 2 + (Math.random() - 0.5) * spreadRadians;
    const lift = 3 + Math.random() * 4;
    const fall = 1 + Math.random() * 2.5;

    return {
      x: originX + xJitter,
      y: -20 - Math.random() * (originY * 0.35),
      vx: Math.cos(angle) * lift,
      vy: fall,
      size: 9 + Math.random() * 9,
      rotation: Math.random() * Math.PI * 2,
      rotationSpeed: (Math.random() - 0.5) * 0.14,
      swayPhase: Math.random() * Math.PI * 2,
      swayAmplitude: 0.4 + Math.random() * 1.2,
      gravity: 0.05 + Math.random() * 0.06,
      drag: 0.995,
      age: 0,
      maxAge: 280 + Math.random() * 120,
      color: colors[Math.floor(Math.random() * colors.length)]
    };
  });

  const tick = () => {
    context.clearRect(0, 0, width, height);

    let activeParticles = 0;
    for (const particle of particles) {
      if (particle.age >= particle.maxAge) continue;
      if (particle.y > height + 60) continue;

      activeParticles += 1;
      particle.age += 1;
      particle.vx *= particle.drag;
      particle.vy = particle.vy * particle.drag + particle.gravity;
      particle.swayPhase += 0.045;

      particle.x += particle.vx + Math.sin(particle.swayPhase) * particle.swayAmplitude;
      particle.y += particle.vy;
      particle.rotation += particle.rotationSpeed;

      const lifeProgress = particle.age / particle.maxAge;
      const alpha = lifeProgress < 0.85 ? 1 : Math.max(0, 1 - (lifeProgress - 0.85) / 0.15);

      context.save();
      context.translate(particle.x, particle.y);
      context.rotate(particle.rotation);
      context.globalAlpha = alpha;
      context.fillStyle = particle.color;
      const pieceWidth = particle.size;
      const pieceHeight = particle.size * 0.55;
      context.fillRect(
        -pieceWidth / 2,
        -pieceHeight / 2,
        pieceWidth,
        pieceHeight
      );
      context.restore();
    }

    if (activeParticles > 0) {
      requestAnimationFrame(tick);
      return;
    }

    window.removeEventListener("resize", resize);
    canvas.remove();
  };

  requestAnimationFrame(tick);
};

function querySelectorDeep<T extends Element>(
  root: ParentNode,
  selectors: string[]
): T | null {
  for (const selector of selectors) {
    const direct = root.querySelector<T>(selector);
    if (direct) return direct;
  }

  const nodes = root.querySelectorAll<HTMLElement>("*");
  for (const node of nodes) {
    if (!node.shadowRoot) continue;
    const found = querySelectorDeep<T>(node.shadowRoot, selectors);
    if (found) return found;
  }

  return null;
}

const isEditable = (element: Element | null): element is EditableElement => {
  if (!element) return false;
  if (element instanceof HTMLTextAreaElement) return true;
  return element instanceof HTMLElement && element.isContentEditable;
};

function findEditorNearInjectionHost(
  selectors: string[]
): EditableElement | null {
  const host = document.getElementById("prompt-efficiency-root");
  if (!host) return null;

  let node: HTMLElement | null = host;
  while (node) {
    const found = querySelectorDeep<EditableElement>(node, selectors);
    if (found && found.id !== "prompt-efficiency-root") return found;
    node = node.parentElement;
  }

  return null;
}

const isElementVisible = (element: Element | null): element is HTMLElement => {
  if (!(element instanceof HTMLElement)) return false;
  const style = window.getComputedStyle(element);
  if (style.display === "none" || style.visibility === "hidden") return false;
  const rect = element.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
};

const findInjectedActionButton = (buttonId: string): HTMLElement | null => {
  const hosts = Array.from(
    document.querySelectorAll<HTMLElement>("#prompt-efficiency-root")
  );

  let fallback: HTMLElement | null = null;

  for (const host of hosts) {
    const shadowRoot = host.shadowRoot;
    if (!shadowRoot) continue;

    const candidate = shadowRoot.getElementById(buttonId);
    if (!(candidate instanceof HTMLElement)) continue;
    if (isElementVisible(candidate)) return candidate;
    fallback = fallback ?? candidate;
  }

  const deepCandidate = querySelectorDeep<HTMLElement>(document, [`#${buttonId}`]);
  if (deepCandidate && isElementVisible(deepCandidate)) return deepCandidate;

  return deepCandidate ?? fallback;
};

const normalizeText = (value: string) => value.replace(/\s+/g, " ").trim();

const setTextareaValue = (textarea: HTMLTextAreaElement, value: string) => {
  const descriptor = Object.getOwnPropertyDescriptor(
    HTMLTextAreaElement.prototype,
    "value"
  );
  const setter = descriptor?.set;
  if (setter) {
    setter.call(textarea, value);
  } else {
    textarea.value = value;
  }
  textarea.dispatchEvent(new Event("input", { bubbles: true }));
  textarea.dispatchEvent(new Event("change", { bubbles: true }));
};

const dispatchInputEvent = (
  editor: HTMLElement,
  inputType: string,
  data: string | null
) => {
  if (typeof InputEvent !== "undefined") {
    editor.dispatchEvent(
      new InputEvent("input", {
        bubbles: true,
        cancelable: true,
        inputType,
        data
      })
    );
  } else {
    editor.dispatchEvent(new Event("input", { bubbles: true }));
  }
  editor.dispatchEvent(new Event("change", { bubbles: true }));
};

const selectEditorContents = (editor: HTMLElement): boolean => {
  const selection = window.getSelection();
  if (!selection) return false;
  editor.focus();
  const range = document.createRange();
  range.selectNodeContents(editor);
  selection.removeAllRanges();
  selection.addRange(range);
  return true;
};

const writeContentEditable = (editor: HTMLElement, value: string): boolean => {
  editor.focus();
  if (!selectEditorContents(editor)) return false;

  if (typeof InputEvent !== "undefined") {
    editor.dispatchEvent(
      new InputEvent("beforeinput", {
        bubbles: true,
        cancelable: true,
        inputType: "deleteByCut"
      })
    );
  }

  document.execCommand("delete", false);

  if (value.length === 0) {
    dispatchInputEvent(editor, "deleteContentBackward", null);
    return true;
  }

  let replaced = false;
  if (typeof DataTransfer !== "undefined" && typeof ClipboardEvent !== "undefined") {
    const dataTransfer = new DataTransfer();
    dataTransfer.setData("text/plain", value);
    if (typeof InputEvent !== "undefined") {
      editor.dispatchEvent(
        new InputEvent("beforeinput", {
          bubbles: true,
          cancelable: true,
          inputType: "insertFromPaste",
          data: value
        })
      );
    }
    const pasteEvent = new ClipboardEvent("paste", {
      bubbles: true,
      cancelable: true,
      clipboardData: dataTransfer
    });
    replaced = editor.dispatchEvent(pasteEvent);
  }

  if (!replaced) {
    if (typeof InputEvent !== "undefined") {
      editor.dispatchEvent(
        new InputEvent("beforeinput", {
          bubbles: true,
          cancelable: true,
          inputType: "insertText",
          data: value
        })
      );
    }
    document.execCommand("insertText", false, value);
  }

  dispatchInputEvent(editor, "insertText", value);
  return true;
};

const getChatGPTEditor = (): EditableElement | null =>
  querySelectorDeep<EditableElement>(document, [
    "textarea#prompt-textarea",
    'textarea[data-testid="prompt-textarea"]',
    'textarea[name="prompt-textarea"]',
    'div#prompt-textarea[contenteditable="true"]',
    'div[contenteditable="true"][data-testid="prompt-textarea"]',
    'div[contenteditable="true"][aria-label="Message"]',
    'div[contenteditable="true"][aria-label="Message ChatGPT"]'
  ]);

const getClaudeEditor = (): HTMLElement | null =>
  querySelectorDeep<HTMLElement>(document, [
    'div[contenteditable="true"][role="textbox"]',
    'div[contenteditable="true"][data-slate-editor="true"]',
    'div[contenteditable="true"][data-lexical-editor="true"]',
    'div[contenteditable="true"]'
  ]);

const getGrokEditor = (): EditableElement | null => {
  const selectors = [
    "textarea",
    'div[contenteditable="true"][role="textbox"]',
    'div[contenteditable="true"][data-slate-editor="true"]',
    'div[contenteditable="true"][data-lexical-editor="true"]',
    'div[contenteditable="true"]'
  ];

  const scoped = findEditorNearInjectionHost(selectors);
  if (scoped && isElementVisible(scoped)) return scoped;

  const active = document.activeElement;
  if (isEditable(active) && isElementVisible(active)) return active;

  return querySelectorDeep<EditableElement>(document, selectors);
};

const getDeepSeekEditor = (): EditableElement | null =>
  querySelectorDeep<EditableElement>(document, [
    "textarea",
    'div[contenteditable="true"][role="textbox"]',
    'div[contenteditable="true"]'
  ]);

const getCopilotEditor = (): EditableElement | null => {
  const selectors = [
    'textarea[placeholder*="Copilot"]',
    'textarea[aria-label*="Copilot"]',
    'div[contenteditable="true"][aria-label*="Copilot"]',
    'div[contenteditable="true"][role="textbox"]',
    "textarea",
    'div[contenteditable="true"]'
  ];

  const active = document.activeElement;
  if (isEditable(active) && isElementVisible(active)) return active;

  const scoped = findEditorNearInjectionHost(selectors);
  if (scoped && isElementVisible(scoped)) return scoped;

  return querySelectorDeep<EditableElement>(document, selectors);
};

export default function TutorialOverlay() {
  const [hidden, setHidden] = useState(true);
  const [storageReady, setStorageReady] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [storageState, setStorageState] = useState<StorageState>(
    DEFAULT_STORAGE_STATE
  );
  const [comparisonPanelStyle, setComparisonPanelStyle] = useState<CSSProperties | null>(null);
  const [spotlightStyle, setSpotlightStyle] = useState<CSSProperties | null>(null);
  const [connectorStyle, setConnectorStyle] = useState<CSSProperties | null>(null);
  const [renderComparisonPanel, setRenderComparisonPanel] = useState(false);
  const [comparisonPanelVisible, setComparisonPanelVisible] = useState(false);
  const tutorialCardRef = useRef<HTMLDivElement | null>(null);
  const comparisonPanelRef = useRef<HTMLDivElement | null>(null);
  const lastFocusedEditorRef = useRef<EditableElement | null>(null);
  const celebratedFinalStepRef = useRef(false);
  const relevantStorageKeysRef = useRef(
    new Set([
      "totalTokens",
      "totalOriginalTokens",
      "totalCompressedTokens",
      "compressionPercent",
      "totalWater",
      "totalEnergy",
      "tokensSaved",
      "waterMlSaved",
      "energyWhSaved",
      "hasSeenTutorial"
    ])
  );

  const getRuntimeKeepVisible = () =>
    Boolean(
      (
        window as Window & {
          [TUTORIAL_RUNTIME_FLAG]?: boolean;
        }
      )[TUTORIAL_RUNTIME_FLAG]
    );

  const setRuntimeKeepVisible = (value: boolean) => {
    (
      window as Window & {
        [TUTORIAL_RUNTIME_FLAG]?: boolean;
      }
    )[TUTORIAL_RUNTIME_FLAG] = value;
  };

  useEffect(() => {
    let mounted = true;

    const syncStorageState = async () => {
      if (typeof chrome === "undefined" || !chrome.storage?.local) {
        return DEFAULT_STORAGE_STATE;
      }

      const state = await getStorage();
      if (!mounted) return state;
      setStorageState(state);
      return state;
    };

    const initializeTutorial = async () => {
      if (typeof chrome === "undefined" || !chrome.storage?.local) {
        setRuntimeKeepVisible(true);
        setHidden(false);
        setStorageReady(true);
        return;
      }

      const state = await syncStorageState();
      if (!mounted) return;

      const keepVisibleThisSession = getRuntimeKeepVisible();
      if (state.hasSeenTutorial && !keepVisibleThisSession) {
        setHidden(true);
        setStorageReady(true);
        return;
      }

      // Keep tutorial visible across host remounts in this tab/session.
      setRuntimeKeepVisible(true);

      if (state.hasSeenTutorial) {
        setHidden(false);
        setStorageReady(true);
        return;
      }

      const nextState = await setStorage({ hasSeenTutorial: true });
      if (!mounted) return;
      setStorageState(nextState);
      setHidden(false);
      setStorageReady(true);
    };

    void initializeTutorial();

    const storageListener = (
      changes: Record<string, chrome.storage.StorageChange>,
      area: string
    ) => {
      if (area !== "local") return;

      const hasRelevantChange = Object.keys(changes).some((key) =>
        relevantStorageKeysRef.current.has(key)
      );
      if (!hasRelevantChange) return;

      void syncStorageState();
    };

    if (typeof chrome !== "undefined" && chrome.storage?.onChanged) {
      chrome.storage.onChanged.addListener(storageListener);
    }

    return () => {
      mounted = false;
      if (typeof chrome !== "undefined" && chrome.storage?.onChanged) {
        chrome.storage.onChanged.removeListener(storageListener);
      }
    };
  }, []);

  useEffect(() => {
    const handleFocus = (event: FocusEvent) => {
      const target = event.target as Element | null;
      if (isEditable(target)) {
        lastFocusedEditorRef.current = target;
      }
    };

    document.addEventListener("focusin", handleFocus, true);
    return () => document.removeEventListener("focusin", handleFocus, true);
  }, []);

  const getPerplexityEditor = (): EditableElement | null => {
    const selection = window.getSelection();
    const anchorNode = selection?.anchorNode;
    const anchorElement =
      anchorNode instanceof HTMLElement ? anchorNode : anchorNode?.parentElement ?? null;
    const fromSelection = anchorElement?.closest<HTMLElement>(
      '#ask-input[contenteditable="true"], div[data-lexical-editor="true"][contenteditable="true"], div[contenteditable="true"][role="textbox"], div[contenteditable="true"]'
    );
    if (fromSelection && isElementVisible(fromSelection)) return fromSelection;

    const askInput = document.getElementById("ask-input");
    if (
      askInput instanceof HTMLElement &&
      askInput.isContentEditable &&
      isElementVisible(askInput)
    ) {
      return askInput;
    }

    const active = document.activeElement;
    if (isEditable(active) && isElementVisible(active)) return active;

    if (
      lastFocusedEditorRef.current &&
      lastFocusedEditorRef.current.isConnected &&
      isElementVisible(lastFocusedEditorRef.current)
    ) {
      return lastFocusedEditorRef.current;
    }

    return querySelectorDeep<EditableElement>(document, [
      '#ask-input[data-lexical-editor="true"][contenteditable="true"]',
      'div[data-lexical-editor="true"][contenteditable="true"]',
      ".ProseMirror",
      '#ask-input[contenteditable="true"]',
      "textarea",
      'div[contenteditable="true"][role="textbox"]',
      'div[contenteditable="true"]'
    ]);
  };

  const writePerplexityPrompt = (value: string): boolean => {
    const editor = getPerplexityEditor();
    if (!editor) return false;

    if (editor instanceof HTMLTextAreaElement) {
      setTextareaValue(editor, value);
      return true;
    }

    const expected = normalizeText(value);
    const current = () => normalizeText(editor.innerText ?? editor.textContent ?? "");

    const ensureFullEditorSelection = (): boolean => {
      if (!selectEditorContents(editor)) return false;
      const selected = normalizeText(window.getSelection()?.toString() ?? "");
      const currentText = current();
      return currentText.length === 0 || selected === currentText;
    };

    const replaceWithPaste = (): boolean => {
      if (!ensureFullEditorSelection()) return false;
      if (typeof DataTransfer === "undefined" || typeof ClipboardEvent === "undefined") {
        return false;
      }

      const dataTransfer = new DataTransfer();
      dataTransfer.setData("text/plain", value);
      if (typeof InputEvent !== "undefined") {
        editor.dispatchEvent(
          new InputEvent("beforeinput", {
            bubbles: true,
            cancelable: true,
            inputType: "insertFromPaste",
            data: value
          })
        );
      }
      const pasteEvent = new ClipboardEvent("paste", {
        bubbles: true,
        cancelable: true,
        clipboardData: dataTransfer
      });
      return editor.dispatchEvent(pasteEvent);
    };

    const replaceWithExec = (): boolean => {
      if (!ensureFullEditorSelection()) return false;

      if (typeof InputEvent !== "undefined") {
        editor.dispatchEvent(
          new InputEvent("beforeinput", {
            bubbles: true,
            cancelable: true,
            inputType: "deleteByCut"
          })
        );
      }

      document.execCommand("delete", false);
      if (typeof InputEvent !== "undefined") {
        editor.dispatchEvent(
          new InputEvent("beforeinput", {
            bubbles: true,
            cancelable: true,
            inputType: "insertText",
            data: value
          })
        );
      }

      const inserted = document.execCommand("insertText", false, value);
      dispatchInputEvent(editor, "insertText", value);
      return inserted;
    };

    editor.focus();
    replaceWithPaste();

    requestAnimationFrame(() => {
      if (current() === expected) return;
      replaceWithExec();
    });

    return true;
  };

  const handlePasteSample = () => {
    if (IS_GEMINI) {
      setGeminiPromptValue(SAMPLE_TEXT);
      return;
    }

    if (IS_CHATGPT) {
      // Reuse the same write path that powers ChatGPT compress/undo.
      setPromptValue(SAMPLE_TEXT);
      return;
    }

    if (IS_CLAUDE) {
      const editor = getClaudeEditor();
      if (!editor) return;
      writeContentEditable(editor, SAMPLE_TEXT);
      return;
    }

    if (IS_GROK) {
      const editor = getGrokEditor();
      if (!editor) return;
      if (editor instanceof HTMLTextAreaElement) {
        setTextareaValue(editor, SAMPLE_TEXT);
      } else {
        writeContentEditable(editor, SAMPLE_TEXT);
      }
      return;
    }

    if (IS_DEEPSEEK) {
      const editor = getDeepSeekEditor();
      if (!editor) return;
      if (editor instanceof HTMLTextAreaElement) {
        setTextareaValue(editor, SAMPLE_TEXT);
      } else {
        writeContentEditable(editor, SAMPLE_TEXT);
      }
      return;
    }

    if (IS_COPILOT) {
      const editor = getCopilotEditor();
      if (!editor) return;
      if (editor instanceof HTMLTextAreaElement) {
        setTextareaValue(editor, SAMPLE_TEXT);
      } else {
        writeContentEditable(editor, SAMPLE_TEXT);
      }
      return;
    }

    if (IS_PERPLEXITY) {
      writePerplexityPrompt(SAMPLE_TEXT);
      return;
    }

    const fallbackTextarea = querySelectorDeep<HTMLTextAreaElement>(document, [
      "textarea:not([disabled])"
    ]);
    if (fallbackTextarea) {
      setTextareaValue(fallbackTextarea, SAMPLE_TEXT);
      return;
    }

    const fallbackEditable = querySelectorDeep<HTMLElement>(document, [
      'div[contenteditable="true"]'
    ]);
    if (fallbackEditable) {
      writeContentEditable(fallbackEditable, SAMPLE_TEXT);
    }
  };

  const step = TUTORIAL_STEPS[currentStep];
  const isActionStep =
    step.waitForAction === "compress" || step.waitForAction === "undo";
  const isCompareResultsStep = currentStep === COMPARE_RESULTS_STEP_INDEX;
  const isCompressionLevelStep = currentStep === COMPRESSION_LEVEL_STEP_INDEX;
  const isStatsPreviewStep = currentStep === STATS_PREVIEW_STEP_INDEX;
  const isFinalStep = currentStep === TUTORIAL_STEPS.length - 1;

  useEffect(() => {
    let timerId = 0;

    if (isCompareResultsStep) {
      setRenderComparisonPanel(true);
      timerId = window.setTimeout(() => {
        setComparisonPanelVisible(true);
      }, 16);

      return () => {
        window.clearTimeout(timerId);
      };
    }

    setComparisonPanelVisible(false);

    if (renderComparisonPanel) {
      timerId = window.setTimeout(() => {
        setRenderComparisonPanel(false);
        setComparisonPanelStyle(null);
        setSpotlightStyle(null);
        setConnectorStyle(null);
      }, COMPARISON_TRANSITION_MS);
    } else {
      setComparisonPanelStyle(null);
      setSpotlightStyle(null);
      setConnectorStyle(null);
    }

    return () => {
      window.clearTimeout(timerId);
    };
  }, [isCompareResultsStep, renderComparisonPanel]);

  useEffect(() => {
    if (!isFinalStep) {
      celebratedFinalStepRef.current = false;
      return;
    }
    if (celebratedFinalStepRef.current) return;
    celebratedFinalStepRef.current = true;

    launchConfetti({
      particleCount: 150,
      spread: 70,
      origin: { y: 0.6 },
      colors: ["#22c55e", "#ffffff", "#0ea5e9"]
    });

    const timer = window.setTimeout(() => {
      launchConfetti({
        particleCount: 110,
        spread: 85,
        origin: { y: 0.55 },
        colors: ["#22c55e", "#ffffff", "#0ea5e9"]
      });
    }, 220);

    return () => window.clearTimeout(timer);
  }, [isFinalStep]);

  useEffect(() => {
    if (!step.waitForAction) return;

    let target: HTMLElement | null = null;
    let highlightedElement: HTMLElement | null = null;
    let highlightAnimation: Animation | null = null;
    let advanced = false;
    const targetId = step.waitForAction === "compress" ? "eco-compress-btn" : "eco-undo-btn";
    const originalStyles: Record<
      string,
      { value: string; priority: string }
    > = {};
    const highlightProps = [
      "position",
      "z-index",
      "box-shadow",
      "animation",
      "outline",
      "outline-offset",
      "filter",
      "transform"
    ];

    const resolveHighlightElement = (element: HTMLElement) => {
      if (targetId === "eco-compress-btn") {
        return element.closest<HTMLElement>(".eco-split-btn-group") ?? element;
      }

      return element;
    };

    const applyHighlightStyles = (element: HTMLElement) => {
      const highlightTarget = resolveHighlightElement(element);

      highlightProps.forEach((prop) => {
        originalStyles[prop] = {
          value: highlightTarget.style.getPropertyValue(prop),
          priority: highlightTarget.style.getPropertyPriority(prop)
        };
      });
      highlightTarget.classList.add("eco-tutorial-highlight");
      highlightTarget.style.setProperty("position", "relative", "important");
      highlightTarget.style.setProperty("z-index", "2147483650", "important");
      highlightTarget.style.setProperty(
        "box-shadow",
        "0 0 0 2px rgba(34, 197, 94, 0.8), 0 0 24px rgba(34, 197, 94, 0.55)",
        "important"
      );
      highlightTarget.style.setProperty(
        "outline",
        "2px solid rgba(34, 197, 94, 0.55)",
        "important"
      );
      highlightTarget.style.setProperty("outline-offset", "2px", "important");
      highlightTarget.style.setProperty(
        "filter",
        "drop-shadow(0 0 14px rgba(34, 197, 94, 0.45))",
        "important"
      );

      if (typeof highlightTarget.animate === "function") {
        highlightAnimation = highlightTarget.animate(
          [
            {
              transform: "scale(1)",
              boxShadow:
                "0 0 0 2px rgba(34, 197, 94, 0.8), 0 0 16px rgba(34, 197, 94, 0.45)"
            },
            {
              transform: "scale(1.04)",
              boxShadow:
                "0 0 0 10px rgba(34, 197, 94, 0), 0 0 28px rgba(34, 197, 94, 0.78)"
            },
            {
              transform: "scale(1)",
              boxShadow:
                "0 0 0 2px rgba(34, 197, 94, 0.8), 0 0 16px rgba(34, 197, 94, 0.45)"
            }
          ],
          {
            duration: 1400,
            iterations: Number.POSITIVE_INFINITY,
            easing: "ease-in-out"
          }
        );
      } else {
        highlightTarget.style.setProperty(
          "animation",
          "eco-pulse 1.5s infinite",
          "important"
        );
      }

      highlightedElement = highlightTarget;
    };

    const restoreHighlightStyles = (element: HTMLElement) => {
      highlightAnimation?.cancel();
      highlightAnimation = null;
      element.classList.remove("eco-tutorial-highlight");
      highlightProps.forEach((prop) => {
        const previous = originalStyles[prop];
        if (!previous || !previous.value) {
          element.style.removeProperty(prop);
          return;
        }
        element.style.setProperty(prop, previous.value, previous.priority);
      });
    };

    const advanceStep = () => {
      if (advanced) return;
      advanced = true;
      if (highlightedElement) {
        restoreHighlightStyles(highlightedElement);
        highlightedElement = null;
      }
      setCurrentStep((stepIndex) => {
        if (stepIndex >= TUTORIAL_STEPS.length - 1) {
          setHidden(true);
          return stepIndex;
        }
        return Math.min(stepIndex + 1, TUTORIAL_STEPS.length - 1);
      });
    };

    const syncHighlight = () => {
      const candidate = findInjectedActionButton(targetId);
      if (!candidate) return;
      if (candidate === target) return;

      if (highlightedElement) {
        restoreHighlightStyles(highlightedElement);
        highlightedElement = null;
      }
      target = candidate;
      applyHighlightStyles(target);
    };

    const handleDocumentClick = (event: MouseEvent) => {
      const path = event.composedPath?.() ?? [];
      const clicked = path.some(
        (item) => item instanceof HTMLElement && item.id === targetId
      );
      if (!clicked) return;
      advanceStep();
    };

    const observer = new MutationObserver(() => syncHighlight());
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true
    });

    document.addEventListener("click", handleDocumentClick, true);
    syncHighlight();

    return () => {
      observer.disconnect();
      document.removeEventListener("click", handleDocumentClick, true);
      if (highlightedElement) {
        restoreHighlightStyles(highlightedElement);
      }
    };
  }, [step.waitForAction]);

  useEffect(() => {
    if (!isCompressionLevelStep) return;

    let target: HTMLElement | null = null;
    let highlightedElement: HTMLElement | null = null;
    let highlightAnimation: Animation | null = null;
    let menuOpened = false;
    const targetId = "eco-compress-trigger-btn";
    const originalStyles: Record<
      string,
      { value: string; priority: string }
    > = {};
    const highlightProps = [
      "position",
      "z-index",
      "box-shadow",
      "animation",
      "outline",
      "outline-offset",
      "filter",
      "transform"
    ];

    const applyHighlightStyles = (element: HTMLElement) => {
      highlightProps.forEach((prop) => {
        originalStyles[prop] = {
          value: element.style.getPropertyValue(prop),
          priority: element.style.getPropertyPriority(prop)
        };
      });

      element.classList.add("eco-tutorial-highlight");
      element.style.setProperty("position", "relative", "important");
      element.style.setProperty("z-index", "2147483650", "important");
      element.style.setProperty(
        "box-shadow",
        "0 0 0 2px rgba(34, 197, 94, 0.82), 0 0 22px rgba(34, 197, 94, 0.58)",
        "important"
      );
      element.style.setProperty(
        "outline",
        "2px solid rgba(34, 197, 94, 0.58)",
        "important"
      );
      element.style.setProperty("outline-offset", "2px", "important");
      element.style.setProperty(
        "filter",
        "drop-shadow(0 0 12px rgba(34, 197, 94, 0.42))",
        "important"
      );

      if (typeof element.animate === "function") {
        highlightAnimation = element.animate(
          [
            {
              transform: "scale(1)",
              boxShadow:
                "0 0 0 2px rgba(34, 197, 94, 0.82), 0 0 14px rgba(34, 197, 94, 0.44)"
            },
            {
              transform: "scale(1.06)",
              boxShadow:
                "0 0 0 10px rgba(34, 197, 94, 0), 0 0 26px rgba(34, 197, 94, 0.78)"
            },
            {
              transform: "scale(1)",
              boxShadow:
                "0 0 0 2px rgba(34, 197, 94, 0.82), 0 0 14px rgba(34, 197, 94, 0.44)"
            }
          ],
          {
            duration: 1400,
            iterations: Number.POSITIVE_INFINITY,
            easing: "ease-in-out"
          }
        );
      } else {
        element.style.setProperty(
          "animation",
          "eco-pulse 1.5s infinite",
          "important"
        );
      }

      highlightedElement = element;
    };

    const restoreHighlightStyles = (element: HTMLElement) => {
      highlightAnimation?.cancel();
      highlightAnimation = null;
      element.classList.remove("eco-tutorial-highlight");
      highlightProps.forEach((prop) => {
        const previous = originalStyles[prop];
        if (!previous || !previous.value) {
          element.style.removeProperty(prop);
          return;
        }
        element.style.setProperty(prop, previous.value, previous.priority);
      });
    };

    const openCompressionMenu = () => {
      if (menuOpened) return;
      menuOpened = true;
      window.dispatchEvent(new CustomEvent(TUTORIAL_DROPDOWN_OPEN_EVENT));
    };

    const syncHighlight = () => {
      const candidate = findInjectedActionButton(targetId);
      if (!candidate) return;
      if (candidate !== target) {
        if (highlightedElement) {
          restoreHighlightStyles(highlightedElement);
          highlightedElement = null;
        }
        target = candidate;
        applyHighlightStyles(candidate);
      }

      openCompressionMenu();
    };

    const observer = new MutationObserver(() => syncHighlight());
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true
    });

    syncHighlight();

    return () => {
      observer.disconnect();
      if (highlightedElement) {
        restoreHighlightStyles(highlightedElement);
      }
      window.dispatchEvent(new CustomEvent(TUTORIAL_DROPDOWN_CLOSE_EVENT));
    };
  }, [isCompressionLevelStep]);

  const getComparisonAnchor = (): HTMLElement | null => {
    const compressButton = findInjectedActionButton("eco-compress-btn");
    if (compressButton && isElementVisible(compressButton)) {
      return compressButton.closest<HTMLElement>(".eco-split-btn-group") ?? compressButton;
    }

    const injectionHost = document.getElementById("prompt-efficiency-root");
    if (injectionHost && isElementVisible(injectionHost)) {
      return injectionHost;
    }

    const fallbackEditor =
      getPerplexityEditor() ??
      getCopilotEditor() ??
      getDeepSeekEditor() ??
      getGrokEditor() ??
      getClaudeEditor() ??
      getChatGPTEditor();

    return fallbackEditor instanceof HTMLElement && isElementVisible(fallbackEditor)
      ? fallbackEditor
      : null;
  };

  const getPromptSpotlightAnchor = (): HTMLElement | null => {
    const editor =
      getPerplexityEditor() ??
      getCopilotEditor() ??
      getDeepSeekEditor() ??
      getGrokEditor() ??
      getClaudeEditor() ??
      getChatGPTEditor();

    if (editor instanceof HTMLElement && isElementVisible(editor)) {
      return editor;
    }

    const injectionHost = document.getElementById("prompt-efficiency-root");
    if (injectionHost && isElementVisible(injectionHost)) {
      return injectionHost;
    }

    return null;
  };

  useEffect(() => {
    if (!renderComparisonPanel) {
      return;
    }

    let frameId = 0;

    const updatePanelPosition = () => {
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const stackedLayout = viewportWidth < 980;
      const panelWidth = Math.min(stackedLayout ? 380 : 520, viewportWidth - 32);
      const estimatedPanelHeight = stackedLayout ? 344 : 286;
      const cardReserve = !stackedLayout && viewportWidth > 1180 ? 396 : 20;
      const anchor = getComparisonAnchor();

      const baseStyle: CSSProperties = {
        width: `${panelWidth}px`,
        maxHeight: "calc(100vh - 72px)"
      };

      if (!anchor) {
        setComparisonPanelStyle({
          ...baseStyle,
          left: `${Math.max((viewportWidth - panelWidth) / 2, 16)}px`,
          top: `${Math.max(viewportHeight * 0.48, 250)}px`
        });
        return;
      }

      const rect = anchor.getBoundingClientRect();
      const centeredLeft = rect.left + rect.width / 2 - panelWidth / 2;
      const left = Math.min(
        Math.max(centeredLeft, 16),
        Math.max(16, viewportWidth - panelWidth - cardReserve)
      );
      const top = Math.min(
        Math.max(rect.top - estimatedPanelHeight - 28, Math.max(viewportHeight * 0.24, 160)),
        Math.max(32, viewportHeight - estimatedPanelHeight - 32)
      );

      setComparisonPanelStyle({
        ...baseStyle,
        left: `${left}px`,
        top: `${top}px`
      });
    };

    const schedulePanelPosition = () => {
      if (frameId !== 0) return;
      frameId = window.requestAnimationFrame(() => {
        frameId = 0;
        updatePanelPosition();
      });
    };

    updatePanelPosition();

    const observer = new MutationObserver(() => {
      schedulePanelPosition();
    });

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true
    });

    window.addEventListener("resize", schedulePanelPosition);
    window.addEventListener("scroll", schedulePanelPosition, true);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", schedulePanelPosition);
      window.removeEventListener("scroll", schedulePanelPosition, true);
      if (frameId !== 0) {
        window.cancelAnimationFrame(frameId);
      }
    };
  }, [renderComparisonPanel]);

  useEffect(() => {
    if (!renderComparisonPanel) {
      return;
    }

    let frameId = 0;

    const updateGuidedEffects = () => {
      const spotlightAnchor = getPromptSpotlightAnchor();
      if (spotlightAnchor) {
        const rect = spotlightAnchor.getBoundingClientRect();
        const insetX = 10;
        const insetY = 8;

        setSpotlightStyle({
          left: `${Math.max(rect.left - insetX, 12)}px`,
          top: `${Math.max(rect.top - insetY, 12)}px`,
          width: `${Math.min(rect.width + insetX * 2, window.innerWidth - 24)}px`,
          height: `${rect.height + insetY * 2}px`
        });
      } else {
        setSpotlightStyle(null);
      }

      const cardRect = tutorialCardRef.current?.getBoundingClientRect();
      const panelRect = comparisonPanelRef.current?.getBoundingClientRect();

      if (!cardRect || !panelRect) {
        setConnectorStyle(null);
        return;
      }

      const stackedLayout = panelRect.top > cardRect.bottom;
      const startX = stackedLayout
        ? cardRect.left + cardRect.width * 0.5
        : cardRect.left + 14;
      const startY = stackedLayout
        ? cardRect.bottom - 12
        : cardRect.top + cardRect.height * 0.52;
      const endX = stackedLayout
        ? panelRect.left + panelRect.width * 0.52
        : panelRect.right - 26;
      const endY = stackedLayout ? panelRect.top + 12 : panelRect.top + 22;
      const deltaX = endX - startX;
      const deltaY = endY - startY;
      const length = Math.max(Math.hypot(deltaX, deltaY), 24);
      const angle = Math.atan2(deltaY, deltaX);

      setConnectorStyle({
        left: `${startX}px`,
        top: `${startY}px`,
        width: `${length}px`,
        transform: `rotate(${angle}rad)`
      });
    };

    const scheduleUpdate = () => {
      if (frameId !== 0) return;
      frameId = window.requestAnimationFrame(() => {
        frameId = 0;
        updateGuidedEffects();
      });
    };

    scheduleUpdate();

    const observer = new MutationObserver(() => {
      scheduleUpdate();
    });

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true
    });

    window.addEventListener("resize", scheduleUpdate);
    window.addEventListener("scroll", scheduleUpdate, true);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", scheduleUpdate);
      window.removeEventListener("scroll", scheduleUpdate, true);
      if (frameId !== 0) {
        window.cancelAnimationFrame(frameId);
      }
    };
  }, [renderComparisonPanel, comparisonPanelStyle, comparisonPanelVisible]);

  const markTutorialSeen = async () => {
    if (typeof chrome === "undefined" || !chrome.storage?.local) {
      return;
    }

    const nextState = await setStorage({ hasSeenTutorial: true });
    setStorageState(nextState);
  };

  const dismissTutorial = () => {
    setRuntimeKeepVisible(false);

    if (typeof chrome === "undefined" || !chrome.storage?.local) {
      setHidden(true);
      return;
    }

    void markTutorialSeen().finally(() => {
      setHidden(true);
    });
  };

  const completeTutorial = () => {
    if (typeof chrome === "undefined" || !chrome.storage?.local) {
      setRuntimeKeepVisible(false);
      setHidden(true);
      return;
    }

    void markTutorialSeen().finally(() => {
      setRuntimeKeepVisible(false);
      setHidden(true);
    });
  };

  const handlePrimaryClick = () => {
    if (currentStep === 0) {
      setCurrentStep(1);
      return;
    }

    if (currentStep === 1) {
      handlePasteSample();
      setCurrentStep(2);
      return;
    }

    if (currentStep >= TUTORIAL_STEPS.length - 1) {
      completeTutorial();
      return;
    }

    setCurrentStep((stepIndex) =>
      Math.min(stepIndex + 1, TUTORIAL_STEPS.length - 1)
    );
  };

  if (!storageReady || hidden) return null;

  return (
    <div className="eco-tutorial-overlay" role="dialog" aria-modal="true">
      <div
        className={`eco-tutorial-backdrop ${
          isActionStep
            ? "eco-tutorial-backdrop--compress-step"
            : isCompareResultsStep || renderComparisonPanel
              ? "eco-tutorial-backdrop--comparison-step"
              : ""
        }`}
      />
      <div
        ref={tutorialCardRef}
        className={`eco-tutorial-card ${
          isActionStep
            ? "eco-tutorial-card-compress-step"
            : isCompareResultsStep
              ? "eco-tutorial-card-compare-step"
              : isCompressionLevelStep
                ? "eco-tutorial-card-compression-level-step"
              : ""
        }`}
      >
        {isFinalStep ? (
          <div className="eco-tutorial-success-icon" aria-hidden="true">
            <svg viewBox="0 0 52 52" role="presentation" focusable="false">
              <circle
                className="eco-tutorial-success-circle"
                cx="26"
                cy="26"
                r="24"
              />
              <path
                className="eco-tutorial-success-check"
                d="M14 27.5l8 8 16-18"
              />
            </svg>
          </div>
        ) : null}
        <h2 className="eco-tutorial-title">{step.title}</h2>
        <p className="eco-tutorial-body">{step.content}</p>
        {step.emphasis ? (
          <p className="eco-tutorial-body eco-tutorial-body-strong">
            <strong>{step.emphasis}</strong>
          </p>
        ) : null}
        <div className="eco-tutorial-actions">
          {step.buttonText ? (
            <button
              type="button"
              className="eco-tutorial-btn eco-tutorial-btn-primary"
              onClick={handlePrimaryClick}
            >
              {step.buttonText}
            </button>
          ) : null}
          <button
            type="button"
            className="eco-tutorial-btn eco-tutorial-btn-secondary"
            onClick={dismissTutorial}
          >
            End Tutorial
          </button>
        </div>
      </div>
      {renderComparisonPanel && spotlightStyle ? (
        <div
          className={`eco-tutorial-prompt-spotlight ${
            comparisonPanelVisible
              ? "eco-tutorial-prompt-spotlight--visible"
              : "eco-tutorial-prompt-spotlight--hidden"
          }`}
          style={spotlightStyle}
          aria-hidden="true"
        />
      ) : null}
      {renderComparisonPanel && connectorStyle ? (
        <div
          className={`eco-tutorial-connector ${
            comparisonPanelVisible
              ? "eco-tutorial-connector--visible"
              : "eco-tutorial-connector--hidden"
          }`}
          style={connectorStyle}
          aria-hidden="true"
        />
      ) : null}
      {renderComparisonPanel && comparisonPanelStyle ? (
        <div
          ref={comparisonPanelRef}
          className={`eco-tutorial-comparison-panel ${
            comparisonPanelVisible
              ? "eco-tutorial-comparison-panel--visible"
              : "eco-tutorial-comparison-panel--hidden"
          }`}
          style={{ ...comparisonPanelStyle, pointerEvents: "none" }}
          aria-hidden="true"
        >
          <div className="eco-tutorial-comparison-header">
            <span className="eco-tutorial-comparison-kicker">Captured demo</span>
            <h3 className="eco-tutorial-comparison-title">Shorter Prompt, Similar Result</h3>
            <p className="eco-tutorial-comparison-subtitle">
              Real excerpts from the same prompt before and after compression.
            </p>
          </div>
          <div className="eco-tutorial-comparison-stats">
            {TUTORIAL_COMPARISON_STATS.map((item) => (
              <div key={item.label} className="eco-tutorial-comparison-stat">
                <span className="eco-tutorial-comparison-stat-label">{item.label}</span>
                <span className="eco-tutorial-comparison-stat-value">{item.value}</span>
              </div>
            ))}
          </div>
          <div className="eco-tutorial-comparison-grid">
            {TUTORIAL_COMPARISON_OUTPUTS.map((card) => (
              <article key={card.title} className="eco-tutorial-comparison-output-card">
                <h4 className="eco-tutorial-comparison-output-title">{card.title}</h4>
                <p className="eco-tutorial-comparison-output-body">{card.excerpt}</p>
              </article>
            ))}
          </div>
          <ul className="eco-tutorial-comparison-checklist">
            {TUTORIAL_COMPARISON_VALIDATIONS.map((item, index) => (
              <li
                key={item}
                className="eco-tutorial-comparison-checklist-item"
                style={
                  comparisonPanelVisible
                    ? { animationDelay: `${160 + index * 120}ms` }
                    : undefined
                }
              >
                <span
                  className="eco-tutorial-comparison-check-icon"
                  aria-hidden="true"
                />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {isStatsPreviewStep ? (
        <div className="eco-tutorial-toolbar-hint" aria-hidden="true">
          <span className="eco-tutorial-toolbar-text">
            Click the extension icon to see your stats
          </span>
        </div>
      ) : null}
    </div>
  );
}


