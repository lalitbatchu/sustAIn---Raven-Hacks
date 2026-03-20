import { getStorage, setStorage } from "../utils/storage";

type TutorialStep = {
  title: string;
  body: string;
  emphasis?: string;
  mode: "center" | "target" | "toolbar";
  targetSelector?: string;
  waitForClickSelector?: string;
  allowSkip?: boolean;
  showSamplePrompt?: boolean;
  showStatsPreview?: boolean;
  primaryLabel?: string;
};

type TutorialManagerOptions = {
  cssText: string;
};

const SAMPLE_PROMPT =
  "I am interested in understanding how water evaporates and what factors affect the speed of evaporation.";

const STYLE_ID = "eco-tutorial-style";

export default class TutorialManager {
  private readonly steps: TutorialStep[] = [
    {
      title: "SustAIn",
      body: "SustAIn shortens AI prompts so you can fit more instructions within model limits and reduce token usage, while also lowering the energy and water used by large AI models.",
      mode: "center",
      primaryLabel: "Start"
    },
    {
      title: "Add a Sample Prompt",
      body: "Copy this text into the chat box:",
      mode: "center",
      showSamplePrompt: true,
      primaryLabel: "Next"
    },
    {
      title: "Compress Your Prompt",
      body: "Click the Compress button to shorten your prompt.",
      mode: "target",
      targetSelector: "#eco-compress-btn",
      waitForClickSelector: "#eco-compress-btn"
    },
    {
      title: "Compare the Results",
      body:
        "These are real outputs from the original and compressed versions of the same prompt. Even though the compressed prompt looks less natural, the model still understands the key instructions and produces a very similar response.",
      mode: "center",
      primaryLabel: "Next"
    },
    {
      title: "Try Undo",
      body: "Not happy? Click Undo to revert.",
      mode: "target",
      targetSelector: "#eco-undo-btn",
      waitForClickSelector: "#eco-undo-btn",
      allowSkip: true
    },
    {
      title: "Choose Compression Level",
      body: "Use the dropdown next to Compress to choose your compression level.",
      emphasis:
        "The compressed prompt may look less natural to you, but models can still read the key instructions effectively.",
      mode: "center",
      primaryLabel: "Next"
    },
    {
      title: "Track Your Usage & Impact Savings",
      body: "Click the extension icon in your toolbar to view your usage and savings stats.",
      mode: "toolbar",
      showStatsPreview: true,
      primaryLabel: "Next"
    },
    {
      title: "You're All Set!",
      body: "You're ready to start reducing token usage and lowering the environmental cost of AI. Your prompts stay private, and the tool does not collect personal data.",
      mode: "center",
      primaryLabel: "Finish Tutorial"
    }
  ];

  private readonly cssText: string;

  private stepIndex = 0;
  private started = false;
  private completed = false;

  private root: HTMLDivElement | null = null;
  private spotlightEl: HTMLDivElement | null = null;
  private cardEl: HTMLDivElement | null = null;
  private statusEl: HTMLParagraphElement | null = null;

  private resizeHandler: (() => void) | null = null;
  private scrollHandler: (() => void) | null = null;
  private intervalId: number | null = null;
  private waitIntervalId: number | null = null;
  private detachStepListener: (() => void) | null = null;

  constructor(options: TutorialManagerOptions) {
    this.cssText = options.cssText;
  }

  async maybeStart(): Promise<void> {
    if (this.started || this.completed) return;
    const hasSeen = await this.getHasSeenTutorial();
    if (hasSeen) return;
    this.init();
  }

  private getHasSeenTutorial(): Promise<boolean> {
    return getStorage().then((state) => state.hasSeenTutorial);
  }

  private setHasSeenTutorial(): Promise<void> {
    return setStorage({ hasSeenTutorial: true }).then(() => undefined);
  }

  private init(): void {
    if (this.started) return;
    this.started = true;

    this.ensureStyle();
    this.mount();
    this.bindGlobalListeners();
    this.renderStep();
  }

  private ensureStyle(): void {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = this.cssText;
    document.head.appendChild(style);
  }

  private mount(): void {
    const root = document.createElement("div");
    root.className = "eco-tutorial-root";

    const backdrop = document.createElement("div");
    backdrop.className = "eco-tutorial-backdrop";

    const spotlight = document.createElement("div");
    spotlight.className = "eco-tutorial-spotlight eco-hidden";

    const card = document.createElement("div");
    card.className = "eco-tutorial-card";

    root.append(backdrop, spotlight, card);
    document.body.appendChild(root);

    this.root = root;
    this.spotlightEl = spotlight;
    this.cardEl = card;
  }

  private ensureMounted(): boolean {
    const needsRemount =
      !this.root ||
      !this.root.isConnected ||
      !this.cardEl ||
      !this.cardEl.isConnected ||
      !this.spotlightEl ||
      !this.spotlightEl.isConnected;

    if (!needsRemount) return false;

    this.ensureStyle();
    this.mount();
    this.renderStep();
    return true;
  }

  private bindGlobalListeners(): void {
    this.resizeHandler = () => this.refreshLayout();
    this.scrollHandler = () => this.refreshLayout();

    window.addEventListener("resize", this.resizeHandler, { passive: true });
    window.addEventListener("scroll", this.scrollHandler, { passive: true, capture: true });

    this.intervalId = window.setInterval(() => this.refreshLayout(), 250);
  }

  private clearStepRuntime(): void {
    if (this.waitIntervalId !== null) {
      window.clearInterval(this.waitIntervalId);
      this.waitIntervalId = null;
    }
    if (this.detachStepListener) {
      this.detachStepListener();
      this.detachStepListener = null;
    }
  }

  private clearGlobalRuntime(): void {
    if (this.intervalId !== null) {
      window.clearInterval(this.intervalId);
      this.intervalId = null;
    }
    if (this.resizeHandler) {
      window.removeEventListener("resize", this.resizeHandler);
      this.resizeHandler = null;
    }
    if (this.scrollHandler) {
      window.removeEventListener("scroll", this.scrollHandler, true);
      this.scrollHandler = null;
    }
  }

  private querySelectorDeep(selector: string, root: ParentNode = document): HTMLElement | null {
    const direct = root.querySelector<HTMLElement>(selector);
    if (direct) return direct;

    const nodes = root.querySelectorAll<HTMLElement>("*");
    for (const node of nodes) {
      const shadowRoot = node.shadowRoot;
      if (!shadowRoot) continue;
      const found = this.querySelectorDeep(selector, shadowRoot);
      if (found) return found;
    }

    return null;
  }

  private setStatus(message: string): void {
    if (!this.statusEl) return;
    this.statusEl.textContent = message;
  }

  private renderStep(): void {
    if (!this.cardEl) return;
    this.clearStepRuntime();

    const step = this.steps[this.stepIndex];
    const card = this.cardEl;
    card.innerHTML = "";

    const counter = document.createElement("div");
    counter.className = "eco-tutorial-counter";
    counter.textContent = `Step ${this.stepIndex + 1} of ${this.steps.length}`;

    const title = document.createElement("h3");
    title.className = "eco-tutorial-title";
    title.textContent = step.title;

    const body = document.createElement("p");
    body.className = "eco-tutorial-body";
    body.textContent = step.body;

    card.append(counter, title, body);

    if (step.emphasis) {
      const emphasis = document.createElement("p");
      emphasis.className = "eco-tutorial-body eco-tutorial-body-strong";
      const strong = document.createElement("strong");
      strong.textContent = step.emphasis;
      emphasis.appendChild(strong);
      card.appendChild(emphasis);
    }

    if (step.showSamplePrompt) {
      const sample = document.createElement("div");
      sample.className = "eco-tutorial-sample";
      sample.textContent = `${SAMPLE_PROMPT.slice(0, 68)}...`;
      card.appendChild(sample);
    }

    const status = document.createElement("p");
    status.className = "eco-tutorial-status";
    card.appendChild(status);
    this.statusEl = status;

    const actions = document.createElement("div");
    actions.className = "eco-tutorial-actions";

    if (step.showSamplePrompt) {
      const copyBtn = document.createElement("button");
      copyBtn.type = "button";
      copyBtn.className = "eco-tutorial-btn eco-secondary";
      copyBtn.textContent = "Copy to Clipboard";
      copyBtn.addEventListener("click", () => this.copySamplePrompt(copyBtn));
      actions.appendChild(copyBtn);
    }

    if (step.allowSkip) {
      const skipBtn = document.createElement("button");
      skipBtn.type = "button";
      skipBtn.className = "eco-tutorial-btn eco-secondary";
      skipBtn.textContent = "End Tutorial";
      skipBtn.addEventListener("click", () => {
        void this.finishTutorial();
      });
      actions.appendChild(skipBtn);
    }

    if (step.primaryLabel) {
      const primaryBtn = document.createElement("button");
      primaryBtn.type = "button";
      primaryBtn.className = "eco-tutorial-btn eco-primary";
      primaryBtn.textContent = step.primaryLabel;
      primaryBtn.addEventListener("click", async () => {
        if (this.stepIndex >= this.steps.length - 1) {
          await this.finishTutorial();
          return;
        }
        this.nextStep();
      });
      actions.appendChild(primaryBtn);
    }

    if (actions.children.length > 0) {
      card.appendChild(actions);
    }

    if (step.waitForClickSelector) {
      this.bindWaitForClick(step.waitForClickSelector);
    } else {
      this.setStatus("");
    }

    this.refreshLayout();
  }

  private copySamplePrompt(button: HTMLButtonElement): void {
    const fallback = () => {
      const textArea = document.createElement("textarea");
      textArea.value = SAMPLE_PROMPT;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      textArea.remove();
    };

    const onSuccess = () => {
      button.textContent = "Copied";
      window.setTimeout(() => {
        button.textContent = "Copy to Clipboard";
      }, 1200);
    };

    if (!navigator.clipboard || !navigator.clipboard.writeText) {
      fallback();
      onSuccess();
      return;
    }

    navigator.clipboard
      .writeText(SAMPLE_PROMPT)
      .then(onSuccess)
      .catch(() => {
        fallback();
        onSuccess();
      });
  }

  private bindWaitForClick(selector: string): void {
    let boundTarget: HTMLElement | null = null;
    const handler = () => this.nextStep();

    const attach = () => {
      const target = this.querySelectorDeep(selector);
      if (!target) {
        this.setStatus("Waiting for button to appear...");
        return;
      }
      if (boundTarget === target) {
        this.setStatus("Click the highlighted button to continue.");
        return;
      }

      if (boundTarget) {
        boundTarget.removeEventListener("click", handler);
      }

      boundTarget = target;
      boundTarget.addEventListener("click", handler, { once: true });
      this.setStatus("Click the highlighted button to continue.");
    };

    attach();
    this.waitIntervalId = window.setInterval(attach, 300);
    this.detachStepListener = () => {
      if (boundTarget) {
        boundTarget.removeEventListener("click", handler);
      }
    };
  }

  private nextStep(): void {
    if (this.stepIndex >= this.steps.length - 1) return;
    this.stepIndex += 1;
    this.renderStep();
  }

  private async finishTutorial(): Promise<void> {
    if (this.completed) return;
    this.completed = true;
    await this.setHasSeenTutorial();
    this.destroy();
  }

  private refreshLayout(): void {
    if (this.ensureMounted()) return;

    const step = this.steps[this.stepIndex];
    this.positionCard(step);
    this.positionSpotlight(step);
  }

  private positionCard(step: TutorialStep): void {
    if (!this.cardEl) return;
    const card = this.cardEl;
    const margin = 16;

    if (step.mode === "center") {
      card.style.top = "50%";
      card.style.left = "50%";
      card.style.right = "auto";
      card.style.transform = "translate(-50%, -50%)";
      return;
    }

    if (step.mode === "toolbar") {
      card.style.top = "96px";
      card.style.right = "24px";
      card.style.left = "auto";
      card.style.transform = "none";
      return;
    }

    const target = step.targetSelector ? this.querySelectorDeep(step.targetSelector) : null;
    if (!target) {
      card.style.top = "50%";
      card.style.left = "50%";
      card.style.right = "auto";
      card.style.transform = "translate(-50%, -50%)";
      return;
    }

    const rect = target.getBoundingClientRect();
    const cardRect = card.getBoundingClientRect();
    const centeredLeft = rect.left + rect.width / 2 - cardRect.width / 2;
    const minLeft = margin;
    const maxLeft = window.innerWidth - cardRect.width - margin;
    const left = Math.min(Math.max(centeredLeft, minLeft), Math.max(minLeft, maxLeft));

    let top = rect.bottom + 14;
    if (top + cardRect.height > window.innerHeight - margin) {
      top = rect.top - cardRect.height - 14;
    }
    if (top < margin) {
      top = margin;
    }

    card.style.top = `${Math.round(top)}px`;
    card.style.left = `${Math.round(left)}px`;
    card.style.right = "auto";
    card.style.transform = "none";
  }

  private positionSpotlight(step: TutorialStep): void {
    if (!this.spotlightEl) return;
    const spotlight = this.spotlightEl;

    if (step.mode === "center") {
      spotlight.classList.add("eco-hidden");
      return;
    }

    if (step.mode === "toolbar") {
      const width = 170;
      const height = 46;
      const top = 12;
      const left = window.innerWidth - width - 16;
      spotlight.style.top = `${top}px`;
      spotlight.style.left = `${left}px`;
      spotlight.style.width = `${width}px`;
      spotlight.style.height = `${height}px`;
      spotlight.classList.remove("eco-hidden");
      return;
    }

    const target = step.targetSelector ? this.querySelectorDeep(step.targetSelector) : null;
    if (!target) {
      spotlight.classList.add("eco-hidden");
      return;
    }

    const rect = target.getBoundingClientRect();
    spotlight.style.top = `${Math.max(8, Math.round(rect.top - 6))}px`;
    spotlight.style.left = `${Math.max(8, Math.round(rect.left - 6))}px`;
    spotlight.style.width = `${Math.round(rect.width + 12)}px`;
    spotlight.style.height = `${Math.round(rect.height + 12)}px`;
    spotlight.classList.remove("eco-hidden");
  }

  destroy(): void {
    this.clearStepRuntime();
    this.clearGlobalRuntime();

    if (this.root) {
      this.root.remove();
      this.root = null;
    }
    this.cardEl = null;
    this.spotlightEl = null;
    this.statusEl = null;
  }
}
