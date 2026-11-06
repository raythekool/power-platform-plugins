## Schema YAML della POC

Riferimento delle chiavi dei quattro layer. Le chiavi marcate `legacy-html` sono obbligatorie solo quando la POC deriva da un HTML monolitico esistente.

## Convenzioni comuni

- `logicalName`: nome tecnico, minuscolo, underscore, con il prefisso dichiarato in `config/index.yaml`.
- `displayName`: unico testo mostrato all'utente. Non deve coincidere con il `logicalName` ne contenere simboli di navigazione.
- `requirements`: elenco opzionale di ID requisito coperti dall'elemento, usato per il report di copertura.
- Un `logicalName` e unico nell'intera POC, non solo dentro il proprio file.

## `config/index.yaml`

```yaml
version: 1
appType: model-driven       # model-driven | code-app | power-pages, vedi tipi-di-app.md
mode: requirements          # requirements | legacy-html
naming:
  prefix: ava_              # in altri contesti: cli_, enr_, ...
  case: snake_lower
application:
  logicalName: ava_order_service
  displayName: Order Service
modelDrivenApps:               # opzionale, solo appType: model-driven
  - logicalName: ava_order_service
    displayName: Order Service
    navigation: current       # oppure un blocco navigation dedicato all'app
  - logicalName: ava_sales_hub
    displayName: Sales Hub
    navigation:
      areas:
        - logicalName: standard_sales
          displayName: Sales
          groups:
            - displayName: Clienti
              items:
                - { logicalName: standard_accounts, displayName: Account, pageType: view, table: account }
                - { logicalName: standard_contacts, displayName: Contatti, pageType: view, table: contact }
                - { logicalName: standard_leads, displayName: Lead, pageType: view, table: lead }
            - displayName: Opportunita
              items:
                - { logicalName: standard_opportunities, displayName: Opportunita, pageType: view, table: opportunity }
entities:
  - logicalName: ava_contratto_detail
    displayName: Contratto
    pageType: form            # solo appType: model-driven. dashboard | view | form | custom-page
    file: entities/ava_contratto_detail.yaml
navigation:                   # solo appType: model-driven
  showHome: true
  showRecent: true
  showPinned: true
  areas:
    - logicalName: ava_area_servizio
      displayName: Servizio
      groups:
        - displayName: Lavoro
          items: [ava_contratto_view]   # solo entita con pageType diverso da form
demoPath:
  - ava_contratto_view
  - ava_contratto_detail
showPrototypeBanner: true      # facoltativo, default true: nasconde l'avviso di pagina
                                # "Prototipo / Non e software funzionante" per demo gia
                                # rodate. I badge "Simulazione" sui componenti restano
                                # sempre visibili, non sono legati a questo flag.
```

`appType` e obbligatorio e non ha default: determina quali altre chiavi sono ammesse e quali tipi di
componente sono validi. Criteri di scelta e conseguenze sono in `tipi-di-app.md`.

`pageType`, `navigation` e `demoPath` valgono solo con `appType: model-driven`, dove si applicano le
regole di validazione descritte in `dynamics-365-chrome.md` (un `form` non compare mai in
`navigation`, ogni `view` deve avere un `targetForm`, ecc.). Con `appType: code-app` vanno omessi: la
navigazione e quella disegnata per l'app, non una site map Dataverse.
`showPrototypeBanner` va incluso solo negli assemblaggi che usano `assets/mda-shell.*` o
uno shell equivalente; non richiede validazione specifica.

### Blocco `powerPages` (solo `appType: power-pages`)

```yaml
powerPages:
  navigation: [ava_home, ava_richieste_elenco]   # facoltativo: menu del sito (default: entita che non sono dettagli)
  demoPersona: ava_cliente                         # persona iniziale del prototipo: anonymous | authenticated | web role
  webRoles:                                        # anonymous e authenticated sono impliciti
    - { logicalName: ava_cliente, displayName: Cliente, authenticated: true }
  tablePermissions:
    - logicalName: ava_tp_richiesta_cliente
      displayName: Richieste del cliente
      table: ava_richiesta                         # logical name Dataverse
      scope: contact                               # global | contact | account | self | parent
      privileges: [read, create, write]            # read | create | write | delete | append | appendto
      roles: [ava_cliente]                         # web role, anonymous o authenticated
      # scope parent: anche parentPermission (logicalName) e relationship (schema name)
```

Nelle entita: `entity.access` (`anonymous`, `authenticated` o `[web role]`, default `authenticated`),
`entity.hero: {title, text}` per home e pagine informative, `dataverse.table.entitySetName` per il nome
della Web API. Il ruolo `authenticated` vale per ogni utente autenticato; una pagina `anonymous` la vedono
tutti, quindi richiede table permission sia per `anonymous` sia per `authenticated`.

## `config/entities/<entita>.yaml`

```yaml
version: 1
application:
  logicalName: ava_order_service
  displayName: Order Service
entity:
  logicalName: ava_contratto_detail
  displayName: Contratto
  requirements: [RF-004]
  dataverse:
    table:
      source: custom              # standard | custom, dopo controllo MS Learn
      logicalName: ava_contratto
      schemaName: ava_Contratto
      displayName: Contratto
      displayCollectionName: Contratti
      primaryIdAttribute: ava_contrattoid
      primaryNameAttribute: ava_numero
      ownershipType: UserOwned
      notesEnabled: true
      attachmentsEnabled: false
      auditEnabled: true
      sourceUrl: null             # URL Learn se source: standard
      reuseDecision:
        outcome: create-custom     # reuse-standard | extend-standard | create-custom
        checkedStandardTables: [account, contact, incident, opportunity]
        reason: Nessuna tabella standard copre il concetto contrattuale specifico.
  dataset: ava_contratti        # solo pageType: view — dataset da cui la vista legge i record
  targetForm: ava_contratto_form # solo pageType: view — form aperto da una riga della vista
  primaryColumn: ava_numero      # solo pageType: view — colonna resa come collegamento
tabs:
  - logicalName: ava_generale
    displayName: Generale
sections:
  - logicalName: ava_dati_contratto
    displayName: Dati contratto
    tab: ava_generale
    layout: repeat(4, 1fr)
    fields:
      - logicalName: ava_data_attivazione
        displayName: Data attivazione
        control: datetime
        required: true
        readOnly: false
        value: "2026-01-15"
        requirements: [RF-012]
        selector: "#contratto .cell-3"   # legacy-html
        dataverse:                        # richiesto se il campo corrisponde a una colonna reale
          table: enr_contratto
          column: enr_dataattivazione
          type: datetime
          source: custom                  # standard | custom
          schemaName: enr_DataAttivazione
          requiredLevel: ApplicationRequired
          format: DateOnly                # DateOnly | DateAndTime
          behavior: DateOnly              # UserLocal | DateOnly | TimeZoneIndependent
```

Valori ammessi per `control`, allineati ai tipi colonna Dataverse:

| `control`  | Tipo Dataverse corrispondente |
| ---------- | ----------------------------- |
| `text`     | Single line of text           |
| `memo`     | Multiple lines of text        |
| `choice`   | Choice / OptionSet            |
| `lookup`   | Lookup                        |
| `money`    | Currency                      |
| `decimal`  | Decimal / Float               |
| `whole`    | Whole number                  |
| `datetime` | Date and time                 |
| `boolean`  | Yes/No                        |
| `file`     | File / Image                  |

Il blocco `entity.dataverse.table` e la specifica di tabella da riusare, estendere o creare. E richiesto per ogni schermata che rappresenta record Dataverse. Per dashboard che governano piu tabelle di configurazione, usare `entity.dataverse.tables` come lista degli stessi contratti. Prima di impostare `source: custom`, cercare su Microsoft Learn via MCP se esiste una tabella standard D365/Dataverse adatta (`account`, `contact`, `incident`, `opportunity`, ecc.) e documentare l'esito in `reuseDecision`. Con `source: standard`, usare `logicalName` e campi reali della reference Learn e valorizzare `sourceUrl`.

Il blocco `fields[].dataverse` deve contenere i dettagli necessari alla creazione o al riuso della colonna: `type`, `source`, `requiredLevel`, formato, limiti e opzioni applicabili. Per `choice` dichiarare valore numerico e label di ogni opzione; per `lookup` dichiarare `targets`; per `datetime` dichiarare `format` e `behavior`; per numeri e valute dichiarare `minValue`, `maxValue` e precisione quando applicabile. La matrice completa e in `dataverse-schema.md`.

## `config/data/`

- `index.yaml`: manifest dei dataset con `logicalName`, `file` ed eventuale `sourceVariable` (`legacy-html`).
- `_schema.yaml`: convenzioni, chiavi primarie e relazioni del modello demo.
- `<dataset>.yaml`: `logicalName`, `records` e relazioni.

```yaml
version: 1
logicalName: ava_contratti
displayName: Contratti
sourceVariable: contrattiData     # legacy-html
keyField: ava_contratto_id
records:
  - ava_contratto_id: CTR-0001
    ava_data_attivazione: "2026-01-15"
```

Regole: annidare solo le collezioni possedute dal record; i dataset riusati da piu schermate restano separati e referenziati per chiave; i dati sono sempre sintetici.

## `config/components/`

Un componente si dichiara in una delle due forme seguenti. Il criterio di scelta e in `SKILL.md`: forma locale per un uso singolo, definizione con istanze dal secondo uso in poi.

### Forma locale

Un file, `bindings` concreti, nessun parametro. E la forma predefinita.

```yaml
version: 1
logicalName: ava_contratto_header_summary
displayName: Riepilogo contratto
type: kpi                  # kpi | bpf | timeline | subgrid | generative-page | pcf
                           # generative-page e pcf: solo con appType: model-driven
requirements: [RF-020]
hostSelector: "#contratto-header"   # legacy-html
bindings:
  dataset: ava_contratti
  fields: [ava_contratto_id, ava_data_attivazione]
fallback: html
pcf:
  logicalName: ava_contratto_header
  controlName: Avanade.ContrattoHeader
  enabled: false
```

### Definizione riusabile

Vive in `config/components/_definitions/`. Non dichiara dataset concreti ne `hostSelector`: dichiara un contratto di parametri.

```yaml
version: 1
kind: definition
logicalName: ava_recap_conteggio
displayName: Recap record
type: pcf
params:
  - { name: dataset, type: dataset, required: true }
  - { name: titolo, type: text, required: true }
  - { name: campoConteggio, type: field, required: false }
  - { name: variante, type: choice, options: [neutro, attenzione], default: neutro }
simulation:
  fidelity: lookalike
  note: Simulazione a scopo dimostrativo
fallback: html
pcf:
  controlName: Avanade.RecapConteggio
  enabled: false
```

Valori ammessi per `params[].type`: `dataset`, `field`, `field-list`, `text`, `number`, `boolean`, `choice`. Per `choice` dichiarare `options`.

### Istanze

Le istanze di una definizione si dichiarano nella sezione che le ospita, dentro `config/entities/<entita>.yaml`:

```yaml
sections:
  - logicalName: ava_dati_contratto
    displayName: Dati contratto
    uses:
      - component: ava_recap_conteggio
        instance: ava_recap_contratti_attivi
        displayName: Contratti attivi
        args:
          dataset: ava_contratti
          titolo: Contratti attivi
        hostSelector: "#contratto-header"   # legacy-html
```

`instance` e un `logicalName` a tutti gli effetti e deve essere unico nella POC. `displayName` sull'istanza, quando presente, prevale su quello della definizione. Ogni chiave di `args` deve corrispondere a un `params[].name` della definizione.

La resa grafica appartiene alla definizione: tutte le istanze condividono lo stesso stile. Per variare un dettaglio fra istanze usare un parametro di variante, non una seconda definizione.

Finche `pcf.enabled` e `false` il renderer mantiene il fallback HTML. Sostituire il fallback significa solo impostare `enabled: true` mantenendo stabili logical name e binding.

I tipi `generative-page`, `code-app` e `pcf` rappresentano componenti Power Platform simulati: richiedono anche il blocco `simulation` con `fidelity` e `note`, descritto in `componenti-simulati.md`. Nella forma con definizione il blocco `simulation` sta sulla definizione, non sulle istanze. Nel prototipo restano sempre rese HTML, mai componenti reali.

## `config/requirements.yaml`

Manifest canonico dei requisiti in scope: e la sola fonte rispetto a cui i validator risolvono i riferimenti `requirements` e il report di copertura distingue un requisito scoperto da uno fuori scope. Senza questo file la validazione dei riferimenti e il report non sono eseguibili: crearlo prima di popolare entita, dataset e componenti.

```yaml
version: 1
requirements:
  - id: RF-004
    title: Consultazione contratto
    scope: in-scope # in-scope | out-of-scope | non-rappresentabile
    source: BBP 3.2
  - id: RF-031
    title: Ricalcolo backend
    scope: non-rappresentabile
    source: "Backlog #218"
```

Contratto di output del report di copertura, generato in `dist/requirements-coverage.md` (o `.json` con le stesse chiavi):

| Campo        | Valori                                                            |
| ------------ | ----------------------------------------------------------------- |
| `id`         | ID presente in `config/requirements.yaml`                         |
| `status`     | `coperto` \| `scoperto` \| `non-rappresentabile` \| `fuori-scope` |
| `references` | Elenco dei `logicalName` che coprono il requisito                 |

Un ID citato in un elemento ma assente dal manifest e un errore di validazione; un ID `in-scope` senza riferimenti risulta `scoperto` e va segnalato all'utente.

## Chiavi lette dal renderer generico (`app/poc-app.js`)

Il renderer dello scaffold disegna la POC solo da queste chiavi; non serve scrivere HTML o JavaScript di dominio.

| Dove | Chiave | Effetto |
| --- | --- | --- |
| `config/index.yaml` | `demoUser.initials` | Iniziali dell'utente nell'header (default `MD`/`DU`) |
| `config/index.yaml` (code-app) | `codeApp.navigation: [logicalName]` | Ordine delle voci di menu; default: entita che non sono `targetForm` di un'altra |
| `config/index.yaml` (power-pages) | `powerPages.navigation`, `powerPages.demoPersona`, `webRoles`, `tablePermissions` | Menu in alto, selettore della persona, pagine riservate, privilegi (`Nuovo` con create, `Salva` con write) |
| `entity` (power-pages) | `access`, `hero: {title, text}` | Chi vede la pagina; intestazione della home o di una pagina informativa |
| `entity` | `dataset`, `targetForm`, `primaryColumn` | Vista (model-driven) o elenco (code-app) e schermata di dettaglio aperta dalla riga |
| `entity` | `columns: [campo \| {field, label}]` | Colonne della griglia; default: colonna primaria + 5 colonne del primo record |
| `entity` | `viewName` | Titolo della vista (default `displayName`) |
| `entity` | `headerFields: [logicalName]` | Campi nell'intestazione del modulo (default: i primi tre valorizzati) |
| `entity` | `messageBar: {level, text}` | Barra dei messaggi del modulo (`info`, `warning`, `error`) |
| `sections[]` | `components: [logicalName]` | Componenti locali ospitati dalla sezione (le definizioni usano `uses`) |
| `fields[]` | `dataKey` | Chiave del record da leggere, se diversa da `dataverse.column` e `logicalName` |
| dataset | `keyField`, `primaryField` | Chiave e colonna mostrata come titolo, nei lookup e nei Recenti |
| dataset | `relations: [{field, references}]` | Relazioni verso altri dataset (in alternativa a `_schema.yaml`) |
| `config/data/_schema.yaml` | `relationships: [{dataset, field, references}]` | Integrita referenziale verificata da `validate-poc-data` |

`bindings` (o `args`/`params` delle definizioni, con gli stessi nomi) per tipo di componente:

| `type` | Chiavi |
| --- | --- |
| tutti | `dataset`, `relatedField` (filtra sul record aperto), `filter: {campo: valore}`, `targetForm` |
| `kpi` | `items: [{label, value, tone}]` statici, oppure `groupBy`, oppure conteggio con `sumField`/`sumLabel` |
| `subgrid` | `fields` (colonne) |
| `timeline` | `dateField`, `titleField`, `textField` |
| `bpf` | `stages: [etichetta]`, `stageField` (dal record) o `activeStage` |
| `generative-page` | `text` (contenuto generato simulato), `dataset` + `fields` + `limit` |
| `pcf` | `field` (+ `max` per i numerici) sul record aperto, oppure `dataset` + `fields` |

Le opzioni choice si leggono da `dataverse.choice.options`, `dataverse.choice` (lista) o `dataverse.options`, sempre come `{value, label}`.

## Regole di validazione attese

I validator della POC devono segnalare almeno:

- `appType` mancante o fuori da `{model-driven, code-app, power-pages}`;
- con `appType: code-app` o `power-pages`, presenza di `pageType`, di un blocco `navigation`, o di componenti con `type: generative-page` o `type: pcf`;
- con `appType: power-pages`: web role o table permission non conformi al prefisso, `scope` o `privileges` fuori enum, ruoli inesistenti in `access` o `roles`, schermata con tabella vista da un ruolo senza table permission `read`, dettaglio modificabile senza `write` (avviso: permesso mai usato, `entitySetName` assente);
- schermata record senza `entity.dataverse.table`, salvo che sia dichiaratamente una pagina puramente informativa senza tabella principale;
- campo mappabile a Dataverse senza `fields[].dataverse.type`, `source` o `requiredLevel`;
- `choice` senza opzioni complete `{value, label}`, `lookup` senza `targets`, `datetime` senza `format` e `behavior`, colonna numerica senza limiti quando il requisito li esprime;
- `logicalName` mancante o non conforme al prefisso dichiarato;
- `logicalName` duplicato tra elementi che lo dichiarano, a qualsiasi livello: entita, sezioni, campi, componenti, istanze e contratti `pcf` (i tab sono unici dentro la propria entita; i dataset fra loro, in `validate-poc-data`);
- `displayName` mancante, di soli simboli, o uguale al `logicalName`;
- sezione senza campi e senza componente ospitato;
- `control` fuori dall'enum ammesso;
- `selector`, `sourceVariable` o `hostSelector` mancanti in modalita `legacy-html`;
- `uses[].component` che non corrisponde a nessuna definizione in `config/components/_definitions/`, o `sections[].components` che non corrisponde a un componente locale;
- `args` con una chiave non dichiarata in `params`, un parametro `required` mancante o un valore incompatibile con `params[].type`;
- definizione dichiarata e mai usata da nessuna istanza;
- riferimenti `requirements` non presenti nel manifest `config/requirements.yaml`;
- relazioni dei dataset che puntano a chiavi inesistenti.

I validator segnalano inoltre, come avviso e non come errore, due componenti locali che condividono `type` e stesso insieme di `bindings.fields` su schermate diverse: e il segnale che manca una definizione riusabile.
