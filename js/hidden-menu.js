// hidden-menu.js
// Menu tersembunyi di navbar (elemen dengan atribut data-hidden-menu, misalnya Uploader).
// Muncul setelah logo / nama aplikasi (#brand) diklik 3 kali berturut-turut,
// lalu tetap tampil di semua halaman sampai tab browser ditutup (sessionStorage).

const SESSION_KEY = "rasi_hidden_menu";
const CLICKS_NEEDED = 3;
const MAX_GAP_MS = 800; // jeda maksimal antar klik supaya masih dihitung berturut-turut

function reveal() {
  document.querySelectorAll("[data-hidden-menu]").forEach((el) => el.classList.remove("hidden"));
  try {
    sessionStorage.setItem(SESSION_KEY, "1");
  } catch {}
}

try {
  if (sessionStorage.getItem(SESSION_KEY)) reveal();
} catch {}

let clicks = 0;
let resetTimer = null;

document.getElementById("brand")?.addEventListener("click", () => {
  clicks++;
  clearTimeout(resetTimer);
  resetTimer = setTimeout(() => (clicks = 0), MAX_GAP_MS);
  if (clicks >= CLICKS_NEEDED) {
    clicks = 0;
    reveal();
  }
});
