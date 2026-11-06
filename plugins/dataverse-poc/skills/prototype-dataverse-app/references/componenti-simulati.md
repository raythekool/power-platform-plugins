## Simulare componenti Power Platform nel prototipo

Riferimento per rendere in HTML l'aspetto di una generative page o di un controllo PCF. Nulla di quanto descritto qui produce codice Power Platform reale: l'output resta `poc-runtime.html` e `dist/*.html`.

Entrambi i tipi sono ammessi **solo con `appType: model-driven`**: sono componenti che vivono dentro un'app model-driven. Una code app non li ospita, perche la sua UI e gia scritta a mano. Vedi `tipi-di-app.md`.

## Blocco `simulation`

```yaml
version: 1
logicalName: ava_contratto_riepilogo_ai
displayName: Riepilogo contratto
type: generative-page # kpi | bpf | timeline | subgrid | generative-page | pcf
requirements: [RF-020]
simulation:
  fidelity: lookalike # wireframe | lookalike
  hostApp: Order Service # nome mostrato nella cornice, non un riferimento reale
  note: Simulazione a scopo dimostrativo, i contenuti non provengono da Dataverse
bindings:
  dataset: ava_contratti
  fields: [ava_contratto_id, ava_data_attivazione]
fallback: html
```

Chiavi:

| Chiave                | Uso                                                                     |
| --------------------- | ----------------------------------------------------------------------- |
| `simulation.fidelity` | `wireframe` per validare struttura, `lookalike` per una demo credibile  |
| `simulation.hostApp`  | Etichetta mostrata nella cornice; e testo, non un collegamento a un'app |
| `simulation.note`     | Frase mostrata accanto al contrassegno di simulazione                   |
| `bindings`            | Dataset e campi sintetici da cui la simulazione prende i contenuti      |
| `fallback`            | Resa usata dal renderer; nel prototipo vale sempre `html`               |

L'esempio sopra e nella forma locale, adatta a un componente che compare su una sola schermata. Per un componente riusato su piu schermate il blocco `simulation` sta sulla definizione, mentre ogni istanza fornisce solo i propri `args`: in questo modo fedelta, contrassegno e nota restano identici ovunque il componente compaia. Le due forme sono descritte in `yaml-schema.md`.

## Contrassegno di simulazione

Ogni componente con `type` fra `generative-page` e `pcf` viene disegnato con un contrassegno visibile, ad esempio un badge "Simulazione" nell'angolo del riquadro, piu il testo di `simulation.note`.

Non e un vezzo grafico: senza il contrassegno, in una demo il committente puo credere che la funzionalita esista gia, e si generano aspettative di stima e di data che il prototipo non sostiene. Il contrassegno si rimuove solo quando il componente viene davvero implementato, e a quel punto non si tratta piu di una simulazione.

## Simulare una `generative-page`

Cosa riprodurre:

- cornice della pagina come appare dentro un'app model-driven: intestazione con titolo della pagina, eventuale breadcrumb, barra comandi;
- corpo strutturato in sezioni, come dichiarato nel YAML dell'entita associata;
- tipografia e spaziature vicine a Fluent quando `fidelity: lookalike`;
- eventuali aree generate dall'AI rese come blocchi di testo statico, con il contrassegno di simulazione.

Cosa non fare:

- non imitare la chrome completa dell'app model-driven (sitemap, ricerca globale, barra utente) se il prototipo non la mostra gia altrove: distoglie dalla parte da validare;
- non generare `.tsx`, non invocare la skill `genpage`, non richiedere un ambiente.

## Prototipare una code app

Una code app **non e un componente simulato**: e un `appType`, cioe il prototipo stesso. Non esiste un `type: code-app` da innestare in un'altra app.

Con `appType: code-app` le schermate della POC sono le schermate dell'app, disegnate direttamente:

- shell applicativa autonoma: barra superiore con nome app, navigazione laterale o a tab, area contenuto;
- niente `assets/mda-shell.*`: imporrebbero una site map e delle schede di sessione che l'app reale non avra;
- niente PCF e niente generative page al suo interno: la UI custom si scrive direttamente come schermata;
- stato di caricamento o stato vuoto solo se sono parte del messaggio da dimostrare;
- il banner di prototipo resta l'avviso principale, perche qui non ci sono componenti simulati a portare il proprio badge.

Cosa non fare in ogni caso:

- niente scaffolding Vite o React, niente `create-code-app`, niente connessioni o connection id;
- non simulare autenticazione o profili utente reali: se serve mostrare un utente, usare un nome sintetico.

## Simulare un `pcf`

Cosa riprodurre:

- il riquadro del controllo nella posizione esatta del campo o della subgrid che sostituira, cosi la demo mostra l'impatto reale sul layout;
- il comportamento apparente principale: ad esempio uno slider, un selettore grafico, una mappa statica, un indicatore colorato;
- il contratto dichiarato: `pcf.logicalName`, `pcf.controlName` ed `enabled: false` restano nel YAML come intento implementativo.

Cosa non fare:

- niente `pac pcf init`, niente `ControlManifest`, niente `npm run build` o test harness;
- non impostare `pcf.enabled: true` nel prototipo: quel flag indica un bundle reale integrato, che qui non esiste.

## Livelli di fedelta

| Livello     | Quando usarlo                                    | Cosa comporta                                                   |
| ----------- | ------------------------------------------------ | --------------------------------------------------------------- |
| `wireframe` | Validazione con analisti, prime iterazioni       | Contorni, etichette e contenuti reali; nessuna cura estetica    |
| `lookalike` | Demo a stakeholder, approvazione della direzione | Colori, spaziature e tipografia coerenti con il prodotto atteso |

Partire sempre da `wireframe`: alzare la fedelta costa tempo e sposta la discussione dal contenuto alla grafica. Passare a `lookalike` solo quando i contenuti sono approvati.

## Limiti da dichiarare all'utente

- La simulazione non prova la fattibilita tecnica: mostra l'aspetto, non le prestazioni, i permessi o i limiti della piattaforma.
- I dati sono sintetici; volumi, tempi di risposta e casi limite reali non sono rappresentati.
- Un componente simulato non riduce l'effort di implementazione: lo rende solo piu preciso da stimare.

## Se il prototipo viene approvato

I contratti dichiarati qui diventano la specifica per l'implementazione vera, affidata alle skill dedicate: `genpage` per le generative page, `create-code-app`, `add-dataverse` e `deploy` per le code app, PAC CLI per il PCF. Questa skill si ferma prima, e continua a mantenere il prototipo come riferimento visivo.
