# Contabilità Ricariche – PWA iPhone (Offline)

PWA (Progressive Web App) da usare **su iPhone/iPad**, con salvataggio dati **in locale** (IndexedDB), installabile come **App** dalla Home. Funziona **offline** grazie al Service Worker. Saldi **negativi in rosso**.

## Funzionalità
- Lista clienti con Totale, Pagato, Acconti, **Saldo** (negativo in rosso)
- Pulsanti **Acconto** e **Ricarica** (aggiornano i dati in locale)
- **Importa** / **Esporta** dati in JSON per backup
- **Stampa/Condividi** (usa il foglio di stampa di iOS)
- **Solo iPhone/iPad** (blocco soft per altri dispositivi)
- **Offline** completo (cache app-shell)

## Struttura
```
contabilita-ricariche-pwa/
├── web/                 # sorgenti PWA
│   ├── index.html
│   ├── styles.css
│   ├── app.js
│   ├── manifest.json
│   ├── service-worker.js
│   └── assets/
│       ├── icon-192.png
│       └── icon-512.png
├── docs/                # copia per GitHub Pages
│   └── (stessi file della cartella web/)
└── README.md
```

## Pubblicazione su **GitHub Pages** (Versione A)
1. Crea un repository GitHub, ad esempio `contabilita-ricariche`.
2. Carica **l'intero contenuto** di questa cartella (ZIP → estrai → upload file e cartelle).
3. Vai su **Settings → Pages**.
4. In **Build and deployment** scegli **Deploy from a branch**.
5. Scegli **Branch: `main`** e **Folder: `/docs`** → **Save**.
6. Attendi 1-2 minuti. L'app sarà disponibile a un URL simile a:
   `https://<tuo-utente>.github.io/contabilita-ricariche/`

## Installazione su iPhone/iPad
1. Apri l'URL in **Safari** su iPhone/iPad.
2. Tocca **Condividi** → **Aggiungi a Home**.
3. Avvia l'app dall'icona in Home. Da ora funziona **anche offline**.

## Dati solo locali
I dati sono salvati in **IndexedDB** del browser (on-device). Nessun invio a server. Usa **Esporta** per fare un backup `.json`. Usa **Importa** per ripristinare.

## Nota su “solo iPhone”
Il blocco è **soft** (check User-Agent / iPadOS). Per esigenze di sicurezza più rigide serve un'app iOS nativa.
