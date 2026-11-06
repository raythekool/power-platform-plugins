# Standard navigation assets

Blocchi `navigation` pronti all'uso per rappresentare la baseline out-of-the-box di **Sales Hub**
e **Customer Service Hub** in una POC `appType: model-driven`, senza riprogettare la site map da
zero. Verificati interattivamente su un ambiente Dynamics 365 CE reale (settembre 2026).

| File | App rappresentata |
| --- | --- |
| `sales-hub.yaml` | Sales Hub |
| `customer-service-hub.yaml` | Customer Service Hub |

## Come usarli

Con lo script del plugin (consigliato): `node <plugin-root>/scripts/poc-add-standard.mjs --root <poc-root> --hub sales-hub` (o `poc-init.mjs --hub` per una POC nuova). A mano:

1. Copiare il blocco `navigation:` del file scelto in `config/index.yaml` — come `navigation`
   top-level (l'app rappresenta solo quella hub) oppure dentro `modelDrivenApps[].navigation`
   (selettore fra piu app, vedi `../../references/standard-apps.md`).
2. Cerca-e-sostituisci `{{prefix}}` con il `naming.prefix` del progetto (es. `ava_`).
3. Per ogni voce `pageType: view`, copiare la coppia `<table>_view.yaml` / `<table>_form.yaml`
   corrispondente da `../standard-entities/` in `config/entities/`, rinominando i `logicalName`
   con lo stesso prefisso e con lo stesso schema di naming usato nella navigation.
4. Aggiungere ogni entita copiata all'elenco `entities:` di `config/index.yaml`.

## Cosa non e incluso

Voci che nella sitemap reale non sono una view su tabella (dashboard di sistema, pagine di
analytics incorporate, pagina di ricerca KB) restano dichiarate con `pageType: dashboard` ma non
hanno un asset entita corrispondente: non rappresentano un record Dataverse.

Le tabelle il cui nome dipende dalla versione installata (`forecast`) o la cui distinzione dalla
tabella "piena" va confermata caso per caso (`quickcampaign` vs `campaign`) sono annotate come
commento nel file invece di essere materializzate come asset: verificarle su Microsoft Learn o
sull'ambiente target prima di aggiungerle a un progetto.

## Verifica sempre nel tenant reale del cliente

Questa baseline e lo standard out-of-the-box osservato in un ambiente non personalizzato. Un
tenant reale puo aver rinominato, rimosso o esteso aree/gruppi/voci: vedi il paragrafo dedicato in
`../../references/standard-apps.md`.
