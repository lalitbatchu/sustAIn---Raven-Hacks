function getPromptElement(): HTMLElement | null {
  const byId = document.querySelector<HTMLElement>("#prompt-textarea");
  if (byId) return byId;

  const byName = document.querySelector<HTMLTextAreaElement>(
    "textarea[name=\"prompt-textarea\"]"
  );
  return byName;
}

export function getPromptValue(): string {
  const el = getPromptElement();
  if (!el) return "";

  if (el instanceof HTMLTextAreaElement) {
    return el.value ?? "";
  }

  if (el.isContentEditable) {
    return el.textContent ?? "";
  }

  return "";
}

export function setPromptValue(newValue: string): void {
  const el = getPromptElement();
  if (!el) return;

  if (el instanceof HTMLTextAreaElement) {
    const descriptor = Object.getOwnPropertyDescriptor(
      HTMLTextAreaElement.prototype,
      "value"
    );

    const setter = descriptor?.set;
    if (setter) {
      setter.call(el, newValue);
      el.dispatchEvent(new Event("input", { bubbles: true }));
      return;
    }

    try {
      el.focus();
      document.execCommand("insertText", false, newValue);
    } catch {
      // Best-effort fallback; no-op if browser blocks execCommand.
    }
    return;
  }

  if (el.isContentEditable) {
    try {
      el.focus();
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(el);
      selection?.removeAllRanges();
      selection?.addRange(range);
      document.execCommand("insertText", false, newValue);
    } catch {
      // Best-effort fallback; no-op if browser blocks execCommand.
    }
  }
}
