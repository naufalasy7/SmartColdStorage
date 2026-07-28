/* ================= KONFIGURASI FIREBASE =================
   Ganti FIREBASE_ENDPOINT jika beda proyek (tanpa trailing slash;
   "/.json" ditambahkan otomatis di bawah).
   Skema data yang diharapkan di Realtime Database — BEBAS, sensor
   apa saja bisa dikirim, dial di halaman akan menyesuaikan sendiri:
   {
     "PLT-0221": { "berat": 428, "suhu": 27.4, "lembap": 58 },
     "PLT-0222": { "berat": 512 }
   }
=========================================================== */
const FIREBASE_ENDPOINT = "https://smartcoldstorage-69780-default-rtdb.asia-southeast1.firebasedatabase.app";
const POLL_MS = 5000;
const STORAGE_KEY = 'panelAlatDevices_v1';

/* ---------------- Rentang & label sensor YANG SUDAH DIKENAL ----------------
   Sensor utama pallet: berat (load cell), suhu, dan kelembapan.
   Sensuor lain yang tidak ada di sini tetap otomatis dibuat dialnya
   lewat rangeFor()/labelFor(), hanya tanpa ambang warn/crit resmi. */
const RANGES = {
  berat:   { min:0,  max:1000, warnAbove:800, critAbove:950 },
  suhu:    { min:15, max:40,   warnAbove:29,  critAbove:33 },
  lembap:  { min:0,  max:100,  warnAbove:80,  critAbove:90 },
  battery: { min:0,  max:100,  warnBelow:30,  critBelow:15 },
};
const LABELS = { berat:'Berat (Load Cell)', suhu:'Suhu', lembap:'Kelembapan', battery:'Baterai' };
const UNITS  = { berat:'kg', suhu:'°C', lembap:'%', battery:'%' };

/* ikon kecil per jenis sensor — dipakai di label dial */
const SENSOR_ICONS = {
  berat:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v18"/><path d="M5 7h14"/><path d="M5 7 2.5 13a2.5 2.5 0 0 0 5 0Z"/><path d="M19 7l-2.5 6a2.5 2.5 0 0 0 5 0Z"/></svg>',
  suhu:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 14V4.5a1.5 1.5 0 0 0-3 0V14a3.5 3.5 0 1 0 3 0Z"/></svg>',
  lembap: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3s6 6.5 6 10.5a6 6 0 0 1-12 0C6 9.5 12 3 12 3Z"/></svg>',
  battery:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="18" height="10" rx="2"/><path d="M22 10v4"/></svg>',
};

function rangeFor(key, value){
  if (RANGES[key]) return RANGES[key];
  const v = Number(value) || 0;
  const pad = Math.max(Math.abs(v) * 0.5, 10);
  return { min:0, max: Math.max(100, v + pad) };
}
function labelFor(key){
  if (LABELS[key]) return LABELS[key];
  return key.replace(/_/g,' ').replace(/\b\w/g, c => c.toUpperCase());
}
function fmtFor(key, value){
  const unit = UNITS[key] || '';
  const num = Number.isInteger(value) ? value : Number(value).toFixed(1);
  return unit ? `${num} ${unit}` : `${num}`;
}

/* ================= REGISTRI ALAT (hasil "pairing") ================= */
const SEED_DEVICES = [];
function loadDevices(){
  try{
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (Array.isArray(saved) && saved.length) return saved;
  }catch(e){}
  return SEED_DEVICES.slice();
}
function saveDevices(){ try{ localStorage.setItem(STORAGE_KEY, JSON.stringify(DEVICES)); }catch(e){} }
let DEVICES = loadDevices();

let liveData = null;
let firebaseReachable = null;

function pad(n){ return String(n).padStart(2,'0'); }
function nowStr(){ const d=new Date(); return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`; }

function statusOf(key, value){
  const r = rangeFor(key, value);
  if (value == null || Number.isNaN(value)) return 'crit';
  if (r.critAbove != null && value > r.critAbove) return 'crit';
  if (r.critBelow != null && value < r.critBelow) return 'crit';
  if (r.warnAbove != null && value > r.warnAbove) return 'warn';
  if (r.warnBelow != null && value < r.warnBelow) return 'warn';
  return 'on';
}
function percentOf(key, value){
  const r = rangeFor(key, value);
  const p = (value - r.min) / (r.max - r.min) * 100;
  return Math.max(0, Math.min(100, p));
}

const STATUS_LABEL = { on:'Berfungsi', warn:'Perlu Diperiksa', crit:'Bermasalah', off:'Menunggu' };
const STATUS_COLOR = { on:'var(--accent)', warn:'var(--amber)', crit:'var(--red)' };
function worst(levels){
  if (levels.includes('crit')) return 'crit';
  if (levels.includes('warn')) return 'warn';
  return 'on';
}

function paintGauge(cardEl, key, value, unitFmt){
  const svg = cardEl.querySelector(`[data-role="gauge-${key}"]`);
  if (!svg) return 'on';
  const arc = svg.querySelector('[data-role="arc"]');
  const pct = percentOf(key, value);
  const lvl = statusOf(key, value);
  arc.setAttribute('stroke-dasharray', `${pct} 100`);
  arc.style.stroke = STATUS_COLOR[lvl];
  cardEl.querySelector(`[data-role="v-${key}"]`).textContent = unitFmt(value);
  return lvl;
}

/* ---------------- Dial SVG flat (semicircle, tanpa bevel/glow) ---------------- */
function tickPercents(key){
  const r = rangeFor(key);
  const arr = [];
  if (r.warnAbove != null) arr.push({ p: percentOf(key, r.warnAbove), color:'var(--amber)' });
  if (r.critAbove != null) arr.push({ p: percentOf(key, r.critAbove), color:'var(--red)' });
  if (r.warnBelow != null) arr.push({ p: percentOf(key, r.warnBelow), color:'var(--amber)' });
  if (r.critBelow != null) arr.push({ p: percentOf(key, r.critBelow), color:'var(--red)' });
  return arr;
}
function tickLine(p){
  const cx=100, cy=108, rOuter=94, rInner=82;
  const theta = (180 - (p/100*180)) * Math.PI/180;
  const x1 = cx + rInner*Math.cos(theta), y1 = cy - rInner*Math.sin(theta);
  const x2 = cx + rOuter*Math.cos(theta), y2 = cy - rOuter*Math.sin(theta);
  return {x1,y1,x2,y2};
}
function gaugeSVG(key){
  const ticks = tickPercents(key).map(t=>{
    const {x1,y1,x2,y2} = tickLine(t.p);
    return `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${t.color}" stroke-width="2" stroke-linecap="round"/>`;
  }).join('');
  return `
    <svg class="dial" viewBox="0 0 200 118" data-role="gauge-${key}">
      <path d="M14,108 A86,86 0 0,1 186,108" fill="none" stroke="var(--border)" stroke-width="11" stroke-linecap="round" pathLength="100"/>
      ${ticks}
      <path d="M14,108 A86,86 0 0,1 186,108" fill="none" stroke-width="11" stroke-linecap="round" pathLength="100" data-role="arc" style="stroke:var(--accent);"/>
    </svg>`;
}
function iconFor(key){ return SENSOR_ICONS[key] || ''; }

/* ---------------- Bangun kartu pallet dari DEVICES ---------------- */
const PALLET_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7.5 12 3l9 4.5-9 4.5-9-4.5Z"/><path d="M3 7.5v9L12 21l9-4.5v-9"/><path d="M12 12v9"/></svg>';

function buildDeviceCards(){
  const grid = document.getElementById('deviceGrid');
  if (DEVICES.length === 0){
    grid.innerHTML = `
      <div class="no-devices">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12h4l2 3h6l2-3h4"/><path d="M5.5 5h13L21 12v6a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-6L5.5 5Z"/></svg>
        <h4>Belum ada pallet yang dipasang</h4>
        <p>Tidak ada data yang ditampilkan sampai kamu memasang satu pallet.</p>
        <button class="btn btn-primary" onclick="openPairModal()">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M9 15 15 9"/><path d="M8 17H6a4 4 0 0 1 0-8h2"/><path d="M16 7h2a4 4 0 0 1 0 8h-2"/></svg>
          Pasang Alat Baru
        </button>
      </div>`;
    return;
  }
  const seedKeys = SEED_DEVICES.map(d=>d.key);
  grid.innerHTML = DEVICES.map(dev=>{
    const removable = !seedKeys.includes(dev.key);
    return `
    <div class="device-card" data-device="${dev.key}" data-sensor-keys="">
      <div class="device-top">
        <div class="device-id-block">
          <div class="device-badge" data-role="badge">${PALLET_ICON}</div>
          <div style="min-width:0;">
            <h3>${dev.name}</h3>
            <span class="node-id" data-role="node-id">${dev.nodeId} · menunggu sensor…</span>
          </div>
        </div>
        <div style="display:flex; align-items:center; gap:8px; flex-shrink:0;">
          <span class="status-pill off" data-role="pill"><span class="dot"></span><span data-role="pill-text">Menunggu</span></span>
          ${removable ? `<button class="unpair-btn" title="Lepas pasangan alat ini" onclick="unpairDevice('${dev.key}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg></button>` : ''}
        </div>
      </div>
      <div class="gauge-row" data-role="gauge-row">
        <div class="empty-state" data-role="empty-state">Belum ada data sensor dari pallet ini — menunggu kiriman pertama dari Firebase.</div>
      </div>
      <div class="device-foot"><span data-role="src">Sumber: —</span><span data-role="time">—</span></div>
    </div>`;
  }).join('');
}

function unpairDevice(key){
  DEVICES = DEVICES.filter(d=>d.key!==key);
  saveDevices();
  buildDeviceCards();
  render();
}

function openPairModal(){ document.getElementById('pairModal').classList.add('show'); document.getElementById('pairName').focus(); }
function closePairModal(){ document.getElementById('pairModal').classList.remove('show'); }
function submitPairing(){
  const name = document.getElementById('pairName').value.trim();
  const key = document.getElementById('pairKey').value.trim();
  const token = document.getElementById('pairToken').value.trim();
  if (!name || !key){ showToast('Nama pallet & Device Key wajib diisi'); return; }
  if (DEVICES.some(d => d.key === key)){ showToast('Device Key itu sudah dipakai pallet lain'); return; }
  DEVICES.push({ key, name, nodeId: token || key.toUpperCase() });
  saveDevices();
  buildDeviceCards();
  closePairModal();
  ['pairName','pairKey','pairToken'].forEach(id => document.getElementById(id).value = '');
  showToast(`"${name}" dipasang — menunggu data dari Firebase (key: ${key})`);
  cycle();
}

function paintPill(cardEl, level){
  const pill = cardEl.querySelector('[data-role="pill"]');
  const badge = cardEl.querySelector('[data-role="badge"]');
  pill.className = `status-pill ${level}`;
  pill.innerHTML = `<span class="dot"></span><span data-role="pill-text">${STATUS_LABEL[level]}</span>`;
  badge.className = `device-badge ${level === 'crit' ? 'crit' : level === 'warn' ? 'warn' : ''}`;
}

function render(){
  const t = nowStr();
  const deviceLevels = [];

  DEVICES.forEach(dev=>{
    const card = document.querySelector(`[data-device="${dev.key}"]`);
    if (!card) return;
    const liveDev = liveData && liveData[dev.key] ? liveData[dev.key] : null;
    const dataObj = liveDev || null;

    if (!dataObj){
      card.querySelectorAll('.gauge-cell').forEach(el => el.remove());
      const row = card.querySelector('[data-role="gauge-row"]');
      if (!row.querySelector('[data-role="empty-state"]')){
        row.innerHTML = '<div class="empty-state" data-role="empty-state">Belum ada data sensor dari pallet ini — menunggu kiriman pertama dari Firebase.</div>';
      }
      card.dataset.sensorKeys = '';
      const pill = card.querySelector('[data-role="pill"]');
      pill.className = 'status-pill off';
      pill.innerHTML = '<span class="dot"></span><span data-role="pill-text">Menunggu</span>';
      card.querySelector('[data-role="badge"]').className = 'device-badge off';
      card.querySelector('[data-role="src"]').textContent = 'Sumber: —';
      card.querySelector('[data-role="time"]').textContent = t;
      deviceLevels.push('off');
      return;
    }

    const sensorKeys = Object.keys(dataObj).sort();
    const cachedKeys = card.dataset.sensorKeys || '';
    if (cachedKeys !== sensorKeys.join(',')){
      const row = card.querySelector('[data-role="gauge-row"]');
      const single = sensorKeys.length === 1;
      row.innerHTML = sensorKeys.map(k => `
        <div class="gauge-cell"${single ? ' style="max-width:220px;margin:0 auto;"' : ''}>
          ${gaugeSVG(k)}
          <div class="gauge-val" data-role="v-${k}">—</div>
          <div class="gauge-label">${iconFor(k)}${labelFor(k)}</div>
        </div>`).join('');
      card.dataset.sensorKeys = sensorKeys.join(',');
      card.querySelector('[data-role="node-id"]').textContent = `${dev.nodeId} · ${sensorKeys.map(labelFor).join(' + ')}`;
    }

    const levels = sensorKeys.map(k => paintGauge(card, k, dataObj[k], v => fmtFor(k, v)));
    const level = worst(levels);
    deviceLevels.push(level);
    paintPill(card, level);
    card.querySelector('[data-role="src"]').textContent = 'Sumber: Firebase Live';
    card.querySelector('[data-role="time"]').textContent = t;
  });

  document.getElementById('sumTotal').textContent = DEVICES.length;
  document.getElementById('sumOnline').textContent = deviceLevels.filter(l => l === 'on').length;
  document.getElementById('sumWarn').textContent = deviceLevels.filter(l => l === 'warn' || l === 'crit').length;
  document.getElementById('sumTime').textContent = t;

  renderHeroVitals();
  updateConnBadge();
}

/* Panel "Pembacaan Live" di hero — WAJIB ambil dari data Firebase asli,
   bukan angka contoh. Pilih pallet pertama yang datanya sudah masuk;
   kalau belum ada satupun, tampilkan status menunggu apa adanya. */
function renderHeroVitals(){
  const label = document.getElementById('heroVpLabel');
  const idEl = document.getElementById('heroVpId');
  const body = document.getElementById('heroVpBody');
  const valueEl = document.getElementById('heroVpValue');
  const barEl = document.getElementById('heroVpBar');
  const scaleEl = document.getElementById('heroVpScale');
  const chipsEl = document.getElementById('heroVpChips');

  const activeDev = DEVICES.find(d => liveData && liveData[d.key]);

  if (!activeDev){
    label.textContent = 'Pembacaan Live';
    idEl.textContent = '—';
    valueEl.innerHTML = '— <span></span>';
    barEl.style.width = '0%';
    scaleEl.textContent = DEVICES.length ? 'Menunggu kiriman pertama dari Firebase…' : 'Pasang pallet dulu untuk melihat data live';
    chipsEl.innerHTML = '';
    return;
  }

  const data = liveData[activeDev.key];
  const keys = Object.keys(data).sort();
  const primaryKey = keys.includes('berat') ? 'berat' : keys[0];
  const primaryVal = Number(data[primaryKey]);
  const r = rangeFor(primaryKey, primaryVal);
  const pct = percentOf(primaryKey, primaryVal);

  label.textContent = 'Pembacaan Live';
  idEl.textContent = activeDev.nodeId || activeDev.key;
  valueEl.innerHTML = `${Number.isInteger(primaryVal) ? primaryVal : primaryVal.toFixed(1)} <span>${UNITS[primaryKey] ? '/ ' + r.max + ' ' + UNITS[primaryKey] : ''}</span>`;
  barEl.style.width = `${pct}%`;
  scaleEl.textContent = `Kapasitas ${r.max}${UNITS[primaryKey] ? ' ' + UNITS[primaryKey] : ''}`;

  const otherKeys = keys.filter(k => k !== primaryKey);
  chipsEl.innerHTML = otherKeys.map(k => `
    <div class="vp-chip">${iconFor(k)}${fmtFor(k, Number(data[k]))}</div>
  `).join('');
}

function updateConnBadge(){
  const el = document.getElementById('connBadge');
  const txt = document.getElementById('connText');
  if (firebaseReachable === null){
    el.className = 'conn-badge warn';
    txt.textContent = 'Menyambungkan ke Firebase…';
  } else if (firebaseReachable && liveData){
    el.className = 'conn-badge';
    txt.textContent = 'Live · Data Sensor Masuk';
  } else if (firebaseReachable && !liveData){
    el.className = 'conn-badge warn';
    txt.textContent = 'Tersambung · Menunggu Data';
  } else {
    el.className = 'conn-badge off';
    txt.textContent = 'Firebase Offline';
  }
}

function showToast(msg){
  const toast = document.getElementById('toast');
  document.getElementById('toastMsg').textContent = msg;
  toast.classList.add('show');
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => toast.classList.remove('show'), 4000);
}

async function pollFirebase(){
  try{
    const res = await fetch(`${FIREBASE_ENDPOINT}/.json`, { cache:'no-store' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    firebaseReachable = true;
    liveData = (data && DEVICES.some(dev => data[dev.key])) ? data : null;
  } catch (err){
    firebaseReachable = false;
    liveData = null;
    showToast('Firebase Offline');
  }
}

async function cycle(){
  await pollFirebase();
  render();
}

function manualRefresh(){ cycle(); }

buildDeviceCards();
cycle();
setInterval(cycle, POLL_MS);
