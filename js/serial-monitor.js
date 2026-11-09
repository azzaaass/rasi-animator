// serial-monitor.js
// Terminal serial seperti Serial Monitor Arduino IDE, lewat Web Serial.

export class SerialMonitor {
  // onData(text): teks yang diterima dari board
  // onLost(): koneksi putus bukan karena close(), misalnya USB dicabut
  constructor({ onData, onLost }) {
    this.onData = onData;
    this.onLost = onLost;
    this.port = null;
    this.reader = null;
    this.closing = false;
    this.readDone = null;
  }

  get isOpen() {
    return this.port !== null;
  }

  async open(port, baudRate) {
    await port.open({ baudRate });
    // DTR & RTS dilepas: kalau tertahan aktif, rangkaian auto-reset ESP32 bisa menahan chip di reset / mode download
    await port.setSignals({ dataTerminalReady: false, requestToSend: false }).catch(() => {});
    this.port = port;
    this.closing = false;
    this.readDone = this.readLoop(port);
  }

  // Error non-fatal (mis. framing error saat board reset) menutup reader, tapi port.readable diganti stream baru.
  // Kalau USB dicabut, port.readable jadi null.
  async readLoop(port) {
    const decoder = new TextDecoder();
    while (port.readable && !this.closing) {
      this.reader = port.readable.getReader();
      try {
        for (;;) {
          const { value, done } = await this.reader.read();
          if (done) break;
          this.onData(decoder.decode(value, { stream: true }));
        }
      } catch {
        // Lanjut ke putaran berikutnya
      } finally {
        this.reader.releaseLock();
      }
    }

    if (!this.closing) {
      this.port = null;
      await port.close().catch(() => {});
      this.onLost();
    }
  }

  async write(text) {
    const writer = this.port.writable.getWriter();
    try {
      await writer.write(new TextEncoder().encode(text));
    } finally {
      writer.releaseLock();
    }
  }

  async close() {
    if (!this.port) return;
    const port = this.port;
    this.closing = true;
    if (this.reader) await this.reader.cancel().catch(() => {});
    await this.readDone;
    this.port = null;
    await port.close().catch(() => {});
  }
}
