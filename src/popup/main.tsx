import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import {
  Droplet,
  FileText,
  Leaf,
  Mail,
  Percent,
  SlidersHorizontal,
  Zap,
  Undo
} from "lucide-react";
import "../style.css";
import "./popup.css";
import {
  DEFAULT_STORAGE_STATE,
  getStorage,
  setStorage,
  type StorageState
} from "../utils/storage";

function App() {
  const [storageState, setStorageState] = useState<StorageState>(
    DEFAULT_STORAGE_STATE
  );
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    let mounted = true;
    const relevantStorageKeys = new Set([
      "totalTokens",
      "totalOriginalTokens",
      "totalCompressedTokens",
      "compressionPercent",
      "totalWater",
      "totalEnergy",
      "tokensSaved",
      "waterMlSaved",
      "energyWhSaved",
      "undoEnabled",
      "enableSlider",
      "compressionLevel",
      "hasSeenTutorial"
    ]);

    const refreshStorage = () => {
      void getStorage().then((state) => {
        if (!mounted) return;
        setStorageState(state);
        setIsLoaded(true);
      });
    };

    refreshStorage();

    const listener = (
      changes: Record<string, chrome.storage.StorageChange>,
      area: string
    ) => {
      if (area !== "local") return;
      const changedKeys = Object.keys(changes);
      if (changedKeys.some((key) => relevantStorageKeys.has(key))) {
        refreshStorage();
      }
    };

    chrome.storage.onChanged.addListener(listener);

    const messageListener = (
      message: unknown,
      _sender: chrome.runtime.MessageSender,
      sendResponse: (response?: unknown) => void
    ) => {
      const incoming = message as {
        type?: string;
        payload?: {
          totalTokens?: number;
          totalOriginalTokens?: number;
          totalCompressedTokens?: number;
          compressionPercent?: number;
          totalWater?: number;
          totalEnergy?: number;
          tokensSaved?: number;
          waterMlSaved?: number;
          energyWhSaved?: number;
        };
      };
      if (incoming?.type !== "eco-totals-updated") return;
      refreshStorage();
      sendResponse({ ok: true });
    };
    chrome.runtime.onMessage.addListener(messageListener);

    return () => {
      mounted = false;
      chrome.storage.onChanged.removeListener(listener);
      chrome.runtime.onMessage.removeListener(messageListener);
    };
  }, []);

  const {
    undoEnabled,
    enableSlider,
    totalTokens,
    compressionPercent,
    totalWater,
    totalEnergy
  } = storageState;

  const toggleTrackClasses = undoEnabled
    ? "pet-toggle-track-on border-emerald-300/60 bg-emerald-400/50"
    : "border-white/20 bg-white/10";
  const toggleKnobClasses = undoEnabled
    ? "translate-x-5 bg-white"
    : "translate-x-0 bg-white/60";
  const sliderToggleTrackClasses = enableSlider
    ? "pet-toggle-track-on border-emerald-300/60 bg-emerald-400/50"
    : "border-white/20 bg-white/10";
  const sliderToggleKnobClasses = enableSlider
    ? "translate-x-5 bg-white"
    : "translate-x-0 bg-white/60";

  if (!isLoaded) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="w-80 rounded-2xl border border-white/10 bg-gradient-to-br from-white/10 via-white/5 to-transparent p-5 text-xs uppercase tracking-wide text-white/50 shadow-2xl shadow-[inset_1px_1px_0_rgba(255,255,255,0.16)] backdrop-blur-xl">
          Loading...
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-80 rounded-2xl border border-white/10 bg-gradient-to-br from-white/10 via-white/5 to-transparent p-5 text-white shadow-2xl shadow-[inset_1px_1px_0_rgba(255,255,255,0.16)] backdrop-blur-xl">
        <header className="space-y-3">
          <div className="flex items-center gap-2">
            <Leaf className="pet-header-icon h-5 w-5 text-emerald-400" />
            <h1 className="text-base font-semibold tracking-wide">
              SustAIn
            </h1>
          </div>
        </header>

        <section className="mt-5 border-t border-white/10 pt-4">
          <button
            className="flex w-full items-center justify-between"
            onClick={() => {
              const next = !undoEnabled;
              setStorageState((current) => ({ ...current, undoEnabled: next }));
              void setStorage({ undoEnabled: next });
            }}
            type="button"
            aria-pressed={undoEnabled}
            aria-label="Enable Undo"
          >
            <div className="flex items-center gap-2 text-sm text-white/80">
              <Undo
                className={
                  undoEnabled ? "h-4 w-4 text-emerald-300" : "h-4 w-4 text-white/50"
                }
              />
              <span>Enable Undo</span>
            </div>
            <span
              className={`pet-toggle-track relative h-6 w-11 rounded-full border transition hover:brightness-110 ${toggleTrackClasses}`}
              aria-hidden="true"
            >
              <span
                className={`absolute left-1 top-1 h-4 w-4 rounded-full shadow-md transition ${toggleKnobClasses}`}
              />
            </span>
          </button>
          <button
            className="mt-3 flex w-full items-center justify-between"
            onClick={() => {
              const next = !enableSlider;
              setStorageState((current) => ({ ...current, enableSlider: next }));
              void setStorage({ enableSlider: next });
            }}
            type="button"
            aria-pressed={enableSlider}
            aria-label="Show Compression Dropdown"
          >
            <div className="flex items-center gap-2 text-sm text-white/80">
              <SlidersHorizontal
                className={
                  enableSlider
                    ? "h-4 w-4 text-emerald-300"
                    : "h-4 w-4 text-white/50"
                }
              />
              <span>Show Compression Dropdown</span>
            </div>
            <span
              className={`pet-toggle-track relative h-6 w-11 rounded-full border transition hover:brightness-110 ${sliderToggleTrackClasses}`}
              aria-hidden="true"
            >
              <span
                className={`absolute left-1 top-1 h-4 w-4 rounded-full shadow-md transition ${sliderToggleKnobClasses}`}
              />
            </span>
          </button>
        </section>

        <section className="mt-5 border-t border-white/10 pt-4">
          <p className="text-xs uppercase tracking-wide text-white/50">
            Usage & Savings
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2 text-center text-[11px] text-white/70">
            <div className="rounded-lg border border-white/10 bg-white/5 p-2">
              <div className="mb-1 flex items-center justify-center gap-1.5">
                <FileText className="pet-stat-icon h-4 w-4" />
                <p className="text-[10px] uppercase tracking-wide text-white/40">
                  Tokens
                </p>
              </div>
              <p className="mt-1 text-sm font-semibold text-white/90">
                <span className="pet-stat-value">
                  {Math.max(0, Math.round(totalTokens)).toLocaleString()}
                </span>
              </p>
            </div>
            <div className="rounded-lg border border-white/10 bg-white/5 p-2">
              <div className="mb-1 flex items-center justify-center gap-1.5">
                <Percent className="pet-stat-icon h-4 w-4" />
                <p className="text-[10px] uppercase tracking-wide text-white/40">
                  Compression %
                </p>
              </div>
              <p className="mt-1 text-sm font-semibold text-white/90">
                <span className="pet-stat-value">
                  {Math.max(0, compressionPercent).toFixed(0)}%
                </span>
              </p>
            </div>
            <div className="rounded-lg border border-white/10 bg-white/5 p-2">
              <div className="mb-1 flex items-center justify-center gap-1.5">
                <Droplet className="pet-stat-icon h-4 w-4" />
                <p className="text-[10px] uppercase tracking-wide text-white/40">
                  Water
                </p>
              </div>
              <p className="mt-1 text-sm font-semibold text-white/90">
                <span className="pet-stat-value">{totalWater.toFixed(1)} ml</span>
              </p>
            </div>
            <div className="rounded-lg border border-white/10 bg-white/5 p-2">
              <div className="mb-1 flex items-center justify-center gap-1.5">
                <Zap className="pet-stat-icon h-4 w-4" />
                <p className="text-[10px] uppercase tracking-wide text-white/40">
                  Energy
                </p>
              </div>
              <p className="mt-1 text-sm font-semibold text-white/90">
                <span className="pet-stat-value">{totalEnergy.toFixed(2)} Wh</span>
              </p>
            </div>
          </div>
        </section>

        <footer className="mt-5 border-t border-white/10 pt-4 text-xs text-white/60">
          <div className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-white/50" />
            <span>usesustain@gmail.com</span>
          </div>
        </footer>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
