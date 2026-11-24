// Explicit developer URL only; never shown in the ordinary game or settings.
export function installNetworkDebug(getClient) {
  if (new URLSearchParams(location.search).get("netdebug") !== "1") return;
  const panel = document.createElement("pre");
  panel.id = "network-debug";
  panel.style.cssText =
    "position:fixed;top:6px;left:6px;z-index:10000;pointer-events:none;margin:0;padding:7px;background:#092a2bea;color:#f4d894;border:1px solid #c8a75b;border-radius:6px;font:11px/1.4 monospace;max-width:calc(100vw - 26px);white-space:pre-wrap";
  document.body.append(panel);
  const update = () => {
    const c = getClient();
    if (!c?.state) {
      panel.textContent = "Network diagnostics: not connected";
      return;
    }
    const d = c.diagnostics.report(),
      p = c.prediction;
    const mean = (k) => d.timings[k]?.mean?.toFixed(1) ?? "—";
    panel.textContent = `Prediction ${p.enabled ? "ON" : "OFF"}${p.enabled && !p.presentation() ? " (authoritative fallback)" : ""}\nRTT ${mean("roundTripMs")} ms · ${d.renderFps.toFixed(0)} FPS · snapshots ${d.snapshotsPerSecond.toFixed(1)}/s\nInput → draw ${mean("inputToDrawMs")} ms · error ${mean("predictionError")} units\nQueued ${p.history.length} · resyncs ${d.resyncs}`;
  };
  update();
  const timer = setInterval(update, 500);
  addEventListener("pagehide", () => clearInterval(timer), { once: true });
}
