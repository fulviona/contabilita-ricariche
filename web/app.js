/* ==========================================================
   Contabilità Ricariche – app.js v3
   UI stile app iPhone – Portrait-first
   Ricerca, PIN Fix, IndexedDB locale, CRUD completo, SPA routing
   ========================================================== */

/* -------------- iOS Detection -------------- */
function isIOS(){
  const ua = navigator.userAgent;
  return /iPhone|iPad|iPod/.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

/* -------------- THEME HANDLING -------------- */
const htmlEl = document.documentElement;

function applyTheme(){
  const pref = localStorage.getItem("theme") || "auto";

  if(pref === "auto"){
    htmlEl.setAttribute("data-theme",
      window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light"
    );
  } else {
    htmlEl.setAttribute("data-theme", pref);
  }
}

applyTheme();
window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", applyTheme);

/* -------------- IndexedDB Local DB -------------- */
const DB_NAME = "ricariche-db-v3";
const STORE = "clients";
let db;

function openDB(){
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 3);

    req.onupgradeneeded = (e) => {
      db = e.target.result;

      if(!db.objectStoreNames.contains(STORE)){
        const store = db.createObjectStore(STORE, { keyPath: "id" });

        const sample = [
          { id: 1, name: "Mario Rossi", totale: 50, pagato: 0, acconti: 20 },
          { id: 2, name: "Lucia Esposito", totale: 120, pagato: 100, acconti: 0 },
          { id: 3, name: "Bar Napoli", totale: 200, pagato: 150, acconti: 0 },
          { id: 4, name: "Studio Verdi", totale: 70, pagato: 70, acconti: 0 }
        ];
        sample.forEach(x => store.add(x));
      }
    };

    req.onsuccess = (e) => {
      db = e.target.result;
      resolve(db);
    };

    req.onerror = (e) => reject(e.target.error);
  });
}

function tx(mode = "readonly"){
  return db.transaction(STORE, mode).objectStore(STORE);
}

function getAll(){
  return new Promise((res, rej) => {
    const q = tx("readonly").getAll();
    q.onsuccess = () => res(q.result || []);
    q.onerror = (e) => rej(e.target.error);
  });
}

function getById(id){
  return new Promise((res, rej) => {
    const q = tx("readonly").get(id);
    q.onsuccess = () => res(q.result || null);
    q.onerror = (e) => rej(e.target.error);
  });
}

function put(item){
  return new Promise((res, rej) => {
    const q = tx("readwrite").put(item);
    q.onsuccess = () => res();
    q.onerror = (e) => rej(e.target.error);
  });
}

function del(id){
  return new Promise((res, rej) => {
    const q = tx("readwrite").delete(id);
    q.onsuccess = () => res();
    q.onerror = (e) => rej(e.target.error);
  });
}

function clearAll(){
  return new Promise((res, rej) => {
    const q = tx("readwrite").clear();
    q.onsuccess = () => res();
    q.onerror = (e) => rej(e.target.error);
  });
}

/* -------------- Helpers -------------- */
function eur(x){
  return (x < 0 ? "-€ " : "€ ") + Math.abs(x).toFixed(2).replace(".", ",");
}

function saldo(c){
  const d = c.totale - c.pagato - c.acconti;
  return d > 0 ? -Math.abs(d) : (Math.abs(d) < 1e-9 ? 0 : d);
}

function uid(){ return Date.now(); }

/* -------------- Views / Routing -------------- */
const viewHome = document.getElementById("view-home");
const viewDetail = document.getElementById("view-detail");
const viewSettings = document.getElementById("view-settings");

function show(view){
  [viewHome, viewDetail, viewSettings].forEach(v => v.classList.remove("active"));
  view.classList.add("active");
}

function go(route){
  location.hash = route;
}

window.addEventListener("hashchange", renderRoute);

async function renderRoute(){
  if(!sessionStorage.getItem("auth_ok") && await hasPIN()){
    showPinGate();
    return;
  }

  const h = location.hash || "#home";

  if(h.startsWith("#detail:")){
    renderDetail(Number(h.split(":")[1]));
  }
  else if(h === "#settings"){
    renderSettings();
  }
  else {
    renderHome();
  }
}

/* -------------- Search Bar -------------- */
const searchBar = document.getElementById("search-bar");
const searchInput = document.getElementById("search-input");
const btnSearch = document.getElementById("btn-search");

let searching = false;

btnSearch.addEventListener("click", () => {
  searching = !searching;

  if(searching){
    searchBar.classList.add("active");
    searchInput.focus();
  } else {
    searchBar.classList.remove("active");
    searchInput.value = "";
    renderHome();
  }
});

searchInput.addEventListener("input", renderHome);

/* -------------- Modal (Generic) -------------- */
const modal = document.getElementById("modal");
const modalTitle = document.getElementById("modal-title");
const modalBody = document.getElementById("modal-body");
const btnCancel = document.getElementById("cancel");
const btnConfirm = document.getElementById("confirm");
let modalHandler = null;

function openModal(title, html, onConfirm){
  modalTitle.textContent = title;
  modalBody.innerHTML = html;
  modal.classList.remove("hidden");
  modalHandler = onConfirm;
}

function closeModal(){
  modal.classList.add("hidden");
  modalHandler = null;
}

btnCancel.addEventListener("click", closeModal);
btnConfirm.addEventListener("click", async () => {
  if(modalHandler) await modalHandler();
  closeModal();
  renderRoute();
});

/* -------------- Home View -------------- */
async function renderHome(){
  const data = await getAll();
  const term = searchInput.value.trim().toLowerCase();

  let list = data;

  if(term){
    list = data.filter(c =>
      c.name.toLowerCase().includes(term)
    );
  }

  let html = `<div class="list">`;

  list.sort((a,b) => a.name.localeCompare(b.name))
      .forEach(c => {
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
          </div>
        `;
      });

  html += `</div>`;
  viewHome.innerHTML = html;
  show(viewHome);
}

/* -------------- Detail View -------------- */
async function renderDetail(id){
  const c = await getById(id);
  if(!c){ go("#home"); return; }

  const s = saldo(c);

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
    </div>
  `;

  show(viewDetail);
}

/* -------------- Settings View -------------- */
function   renderSettings(){
  viewSettings.innerHTML = `
    <div class="settings">

      <div class="setting">
        <h4>Tema</h4>
        <div class="inline"><span>Automatico</span><input type="radio" name="theme" value="auto" ${(localStorage.getItem('theme')||'auto')==='auto'?'checked':''}></div>
        <div class="inline"><span>Chiaro</span><input type="radio" name="theme" value="light" ${(localStorage.getItem('theme')||'auto')==='light'?'checked':''}></div>
        <div class="inline"><span>Scuro</span><input type="radio" name="theme" value="dark" ${(localStorage.getItem('theme')||'auto')==='dark'?'checked':''}></div>
      </div>

      <div class="setting">
        <h4>PIN Accesso</h4>
        <div class="inline"><span>Stato PIN</span><span id="pin-status">${localStorage.getItem("pin_hash")?'Attivo':'Non impostato'}</span></div>
        <div class="actions" style="margin-top:8px">
          <button class="btn" id="btn-pin-set">Imposta/Modifica PIN</button>
          <button class="btn danger" id="btn-pin-remove">Rimuovi PIN</button>
        </div>
      </div>

      <div class="setting">
        <h4>Operazioni</h4>
        <div class="actions">
          <button class="btn danger" id="btn-wipe-clients">Cancella TUTTI i clienti</button>
          <button class="btn danger" id="btn-wipe-all">RESET totale (clienti + PIN + tema)</button>
        </div>
      </div>

    </div>
  `;

  document.querySelectorAll("input[name='theme']").forEach(el => {
    el.addEventListener("change", (e) => {
      localStorage.setItem("theme", e.target.value);
      applyTheme();
    });
  });

  document.getElementById("btn-pin-set").addEventListener("click", pinSetFlow);
  document.getElementById("btn-pin-remove").addEventListener("click", pinRemoveFlow);
  document.getElementById("btn-wipe-clients").addEventListener("click", wipeClientsFlow);
  document.getElementById("btn-wipe-all").addEventListener("click", wipeAllFlow);

  show(viewSettings);
}

/* -------------- CRUD HANDLERS -------------- */
async function newCliente(){
  openModal("Nuovo Cliente", `
    <label class="label">Nome</label>
    <input id="f-name" class="input" placeholder="Mario Rossi">

    <label class="label">Totale (€)</label>
    <input id="f-tot" type="number" class="input" value="0" step="0.01">

    <label class="label">Pagato (€)</label>
    <input id="f-pag" type="number" class="input" value="0" step="0.01">

    <label class="label">Acconti (€)</label>
    <input id="f-acc" type="number" class="input" value="0" step="0.01">
  `,
  async () => {
    const name = document.getElementById("f-name").value.trim();
    if(!name){ alert("Inserisci un nome"); return; }

    await put({
      id: uid(),
      name,
      totale: Number(document.getElementById("f-tot").value||0),
      pagato: Number(document.getElementById("f-pag").value||0),
      acconti: Number(document.getElementById("f-acc").value||0)
    });
  });
}

async function editCliente(id){
  const c = await getById(id);

  openModal("Modifica Cliente", `
    <label class="label">Nome</label>
    <input id="f-name" class="input" value="${c.name}">

    <label class="label">Totale (€)</label>
    <input id="f-tot" class="input" value="${c.totale}" type="number" step="0.01">

    <label class="label">Pagato (€)</label>
    <input id="f-pag" class="input" value="${c.pagato}" type="number" step="0.01">

    <label class="label">Acconti (€)</label>
    <input id="f-acc" class="input" value="${c.acconti}" type="number" step="0.01">
  `,
  async () => {
    c.name = document.getElementById("f-name").value.trim();
    c.totale = Number(document.getElementById("f-tot").value||0);
    c.pagato = Number(document.getElementById("f-pag").value||0);
    c.acconti = Number(document.getElementById("f-acc").value||0);

    if(!c.name){ alert("Il nome non può essere vuoto"); return; }
    await put(c);
  });
}

async function deleteCliente(id){
  openModal("Elimina Cliente", `<p>Vuoi davvero eliminare questo cliente?</p>`, async () => {
    await del(id);
  });
}

async function addAcconto(id){
  openModal("Aggiungi Acconto", `
    <label class="label">Importo (€)</label>
    <input id="f-val" class="input" type="number" step="0.01">
  `,
  async () => {
    const c = await getById(id);
    const v = Number(document.getElementById("f-val").value||0);
    if(v<=0) return;

    c.acconti += v;
    await put(c);
  });
}

async function addRicarica(id){
  openModal("Aggiungi Ricarica", `
    <label class="label">Importo (€)</label>
    <input id="f-val" class="input" type="number" step="0.01">
  `,
  async () => {
    const c = await getById(id);
    const v = Number(document.getElementById("f-val").value||0);
    if(v<=0) return;

    c.totale += v;
    await put(c);
  });
}

/* -------------- Import / Export -------------- */
const fileInput = document.getElementById("file-input");
document.getElementById("btn-import").addEventListener("click", () => fileInput.click());

fileInput.addEventListener("change", async (e) => {
  const file = e.target.files && e.target.files[0];
  if(!file) return;

  try {
    const text = await file.text();
    const obj = JSON.parse(text);

    if(!obj || !Array.isArray(obj.data))
      throw new Error("File non valido");

    await clearAll();

    for(const item of obj.data){
      if(typeof item.id !== "number") continue;
      await put(item);
    }

    go("#home");
  }
  catch(err){
    alert("Errore importazione: " + err.message);
  }
  finally{
    fileInput.value = "";
  }
});

document.getElementById("btn-export").addEventListener("click", async () => {
  const data = await getAll();

  const blob = new Blob(
    [ JSON.stringify({ version: 3, exportedAt: new Date().toISOString(), data }, null, 2) ],
    { type: "application/json" }
  );

  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `ricariche-backup-${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
});

/* -------------- Settings: Reset / Wipe -------------- */
async function wipeClientsFlow(){
  openModal("Conferma", `<p>Eliminare <b>TUTTI</b> i clienti?</p>`, async () => {
    await clearAll();
    go("#home");
  });
}

async function wipeAllFlow(){
  openModal("RESET Totale", `<p>Eliminare clienti, PIN e impostazioni?</p>`, async () => {
    await clearAll();
    localStorage.removeItem("pin_hash");
    localStorage.removeItem("theme");
    sessionStorage.removeItem("auth_ok");
    applyTheme();
    location.reload();
  });
}

/* -------------- PIN SYSTEM -------------- */
async function sha256Hex(txt){
  if(window.crypto?.subtle){
    const enc = new TextEncoder().encode(txt);
    const buf = await crypto.subtle.digest("SHA-256", enc);
    return [...new Uint8Array(buf)]
      .map(b => b.toString(16).padStart(2,"0"))
      .join("");
  }
  else {
    // fallback (meno sicuro, ma necessario sugli iPhone vecchi)
    let h = 0;
    for(let i=0;i<txt.length;i++){
      h = (h<<5) - h + txt.charCodeAt(i);
      h |= 0;
    }
    return String(h);
  }
}

async function hasPIN(){
  return !!localStorage.getItem("pin_hash");
}

async function setPIN(pin){
  localStorage.setItem("pin_hash", await sha256Hex(pin));
}

async function removePIN(){
  localStorage.removeItem("pin_hash");
}

async function checkPIN(pin){
  const h = localStorage.getItem("pin_hash");
  if(!h) return true;
  return (await sha256Hex(pin)) === h;
}

/* ---- PIN Gate ---- */
const pinGate = document.getElementById("pin-gate");
const pinInputs = pinGate.querySelectorAll(".pin-inputs input");
const pinClear = document.getElementById("pin-clear");

function showPinGate(){
  pinGate.classList.remove("hidden");
  pinInputs.forEach(i => i.value = "");
  pinInputs[0].focus();
}

function shakePin(){
  pinGate.querySelector(".pin-card").style.animation = "shake .3s";
  setTimeout(() => {
    pinGate.querySelector(".pin-card").style.animation = "";
  }, 300);
}

pinInputs.forEach((inp, idx) => {

  inp.addEventListener("input", () => {
    if(inp.value && idx < 3)
      pinInputs[idx+1].focus();

    const pin = [...pinInputs].map(i=>i.value).join("");

    if(pin.length === 4){
      checkPIN(pin).then(ok => {
        
if(ok){
  sessionStorage.setItem("auth_ok", "1");
  pinGate.classList.add("hidden");

  // FIX iPhone: aspetta il repaint prima del routing
  setTimeout(() => {
    renderRoute();
  }, 50);
}

        }
        else {
          pinInputs.forEach(i => i.value = "");
          pinInputs[0].focus();
          shakePin();
        }

      });
    }
  });

  inp.addEventListener("keydown", (e) => {
    if(e.key === "Backspace" && !inp.value && idx > 0)
      pinInputs[idx-1].focus();
  });

});

pinClear.onclick = () => {
  pinInputs.forEach(i => i.value = "");
  pinInputs[0].focus();
};

/* ---- PIN SET/REMOVE ---- */
function pinSetFlow(){
  openModal("Imposta / Modifica PIN", `
    <label class="label">Nuovo PIN</label>
    <input id="p1" class="input" type="password" inputmode="numeric" maxlength="4">
    <label class="label">Conferma PIN</label>
    <input id="p2" class="input" type="password" inputmode="numeric" maxlength="4">
  `,
  async () => {
    const p1 = document.getElementById("p1").value.trim();
    const p2 = document.getElementById("p2").value.trim();

    if(p1.length !== 4 || p2.length !== 4 || p1 !== p2){
      alert("PIN invalido o non coincidente");
      return;
    }

    await setPIN(p1);
    alert("PIN impostato");
  });
}

function pinRemoveFlow(){
  openModal("Rimuovi PIN", `<p>Vuoi rimuovere il PIN?</p>`, async () => {
    await removePIN();
    sessionStorage.removeItem("auth_ok");
    alert("PIN rimosso");
  });
}

/* -------------- Toolbar events -------------- */
document.getElementById("btn-new").addEventListener("click", newCliente);
document.getElementById("btn-settings").addEventListener("click", () => go("#settings"));

/* -------------- Init -------------- */
(async function(){
  await openDB();
  renderRoute();
})();
if (navigator.serviceWorker?.controller) {
  navigator.serviceWorker.controller.postMessage({ type: 'SKIP_WAITING' });
}
