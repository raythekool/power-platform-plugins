## Da requisiti funzionali alla POC

Procedura di dettaglio per la modalita `requirements`, quando non esiste un HTML di riferimento.

## 1. Inventario delle schermate

Leggere la fonte dei requisiti (BBP, backlog, minute di workshop) e produrre una tabella di lavoro prima di scrivere qualsiasi YAML.

| Schermata           | Entita                 | Scopo                                | Attori      | Requisiti      |
| ------------------- | ---------------------- | ------------------------------------ | ----------- | -------------- |
| Dettaglio contratto | `ava_contratto_detail` | Consultare e aggiornare un contratto | Back office | RF-004, RF-012 |

Regole di taglio:

- una schermata per entita principale, piu le eventuali viste lista;
- i requisiti puramente di processo, senza evidenza a video, non generano schermate: annotarli come non rappresentabili;
- sottoporre la tabella all'utente prima di generare i file;
- riportare gli ID concordati in `config/requirements.yaml`: e il manifest canonico usato da validator e report di copertura.

## 2. Da requisito a elemento di configurazione

| Il requisito descrive                     | Layer                                 | Elemento                         |
| ----------------------------------------- | ------------------------------------- | -------------------------------- |
| Un dato visualizzato o inserito           | `config/entities/`                    | `fields[]`                       |
| Un raggruppamento logico di dati          | `config/entities/`                    | `sections[]` / `tabs[]`          |
| Un elenco di record correlati             | `config/data/` + `config/components/` | dataset + `type: subgrid`        |
| Un indicatore o sintesi                   | `config/components/`                  | `type: kpi`                      |
| Uno stato di avanzamento                  | `config/components/`                  | `type: bpf`                      |
| Una cronologia di eventi                  | `config/components/`                  | `type: timeline`                 |
| Un comportamento interattivo non standard | `config/components/`                  | `type: pcf` con `fallback: html` |

Ogni elemento creato riporta nel campo `requirements` gli ID che soddisfa.

## 3. Disegno tabella e campi Dataverse

Prima di creare i file `config/entities/`, trasformare l'inventario delle schermate in un inventario dati. Per ogni concetto business principale, verificare su Microsoft Learn via MCP se esiste una tabella standard D365/Dataverse da riusare (`account`, `contact`, `incident`, `opportunity`, ecc.). Se esiste, recuperare dalla reference i campi standard pertinenti e usarli nei blocchi `dataverse`; se non basta, motivare la tabella o colonna custom in `reuseDecision.reason`.

Ogni file `config/entities/<entita>.yaml` deve contenere:

- `entity.dataverse.table`: tabella reale standard/custom, primary name/id, ownership, auditing/note/attachment quando noto, `sourceUrl` Learn se standard;
- `fields[].dataverse`: colonna reale o proposta, tipo Dataverse, origine standard/custom, required level, form/read flags quando derivano da Learn;
- dettagli per tipo: opzioni `{value, label}` per choice/optionset, `targets` per lookup/customer, `minValue`/`maxValue`/precisione per numeri e currency, `format`/`behavior` per datetime, `maxLength` per testo e memo.

In consegna, distinguere cosa riusa lo standard, cosa estende una tabella standard con colonne custom, e cosa richiede una tabella custom nuova.

## 4. Dati demo

- Dati **sintetici**: nomi, indirizzi, POD, importi e identificativi inventati. Nessun dato reale del cliente, nessun dato personale.
- Volumi da demo: 5-15 record per lista, sufficienti a mostrare scorrimento, filtri e stati diversi.
- Coerenza referenziale: ogni chiave usata da una subgrid o da un binding esiste nel dataset di destinazione.
- Copertura degli stati: includere almeno un record per ciascuno stato o esito che la demo deve mostrare.
- Coerenza temporale: date compatibili tra loro (attivazione prima di cessazione, fattura dopo attivazione).

## 5. Report di copertura

Al termine della generazione produrre un riepilogo confrontando il manifest `config/requirements.yaml` con i riferimenti `requirements` dichiarati nei layer YAML, secondo il contratto di output descritto in `yaml-schema.md`:

| Requisito | Stato               | Dove                                        |
| --------- | ------------------- | ------------------------------------------- |
| RF-004    | Coperto             | `ava_contratto_detail`                      |
| RF-012    | Coperto             | `ava_contratto_detail.ava_data_attivazione` |
| RF-031    | Non rappresentabile | Processo backend, nessuna evidenza a video  |
| RF-045    | Scoperto            | —                                           |

Segnalare esplicitamente all'utente i requisiti in stato `Scoperto`: sono il vero output di controllo della POC, perche indicano aree di analisi ancora aperte.

## 6. Percorso di demo

Definire, insieme all'utente, la sequenza di schermate da mostrare in sessione e verificarla prima della consegna: lista, dettaglio, record correlato, componente dichiarativo. Il percorso guida anche la scelta dei dati demo da rendere piu ricchi.

## 7. Riuso verso l'implementazione

Quando la POC e approvata, i blocchi `dataverse` dichiarati su entita e campi diventano l'input per la creazione dello schema reale. La skill non crea tabelle: consegnare l'elenco a chi gestisce il datamodel Dataverse, includendo URL Learn, decisioni di riuso standard e metadata completi delle colonne.
