/**
 * ===================================================================
 * SERVER.JS — TITIK MASUK UTAMA SERVICE
 * ===================================================================
 * Backend kecil ini BUKAN backend utama website. Ini hanya service
 * background yang bertugas membersihkan data history lama di Firebase
 * Realtime Database secara otomatis setiap hari.
 *
 * Fungsi:
 *   1. Menjalankan scheduler cleanup (node-cron)
 *   2. Menyediakan endpoint health check (Express) supaya gampang
 *      dipastikan service masih hidup, terutama kalau di-deploy ke
 *      VPS / Raspberry Pi / Mini PC.
 *
 * Service ini TIDAK bergantung pada Vercel, Cloud Functions, atau
 * Google Billing — murni Node.js biasa yang bisa dijalankan di mana saja.
 * ===================================================================
 */

import express from "express";
import dotenv from "dotenv";
import { startScheduler, getCronSchedule } from "./scheduler/scheduler.js";
import { getRetentionDays } from "./services/cleanupService.js";
import logger from "./utils/logger.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// ------------------------------------------------------------------
// Endpoint health check
// Berguna untuk memastikan service masih berjalan setelah dideploy
// ke server lain (VPS, Raspberry Pi, Mini PC, dsb).
// ------------------------------------------------------------------
app.get("/", (req, res) => {
  res.json({
    service: "Smart Cold Storage Cleanup Service",
    status: "running",
    retentionDays: getRetentionDays(),
    scheduler: `Jadwal cron: ${getCronSchedule()} (default 00:05 setiap hari)`,
  });
});

// ------------------------------------------------------------------
// Jalankan server + scheduler
// ------------------------------------------------------------------
app.listen(PORT, () => {
  logger.info(`Health check server berjalan di http://localhost:${PORT}`);
  startScheduler();
});
