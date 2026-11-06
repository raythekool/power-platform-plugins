# Standard entity assets (view + form)

Coppie `<table>_view.yaml` / `<table>_form.yaml` pronte all'uso per le tabelle Dataverse standard
della baseline **Sales Hub** e **Customer Service Hub** (vedi `../standard-navigation/` e
`../../references/standard-apps.md`). Ogni file segue il contratto `config/entities/<entita>.yaml`
descritto in `../../references/yaml-schema.md`, con `dataverse.table.source: standard` gia
compilato e `sourceUrl` verso la entity reference Microsoft Learn.

## Copertura

| Tabella Dataverse | View | Form | Hub |
| --- | --- | --- | --- |
| `account` | ✅ | ✅ | Sales + Service |
| `contact` | ✅ | ✅ | Sales + Service |
| `incident` (Case) | ✅ | ✅ | Sales + Service |
| `activitypointer` | ✅ | — (vedi nota) | Sales + Service |
| `lead` | ✅ | ✅ | Sales |
| `opportunity` | ✅ | ✅ | Sales |
| `competitor` | ✅ | ✅ | Sales |
| `quote` | ✅ | ✅ | Sales |
| `salesorder` | ✅ | ✅ | Sales |
| `invoice` | ✅ | ✅ | Sales |
| `product` | ✅ | ✅ | Sales |
| `salesliterature` | ✅ | ✅ | Sales |
| `list` | ✅ | ✅ | Sales |
| `campaign` | ✅ | ✅ | Sales |
| `goal` | ✅ | ✅ | Sales |
| `socialprofile` | ✅ | ✅ | Service |
| `queue` | ✅ | ✅ | Service |
| `knowledgearticle` | ✅ | ✅ | Service |
| `msdyn_iotalert` | ✅ | ✅ | Service |
| `msdyn_customerasset` | ✅ | ✅ | Service |
| `template` | ✅ | ✅ | Service |
| `emailsignature` | ✅ | ✅ | Service |

`activitypointer` non ha un form proprio: e una vista aggregata di `email`/`phonecall`/
`appointment`/`task`, ogni riga apre il form dell'attivita concreta. Il suo `targetForm` e
dichiarato `null` di proposito — eccezione documentata alla regola generale di validazione
"ogni view ha un `targetForm`".

Non hanno asset dedicato le voci sitemap che non corrispondono a una singola tabella verificata:
dashboard di sistema, pagine di analytics incorporate, la pagina di ricerca Knowledge Base e le
tabelle non confermabili senza verifica sull'ambiente (`forecast`, `quickcampaign`).

## Come usarli

1. Copiare la coppia `<table>_view.yaml` + `<table>_form.yaml` in `config/entities/` del progetto.
2. Cerca-e-sostituisci `{{prefix}}` con `naming.prefix` del progetto in entrambi i file.
3. Aggiungere entrambi i `logicalName` all'elenco `entities:` di `config/index.yaml`.
4. Se la voce e gia referenziata da un asset di navigazione (`../standard-navigation/`), verificare
   che i `logicalName` coincidano dopo la sostituzione del prefisso.
5. I campi inclusi in ogni form sono un sottoinsieme rappresentativo (4-6 campi chiave), non
   l'elenco completo della tabella: aggiungere altri campi dalla entity reference Microsoft Learn
   linkata in `sourceUrl` quando il requisito lo richiede.

## Cosa verificare prima di un'implementazione reale

Questi asset descrivono la POC (metadata sufficienti a guidare un'implementazione futura), non
creano tabelle reali. Le tabelle di modulo aggiuntivo (`msdyn_iotalert`, `msdyn_customerasset`) e
quelle meno comuni (`socialprofile`, `emailsignature`) hanno `ownershipType` e alcuni nomi colonna
segnati come "piu comuni documentati": confermarli su Microsoft Learn o sul tenant target prima di
usarli come specifica definitiva per un cliente, come richiesto anche in
`../../references/standard-apps.md`.
