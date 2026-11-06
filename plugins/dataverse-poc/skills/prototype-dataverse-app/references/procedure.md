## Procedure operative del prototipo

Procedure di lavoro sui layer YAML e sull'HTML della POC. Le skill `dataverse-poc-*` e i sotto-agenti `poc-*` rimandano qui; le regole di dettaglio sono negli altri file di `references/`.

## Modalita

Le due modalita sono alternative e determinano quali chiavi YAML sono obbligatorie.

| Aspetto | `requirements` | `legacy-html` |
| --- | --- | --- |
| Punto di partenza | Requisiti funzionali, BBP, backlog | HTML monolitico esistente |
| Direzione | YAML verso HTML | HTML verso YAML |
| `fields[].selector` | Non richiesto: il layout deriva da `sections[].layout` | Obbligatorio |
| `datasets[].sourceVariable` | Non richiesto | Obbligatorio |
| `components[].hostSelector` | Non richiesto | Obbligatorio |
| Rischio principale | Copertura dei requisiti incompleta | Sovrascrittura delle modifiche manuali ai YAML |

Dichiarare la modalita scelta in `config/index.yaml` come `mode:`. Non mescolare le due modalita nella stessa POC senza una decisione esplicita dell'utente.

Esiste una terza via, `html-diretto`, per le POC che vivono solo come file HTML e per cui l'estrazione in YAML non e giustificata. Non produce alcun layer YAML e quindi non ha un `config/index.yaml` in cui dichiararsi: e una deroga esplicita, descritta nella procedura dedicata piu avanti.

## Componenti locali e componenti riusabili

Un componente si dichiara in due forme alternative. La scelta dipende da quante schermate lo usano, non dal suo `type`.

| Forma | Quando usarla | Dove vive |
| --- | --- | --- |
| Componente locale | Usato su una sola schermata | Un file in `config/components/`, con `bindings` concreti |
| Definizione con istanze | Usato su due o piu schermate | Definizione in `config/components/_definitions/`, istanze in `sections[].uses` |

Partire sempre dalla forma locale. Promuovere a definizione quando il componente serve sulla seconda schermata: e la soglia a cui il costo della duplicazione supera quello dell'indirezione.

La definizione dichiara un contratto di parametri (`params`) invece di dataset e campi concreti; ogni istanza fornisce i propri `args`. La resa grafica appartiene alla definizione, quindi tutte le istanze condividono automaticamente lo stesso stile: e questo il motivo principale per promuovere un componente, piu ancora del risparmio di righe.

Questo e anche il modello del PCF reale, dove un controllo e un manifest con proprieta tipizzate associato a campi diversi su form diversi. Il contratto validato nel prototipo resta quindi mappabile sul `ControlManifest` che verra scritto dopo l'approvazione.

Per differenze minime fra istanze (accento cromatico, densita, etichetta) usare un parametro di variante dichiarato nella definizione. Duplicare la definizione per cambiare un dettaglio grafico vanifica la coerenza di stile che la promozione doveva garantire.

Lo schema delle due forme e le regole di validazione sono in `yaml-schema.md`.

## Procedura: modalita `requirements`

Il dettaglio operativo e in `requisiti-to-poc.md`.

1. Leggere la fonte dei requisiti e ricavare l'inventario delle schermate: entita, scopo, attori e requisiti coperti.
2. Decidere con l'utente l'`appType` (`model-driven` o `code-app`) secondo `tipi-di-app.md`. Da qui dipendono i passi successivi.
3. Concordare con l'utente `naming.prefix`, nome applicazione ed elenco schermate prima di scrivere file.
4. Creare `config/index.yaml` con `appType`, `mode: requirements`, blocco `naming` ed elenco entita, e `config/requirements.yaml` con il manifest canonico dei requisiti in scope. Con `appType: model-driven` aggiungere anche `pageType` su ogni entita e il blocco `navigation`.
5. Creare un YAML per ogni schermata in `config/entities/`. Ogni file dichiara anche `entity.dataverse.table` con la decisione di riuso/creazione della tabella. Prima di `source: custom`, cercare su Microsoft Learn la tabella standard candidata e documentare l'esito in `reuseDecision`.
6. Per ogni campo, dichiarare almeno `logicalName`, `displayName`, `control`, `requirements` quando noto, e il blocco `dataverse` con colonna reale/proposta, `type`, `source`, `requiredLevel` e i dettagli applicabili: valori e label delle option set, target dei lookup, limiti numerici, precisione, formato e behavior DateTime, lunghezze testo, default.
7. Definire i dataset demo in `config/data/` con `index.yaml` e `_schema.yaml`. I dati devono essere sintetici e referenzialmente coerenti con le relazioni dichiarate.
8. Dichiarare in `config/components/` i controlli non rappresentabili come campo, con `logicalName`, `displayName`, `type`, `bindings` e `fallback`. Se lo stesso controllo compare su piu schermate, dichiararlo come definizione in `config/components/_definitions/` e collegarlo con `uses` nelle sezioni che lo ospitano.
9. Solo con `appType: model-driven`, per un futuro PCF aggiungere il contratto `pcf` con `logicalName`, `controlName` e `enabled: false`.
10. Eseguire `npm run check`: il renderer generico dello scaffold produce runtime e statico dai soli YAML, senza HTML scritto a mano.
11. Produrre il report di copertura requisiti secondo il contratto di `yaml-schema.md` e segnalare all'utente i requisiti non rappresentati. Nella consegna distinguere anche standard riusato, standard esteso con colonne custom e tabelle custom nuove.

## Procedura: modalita `legacy-html`

Usare questa procedura solo quando esiste un HTML monolitico che e la sorgente di riferimento.

1. Leggere `README.md`, le istruzioni del repository e la POC HTML selezionata prima di modificarla.
2. Identificare layout, form, tab, sezioni, campi, dataset JavaScript e controlli non tabellari. Riutilizzare CSS e comportamenti esistenti per mantenere la resa visiva.
3. Creare l'indice UI e un YAML per ogni schermata-entita in `config/entities/`. Ogni campo deve includere almeno `logicalName`, `displayName`, `selector` e `control`.
4. Anonimizzare obbligatoriamente i dati prima dell'estrazione: l'HTML legacy puo contenere nomi, email, telefoni, codici cliente o contratto e testo di messaggi reali. Sostituirli con valori sintetici equivalenti (stesso formato e stessa cardinalita) mantenendo le chiavi coerenti tra dataset; non portare mai i valori originali nei YAML.
5. Estrarre i dataset in `config/data/` con un parser AST JavaScript, applicando la mappa di anonimizzazione del passo precedente. Non usare regex per interpretare oggetti JavaScript annidati. Prima di salvare, verificare che nessun record contenga dati personali o di produzione residui.
6. Creare `config/data/index.yaml` e `_schema.yaml`; separare dataset riusati e mantenere annidate solo le collezioni possedute dal record.
7. Creare `config/components/index.yaml` e un YAML per ogni controllo non rappresentabile come campo. Ogni componente deve dichiarare `logicalName`, `displayName`, `type`, `hostSelector`, `bindings` e `fallback`. Se l'HTML legacy ripete lo stesso controllo su piu schermate, estrarlo una sola volta come definizione e dichiarare un'istanza per ogni punto di innesto, ciascuna con il proprio `hostSelector`.
8. Per un futuro PCF, aggiungere il contratto `pcf` con `logicalName`, `controlName` e `enabled: false`. Il fallback HTML resta attivo fino alla disponibilita del bundle PCF reale.
9. Implementare validazione YAML, generazione runtime e generazione dell'HTML statico dagli stessi YAML.
10. Rivedere i `displayName` estratti automaticamente: l'estrazione produce spesso etichette prive di significato, che vanno sostituite con il testo funzionale corretto.

## Procedura: modifiche dirette all'HTML

Usare questa procedura quando la POC esiste solo come file HTML e la modifica richiesta non giustifica l'estrazione in YAML. Non e la via predefinita: e una deroga, da riconoscere come tale.

Criterio di scelta:

| Situazione | Scelta |
| --- | --- |
| Modifica singola e circoscritta | HTML diretto |
| POC con vita residua breve, gia validata | HTML diretto |
| Stessa modifica ripetuta su piu schermate | Estrarre |
| Serve tracciabilita sui requisiti perche e un deliverable | Estrarre |
| Piu persone intervengono sulla POC | Estrarre |

Regole da rispettare, perche una modifica diretta non renda piu costosa un'estrazione futura:

1. Individuare il punto da modificare con una ricerca mirata sul testo visibile o sul `logicalName`, non leggendo il file per intero: un HTML di POC supera facilmente le migliaia di righe.
2. Non scrivere nel markup valori che appartengono a una struttura dati gia presente nella pagina. Se la schermata alimenta un elenco da un array JavaScript, aggiungere il record li, non una riga di tabella a mano.
3. Mantenere i nomi tecnici allineati al prefisso di progetto, come se i YAML esistessero: e cio che rende ancora possibile un'estrazione pulita.
4. Usare sempre dati sintetici. Vale anche qui il divieto di portare nella POC nomi, email, codici cliente o contratto reali.
5. Non introdurre dipendenze esterne, CDN o framework: la POC deve restare un file apribile dal filesystem con un doppio clic.
6. Committare con granularita e messaggio esplicito. Senza i layer YAML, il diff su un HTML di migliaia di righe e l'unica traccia di cosa e cambiato e perche.
7. Se le modifiche dirette diventano ricorrenti, fermarsi e proporre all'utente l'estrazione in YAML invece di continuare ad accumularle.

## Procedura: simulare un componente Power Platform

Vale per `generative-page` e `pcf`, entrambi ammessi solo con `appType: model-driven`. Il dettaglio grafico di ogni tipo e in `componenti-simulati.md`.

1. Verificare che l'`appType` della POC sia `model-driven`. Se e `code-app`, il componente non va simulato: la UI corrispondente si disegna direttamente come schermata dell'app.
2. Chiarire cosa deve dimostrare la simulazione: aspetto, posizione nella schermata, contenuti mostrati e messaggio da far passare in demo. Chiarire anche su quante schermate comparira, perche determina la forma del componente.
3. Creare o aggiornare il YAML del componente con `type`, `displayName`, `bindings`, `fallback` e il blocco `simulation`. Per un componente su piu schermate creare invece una definizione con `params` e `simulation`, e un'istanza con `args` in ogni sezione ospitante.
4. Collegare la simulazione ai dati gia presenti in `config/data/`. Se servono contenuti nuovi, aggiungerli come dataset sintetici, mai come valori scritti nel markup.
5. Per un `pcf`, dichiarare anche il contratto `pcf` con `enabled: false`: indica quale campo o subgrid il controllo sostituira quando sara implementato.
6. Il renderer generico disegna gia cornice e contrassegno di simulazione per `generative-page` e `pcf` (chiavi `bindings` in `yaml-schema.md`); solo per una resa che non copre, registrare un renderer in `app/custom.js`.
7. Rigenerare runtime e statico e verificare la resa nel browser.
8. Aggiornare `requirements` sugli elementi coinvolti e rieseguire il report di copertura.

## Procedura: aggiornamenti successivi

1. Identificare il layer corretto prima di modificare:
   - layout o etichetta campo: `config/entities/`;
   - record, liste, dettagli o subgrid: `config/data/`;
   - KPI, BPF, header, timeline, subgrid o PCF: `config/components/`.
2. Mantenere stabile il `logicalName` quando cambia solo il testo esposto. Aggiornare `displayName` per la label visibile.
3. Quando un componente locale serve su una seconda schermata, promuoverlo a definizione invece di duplicarne il file: ricavare i `params` dai suoi `bindings` attuali e convertire l'uso esistente in un'istanza. Modificare lo stile di un componente riusato significa modificare la sua definizione, mai le singole istanze.
4. Per un controllo PCF, non cambiare markup e dati per simulare il componente. Aggiornare invece binding e contratto in `config/components/`, mantenendo `fallback: html` finche il PCF non e integrato.
5. Eseguire i validator prima di rigenerare gli artefatti. Se un validator fallisce, interrompere la procedura, riportare gli errori e non eseguire `npm run build` finche non sono risolti.
6. Usare l'estrazione da HTML solo quando l'HTML legacy e davvero la nuova sorgente di riferimento: rigenera YAML e puo sovrascrivere modifiche manuali.
7. Quando un requisito cambia, aggiornare anche il campo `requirements` degli elementi coinvolti, per non perdere la tracciabilita.

## Comandi standard

Eseguire dalla cartella della POC:

```powershell
npm install
npm run check            # tutti i passi sotto, riepilogo con --json
npm run validate:config
npm run validate:data
npm run build
npm run test:smoke
```

I singoli passi (`prepare:runtime`, `build:static`, `serve`) restano disponibili per esecuzioni mirate; consultare `package.json` della POC per l'elenco effettivo.

Usare `npm run build` per validare e generare runtime/statico senza sovrascrivere i YAML.

Usare `npm run extract:all` solo per riallineare i layer YAML all'HTML legacy. Per una variante HTML esplicita, consultare gli script definiti in `package.json` della POC; se non esiste uno script `build:<variante>`, chiedere conferma prima di procedere.

## Verifica

1. Validator UI e dati senza errori.
2. Smoke test automatico: `npm run test:smoke` (vedi `scaffold.md` per aggiungerlo a una POC nuova).
3. Modalita runtime: avviare `npm run serve`, poi aprire `http://127.0.0.1:8080/poc-runtime.html`.
4. Modalita statica: aprire il file in `dist/` direttamente dal filesystem e verificare che non richieda YAML o bootstrap esterni.
5. Smoke test di almeno una lista, un dettaglio, una subgrid e un controllo dichiarativo della schermata aggiornata.
6. Per un componente PCF dichiarato, verificare che l'host riporti logical name, control name e fallback corretti; non dichiarare il PCF funzionante finche il bundle non e realmente integrato.
7. In modalita `requirements`, verificare il report di copertura: ogni requisito in scope deve risultare coperto da almeno una schermata, sezione, campo o componente.
8. Per un componente simulato, verificare che il contrassegno di simulazione sia visibile e che nessun elemento lasci intendere un collegamento reale a Dataverse.

## Regole di sicurezza e manutenzione

- Non modificare `poc-runtime.html`, `config/data/poc-data.js` o `dist/*.html` a mano: rigenerarli.
- Usare esclusivamente dati demo sintetici. Non inserire nei dataset anagrafiche reali, dati personali o estratti di ambienti produttivi del cliente, nemmeno quando la POC nasce da schermate reali.
- In modalita `legacy-html` l'anonimizzazione dei dati e un passo obbligatorio prima dell'estrazione: i YAML non devono mai contenere i valori originali presenti nell'HTML di partenza.
- Non cancellare record o relazioni per semplificare l'estrazione senza una decisione esplicita.
- Non versionare nel prototipo identificativi di ambiente, connection id, URL di tenant, client id o segreti: una simulazione non ne ha bisogno.
- Non eseguire `npm audit fix --force` come parte della gestione ordinaria della POC.
- Non modificare configurazioni dell'editor o del vault (es. `.obsidian/`), output generati da altre pipeline o file contenenti credenziali.
- Aggiornare il README della POC ogni volta che cambia un comando, una convenzione YAML o la modalita di distribuzione.
