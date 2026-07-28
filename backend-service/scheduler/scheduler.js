/**
 * ===================================================================
 * SCHEDULER
 * ===================================================================
 * Menjadwalkan cleanupService untuk berjalan otomatis setiap hari
 * menggunakan library node-cron. Jadwal default: 00:05 setiap hari
 * (cron expression: "5 0 * * *"), tapi bisa diubah lewat .env
 * (variabel CRON_SCHEDULE) tanpa perlu mengubah kode ini.
 * ===================================================================
 */

import cron from "node-cron";
import { runCleanup } from "../services/cleanupService.js";
import logger from "../utils/logger.js";

function getCronSchedule() {
  // Default: setiap hari jam 00:05
  return process.env.CRON_SCHEDULE || "5 0 * * *";
}

function startScheduler() {
  const schedule = getCronSchedule();

  // Validasi dulu supaya kalau ada typo di .env, service tidak crash diam-diam
  if (!cron.validate(schedule)) {
    logger.error(`Cron schedule "${schedule}" tidak valid. Menggunakan default "5 0 * * *".`);
  }

  const finalSchedule = cron.validate(schedule) ? schedule : "5 0 * * *";

  cron.schedule(finalSchedule, () => {
    runCleanup();
  });

  logger.info(`Scheduler aktif. Cleanup akan berjalan otomatis sesuai jadwal: "${finalSchedule}"`);
}

export { startScheduler, getCronSchedule };
