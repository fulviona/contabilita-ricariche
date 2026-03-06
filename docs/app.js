
// ---- iOS detection ----
function isIOS(){
  const ua = navigator.userAgent;
  const iOS = /iPhone|iPad|iPod/.test(ua);
  const iPadOS = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
  return iOS || iPadOS;
}

// ---- Theme handling ----
const htmlEl = document.documentElement; // uses data-theme: 'auto' | 'light' | 'dark'
function applyTheme(){
  const pref = localStorage.getItem('theme') || 'auto';
  htmlEl.setAttribute('data-theme', pref === 'auto' ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : pref);
}
applyTheme();
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);

// ---- IndexedDB ----
const DB_NAME = 'ricariche-db';
const STORE = 'clients';
let db;

function openDB(){
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 2);
    req.onupgradeneeded = (e) => {
      db = e.target.result;
      if(!db.objectStoreNames.contains(STORE)){
        const store = db.createObjectStore(STORE, { keyPath: 'id' });
        const sample = [
          { id: 1, name: 'Mario Rossi', totale: 50, pagato: 0, acconti: 20 },
          { id: 2, name: 'Lucia Esposito', totale: 120, pagato: 100, acconti: 0 },
          { id: 3, name: 'Bar Napoli', totale: 200, pagato: 150, acconti: 0 },
          { id: 4, name: 'Studio Verdi', totale: 70, pagato: 70, acconti: 0 }
        ];
        sample.forEach(x => store.add(x));
      }
    };
    req.onsuccess = (e) => { db = e.target.result; resolve(db); };
    req.onerror = (e) => reject(e.target.error);
  });
}
function tx(mode='readonly'){ return db.transaction(STORE, mode).objectStore(STORE); }
function getAll(){ return new Promise((res, rej)=>{ const q=tx('readonly').getAll(); q.onsuccess=()=>res(q.result||[]); q.onerror=(e)=>rej(e.target.error); }); }
function getById(id){ return new Promise((res, rej)=>{ const q=tx('readonly').get(id); q.onsuccess=()=>res(q.result||null); q.onerror=(e)=>rej(e.target.error); }); }
function put(item){ return new Promise((res, rej)=>{ const q=tx('readwrite').put(item); q.onsuccess=()=>res(); q.onerror=(e)=>rej(e.target.error); }); }
function del(id){ return new Promise((res, rej)=>{ const q=tx('readwrite').delete(id); q.onsuccess=()=>res(); q.onerror=(e)=>rej(e.target.error); }); }
function clearAll(){ return new Promise((res, rej)=>{ const q=tx('readwrite').clear(); q.onsuccess=()=>res(); q.onerror=(e)=>rej(e.target.error); }); }

// ---- Helpers ----
function eur(x){ return (x < 0 ? '-€ ' : '€ ') + Math.abs(x).toFixed(2).replace('.', ','); }
function saldo(c){ const d = c.totale - c.pagato - c.acconti; return d>0 ? -Math.abs(d) : (Math.abs(d)<1e-9 ? 0 : d); }
function uid(){ return Date.now(); }

// ---- Routing ----
const viewHome = document.getElementById('view-home');
const viewDetail = document.getElementById('view-detail');
const viewSettings = document.getElementById('view-settings');
function show(view){ [viewHome, viewDetail, viewSettings].forEach(v=>v.classList.remove('active')); view.classList.add('active'); }
function go(route){ location.hash = route; }

window.addEventListener('hashchange', renderRoute);
async function renderRoute(){
  if(!sessionStorage.getItem('auth_ok') && await hasPIN()){
    showPinGate();
    return;
  }
  const h = location.hash || '#home';
  if(h.startsWith('#detail:')){
    const id = Number(h.split(':')[1]);
    renderDetail(id);
  } else if(h==='#settings'){
    renderSettings();
  } else {
    renderHome();
  }
}

// ---- Modals ----
const modal = document.getElementById('modal');
const modalTitle = document.getElementById('modal-title');
const modalBody = document.getElementById('modal-body');
const cancelBtn = document.getElementById('cancel');
const confirmBtn = document.getElementById('confirm');
let modalHandler = null;

function openModal(title, bodyHTML, onConfirm){
  modalTitle.textContent = title;
  modalBody.innerHTML = bodyHTML;
  modal.classList.remove('hidden');
  modalHandler = onConfirm;
}
function closeModal(){ modal.classList.add('hidden'); modalHandler=null; }
cancelBtn.addEventListener('click', closeModal);
confirmBtn.addEventListener('click', async ()=>{ if(modalHandler){ await modalHandler(); } closeModal(); renderRoute(); });

// ---- Home (cards list) ----
async function renderHome(){
  const data = await getAll();
  let html = `<div class="list">`;
  data.sort((a,b)=>a.name.localeCompare(b.name)).forEach(c=>{
    const s = saldo(c);
    html += `
      <div class="card">
        <h3>${c.name}</h3>
        <div class="row">
          <span>Totale: ${eur(c.totale)}</span>
          <span>Pagato: ${eur(c.pagato)}</span>
          <span>Acconti: ${eur(c.acconti)}</span>
          <span class="${s<0?'bad':'good'}">Saldo: ${eur(s)}</span>
        </div>
        <div class="actions">
          <button class="btn" onclick="addAcconto(${c.id})">Acconto</button>
          <button class="btn" onclick="addRicarica(${c.id})">Ricarica</button>
          <button class="btn" onclick="editCliente(${c.id})">Modifica</button>
          <button class="btn danger" onclick="deleteCliente(${c.id})">Elimina</button>
          <button class="btn primary" onclick="go('#detail:${c.id}')">Dettaglio</button>
        </div>
      </div>`;
  });
  html += `</div>`;
  viewHome.innerHTML = html;
  show(viewHome);
}

// ---- Detail ----
async function renderDetail(id){
  const c = await getById(id); if(!c){ go('#home'); return; }
  const s = saldo(c);
  viewDetail.innerHTML = `
    <div class="detail">
      <div class="group">
        <h3>${c.name}</h3>
        <div class="row" style="margin-top:6px">
          <span>Totale: ${eur(c.totale)}</span>
          <span>Pagato: ${eur(c.pagato)}</span>
          <span>Acconti: ${eur(c.acconti)}</span>
          <span class="${s<0?'bad':'good'}">Saldo: ${eur(s)}</span>
        </div>
      </div>
      <div class="group">
        <div class="actions">
          <button class="btn" onclick="addAcconto(${c.id})">Acconto</button>
          <button class="btn" onclick="addRicarica(${c.id})">Ricarica</button>
          <button class="btn" onclick="editCliente(${c.id})">Modifica</button>
          <button class="btn danger" onclick="deleteCliente(${c.id})">Elimina</button>
          <button class="btn" onclick="go('#home')">Indietro</button>
        </div>
      </div>
    </div>`;
  show(viewDetail);
}

// ---- Settings ----
function themeRow(){
  const theme = localStorage.getItem('theme') || 'auto';
  const checked = theme==='dark' ? 'checked' : '';
  const auto = theme==='auto' ? 'checked' : '';
  const light = theme==='light' ? 'checked' : '';
  return `
    <div class="setting">
      <h4>Tema</h4>
      <div class="inline"><span>Automatico (segui iPhone)</span><input type="radio" name="theme" value="auto" ${auto}></div>
      <div class="inline"><span>Chiaro</span><input type="radio" name="theme" value="light" ${light}></div>
      <div class="inline"><span>Scuro</span><input type="radio" name="theme" value="dark" ${checked}></div>
    </div>`;
}
function pinRow(){
  return `
    <div class="setting">
      <h4>PIN di accesso</h4>
      <div class="inline"><span>Stato PIN</span><span id="pin-status">…</span></div>
      <div class="actions" style="margin-top:8px">
        <button class="btn" id="btn-pin-set">Imposta/Modifica PIN</button>
        <button class="btn danger" id="btn-pin-remove">Rimuovi PIN</button>
      </div>
    </div>`;
}
function dangerRow(){
  return `
    <div class="setting">
      <h4>Operazioni</h4>
      <div class="actions">
        <button class="btn danger" id="btn-wipe-clients">Cancella TUTTI i clienti</button>
        <button class="btn danger" id="btn-wipe-all">Reset totale (inclusi PIN e impostazioni)</button>
      </div>
    </div>`;
}

async function renderSettings(){
  viewSettings.innerHTML = `<div class="settings">${themeRow()}${pinRow()}${dangerRow()}</div>`;
  show(viewSettings);
  // bind
  document.querySelectorAll('input[name="theme"]').forEach(r=>{
    r.addEventListener('change', (e)=>{ localStorage.setItem('theme', e.target.value); applyTheme(); });
  });
  // PIN status
  document.getElementById('pin-status').textContent = (await hasPIN()) ? 'Attivo' : 'Non impostato';
  document.getElementById('btn-pin-set').addEventListener('click', () => pinSetFlow());
  document.getElementById('btn-pin-remove').addEventListener('click', () => pinRemoveFlow());
  document.getElementById('btn-wipe-clients').addEventListener('click', () => wipeClientsFlow());
  document.getElementById('btn-wipe-all').addEventListener('click', () => wipeAllFlow());
}

// ---- Toolbar actions ----
const btnNew = document.getElementById('btn-new');
const btnImport = document.getElementById('btn-import');
const btnExport = document.getElementById('btn-export');
const btnSettings = document.getElementById('btn-settings');
const fileInput = document.getElementById('file-input');

btnNew.addEventListener('click', newCliente);
btnSettings.addEventListener('click', () => go('#settings'));
btnExport.addEventListener('click', async () => {
  const data = await getAll();
  const blob = new Blob([JSON.stringify({ version: 2, exportedAt: new Date().toISOString(), data }, null, 2)], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `ricariche-backup-${new Date().toISOString().slice(0,10)}.json`; a.click(); URL.revokeObjectURL(a.href);
});
btnImport.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', async (e) => {
  const file = e.target.files && e.target.files[0];
  if(!file) return; const text = await file.text();
  try{
    const obj = JSON.parse(text); if(!obj || !Array.isArray(obj.data)) throw new Error('Formato non valido');
    await clearAll(); for(const item of obj.data){ if(typeof item.id!== 'number') continue; await put({ id:item.id, name:String(item.name||''), totale:Number(item.totale||0), pagato:Number(item.pagato||0), acconti:Number(item.acconti||0) }); }
    go('#home');
  }catch(err){ alert('File non valido: '+err.message); }
  finally{ e.target.value=''; }
});

// ---- CRUD flows ----
async function newCliente(){
  openModal('Nuovo cliente', `
    <label class='label'>Nome</label>
    <input id='f-name' class='input' placeholder='es. Mario Rossi' />
    <label class='label'>Totale iniziale (€)</label>
    <input id='f-tot' class='input' inputmode='decimal' type='number' step='0.01' value='0' />
    <label class='label'>Pagato (€)</label>
    <input id='f-pag' class='input' inputmode='decimal' type='number' step='0.01' value='0' />
    <label class='label'>Acconti (€)</label>
    <input id='f-acc' class='input' inputmode='decimal' type='number' step='0.01' value='0' />
  `, async () => {
    const name = document.getElementById('f-name').value.trim();
    const totale = Number(document.getElementById('f-tot').value||0);
    const pagato = Number(document.getElementById('f-pag').value||0);
    const acconti = Number(document.getElementById('f-acc').value||0);
    if(!name){ alert('Inserisci il nome'); return; }
    await put({ id: uid(), name, totale, pagato, acconti });
  });
}

async function editCliente(id){
  const c = await getById(id); if(!c) return;
  openModal('Modifica cliente', `
    <label class='label'>Nome</label>
    <input id='f-name' class='input' value='${c.name.replace(/'/g, "&#39;")}' />
    <label class='label'>Totale (€)</label>
    <input id='f-tot' class='input' inputmode='decimal' type='number' step='0.01' value='${c.totale}' />
    <label class='label'>Pagato (€)</label>
    <input id='f-pag' class='input' inputmode='decimal' type='number' step='0.01' value='${c.pagato}' />
    <label class='label'>Acconti (€)</label>
    <input id='f-acc' class='input' inputmode='decimal' type='number' step='0.01' value='${c.acconti}' />
  `, async () => {
    c.name = document.getElementById('f-name').value.trim();
    c.totale = Number(document.getElementById('f-tot').value||0);
    c.pagato = Number(document.getElementById('f-pag').value||0);
    c.acconti = Number(document.getElementById('f-acc').value||0);
    if(!c.name){ alert('Il nome non può essere vuoto'); return; }
    await put(c);
  });
}

async function deleteCliente(id){
  openModal('Elimina cliente', `<p>Confermi l'eliminazione definitiva?</p>`, async ()=>{ await del(id); });
}

async function addAcconto(id){
  const c = await getById(id); if(!c) return;
  openModal('Aggiungi acconto', `
    <label class='label'>Importo (€)</label>
    <input id='f-val' class='input' inputmode='decimal' type='number' step='0.01' />
  `, async () => {
    const v = Number(document.getElementById('f-val').value||0); if(v<=0) return;
    c.acconti += v; await put(c);
  });
}

async function addRicarica(id){
  const c = await getById(id); if(!c) return;
  openModal('Aggiungi ricarica', `
    <label class='label'>Importo (€)</label>
    <input id='f-val' class='input' inputmode='decimal' type='number' step='0.01' />
  `, async () => {
    const v = Number(document.getElementById('f-val').value||0); if(v<=0) return;
    c.totale += v; await put(c);
  });
}

async function wipeClientsFlow(){
  openModal('Conferma', `<p>Questa azione eliminerà <b>TUTTI</b> i clienti. Procedere?</p>`, async ()=>{ await clearAll(); go('#home'); });
}

async function wipeAllFlow(){
  openModal('Reset totale', `<p>Elimina <b>TUTTI</b> i clienti e <b>TUTTE</b> le impostazioni (incluso PIN). Procedere?</p>`, async ()=>{
    await clearAll(); localStorage.removeItem('pin_hash'); localStorage.removeItem('theme'); sessionStorage.removeItem('auth_ok'); applyTheme(); go('#home'); location.reload();
  });
}

// ---- PIN (hash via SubtleCrypto) ----
async function sha256Hex(txt){
  if(window.crypto && window.crypto.subtle){
    const enc = new TextEncoder().encode(txt);
    const buf = await crypto.subtle.digest('SHA-256', enc);
    return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join('');
  } else {
    // fallback debole (non ideale, ma per compatibilità)
    let h = 0; for(let i=0;i<txt.length;i++){ h = (h<<5)-h + txt.charCodeAt(i); h|=0; } return String(h);
  }
}
async function hasPIN(){ return !!localStorage.getItem('pin_hash'); }
async function setPIN(pin){ localStorage.setItem('pin_hash', await sha256Hex(pin)); }
async function removePIN(){ localStorage.removeItem('pin_hash'); }
async function checkPIN(pin){ const h = localStorage.getItem('pin_hash'); if(!h) return true; return (await sha256Hex(pin))===h; }

function showPinGate(){
  const gate = document.getElementById('pin-gate');
  gate.classList.remove('hidden');
  const inputs = gate.querySelectorAll('.pin-inputs input');
  inputs.forEach(i=>i.value='');
  inputs[0].focus();
  function collect(){
    const pin = Array.from(inputs).map(i=>i.value).join('');
    if(pin.length===4){
      checkPIN(pin).then(ok=>{
        if(ok){ sessionStorage.setItem('auth_ok','1'); gate.classList.add('hidden'); renderRoute(); }
        else { inputs.forEach(i=>i.value=''); inputs[0].focus(); }
      });
    }
  }
  inputs.forEach((i,idx)=>{
    i.addEventListener('input', ()=>{ if(i.value && idx<3) inputs[idx+1].focus(); collect(); });
    i.addEventListener('keydown', (e)=>{ if(e.key==='Backspace' && !i.value && idx>0){ inputs[idx-1].focus(); } });
  });
  document.getElementById('pin-clear').onclick = ()=>{ inputs.forEach(i=>i.value=''); inputs[0].focus(); };
}

function pinSetFlow(){
  openModal('Imposta/Modifica PIN', `
    <label class='label'>Nuovo PIN (4 cifre)</label>
    <input id='p1' class='input' type='password' inputmode='numeric' maxlength='4' />
    <label class='label'>Conferma PIN</label>
    <input id='p2' class='input' type='password' inputmode='numeric' maxlength='4' />
  `, async () => {
    const p1 = document.getElementById('p1').value.trim();
    const p2 = document.getElementById('p2').value.trim();
    if(p1.length!==4 || p2.length!==4 || p1!==p2){ alert('PIN non valido o non coincidente'); return; }
    await setPIN(p1); alert('PIN impostato');
  });
}

function pinRemoveFlow(){
  openModal('Rimuovi PIN', `<p>Rimuovere il PIN di accesso?</p>`, async ()=>{ await removePIN(); sessionStorage.removeItem('auth_ok'); alert('PIN rimosso'); });
}

// ---- Expose some functions to window for inline handlers ----
Object.assign(window, { addAcconto, addRicarica, editCliente, deleteCliente, go });

// ---- Init ----
(async function(){
  if(!isIOS()){
    // Non blocchiamo l'uso, ma l'app è ottimizzata per iPhone/iPad
  }
  await openDB();
  renderRoute();
})();
