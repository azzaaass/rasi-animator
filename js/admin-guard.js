// admin-guard.js
// Password admin khusus untuk pages/view_pin.html, terpisah dari PIN pelanggan (auth-guard.js).
// Disimpan di sessionStorage, jadi otomatis hilang saat tab/browser ditutup.

// SHA-256 dari password admin (bukan teks aslinya), supaya password tidak terbaca langsung di source.
// Untuk ganti password, generate hash baru, misalnya:
//   node -e "console.log(require('crypto').createHash('sha256').update('PASSWORD_BARU').digest('hex'))"
const ADMIN_PASSWORD_HASH = "240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9";
const SESSION_KEY = "rasi_admin";

async function sha256(text) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Cek apakah sesi admin masih valid.
 * Yang disimpan di session adalah hash password, jadi kalau password diganti,
 * sesi lama otomatis tidak berlaku lagi.
 */
export function isAdmin() {
  return sessionStorage.getItem(SESSION_KEY) === ADMIN_PASSWORD_HASH;
}

/**
 * Login admin. Mengembalikan true kalau password benar.
 */
export async function loginAdmin(password) {
  const hash = await sha256(password);
  if (hash !== ADMIN_PASSWORD_HASH) return false;

  sessionStorage.setItem(SESSION_KEY, hash);
  return true;
}

export function logoutAdmin() {
  sessionStorage.removeItem(SESSION_KEY);
}
