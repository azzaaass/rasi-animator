// firmware-list.js
// Daftar file .bin yang bisa dipilih di pages/uploader.html. File-nya disimpan di assets/code/.
// Hosting statis tidak bisa membaca isi folder, jadi setiap file baru harus didaftarkan di sini.
//
// Field:
//   name    : nama yang tampil di pilihan code
//   board   : "esp32" atau "uno"
//   file    : nama file di dalam assets/code/
//   chip    : (khusus ESP32, opsional) "ESP32", "ESP32-S3", "ESP32-C3", ...
//             upload dibatalkan kalau chip yang tersambung berbeda
//   address : (khusus ESP32, default 0x0) alamat flash:
//             0x0     untuk *.merged.bin, sudah termasuk bootloader & tabel partisi (disarankan)
//             0x10000 untuk *.ino.bin, hanya program, board harus sudah punya bootloader Arduino
//
// Untuk UNO pakai *.with_bootloader.bin hasil Export Compiled Binary, bagian bootloader-nya otomatis dilewati.
//
// Contoh:
//   { name: "Animasi Rasi", board: "esp32", chip: "ESP32", file: "animasi_rasi.ino.merged.bin", address: 0x0 },
//   { name: "Blink", board: "uno", file: "blink.ino.with_bootloader.bin" },

export const FIRMWARE_LIST = [
    {
        name: "RelayFy", 
        board: "uno", 
        file: "relayfy_arduino.ino.with_bootloader.bin"
    }
];
