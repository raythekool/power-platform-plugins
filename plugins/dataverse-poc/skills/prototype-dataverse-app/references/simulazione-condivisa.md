## Simulazione condivisa (stage P)

Facoltativa. Serve quando la POC deve mostrare **due UI sugli stessi dati demo**, per esempio il back-office model-driven e un portale, con le modifiche fatte in una UI visibili subito nell'altra. Resta tutto **locale e sintetico**: non apre lo stage R, non usa `pac`/`pacx` e non contatta Dataverse.

Senza il blocco `simulation` la POC funziona come prima: `npm run serve`, `dist/*.html` aperto dal disco, SPA su mock.

### Configurazione

In `config/index.yaml`:

```yaml
simulation:
  port: 8090                       # facoltativo, default 8090
  portal:                          # facoltativo
    kind: plugin-spa               # plugin-spa (realization/power-pages) | external (SPA esistente)
    path: realization/power-pages  # cartella dell'SPA, relativa alla POC
    dist: dist-sim                 # build servita su /portal/ (relativa a path)
```

`appType` resta un valore solo: la simulazione non crea un'app ibrida.

### Avvio

```powershell
node scripts/sim-server.mjs            # oppure npm run sim
node scripts/sim-server.mjs --reset    # riparte dai dati iniziali (con backup)
node scripts/sim-server.mjs --port 8091
```

| Indirizzo | Contenuto |
| --- | --- |
| `http://127.0.0.1:<port>/` | `poc-runtime.html` (back-office) |
| `http://127.0.0.1:<port>/portal/` | build del portale (`simulation.portal`), con fallback SPA su `index.html` |
| `http://127.0.0.1:<port>/_sim/...` | API dello stato condiviso |

Il server ascolta solo su `127.0.0.1`, non fa chiamate in uscita, non serve `.sim/` e risponde solo a richieste con `Host` locale.

### Stato

- **Dati iniziali (seed):** i dataset di `config/data/`. Il server non riscrive mai lo YAML.
- **Stato corrente:** `.sim/state.json`, che va escluso da git. Contiene `{ version, seedHash, rev, datasets: { <logicalName>: { keyField, records } } }`.
  - Ogni record ha `_rev` (intero) e colonne con i nomi Dataverse dello YAML.
  - `rev` cresce a ogni scrittura.
- **Seed cambiato:** se lo YAML cambia, lo stato resta com'è e `health.seedChanged` diventa `true`. Le UI mostrano "Seed cambiato: Ripristina".
- **Stato illeggibile:** il server non lo ripara da solo e le API dati rispondono `503 state_corrupt`. Il reset salva il file danneggiato in `.sim/backup/` e riparte dal seed.
- **Backup:** ogni reset salva lo stato precedente in `.sim/backup/state-<timestamp>.json`. Si tengono gli ultimi 5.

### Contratto HTTP

Tutte le risposte sono JSON. Gli errori hanno la forma `{ "error": "<codice>", "message": "<testo in italiano>", ... }`.

Le richieste che scrivono (`PATCH`, `POST`) devono avere:
- `Content-Type: application/json`;
- l'header `X-Sim-Client: <id>`, con l'id della finestra che scrive. Gli eventi lo riportano, così una finestra riconosce le proprie modifiche.

Un sito esterno non può inviare questi header senza preflight CORS, che il server non concede. Così le richieste cross-site sono bloccate.

| Metodo e percorso | Risposta |
| --- | --- |
| `GET /_sim/health` | `{ ok, status: "ok"\|"corrupt", poc, rev, seedHash, seedChanged, datasets: [...] }` |
| `GET /_sim/api/data` | `{ rev, datasets: { <ln>: { keyField, count } } }` |
| `GET /_sim/api/data/<ln>` | `{ rev, keyField, records: [...] }` |
| `GET /_sim/api/data/<ln>/<key>` | il record, con header `ETag: "<_rev>"` |
| `PATCH /_sim/api/data/<ln>/<key>` | Richiede `If-Match: "<_rev>"`. Il body contiene solo le colonne da cambiare. Restituisce `200` con il record aggiornato |
| `POST /_sim/api/data/<ln>` | Crea un record e restituisce `201` con il record. Se manca la chiave, la genera dal pattern esistente (`PRE-010` → `PRE-011`) |
| `POST /_sim/reset` | Riparte dal seed e restituisce `{ rev, backup }` |
| `GET /_sim/events` | Server-Sent Events: `change` `{ rev, op, dataset, key, clientId }`, `reset` `{ rev }`, più un commento di heartbeat ogni 15 s |

**Codici di errore:**

| Codice HTTP | Errore | Quando |
| --- | --- | --- |
| `404` | `not_found` | Dataset o chiave inesistente |
| `409` | `conflict` | `_rev` superata; il body contiene `current`, il record attuale |
| `409` | `duplicate_key` | Chiave già presente in creazione |
| `415` | `unsupported_media_type` | Manca `Content-Type: application/json` |
| `422` | `invalid` | Body non valido, con `details: [...]` |
| `428` | `precondition_required` | Manca `If-Match` |
| `503` | `state_corrupt` | Stato illeggibile |

Una scrittura risponde `422` quando:
- usa colonne sconosciute al dataset o colonne che iniziano con `_`;
- cambia `keyField`;
- contiene lookup verso chiavi inesistenti (relazioni di `_schema.yaml` e `relations`);
- contiene dati che sembrano reali: email fuori dai domini demo, IBAN, codici fiscali.

Sono le stesse regole di `validate-poc-data.mjs`, che però in scrittura bloccano invece di avvisare.

### Regole per le UI

- **Refresh:** ogni UI si iscrive a `/_sim/events` e ricarica solo il dataset o il record indicato nell'evento.
  - Se gli eventi si interrompono, interroga `/_sim/health` ogni 5 s e ricarica tutto quando `rev` cambia.
  - Quando la scheda torna visibile, fa lo stesso controllo.
- **Finestre:** ogni finestra genera un `clientId` e lo tiene in `sessionStorage`. Filtri, schede aperte e persona restano locali alla finestra; solo i dati sono condivisi.
- **Conflitti:** a una risposta `409 conflict` la UI mostra "Record modificato in un'altra finestra" con due azioni.
  - **Ricarica** usa `current`.
  - **Sovrascrivi** ripete la scrittura con `If-Match` uguale a `current._rev`.

  I campi non vengono mai uniti in automatico.
- **Reset:** chiede conferma, poi chiama `POST /_sim/reset`. Tutte le UI ricevono `reset` e si ricaricano.
- **Banner:** ogni UI mostra "Simulazione locale: dati sintetici, nessun Dataverse".

### Prototipo (`poc-runtime.html`)

`app/poc-sim.js` è incluso solo nel runtime, mai in `dist/*.html`. Si attiva solo se `/_sim/health` risponde, cioè con `npm run sim`; con `npm run serve` o da `file://` il prototipo resta in sola lettura.

- **Model-driven:**
  - nei moduli, i campi non `readOnly` con una colonna nel dataset diventano modificabili;
  - "Salva" e "Salva e chiudi" scrivono, "Nuovo" (vista o modulo) crea, "Aggiorna" ricarica;
  - "Elimina" resta decorativo.
- **Code app e power-pages:** restano in sola lettura, ma si aggiornano con le modifiche fatte altrove.
- **`app/custom.js`:** riceve i cambi con `PocApp.onDataChanged(fn)`. I dati aggiornati sono in `PocApp.model.data`.

### Portali esterni (`kind: external`)

Un'SPA che non nasce dal plugin, come un portale React già esistente, si collega allo stesso contratto:
1. Aggiungere una modalità di build dedicata, per esempio Vite `--mode sim`, che legge e scrive su `/_sim/api`. La build di produzione non deve includerla.
2. In sviluppo, fare proxy di `/_sim` verso `http://127.0.0.1:<port>`. Per la demo, fare la build in `<path>/<dist>` con base `/portal/`.
3. Fare a runtime, sui dati del contratto, le proiezioni proprie del portale: stati mostrati al cliente, mascheramento di altri tenant. Le scritture tornano con le colonne e i codici Dataverse.

### Simulazione e Dataverse reale

| | Simulazione (stage P) | Dataverse (stage R) |
| --- | --- | --- |
| Dati | `.sim/state.json` dal seed YAML | Tabelle dell'ambiente DEV |
| Accesso | `/_sim/api` su 127.0.0.1 | Web API / SDK |
| Sicurezza | Persona simulata | Ruoli e table permission reali |
| Logica | Nessuna: conflitti pre-calcolati o regole client della POC | Plugin, flow, server logic |
