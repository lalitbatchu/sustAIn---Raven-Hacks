import type { CompressionJob } from "../compression/runtime.js";

const WORKER_URL = "https://backend.lalitbatchu.workers.dev";
const COMPRESSION_PORT_NAME = "prompt-compress";
const OFFSCREEN_DOCUMENT_PATH = "offscreen.html";
const OFFSCREEN_TARGET = "compression-offscreen";
const BACKGROUND_TARGET = "compression-background";

type CompressionPortMessage =
  | {
      type: "warmup";
    }
  | {
      type: "compress";
      payload?: CompressionJob;
    };

type OffscreenCommand =
  | {
      target: typeof OFFSCREEN_TARGET;
      type: "warmup";
      requestId: number;
    }
  | {
      target: typeof OFFSCREEN_TARGET;
      type: "compress";
      requestId: number;
      payload?: CompressionJob;
    };

type OffscreenEvent =
  | {
      target: typeof BACKGROUND_TARGET;
      type: "compression-keepalive";
    }
  | {
      target: typeof BACKGROUND_TARGET;
      type: "compression-progress";
      requestId: number;
      phase?: "init" | "compress";
      message?: string;
    }
  | {
      target: typeof BACKGROUND_TARGET;
      type: "compression-ready";
      requestId: number;
    }
  | {
      target: typeof BACKGROUND_TARGET;
      type: "compression-complete";
      requestId: number;
      output?: string;
    }
  | {
      target: typeof BACKGROUND_TARGET;
      type: "compression-error";
      requestId: number;
      message?: string;
    };

type PendingRequest = {
  kind: "warmup" | "compress";
  port: chrome.runtime.Port;
};

type RuntimeMessage =
  | {
      type: "eco-log";
      payload?: {
        userId?: string;
        tokens?: number;
        originalTokens?: number;
        compressedTokens?: number;
      };
    };

console.log("SustAIn: background service worker loaded");

let nextRequestId = 1;
let creatingOffscreenDocument: Promise<void> | null = null;
const pendingRequests = new Map<number, PendingRequest>();

function toNumber(value: unknown) {
  const parsed =
    typeof value === "number" ? value : Number.parseFloat(String(value ?? ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function toErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Compression failed.";
}

function normalizeUserId(value: unknown) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, 128);
}

function safePostMessage(port: chrome.runtime.Port, payload: unknown) {
  try {
    port.postMessage(payload);
  } catch (error) {
    console.warn("SustAIn: compression port closed", error);
  }
}

function removePendingRequestsForPort(port: chrome.runtime.Port) {
  for (const [requestId, pending] of pendingRequests.entries()) {
    if (pending.port === port) {
      pendingRequests.delete(requestId);
    }
  }
}

async function ensureOffscreenDocument() {
  if (await chrome.offscreen.hasDocument()) {
    return;
  }

  if (!creatingOffscreenDocument) {
    creatingOffscreenDocument = chrome.offscreen
      .createDocument({
        url: OFFSCREEN_DOCUMENT_PATH,
        reasons: [chrome.offscreen.Reason.WORKERS],
        justification:
          "Keep the local compression model runtime alive in a dedicated worker."
      })
      .finally(() => {
        creatingOffscreenDocument = null;
      });
  }

  await creatingOffscreenDocument;
}

async function dispatchToOffscreen(message: OffscreenCommand) {
  await ensureOffscreenDocument();
  await chrome.runtime.sendMessage(message);
}

function handleOffscreenEvent(message: OffscreenEvent) {
  if (message.type === "compression-keepalive") {
    return;
  }

  const pending = pendingRequests.get(message.requestId);
  if (!pending) return;

  if (message.type === "compression-progress") {
    safePostMessage(pending.port, {
      status: "progress",
      phase: message.phase ?? "init",
      message: message.message ?? ""
    });
    return;
  }

  if (message.type === "compression-ready") {
    pendingRequests.delete(message.requestId);
    safePostMessage(pending.port, {
      status: "ready"
    });
    return;
  }

  if (message.type === "compression-complete") {
    pendingRequests.delete(message.requestId);
    safePostMessage(pending.port, {
      status: "complete",
      output: message.output ?? ""
    });
    return;
  }

  if (message.type === "compression-error") {
    pendingRequests.delete(message.requestId);
    safePostMessage(pending.port, {
      status: "error",
      message: message.message ?? "Compression failed."
    });
  }
}

chrome.runtime.onMessage.addListener(
  (message: RuntimeMessage | OffscreenEvent, _sender, sendResponse) => {
    if (message?.type === "eco-log") {
      const rawPayload = message.payload ?? {};
      const userId = normalizeUserId(rawPayload.userId);
      const tokens = Math.max(0, toNumber(rawPayload.tokens));
      const originalTokens = Math.max(0, toNumber(rawPayload.originalTokens));
      const compressedTokens = Math.max(0, toNumber(rawPayload.compressedTokens));
      const normalizedPayload = {
        userId,
        tokens,
        originalTokens,
        compressedTokens
      };

      console.log("SustAIn: eco-log received", normalizedPayload);

      fetch(WORKER_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(normalizedPayload)
      })
        .then(async (response) => {
          if (!response.ok) {
            const responseText = await response.text().catch(() => "");
            console.error("EcoStats cloud log failed", {
              status: response.status,
              body: responseText
            });
            sendResponse({ ok: false, status: response.status });
            return;
          }

          sendResponse({ ok: true });
        })
        .catch((error) => {
          console.error("EcoStats cloud log failed", error);
          sendResponse({ ok: false });
        });

      return true;
    }

    if ((message as OffscreenEvent)?.target === BACKGROUND_TARGET) {
      handleOffscreenEvent(message as OffscreenEvent);
      sendResponse({ ok: true });
      return false;
    }

    return false;
  }
);

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== COMPRESSION_PORT_NAME) return;

  port.onDisconnect.addListener(() => {
    removePendingRequestsForPort(port);
  });

  port.onMessage.addListener((message) => {
    const request = message as CompressionPortMessage | undefined;
    if (!request || (request.type !== "compress" && request.type !== "warmup")) {
      safePostMessage(port, {
        status: "error",
        message: "Unsupported compression port message"
      });
      return;
    }

    if (request.type === "compress") {
      const job = request.payload;
      if (!job || typeof job.text !== "string") {
        safePostMessage(port, {
          status: "error",
          message: "Invalid compression payload"
        });
        return;
      }
    }

    const requestId = nextRequestId++;
    pendingRequests.set(requestId, {
      kind: request.type,
      port
    });

    safePostMessage(port, {
      status: "progress",
      phase: "init",
      message:
        request.type === "warmup"
          ? "Starting compression engine warmup"
          : "Starting local compression"
    });

    const offscreenCommand: OffscreenCommand =
      request.type === "warmup"
        ? {
            target: OFFSCREEN_TARGET,
            type: "warmup",
            requestId
          }
        : {
            target: OFFSCREEN_TARGET,
            type: "compress",
            requestId,
            payload: request.payload
          };

    void dispatchToOffscreen(offscreenCommand).catch((error) => {
      pendingRequests.delete(requestId);
      console.error("SustAIn: compression dispatch failed", error);
      safePostMessage(port, {
        status: "error",
        message: toErrorMessage(error)
      });
    });
  });
});
