const GEMINI_EDITABLE_SELECTORS = [
  'div[contenteditable="true"][aria-label*="Enter a prompt here"]',
  ".ql-editor",
  "rich-textarea"
];

const GEMINI_NESTED_EDITABLE_SELECTORS = [
  'div[contenteditable="true"]',
  '[contenteditable="true"]',
  ".ql-editor"
];

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
    const shadowRoot = node.shadowRoot;
    if (shadowRoot) {
      const found = querySelectorDeep<T>(shadowRoot, selectors);
      if (found) return found;
    }
  }

  return null;
}

function normalizeGeminiText(raw: string): string {
  return raw
    .replace(/\r\n?/g, "\n")
    .replace(/\u00a0/g, " ")
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.replace(/\n+/g, " ").replace(/[ \t]+/g, " ").trim())
    .filter(Boolean)
    .join("\n\n")
    .trim();
}

export function findGeminiEditable(): HTMLElement | null {
  const direct = querySelectorDeep<HTMLElement>(document, GEMINI_EDITABLE_SELECTORS);
  if (!direct) return null;

  if (direct.isContentEditable) {
    return direct;
  }

  const nested = querySelectorDeep<HTMLElement>(direct, GEMINI_NESTED_EDITABLE_SELECTORS);
  if (nested) return nested;

  return null;
}

export function getGeminiPromptValue(): string {
  const el = findGeminiEditable();
  if (!el) return "";
  if (el instanceof HTMLTextAreaElement) {
    return el.value ?? "";
  }
  return normalizeGeminiText(el.innerText ?? el.textContent ?? "");
}

export function setGeminiPromptValue(newValue: string): void {
  const el = findGeminiEditable();
  if (!el) return;

  const dispatchInputSignals = () => {
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  };

  try {
    el.focus();
  } catch {
  }

  if (el instanceof HTMLTextAreaElement) {
    el.value = newValue;
    dispatchInputSignals();
    return;
  }

  // Directly set content for Gemini editor. Avoid execCommand here because
  // multiline values can be truncated or expanded into extra blank lines.
  el.textContent = newValue;
  dispatchInputSignals();
}
