import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent
} from "react";
import ReactDOM from "react-dom";
import { Check, ChevronDown, Leaf, Undo } from "lucide-react";
import { getPromptValue, setPromptValue } from "../utils/domUtils";
import { getGeminiPromptValue, setGeminiPromptValue } from "../utils/geminiDomUtils";
import { countPromptTokens, logEcoStats, processSavings } from "../utils/ecoStats";
import { getStorage, setStorage } from "../utils/storage";

const HOSTNAME = window.location.hostname;
const IS_GEMINI = HOSTNAME === "gemini.google.com";
const IS_CLAUDE = HOSTNAME.includes("claude.ai");
const IS_GROK = HOSTNAME === "grok.com" || HOSTNAME.endsWith(".grok.com");
const IS_COPILOT = HOSTNAME === "copilot.microsoft.com";
const IS_DEEPSEEK = HOSTNAME === "chat.deepseek.com";
const IS_PERPLEXITY =
  HOSTNAME === "perplexity.ai" || HOSTNAME === "www.perplexity.ai";

type CompressionLevel = "low" | "medium" | "high";
type MenuPosition = {
  bottom: number;
  right: number;
};
type CompressionEngineResponse = {
  status?: "progress" | "complete" | "error" | "ready";
  phase?: "init" | "compress";
  output?: string;
  message?: string;
};

const COMPRESSION_RATE_BY_LEVEL: Record<CompressionLevel, number> = {
  low: 0.85,
  medium: 0.7,
  high: 0.55
};
const COMPRESSION_REQUEST_TIMEOUT_MS = 300000;
const TUTORIAL_DROPDOWN_OPEN_EVENT = "eco-tutorial-open-compression-menu";
const TUTORIAL_DROPDOWN_CLOSE_EVENT = "eco-tutorial-close-compression-menu";

const PORTAL_DROPDOWN_STYLE_ID = "eco-portal-dropdown-styles";
const PORTAL_DROPDOWN_STYLE_TEXT = `
.eco-dropdown-menu {
  display: flex !important;
  flex-direction: column !important;
  background: rgba(20, 20, 20, 0.95) !important;
  backdrop-filter: blur(8px) !important;
  border: 1px solid rgba(34, 197, 94, 0.3) !important;
  border-radius: 8px !important;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5) !important;
  padding: 4px !important;
  min-width: 120px !important;
  overflow: hidden !important;
  z-index: 2147483650 !important;
}

.eco-dropdown-item {
  display: flex !important;
  justify-content: space-between !important;
  align-items: center !important;
  gap: 12px !important;
  width: 100% !important;
  padding: 8px 12px !important;
  color: #d4d4d4 !important;
  font-family: Inter, system-ui, sans-serif !important;
  font-size: 14px !important;
  font-weight: 500 !important;
  line-height: 1.2 !important;
  text-transform: none !important;
  letter-spacing: normal !important;
  background: transparent !important;
  border: none !important;
  cursor: pointer !important;
  border-radius: 4px !important;
  transition: all 0.2s ease !important;
}

.eco-dropdown-item:hover {
  background: rgba(34, 197, 94, 0.15) !important;
  color: #22c55e !important;
}

.eco-dropdown-item.active,
.eco-dropdown-item.is-active {
  color: #22c55e !important;
  background: rgba(34, 197, 94, 0.05) !important;
}

.eco-dropdown-check {
  color: #22c55e !important;
  font-size: 14px !important;
  font-weight: 700 !important;
}
`;

export default function Injection() {
  const undoStackRef = useRef<string[]>([]);
  const lastFocusedEditorRef = useRef<HTMLElement | HTMLTextAreaElement | null>(null);
  const [undoEnabled, setUndoEnabled] = useState(true);
  const [enableSlider, setEnableSlider] = useState(true);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [compressionLevel, setCompressionLevel] = useState<CompressionLevel>("medium");
  const [menuPosition, setMenuPosition] = useState<MenuPosition | null>(null);
  const [status, setStatus] = useState<"idle" | "success">("idle");
  const [isCompressing, setIsCompressing] = useState(false);
  const [undoSpinning, setUndoSpinning] = useState(false);
  const statusTimeoutRef = useRef<number | null>(null);
  const warmupStartedRef = useRef(false);
  const splitButtonContainerRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const dropdownMenuRef = useRef<HTMLDivElement | null>(null);

  const lowFillers = [
    "please",
    "kindly",
    "thank you",
    "thanks",
    "hello",
    "hi",
    "hey",
    "chatgpt",
    "claude"
  ];

  const mediumFillers = [
    "i would really like it if you could",
    "i would like to know",
    "can you tell me",
    "can you explain to me",
    "can you explain",
    "i am actually really very interested in understanding",
    "in a very detailed and step-by-step way",
    "exactly how",
    "actually",
    "really",
    "very"
  ];

  const highFillers = [
    "the",
    "a",
    "an",
    "and",
    "or",
    "to",
    "of",
    "in",
    "is",
    "it",
    "that",
    "this"
  ];

  const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  const stripWords = (text: string, wordArray: string[]) => {
    const escaped = [...wordArray]
      .map((word) => escapeRegex(word))
      .sort((a, b) => b.length - a.length);
    const regex = new RegExp(`\\b(${escaped.join("|")})\\b`, "gi");
    return text.replace(regex, "");
  };

  const heuristicCompressPrompt = (text: string, level: CompressionLevel) => {
    let result = text;

    switch (level) {
      case "high":
        result = stripWords(result, highFillers);
      case "medium":
        result = stripWords(result, mediumFillers);
      case "low":
        result = stripWords(result, lowFillers);
        break;
      default:
        break;
    }

    result = result.replace(/\s+([.,?!])/g, "$1");
    result = result.replace(/\s{2,}/g, " ");
    result = result.trim();

    return result.length > 0 ? result : text;
  };

  const compressWithEngine = async (
    text: string,
    level: CompressionLevel
  ): Promise<string> => {
    return new Promise((resolve, reject) => {
      let settled = false;
      let timeoutId = 0;
      const port = chrome.runtime.connect({ name: "prompt-compress" });

      const cleanup = () => {
        window.clearTimeout(timeoutId);
        port.onMessage.removeListener(onMessage);
        port.onDisconnect.removeListener(onDisconnect);
      };

      const refreshTimeout = () => {
        window.clearTimeout(timeoutId);
        timeoutId = window.setTimeout(() => {
          if (settled) return;
          settled = true;
          cleanup();
          try {
            port.disconnect();
          } catch {
            // Ignore disconnect errors if the port already closed.
          }
          reject(new Error("Compression request timed out"));
        }, COMPRESSION_REQUEST_TIMEOUT_MS);
      };

      const onMessage = (response?: CompressionEngineResponse) => {
        if (settled) return;
        refreshTimeout();

        if (response?.status === "progress") {
          console.log("Compression engine progress", {
            phase: response.phase ?? "unknown",
            message: response.message ?? ""
          });
          return;
        }

        if (response?.status === "error") {
          settled = true;
          cleanup();
          try {
            port.disconnect();
          } catch {
            // Ignore disconnect errors if the port already closed.
          }
          reject(
            new Error(response.message || "Compression failed")
          );
          return;
        }

        if (response?.status === "complete") {
          settled = true;
          cleanup();
          try {
            port.disconnect();
          } catch {
            // Ignore disconnect errors if the port already closed.
          }
          const output =
            typeof response.output === "string" && response.output.trim().length > 0
              ? response.output
              : text;
          resolve(output);
        }
      };

      const onDisconnect = () => {
        if (settled) return;
        settled = true;
        cleanup();

        const runtimeError = chrome.runtime.lastError;
        if (runtimeError) {
          reject(new Error(runtimeError.message || "Compression connection failed"));
          return;
        }

        reject(new Error("Compression connection closed before completion"));
      };

      port.onMessage.addListener(onMessage);
      port.onDisconnect.addListener(onDisconnect);

      refreshTimeout();

      try {
        port.postMessage({
          type: "compress",
          payload: {
            text,
            rate: COMPRESSION_RATE_BY_LEVEL[level],
            forceTokens: [".", ";", "\n"],
            keepDigits: true,
            chunkEndTokens: [".", "\n"]
          }
        });
      } catch (error) {
        settled = true;
        cleanup();
        try {
          port.disconnect();
        } catch {
          // Ignore disconnect errors if the port already closed.
        }
        reject(
          error instanceof Error
            ? error
            : new Error("Compression request failed")
        );
      }
    });
  };

  const warmCompressionEngine = async (): Promise<void> => {
    return new Promise((resolve, reject) => {
      let settled = false;
      let timeoutId = 0;
      const port = chrome.runtime.connect({ name: "prompt-compress" });

      const cleanup = () => {
        window.clearTimeout(timeoutId);
        port.onMessage.removeListener(onMessage);
        port.onDisconnect.removeListener(onDisconnect);
      };

      const finish = (callback: () => void) => {
        if (settled) return;
        settled = true;
        cleanup();
        try {
          port.disconnect();
        } catch {
          // Ignore disconnect errors if the port already closed.
        }
        callback();
      };

      const refreshTimeout = () => {
        window.clearTimeout(timeoutId);
        timeoutId = window.setTimeout(() => {
          finish(() => reject(new Error("Compression warmup timed out")));
        }, COMPRESSION_REQUEST_TIMEOUT_MS);
      };

      const onMessage = (response?: CompressionEngineResponse) => {
        if (settled) return;
        refreshTimeout();

        if (response?.status === "progress") {
          console.log("Compression engine warmup progress", {
            phase: response.phase ?? "unknown",
            message: response.message ?? ""
          });
          return;
        }

        if (response?.status === "ready") {
          finish(resolve);
          return;
        }

        if (response?.status === "error") {
          finish(() =>
            reject(new Error(response.message || "Compression warmup failed"))
          );
        }
      };

      const onDisconnect = () => {
        if (settled) return;
        const runtimeError = chrome.runtime.lastError;
        finish(() => {
          if (runtimeError) {
            reject(
              new Error(runtimeError.message || "Compression warmup connection failed")
            );
            return;
          }

          resolve();
        });
      };

      port.onMessage.addListener(onMessage);
      port.onDisconnect.addListener(onDisconnect);
      refreshTimeout();

      try {
        port.postMessage({ type: "warmup" });
      } catch (error) {
        finish(() =>
          reject(
            error instanceof Error
              ? error
              : new Error("Compression warmup request failed")
          )
        );
      }
    });
  };

  const normalizeForCompression = (text: string) =>
    text
      .replace(/\r\n?/g, "\n")
      .replace(/\u00a0/g, " ")
      .replace(/\s+/g, " ")
      .trim();

  const querySelectorDeep = <T extends Element>(
    root: ParentNode,
    selectors: string[]
  ): T | null => {
    for (const selector of selectors) {
      const direct = root.querySelector<T>(selector);
      if (direct) return direct;
    }

    const nodes = root.querySelectorAll<HTMLElement>("*");
    for (const node of nodes) {
      const shadowRoot = node.shadowRoot;
      if (!shadowRoot) continue;
      const found = querySelectorDeep<T>(shadowRoot, selectors);
      if (found) return found;
    }

    return null;
  };

  const isElementVisible = (element: Element | null): element is HTMLElement => {
    if (!(element instanceof HTMLElement)) return false;
    const style = window.getComputedStyle(element);
    if (style.display === "none" || style.visibility === "hidden") return false;
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  };

  const findEditorNearHost = <T extends Element>(selectors: string[]): T | null => {
    const host = document.getElementById("prompt-efficiency-root");
    if (!host) return null;

    let node: HTMLElement | null = host;
    while (node) {
      const found = querySelectorDeep<T>(node, selectors);
      if (found && found.id !== "prompt-efficiency-root") return found;
      node = node.parentElement;
    }

    return null;
  };

  const matchesEditable = (node: EventTarget | null): node is HTMLElement => {
    if (!(node instanceof HTMLElement)) return false;
    if (node.tagName === "TEXTAREA") return true;
    if (node.classList.contains("ProseMirror")) return true;
    return node.isContentEditable;
  };

  const getClaudeEditor = (): HTMLElement | null =>
    querySelectorDeep<HTMLElement>(document, [
      'div[contenteditable="true"][role="textbox"]',
      'div[contenteditable="true"][data-slate-editor="true"]',
      'div[contenteditable="true"][data-lexical-editor="true"]',
      'div[contenteditable="true"]'
    ]);

  const getGrokEditor = (): HTMLElement | HTMLTextAreaElement | null => {
    const selectors = [
      "textarea",
      'div[contenteditable="true"][role="textbox"]',
      'div[contenteditable="true"][data-slate-editor="true"]',
      'div[contenteditable="true"][data-lexical-editor="true"]',
      'div[contenteditable="true"]'
    ];
    const scoped = findEditorNearHost<HTMLElement>(selectors);
    if (scoped) return scoped;
    return querySelectorDeep<HTMLElement>(document, selectors);
  };

  const getDeepSeekEditor = (): HTMLElement | HTMLTextAreaElement | null => {
    const selectors = [
      "textarea",
      'div[contenteditable="true"][role="textbox"]',
      'div[contenteditable="true"]'
    ];
    const scoped = findEditorNearHost<HTMLElement>(selectors);
    if (scoped) return scoped;
    return querySelectorDeep<HTMLElement>(document, selectors);
  };

  const getCopilotEditor = (): HTMLElement | HTMLTextAreaElement | null => {
    const selectors = [
      'textarea[placeholder*="Copilot"]',
      'textarea[aria-label*="Copilot"]',
      'div[contenteditable="true"][aria-label*="Copilot"]',
      'div[contenteditable="true"][role="textbox"]',
      "textarea",
      'div[contenteditable="true"]'
    ];

    if (matchesEditable(document.activeElement) && isElementVisible(document.activeElement)) {
      return document.activeElement;
    }

    const scoped = findEditorNearHost<HTMLElement>(selectors);
    if (scoped && isElementVisible(scoped)) return scoped;

    return querySelectorDeep<HTMLElement>(document, selectors);
  };

  const getPerplexityEditor = (): HTMLElement | HTMLTextAreaElement | null => {
    const selection = window.getSelection();
    const anchorNode = selection?.anchorNode;
    const anchorElement =
      anchorNode instanceof HTMLElement
        ? anchorNode
        : anchorNode?.parentElement ?? null;
    const fromSelection = anchorElement?.closest<HTMLElement>(
      '#ask-input[contenteditable="true"], div[data-lexical-editor="true"][contenteditable="true"], div[contenteditable="true"][role="textbox"], div[contenteditable="true"]'
    );
    if (fromSelection && isElementVisible(fromSelection)) {
      return fromSelection;
    }

    const askInput = document.getElementById("ask-input");
    if (
      askInput instanceof HTMLElement &&
      askInput.isContentEditable &&
      isElementVisible(askInput)
    ) {
      return askInput;
    }

    if (matchesEditable(document.activeElement) && isElementVisible(document.activeElement)) {
      return document.activeElement;
    }

    if (lastFocusedEditorRef.current?.isConnected && isElementVisible(lastFocusedEditorRef.current)) {
      return lastFocusedEditorRef.current;
    }

    const lexicalById = Array.from(
      document.querySelectorAll<HTMLElement>(
        '#ask-input[data-lexical-editor="true"][contenteditable="true"]'
      )
    ).find(isElementVisible);
    if (lexicalById) return lexicalById;

    const lexicalGeneric = Array.from(
      document.querySelectorAll<HTMLElement>(
        'div[data-lexical-editor="true"][contenteditable="true"]'
      )
    ).find(isElementVisible);
    if (lexicalGeneric) return lexicalGeneric;

    const lexicalByIdAny = document.querySelector<HTMLElement>(
      '#ask-input[data-lexical-editor="true"][contenteditable="true"]'
    );
    if (lexicalByIdAny) return lexicalByIdAny;

    const lexicalGenericAny = document.querySelector<HTMLElement>(
      'div[data-lexical-editor="true"][contenteditable="true"]'
    );
    if (lexicalGenericAny) return lexicalGenericAny;

    const selectors = [
      ".ProseMirror",
      '#ask-input[contenteditable="true"]',
      'div[data-lexical-editor="true"][contenteditable="true"]',
      "textarea",
      'div[contenteditable="true"][role="textbox"]',
      'div[contenteditable="true"]'
    ];
    const scoped = findEditorNearHost<HTMLElement>(selectors);
    if (scoped) return scoped;
    return querySelectorDeep<HTMLElement>(document, selectors);
  };

  const writeContentEditablePrompt = (
    editor: HTMLElement,
    value: string,
    providerLabel: string
  ) => {
    const normalizeEditableParagraphSpacing = (text: string) =>
      text
        .replace(/\r\n?/g, "\n")
        .replace(/\u00a0/g, " ")
        .replace(/[ \t]+\n/g, "\n")
        .replace(/\n[ \t]+/g, "\n")
        .replace(/\n{3,}/g, "\n\n");
    const sanitizedValue = normalizeEditableParagraphSpacing(value);
    const normalize = (text: string) =>
      normalizeEditableParagraphSpacing(text).replace(/[ \t]+/g, " ").trim();
    const expected = normalize(sanitizedValue);
    const current = () => normalize(editor.innerText ?? editor.textContent ?? "");
    const hardClearEditor = () => {
      editor.replaceChildren();
      editor.textContent = "";
    };

    const selectAll = (): boolean => {
      editor.focus();
      const selection = window.getSelection();
      if (!selection) return false;
      const range = document.createRange();
      range.selectNodeContents(editor);
      selection.removeAllRanges();
      selection.addRange(range);
      return true;
    };

    const ensureFullEditorSelection = (): boolean => {
      editor.focus();
      document.execCommand("selectAll", false);
      const selectedViaCommand = normalize(window.getSelection()?.toString() ?? "");
      const currentText = current();
      if (currentText.length === 0 || selectedViaCommand === currentText) return true;

      if (!selectAll()) return false;
      const selectedViaRange = normalize(window.getSelection()?.toString() ?? "");
      return currentText.length === 0 || selectedViaRange === currentText;
    };

    const dispatchInput = (inputType: string, data: string | null) => {
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

    const replaceWithPaste = (): boolean => {
      if (!ensureFullEditorSelection()) return false;
      if (typeof DataTransfer === "undefined" || typeof ClipboardEvent === "undefined") {
        return false;
      }

      if (sanitizedValue.length === 0) {
        if (typeof InputEvent !== "undefined") {
          editor.dispatchEvent(
            new InputEvent("beforeinput", {
              bubbles: true,
              cancelable: true,
              inputType: "deleteByCut"
            })
          );
        }
        const deleted = document.execCommand("delete", false);
        hardClearEditor();
        dispatchInput("deleteContentBackward", null);
        return deleted;
      }

      const dataTransfer = new DataTransfer();
      dataTransfer.setData("text/plain", sanitizedValue);
      if (typeof InputEvent !== "undefined") {
        editor.dispatchEvent(
          new InputEvent("beforeinput", {
            bubbles: true,
            cancelable: true,
            inputType: "insertFromPaste",
            data: sanitizedValue
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
      const deleted = document.execCommand("delete", false);
      hardClearEditor();

      if (sanitizedValue.length === 0) {
        dispatchInput("deleteContentBackward", null);
        return deleted;
      }

      const selection = window.getSelection();
      if (selection) {
        const startRange = document.createRange();
        startRange.selectNodeContents(editor);
        startRange.collapse(true);
        selection.removeAllRanges();
        selection.addRange(startRange);
      }

      if (typeof InputEvent !== "undefined") {
        editor.dispatchEvent(
            new InputEvent("beforeinput", {
              bubbles: true,
              cancelable: true,
              inputType: "insertText",
              data: sanitizedValue
            })
          );
        }
      const inserted = document.execCommand("insertText", false, sanitizedValue);
      dispatchInput("insertText", sanitizedValue);
      return inserted;
    };

    const moveCaretToEnd = () => {
      const selection = window.getSelection();
      if (!selection) return;
      const range = document.createRange();
      range.selectNodeContents(editor);
      range.collapse(false);
      selection.removeAllRanges();
      selection.addRange(range);
    };

    try {
      editor.focus();
      const replacedWithPaste = replaceWithPaste();
      moveCaretToEnd();

      requestAnimationFrame(() => {
        if (current() === expected) return;
        const replacedWithExec = replaceWithExec();
        moveCaretToEnd();

        requestAnimationFrame(() => {
          if (current() !== expected) {
            console.warn(`SustAIn: ${providerLabel} write mismatch`, {
              replacedWithPaste,
              replacedWithExec,
              expectedLength: expected.length,
              actualLength: current().length
            });
          }
        });
      });
    } catch (error) {
      console.error(`SustAIn: Failed to write ${providerLabel} prompt`, error);
    }
  };

  const readClaudePrompt = () => {
    const editor = getClaudeEditor();
    if (!editor) return "";
    return (editor.innerText ?? editor.textContent ?? "")
      .replace(/\r\n?/g, "\n")
      .replace(/\u00a0/g, " ")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n[ \t]+/g, "\n")
      .replace(/\n{3,}/g, "\n\n");
  };

  const writeClaudePrompt = (value: string) => {
    const editor = getClaudeEditor();
    if (!editor) return;
    writeContentEditablePrompt(editor, value, "Claude");
  };

  const readGrokPrompt = () => {
    const editor = getGrokEditor();
    if (!editor) {
      console.warn("SustAIn: Grok editor not found");
      return "";
    }
    if (editor instanceof HTMLTextAreaElement) {
      return editor.value ?? "";
    }
    return (editor.innerText ?? editor.textContent ?? "")
      .replace(/\r\n?/g, "\n")
      .replace(/\u00a0/g, " ")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n[ \t]+/g, "\n")
      .replace(/\n{3,}/g, "\n\n");
  };

  const readDeepSeekPrompt = () => {
    const editor = getDeepSeekEditor();
    if (!editor) {
      console.warn("SustAIn: DeepSeek editor not found");
      return "";
    }
    if (editor instanceof HTMLTextAreaElement) {
      return editor.value ?? "";
    }
    return editor.innerText ?? editor.textContent ?? "";
  };

  const readCopilotPrompt = () => {
    const editor = getCopilotEditor();
    if (!editor) {
      console.warn("SustAIn: Copilot editor not found");
      return "";
    }
    if (editor instanceof HTMLTextAreaElement) {
      return editor.value ?? "";
    }
    return editor.innerText ?? editor.textContent ?? "";
  };

  const readPerplexityPrompt = () => {
    const editor = getPerplexityEditor();
    if (!editor) {
      console.warn("SustAIn: Perplexity editor not found");
      return "";
    }
    if (editor instanceof HTMLTextAreaElement) {
      return editor.value ?? "";
    }
    return editor.innerText ?? editor.textContent ?? "";
  };

  const writeGrokPrompt = (value: string) => {
    const editor = getGrokEditor();
    if (!editor) {
      console.warn("SustAIn: Grok editor not found");
      return;
    }

    if (editor instanceof HTMLTextAreaElement) {
      const descriptor = Object.getOwnPropertyDescriptor(
        HTMLTextAreaElement.prototype,
        "value"
      );
      const setter = descriptor?.set;
      if (setter) {
        setter.call(editor, value);
      } else {
        editor.value = value;
      }
      editor.dispatchEvent(new Event("input", { bubbles: true }));
      editor.dispatchEvent(new Event("change", { bubbles: true }));
      return;
    }

    writeContentEditablePrompt(editor, value, "Grok");
  };

  const writeDeepSeekPrompt = (value: string) => {
    const editor = getDeepSeekEditor();
    if (!editor) {
      console.warn("SustAIn: DeepSeek editor not found");
      return;
    }

    if (editor instanceof HTMLTextAreaElement) {
      const descriptor = Object.getOwnPropertyDescriptor(
        HTMLTextAreaElement.prototype,
        "value"
      );
      const setter = descriptor?.set;
      if (setter) {
        setter.call(editor, value);
      } else {
        editor.value = value;
      }
      editor.dispatchEvent(new Event("input", { bubbles: true }));
      editor.dispatchEvent(new Event("change", { bubbles: true }));
      return;
    }

    try {
      editor.focus();
      const selection = window.getSelection();
      if (selection) {
        selection.removeAllRanges();
        const range = document.createRange();
        range.selectNodeContents(editor);
        selection.addRange(range);
      }

      document.execCommand("selectAll", false);
      document.execCommand("delete", false);

      if (value.length === 0) {
        const clearEvent =
          typeof InputEvent !== "undefined"
            ? new InputEvent("input", {
                bubbles: true,
                cancelable: true,
                inputType: "deleteContentBackward"
              })
            : new Event("input", { bubbles: true });
        editor.dispatchEvent(clearEvent);
        return;
      }

      document.execCommand("insertText", false, value);
      const inputEvent =
        typeof InputEvent !== "undefined"
          ? new InputEvent("input", {
              bubbles: true,
              cancelable: true,
              inputType: "insertText",
              data: value
            })
          : new Event("input", { bubbles: true });
      editor.dispatchEvent(inputEvent);
    } catch {
      editor.dispatchEvent(new Event("input", { bubbles: true }));
    }
  };

  const writeCopilotPrompt = (value: string) => {
    const editor = getCopilotEditor();
    if (!editor) {
      console.warn("SustAIn: Copilot editor not found");
      return;
    }

    if (editor instanceof HTMLTextAreaElement) {
      const descriptor = Object.getOwnPropertyDescriptor(
        HTMLTextAreaElement.prototype,
        "value"
      );
      const setter = descriptor?.set;
      if (setter) {
        setter.call(editor, value);
      } else {
        editor.value = value;
      }

      const inputEvent =
        typeof InputEvent !== "undefined"
          ? new InputEvent("input", {
              bubbles: true,
              cancelable: true,
              inputType: "insertText",
              data: value
            })
          : new Event("input", { bubbles: true });
      editor.dispatchEvent(inputEvent);
      editor.dispatchEvent(new Event("change", { bubbles: true }));
      return;
    }

    try {
      editor.focus();

      const selection = window.getSelection();
      if (selection) {
        selection.removeAllRanges();
        const range = document.createRange();
        range.selectNodeContents(editor);
        selection.addRange(range);
      }

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
        const clearEvent =
          typeof InputEvent !== "undefined"
            ? new InputEvent("input", {
                bubbles: true,
                cancelable: true,
                inputType: "deleteContentBackward"
              })
            : new Event("input", { bubbles: true });
        editor.dispatchEvent(clearEvent);
        return;
      }

      let updated = false;
      if (typeof DataTransfer !== "undefined" && typeof ClipboardEvent !== "undefined") {
        const dataTransfer = new DataTransfer();
        dataTransfer.setData("text/plain", value);
        const pasteEvent = new ClipboardEvent("paste", {
          bubbles: true,
          cancelable: true,
          clipboardData: dataTransfer
        });
        updated = editor.dispatchEvent(pasteEvent);
      }

      if (!updated) {
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

      const inputEvent =
        typeof InputEvent !== "undefined"
          ? new InputEvent("input", {
              bubbles: true,
              cancelable: true,
              inputType: "insertText",
              data: value
            })
          : new Event("input", { bubbles: true });
      editor.dispatchEvent(inputEvent);
      editor.dispatchEvent(new Event("change", { bubbles: true }));
    } catch (error) {
      console.error("SustAIn: Failed to write Copilot prompt", error);
    }
  };

  const writePerplexityPrompt = (value: string) => {
    const editor = getPerplexityEditor();
    if (!editor) {
      console.warn("SustAIn: Perplexity editor not found");
      return;
    }

    if (editor instanceof HTMLTextAreaElement) {
      const descriptor = Object.getOwnPropertyDescriptor(
        HTMLTextAreaElement.prototype,
        "value"
      );
      const setter = descriptor?.set;
      if (setter) {
        setter.call(editor, value);
      } else {
        editor.value = value;
      }
      const inputEvent =
        typeof InputEvent !== "undefined"
          ? new InputEvent("input", {
              bubbles: true,
              cancelable: true,
              inputType: "insertText",
              data: value
            })
          : new Event("input", { bubbles: true });
      editor.dispatchEvent(inputEvent);
      editor.dispatchEvent(new Event("change", { bubbles: true }));
      return;
    }

    const normalize = (text: string) => text.replace(/\s+/g, " ").trim();
    const expected = normalize(value);
    const current = () => normalize(editor.innerText ?? editor.textContent ?? "");
    const selectAll = (): boolean => {
      editor.focus();
      const selection = window.getSelection();
      if (!selection) return false;
      const range = document.createRange();
      range.selectNodeContents(editor);
      selection.removeAllRanges();
      selection.addRange(range);
      return true;
    };
    const ensureFullEditorSelection = (): boolean => {
      editor.focus();
      document.execCommand("selectAll", false);
      const selectedViaCommand = normalize(window.getSelection()?.toString() ?? "");
      const currentText = current();
      if (currentText.length === 0 || selectedViaCommand === currentText) return true;

      if (!selectAll()) return false;
      const selectedViaRange = normalize(window.getSelection()?.toString() ?? "");
      return currentText.length === 0 || selectedViaRange === currentText;
    };
    const dispatchInput = (inputType: string, data: string | null) => {
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
    const replaceWithPaste = (): boolean => {
      if (!ensureFullEditorSelection()) return false;
      if (typeof DataTransfer === "undefined" || typeof ClipboardEvent === "undefined") {
        return false;
      }

      if (value.length === 0) {
        if (typeof InputEvent !== "undefined") {
          editor.dispatchEvent(
            new InputEvent("beforeinput", {
              bubbles: true,
              cancelable: true,
              inputType: "deleteByCut"
            })
          );
        }
        const deleted = document.execCommand("delete", false);
        dispatchInput("deleteContentBackward", null);
        return deleted;
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
      const deleted = document.execCommand("delete", false);

      if (value.length === 0) {
        dispatchInput("deleteContentBackward", null);
        return deleted;
      }

      // Ensure insertion starts from an empty editor to prevent accidental appends.
      const selection = window.getSelection();
      if (selection) {
        const startRange = document.createRange();
        startRange.selectNodeContents(editor);
        startRange.collapse(true);
        selection.removeAllRanges();
        selection.addRange(startRange);
      }

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
      dispatchInput("insertText", value);
      return inserted;
    };
    const moveCaretToEnd = () => {
      const selection = window.getSelection();
      if (!selection) return;
      const newRange = document.createRange();
      newRange.selectNodeContents(editor);
      newRange.collapse(false);
      selection.removeAllRanges();
      selection.addRange(newRange);
    };

    try {
      editor.focus();
      const replacedWithPaste = replaceWithPaste();
      moveCaretToEnd();

      // Lexical can reconcile asynchronously; re-check on the next frame.
      requestAnimationFrame(() => {
        if (current() === expected) return;
        const replacedWithExec = replaceWithExec();
        moveCaretToEnd();
        requestAnimationFrame(() => {
          if (current() !== expected) {
            console.warn("SustAIn: Perplexity write mismatch", {
              replacedWithPaste,
              replacedWithExec,
              expectedLength: expected.length,
              actualLength: current().length
            });
          }
        });
      });
    } catch (error) {
      console.error("SustAIn: Failed to write Perplexity prompt", error);
    }
  };

  const readPrompt = () =>
    IS_GROK
      ? readGrokPrompt()
      : IS_COPILOT
        ? readCopilotPrompt()
      : IS_DEEPSEEK
        ? readDeepSeekPrompt()
        : IS_PERPLEXITY
          ? readPerplexityPrompt()
        : IS_CLAUDE
          ? readClaudePrompt()
          : IS_GEMINI
            ? getGeminiPromptValue()
            : getPromptValue();
  const writePrompt = (value: string) => {
    if (IS_GROK) {
      writeGrokPrompt(value);
    } else if (IS_COPILOT) {
      writeCopilotPrompt(value);
    } else if (IS_DEEPSEEK) {
      writeDeepSeekPrompt(value);
    } else if (IS_PERPLEXITY) {
      writePerplexityPrompt(value);
    } else if (IS_CLAUDE) {
      writeClaudePrompt(value);
    } else if (IS_GEMINI) {
      setGeminiPromptValue(value);
    } else {
      setPromptValue(value);
    }
  };

  const pushUndoSnapshot = (prompt: string) => {
    const stack = undoStackRef.current;
    if (stack[stack.length - 1] !== prompt) {
      stack.push(prompt);
      console.log("Undo stack: snapshot pushed", {
        depth: stack.length,
        promptLength: prompt.length
      });
    } else {
      console.log("Undo stack: duplicate snapshot skipped", {
        depth: stack.length,
        promptLength: prompt.length
      });
    }
    if (stack.length > 20) {
      stack.shift();
      console.log("Undo stack: oldest snapshot dropped", { depth: stack.length });
    }
  };

  const normalizePromptText = (value: string) => value.replace(/\s+/g, " ").trim();
  const isCompressionLevel = (value: unknown): value is CompressionLevel =>
    value === "low" || value === "medium" || value === "high";

  const verifyPromptText = (expected: string, stage: string) => {
    const actual = normalizePromptText(readPrompt());
    const expectedNormalized = normalizePromptText(expected);
    const matches = actual === expectedNormalized;
    console.log("Undo verify", {
      stage,
      matches,
      expectedLength: expectedNormalized.length,
      actualLength: actual.length,
      expected: expectedNormalized,
      actual
    });
    return matches;
  };

  const handleUndo = () => {
    const stack = undoStackRef.current;
    const previous = stack[stack.length - 1] ?? null;
    console.log("Undo: requested", {
      depth: stack.length,
      hasSnapshot: previous !== null
    });

    if (previous === null) {
      const current = readPrompt();
      if (current.endsWith(" [Verified]")) {
        const restored = current.replace(/\\s\\[Verified\\]$/, "");
        console.log("Undo: stripping verified suffix");
        writePrompt(restored);
      } else {
        console.log("Undo: no previous prompt captured");
      }
      return;
    }

    writePrompt(previous);

    const completeRestore = (stage: string) => {
      if (!verifyPromptText(previous, stage)) return false;
      stack.pop();
      setStatus("idle");
      console.log("Undo: restored previous prompt", {
        depth: stack.length,
        stage
      });
      return true;
    };

    if (completeRestore("immediate")) return;

    requestAnimationFrame(() => {
      if (completeRestore("raf")) return;
      console.log("Undo: retrying restore after raf mismatch");
      writePrompt(previous);
      window.setTimeout(() => {
        if (completeRestore("timeout-120ms")) return;
        console.warn("Undo: restore failed, keeping snapshot for retry", {
          depth: stack.length
        });
      }, 120);
    });
  };

  const handleSelectLevel = (
    event: ReactMouseEvent<HTMLButtonElement>,
    level: CompressionLevel
  ) => {
    event.preventDefault();
    event.stopPropagation();
    setCompressionLevel(level);
    setIsMenuOpen(false);
    void setStorage({ compressionLevel: level });
  };

  const handleCompress = async () => {
    if (isCompressing) return;
    const originalTextRaw = readPrompt();
    console.log(`Read: ${originalTextRaw}`);
    const originalText = normalizeForCompression(originalTextRaw);
    if (!originalText) {
      setStatus("idle");
      return;
    }

    setIsCompressing(true);

    let compressedText = "";
    try {
      compressedText = await compressWithEngine(originalText, compressionLevel);
    } catch (error) {
      console.error("Compression engine failed. Prompt left unchanged.", error);
      setStatus("idle");
      return;
    } finally {
      setIsCompressing(false);
    }

    if (compressedText === originalText) {
      setStatus("idle");
      return;
    }

    pushUndoSnapshot(originalTextRaw);

    const savings = processSavings(originalText, compressedText);
    const originalTokens = countPromptTokens(originalText);
    const compressedTokens = countPromptTokens(compressedText);
    console.log(
      "Compressed:",
      originalTokens,
      "->",
      compressedTokens,
      "tokens",
      "(chars:",
      originalText.length,
      "->",
      compressedText.length,
      ")",
      "Savings:",
      savings
    );

    writePrompt(compressedText);
    console.log("Compress: write requested", {
      stackDepth: undoStackRef.current.length,
      originalLength: originalText.length,
      compressedLength: compressedText.length
    });
    try {
      await logEcoStats(savings);
      console.log("Compress: eco data synced", {
        tokens: savings.tokens,
        compressionPercent: savings.compressionPercent,
        waterMl: savings.waterMl,
        energyWh: savings.energyWh
      });
    } catch (error) {
      console.error("Compress: failed to sync eco data", error);
    }

    setStatus("success");
    if (statusTimeoutRef.current !== null) {
      window.clearTimeout(statusTimeoutRef.current);
    }
    statusTimeoutRef.current = window.setTimeout(() => {
      setStatus("idle");
      statusTimeoutRef.current = null;
    }, 2000);
  };

  useEffect(() => {
    let mounted = true;

    getStorage().then((state) => {
      if (!mounted) return;
      setUndoEnabled(state.undoEnabled);
      setEnableSlider(state.enableSlider);
      if (isCompressionLevel(state.compressionLevel)) {
        setCompressionLevel(state.compressionLevel);
      }
    });

    const listener = (
      changes: Record<string, chrome.storage.StorageChange>,
      area: string
    ) => {
      if (area !== "local") return;
      if (changes.undoEnabled) {
        setUndoEnabled(Boolean(changes.undoEnabled.newValue));
      }
      if (changes.enableSlider) {
        const nextEnableSlider = Boolean(changes.enableSlider.newValue);
        setEnableSlider(nextEnableSlider);
        if (!nextEnableSlider) {
          setIsMenuOpen(false);
        }
      }
      if (changes.compressionLevel && isCompressionLevel(changes.compressionLevel.newValue)) {
        setCompressionLevel(changes.compressionLevel.newValue);
      }
    };

    chrome.storage.onChanged.addListener(listener);

    return () => {
      mounted = false;
      if (statusTimeoutRef.current !== null) {
        window.clearTimeout(statusTimeoutRef.current);
      }
      chrome.storage.onChanged.removeListener(listener);
    };
  }, []);

  useEffect(() => {
    if (warmupStartedRef.current) return;
    warmupStartedRef.current = true;

    const idleWindow = window as Window & {
      requestIdleCallback?: (
        callback: IdleRequestCallback,
        options?: IdleRequestOptions
      ) => number;
      cancelIdleCallback?: (handle: number) => void;
    };

    let idleId: number | null = null;
    let timeoutId: number | null = null;

    const startWarmup = () => {
      void warmCompressionEngine().catch((error) => {
        console.warn("Compression engine warmup failed", error);
      });
    };

    if (typeof idleWindow.requestIdleCallback === "function") {
      idleId = idleWindow.requestIdleCallback(() => {
        idleId = null;
        startWarmup();
      }, { timeout: 1500 });
    } else {
      timeoutId = window.setTimeout(() => {
        timeoutId = null;
        startWarmup();
      }, 750);
    }

    return () => {
      if (idleId !== null && typeof idleWindow.cancelIdleCallback === "function") {
        idleWindow.cancelIdleCallback(idleId);
      }
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
    };
  }, []);

  useEffect(() => {
    if (!IS_PERPLEXITY) return;

    const handleFocus = (event: FocusEvent) => {
      const path = typeof event.composedPath === "function" ? event.composedPath() : [];
      for (const item of path) {
        if (matchesEditable(item)) {
          lastFocusedEditorRef.current = item as HTMLElement;
          return;
        }
      }
      if (matchesEditable(event.target)) {
        lastFocusedEditorRef.current = event.target as HTMLElement;
      }
    };

    document.addEventListener("focusin", handleFocus, true);
    return () => document.removeEventListener("focusin", handleFocus, true);
  }, []);

  useEffect(() => {
    const mountNode = document.head ?? document.documentElement;
    if (!mountNode) return;

    let styleTag = document.getElementById(PORTAL_DROPDOWN_STYLE_ID) as
      | HTMLStyleElement
      | null;

    if (!styleTag) {
      styleTag = document.createElement("style");
      styleTag.id = PORTAL_DROPDOWN_STYLE_ID;
      mountNode.appendChild(styleTag);
    }

    if (styleTag.textContent !== PORTAL_DROPDOWN_STYLE_TEXT) {
      styleTag.textContent = PORTAL_DROPDOWN_STYLE_TEXT;
    }
  }, []);

  useEffect(() => {
    if (!isMenuOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (dropdownMenuRef.current?.contains(target)) return;
      if (triggerRef.current?.contains(target)) return;
      setIsMenuOpen(false);
    };

    document.addEventListener("mousedown", handlePointerDown, true);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown, true);
    };
  }, [isMenuOpen]);

  useEffect(() => {
    const handleTutorialOpenMenu = () => {
      if (!enableSlider) return;
      setIsMenuOpen(true);
    };

    const handleTutorialCloseMenu = () => {
      setIsMenuOpen(false);
    };

    window.addEventListener(TUTORIAL_DROPDOWN_OPEN_EVENT, handleTutorialOpenMenu);
    window.addEventListener(
      TUTORIAL_DROPDOWN_CLOSE_EVENT,
      handleTutorialCloseMenu
    );

    return () => {
      window.removeEventListener(
        TUTORIAL_DROPDOWN_OPEN_EVENT,
        handleTutorialOpenMenu
      );
      window.removeEventListener(
        TUTORIAL_DROPDOWN_CLOSE_EVENT,
        handleTutorialCloseMenu
      );
    };
  }, [enableSlider]);

  useEffect(() => {
    if (!isMenuOpen) return;

    const updatePosition = () => {
      const trigger = triggerRef.current;
      if (!trigger) return;
      const rect = trigger.getBoundingClientRect();
      setMenuPosition({
        bottom: window.innerHeight - rect.top + 8,
        right: window.innerWidth - rect.right
      });
    };

    updatePosition();
    window.addEventListener("resize", updatePosition, true);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition, true);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [isMenuOpen]);

  const geminiClass = IS_GEMINI ? "eco-btn-gemini" : "";
  const claudeClass = IS_CLAUDE ? "eco-btn-claude" : "";
  const grokClass = IS_GROK ? "eco-btn-grok" : "";
  const perplexityClass = IS_PERPLEXITY ? "eco-btn-perplexity" : "";
  const geminiInjectionClass = IS_GEMINI ? "eco-injection-gemini" : "";
  const dropdownMenuStyle: CSSProperties | undefined =
    enableSlider && isMenuOpen && menuPosition
      ? {
          position: "fixed",
          bottom: `${menuPosition.bottom}px`,
          right: `${menuPosition.right}px`,
          display: "flex",
          flexDirection: "column",
          background: "rgba(20, 20, 20, 0.95)",
          backdropFilter: "blur(8px)",
          border: "1px solid rgba(34, 197, 94, 0.3)",
          borderRadius: "8px",
          boxShadow: "0 4px 20px rgba(0, 0, 0, 0.5)",
          padding: "4px",
          minWidth: "120px",
          overflow: "hidden",
          pointerEvents: "auto",
          zIndex: 2147483650
        }
      : undefined;

  return (
    <div className={`pointer-events-auto flex items-center gap-1 pet-fade-in ${geminiInjectionClass}`}>
      <style>{`
        .pet-fade-in {
          animation: pet-fade-in 240ms ease-out;
        }
        @keyframes pet-fade-in {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .pet-ghost {
          position: relative;
          overflow: hidden;
        }
        .pet-ghost::after {
          content: "";
          position: absolute;
          inset: 0;
          opacity: 0;
          background: radial-gradient(circle at center, rgba(255,255,255,0.35), transparent 65%);
          transition: opacity 200ms ease;
        }
        .pet-ghost:active::after {
          opacity: 1;
        }
        .rotate-360 {
          transform: rotate(360deg);
        }
      `}</style>

      <div className="relative" ref={splitButtonContainerRef}>
        <div
          className={`eco-split-btn-group ${status === "success" ? "is-success" : ""}`}
        >
          <button
            id="eco-compress-btn"
            type="button"
            className="eco-btn-main pet-ghost"
            onClick={handleCompress}
            title={isCompressing ? "Compressing prompt..." : "Compress prompt"}
            disabled={isCompressing}
          >
            {status === "success" ? (
              <Check className="h-4 w-4" />
            ) : (
              <Leaf className="h-4 w-4" />
            )}
            {status === "success" ? "Saved" : isCompressing ? "Working..." : "Compress"}
          </button>
          {enableSlider ? (
            <button
              id="eco-compress-trigger-btn"
              ref={triggerRef}
              type="button"
              className="eco-btn-trigger pet-ghost"
              onClick={() => {
                setIsMenuOpen((open) => !open);
              }}
              title="Open compression menu"
              aria-haspopup="menu"
              aria-expanded={isMenuOpen}
            >
              <ChevronDown className="h-4 w-4" />
            </button>
          ) : null}
        </div>
      </div>

      {enableSlider && isMenuOpen && menuPosition
        ? ReactDOM.createPortal(
            <div
              ref={dropdownMenuRef}
              className="eco-dropdown-menu"
              role="menu"
              aria-label="Compression level"
              style={dropdownMenuStyle}
            >
              {(["low", "medium", "high"] as CompressionLevel[]).map((level) => (
                <button
                  key={level}
                  type="button"
                  className={`eco-dropdown-item ${
                    compressionLevel === level ? "active" : ""
                  }`}
                  role="menuitemradio"
                  aria-checked={compressionLevel === level}
                  onMouseDown={(event) => handleSelectLevel(event, level)}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    width: "100%",
                    gap: "12px",
                    padding: "8px 12px",
                    color:
                      compressionLevel === level
                        ? "#22c55e"
                        : "#d4d4d4",
                    fontFamily: "Inter, system-ui, sans-serif",
                    fontSize: "14px",
                    fontWeight: 500,
                    background:
                      compressionLevel === level
                        ? "rgba(34, 197, 94, 0.05)"
                        : "transparent",
                    border: "none",
                    borderRadius: "4px",
                    cursor: "pointer",
                    transition: "all 0.2s ease"
                  }}
                >
                  <span>{level.charAt(0).toUpperCase() + level.slice(1)}</span>
                  {compressionLevel === level ? (
                    <span className="eco-dropdown-check" aria-hidden="true">
                      {"\u2713"}
                    </span>
                  ) : null}
                </button>
              ))}
            </div>,
            document.body
          )
        : null}

      {undoEnabled ? (
        <div className="relative">
          <button
            id="eco-undo-btn"
            type="button"
            className={`eco-undo-btn pet-ghost inline-flex items-center gap-2 rounded-lg bg-transparent px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-400 transition-all duration-200 ease-in-out hover:bg-white/10 hover:text-zinc-100 active:scale-90 transition-transform duration-100 ${geminiClass} ${claudeClass} ${grokClass} ${perplexityClass}`}
            onClick={() => {
              setUndoSpinning(true);
              window.setTimeout(() => setUndoSpinning(false), 400);
              handleUndo();
            }}
            title="Restore last prompt"
          >
            <Undo className={`h-4 w-4 transition-transform duration-300 ${undoSpinning ? "rotate-360" : ""}`} />
            Undo
          </button>
        </div>
      ) : null}
    </div>
  );
}
