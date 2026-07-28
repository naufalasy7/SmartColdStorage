/**
 * ===================================================================
 * LOGGER SEDERHANA
 * ===================================================================
 * Modul kecil untuk mencetak log ke console dengan format yang rapi
 * dan konsisten, lengkap dengan timestamp. Dibuat sesederhana mungkin
 * supaya mudah dipahami oleh siapa saja yang membaca kode ini.
 * ===================================================================
 */

// Ambil waktu sekarang dalam format yang mudah dibaca, mis: 2026-07-28 00:05:01
function timestamp() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const time = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
  return `${date} ${time}`;
}

// Log informasi umum, contoh: proses berjalan, status normal, dsb.
function info(message) {
  console.log(`[${timestamp()}] [INFO] ${message}`);
}

// Log khusus untuk kegiatan scheduler/cleanup, supaya gampang dibedakan di terminal
function scheduler(message) {
  console.log(`[${timestamp()}] [Scheduler] ${message}`);
}

// Log untuk error / kegagalan, tapi TIDAK menghentikan proses (service tetap hidup)
function error(message) {
  console.error(`[${timestamp()}] [ERROR] ${message}`);
}

// Export semua fungsi logger supaya bisa dipakai di file lain
export default { info, scheduler, error };
