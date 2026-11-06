## Disegno tabelle e colonne Dataverse

Questa pagina definisce come trasformare le schermate della POC in una specifica riusabile per l'implementazione Dataverse reale. La skill non crea tabelle o colonne, ma i file in `config/entities/` devono contenere abbastanza metadati da guidare chi usera PACX, Power Apps maker portal o una skill Dataverse dedicata.

## Prima regola: riusare prima lo standard

Prima di proporre una tabella custom o una colonna custom, controllare Microsoft Learn tramite MCP per capire se esiste gia una tabella di sistema Dataverse o Dynamics 365 adatta al concetto richiesto. Cercare prima nelle entity reference e nelle pagine funzionali, usando il nome business e i sinonimi inglesi.

Esempi di ricerca obbligatoria:

| Concetto | Cercare prima |
| --- | --- |
| Azienda, cliente B2B, ragione sociale | `account` |
| Persona, referente, contatto cliente | `contact` |
| Ticket, reclamo, richiesta Customer Service | `incident` |
| Opportunita commerciale | `opportunity` |
| Lead / prospect | `lead` |
| Prodotto o catalogo | `product` |
| Attivita, email, appuntamento, telefonata | activity tables (`email`, `appointment`, `phonecall`, `task`) |

Se una tabella standard copre il concetto, usarla nel blocco `dataverse.table.source: standard` e recuperare da Learn i campi standard pertinenti. Non ricreare `ava_account`, `ava_contact`, `ava_case` o equivalenti quando `account`, `contact` o `incident` sono adatti: Microsoft Learn raccomanda di usare tabelle, colonne e relazioni standard quando hanno senso, per non rompere compatibilita con soluzioni e app first-party.

Creare una tabella custom solo quando:

- il concetto non corrisponde allo scopo dichiarato di una tabella standard;
- servono record che non devono partecipare ai comportamenti standard D365 di quella tabella;
- l'uso dello standard introdurrebbe campi, processi o sicurezza fuorvianti;
- la fonte Learn o la metadata reference non mostra una tabella standard appropriata.

Quando si sceglie custom, documentare `reuseDecision.reason` con una frase esplicita.

## Contratto tabella in `config/entities/`

Ogni file in `config/entities/` rappresenta una schermata, ma deve dichiarare anche la tabella Dataverse principale che quella schermata legge o modifica. La tabella si dichiara sotto `entity.dataverse.table`.

```yaml
entity:
  logicalName: ava_case_detail
  displayName: Caso
  pageType: form
  dataverse:
    table:
      source: standard              # standard | custom
      logicalName: incident         # tabella reale Dataverse/D365
      schemaName: Incident
      displayName: Case
      displayCollectionName: Cases
      primaryIdAttribute: incidentid
      primaryNameAttribute: title
      ownershipType: UserOwned      # UserOwned | OrganizationOwned, se noto
      activityType: false
      notesEnabled: true
      attachmentsEnabled: true
      auditEnabled: true
      duplicateDetectionEnabled: false
      changeTrackingEnabled: false
      sourceUrl: https://learn.microsoft.com/dynamics365/developer/reference/entities/incident
      reuseDecision:
        outcome: reuse-standard
        reason: Il requisito descrive ticket/reclami Customer Service; la tabella D365 Case (`incident`) copre gia cliente, stato, SLA e relazioni service.
```

Per una tabella custom:

```yaml
entity:
  logicalName: ava_quality_claim_detail
  displayName: Reclamo qualita
  dataverse:
    table:
      source: custom
      logicalName: ava_qualityclaim
      schemaName: ava_QualityClaim
      displayName: Reclamo qualita
      displayCollectionName: Reclami qualita
      primaryIdAttribute: ava_qualityclaimid
      primaryNameAttribute: ava_name
      ownershipType: UserOwned
      activityType: false
      notesEnabled: true
      attachmentsEnabled: true
      auditEnabled: true
      sourceUrl: null
      reuseDecision:
        outcome: create-custom
        checkedStandardTables: [incident, msdyn_iotalert, qualityorder]
        reason: Il requisito riguarda non conformita tecniche di lotto e campionature, non un ticket Customer Service gestito da SLA.
```

`logicalName` nella POC e `dataverse.table.logicalName` possono divergere: il primo identifica la schermata del prototipo, il secondo identifica la tabella reale da creare o riusare.

Per dashboard o pagine di governo che non hanno una sola tabella principale ma aggregano piu tabelle di configurazione, usare `entity.dataverse.tables` come lista degli stessi contratti tabella:

```yaml
entity:
  logicalName: ava_governance_dashboard
  displayName: Parametri di governo
  dataverse:
    tables:
      - source: custom
        logicalName: ava_aisettings
        schemaName: ava_AISettings
        primaryNameAttribute: ava_name
        columns: []
      - source: custom
        logicalName: ava_slasettings
        schemaName: ava_SLASettings
        primaryNameAttribute: ava_name
        columns: []
```

Non usare `tables` per evitare una decisione: se una form o una vista lavora su una tabella principale, dichiarare `table` al singolare.

## Contratto colonna in `fields[]`

Ogni campo visibile che corrisponde a una colonna reale deve dichiarare il blocco `dataverse`. Il livello minimo e: tabella, colonna, tipo, obbligatorieta e origine.

```yaml
fields:
  - logicalName: ava_customer
    displayName: Cliente
    control: lookup
    required: true
    dataverse:
      table: incident
      column: customerid
      source: standard              # standard | custom
      sourceUrl: https://learn.microsoft.com/dynamics365/developer/reference/entities/incident#customerid
      type: customer
      requiredLevel: SystemRequired # None | ApplicationRequired | SystemRequired | Recommended
      isValidForForm: true
      isValidForRead: true
      targets: [account, contact]
```

Per colonne custom, dichiarare anche i dettagli di creazione:

```yaml
fields:
  - logicalName: ava_priorita_logistica
    displayName: Priorita logistica
    control: choice
    dataverse:
      table: incident
      column: ava_logisticspriority
      source: custom
      schemaName: ava_LogisticsPriority
      type: choice
      requiredLevel: ApplicationRequired
      choice:
        scope: local                # local | global
        globalChoiceName: null
        defaultValue: 20
        options:
          - value: 10
            label: Bassa
          - value: 20
            label: Media
          - value: 30
            label: Alta
```

## Dettagli per tipo colonna

Compilare le proprieta applicabili al tipo. Non lasciare un generico `type: text` quando la piattaforma richiede vincoli precisi.

| Tipo Dataverse | Dettagli richiesti nel blocco `dataverse` |
| --- | --- |
| `string` | `format` (`Text`, `Email`, `Url`, `Phone`, `TickerSymbol`, `TextArea`), `maxLength` |
| `memo` | `maxLength`, eventuale `format: TextArea` |
| `choice` | `choice.scope`, `choice.options[].value`, `choice.options[].label`, `defaultValue`; usare scelta locale se usata una sola volta, globale se riusata |
| `multiselect` | Come `choice`, ma ammette piu valori |
| `boolean` | `boolean.trueLabel`, `boolean.falseLabel`, `defaultValue` |
| `whole` | `format` (`None`, `Duration`, `Timezone`, `Language`), `minValue`, `maxValue` |
| `decimal` | `precision` fino a 10, `minValue`, `maxValue` |
| `float` | `precision` fino a 5, `minValue`, `maxValue` |
| `money` | `precisionSource` o `precision`, `minValue`, `maxValue` |
| `datetime` | `format` (`DateOnly`, `DateAndTime`), `behavior` (`UserLocal`, `DateOnly`, `TimeZoneIndependent`) |
| `lookup` | `targets`, relazione attesa se nota |
| `customer` | `targets: [account, contact]` salvo caso documentato diverso |
| `file` | `maxSizeInKB`, `allowedExtensions` se rilevante |
| `image` | ricordare che Dataverse consente una singola immagine primaria per tabella e che il nome fisico puo essere vincolato dalla piattaforma |

Le option set devono includere **sia indice/valore sia label**. Se il valore deriva da una tabella standard, copiarlo dalla entity reference Learn; non rinumerare opzioni standard per farle sembrare piu ordinate.

## Standard table mapping

Quando si decide di usare una tabella standard, i campi della POC devono riusare le colonne standard prima di crearne di nuove. Esempi ricorrenti:

| Requisito POC | Tabella standard | Colonna standard da valutare |
| --- | --- | --- |
| Cliente del caso | `incident` | `customerid` (`Customer`, target `account`, `contact`) |
| Titolo / oggetto del caso | `incident` | `title` |
| Soddisfazione cliente | `incident` | `customersatisfactioncode` con opzioni standard |
| Data risoluzione caso | `incident` | `deactivatedon`, `DateTime`, `UserLocal`, `DateAndTime` |
| Azienda cliente | `account` | `name`, `telephone1`, `websiteurl`, `primarycontactid` |
| Referente cliente | `contact` | `firstname`, `lastname`, `emailaddress1`, `parentcustomerid` |
| Opportunita | `opportunity` | `name`, `parentaccountid`, `estimatedvalue`, `estimatedclosedate` |

Se un requisito richiede una colonna custom su una tabella standard, dichiararla come `source: custom` ma con `table` uguale alla tabella standard, ad esempio `table: incident`, `column: ava_logisticspriority`.

## Sequenza operativa obbligatoria

1. Leggere i requisiti e individuare i concetti dati principali.
2. Per ogni concetto, cercare su Microsoft Learn la tabella standard candidata (`account`, `contact`, `incident`, `opportunity`, ecc.).
3. Se la tabella e appropriata, recuperare dalla reference i campi standard pertinenti, inclusi tipo, required level, target lookup, valori choice e formato datetime.
4. Solo dopo il controllo Learn, decidere eventuali tabelle o colonne custom e motivare la scelta in `reuseDecision.reason`.
5. Scrivere la decisione in `config/entities/<entita>.yaml`, non in un documento separato, cosi la POC e la futura implementazione restano allineate. Usare `entity.dataverse.table` per schermate record e `entity.dataverse.tables` solo per dashboard multi-tabella.
6. In consegna, elencare cosa riusa standard D365 e cosa richiede creazione custom.

## Fonti Microsoft Learn

- [Tables and metadata in Microsoft Dataverse](https://learn.microsoft.com/power-apps/maker/data-platform/create-edit-metadata) — metadati, standard tables e raccomandazione di riuso di tabelle/colonne standard quando hanno senso.
- [Create and edit columns in Dataverse using Power Apps](https://learn.microsoft.com/power-apps/maker/data-platform/create-edit-field-portal) — tipi colonna, opzioni numeriche, choice, DateTime e comportamenti.
- [Create and edit columns for Microsoft Dataverse using Power Apps solution explorer](https://learn.microsoft.com/power-apps/maker/data-platform/create-edit-field-solution-explorer) — tipi colonna e limiti/format disponibili.
- [Customer tables: account, contact, customeraddress](https://learn.microsoft.com/power-apps/developer/data-platform/customer-entities-account-contact) — uso di account/contact per relazioni cliente.
- [Account table/entity reference](https://learn.microsoft.com/power-apps/developer/data-platform/reference/entities/account) — colonne e option set standard dell'account.
- [Contact table/entity reference](https://learn.microsoft.com/power-apps/developer/data-platform/reference/entities/contact) — colonne e option set standard del contatto.
- [Case (Incident) table/entity reference](https://learn.microsoft.com/dynamics365/developer/reference/entities/incident) — colonne, lookup, relazioni e option set del caso Customer Service.
