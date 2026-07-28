# Smart Cold Storage Rack Monitoring

Project ini berisi 2 bagian:

```
smart-cold-storage/
├── run.sh                 # jalankan frontend + backend sekaligus
├── frontend/               # panel monitoring (HTML + CSS + JS terpisah)
│   ├── index.html
│   ├── css/style.css
│   └── js/script.js
└── backend-service/        # service cleanup otomatis (Node.js)
    ├── package.json
    ├── .env
    ├── README.md
    ├── config/firebase.js
    ├── services/cleanupService.js
    ├── scheduler/scheduler.js
    ├── utils/logger.js
    └── server.js
```

## Cara Cepat Menjalankan Semuanya

1. Isi kredensial Firebase asli di `backend-service/.env`
   (lihat `backend-service/README.md` untuk detail lengkap).
2. Jalankan:

```bash
chmod +x run.sh
./run.sh
```

Script ini akan otomatis:
- `npm install` di `backend-service` (kalau belum pernah)
- Menjalankan backend (health check di `http://localhost:3000`, scheduler
  cleanup jam 00:05 tiap hari)
- Menjalankan frontend sebagai static server di `http://localhost:8080`

Tekan `CTRL + C` untuk menghentikan kedua service sekaligus.

## Detail Masing-Masing Bagian

- Untuk detail lengkap backend (cara kerja cleanup, cara ubah jadwal cron,
  cara ubah retention days, error handling), baca `backend-service/README.md`.
- Frontend adalah file statis biasa — bisa juga langsung dibuka lewat
  `frontend/index.html` di browser tanpa server, tapi disarankan lewat
  static server (seperti yang dilakukan `run.sh`) supaya path CSS/JS
  relatif berjalan konsisten.
