---
name: dataverse-poc-code-app
description: "Crea o aggiorna una POC Dataverse code-app. Use when: appType code-app, prototipo code-first React/Vue style, UI custom su Dataverse o connector data, senza site map model-driven, senza PCF e senza generative page."
---

# POC Code App Dataverse

## Scopo

Questa skill genera o aggiorna prototipi `appType: code-app`: una UI custom code-first che rappresenta come potrebbe apparire un'app web pubblicata su Power Platform.

La POC resta HTML/YAML statico: non crea una code app reale, non inizializza Vite, non usa `@microsoft/power-apps`, non pubblica in ambiente. La code app reale si costruisce in stage R con il sotto-agente `poc-code-app`, usando questo prototipo come specifica.

## Procedura

1. Verificare che `config/index.yaml` dichiari `appType: code-app`.
2. Disegnare la navigazione propria dell'app: sidebar, tab, stepper o workflow custom, senza site map Dynamics 365.
3. Usare `dataverse-poc-schema` per dichiarare tabelle/campi Dataverse e distinguere standard, standard esteso e custom.
4. Modellare KPI, timeline, subgrid e stati applicativi come componenti HTML della code app.
5. Non usare `type: pcf` o `type: generative-page`: in una code app la UI custom si scrive direttamente.
6. Validare e generare runtime/statico con la pipeline della POC.

## Regole

- Non copiare `mda-shell.css`/`mda-shell.js`.
- Non simulare PCF o generative page.
- Non introdurre dipendenze reali della code app nel prototipo statico.
