import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { WireMeter } from "../scripts/network-benchmark/wire-meter.js";
test("wire measurement counts compressed frames, continuations and split TCP chunks, excluding control messages", () => {
  const socket = new EventEmitter(),
    sizes = [];
  const meter = new WireMeter(socket, (n) => sizes.push(n));
  meter.message("snapshot");
  // FIN+RSV1 text, compressed payload length 3: 2-byte header + 3 bytes.
  socket.emit("data", Buffer.from([0xc1, 3, 1]));
  socket.emit("data", Buffer.from([2, 3, 0x89, 0])); // ping is not a JSON message
  assert.deepEqual(sizes, [5]);
  socket.emit("data", Buffer.from([0x41, 2, 9, 9, 0x80, 1, 9])); // fragmented compressed message
  meter.message("state");
  assert.deepEqual(sizes, [5, 7]);
  meter.message("identity");
  socket.emit("data", Buffer.from([0x81, 1, 0]));
  assert.deepEqual(sizes, [5, 7]);
  const long = Buffer.alloc(134);
  long[0] = 0xc1;
  long[1] = 126;
  long.writeUInt16BE(130, 2);
  socket.emit("data", long.subarray(0, 3));
  socket.emit("data", long.subarray(3));
  meter.message("snapshot");
  assert.deepEqual(sizes, [5, 7, 134]);
});
