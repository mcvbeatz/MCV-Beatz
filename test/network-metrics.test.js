import test from "node:test";
import assert from "node:assert/strict";
import { NetworkMetrics } from "../server/network-metrics.js";
import { ClientNetworkDiagnostics } from "../src/network-diagnostics.js";
test("aggregate wire metrics separate browsing from room traffic and stay bounded", () => {
  const metrics = new NetworkMetrics(true),
    ws = { _socket: { bytesWritten: 100 } };
  try {
    metrics.track(ws);
    ws._socket.bytesWritten += 50;
    metrics.setActive(ws, true);
    ws._socket.bytesWritten += 200;
    metrics.add("playerSeconds", 10);
    for (let i = 0; i < 5000; i++) metrics.observe("testMs", i);
    const report = metrics.report();
    assert.equal(report.wireBytes, 250);
    assert.equal(report.roomWireBytes, 200);
    assert.equal(report.directoryWireBytes, 50);
    assert.equal(report.wireBytesPerPlayerMinute, 1200);
    assert.equal(metrics.samples.testMs.values.length, 1024);
    metrics.reset();
    ws._socket.bytesWritten += 30;
    assert.equal(metrics.report().roomWireBytes, 30);
    metrics.collect(ws, true);
    assert.equal(metrics.active.size, 0);
  } finally {
    metrics.close();
  }
});
test("client diagnostics report FPS and bounded timing percentiles without state payloads", () => {
  const d = new ClientNetworkDiagnostics();
  for (let i = 0; i < 600; i++) d.frame(1 / 60, 2);
  d.observe("roundTripMs", 4);
  d.observe("roundTripMs", 10);
  d.snapshot(100);
  const report = d.report();
  assert.ok(Math.abs(report.renderFps - 60) < 0.001);
  assert.equal(report.timings.roundTripMs.p95, 10);
  assert.equal(report.timings.roundTripMs.count, 2);
  assert.equal(d.values.renderMs.values.length, 256);
  assert.equal(report.receivedJsonBytes, 100);
});
