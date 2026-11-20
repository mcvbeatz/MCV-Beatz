// Benchmark-only observer of incoming RFC6455 frames, before ws inflates them.
// Matches complete wire messages with ws's decoded messages (inflate is async).
export class WireMeter {
  constructor(socket, onSnapshot) {
    this.buffer = Buffer.alloc(0);
    this.frames = [];
    this.messages = [];
    this.fragmentBytes = 0;
    this.onSnapshot = onSnapshot;
    socket.on("data", (chunk) => this.read(chunk));
  }
  message(kind) {
    this.messages.push(kind);
    this.drain();
  }
  drain() {
    while (this.frames.length && this.messages.length) {
      const bytes = this.frames.shift(),
        kind = this.messages.shift();
      if (kind === "state" || kind === "snapshot") this.onSnapshot(bytes);
    }
  }
  read(chunk) {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    while (this.buffer.length >= 2) {
      const b = this.buffer,
        opcode = b[0] & 15,
        final = (b[0] & 128) !== 0;
      let length = b[1] & 127,
        header = 2;
      if (length === 126) {
        if (b.length < 4) return;
        length = b.readUInt16BE(2);
        header = 4;
      } else if (length === 127) {
        if (b.length < 10) return;
        length = Number(b.readBigUInt64BE(2));
        header = 10;
      }
      if (b[1] & 128) header += 4;
      if (b.length < header + length) return;
      const bytes = header + length;
      this.buffer = b.subarray(bytes);
      if (opcode < 8) {
        this.fragmentBytes += bytes;
        if (final) {
          this.frames.push(this.fragmentBytes);
          this.fragmentBytes = 0;
          this.drain();
        }
      }
    }
    this.drain();
  }
}
