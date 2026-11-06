## Tipi di app su Dataverse e scelta del target

Questa pagina definisce il **passo 0** della skill: prima di scrivere qualunque YAML bisogna decidere
**che tipo di app** il prototipo rappresenta. Tutte le altre scelte (site map, `pageType`, tipi di
componente ammessi, asset da copiare) dipendono da questa.

## Tassonomia verificata

Fonte: documentazione Microsoft Learn (link in fondo). Distinzione fondamentale:

- **Tipo di app** — un'applicazione completa, che si crea e si pubblica come tale.
- **Tipo di pagina / componente** — vive *dentro* un'app, non esiste da solo.

### Tipi di app

| Tipo | Cosa e | Stato nella skill |
| --- | --- | --- |
| **Model-driven app** | App generata dal modello dati Dataverse: site map, viste, moduli, dashboard, Unified Interface. Base anche di tutte le app Dynamics 365 CE. | `appType: model-driven` |
| **Code app** | App web custom scritta in un IDE code-first (React, Vue…), con controllo totale della UI, pubblicata e ospitata su Power Platform. Dati via client library `@microsoft/power-apps`. | `appType: code-app` |
| **Canvas app** | App low-code disegnata a mano libera in Power Apps Studio con Power Fx. | **Fuori scopo** per decisione di progetto |
| **Power Pages** | Sito web esterno su Dataverse. | Fuori scopo: esistono skill dedicate |

Una **generative page non e un tipo di app**: e un tipo di pagina che si aggiunge a una model-driven
app (App designer → *Add page* → *Generative page*). Non esiste una "generative page app".

### Tipi di pagina di una model-driven app

Dall'App designer, *Add page* offre: **Dataverse table** (che genera la coppia vista + modulo),
**Dashboard**, **Custom page** (basata su canvas), **Generative page**, **Web resource**,
**Navigation link / URL**.

Nella skill questi diventano i valori di `pageType`: `view`, `form`, `dashboard`, `custom-page`.
Le generative page sono modellate come componenti (`type: generative-page`) montati su una
schermata, perche nel prototipo interessa il loro *contenuto*, non la voce di site map.

### Componenti innestabili

| Componente | Model-driven app | Code app |
| --- | --- | --- |
| **PCF / code component** | Si — su colonne, griglie e subgrid | **No** |
| **Generative page** | Si — come pagina o innestata in un modulo | **No** |
| **Custom page (canvas)** | Si | No |

Il **no** per la code app non e una limitazione della piattaforma da aggirare: e una conseguenza
della sua natura. Una code app e gia React scritto a mano; un PCF serve a iniettare codice custom
dentro una UI che *non* controlli, e in una code app quella UI la controlli gia tutta. Lo stesso
vale per la generative page: genera React da innestare in una model-driven app, mentre in una code
app quel React lo scrivi direttamente.

Il PCF e supportato anche in canvas app e Power Pages, entrambe fuori dallo scopo di questa skill.

## Come scegliere: model-driven o code app

Porre la domanda all'utente **prima di creare lo scaffold**, non dedurla. Se la risposta non e
ovvia, usare questi discriminanti.

| Segnale nei requisiti | Indica |
| --- | --- |
| Lavoro guidato su record: liste, moduli, assegnazioni, code, SLA, BPF | Model-driven |
| Gli utenti conoscono gia Dynamics 365 e ci si aspetta continuita | Model-driven |
| Servono sicurezza per riga/colonna, audit e ALM Dataverse out-of-the-box | Model-driven |
| Il dato vive tutto in Dataverse | Model-driven |
| UI molto specifica, non riconducibile a vista + modulo | Code app |
| Percorso guidato molto disegnato (configuratore, wizard, checkout) | Code app |
| Serve una libreria front-end o un design system del cliente | Code app |
| L'app aggrega piu sorgenti via connettori, con Dataverse come una fra tante | Code app |

Criterio di sintesi: **se la UI e in larga parte deducibile dal modello dati, e una model-driven
app**; se il valore sta in una interazione disegnata su misura che il modello dati non descrive,
e una code app. In caso di dubbio partire da model-driven: e piu economica da prototipare e da
mantenere, e ammette generative page e PCF per i punti in cui serve UI custom.

Una scelta ibrida legittima: model-driven come contenitore, piu una generative page o un PCF nei
2-3 punti che richiedono una UI non standard. Va dichiarata come tale, non lasciata implicita.

## Conseguenze sul prototipo

Quello che cambia concretamente dopo la scelta:

| Aspetto | `appType: model-driven` | `appType: code-app` |
| --- | --- | --- |
| `pageType` sulle entita | Obbligatorio | Non usato |
| Blocco `navigation` (site map/aree/gruppi) | Previsto | Non usato: la navigazione e quella disegnata per l'app |
| Asset `assets/mda-shell.*` | Da copiare in `<poc-root>/app/` | **Non** usarli: imporrebbero una chrome che l'app non ha |
| Riferimento di stile | `dynamics-365-chrome.md` (Fluent + Unified Interface) | Fluent o il design system del cliente, senza chrome D365 |
| `type: pcf` nei componenti | Ammesso | **Vietato dal validator** |
| `type: generative-page` nei componenti | Ammesso | **Vietato dal validator** |
| `type` `kpi`, `bpf`, `timeline`, `subgrid` | Ammesso | Ammesso |
| Skill di implementazione a valle | `genpage`, PAC CLI per il PCF, PACX per lo schema | `create-code-app`, `add-dataverse`, `deploy` |

Il tipo si dichiara in `config/index.yaml`:

```yaml
appType: model-driven     # model-driven | code-app
```

Non esiste un default implicito: se la chiave manca, chiedere all'utente invece di assumere.
Cambiare `appType` a POC avviata non e una modifica di configurazione ma una riscrittura del
prototipo: segnalarlo esplicitamente prima di procedere.

## Regole di validazione da imporre

- `appType` presente e appartenente a `{model-driven, code-app}`.
- Con `appType: code-app`, nessun componente puo avere `type: pcf` o `type: generative-page`, e le
  entita non devono dichiarare `pageType` ne comparire in un blocco `navigation`.
- Con `appType: model-driven`, valgono tutte le regole di `dynamics-365-chrome.md` (un `form` non
  compare mai in `navigation`, ogni `view` ha un `targetForm`, ecc.).

## Fonti

- [Overview of creating apps in Power Apps](https://learn.microsoft.com/power-apps/maker/) — canvas e model-driven come i due tipi di app Power Apps.
- [What are model-driven apps in Power Apps?](https://learn.microsoft.com/power-apps/maker/model-driven-apps/model-driven-app-overview) — dati solo Dataverse, UI determinata dai componenti, responsive e accessibile per costruzione.
- [Power Apps code apps overview](https://learn.microsoft.com/power-apps/developer/code-apps/overview) — app web code-first su framework a scelta, con controllo totale di UI e logica, ospitate su Power Platform.
- [How to: connect your code app to Dataverse](https://learn.microsoft.com/power-apps/developer/code-apps/how-to/connect-to-dataverse) — scenari supportati e non supportati verso Dataverse.
- [Generate a page using natural language](https://learn.microsoft.com/power-apps/maker/model-driven-apps/generative-pages) — le generative page si creano da *Add page* dentro una model-driven app e generano codice React.
- [Work with model-driven app pages](https://learn.microsoft.com/power-apps/maker/model-driven-apps/create-remove-pages) — elenco completo dei tipi di pagina.
- [Code components](https://learn.microsoft.com/power-apps/developer/component-framework/custom-controls-overview) — i code component si aggiungono a model-driven e canvas app.
- [Use code components in Power Pages](https://learn.microsoft.com/power-pages/configure/component-framework) — terzo host supportato, fuori scopo qui.
