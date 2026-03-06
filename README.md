// Dati iniziali (puoi modificarli qui o salvarli in localStorage)
let clients = [
  { id: 1, name: 'Mario Rossi', totale: 50, pagato: 0, acconti: 20 },
  { id: 2, name: 'Lucia Esposito', totale: 120, pagato: 100, acconti: 0 },
  { id: 3, name: 'Bar Napoli', totale: 200, pagato: 150, acconti: 0 },
  { id: 4, name: 'Studio Verdi', totale: 70, pagato: 70, acconti: 0 },
];

const tbody = document.querySelector('#clients-table tbody');
const modal = document.getElementById('modal');
const modalTitle = document.getElementById('modal-title');
const amountInput = document.getElementById('amount');
const cancelBtn = document.getElementById('cancel');
const confirmBtn = document.getElementById('confirm');
let pendingAction = null; // { type: 'acconto'|'ricarica', id }

function saldo(c){
  const daPagare = c.totale - c.pagato - c.acconti;
  return daPagare > 0 ? -Math.abs(daPagare) : (Math.abs(daPagare) < 1e-9 ? 0 : daPagare);
}

function eur(x){
  return (x < 0 ? '-€ ' : '€ ') + Math.abs(x).toFixed(2).replace('.', ',');
}

function render(){
  tbody.innerHTML = '';
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
    tdActions.className = 'actions';
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
confirmBtn.addEventListener('click', () => {
  const val = parseFloat(amountInput.value || '0');
  if(!pendingAction || isNaN(val) || val <= 0){ closeModal(); return; }
  const idx = clients.findIndex(x => x.id === pendingAction.id);
  if(idx === -1){ closeModal(); return; }
  if(pendingAction.type === 'acconto'){
    clients[idx].acconti += val;
  } else {
    clients[idx].totale += val;
  }
  closeModal();
  render();
});

render();
