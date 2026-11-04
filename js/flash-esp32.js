// flash-esp32.js
// Upload .bin ke ESP32 lewat Web Serial, memakai esptool-js dari Espressif.

const BAUD_RATE = 460800; // Esptool mulai dari 115200, lalu naik ke sini setelah terhubung

const IMAGE_MAGIC = 0xe9;
const APP_DESC_OFFSET = 0x20;
const APP_DESC_MAGIC = 0xabcd5432;

const loadEsptool = () => import("https://cdn.jsdelivr.net/npm/esptool-js@0.7.0/bundle.js");
const loadSparkMD5 = () => import("https://cdn.jsdelivr.net/npm/spark-md5@3.0.2/+esm").then((m) => m.default);

// File program saja (*.ino.bin) punya esp_app_desc_t tepat setelah header image.
// Bootloader & *.merged.bin tidak punya penanda ini di posisi tersebut.
function isAppOnlyImage(data) {
  if (data.length < APP_DESC_OFFSET + 4 || data[0] !== IMAGE_MAGIC) return false;
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  return view.getUint32(APP_DESC_OFFSET, true) === APP_DESC_MAGIC;
}

export function validate(data, fw) {
  // Program di alamat 0x0 akan menimpa bootloader dan ESP32 jadi boot loop
  if (isAppOnlyImage(data) && (fw.address ?? 0) < 0x10000) {
    return "File ini hanya berisi program, tidak bisa ditulis ke alamat 0x0. Pakai file *.merged.bin atau atur address 0x10000.";
  }
  return null;
}

export async function flash(port, data, fw, { onLog, onProgress }) {
  const [{ ESPLoader, Transport }, SparkMD5] = await Promise.all([loadEsptool(), loadSparkMD5()]);

  const transport = new Transport(port);
  const loader = new ESPLoader({
    transport,
    baudrate: BAUD_RATE,
    terminal: {
      clean() {},
      writeLine: (text) => onLog(text + "\n"),
      write: (text) => onLog(text),
    },
  });

  try {
    try {
      await loader.main();
    } catch (err) {
      if (err.name === "NetworkError") throw err;
      onLog(`${err.message}\n`);
      throw new Error("Gagal terhubung ke ESP32. Coba tahan tombol BOOT saat upload dimulai.");
    }

    const chipName = loader.chip.CHIP_NAME;
    if (fw.chip && chipName !== fw.chip) {
      throw new Error(`Code ini untuk ${fw.chip}, tapi board yang tersambung ${chipName}.`);
    }

    await loader.writeFlash({
      fileArray: [{ data, address: fw.address ?? 0 }],
      flashMode: "keep",
      flashFreq: "keep",
      flashSize: "keep",
      eraseAll: false,
      compress: true,
      reportProgress: (_, written, total) => onProgress(written / total),
      calculateMD5Hash: (image) => SparkMD5.ArrayBuffer.hash(image.slice().buffer),
    });

    await loader.after("hard_reset");
  } finally {
    await transport.disconnect().catch(() => {});
  }
}
