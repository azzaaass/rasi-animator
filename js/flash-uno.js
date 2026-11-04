// flash-uno.js
// Upload .bin ke Arduino UNO R3 lewat Web Serial, memakai protokol STK500v1
// yang dipahami bootloader Optiboot bawaan UNO.

const BAUD_RATE = 115200;
const PAGE_SIZE = 128;
const FLASH_SIZE = 32768;
const MAX_SIZE = 32256; // Flash 32 KB dikurangi 512 byte untuk Optiboot

// ATmega328P dan ATmega328 (dipakai sebagian UNO clone)
const SIGNATURES = ["1e950f", "1e9514"];

const RESET_ATTEMPTS = 3;
const SYNC_TRIES = 5;
const SYNC_TIMEOUT_MS = 200; // 5 x 200 ms, pas dengan jendela bootloader Optiboot (~1 detik)
const COMMAND_TIMEOUT_MS = 1000;

const STK = {
  OK: 0x10,
  INSYNC: 0x14,
  CRC_EOP: 0x20,
  GET_SYNC: 0x30,
  ENTER_PROGMODE: 0x50,
  LEAVE_PROGMODE: 0x51,
  LOAD_ADDRESS: 0x55,
  PROG_PAGE: 0x64,
  READ_PAGE: 0x74,
  READ_SIGN: 0x75,
};

const FLASH_MEMORY = 0x46; // "F"

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

class SerialLink {
  constructor(port) {
    this.port = port;
    this.rx = [];
    this.wake = null;
    this.closing = false;
    this.lost = false;
    this.reader = null;
    this.writer = port.writable.getWriter();
    this.readDone = this.readLoop();
  }

  // Error non-fatal (mis. framing error, bisa muncul saat board reset) menutup reader,
  // tapi port.readable diganti stream baru. Kalau USB dicabut, port.readable jadi null.
  async readLoop() {
    while (this.port.readable && !this.closing) {
      this.reader = this.port.readable.getReader();
      try {
        for (;;) {
          const { value, done } = await this.reader.read();
          if (done) break;
          this.rx.push(...value);
          if (this.wake) this.wake();
        }
      } catch {
        // Lanjut ke putaran berikutnya
      } finally {
        this.reader.releaseLock();
      }
    }
    this.lost = !this.closing;
    if (this.wake) this.wake();
  }

  clear() {
    this.rx.length = 0;
  }

  write(bytes) {
    return this.writer.write(Uint8Array.from(bytes));
  }

  async read(count, timeoutMs) {
    const deadline = Date.now() + timeoutMs;
    while (this.rx.length < count) {
      if (this.lost) throw new Error("Koneksi ke board terputus.");
      const remaining = deadline - Date.now();
      if (remaining <= 0) throw new Error("Board tidak membalas.");
      await new Promise((resolve) => {
        const timer = setTimeout(resolve, remaining);
        this.wake = () => {
          clearTimeout(timer);
          resolve();
        };
      });
    }
    return this.rx.splice(0, count);
  }

  async close() {
    this.closing = true;
    if (this.reader) await this.reader.cancel().catch(() => {});
    await this.readDone;
    this.writer.releaseLock();
    await this.port.close().catch(() => {});
  }
}

// Kirim perintah STK500, kembalikan resultSize byte hasilnya
async function command(link, bytes, resultSize = 0, timeoutMs = COMMAND_TIMEOUT_MS) {
  await link.write([...bytes, STK.CRC_EOP]);
  const reply = await link.read(resultSize + 2, timeoutMs);
  if (reply[0] !== STK.INSYNC || reply[reply.length - 1] !== STK.OK) {
    throw new Error("Balasan bootloader tidak dikenali.");
  }
  return reply.slice(1, -1);
}

// Sama seperti avrdude: DTR/RTS low lalu high memicu reset lewat kapasitor auto-reset UNO
async function resetBoard(port) {
  await port.setSignals({ dataTerminalReady: false, requestToSend: false });
  await sleep(250);
  await port.setSignals({ dataTerminalReady: true, requestToSend: true });
  await sleep(50);
}

async function syncBootloader(port, link) {
  for (let attempt = 0; attempt < RESET_ATTEMPTS; attempt++) {
    await resetBoard(port);
    for (let i = 0; i < SYNC_TRIES; i++) {
      link.clear();
      try {
        await command(link, [STK.GET_SYNC], 0, SYNC_TIMEOUT_MS);
        return;
      } catch (err) {
        if (link.lost) throw err;
      }
    }
  }
  throw new Error("Bootloader UNO tidak merespons. Pastikan port yang dipilih benar dan board adalah UNO R3.");
}

function loadAddress(link, byteAddress) {
  const word = byteAddress >> 1; // Optiboot memakai alamat word, bukan byte
  return command(link, [STK.LOAD_ADDRESS, word & 0xff, word >> 8]);
}

// *.with_bootloader.bin dari Arduino IDE sebesar seluruh flash: program, padding 0xFF, lalu Optiboot.
// Yang ditulis hanya programnya, karena board sudah punya Optiboot dan Optiboot tidak bisa menimpa dirinya sendiri.
function programBytes(data) {
  if (data.length !== FLASH_SIZE) return data;
  let end = MAX_SIZE;
  while (end > 0 && data[end - 1] === 0xff) end--;
  return data.subarray(0, end);
}

export function validate(data) {
  const size = programBytes(data).length;
  if (size === 0) return "File tidak berisi program.";
  if (size > MAX_SIZE) {
    return `File terlalu besar untuk UNO (${size} byte, maksimal ${MAX_SIZE} byte).`;
  }
  return null;
}

export async function flash(port, data, fw, { onLog, onProgress }) {
  const program = programBytes(data);
  if (program !== data) onLog("File berisi bootloader, hanya bagian program yang ditulis.\n");

  // Page terakhir diisi 0xFF, sama seperti flash yang kosong
  const pageCount = Math.ceil(program.length / PAGE_SIZE);
  const image = new Uint8Array(pageCount * PAGE_SIZE).fill(0xff);
  image.set(program);

  await port.open({ baudRate: BAUD_RATE });
  const link = new SerialLink(port);
  try {
    onLog("Reset board, menunggu bootloader...\n");
    await syncBootloader(port, link);

    const signature = await command(link, [STK.READ_SIGN], 3);
    const signatureHex = signature.map((b) => b.toString(16).padStart(2, "0")).join("");
    onLog(`Signature chip: ${signatureHex}\n`);
    if (!SIGNATURES.includes(signatureHex)) {
      throw new Error(`Chip tidak dikenali (signature ${signatureHex}). Board ini bukan UNO R3.`);
    }

    await command(link, [STK.ENTER_PROGMODE]);

    onLog(`Menulis ${program.length} byte...\n`);
    for (let page = 0; page < pageCount; page++) {
      const start = page * PAGE_SIZE;
      await loadAddress(link, start);
      await command(link, [STK.PROG_PAGE, 0, PAGE_SIZE, FLASH_MEMORY, ...image.subarray(start, start + PAGE_SIZE)]);
      onProgress((page + 1) / (pageCount * 2));
    }

    onLog("Memverifikasi...\n");
    for (let page = 0; page < pageCount; page++) {
      const start = page * PAGE_SIZE;
      await loadAddress(link, start);
      const written = await command(link, [STK.READ_PAGE, 0, PAGE_SIZE, FLASH_MEMORY], PAGE_SIZE);
      const badIndex = written.findIndex((b, i) => b !== image[start + i]);
      if (badIndex !== -1) {
        throw new Error(`Verifikasi gagal di alamat 0x${(start + badIndex).toString(16)}. Coba upload ulang.`);
      }
      onProgress((pageCount + page + 1) / (pageCount * 2));
    }

    // Setelah perintah ini Optiboot langsung menjalankan program yang baru
    await command(link, [STK.LEAVE_PROGMODE]);
    onLog("Verifikasi OK.\n");
  } finally {
    await link.close();
  }
}
