## Gotcha verificati: ambiente, CLI, Dataverse

Letti da tutti i sotto-agenti di stage R. Le generative page sono in [gotcha-genpage.md](gotcha-genpage.md).

### Ambiente e CLI

- In `run_in_terminal` i blocchi PowerShell multi-riga spesso restituiscono solo l'eco del prompt: eseguire comandi su una riga.
- Non filtrare l'output di PAC/PACX con `Select-String`: nasconde gli errori.
- Se `node` non è nel `PATH`: `$env:PATH = "C:\Program Files\nodejs;$env:PATH"`.
- `pacx script all/table`: la sezione entità e la sezione relazioni hanno lo stesso formato di riga; isolare la sezione prima di contare. Verificare sempre statistiche sorprendenti prima di scriverle in un deliverable.

### Dataverse

- I valori delle choice locali su tabelle custom partono da `7139500xx` (dipende dal publisher): leggerli dai metadata, non assumerli.
- PACX crea le choice locali con suffisso `code` (es. `ava_categorycode`): mappare il nome del dataset sul logical name reale.
- Sitemap: i titoli richiedono la LCID della lingua utente (es. `1040`) o compaiono come "Nuova area secondaria"; aggiornare con AppMaker `sitemap_update`, poi `pacx publish all`.

### Strumenti e sotto-agenti

- Nei sotto-agenti gli strumenti MCP "deferred" (es. AppMaker) possono non essere caricabili: in quel caso usare letture CLI (`pac`/`pacx`, ispezione dello zip esportato) oppure restituire `BLOCCATO` indicando la verifica da far eseguire all'agente principale.
- `pac org who` in un terminale di sotto-agente può restituire output parziale con exit code 1: ripetere una volta; i nomi dei profili PAC si leggono con `pac auth list`, quelli PACX con `pacx auth list` (possono essere diversi per lo stesso URL).
