# Smart Cold Storage — Cleanup Service

Backend kecil (bukan backend utama website) yang berjalan di background untuk
membersihkan data `history` lama di Firebase Realtime Database secara otomatis
setiap hari.

## Fungsi Utama

1. Terhubung ke Firebase Realtime Database (via Firebase Admin SDK).
2. Setiap hari jam **00:05**, otomatis menjalankan cleanup.
3. Menghapus record di `history/{deviceId}` yang `timestamp`-nya lebih tua
   dari **40 hari** (bisa diubah).
4. **Tidak pernah** menyentuh node `devices` maupun `config`.
5. Menyediakan endpoint health check `GET /` supaya mudah dicek apakah
   service masih hidup.

Backend ini dirancang untuk dijalankan di **VPS, Raspberry Pi, Mini PC, atau
server lokal** — tidak bergantung pada Vercel, Cloud Functions, maupun Google
Billing.

## Struktur Project

```
backend-service/
├── package.json
├── .env
├── README.md
├── config/
│   └── firebase.js        # koneksi ke Firebase Admin SDK
├── services/
│   └── cleanupService.js  # logika utama cleanup data history
├── scheduler/
│   └── scheduler.js       # penjadwalan cron (node-cron)
├── utils/
│   └── logger.js          # logging sederhana
└── server.js              # entry point + endpoint health check
```

## Cara Install

```bash
npm install
```

## Cara Menjalankan

```bash
npm start
```

Setelah berjalan, cek apakah service hidup lewat browser atau curl:

```bash
curl http://localhost:3000/
```

Contoh respon:

```json
{
  "service": "Smart Cold Storage Cleanup Service",
  "status": "running",
  "retentionDays": 40,
  "scheduler": "Jadwal cron: 5 0 * * * (default 00:05 setiap hari)"
}
```

## Konfigurasi (.env)

Semua konfigurasi Firebase **wajib** diisi lewat file `.env` — tidak ada yang
di-hardcode di kode.

```env
FIREBASE_PROJECT_ID=...
FIREBASE_CLIENT_EMAIL=...
FIREBASE_PRIVATE_KEY="..."
FIREBASE_DATABASE_URL=...

RETENTION_DAYS=40
CRON_SCHEDULE="5 0 * * *"
PORT=3000
```

Kredensial di atas didapat dari:
**Firebase Console → Project Settings → Service Accounts → Generate New
Private Key**. File JSON yang di-download berisi `project_id`,
`client_email`, dan `private_key` yang tinggal disalin ke `.env`.

> ⚠️ Jangan pernah commit file `.env` ke Git karena berisi kredensial rahasia.

### Cara Mengubah Jadwal Cleanup

Ubah nilai `CRON_SCHEDULE` di `.env`. Format menggunakan standar cron:

```
menit jam tanggal bulan hari
```

Contoh: jalankan setiap hari jam 01:30:

```env
CRON_SCHEDULE="30 1 * * *"
```

### Cara Mengubah Jumlah Hari Retensi

Ubah nilai `RETENTION_DAYS` di `.env`. Misalnya untuk menyimpan data 60 hari:

```env
RETENTION_DAYS=60
```

Tidak perlu mengubah kode apapun — cukup ubah `.env` lalu restart service
(`npm start`).

## Cara Kerja Cleanup

1. Ambil semua data di node `history` dari Firebase.
2. Loop setiap `deviceId` (mis. `DEVICE001`, `DEVICE002`, dst).
3. Untuk setiap device, loop semua record history-nya.
4. Jika `timestamp` record < (waktu sekarang − `RETENTION_DAYS` hari), record
   tersebut dihapus.
5. Node `devices` dan `config` tidak pernah disentuh oleh proses ini.

Contoh log saat cleanup berjalan:

```
[Scheduler] Running cleanup...
[Scheduler] DEVICE001
[Scheduler] Deleted : 28 records
[Scheduler] DEVICE002
[Scheduler] Deleted : 14 records
[Scheduler] Cleanup Finished
```

## Penanganan Error

- Jika Firebase gagal terhubung saat startup → service **tidak crash**,
  cukup menampilkan log `Firebase Connection Failed` dan cleanup akan
  dilewati sampai koneksi tersedia lagi.
- Jika satu device gagal diproses saat cleanup → device tersebut dilewati,
  proses lanjut ke device berikutnya tanpa menghentikan seluruh cleanup.

## Teknologi

- Node.js (ES Modules, async/await)
- `firebase-admin` — koneksi ke Firebase Realtime Database
- `node-cron` — penjadwalan tugas harian
- `dotenv` — membaca konfigurasi dari `.env`
- `express` — endpoint health check ringan
