type CompressionEngineResponse = {
  status?: "progress" | "complete" | "error" | "ready";
  phase?: "init" | "compress";
  output?: string;
  message?: string;
};

const COMPRESSION_REQUEST_TIMEOUT_MS = 300000;

let warmupPromise: Promise<void> | null = null;

export function requestCompressionWarmup(): Promise<void> {
  if (warmupPromise) {
    return warmupPromise;
  }

  warmupPromise = new Promise((resolve, reject) => {
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

    const resetWarmupPromise = () => {
      warmupPromise = null;
    };

    const refreshTimeout = () => {
      window.clearTimeout(timeoutId);
      timeoutId = window.setTimeout(() => {
        finish(() => {
          resetWarmupPromise();
          reject(new Error("Compression warmup timed out"));
        });
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
        finish(() => {
          resetWarmupPromise();
          reject(new Error(response.message || "Compression warmup failed"));
        });
      }
    };

    const onDisconnect = () => {
      if (settled) return;
      const runtimeError = chrome.runtime.lastError;
      finish(() => {
        if (runtimeError) {
          resetWarmupPromise();
          reject(new Error(runtimeError.message || "Compression warmup connection failed"));
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
      finish(() => {
        resetWarmupPromise();
        reject(
          error instanceof Error
            ? error
            : new Error("Compression warmup request failed")
        );
      });
    }
  });

  return warmupPromise;
}
