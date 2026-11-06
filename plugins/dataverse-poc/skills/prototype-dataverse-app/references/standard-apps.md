## Sitemap standard: Sales Hub e Customer Service Hub

Questa pagina fornisce il sitemap **out-of-the-box** delle due app model-driven D365 piu comuni,
verificato interattivamente su un ambiente Dynamics 365 Customer Engagement reale (Sandbox,
settembre 2026), non dedotto solo da documentazione. Usarla come punto di partenza quando la POC
deve rappresentare "una Sales Hub standard" o "una Customer Service Hub standard" invece di una
site map custom disegnata da zero.

Non copiare i logical name della POC verificata (`appid` reali del tenant sorgente): quelli sono
identificativi di un singolo ambiente cliente e non vanno portati in una skill condivisa. Copiare
invece la **struttura** (aree, gruppi, voci, tabella Dataverse dietro ogni voce).

## Asset pronti all'uso (non solo narrativa)

Questa pagina resta la fonte narrativa e la tabella di mapping, ma per l'uso pratico esistono
asset YAML gia scritti da copiare cosi come sono, senza ritrascrivere gli snippet qui sotto a mano:

- `../assets/standard-navigation/sales-hub.yaml` e `customer-service-hub.yaml`: blocco
  `navigation` completo delle due hub, con placeholder `{{prefix}}`.
- `../assets/standard-entities/<table>_view.yaml` e `<table>_form.yaml`: coppia view/form gia
  compilata (`dataverse.table.source: standard`, `sourceUrl`, `reuseDecision`, campi
  rappresentativi) per ogni tabella elencata nelle due baseline. Vedi il README in quella cartella
  per la matrice di copertura completa.

## Come si integra col resto della skill

1. Scegliere `appType: model-driven` (vedi `tipi-di-app.md`).
2. Copiare il blocco `navigation` da `../assets/standard-navigation/<hub>.yaml` in
   `config/index.yaml`, sostituendo `{{prefix}}` con `naming.prefix` del progetto.
3. Per ogni voce con `pageType: view`, copiare la coppia `<table>_view.yaml` / `<table>_form.yaml`
   corrispondente da `../assets/standard-entities/` in `config/entities/`, sostituendo `{{prefix}}`
   e aggiungendo entrambi i `logicalName` a `entities:` in `config/index.yaml`.
4. Questi asset dichiarano gia `entity.dataverse.table` con `source: standard` e `sourceUrl`
   valorizzato: non serve ripetere la ricerca Microsoft Learn per le tabelle gia coperte. Per una
   tabella della baseline non ancora presente in `../assets/standard-entities/` (vedi il README
   della cartella per la copertura), seguire comunque il flusso di ricerca standard descritto in
   `dataverse-schema.md` prima di dichiararla `source: standard`.
5. Se il progetto estende una di queste app con colonne o tabelle proprie, restare in
   `source: standard` sulla tabella e aggiungere solo le colonne aggiuntive come `source: custom`.

## Sales Hub (baseline standard)

Sitemap reale verificata: un'unica area di lavoro (Vendite), sette gruppi.

| Gruppo | Voce sitemap | Tabella Dataverse | Note |
| --- | --- | --- | --- |
| Attivita personali | Dashboard | system dashboard, non una tabella | Dashboard di sistema "Vendite" |
| Attivita personali | Impegni | `activitypointer` (aggregato di `email`, `phonecall`, `appointment`, `task`) | Vista aggregata attivita |
| Clienti | Account | `account` | |
| Clienti | Contatti | `contact` | |
| Vendite | Lead | `lead` | |
| Vendite | Opportunita | `opportunity` | |
| Vendite | Concorrenti | `competitor` | |
| Collaterale | Offerte | `quote` | |
| Collaterale | Ordini | `salesorder` | |
| Collaterale | Fatture | `invoice` | |
| Collaterale | Prodotti | `product` | |
| Collaterale | Documentazione di vendita | `salesliterature` | |
| Marketing | Elenchi marketing | `list` | |
| Marketing | Campagne | `campaign` | |
| Marketing | Mini-campagne | `campaign` (quick campaign) | Verificare `quickcampaign` su Learn se serve distinguerla dalla campagna piena |
| Prestazioni | Obiettivi | `goal` | |
| Prestazioni | Previsioni | forecast (nome tabella dipende dalla versione Forecasting installata) | Verificare su Learn/ambiente target prima di dichiarare `source: standard` |
| Servizio | Casi | `incident` | Presente anche in Sales Hub: cross-sell verso il supporto |

Blocco `navigation` pronto all'uso, identico all'asset `../assets/standard-navigation/sales-hub.yaml`
(sostituire `{{prefix}}` con il prefisso del progetto):

```yaml
navigation:
  showHome: true
  showRecent: true
  showPinned: true
  areas:
    - logicalName: ava_area_vendite
      displayName: Vendite
      groups:
        - displayName: Attivita personali
          items: [ava_sales_dashboard, ava_activity_view]
        - displayName: Clienti
          items: [ava_account_view, ava_contact_view]
        - displayName: Vendite
          items: [ava_lead_view, ava_opportunity_view, ava_competitor_view]
        - displayName: Collaterale
          items: [ava_quote_view, ava_salesorder_view, ava_invoice_view, ava_product_view, ava_salesliterature_view]
        - displayName: Marketing
          items: [ava_list_view, ava_campaign_view]
        - displayName: Prestazioni
          items: [ava_goal_view]
        - displayName: Servizio
          items: [ava_case_view]
```

## Customer Service Hub (baseline standard)

Sitemap reale verificata: un'unica area di lavoro (Servizio), sei gruppi.

| Gruppo | Voce sitemap | Tabella Dataverse | Note |
| --- | --- | --- | --- |
| Attivita personali | Dashboard | system dashboard, non una tabella | Dashboard di sistema "Servizio" |
| Attivita personali | Impegni | `activitypointer` | Vista aggregata attivita |
| Clienti | Account | `account` | |
| Clienti | Contatti | `contact` | |
| Clienti | Profili social | `socialprofile` | |
| Servizio | Casi | `incident` | |
| Servizio | Code | `queue` | |
| Informazioni dettagliate | Analisi cronologica di Customer Service | pagina di analytics incorporata, non una tabella | |
| Informazioni dettagliate | Analisi della Knowledge Base | pagina di analytics incorporata, non una tabella | |
| Knowledge Base | Articoli della Knowledge Base | `knowledgearticle` | |
| Knowledge Base | Ricerca nella Knowledge Base | pagina di ricerca, non una tabella | |
| Cespiti cliente | Avvisi IoT | `msdyn_iotalert` | |
| Cespiti cliente | Cespiti cliente | `msdyn_customerasset` | |
| Modelli | Modelli di messaggio e-mail | `template` | |
| Modelli | Firme e-mail | `emailsignature` | |

Blocco `navigation` pronto all'uso, identico all'asset `../assets/standard-navigation/customer-service-hub.yaml`:

```yaml
navigation:
  showHome: true
  showRecent: true
  showPinned: true
  areas:
    - logicalName: ava_area_servizio
      displayName: Servizio
      groups:
        - displayName: Attivita personali
          items: [ava_service_dashboard, ava_activity_view]
        - displayName: Clienti
          items: [ava_account_view, ava_contact_view, ava_socialprofile_view]
        - displayName: Servizio
          items: [ava_case_view, ava_queue_view]
        - displayName: Informazioni dettagliate
          items: [ava_service_analytics, ava_kb_analytics]
        - displayName: Knowledge Base
          items: [ava_knowledgearticle_view]
        - displayName: Cespiti cliente
          items: [ava_iotalert_view, ava_customerasset_view]
        - displayName: Modelli
          items: [ava_template_view, ava_emailsignature_view]
```

## Tabelle condivise fra le due app

`account`, `contact` e `incident` compaiono in entrambe le baseline: se una POC rappresenta sia
Sales sia Customer Service (o un selettore fra le due app, vedi sotto), dichiarare l'entita una
sola volta e riusarla nelle due site map, non duplicarla.

## Selettore di app model-driven

Il renderer della shell (`assets/mda-shell.js`, funzione `renderHeader`) supporta un menu di
selezione fra piu app model-driven tramite `modelDrivenApps` in `config/index.yaml` (vedi
`yaml-schema.md`). Per rappresentare in demo la scelta reale fra Sales Hub e Customer Service Hub:

```yaml
modelDrivenApps:
  - logicalName: ava_sales_hub
    displayName: Sales Hub
  - logicalName: ava_customer_service_hub
    displayName: Customer Service Hub
```

Il cambio app nel prototipo aggiorna solo il nome mostrato nell'header; se la POC deve anche
cambiare la site map quando si seleziona un'altra app (comportamento reale di Dynamics 365, dove
ogni app ha la propria site map indipendente), va implementato esplicitamente nel renderer: non e
un comportamento di default della shell condivisa, va dichiarato come requisito del progetto.

## Cosa verificare sempre nell'ambiente reale del cliente

Questa baseline e lo standard out-of-the-box osservato in un ambiente non personalizzato. Prima di
usarla come specifica definitiva per un cliente, verificare che il tenant target non abbia:

- rinominato aree, gruppi o voci (le app model-driven permettono di rinominare le tabelle);
- rimosso gruppi o voci per sicurezza o per un app designer personalizzato;
- aggiunto colonne, tabelle o aree custom sopra la baseline standard.

Se disponibile, preferire sempre un export del sitemap reale del cliente (screenshot,
sopralluogo autenticato o metadata browser) rispetto a questa baseline generica.
