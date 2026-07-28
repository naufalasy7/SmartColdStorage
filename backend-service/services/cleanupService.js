/**
 * ===================================================================
 * CLEANUP SERVICE
 * ===================================================================
 * Tugas utama file ini: menghapus data di node "history/{deviceId}"
 * yang timestamp-nya lebih tua dari RETENTION_DAYS (default 40 hari).
 *
 * Yang TIDAK PERNAH disentuh:
 *   - node "devices"   (data alat & pembacaan terakhir)
 *   - node "config"    (konfigurasi sistem)
 *
 * Struktur yang diproses:
 *   history
 *     └── DEVICE001
 *           └── -AutoID   -> { weight, temperature, humidity, timestamp }
 *
 * timestamp memakai format Unix Timestamp dalam DETIK (bukan milidetik).
 * ===================================================================
 */

import { getDb } from "../config/firebase.js";
import logger from "../utils/logger.js";

// Ambil jumlah hari retensi dari .env, default 40 hari jika tidak diisi
function getRetentionDays() {
  const days = Number(process.env.RETENTION_DAYS);
  return Number.isFinite(days) && days > 0 ? days : 40;
}

/**
 * Fungsi utama: dipanggil oleh scheduler setiap jam 00:05.
 * Melakukan loop ke semua device di node "history", lalu menghapus
 * setiap record yang sudah melewati batas retensi.
 */
async function runCleanup() {
  const db = getDb();

  // Kalau Firebase gagal terhubung, jangan sampai proses ini crash.
  // Cukup catat log dan hentikan cleanup kali ini saja.
  if (!db) {
    logger.error("Cleanup dibatalkan: koneksi Firebase tidak tersedia.");
    return;
  }

  logger.scheduler("Running cleanup...");

  const retentionDays = getRetentionDays();
  const nowInSeconds = Math.floor(Date.now() / 1000);
  const retentionSeconds = retentionDays * 24 * 60 * 60;
  const cutoffTimestamp = nowInSeconds - retentionSeconds;

  try {
    const historyRef = db.ref("history");
    const snapshot = await historyRef.once("value");

    // Kalau node "history" kosong / belum ada, tidak ada yang perlu dihapus
    if (!snapshot.exists()) {
      logger.scheduler("Node 'history' kosong, tidak ada yang dibersihkan.");
      logger.scheduler("Cleanup Finished");
      return;
    }

    const allDevices = snapshot.val();
    const deviceIds = Object.keys(allDevices);

    // Loop setiap device satu per satu
    for (const deviceId of deviceIds) {
      try {
        const deletedCount = await cleanupDeviceHistory(historyRef, deviceId, allDevices[deviceId], cutoffTimestamp);
        logger.scheduler(`${deviceId}`);
        logger.scheduler(`Deleted : ${deletedCount} records`);
      } catch (deviceErr) {
        // Kalau satu device gagal diproses, jangan hentikan semuanya.
        // Cukup catat error, lalu lanjut ke device berikutnya.
        logger.error(`Gagal memproses device ${deviceId}: ${deviceErr.message}`);
        continue;
      }
    }

    logger.scheduler("Cleanup Finished");
  } catch (err) {
    logger.error(`Cleanup gagal dijalankan: ${err.message}`);
  }
}

/**
 * Membersihkan history milik satu device saja.
 * Mengembalikan jumlah record yang berhasil dihapus.
 */
async function cleanupDeviceHistory(historyRef, deviceId, records, cutoffTimestamp) {
  if (!records || typeof records !== "object") return 0;

  let deletedCount = 0;
  const recordIds = Object.keys(records);

  for (const recordId of recordIds) {
    const record = records[recordId];
    const recordTimestamp = Number(record?.timestamp);

    // Kalau timestamp tidak valid, lewati saja (jangan hapus data yang tidak jelas)
    if (!Number.isFinite(recordTimestamp)) continue;

    if (recordTimestamp < cutoffTimestamp) {
      // Hapus hanya record ini, node "devices" & "config" tidak tersentuh sama sekali
      await historyRef.child(deviceId).child(recordId).remove();
      deletedCount++;
    }
  }

  return deletedCount;
}

export { runCleanup, getRetentionDays };
