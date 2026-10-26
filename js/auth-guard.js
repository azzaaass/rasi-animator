// auth-guard.js
// Shared PIN validation + route protection logic.
// Digunakan oleh index.html dan semua halaman di pages/ kecuali view_pin.html (PIN pelanggan)
// supaya logikanya tidak duplikat di setiap file.
// Password admin untuk pages/view_pin.html ada terpisah di admin-guard.js.

import { PIN_LIST } from "./pin-data.js";

// Dihitung relatif terhadap file ini (js/), jadi tetap benar dari index.html maupun pages/*.html
const LOGIN_PAGE = new URL("../index.html", import.meta.url).href;

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
 * Panggil di setiap halaman terproteksi (pages/*.html kecuali view_pin.html).
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
  window.location.replace(LOGIN_PAGE);
}

/**
 * Logout manual dari tombol "Keluar" di navbar.
 */
export function logout() {
  localStorage.removeItem("rasi_pin");
  localStorage.removeItem("rasi_access");
  window.location.replace(LOGIN_PAGE);
}
