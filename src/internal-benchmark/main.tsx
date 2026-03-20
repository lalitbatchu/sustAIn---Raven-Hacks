// TEMPORARY INTERNAL BENCHMARK TOOLING.
// Remove this file and the rest of src/internal-benchmark after the translation experiment.

import React from "react";
import ReactDOM from "react-dom/client";
import BenchmarkApp from "./BenchmarkApp";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <BenchmarkApp />
  </React.StrictMode>
);
