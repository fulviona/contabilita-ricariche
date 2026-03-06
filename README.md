# Contabilità Ricariche – PWA iPhone (Stile App, Portrait, PIN)

Questa è la versione **stile app iPhone**, ottimizzata per **verticale**, con:
- **Tema scuro/chiaro** (auto + toggle in Impostazioni)
- **Lista clienti a card** (saldo negativo in rosso)
- **Dettaglio cliente** a schermo intero
- **+ Nuovo cliente**, **Modifica**, **Acconto**, **Ricarica**, **Elimina**
- **Impostazioni** con **PIN di accesso** (4 cifre), **Cancella TUTTI i clienti**, **Reset totale**
- **Importa/Esporta** (JSON) e funzionamento **offline** (Service Worker)

## Pubblicazione con GitHub Pages
1. Crea il repository e carica i file.
2. In **Settings → Pages** scegli **Deploy from a branch** → Branch `main` → Folder `/docs` → Save.
3. La PWA sarà disponibile a: `https://<tuo-utente>.github.io/<repo>/`.
4. Da **Safari su iPhone** → **Condividi → Aggiungi a Home**.

## Sicurezza PIN
Il PIN è salvato come **hash SHA‑256** nel `localStorage` del device e verificato localmente. Non è una sicurezza forte come FaceID o un'app nativa, ma impedisce aperture casuali. Per requisiti più rigidi valuta una **app iOS** nativa.
