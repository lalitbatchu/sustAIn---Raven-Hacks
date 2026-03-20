import {
  warmCompressionEngine,
  compressTextWithEngine,
  type CompressionJob
} from "./compression/runtime.js";

type CompressionRequest =
  | (CompressionJob & {
      type: "compress";
      requestId?: number;
    })
  | {
      type: "warmup";
      requestId?: number;
    };

type WorkerResponse = {
  status: "progress" | "complete" | "error" | "ready";
  requestId?: number | string;
};

const workerScope = self as {
  postMessage: (message: WorkerResponse & Record<string, unknown>) => void;
  onmessage: ((event: MessageEvent<CompressionRequest>) => void) | null;
};

workerScope.onmessage = async (event: MessageEvent<CompressionRequest>) => {
  const message = event.data;

  if (!message || (message.type !== "compress" && message.type !== "warmup")) {
    workerScope.postMessage({
      status: "error",
      message: "Unsupported worker message type"
    });
    return;
  }

  if (message.type === "warmup") {
    try {
      await warmCompressionEngine(({ phase, message: progressMessage }) => {
        workerScope.postMessage({
          status: "progress",
          requestId: event.data.requestId,
          phase,
          message: progressMessage
        });
      });

      workerScope.postMessage({
        status: "ready",
        requestId: message.requestId
      });
    } catch (error) {
      workerScope.postMessage({
        status: "error",
        requestId: message.requestId,
        message: error instanceof Error ? error.message : "Compression failed."
      });
    }
    return;
  }

  try {
    const output = await compressTextWithEngine(message, ({ phase, message }) => {
      workerScope.postMessage({
        status: "progress",
        requestId: event.data.requestId,
        phase,
        message
      });
    });

    workerScope.postMessage({
      status: "complete",
      requestId: message.requestId,
      output
    });
  } catch (error) {
    workerScope.postMessage({
      status: "error",
      requestId: message.requestId,
      message: error instanceof Error ? error.message : "Compression failed."
    });
  }
};
