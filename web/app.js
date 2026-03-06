
// iOS detection (includes iPadOS Safari)
function isIOS(){
  const ua = navigator.userAgent;
  const iOS = /iPhone|iPad|iPod/.test(ua);
  const iPadOS = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
  return iOS || iPadOS;
}

const iosOnlyBanner = document.getElementById('ios-only');
if(!isIOS()){
  iosOnlyBanner.classList.remove('hidden');
}

// ---- Currency helpers ----
function eur(x){
  return (x < 0 ? '-€ ' : '€ ') + Math.abs(x).toFixed(2).replace('.', ',');
}

function saldo(c){
  const daPagare = c.totale - c.pagato - c.acconti;
  // saldo negativo quando il cliente ti deve soldi
  return daPagare > 0 ? -Math.abs(daPagare) : (Math.abs(daPagare) < 1e-9 ? 0 : daPagare);
}

// ---- IndexedDB ----
const DB_NAME = 'ricariche-db';
const STORE = 'clients';
let db;

function openDB(){
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = (e) => {
      db = e.target.result;
      const store = db.createObjectStore(STORE, { keyPath: 'id' });
      // Seed iniziale
      const sample = [
        { id: 1, name: 'Mario Rossi', totale: 50, pagato: 0, acconti: 20 },
        { id: 2, name: 'Lucia Esposito', totale: 120, pagato: 100, acconti: 0 },
        { id: 3, name: 'Bar Napoli', totale: 200, pagato: 150, acconti: 0 },
        { id: 4, name: 'Studio Verdi', totale: 70, pagato: 70, acconti: 0 }
      ];
      sample.forEach(x => store.add(x));
    };
    req.onsuccess = (e) => { db = e.target.result; resolve(db); };
    req.onerror = (e) => reject(e.target.error);
  });
}

function tx(mode='readonly'){
  return db.transaction(STORE, mode).objectStore(STORE);
}

function getAll(){
  return new Promise((resolve, reject) => {
    const req = tx('readonly').getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = (e) => reject(e.target.error);
  });
}

function put(item){
  return new Promise((resolve, reject) => {
    const req = tx('readwrite').put(item);
    req.onsuccess = () => resolve();
    req.onerror = (e) => reject(e.target.error);
  });
}

function clearAll(){
  return new Promise((resolve, reject) => {
    const req = tx('readwrite').clear();
    req.onsuccess = () => resolve();
    req.onerror = (e) => reject(e.target.error);
  });
}

// ---- UI rendering ----
const tbody = document.querySelector('#clients-table tbody');
const modal = document.getElementById('modal');
const modalTitle = document.getElementById('modal-title');
const amountInput = document.getElementById('amount');
const cancelBtn = document.getElementById('cancel');
const confirmBtn = document.getElementById('confirm');
const fileInput = document.getElementById('file-input');
const btnImporta = document.getElementById('btn-importa');
const btnEsporta = document.getElementById('btn-esporta');
const btnStampa = document.getElementById('btn-stampa');

let pendingAction = null; // { type: 'acconto'|'ricarica', id }

function render(clients){
  tbody.innerHTML = '';
  clients.sort((a,b) => a.name.localeCompare(b.name));
  clients.forEach(c => {
    const tr = document.createElement('tr');

    const tdName = document.createElement('td');
    tdName.textContent = c.name; tr.appendChild(tdName);

    const tdTot = document.createElement('td');
    tdTot.textContent = eur(c.totale); tr.appendChild(tdTot);

    const tdPag = document.createElement('td');
    tdPag.textContent = eur(c.pagato); tr.appendChild(tdPag);

    const tdAcc = document.createElement('td');
    tdAcc.textContent = eur(c.acconti); tr.appendChild(tdAcc);

    const tdSaldo = document.createElement('td');
    const s = saldo(c);
    tdSaldo.textContent = eur(s);
    tdSaldo.className = s < 0 ? 'bad' : 'good';
    tr.appendChild(tdSaldo);

    const tdActions = document.createElement('td');
    tdActions.className = 'actions-cell';
    const b1 = document.createElement('button'); b1.textContent = 'Acconto'; b1.onclick = () => openModal('acconto', c.id);
    const b2 = document.createElement('button'); b2.textContent = 'Ricarica'; b2.onclick = () => openModal('ricarica', c.id);
    tdActions.appendChild(b1); tdActions.appendChild(b2);
    tr.appendChild(tdActions);

    tbody.appendChild(tr);
  });
}

function openModal(type, id){
  pendingAction = { type, id };
  modalTitle.textContent = type === 'acconto' ? 'Inserisci Acconto' : 'Aumenta Totale Ricariche';
  amountInput.value = '';
  modal.classList.remove('hidden');
  amountInput.focus();
}
function closeModal(){ modal.classList.add('hidden'); pendingAction = null; }

cancelBtn.addEventListener('click', closeModal);
confirmBtn.addEventListener('click', async () => {
  const val = parseFloat(amountInput.value || '0');
  if(!pendingAction || isNaN(val) || val <= 0){ closeModal(); return; }
  const clients = await getAll();
  const idx = clients.findIndex(x => x.id === pendingAction.id);
  if(idx !== -1){
    if(pendingAction.type === 'acconto') clients[idx].acconti += val; else clients[idx].totale += val;
    await put(clients[idx]);
    render(await getAll());
  }
  closeModal();
});

// Import / Export / Print
btnEsporta.addEventListener('click', async () => {
  const data = await getAll();
  const blob = new Blob([JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), data }, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `ricariche-backup-${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
});

btnImporta.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', async (e) => {
  const file = e.target.files && e.target.files[0];
  if(!file) return;
  const text = await file.text();
  try{
    const obj = JSON.parse(text);
    if(!obj || !Array.isArray(obj.data)) throw new Error('Formato non valido');
    await clearAll();
    for(const item of obj.data){
      if(typeof item.id !== 'number') continue;
      await put({
        id: item.id,
        name: String(item.name || ''),
        totale: Number(item.totale || 0),
        pagato: Number(item.pagato || 0),
        acconti: Number(item.acconti || 0)
      });
    }
    render(await getAll());
  }catch(err){
    alert('File non valido: ' + err.message);
  } finally {
    e.target.value = '';
  }
});

btnStampa.addEventListener('click', () => window.print());

// Init
openDB().then(getAll).then(render);
