## Gotcha verificati: generative page

Per `poc-genpage`, `poc-deployer` e `poc-tester`. La verifica dello zip esportato e automatizzata da `scripts/poc-solution-zip.mjs` del plugin.

### Generative page nella solution (verificato con PAC 2.12.2)

- Le generative page sono *solution-aware*: tabella `uxagentproject` ("UX Agent Project"), con i file in `uxagentprojectfile`. Il **page id coincide con `uxagentprojectid`**. `pac model genpage upload` non ha un parametro di solution e non aggiunge la pagina alla solution.
- Aggiungerle **una per una per nome di tipo**: `pac solution add-solution-component --solutionUniqueName <sol> --component <pageId> --componentType uxagentproject --AddRequiredComponents true`. I file della pagina entrano come componenti richiesti.
- Non usare codici numerici di tipo: il codice di `uxagentproject` dipende dall'ambiente (si legge da `solutioncomponentdefinition`). Passare dall'app non funziona: `--componentType 80` restituisce "Component Type Id (80) is not known" e `--componentType AppModule` restituisce "Invalid component type 9006".
- Elenco delle pagine in ambiente: `pacx data query -q "<fetch><entity name='uxagentproject'><attribute name='name'/></entity></fetch>"`.
- Verifica dopo l'export: lo zip contiene `uxagentprojects/<pageId>/uxagentproject.xml` e `uxagentprojectfiles/<fileId>/filecontent/` con `page.tsx`, `page.compiled`, `config.json` e `firstPrompt.json`. Le pagine **non** compaiono in `<RootComponents>` di `solution.xml`: per verificarle, controllare le cartelle nello zip.
- Nel target arrivano solo il primo prompt e il codice pubblicato, non la conversazione. Le pagine create in preview vanno aperte una volta nel designer per migrarle.
- Una solution managed non si importa nell'ambiente dove la stessa solution è unmanaged (tipicamente il DEV sorgente): l'import viene rifiutato. Prima di un rilascio managed, verificare che l'URL del profilo di destinazione sia diverso da quello sorgente. Se coincide, fare solo l'export managed e restituire `BLOCCATO` per l'import. Non cancellare la solution unmanaged per "convertirla".
- Alternativa code-first: `pac model genpage download` dall'origine, `upload` nella destinazione, poi `pac model genpage add` per agganciarle alla sitemap. Fonte: [Adding generative pages to solutions](https://learn.microsoft.com/power-apps/maker/model-driven-apps/generative-pages#adding-generative-pages-to-solutions).

### Codice e URL

- `dataApi.queryTable` restituisce i lookup come `/tabella(guid)`, non come GUID: estrarre il GUID prima dei join.
- Spread su iteratori (`[...map.entries()]`) compila in array vuoto (niente `downlevelIteration`): usare array e oggetti semplici.
- `pac model genpage upload --page-id` richiede anche `--prompt`.
- URL diretto: `main.aspx?appid=<app>&pagetype=genux&id=<pageId>`. Se il browser riporta l'elemento "not visible", usare `run_playwright_code` con `dispatchEvent('click')`.
