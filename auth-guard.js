// auth-guard.js
// Shared PIN validation + route protection logic.
// Digunakan oleh index.html, convert_frames.html, dan convert_images_rgb.html
// supaya logikanya tidak duplikat di setiap file.

import { PIN_LIST } from "./pin-data.js";

/**
 * Cek apakah sebuah PIN valid & masih dalam rentang aktif.
 */
export function validatePin(pin) {
  const today = new Date().setHours(0, 0, 0, 0);

  for (const item of PIN_LIST) {
    if (item.code === pin) {
      const active = new Date(item.active_at).setHours(0, 0, 0, 0);
      const expired = new Date(item.expires_at).setHours(0, 0, 0, 0);

      if (today < active) return { ok: false, msg: "PIN belum aktif." };
      if (today > expired) return { ok: false, msg: "PIN sudah kedaluwarsa." };

      return { ok: true };
    }
  }

  return { ok: false, msg: "PIN tidak ditemukan." };
}

/**
 * Panggil di setiap halaman terproteksi (convert_frames.html, convert_images_rgb.html).
 * Body halaman diberi class Tailwind "invisible" secara default di HTML.
 * Jika PIN valid -> class "invisible" dilepas sehingga halaman tampil.
 * Jika tidak valid -> hapus cache & redirect ke index.html (halaman tetap invisible).
 */
export function requireAuth() {
  const savedPin = localStorage.getItem("rasi_pin");
  const accessFlag = localStorage.getItem("rasi_access");

  if (!savedPin || accessFlag !== "allowed") {
    kickOut();
    return false;
  }

  const res = validatePin(savedPin);
  if (!res.ok) {
    kickOut();
    return false;
  }

  // Auth OK -> tampilkan halaman
  document.body.classList.remove("invisible");
  return true;
}

function kickOut() {
  localStorage.removeItem("rasi_pin");
  localStorage.removeItem("rasi_access");
  window.location.replace("index.html");
}

/**
 * Logout manual dari tombol "Keluar" di navbar.
 */
export function logout() {
  localStorage.removeItem("rasi_pin");
  localStorage.removeItem("rasi_access");
  window.location.replace("index.html");
}
