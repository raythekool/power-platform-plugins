# Tutorial: setup (init) di una POC Dataverse

Dalla postazione vuota a un prototipo navigabile in circa dieci minuti, poi (se serve) alla realizzazione in un ambiente DEV. Tutti i comandi sono in PowerShell ma funzionano uguali in bash.

> In breve: verifica i requisiti, installa il plugin, chiedi `init` all'orchestratore (oppure lancia `poc-init.mjs`), apri `dist/<app>.html`.

## 📑 Indice

- [1. Requisiti](#1-requisiti)
- [2. Installare il plugin](#2-installare-il-plugin)
- [3. Verificare la postazione](#3-verificare-la-postazione)
- [4. Init dalla chat](#4-init-dalla-chat)
- [5. Init da terminale](#5-init-da-terminale)
- [6. Cosa e stato creato](#6-cosa-e-stato-creato)
- [7. Dal prototipo di esempio alla tua POC](#7-dal-prototipo-di-esempio-alla-tua-poc)
- [8. Preparare lo stage R (ambiente DEV)](#8-preparare-lo-stage-r-ambiente-dev)
- [9. Problemi frequenti](#9-problemi-frequenti)

## 1. Requisiti

| Strumento | Stage | Perche |
| --- | --- | --- |
| VS Code con GitHub Copilot (o Copilot CLI) | sempre | Esegue l'orchestratore e i sotto-agenti |
| Node.js 18+ e npm | P | Script del plugin, pipeline del prototipo |
| Edge o Chrome | P | Smoke test Playwright (`playwright-core` non scarica browser) |
| Server MCP Microsoft Learn | P (consigliato) | Verifica delle tabelle standard prima di crearne di custom |
| `pac` (Power Platform CLI) e `pacx` | R | Metadata, solution, generative page, PCF |
| .NET SDK | R | Installare `pac` e `pacx` come dotnet tool |
| Server MCP AppMaker e Playwright | R (consigliati) | Form, viste, sitemap; verifiche nel browser |

Lo stage P (prototipo HTML/YAML) non richiede alcun accesso a Dataverse.

## 2. Installare il plugin

**VS Code, marketplace** (consigliato): in `settings.json`

```json
"chat.plugins.enabled": true,
"chat.plugins.marketplaces": ["raythekool/power-platform-plugins"]
```

poi Extensions → cerca `@agentPlugins dataverse-poc` → Install.

**Copilot CLI**:

```bash
copilot plugin marketplace add raythekool/power-platform-plugins
copilot plugin install dataverse-poc@power-platform-plugins
```

**Claude Code**:

```bash
claude plugin marketplace add raythekool/power-platform-plugins
claude plugin install dataverse-poc@power-platform-plugins
```

In Claude Code l'agente **POC Dataverse** si avvia con `/dataverse-poc:poc` e l'init con `/dataverse-poc:dataverse-poc-init`. Il resto del tutorial vale uguale.

**Cartella locale** (sviluppo del plugin): clonare il repository. In VS Code aggiungere in `settings.json` `"chat.pluginLocations": { "<percorso>/plugins/dataverse-poc": true }`; in Claude Code avviare `claude --plugin-dir <percorso>/plugins/dataverse-poc`.

Se il repository di lavoro contiene copie locali degli stessi agenti o skill (`.github/agents/`, `.github/skills/`, `.claude/`), rimuoverle: i nomi duplicati confondono la scelta del sotto-agente.

## 3. Verificare la postazione

Lo script di verifica e in sola lettura: non installa e non modifica nulla.

```powershell
node <plugin-root>/scripts/check-prereqs.mjs            # stage P
node <plugin-root>/scripts/check-prereqs.mjs --stage R  # anche pac, pacx e profili di autenticazione
```

`<plugin-root>` e la cartella del plugin (`plugins/dataverse-poc` nel repository clonato; per un plugin installato da marketplace, la cartella indicata da VS Code in **Chat: Show Plugins**, o in Claude Code quella sotto `~/.claude/plugins/`). In chat basta chiedere "verifica i requisiti": l'orchestratore lancia lo script.

Esempio di output:

```text
Verifica requisiti dataverse-poc — stage P

✔ Node.js 18+                    22.11.0    richiesto
✔ npm                            10.9.0     richiesto
✔ Edge o Chrome (smoke test)                richiesto  C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe
✖ PACX                                      opzionale
⚠ MCP learn                                 opzionale  non trovato nelle configurazioni MCP (Microsoft Learn: riuso tabelle standard)
    → aggiungere il server in mcp.json di VS Code

Requisiti soddisfatti.
```

Ogni riga `✖` obbligatoria riporta il comando di installazione. `--json` produce lo stesso esito in forma strutturata (exit code 0 = requisiti soddisfatti).

## 4. Init dalla chat

1. Apri la chat, scegli l'agente **POC Dataverse**.
2. Scrivi, per esempio: `init: POC gestione ordini per Contoso`.
3. L'orchestratore segue la skill `dataverse-poc-init`: verifica i requisiti e ti fa quattro domande in un colpo solo.

| Domanda | Come rispondere |
| --- | --- |
| `appType` | `model-driven` se la UI nasce da record, viste e moduli (o gli utenti conoscono gia Dynamics 365); `code-app` se serve un'interazione su misura (wizard, configuratore). Nel dubbio, model-driven |
| Prefisso | 2-8 lettere minuscole + `_` (es. `ava_`): finira in tutti i logical name |
| Nome app e cartella | Nome visibile (es. `Order Service`) e cartella (default `POC/OrderService`) |
| Baseline (solo model-driven) | `sales-hub`, `customer-service-hub` o nessuna: la baseline aggiunge site map, viste e moduli standard con dati sintetici |
| Iniziativa e cliente | Per il nome del piano `POC/Piano_<Iniziativa>_<Cliente>.md` |

4. L'orchestratore lancia `poc-init.mjs`, che crea la POC, installa le dipendenze ed esegue `npm run check`. Ricevi cartella, piano ed esito di ogni passo.

Puoi anche invocare direttamente la skill con `/dataverse-poc-init`.

## 5. Init da terminale

Lo stesso risultato senza chat, utile per script o CI:

```powershell
node <plugin-root>/scripts/poc-init.mjs `
  --root POC/OrderService `
  --app-type model-driven `
  --prefix ava_ `
  --name "Order Service" `
  --hub sales-hub `
  --initiative Ordini --client Contoso
```

| Opzione | Effetto |
| --- | --- |
| `--hub sales-hub\|customer-service-hub` | Baseline standard (solo model-driven) |
| `--plan <file>` | Percorso esplicito del piano, in alternativa a `--initiative` + `--client` |
| `--no-sample` | Niente schermate di esempio |
| `--no-install`, `--no-check` | Salta `npm install` o il primo check |
| `--update` | POC esistente: aggiorna solo script e renderer, non `config/` |
| `--force` | Scrive in una cartella non vuota |
| `--json` | Esito strutturato |

La baseline si puo aggiungere anche dopo: `node <plugin-root>/scripts/poc-add-standard.mjs --root POC/OrderService --hub customer-service-hub` (diventa una seconda app nel selettore) oppure `--tables account,contact`.

## 6. Cosa e stato creato

```text
POC/
  Piano_Ordini_Contoso.md      # piano: decisioni, 🎯 Target ambiente, todo, recap
  OrderService/
    config/                    # l'unico posto da modificare: index, requisiti, entita, dati, componenti
    scripts/                   # pipeline dal plugin
    app/                       # renderer generico (+ mda-shell per model-driven)
    dist/ava_order_service.html
    dist/requirements-coverage.md
```

Per vedere il prototipo:

- apri `dist/ava_order_service.html` con un doppio clic (funziona senza server), oppure
- `npm run serve` e vai su `http://127.0.0.1:8080/poc-runtime.html`.

Il controllo completo si ripete con un solo comando:

```powershell
cd POC/OrderService
npm run check
```

```text
OK  validate:config (0 errori, 0 avvisi)
OK  validate:data (0 errori, 0 avvisi)
OK  prepare:runtime (0 errori, 0 avvisi)
OK  build:static (0 errori, 0 avvisi) · copertura {"coperto":3,"scoperto":0,"non-rappresentabile":0,"fuori-scope":0}
OK  test:smoke (0 errori, 0 avvisi)
Check POC OK
```

## 7. Dal prototipo di esempio alla tua POC

Descrivi all'orchestratore requisiti, schermate e percorso demo (o allega il documento dei requisiti). Da qui:

1. `poc-datamodel` decide standard o custom su Microsoft Learn e scrive i contratti `dataverse`.
2. `poc-prototype-builder` sostituisce le schermate di esempio (`Richieste`) con le tue, solo nei YAML.
3. `poc-demo-data` scrive i dataset sintetici.
4. L'orchestratore chiude con `npm run check` e ti mostra copertura e requisiti scoperti.

Nessuno di questi passi scrive HTML o JavaScript: il renderer generico disegna viste, moduli, dashboard, KPI, timeline, BPF, subgrid e i componenti simulati (generative page, PCF) direttamente dai YAML.

## 8. Preparare lo stage R (ambiente DEV)

Lo stage R non si apre mai per inferenza. Prima:

1. `check-prereqs.mjs --stage R` verde.
2. Profili creati da te (le credenziali non passano mai dagli agenti):

   ```powershell
   pac auth create --environment https://<org>.crm4.dynamics.com
   pacx auth create --name <profilo> --conn "AuthType=OAuth;Url=https://<org>.crm4.dynamics.com;LoginPrompt=Auto"
   ```

3. Compila la tabella `🎯 Target ambiente` del piano (URL, profili, solution, prefisso, LCID) e conferma all'orchestratore. La riga `Conferma utente stage R` passa a `sì, <data>`.
4. L'orchestratore esegue `poc-preflight.mjs --plan <piano>`: confronta `pac org who`, `pac auth list` e `pacx auth list` con il piano e si ferma se non coincidono.

Da li in poi i sotto-agenti realizzano metadata, dati demo, UI, generative page e PCF, sempre dentro la solution del piano. L'hook `poc-guard` chiede conferma prima di cancellazioni, cambi di profilo e import di solution. Dopo un export, `poc-solution-zip.mjs` verifica versione, componenti e generative page dello zip.

## 9. Problemi frequenti

| Sintomo | Rimedio |
| --- | --- |
| `npm install` fallisce in `poc-init` | Rete o proxy: rieseguire `npm install` nella cartella POC, poi `npm run check` |
| Smoke test: "Nessun browser disponibile" | Installare Edge o Chrome, oppure `npx playwright install chromium` |
| `node` non trovato in VS Code su Windows | `$env:PATH = "C:\Program Files\nodejs;$env:PATH"` nel terminale |
| Avviso "Contenuto non ancora reso" | Una voce della site map non ha ancora entita o dataset: e atteso per le pagine standard non modellate |
| Preflight `✖ pac org who` | Il profilo attivo punta a un altro ambiente: selezionarlo tu con `pac auth select`, poi rilanciare |
| Agenti o skill duplicati | Rimuovere le copie in `.github/agents/` o `.github/skills/` del repository di lavoro |
