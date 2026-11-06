## Scaffold della POC

Lo scaffold non si scrive a mano: lo crea `scripts/poc-init.mjs` del plugin copiando il template `assets/poc-template/` (script della pipeline e renderer generico), lo smoke test e, solo per `appType: model-driven`, `assets/mda-shell.*`.

```powershell
node <plugin-root>/scripts/poc-init.mjs --root POC/OrderService --app-type model-driven --prefix ava_ --name "Order Service" --initiative Ordini --client Contoso
```

| Opzione | Effetto |
| --- | --- |
| `--app-type` | Obbligatoria, `model-driven`, `code-app` o `power-pages`: va chiesta all'utente |
| `--prefix`, `--name` | Obbligatorie: prefisso dei logical name e nome visibile dell'app |
| `--hub sales-hub\|customer-service-hub` | Solo model-driven: aggiunge la baseline standard con dati sintetici (`poc-add-standard.mjs`) |
| `--initiative` + `--client`, oppure `--plan <file>` | Crea il documento di piano con la tabella `🎯 Target ambiente` |
| `--no-sample` | Niente schermate di esempio (`Richieste`) |
| `--no-install`, `--no-check` | Salta `npm install` o il primo `npm run check` |
| `--update` | POC esistente: aggiorna solo script, renderer e script npm |
| `--force` | Scrive in una cartella non vuota |

## Struttura generata

```text
<poc-root>/
  config/
    index.yaml            # appType, mode, naming, application, entities, navigation, demoPath
    requirements.yaml     # manifest canonico dei requisiti
    entities/             # una schermata per file
    data/                 # index.yaml, _schema.yaml (relazioni), dataset sintetici
    components/           # componenti locali; _definitions/ per i riusabili
  scripts/                # pipeline (dal plugin, non modificare)
  app/                    # poc-app.js/.css (+ mda-shell.* se model-driven); custom.css/.js opzionali
  poc-runtime.html        # generato
  dist/                   # generato: <app>.html autosufficiente, requirements-coverage.md/.json
  package.json
  README.md
```

## Script della pipeline

| Script | Responsabilita |
| --- | --- |
| `validate-poc-config.mjs` | Regole di `yaml-schema.md`, `tipi-di-app.md`, `dynamics-365-chrome.md`: appType, prefisso, unicita dei logical name, displayName, enum, contratti Dataverse, navigazione, definizioni e istanze, riferimenti ai requisiti |
| `validate-poc-data.mjs` | Manifest dei dataset, chiavi, integrita referenziale (`_schema.yaml` `relationships` e `relations` del dataset), euristiche anti dati reali (email non demo, IBAN, codici fiscali) |
| `prepare-runtime-poc.mjs` | `poc-runtime.html`, `config/poc-config.js`, `config/data/poc-data.js` |
| `build-static-poc.mjs` | `dist/<app>.html` con YAML, dati, CSS e JS incorporati; report di copertura |
| `check-poc.mjs` | Tutti i passi sopra + smoke test, con un riepilogo JSON (`--json`) |
| `smoke-test.mjs` | Playwright su `dist/*.html`: app, aree, persone (power-pages), schermate, apertura record, simulazioni, errori console |
| `serve.mjs` | Server statico senza dipendenze per il runtime |

Il renderer `app/poc-app.js` disegna viste, moduli, dashboard e componenti (`kpi`, `subgrid`, `timeline`, `bpf`, `generative-page`, `pcf`) dai soli YAML: le chiavi che legge sono in `yaml-schema.md`. Per un componente che il renderer non copre, registrarlo in `app/custom.js`:

```js
PocApp.registerComponent('kpi', function (component, ctx, h) {
    return h.tiles([{ label: 'Esempio', value: h.scoped(component.bindings, ctx).length }]);
});
```

Con `appType: power-pages`, `node <plugin-root>/scripts/poc-spa-scaffold.mjs --root <poc-root> [--build]` genera dagli stessi YAML il progetto React + Vite del sito in `realization/power-pages/`. A ogni esecuzione rigenera `src/generated/` e `power-pages/`; il codice del progetto lo crea solo se manca.

`legacy-html`: gli script di estrazione (`extract-poc-config.mjs`, `extract-poc-data.mjs`, parser AST) non fanno parte del template e vanno scritti per la singola POC seguendo `procedure.md`.

## Verifica dello scaffold

`poc-init.mjs` esegue gia `npm install` e `npm run check`; l'esito e nel suo output (`--json`). A mano:

1. `npm run check` termina con "Check POC OK".
2. `dist/<app>.html` si apre dal filesystem senza server.
