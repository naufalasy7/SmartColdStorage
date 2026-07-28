#!/bin/bash
# ===================================================================
# RUN.SH — Menjalankan Frontend (static) + Backend Cleanup Service
# sekaligus dengan satu perintah.
#
# Cara pakai:
#   chmod +x run.sh
#   ./run.sh
#
# Untuk menghentikan semua proses: tekan CTRL + C
# ===================================================================

set -e

FRONTEND_DIR="frontend"
BACKEND_DIR="backend-service"
FRONTEND_PORT=8080

# Warna untuk mempercantik output terminal (opsional, aman kalau tidak didukung)
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}=== Smart Cold Storage — Launcher ===${NC}"

# -------------------------------------------------------------
# 1. Cek Node.js tersedia
# -------------------------------------------------------------
if ! command -v node &> /dev/null; then
  echo -e "${RED}Node.js tidak ditemukan. Install dulu Node.js sebelum menjalankan script ini.${NC}"
  exit 1
fi

# -------------------------------------------------------------
# 2. Install dependency backend (kalau belum ada node_modules)
# -------------------------------------------------------------
echo -e "${YELLOW}[1/3] Menyiapkan backend service...${NC}"
cd "$BACKEND_DIR"

if [ ! -d "node_modules" ]; then
  echo "node_modules belum ada, menjalankan npm install..."
  npm install
else
  echo "node_modules sudah ada, lewati npm install."
fi

if [ ! -f ".env" ]; then
  echo -e "${RED}File .env tidak ditemukan di $BACKEND_DIR. Backend butuh .env untuk konek ke Firebase.${NC}"
  exit 1
fi

# -------------------------------------------------------------
# 3. Jalankan backend service (background)
# -------------------------------------------------------------
echo -e "${YELLOW}[2/3] Menjalankan backend service (health check + scheduler cleanup)...${NC}"
npm start > ../backend.log 2>&1 &
BACKEND_PID=$!
cd ..

sleep 2
echo "Backend service berjalan (PID: $BACKEND_PID). Log: backend.log"

# -------------------------------------------------------------
# 4. Serve frontend sebagai file statis
# -------------------------------------------------------------
echo -e "${YELLOW}[3/3] Menjalankan frontend (static server)...${NC}"
cd "$FRONTEND_DIR"

if command -v python3 &> /dev/null; then
  python3 -m http.server "$FRONTEND_PORT" > ../frontend.log 2>&1 &
  FRONTEND_PID=$!
elif command -v npx &> /dev/null; then
  npx --yes serve -l "$FRONTEND_PORT" > ../frontend.log 2>&1 &
  FRONTEND_PID=$!
else
  echo -e "${RED}Tidak ditemukan python3 maupun npx untuk menjalankan static server.${NC}"
  echo "Backend tetap berjalan, tapi buka frontend/index.html manual di browser."
  FRONTEND_PID=""
fi
cd ..

sleep 1

# -------------------------------------------------------------
# 5. Ringkasan
# -------------------------------------------------------------
echo ""
echo -e "${GREEN}=== Semua service berjalan ===${NC}"
echo "Frontend  : http://localhost:$FRONTEND_PORT"
echo "Backend   : http://localhost:3000  (health check)"
echo "Log backend  : backend.log"
echo "Log frontend : frontend.log"
echo ""
echo "Tekan CTRL + C untuk menghentikan semua service."

# -------------------------------------------------------------
# 6. Cleanup saat script dihentikan (CTRL+C)
# -------------------------------------------------------------
cleanup() {
  echo ""
  echo -e "${YELLOW}Menghentikan service...${NC}"
  kill "$BACKEND_PID" 2>/dev/null || true
  [ -n "$FRONTEND_PID" ] && kill "$FRONTEND_PID" 2>/dev/null || true
  echo "Semua service dihentikan."
  exit 0
}
trap cleanup INT TERM

# Tunggu selamanya sampai user tekan CTRL+C
wait
