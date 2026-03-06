// Contabilità Ricariche – app.js v3.3.1
// - Date obbligatorie per Ricarica/Acconto (default = oggi)
// - Storico movimenti nel Dettaglio cliente
// - Click su "Ricariche" = Home
// - SOMMA SALDI in Home visibile SOLO quando non c’è ricerca (opzione B)

/* THEME */
const htmlEl = document.documentElement;
function applyTheme(){
  const pref = localStorage.getItem('theme') || 'auto';
  htmlEl.setAttribute('data-theme',
    pref === 'auto'
      ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
      : pref
  );
}
applyTheme();
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);

/* IndexedDB */
const DB_NAME = 'ricariche-db-v3';
const STORE = 'clients';
let db;
function openDB(){
  return new Promise((resolve,reject)=>{
    const req = indexedDB.open(DB_NAME, 4); // v4 per movimenti[]
    req.onupgradeneeded = (e)=>{
      db = e.target.result;
      if(!db.objectStoreNames.contains(STORE)){
        const s = db.createObjectStore(STORE, { keyPath:'id' });
        [
          { id:1, name:'Mario Rossi',  totale:50,  pagato:0,   acconti:20, movimenti:[] },
          { id:2, name:'Lucia Esposito', totale:120, pagato:100, acconti:0,  movimenti:[] },
          { id:3, name:'Bar Napoli',    totale:200, pagato:150, acconti:0,  movimenti:[] },
          { id:4, name:'Studio Verdi',  totale:70,  pagato:70,  acconti:0,  movimenti:[] }
        ].forEach(x=>s.add(x));
      } else {
        // Migrazione: assicura movimenti[]
        const store = e.target.transaction.objectStore(STORE);
        const getAll = store.getAll();
        getAll.onsuccess = ()=>{
          (getAll.result||[]).forEach(it=>{
            if(!Array.isArray(it.movimenti)) it.movimenti=[];
            store.put(it);
          });
        };
      }
    };
    req.onsuccess=(e)=>{ db=e.target.result; resolve(db); };
    req.onerror=(e)=>reject(e.target.error);
  });
}
function tx(mode='readonly'){ return db.transaction(STORE,mode).objectStore(STORE); }
function getAll(){ return new Promise((res,rej)=>{ const q=tx('readonly').getAll(); q.onsuccess=()=>res(q.result||[]); q.onerror=e=>rej(e.target.error); }); }
function getById(id){ return new Promise((res,rej)=>{ const q=tx('readonly').get(id); q.onsuccess=()=>res(q.result||null); q.onerror=e=>rej(e.target.error); }); }
function put(item){ return new Promise((res,rej)=>{ const q=tx('readwrite').put(item); q.onsuccess=()=>res(); q.onerror=e=>rej(e.target.error); }); }
function del(id){ return new Promise((res,rej)=>{ const q=tx('readwrite').delete(id); q.onsuccess=()=>res(); q.onerror=e=>rej(e.target.error); }); }
function clearAll(){ return new Promise((res,rej)=>{ const q=tx('readwrite').clear(); q.onsuccess=()=>res(); q.onerror=e=>rej(e.target.error); }); }

/* Helpers */
function eur(x){ return (x<0?'-€ ':'€ ') + Math.abs(x).toFixed(2).replace('.', ','); }
function saldo(c){ const d=c.totale - c.pagato - c.acconti; return d>0 ? -Math.abs(d) : (Math.abs(d)<1e-9?0:d); }
function uid(){ return Date.now(); }
function fmtDate(d){ const dt=new Date(d); const dd=String(dt.getDate()).padStart(2,'0'); const mm=String(dt.getMonth()+1).padStart(2,'0'); const yyyy=dt.getFullYear(); return `${dd}/${mm}/${yyyy}`; }

/* Elements & Routing */
const viewHome = document.getElementById('view-home');
const viewDetail = document.getElementById('view-detail');
const viewSettings = document.getElementById('view-settings');
function show(v){ [viewHome,viewDetail,viewSettings].forEach(x=>x.classList.remove('active')); v.classList.add('active'); }
function go(r){ location.hash=r; }

document.getElementById('title-home').addEventListener('click', ()=> go('#home'));

window.addEventListener('hashchange', renderRoute);
async function renderRoute(){
  const h = location.hash || '#home';
  if(h.startsWith('#detail:')){ renderDetail(Number(h.split(':')[1])); }
  else if(h==='#settings'){ renderSettings(); }
  else { renderHome(); }
}

/* Search */
const searchBar = document.getElementById('search-bar');
const searchInput = document.getElementById('search-input');
let searching=false;

document.getElementById('btn-search').addEventListener('click',()=>{
  searching=!searching;
  searchBar.classList.toggle('active', searching);
  if(searching){ searchInput.focus(); }
  else { searchInput.value=''; renderHome(); }
});
searchInput.addEventListener('input', renderHome);

/* Modal */
const modal=document.getElementById('modal');
const modalTitle=document.getElementById('modal-title');
const modalBody=document.getElementById('modal-body');
const btnCancel=document.getElementById('cancel');
const btnConfirm=document.getElementById('confirm');
let modalHandler=null;
function openModal(title,html,onConfirm){ modalTitle.textContent=title; modalBody.innerHTML=html; modal.classList.remove('hidden'); modalHandler=onConfirm; }
function closeModal(){ modal.classList.add('hidden'); modalHandler=null; }
btnCancel.addEventListener('click', closeModal);
btnConfirm.addEventListener('click', async()=>{ if(modalHandler) await modalHandler(); closeModal(); renderRoute(); });

/* Home (con SOMMA SALDI visibile solo quando non cerchi) */
async function renderHome(){
  const data = await getAll();
  const term = (searchInput.value||'').trim().toLowerCase();
  const isSearching = term !== '';
  const list = isSearching ? data.filter(c=>c.name.toLowerCase().includes(term)) : data;

  let html = '';

  // SOMMA SALDI: visibile Solo quando NON cerchi (opzione B)
  if(!isSearching){
    const totalSaldo = data.reduce((acc,c)=> acc + saldo(c), 0);
    const summaryClass = totalSaldo < 0 ? 'summary negative' : 'summary positive';
    html += `
      <div class="${summaryClass}">
        <div class="label">Somma saldi clienti</div>
        <div class="value">${eur(totalSaldo)}</div>
      </div>
    `;
  }

  html += '<div class="list">';
  list.sort((a,b)=>a.name.localeCompare(b.name)).forEach(c=>{
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
  html += '</div>';

  viewHome.innerHTML = html;
  show(viewHome);
}

/* Detail */
async function renderDetail(id){
  const c = await getById(id); if(!c){ go('#home'); return; }
  if(!Array.isArray(c.movimenti)) c.movimenti = [];
  const hist = [...c.movimenti].sort((a,b)=> new Date(b.data) - new Date(a.data));
  const s = saldo(c);

  let histHtml = '<div class="history"><h4>Storico movimenti</h4><ul>';
  if(hist.length===0){ histHtml += '<li class="meta">Nessun movimento registrato</li>'; }
  else {
    hist.forEach(m=>{
      histHtml += `<li><span>${fmtDate(m.data)} - ${m.tipo==='ricarica'?'Ricarica':'Acconto'}</span><span>${eur(m.importo)}</span></li>`;
    });
  }
  histHtml += '</ul></div>';

  viewDetail.innerHTML = `
    <div class="detail">
      <div class="group">
        <h3>${c.name}</h3>
        <div class="row">
          <span>Totale: ${eur(c.totale)}</span>
          <span>Pagato: ${eur(c.pagato)}</span>
          <span>Acconti: ${eur(c.acconti)}</span>
          <span class="${s<0?'bad':'good'}">Saldo: ${eur(s)}</span>
        </div>
        ${histHtml}
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

/* Settings (nota: card PIN disabilitato introdotta in v3.2) */
function renderSettings(){
  const t = localStorage.getItem('theme')||'auto';
  viewSettings.innerHTML = `
    <div class="settings">
      <div class="setting">
        <h4>Tema</h4>
        <div class="inline"><span>Automatico</span><input type="radio" name="theme" value="auto" ${t==='auto'?'checked':''}></div>
        <div class="inline"><span>Chiaro</span><input type="radio" name="theme" value="light" ${t==='light'?'checked':''}></div>
        <div class="inline"><span>Scuro</span><input type="radio" name="theme" value="dark" ${t==='dark'?'checked':''}></div>
      </div>
      <div class="setting info-anim">
        <h4>PIN Accesso</h4>
        <div class="info-box">
          <div class="info-icon">[DISABILITATA]</div>
          <div class="info-text">Questa funzione è temporaneamente disabilitata.</div>
        </div>
      </div>
      <div class="setting">
        <h4>Operazioni</h4>
        <div class="actions">
          <button class="btn danger" id="btn-wipe-clients">Cancella TUTTI i clienti</button>
          <button class="btn danger" id="btn-wipe-all">RESET totale (clienti + tema)</button>
        </div>
      </div>
    </div>`;

  document.querySelectorAll("input[name='theme']").forEach(r=>{
    r.addEventListener('change', e=>{ localStorage.setItem('theme', e.target.value); applyTheme(); });
  });
  document.getElementById('btn-wipe-clients').addEventListener('click', wipeClientsFlow);
  document.getElementById('btn-wipe-all').addEventListener('click', wipeAllFlow);
  show(viewSettings);
}

/* CRUD */
async function newCliente(){
  openModal('Nuovo cliente', `
    <label class='label'>Nome</label>
    <input id='f-name' class='input' placeholder='Mario Rossi'>
    <label class='label'>Totale (€)</label>
    <input id='f-tot' class='input' type='number' step='0.01' value='0'>
    <label class='label'>Pagato (€)</label>
    <input id='f-pag' class='input' type='number' step='0.01' value='0'>
    <label class='label'>Acconti (€)</label>
    <input id='f-acc' class='input' type='number' step='0.01' value='0'>
  `, async()=>{
    const name=document.getElementById('f-name').value.trim(); if(!name){ alert('Inserisci un nome'); return; }
    await put({ id:uid(), name, totale:Number(document.getElementById('f-tot').value||0), pagato:Number(document.getElementById('f-pag').value||0), acconti:Number(document.getElementById('f-acc').value||0), movimenti:[] });
  });
}

async function editCliente(id){
  const c = await getById(id); if(!c) return;
  openModal('Modifica cliente', `
    <label class='label'>Nome</label>
    <input id='f-name' class='input' value='${c.name}'>
    <label class='label'>Totale (€)</label>
    <input id='f-tot' class='input' type='number' step='0.01' value='${c.totale}'>
    <label class='label'>Pagato (€)</label>
    <input id='f-pag' class='input' type='number' step='0.01' value='${c.pagato}'>
    <label class='label'>Acconti (€)</label>
    <input id='f-acc' class='input' type='number' step='0.01' value='${c.acconti}'>
  `, async()=>{
    c.name=document.getElementById('f-name').value.trim();
    c.totale=Number(document.getElementById('f-tot').value||0);
    c.pagato=Number(document.getElementById('f-pag').value||0);
    c.acconti=Number(document.getElementById('f-acc').value||0);
    if(!Array.isArray(c.movimenti)) c.movimenti=[];
    if(!c.name){ alert('Il nome non può essere vuoto'); return; }
    await put(c);
  });
}

async function deleteCliente(id){
  openModal('Elimina cliente', `<p>Confermi l'eliminazione?</p>`, async()=>{ await del(id); });
}

async function addAcconto(id){
  const c=await getById(id); if(!c) return; if(!Array.isArray(c.movimenti)) c.movimenti=[];
  const today = new Date().toISOString().slice(0,10);
  openModal('Aggiungi acconto', `
    <label class='label'>Importo (€)</label>
    <input id='f-val' class='input' type='number' step='0.01' required>
    <label class='label'>Data</label>
    <input id='f-date' class='input' type='date' required value='${today}'>
  `, async()=>{
    const v=Number(document.getElementById('f-val').value||0); const d=document.getElementById('f-date').value;
    if(v<=0){ alert('Importo non valido'); return; }
    if(!d){ alert('La data è obbligatoria'); return; }
    c.acconti += v; c.movimenti.push({ tipo:'acconto', importo:v, data:d }); await put(c);
  });
}

async function addRicarica(id){
  const c=await getById(id); if(!c) return; if(!Array.isArray(c.movimenti)) c.movimenti=[];
  const today = new Date().toISOString().slice(0,10);
  openModal('Aggiungi ricarica', `
    <label class='label'>Importo (€)</label>
    <input id='f-val' class='input' type='number' step='0.01' required>
    <label class='label'>Data</label>
    <input id='f-date' class='input' type='date' required value='${today}'>
  `, async()=>{
    const v=Number(document.getElementById('f-val').value||0); const d=document.getElementById('f-date').value;
    if(v<=0){ alert('Importo non valido'); return; }
    if(!d){ alert('La data è obbligatoria'); return; }
    c.totale += v; c.movimenti.push({ tipo:'ricarica', importo:v, data:d }); await put(c);
  });
}

/* Import/Export */
const fileInput = document.getElementById('file-input');
document.getElementById('btn-import').addEventListener('click',()=>fileInput.click());
fileInput.addEventListener('change', async(e)=>{
  const file=e.target.files&&e.target.files[0]; if(!file) return;
  try{
    const text=await file.text(); const obj=JSON.parse(text); if(!obj||!Array.isArray(obj.data)) throw new Error('Formato non valido');
    await clearAll();
    for(const it of obj.data){ if(typeof it.id!=='number') continue; if(!Array.isArray(it.movimenti)) it.movimenti=[]; await put(it); }
    go('#home');
  }catch(err){ alert('Errore importazione: '+err.message); }
  finally{ fileInput.value=''; }
});

document.getElementById('btn-export').addEventListener('click', async()=>{
  const data=await getAll();
  const blob=new Blob([JSON.stringify({ version:4, exportedAt:new Date().toISOString(), data },null,2)],{type:'application/json'});
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=`ricariche-backup-${new Date().toISOString().slice(0,10)}.json`; a.click(); URL.revokeObjectURL(a.href);
});

/* Wipe */
async function wipeClientsFlow(){ openModal('Conferma', `<p>Eliminare <b>TUTTI</b> i clienti?</p>`, async()=>{ await clearAll(); go('#home'); }); }
async function wipeAllFlow(){ openModal('RESET Totale', `<p>Eliminare clienti e impostazioni tema?</p>`, async()=>{ await clearAll(); localStorage.removeItem('theme'); applyTheme(); location.reload(); }); }

/* Toolbar */
document.getElementById('btn-new').addEventListener('click', newCliente);
document.getElementById('btn-settings').addEventListener('click', ()=>go('#settings'));

/* Init */
(async function(){ await openDB(); renderRoute(); })();

// expose
Object.assign(window,{ addAcconto, addRicarica, editCliente, deleteCliente, go });
``