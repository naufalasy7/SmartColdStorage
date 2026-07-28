/**
 * ===================================================================
 * KONFIGURASI FIREBASE
 * ===================================================================
 * File ini bertugas menghubungkan service ke Firebase Realtime Database
 * menggunakan Firebase Admin SDK. Semua kredensial diambil dari
 * environment variable (.env), TIDAK ADA yang di-hardcode di sini.
 *
 * Jika koneksi gagal, service TIDAK BOLEH crash — cukup tampilkan
 * pesan error dan biarkan proses lain (misalnya health check server)
 * tetap berjalan.
 * ===================================================================
 */

import admin from "firebase-admin";
import dotenv from "dotenv";
import logger from "../utils/logger.js";

dotenv.config();

let db = null;

function initFirebase() {
  try {
    // Private key di .env disimpan dengan "\n" literal, jadi perlu
    // diubah dulu menjadi baris baru sungguhan sebelum dipakai.
    const privateKey = (process.env.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, "\n");

    if (!process.env.FIREBASE_PROJECT_ID || !process.env.FIREBASE_CLIENT_EMAIL || !privateKey) {
      throw new Error("Konfigurasi Firebase di .env belum lengkap.");
    }

    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: privateKey,
      }),
      databaseURL: process.env.FIREBASE_DATABASE_URL,
    });

    db = admin.database();
    logger.info("Berhasil terhubung ke Firebase Realtime Database.");
  } catch (err) {
    // PENTING: jangan lempar error ke atas sampai mematikan proses.
    // Cukup catat di log supaya developer tahu ada masalah koneksi.
    logger.error("Firebase Connection Failed");
    logger.error(err.message);
    db = null;
  }
}

// Panggil langsung saat file ini pertama kali di-import
initFirebase();

// Fungsi untuk mengambil instance database dari file lain
function getDb() {
  return db;
}

export { getDb };
