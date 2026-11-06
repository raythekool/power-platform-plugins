## Scaffold della POC in un contesto nuovo

Come creare struttura, tooling e validator quando `<poc-root>` non contiene ancora nulla. In questo repository non esiste una POC YAML di riferimento gia implementata: la POC in `Envision/POC` e solo una sorgente legacy (HTML monolitici e immagini) utilizzabile come input della modalita `legacy-html`, non un modello di script da copiare. Gli script della pipeline vanno quindi implementati seguendo le responsabilita descritte sotto, oppure copiati da una POC YAML gia realizzata in un altro contesto, se disponibile.

## Prerequisiti

- Node.js sulla postazione.
- Nessuna dipendenza Power Platform: la POC e un artefatto statico, non una solution.

## Passi

1. Creare la struttura minima:

```text
<poc-root>/
  config/
    index.yaml
    requirements.yaml
    entities/
    data/
    components/
  scripts/
  app/
  dist/
  package.json
  README.md
```

2. Implementare gli script della pipeline seguendo le responsabilita nella tabella sotto; se e disponibile una POC YAML gia realizzata in un altro contesto, copiarli da li e adattarli.
3. Scrivere `config/index.yaml` con `mode`, `naming.prefix` e `application` prima di qualsiasi altro file, e `config/requirements.yaml` con il manifest dei requisiti in scope.
4. Se la POC deve somigliare a un'app model-driven (Dynamics 365 CE), copiare `assets/mda-shell.css` e `assets/mda-shell.js` dalla skill (`prototype-dataverse-app/assets/`) in `app/`, invece di scrivere la shell di navigazione da zero. Vedi `references/dynamics-365-chrome.md`.
5. Aggiornare il `README.md` della POC con comandi, convenzioni e modalita di distribuzione.

## Script della pipeline

| Script                    | Responsabilita                                                                                        |
| ------------------------- | ----------------------------------------------------------------------------------------------------- |
| `validate-poc-config.mjs` | Valida i YAML UI: prefisso, unicita globale dei `logicalName`, `displayName`, enum `control`, chiavi obbligatorie per modalita, riferimenti `requirements` risolti sul manifest. |
| `validate-poc-data.mjs`   | Valida manifest dataset, chiavi e integrita referenziale.                                             |
| `prepare-runtime-poc.mjs` | Genera `poc-runtime.html` e il bootstrap `config/data/poc-data.js`.                                   |
| `build-static-poc.mjs`    | Genera l'HTML autosufficiente in `dist/`, con YAML incorporati.                                       |
| `extract-poc-config.mjs`  | Solo modalita `legacy-html`: estrae i YAML UI dall'HTML.                                              |
| `extract-poc-data.mjs`    | Solo modalita `legacy-html`: estrae i dataset con parser AST JavaScript.                              |
| `smoke-test.mjs`          | Smoke test Playwright su `dist/*.html`: ogni app e area, apertura di un record, contrassegni di simulazione, errori console. Copiato da `assets/smoke-test.mjs`. |

## Script npm

```json
{
  "scripts": {
    "validate:config": "node scripts/validate-poc-config.mjs",
    "validate:data": "node scripts/validate-poc-data.mjs",
    "prepare:runtime": "node scripts/prepare-runtime-poc.mjs",
    "build:static": "node scripts/build-static-poc.mjs",
    "build": "npm run validate:config && npm run validate:data && npm run prepare:runtime && npm run build:static",
    "test:smoke": "node scripts/smoke-test.mjs",
    "serve": "http-server -c-1 -p 8080"
  }
}
```

Per lo smoke test: `npm install --save-dev playwright-core` (usa Edge o Chrome già installati, senza scaricare browser). Lo script presuppone la convenzione dei renderer della skill: voci di navigazione `[data-nav]`, righe `tr[data-open]`, menu `[data-app-menu]`/`[data-area-menu]`, tab di modulo `[data-form-tab]`, riquadri `.sim-frame`.

In modalita `legacy-html` aggiungere `extract:config`, `extract:data` e `extract:all`. Non aggiungere script di estrazione a una POC nata da requisiti: sovrascriverebbero i YAML con contenuto derivato dall'HTML generato.

## Parametrizzazione del prefisso

I validator non devono contenere il prefisso cablato. Leggerlo da `config/index.yaml`:

```js
const { naming } = load(readFileSync(join(pocDirectory, 'config', 'index.yaml'), 'utf8'));
const prefix = naming?.prefix ?? 'ava_';
const logicalNamePattern = new RegExp(`^${prefix}[a-z0-9_]+$`);
```

## Verifica dello scaffold

1. `npm install` completa senza errori.
2. `npm run validate:config` e `npm run validate:data` girano su una configurazione minima di una sola entita.
3. `npm run build` produce runtime e statico.
4. Lo statico in `dist/` si apre dal filesystem senza server e senza richiedere i YAML.
5. `npm run test:smoke` termina con "Smoke test OK".
