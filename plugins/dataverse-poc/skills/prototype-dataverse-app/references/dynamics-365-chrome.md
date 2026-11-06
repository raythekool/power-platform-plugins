## Fedelta alla UI di Dynamics 365 CE (Unified Interface)

Si applica solo con `appType: model-driven`. Con `appType: code-app` nulla di questa pagina e
pertinente: quella app disegna la propria navigazione e non ha site map, viste, moduli ne schede
di sessione. Vedi `tipi-di-app.md` per la scelta.

Riferimento per far somigliare il prototipo a un'app model-driven reale invece che a una
dashboard web generica. Regole derivate dalla documentazione Microsoft Learn e verificate
costruendo un prototipo Customer Service reale (settembre 2026).

Fonti consultate:

- [Basic navigation in a model-driven app](https://learn.microsoft.com/power-apps/user/navigation) — site map, vista elenco, modulo record, barra dei messaggi.
- [Overview of Copilot Service workspace](https://learn.microsoft.com/dynamics365/customer-service/implement/csw-overview) — sessioni e schede multisessione.
- [Change the color scheme or add a logo](https://learn.microsoft.com/power-apps/maker/model-driven-apps/create-themes-organization-branding) — elementi tematizzabili e palette di riferimento.
- [Typography in Windows / Fluent](https://learn.microsoft.com/windows/apps/design/signature-experiences/typography) — Segoe UI Variable e type ramp.

Se il prototipo deve somigliare a Dynamics 365 CE, verificare sempre queste linee guida
prima di disegnare la UI da zero: sono la differenza fra "una dashboard con dati del cliente" e
"un'app model-driven che si puo mostrare a un cliente D365".

## Modello di navigazione: `pageType`

Ogni schermata dichiara un `pageType` in `config/index.yaml`, accanto alla voce dell'entita:

```yaml
entities:
  - logicalName: ava_mywork_dashboard
    displayName: My Work
    pageType: dashboard          # dashboard | view | form | custom-page
    file: entities/ava_mywork_dashboard.yaml
  - logicalName: ava_case_view
    displayName: Casi
    pageType: view
    file: entities/ava_case_view.yaml
  - logicalName: ava_case_detail
    displayName: Caso
    pageType: form
    file: entities/ava_case_detail.yaml
```

Regola cardine, valida per qualunque app model-driven reale: **un `form` non compare mai
nella site map**. Ci si arriva solo aprendo una riga da una `view` (o da un componente che
apre un record, come una subgrid o un pannello suggerimenti). Il validator della POC deve
imporre questa regola (vedi sotto).

Per una `view`, l'entita dichiara anche a quale dataset e a quale form punta:

```yaml
entity:
  logicalName: ava_case_view
  pageType: view
  dataset: ava_cases          # dataset da cui la vista legge i record
  targetForm: ava_case_detail  # form aperto da una riga della vista
  primaryColumn: ava_subject   # colonna resa come collegamento cliccabile
sections:
  - uses:
      - component: ava_worklist_grid   # definizione riusabile, vedi yaml-schema.md
        instance: ava_view_casi_attivi
        displayName: Casi attivi        # e la "vista salvata" mostrata nel selettore
        args: { dataset: ava_cases, filtro: sezione_a, ... }
```

Una `view` puo ospitare piu istanze della stessa griglia riusabile: ognuna e una **vista
salvata** selezionabile dal titolo della pagina (vedi "Vista elenco" sotto), non una
schermata separata.

## Site map

Riprodurre la struttura descritta da Microsoft Learn, non un menu laterale generico:

- **Home** — prima voce, apre la prima schermata di `demoPath`.
- **Recenti** — gruppo comprimibile che elenca gli ultimi record aperti (max 10),
  con un'icona per aggiungerli agli **Aggiunti** (pin).
- **Aggiunti** — gruppo comprimibile per i record fissati dall'utente.
- **Gruppi** — le voci vere e proprie, raggruppate per area di lavoro; ogni voce e una
  dashboard, una view o una custom page (mai un form).
- **Selettore area**, in fondo alla site map, quando esistono piu aree.

Il selettore area in fondo alla site map e un **menu**, non uno switch ciclico: apre tutte le
aree disponibili, evidenzia quella corrente e cambia area solo quando l'utente sceglie una voce.
Nel renderer usare `data-area-menu` sul pulsante, `data-area-select` sulle voci e mantenere
`state.areaMenuOpen` separato da `state.area`.

## Selettore app model-driven

Il nome dell'app nella barra superiore e un **menu di selezione delle app model-driven**. La
configurazione puo dichiarare:

```yaml
modelDrivenApps:
  - logicalName: ava_customer_service_workbench
    displayName: Customer Service Workbench
  - logicalName: ava_customer_service_hub
    displayName: Customer Service Hub
```

Il renderer deve usare `state.appLogicalName` per l'app corrente, aprire/chiudere il menu con
`data-app-menu` e cambiare selezione con `data-app-select`. Se `modelDrivenApps` e assente, usare
`application` come unica voce di fallback. Il menu deve essere indipendente dal selettore area:
aprire uno chiude l'altro; la selezione dell'app aggiorna il nome mostrato senza alterare la
site map della POC, salvo che il progetto implementi esplicitamente un mapping di navigazione
per app.

### Profilo Sales osservato in un ambiente reale

In una sessione browser autenticata su un ambiente Dynamics 365 in lingua italiana, il profilo
mostrava il nome **Hub delle vendite** e queste
aree: **Attività personali**, **Clienti**, **Vendite**, **Collaterale**, **Marketing**,
**Prestazioni**, **Servizio**. Un profilo `<prefix>_sales_hub` può riprodurre questa osservazione.
Le pagine standard sono riferimenti visuali e di navigazione: non leggono record dell'ambiente
reale e non sostituiscono un export sitemap/metadata per una replica ALM.

Per una app standard o una pagina non ancora modellata nei file `config/entities/`, una voce di
sitemap puo essere un oggetto `{ logicalName, displayName, pageType, table }`. Il renderer deve
mostrare una pagina fallback informativa e non inventare record demo: `table` identifica la
tabella standard da collegare in una fase successiva, ad esempio `account`, `contact`, `lead`,
`opportunity`, `incident`, `entitlement`, `queue` o `sla`.

Contratto in `config/index.yaml`:

```yaml
navigation:
  showHome: true
  showRecent: true
  showPinned: true
  areas:
    - logicalName: ava_area_servizio
      displayName: Servizio
      groups:
        - displayName: Lavoro
          items: [ava_mywork_dashboard, ava_case_view, ava_email_view]
        - displayName: Informazioni
          items: [ava_important_item]
    - logicalName: ava_area_supervisione
      displayName: Supervisione
      groups:
        - displayName: Monitoraggio
          items: [ava_coordinator_dashboard]
```

## Site map ridimensionabile

Dynamics 365 CE permette di trascinare il bordo della site map per allargarla o
restringerla. `assets/mda-shell.js` lo riproduce con una maniglia di drag, non con
pulsanti +/-:

- `state.sitemapWidth` (default `260`, come `--sitemap-w`) e la fonte di verita
  persistita fra un render e l'altro.
- `MdaShell.renderSitemap()` aggiunge da sola, subito dopo `</nav>`, una
  `<div class="sitemap-resizer" data-resizer="1"></div>` — ma solo quando la site map e
  aperta: da collassata (48px) la maniglia non serve e non deve comparire.
- `MdaShell.enableSitemapResize(state)` va chiamata **una sola volta all'avvio** (non
  dentro la funzione di render): registra `mousedown`/`mousemove`/`mouseup` su
  `document` e, durante il drag, muta direttamente `document.querySelector('.sitemap').style.width`
  senza richiamare `render()` a ogni `mousemove` (un `innerHTML` completo ad ogni
  pixel di trascinamento introdurrebbe scatti visibili). Il valore finale viene
  scritto in `state.sitemapWidth` solo al rilascio del mouse.
- Ampiezza consentita: 200-420px. Fuori da questo intervallo la site map diventa
  illeggibile (troppo stretta) o sproporzionata (troppo larga) rispetto al contenuto.

Se un renderer di dominio non riusa `MdaShell.renderSitemap()` (shell scritta a mano),
riprodurre lo stesso pattern: stato con `sitemapWidth`, maniglia `[data-resizer]` come
elemento flessibile fisso di ~5px accanto a `.sitemap`, drag decoupled dal render.

## Banner di prototipo disattivabile

Il banner giallo di pagina ("Prototipo — Non e software funzionante...") puo essere
disattivato per demo gia rodate con lo sponsor, tramite `showPrototypeBanner: false` in
`config/index.yaml` (default `true` se assente). `MdaShell.renderProtoBanner(cfg, message)`
legge il flag e ritorna stringa vuota quando disattivato, aggiornando anche la custom
property CSS `--banner-h` a `0px` cosi la strip delle schede e la site map restano
agganciate correttamente sotto l'header (altrimenti resterebbe uno spazio vuoto di 29px).

**Regola non negoziabile**: questo flag controlla *solo* il banner di pagina. I badge
"Simulazione" sui singoli componenti (`componenti-simulati.md`, `simFrame()`, classe
`.badge.sim` su PCF/generative page/code app simulati) restano **sempre visibili**,
qualunque sia il valore di `showPrototypeBanner`. Una demo non deve mai poter essere
scambiata per software funzionante, nemmeno con il banner di pagina spento — per questo
i due meccanismi sono indipendenti e il secondo non e mai configurabile.

## Sessioni e schede (stile Copilot Service workspace)

Le app D365 CE moderne (in particolare Customer Service Workspace) non sostituiscono la
pagina: aprono **sessioni** con **schede**. Il comportamento da riprodurre, documentato in
[Copilot Service workspace overview](https://learn.microsoft.com/dynamics365/customer-service/implement/csw-overview):

| Azione | Risultato |
| --- | --- |
| Apri una pagina dalla site map | Si carica nella scheda a fuoco (nessuna nuova scheda) |
| Apri un record da una riga di vista | Nuova scheda (fino a 10) |
| Riapri un record gia aperto | Torna sulla scheda esistente, non ne crea una seconda |

Nel prototipo questo si traduce in uno stato minimo:

```js
state.tabs = [{ screen: 'ava_mywork_dashboard', key: null }];
state.active = 0;
```

`openInCurrentTab(screen)` sostituisce la scheda a fuoco; `openRecord(screen, key)` cerca
prima una scheda gia aperta su quel record e solo se non esiste ne apre una nuova. Ogni
apertura di record alimenta anche la lista **Recenti** della site map.

## Vista elenco

Una `view` riproduce, nell'ordine:

1. **Command bar**: Nuovo, Elimina, Aggiorna, Invia collegamento, Flusso, Esegui report,
   Esporta in Excel, altri comandi (`...`).
2. **Titolo cliccabile** che apre il selettore delle viste salvate (`data-view-menu`),
   con segno di spunta sulla vista attiva.
3. **Ricerca nella vista**, non ricerca globale.
4. **Griglia**: checkbox di selezione riga, colonna primaria come collegamento (con
   sottotitolo secondario, mai una seconda riga separata), colonne con badge per stato/
   priorita/SLA, riga cliccabile che apre il form.
5. **Jump bar alfabetica** e **paginazione** in fondo alla griglia.

Il clic su una riga apre `entity.targetForm` con la chiave del record: e l'unico punto in
cui una `view` e un `form` si parlano nel prototipo.

## Modulo record

Un `form` riproduce:

- **Command bar** specifica per record: Salva, Salva e chiudi, Nuovo, Aggiorna, Assegna,
  Elimina, Flusso.
- **Breadcrumb** verso la vista di provenienza (`entity.targetForm` inverso: quale vista
  ha aperto questo form) + **titolo** con la colonna primaria del record.
- **Intestazione con colonne chiave** (2-4 campi, non un elenco intero) accanto al titolo.
- **Schede** (tab) del form, con l'ultima spesso etichettata "Correlati" e una freccia che
  segnala un menu a discesa verso le entita collegate.
- **Barra dei messaggi dell'app** quando una condizione del record lo richiede (es. SLA
  violato), sopra il corpo della pagina, non dentro una card.
- **Campi**: obbligatori con asterisco rosso, sola lettura con un'icona di lucchetto e
  bordo tratteggiato (mai un colore di sfondo pieno), scelta e lookup con icona a destra.

## Tipografia e colori (Fluent 2 / Segoe UI Variable)

Non usare font generici o una palette inventata. Il prototipo deve usare:

- **Font**: `"Segoe UI Variable Text", "Segoe UI Variable", "Segoe UI", sans-serif`.
- **Type ramp** (dimensione/altezza riga): caption 12/16, body 14/20, body-lg 16/22,
  subtitle 20/28, title 24/32. Usare **Semibold** per l'enfasi, mai Bold o corsivo.
- **Brand**: `#0F6CBD` (hover `#115EA3`, pressed `#0C3B5E`, subtle `#EBF3FC`).
- **Neutrali**: testo `#242424`/`#424242`/`#616161`, bordi `#D1D1D1`/`#E0E0E0`/`#EBEBEB`,
  sfondi `#FFFFFF`/`#FAFAFA`/`#F5F5F5`.
- **Stati**: errore `#B10E1C`, avviso `#BC4B09`, successo `#0E700E`, viola (elementi di
  fasi future / fuori perimetro) `#5C2E91` — coerenti con i colori di contrasto raccomandati da Microsoft
  Learn per i temi, non scelti a piacere.

## Asset riusabili

`assets/mda-shell.css` e `assets/mda-shell.js` in questa skill contengono la shell
strutturale gia pronta (header, site map, strip delle schede, command bar, griglia, modulo)
con i token Fluent sopra descritti. Per una nuova POC:

1. Copiare entrambi i file in `<poc-root>/app/`.
2. Nel renderer specifico della POC, riusare le funzioni esposte da `MdaShell`
   (`renderHeader`, `renderProtoBanner(cfg, message)`, `renderTabstrip`, `renderSitemap`,
   `commandBar`, `gridFooter`, `openInCurrentTab`, `openRecord`, `closeTab`, `pushRecent`)
   invece di riscriverle: sono infrastruttura di navigazione, non logica di dominio.
   Chiamare anche `MdaShell.enableSitemapResize(state)` una sola volta all'avvio, non
   dentro la funzione di render (vedi "Site map ridimensionabile" sopra).
3. Scrivere solo i renderer dei componenti specifici del progetto (KPI, BPF, timeline,
   ecc.) seguendo `componenti-simulati.md`; la shell si occupa del resto.
4. Personalizzare `--brand` e le variabili di stato in `mda-shell.css` solo se il cliente
   ha un tema Dataverse custom da rispettare; altrimenti lasciare i valori di default,
   che sono gia quelli del tema out-of-the-box.

Non copiare-incollare la shell a mano da un'altra POC: usare sempre questi due file come
sorgente, cosi un miglioramento fatto qui si propaga alle POC successive.

## Regole di validazione da imporre

Aggiungere sempre questi controlli al validator quando la POC dichiara `pageType`:

- `pageType` deve appartenere a `{dashboard, view, form, custom-page}`.
- Una `view` deve dichiarare `dataset` e `targetForm`; `targetForm` deve esistere fra le
  entita e avere `pageType: form`.
- Nessuna voce di `navigation.areas[].groups[].items` puo puntare a un'entita con
  `pageType: form`.
- Ogni entita con `pageType` diverso da `form` deve essere raggiungibile da almeno una
  voce di site map (altrimenti e una schermata orfana).
- Ogni `form` deve essere il `targetForm` di almeno una `view` (altrimenti non e mai
  raggiungibile in demo).
