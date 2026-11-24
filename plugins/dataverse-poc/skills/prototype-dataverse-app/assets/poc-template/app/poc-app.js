/* poc-app.js — renderer generico dei prototipi Dataverse (skill prototype-dataverse-app).
   Legge window.POC_MODEL (generato da scripts/prepare-runtime-poc.mjs o build-static-poc.mjs) e
   disegna l'app senza codice di dominio: viste, moduli, dashboard e componenti dichiarati in YAML.
   - appType model-driven: compone MdaShell per header, site map e, solo per Customer Service Workspace, schede di sessione.
   - appType code-app: shell applicativa propria, senza chrome Dynamics 365.
   - appType power-pages: sito con menu in alto, persone simulate e table permission (config.powerPages).
   Estensioni di progetto: app/custom.js puo registrare renderer con
   PocApp.registerComponent('<type>', function (component, ctx, helpers) { return '<html>'; }).
   Non modificare per una singola POC: i miglioramenti vanno nella skill. */
(function (global) {
    'use strict';

    var M = global.POC_MODEL || {};
    var cfg = M.config || {};
    var entities = M.entities || {};
    var comps = M.components || {};
    var defs = M.definitions || {};
    var data = M.data || {};
    var isMD = cfg.appType === 'model-driven';
    var prefix = (cfg.naming && cfg.naming.prefix) || '';
    var custom = {};
    var G = {
        plus: '+', del: '✕', refresh: '↻', mail: '✉', flow: '⚡', chart: '▤',
        down: '⇩', more: '⋯', save: '✔', assign: '⇄', lock: '🔒',
        search: '⌕', chevron: '▾', back: '←'
    };

    function esc(value) {
        return String(value === undefined || value === null ? '' : value)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }
    function find(list, fn) { for (var i = 0; i < (list || []).length; i++) if (fn(list[i], i)) return list[i]; return undefined; }
    function humanize(key) {
        var s = String(key || '').replace(new RegExp('^' + prefix), '').replace(/_/g, ' ').trim();
        return s.charAt(0).toUpperCase() + s.slice(1);
    }

    // --- dati demo --------------------------------------------------------------
    function records(ds) { return (data[ds] && data[ds].records) || []; }
    function keyField(ds) {
        var d = data[ds];
        if (!d) return null;
        return d.keyField || Object.keys((d.records || [])[0] || {})[0];
    }
    function primaryField(ds) {
        var d = data[ds];
        if (!d) return null;
        if (d.primaryField) return d.primaryField;
        var keys = Object.keys((d.records || [])[0] || {});
        return find(keys, function (k) { return /(^|_)(name|nome|titolo|title|fullname|subject|oggetto|ragione_sociale)$/.test(k); }) ||
            find(keys, function (k) { return k !== d.keyField; }) || d.keyField;
    }
    // valore chiave -> { ds, record }, usato per risolvere i lookup in etichette leggibili
    var refIndex = {};
    function rebuildIndex() {
        refIndex = {};
        Object.keys(data).forEach(function (ds) {
            var kf = keyField(ds);
            records(ds).forEach(function (r) { if (r && r[kf] !== undefined) refIndex[String(r[kf])] = { ds: ds, record: r }; });
        });
    }
    rebuildIndex();
    function recordLabel(ds, rec) {
        if (!rec) return '';
        var pf = primaryField(ds);
        return String(rec[pf] !== undefined ? rec[pf] : rec[keyField(ds)]);
    }

    // --- campi --------------------------------------------------------------------
    function allFields(doc) {
        var out = [];
        ((doc && doc.sections) || []).forEach(function (s) { (s.fields || []).forEach(function (f) { out.push(f); }); });
        return out;
    }
    function fieldKeys(f) {
        return [f.dataKey, f.dataverse && f.dataverse.column, f.logicalName].filter(function (k) { return k; });
    }
    function rawValue(f, rec) {
        if (rec) {
            var keys = fieldKeys(f);
            for (var i = 0; i < keys.length; i++) if (rec[keys[i]] !== undefined) return rec[keys[i]];
        }
        return f.value;
    }
    function options(f) {
        var dv = (f && f.dataverse) || {};
        return (Array.isArray(dv.choice) ? dv.choice : dv.choice && dv.choice.options) || dv.options || (f && f.options) || null;
    }
    function fmt(v, f, ownDs) {
        if (v === undefined || v === null || v === '') return '';
        if (Array.isArray(v)) return v.map(function (x) { return fmt(x, f, ownDs); }).join(', ');
        var control = f && f.control;
        var dv = (f && f.dataverse) || {};
        var opts = options(f);
        if (opts) { var o = find(opts, function (x) { return String(x.value) === String(v) || x.label === v; }); if (o) return o.label; }
        if (control === 'boolean' || typeof v === 'boolean') {
            var b = dv.boolean || {};
            return v === true || v === 'true' || v === 1 ? (b.trueLabel || 'Sì') : (b.falseLabel || 'No');
        }
        if (control === 'money' && typeof v === 'number') return v.toLocaleString('it-IT', { style: 'currency', currency: (f && f.currency) || 'EUR' });
        if (typeof v === 'number') return v.toLocaleString('it-IT');
        if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v)) {
            var d = new Date(v);
            if (!isNaN(d)) return /T\d{2}:\d{2}/.test(v) && dv.format !== 'DateOnly'
                ? d.toLocaleDateString('it-IT') + ' ' + d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
                : d.toLocaleDateString('it-IT');
        }
        var ref = refIndex[String(v)];
        if (ref && (control === 'lookup' || (ref.ds !== ownDs && /id$|_ref$|^.*_(account|contact|cliente|customer)/.test(fieldKeys(f || {})[0] || '')))) return recordLabel(ref.ds, ref.record);
        return String(v);
    }
    function reqs(list) {
        return list && list.length ? '<span class="reqs">' + esc(list.join(' · ')) + '</span>' : '';
    }

    // --- modifica (solo con la simulazione condivisa attiva: app/poc-sim.js + npm run sim) ---------
    var dataListeners = [];
    var rerender = function () {};
    var drafts = {};    // tabKey -> { values: { colonna: valore }, rev }
    var simMsg = {};    // tabKey -> { level, text }
    var NEW_KEY = '__new__';
    // Copia nel modello i dataset della simulazione e ridisegna (anche i componenti di custom.js).
    function applySimData(event) {
        var simData = global.PocSim.datasets();
        Object.keys(simData).forEach(function (ds) {
            if (data[ds]) data[ds].records = simData[ds].records;
            else data[ds] = { keyField: simData[ds].keyField, records: simData[ds].records };
        });
        if (event && event.type === 'reset') { drafts = {}; simMsg = {}; }
        rebuildIndex();
        dataListeners.forEach(function (fn) { try { fn(event || { type: 'resync' }); } catch (e) { console.error(e); } });
        rerender();
    }
    function simOn() {
        var S = global.PocSim;
        return !!(S && S.enabled && S.health && S.health.status === 'ok');
    }
    // Colonna del dataset in cui scrivere il campo: la prima chiave del campo usata dai record.
    function writeKey(f, ds) {
        var rows = records(ds);
        return find(fieldKeys(f), function (k) { return rows.some(function (r) { return k in r; }); }) || null;
    }
    // Dataset da cui scegliere il valore di un lookup: quello del valore attuale, oppure la schermata la cui tabella e fra i targets.
    function lookupDataset(f, value) {
        var ref = value !== undefined && value !== null && refIndex[String(value)];
        if (ref) return ref.ds;
        var targets = (f.dataverse && f.dataverse.targets) || [];
        var hit = null;
        Object.keys(entities).forEach(function (ln) {
            var t = entities[ln].entity && entities[ln].entity.dataverse && entities[ln].entity.dataverse.table;
            if (!hit && t && targets.indexOf(t.logicalName) >= 0) hit = datasetForScreen(ln);
        });
        return hit;
    }
    function inputValue(v, f) {
        if (v === undefined || v === null) return '';
        if (f.control === 'datetime' && typeof v === 'string') {
            var dateOnly = f.dataverse && f.dataverse.format === 'DateOnly';
            return dateOnly ? v.slice(0, 10) : v.slice(0, 16);
        }
        return String(v);
    }
    // Riporta il valore dell'input al tipo del dato demo (numero, booleano, data con o senza secondi).
    function fromInput(text, f, original) {
        if (text === '') return null;
        var numeric = ['money', 'decimal', 'whole'].indexOf(f.control) >= 0 || typeof original === 'number';
        if (f.control === 'boolean' || typeof original === 'boolean') return text === 'true';
        if (numeric || (f.control === 'choice' && (typeof original === 'number' || /^-?\d+$/.test(text)))) return Number(text);
        if (f.control === 'datetime' && typeof original === 'string' && /T\d{2}:\d{2}:\d{2}/.test(original) && text.length === 16) return text + ':00';
        return text;
    }
    function renderInput(f, ctx, col) {
        var draft = ctx.draft || {};
        var v = col in draft ? draft[col] : rawValue(f, ctx.record);
        var attrs = ' data-sim-field="' + esc(col) + '" data-sim-control="' + esc(f.control || 'text') + '" name="' + esc(col) + '" aria-label="' + esc(f.displayName) + '"';
        var opts = options(f);
        var input;
        if (opts || f.control === 'choice') {
            input = '<select' + attrs + '><option value=""></option>' + (opts || []).map(function (o) {
                return '<option value="' + esc(o.value) + '"' + (String(o.value) === String(v) ? ' selected' : '') + '>' + esc(o.label) + '</option>';
            }).join('') + '</select>';
        } else if (f.control === 'boolean' || typeof v === 'boolean') {
            var b = (f.dataverse && f.dataverse.boolean) || {};
            input = '<select' + attrs + '><option value=""></option><option value="true"' + (v === true ? ' selected' : '') + '>' + esc(b.trueLabel || 'Sì') + '</option>' +
                '<option value="false"' + (v === false ? ' selected' : '') + '>' + esc(b.falseLabel || 'No') + '</option></select>';
        } else if (f.control === 'lookup' && lookupDataset(f, v)) {
            var lds = lookupDataset(f, v);
            var lkf = keyField(lds);
            input = '<select' + attrs + '><option value=""></option>' + records(lds).map(function (r) {
                return '<option value="' + esc(r[lkf]) + '"' + (String(r[lkf]) === String(v) ? ' selected' : '') + '>' + esc(recordLabel(lds, r)) + '</option>';
            }).join('') + '</select>';
        } else if (f.control === 'memo') {
            input = '<textarea rows="3"' + attrs + '>' + esc(inputValue(v, f)) + '</textarea>';
        } else {
            var type = ['money', 'decimal', 'whole'].indexOf(f.control) >= 0 || typeof v === 'number' ? 'number'
                : f.control === 'datetime' ? (f.dataverse && f.dataverse.format === 'DateOnly' ? 'date' : 'datetime-local') : 'text';
            input = '<input type="' + type + '"' + (type === 'number' ? ' step="any"' : '') + ' value="' + esc(inputValue(v, f)) + '"' + attrs + '>';
        }
        return '<div class="field editing' + (col in draft ? ' dirty' : '') + '" data-field="' + esc(f.logicalName) + '"><label>' + esc(f.displayName) +
            (f.required ? '<span class="req">*</span>' : '') + '</label>' + input + (f.hint ? '<div class="hint">' + esc(f.hint) + '</div>' : '') + '</div>';
    }

    function renderField(f, ctx) {
        var col = ctx.edit && !f.readOnly ? writeKey(f, ctx.ds) : null;
        if (col && (!ctx.record || col !== keyField(ctx.ds))) return renderInput(f, ctx, col);
        var v = fmt(rawValue(f, ctx.record), f, ctx.ds);
        var glyph = f.control === 'lookup' ? G.search : f.control === 'choice' ? G.chevron : '';
        return '<div class="field" data-field="' + esc(f.logicalName) + '"><label>' + esc(f.displayName) +
            (f.required ? '<span class="req">*</span>' : '') + '</label>' +
            '<div class="value' + (f.readOnly ? ' readonly' : '') + (v === '' ? ' empty' : '') + (f.control === 'memo' ? ' memo' : '') + '">' +
            (f.readOnly ? '<span class="lock">' + G.lock + '</span>&nbsp;' : '') + (v === '' ? '---' : esc(v)) +
            (glyph ? '<span class="glyph">' + glyph + '</span>' : '') + '</div>' +
            (f.hint ? '<div class="hint">' + esc(f.hint) + '</div>' : '') + '</div>';
    }

    // --- tabelle ------------------------------------------------------------------
    function columnMeta(doc) {
        var meta = {};
        allFields(doc).forEach(function (f) { fieldKeys(f).forEach(function (k) { meta[k] = f; }); });
        return meta;
    }
    // metadati dei campi (etichette, choice, formati) di tutte le schermate che leggono il dataset
    var metaCache = {};
    function metaForDataset(ds) {
        if (!metaCache[ds]) {
            var meta = {};
            Object.keys(entities).forEach(function (ln) {
                if (datasetForScreen(ln) !== ds) return;
                var m = columnMeta(entities[ln]);
                Object.keys(m).forEach(function (k) { if (!meta[k]) meta[k] = m[k]; });
            });
            metaCache[ds] = meta;
        }
        return metaCache[ds];
    }
    function table(rows, cols, ds, target, meta) {
        if (!rows.length) return '<div class="grid-empty">Nessun record.</div>';
        var kf = keyField(ds);
        var head = '<tr><th class="sel"><span class="checkbox"></span></th>' + cols.map(function (c) { return '<th>' + esc(c.label) + '</th>'; }).join('') + '</tr>';
        var body = rows.map(function (r) {
            var open = target ? ' class="clickable" data-open="' + esc(target) + '" data-key="' + esc(r[kf]) + '"' : '';
            return '<tr' + open + '><td class="sel"><span class="checkbox"></span></td>' + cols.map(function (c, i) {
                var v = fmt(r[c.key], meta[c.key] || c.field, ds);
                var num = typeof r[c.key] === 'number' && !options(meta[c.key] || c.field);
                return i === 0 && target
                    ? '<td class="primary"><a href="#">' + esc(v || '(senza nome)') + '</a></td>'
                    : '<td' + (num ? ' class="num"' : '') + '>' + esc(v) + '</td>';
            }).join('') + '</tr>';
        }).join('');
        return '<div class="grid-scroll"><table class="grid"><thead>' + head + '</thead><tbody>' + body + '</tbody></table></div>';
    }
    function columns(spec, ds, meta, primary) {
        if (spec && spec.length) {
            return spec.map(function (c) {
                var key = typeof c === 'string' ? c : c.field;
                return { key: key, label: (typeof c === 'object' && c.label) || (meta[key] && meta[key].displayName) || humanize(key) };
            });
        }
        var kf = keyField(ds);
        var first = primary || primaryField(ds);
        var keys = Object.keys(records(ds)[0] || {}).filter(function (k) { return k !== kf && k !== first; }).slice(0, 5);
        return [first].concat(keys).filter(function (k) { return k; }).map(function (k) {
            return { key: k, label: (meta[k] && meta[k].displayName) || humanize(k) };
        });
    }
    function notRendered(what) {
        return '<div class="grid-surface"><div class="grid-empty">Contenuto non ancora reso nel prototipo: ' + what + '</div></div>';
    }

    // --- componenti -------------------------------------------------------------------
    function resolveUse(use) {
        var d = defs[use.component] || {};
        var b = {};
        (d.params || []).forEach(function (p) { if (p.default !== undefined) b[p.name] = p.default; });
        Object.keys(use.args || {}).forEach(function (k) { b[k] = use.args[k]; });
        return {
            logicalName: use.instance, type: d.type, simulation: d.simulation, pcf: d.pcf, bindings: b,
            displayName: use.displayName || b.title || b.titolo || d.displayName,
            requirements: use.requirements || d.requirements
        };
    }
    function scoped(b, ctx) {
        var rows = records(b.dataset);
        if (b.relatedField && ctx.key !== undefined && ctx.key !== null) {
            rows = rows.filter(function (r) { return String(r[b.relatedField]) === String(ctx.key); });
        }
        if (b.filter) {
            rows = rows.filter(function (r) {
                return Object.keys(b.filter).every(function (k) { return String(r[k]) === String(b.filter[k]); });
            });
        }
        return rows;
    }
    function tiles(items) {
        return '<div class="poc-kpis">' + items.map(function (t) {
            return '<div class="poc-kpi' + (t.tone ? ' ' + esc(t.tone) : '') + '"><div class="v">' + esc(t.value) + '</div><div class="k">' + esc(t.label) + '</div></div>';
        }).join('') + '</div>';
    }
    var renderers = {
        kpi: function (c, ctx) {
            var b = c.bindings || {};
            if (b.items) return tiles(b.items);
            var rows = scoped(b, ctx);
            if (b.groupBy) {
                var meta = metaForDataset(b.dataset);
                var counts = {};
                var order = [];
                rows.forEach(function (r) {
                    var label = fmt(r[b.groupBy], meta[b.groupBy], b.dataset) || '(vuoto)';
                    if (!(label in counts)) { counts[label] = 0; order.push(label); }
                    counts[label]++;
                });
                return tiles(order.map(function (l) { return { label: l, value: counts[l] }; }));
            }
            var items = [{ label: (data[b.dataset] && data[b.dataset].displayName) || 'Record', value: rows.length }];
            if (b.sumField) {
                var total = rows.reduce(function (n, r) { return n + (Number(r[b.sumField]) || 0); }, 0);
                items.push({ label: b.sumLabel || humanize(b.sumField), value: total.toLocaleString('it-IT') });
            }
            return tiles(items);
        },
        subgrid: function (c, ctx) {
            var b = c.bindings || {};
            var target = b.targetForm || null;
            var meta = metaForDataset(b.dataset);
            return table(scoped(b, ctx), columns(b.fields, b.dataset, meta), b.dataset, target, meta);
        },
        timeline: function (c, ctx) {
            var b = c.bindings || {};
            var rows = scoped(b, ctx).slice().sort(function (x, y) { return String(y[b.dateField] || '').localeCompare(String(x[b.dateField] || '')); });
            if (!rows.length) return '<div class="grid-empty">Nessuna attività.</div>';
            return '<ol class="poc-timeline">' + rows.map(function (r) {
                return '<li><span class="when">' + esc(fmt(r[b.dateField])) + '</span><b>' + esc(r[b.titleField || primaryField(b.dataset)]) + '</b>' +
                    (b.textField && r[b.textField] ? '<span class="text">' + esc(r[b.textField]) + '</span>' : '') + '</li>';
            }).join('') + '</ol>';
        },
        bpf: function (c, ctx) {
            var b = c.bindings || {};
            var stages = (b.stages || []).map(function (s) { return typeof s === 'string' ? s : s.label; });
            var current = ctx.record && b.stageField ? fmt(ctx.record[b.stageField]) : b.activeStage;
            var active = typeof current === 'number' ? current : Math.max(0, stages.indexOf(current));
            return '<ol class="poc-bpf">' + stages.map(function (s, i) {
                return '<li class="' + (i < active ? 'done' : i === active ? 'active' : '') + '">' + esc(s) + '</li>';
            }).join('') + '</ol>';
        },
        'generative-page': function (c, ctx) {
            var b = c.bindings || {};
            var html = b.text ? '<p class="poc-gen-text">' + esc(b.text) + '</p>' : '';
            if (b.dataset) {
                var rows = scoped(b, ctx);
                var meta = metaForDataset(b.dataset);
                html += tiles([{ label: (data[b.dataset] && data[b.dataset].displayName) || 'Record', value: rows.length }]) +
                    table(rows.slice(0, b.limit || 5), columns(b.fields, b.dataset, meta), b.dataset, b.targetForm || null, meta);
            }
            return html || '<p class="poc-gen-text">' + esc((c.simulation && c.simulation.note) || 'Contenuto generato simulato.') + '</p>';
        },
        pcf: function (c, ctx) {
            var b = c.bindings || {};
            var html = '';
            if (b.field && ctx.record) {
                var v = ctx.record[b.field];
                html = typeof v === 'number'
                    ? '<div class="poc-meter"><span style="width:' + Math.max(0, Math.min(100, v / (b.max || 100) * 100)) + '%"></span></div><div class="poc-meter-label">' + esc(fmt(v)) + '</div>'
                    : '<span class="poc-chip">' + esc(fmt(v)) + '</span>';
            } else if (b.dataset) {
                var meta = metaForDataset(b.dataset);
                html = table(scoped(b, ctx), columns(b.fields, b.dataset, meta), b.dataset, b.targetForm || null, meta);
            }
            var p = c.pcf || {};
            return html + '<div class="poc-pcf-contract">PCF ' + esc(p.controlName || '?') + ' · ' + esc(p.logicalName || c.logicalName) +
                ' · enabled: ' + (p.enabled ? 'true' : 'false') + ' · fallback html</div>';
        }
    };
    function renderComponent(c, ctx) {
        if (!c || !c.type) return '';
        var helpers = { esc: esc, records: records, scoped: scoped, fmt: fmt, table: table, tiles: tiles, columns: columns };
        var fn = custom[c.type] || renderers[c.type];
        var inner = fn ? fn(c, ctx, helpers) : '<div class="grid-empty">Tipo ' + esc(c.type) + ' non ancora reso.</div>';
        if (c.type === 'generative-page' || c.type === 'pcf') {
            var sim = c.simulation || {};
            return '<div class="sim-frame poc-comp" data-component="' + esc(c.logicalName) + '"><div class="sim-head"><span class="badge sim">Simulazione</span>' +
                '<strong>' + (c.type === 'pcf' ? 'Controllo PCF' : 'Generative page') + '</strong><span>' + esc(c.displayName) + '</span>' +
                (sim.hostApp ? '<span class="sim-host">' + esc(sim.hostApp) + '</span>' : '') + '<span class="grow"></span>' + reqs(c.requirements) + '</div>' +
                '<div class="sim-body">' + (sim.note ? '<div class="sim-note">' + esc(sim.note) + '</div>' : '') + inner + '</div></div>';
        }
        return '<div class="poc-comp poc-' + esc(c.type) + '" data-component="' + esc(c.logicalName) + '"><div class="poc-comp-head"><span>' + esc(c.displayName) + '</span>' +
            reqs(c.requirements) + '</div><div class="poc-comp-body">' + inner + '</div></div>';
    }

    function renderSection(s, ctx) {
        var fields = s.fields || [];
        var html = fields.length
            ? '<div class="field-grid" style="grid-template-columns:' + esc(s.layout || 'repeat(2, minmax(0, 1fr))') + '">' +
            fields.map(function (f) { return renderField(f, ctx); }).join('') + '</div>'
            : '';
        (s.uses || []).forEach(function (u) { html += renderComponent(resolveUse(u), ctx); });
        (s.components || []).forEach(function (ln) { html += renderComponent(comps[ln], ctx); });
        return '<section class="card"><div class="card-head"><h2>' + esc(s.displayName || '') + '</h2><span class="grow"></span>' + reqs(s.requirements) + '</div>' +
            '<div class="card-body">' + html + '</div></section>';
    }
    function formTabs(doc) {
        return doc.tabs && doc.tabs.length ? doc.tabs : [{ logicalName: '_main', displayName: 'Generale' }];
    }
    function sectionsOfTab(doc, tabs, tabName) {
        return (doc.sections || []).filter(function (s) {
            return s.tab ? s.tab === tabName : tabName === tabs[0].logicalName;
        });
    }

    // --- relazioni fra schermate -------------------------------------------------------
    function pageTypeOf(ln) {
        var ref = find(cfg.entities, function (e) { return e.logicalName === ln; });
        return (ref && ref.pageType) || (entities[ln] && entities[ln].entity && entities[ln].entity.pageType);
    }
    function viewForForm(form) {
        return find(Object.keys(entities), function (ln) { return entities[ln].entity && entities[ln].entity.targetForm === form; });
    }
    function datasetForScreen(ln) {
        var e = entities[ln] && entities[ln].entity;
        if (!e) return null;
        if (e.dataset) return e.dataset;
        var view = viewForForm(ln);
        if (view) return entities[view].entity.dataset;
        var hit = null;
        Object.keys(comps).forEach(function (k) { var b = comps[k].bindings || {}; if (b.targetForm === ln) hit = b.dataset; });
        return hit;
    }
    function recordFor(screen, key) {
        var ds = datasetForScreen(screen);
        var kf = keyField(ds);
        var rows = records(ds);
        var rec = key !== null && key !== undefined ? find(rows, function (r) { return String(r[kf]) === String(key); }) : rows[0];
        return { ds: ds, record: rec || null, key: rec ? rec[kf] : null, screen: screen };
    }
    function headerFields(doc, ctx) {
        var ent = doc.entity || {};
        var fields = allFields(doc);
        var picked = ent.headerFields
            ? ent.headerFields.map(function (ln) { return find(fields, function (f) { return f.logicalName === ln; }); }).filter(Boolean)
            : fields.filter(function (f) { return fmt(rawValue(f, ctx.record), f, ctx.ds) !== ''; }).slice(1, 4);
        return picked.map(function (f) {
            return '<div class="head-field"><div class="v">' + esc(fmt(rawValue(f, ctx.record), f, ctx.ds) || '---') + '</div><div class="k">' + esc(f.displayName) + '</div></div>';
        }).join('');
    }

    // ===========================================================================
    // Model-driven: compone MdaShell
    // ===========================================================================
    function startModelDriven(root) {
        var MS = global.MdaShell;
        if (!MS) { root.innerHTML = '<p>mda-shell.js mancante: copiarlo in app/ (appType model-driven).</p>'; return; }
        var firstAppNav = find(cfg.modelDrivenApps, function (a) { return a.navigation && a.navigation.areas; });
        if (!cfg.navigation || !cfg.navigation.areas) cfg.navigation = firstAppNav ? firstAppNav.navigation : { areas: [] };
        var navObjects = {};
        function collect(nav) {
            ((nav && nav.areas) || []).forEach(function (a) {
                (a.groups || []).forEach(function (g) { (g.items || []).forEach(function (i) { if (typeof i === 'object') navObjects[i.logicalName] = i; }); });
            });
        }
        collect(cfg.navigation);
        (cfg.modelDrivenApps || []).forEach(function (a) { if (a.navigation && a.navigation !== 'current') collect(a.navigation); });
        if (!cfg.demoPath || !cfg.demoPath.length) {
            var firstItem = (((cfg.navigation.areas[0] || {}).groups || [])[0] || {}).items || [];
            cfg.demoPath = [typeof firstItem[0] === 'object' ? firstItem[0].logicalName : firstItem[0]];
        }

        var state = MS.createState(cfg);
        state.formTab = {};
        function navCfg() {
            var app = find(cfg.modelDrivenApps, function (a) { return a.logicalName === state.appLogicalName; });
            return app && app.navigation && app.navigation !== 'current' ? Object.assign({}, cfg, { navigation: app.navigation }) : cfg;
        }
        function screenTitle(ln) {
            return (entities[ln] && entities[ln].entity.displayName) || (navObjects[ln] && navObjects[ln].displayName) || ln;
        }
        function titleForTab(tab) {
            if (tab.key === null || tab.key === undefined) return screenTitle(tab.screen);
            var ctx = recordFor(tab.screen, tab.key);
            return recordLabel(ctx.ds, ctx.record) || screenTitle(tab.screen);
        }
        var shellOpts = {
            entityByName: function (ln) { return entities[ln] ? { entity: { pageType: pageTypeOf(ln), displayName: entities[ln].entity.displayName } } : null; },
            standardPageByName: function (ln) { return navObjects[ln] || null; },
            recordLabel: function (screen, key) { return titleForTab({ screen: screen, key: key }); }
        };

        function viewScreen(ln) {
            var doc = entities[ln];
            var ent = doc.entity;
            var ds = ent.dataset;
            var meta = metaForDataset(ds);
            var rows = records(ds);
            var grid = data[ds]
                ? '<div class="grid-surface">' + table(rows, columns(ent.columns, ds, meta, ent.primaryColumn), ds, ent.targetForm || null, meta) + MS.gridFooter(rows.length) + '</div>'
                : notRendered('nessun dataset demo "' + esc(ds) + '"');
            var editable = simOn() && data[ds] && ent.targetForm;
            return MS.commandBar([{ label: 'Nuovo', glyph: G.plus, action: editable ? 'new' : null, target: ent.targetForm }, { label: 'Elimina', glyph: G.del }, '|',
                { label: 'Aggiorna', glyph: G.refresh, action: simOn() ? 'refresh' : null },
                { label: 'Invia collegamento', glyph: G.mail }, '|', { label: 'Flusso', glyph: G.flow }, { label: 'Esegui report', glyph: G.chart },
                { label: 'Esporta in Excel', glyph: G.down }, { label: '', glyph: G.more }]) +
                '<div class="page-head"><div class="titles"><h1>' + esc(ent.viewName || ent.displayName) + ' <span class="chev">' + G.chevron + '</span></h1>' +
                '<div class="sub">' + rows.length + ' record</div></div><span class="grow"></span><div class="view-search">' + G.search + ' Filtra per parola chiave</div></div>' +
                '<div class="page-body">' + (doc.sections || []).map(function (s) { return renderSection(s, { screen: ln, record: null, key: null, ds: ds }); }).join('') + grid + '</div>';
        }
        function formScreen(tab) {
            var doc = entities[tab.screen];
            var ent = doc.entity;
            var isNew = tab.key === NEW_KEY;
            var ctx = isNew ? { ds: datasetForScreen(tab.screen), record: null, key: null, screen: tab.screen } : recordFor(tab.screen, tab.key);
            var view = viewForForm(tab.screen);
            var tabs = formTabs(doc);
            var tabKey = tab.screen + '|' + tab.key;
            var active = state.formTab[tabKey] || tabs[0].logicalName;
            var edit = simOn() && !!data[ctx.ds] && (isNew || !!ctx.record);
            var draft = drafts[tabKey];
            ctx.edit = edit;
            ctx.draft = draft && draft.values;
            var msg = simMsg[tabKey];
            var stale = edit && !isNew && draft && Object.keys(draft.values).length && draft.rev !== global.PocSim.revOf(ctx.ds, ctx.key);
            var bars = (msg ? '<div class="message-bar ' + esc(msg.level) + '" style="margin-top:12px" data-sim-message>' + esc(msg.text) + '</div>' : '') +
                (stale ? '<div class="message-bar warning" style="margin-top:12px">Il record è stato modificato in un\'altra finestra: al salvataggio potrai ricaricarlo o sovrascriverlo.</div>' : '');
            return MS.commandBar([{ label: 'Salva', glyph: G.save, action: edit ? 'save' : null }, { label: 'Salva e chiudi', action: edit ? 'save-close' : null },
                { label: 'Nuovo', glyph: G.plus, action: edit ? 'new' : null, target: tab.screen }, '|',
                { label: 'Aggiorna', glyph: G.refresh, action: simOn() ? 'refresh' : null }, { label: 'Assegna', glyph: G.assign },
                { label: 'Elimina', glyph: G.del, action: edit && !isNew ? 'delete' : null }, '|', { label: 'Flusso', glyph: G.flow }]) +
                bars +
                (simOn() && !isNew && tab.key !== null && tab.key !== undefined && !ctx.record
                    ? '<div class="message-bar warning" style="margin-top:12px" data-sim-message>Il record ' + esc(tab.key) + ' non esiste più: è stato eliminato o la simulazione è stata ripristinata.</div>'
                    : '') +
                '<div class="form-head"><div class="crumb">' + (view ? '<a data-nav="' + esc(view) + '">' + esc(entities[view].entity.displayName) + '</a> › ' : '') + esc(ent.displayName) + '</div>' +
                '<div class="row"><h1>' + esc(ctx.record ? recordLabel(ctx.ds, ctx.record) : 'Nuovo record: ' + ent.displayName) + '</h1>' +
                '<div class="head-fields">' + headerFields(doc, ctx) + '</div></div>' +
                '<div class="form-tabs">' + tabs.map(function (t) {
                    return '<button class="' + (t.logicalName === active ? 'active' : '') + '" data-form-tab="' + esc(t.logicalName) + '" data-tab-key="' + esc(tabKey) + '">' + esc(t.displayName) + '</button>';
                }).join('') + '</div></div>' +
                (ent.messageBar ? '<div class="message-bar ' + esc(ent.messageBar.level || 'info') + '" style="margin-top:12px">' + esc(ent.messageBar.text) + '</div>' : '') +
                '<div class="form-grid">' + sectionsOfTab(doc, tabs, active).map(function (s) { return renderSection(s, ctx); }).join('') + '</div>';
        }
        function dashboardScreen(ln) {
            var doc = entities[ln];
            return MS.commandBar([{ label: 'Aggiorna', glyph: G.refresh }, { label: 'Imposta come predefinito' }]) +
                '<div class="page-head"><div class="titles"><h1>' + esc(doc.entity.displayName) + '</h1></div></div>' +
                '<div class="page-body">' + (doc.sections || []).map(function (s) { return renderSection(s, { screen: ln, record: null, key: null }); }).join('') + '</div>';
        }
        function standardScreen(ln) {
            var item = navObjects[ln] || { displayName: ln };
            return '<div class="page-head"><div class="titles"><h1>' + esc(item.displayName) + '</h1><div class="sub">Pagina standard' +
                (item.table ? ' · tabella <code>' + esc(item.table) + '</code>' : '') + '</div></div></div>' +
                '<div class="page-body">' + notRendered('pagina standard non modellata in config/entities/') + '</div>';
        }
        function screen(tab) {
            if (!entities[tab.screen]) return standardScreen(tab.screen);
            var pt = pageTypeOf(tab.screen);
            if (pt === 'view') return viewScreen(tab.screen);
            if (pt === 'form') return formScreen(tab);
            return dashboardScreen(tab.screen);
        }
        function render() {
            var nc = navCfg();
            if (!find(nc.navigation.areas, function (a) { return a.logicalName === state.area; })) state.area = (nc.navigation.areas[0] || {}).logicalName;
            // Un aggiornamento da un'altra finestra ridisegna la pagina: il campo in modifica resta a fuoco.
            var focused = document.activeElement && document.activeElement.getAttribute && document.activeElement.getAttribute('data-sim-field');
            var caret = focused && typeof document.activeElement.selectionStart === 'number' ? document.activeElement.selectionStart : null;
            root.innerHTML = MS.renderHeader(cfg, cfg.demoUser && cfg.demoUser.initials, state) + MS.renderProtoBanner(cfg) +
                MS.renderTabstrip(state, titleForTab, function (tab) { return pageTypeOf(tab.screen) || (navObjects[tab.screen] || {}).pageType || 'view'; }) +
                '<div class="mda-body">' + MS.renderSitemap(state, nc, shellOpts) + '<main class="content">' + screen(MS.activeTab(state)) + '</main></div>';
            if (focused) {
                var again = root.querySelector('[data-sim-field="' + focused.replace(/"/g, '') + '"]');
                if (again) { again.focus(); if (caret !== null) try { again.setSelectionRange(caret, caret); } catch (e) { /* input senza selezione */ } }
            }
        }
        rerender = render;

        function activeTabKey() { var t = MS.activeTab(state); return t.screen + '|' + t.key; }
        function fieldFor(screenName, ds, col) {
            return find(allFields(entities[screenName]), function (f) { return writeKey(f, ds) === col; }) || { control: 'text' };
        }
        function onInput(event) {
            var el = event.target.closest && event.target.closest('[data-sim-field]');
            if (!el || !simOn()) return;
            var tab = MS.activeTab(state);
            var key = activeTabKey();
            var ds = datasetForScreen(tab.screen);
            var col = el.getAttribute('data-sim-field');
            var ctx = tab.key === NEW_KEY ? { record: null } : recordFor(tab.screen, tab.key);
            var original = ctx.record ? ctx.record[col] : undefined;
            if (!drafts[key]) drafts[key] = { values: {}, rev: tab.key === NEW_KEY ? null : global.PocSim.revOf(ds, tab.key) };
            drafts[key].values[col] = fromInput(el.value, fieldFor(tab.screen, ds, col), original);
            el.closest('.field').classList.add('dirty');
            delete simMsg[key];
        }
        document.addEventListener('input', onInput);
        document.addEventListener('change', onInput);

        var saving = false;
        function save(close) {
            var tab = MS.activeTab(state);
            var key = activeTabKey();
            var ds = datasetForScreen(tab.screen);
            var isNew = tab.key === NEW_KEY;
            var values = (drafts[key] && drafts[key].values) || {};
            var view = viewForForm(tab.screen);
            if (!Object.keys(values).length) {
                if (close && view) state.tabs[state.active] = { screen: view, key: null };
                else simMsg[key] = { level: 'info', text: 'Nessuna modifica da salvare.' };
                render();
                return;
            }
            if (saving) return;
            saving = true;
            var op = isNew ? global.PocSim.create(ds, values) : global.PocSim.update(ds, tab.key, values, drafts[key].rev);
            op.then(function (rec) {
                saving = false;
                delete drafts[key];
                delete simMsg[key];
                var newKey = String(rec[keyField(ds)]);
                if (close && view) state.tabs[state.active] = { screen: view, key: null };
                else {
                    state.tabs[state.active] = { screen: tab.screen, key: newKey };
                    simMsg[tab.screen + '|' + newKey] = { level: 'success', text: isNew ? 'Record creato: ' + newKey + '.' : 'Modifiche salvate.' };
                }
                state.recent = state.recent.filter(function (r) { return r.key !== NEW_KEY; });
                applySimData({ type: 'change', dataset: ds, key: newKey });
            }).catch(function (err) {
                saving = false;
                if (err.status === 409 && !isNew && err.body && err.body.error === 'conflict') {
                    return global.PocSim.resolveConflict(ds, err).then(function (choice) {
                        if (choice === 'reload') { delete drafts[key]; simMsg[key] = { level: 'info', text: 'Record ricaricato con la versione dell\'altra finestra.' }; applySimData(); return; }
                        drafts[key].rev = global.PocSim.revOf(ds, tab.key);
                        save(close);
                    });
                }
                var details = err.body && err.body.details ? ': ' + err.body.details.join('; ') : '';
                simMsg[key] = { level: 'error', text: (err.message || 'Salvataggio non riuscito') + details };
                render();
            });
        }
        function simAction(action, target) {
            if (!simOn()) return;
            if (action === 'refresh') { global.PocSim.reload(); return; }
            if (action === 'save' || action === 'save-close') { save(action === 'save-close'); return; }
            if (action === 'delete') {
                var tab = MS.activeTab(state);
                var key = activeTabKey();
                var ds = datasetForScreen(tab.screen);
                global.PocSim.remove(ds, tab.key).then(function (done) {
                    if (!done) return;
                    delete drafts[key];
                    var view = viewForForm(tab.screen);
                    state.tabs[state.active] = view ? { screen: view, key: null } : tab;
                    state.recent = state.recent.filter(function (r) { return String(r.key) !== String(tab.key); });
                    applySimData({ type: 'change', dataset: ds, key: tab.key, op: 'delete' });
                }).catch(function (err) {
                    var details = err.body && err.body.usedBy ? ': ' + err.body.usedBy.join(', ') : '';
                    simMsg[key] = { level: 'error', text: (err.message || 'Eliminazione non riuscita') + details };
                    render();
                });
                return;
            }
            if (action === 'new' && target) {
                delete drafts[target + '|' + NEW_KEY];
                delete simMsg[target + '|' + NEW_KEY];
                MS.openRecord(state, target, NEW_KEY);
                state.recent = state.recent.filter(function (r) { return r.key !== NEW_KEY; });
                window.scrollTo(0, 0);
                render();
            }
        }

        document.addEventListener('click', function (event) {
            var act = event.target.closest('[data-sim-action]');
            if (act) { simAction(act.getAttribute('data-sim-action'), act.getAttribute('data-sim-target')); return; }
            var formTab = event.target.closest('[data-form-tab]');
            if (formTab) { state.formTab[formTab.getAttribute('data-tab-key')] = formTab.getAttribute('data-form-tab'); render(); return; }
            if (event.target.closest('a[href="#"]') && !event.target.closest('[data-open]')) event.preventDefault();
            MS.handleShellClick(event, state, cfg, render);
        });
        MS.enableSitemapResize(state);
        render();
    }

    // ===========================================================================
    // Code app: shell applicativa propria (niente site map, niente schede D365)
    // ===========================================================================
    function startCodeApp(root) {
        var targets = {};
        Object.keys(entities).forEach(function (ln) { var t = entities[ln].entity && entities[ln].entity.targetForm; if (t) targets[t] = ln; });
        var navList = (cfg.codeApp && cfg.codeApp.navigation) || (cfg.entities || []).map(function (e) { return e.logicalName; }).filter(function (ln) { return !targets[ln]; });
        var state = { screen: (cfg.demoPath && cfg.demoPath[0]) || navList[0], key: null, formTab: {} };
        var app = cfg.application || {};

        function listScreen(ln) {
            var doc = entities[ln];
            var ent = doc.entity;
            var meta = metaForDataset(ent.dataset);
            var grid = data[ent.dataset]
                ? '<div class="ca-surface">' + table(records(ent.dataset), columns(ent.columns, ent.dataset, meta, ent.primaryColumn), ent.dataset, ent.targetForm || null, meta) + '</div>'
                : notRendered('nessun dataset demo "' + esc(ent.dataset) + '"');
            return '<div class="ca-head"><h1>' + esc(ent.displayName) + '</h1><span class="grow"></span><button class="ca-btn primary">' + G.plus + ' Nuovo</button></div>' +
                (doc.sections || []).map(function (s) { return renderSection(s, { screen: ln, record: null, key: null, ds: ent.dataset }); }).join('') + grid;
        }
        function detailScreen(ln, key) {
            var doc = entities[ln];
            var ctx = recordFor(ln, key);
            var tabs = formTabs(doc);
            var tabKey = ln + '|' + key;
            var active = state.formTab[tabKey] || tabs[0].logicalName;
            var back = targets[ln];
            return '<div class="ca-head">' + (back ? '<button class="ca-btn" data-nav="' + esc(back) + '">' + G.back + ' ' + esc(entities[back].entity.displayName) + '</button>' : '') +
                '<h1>' + esc(ctx.record ? recordLabel(ctx.ds, ctx.record) : doc.entity.displayName) + '</h1><span class="grow"></span><button class="ca-btn primary">' + G.save + ' Salva</button></div>' +
                '<div class="ca-header-fields">' + headerFields(doc, ctx) + '</div>' +
                '<div class="form-tabs">' + tabs.map(function (t) {
                    return '<button class="' + (t.logicalName === active ? 'active' : '') + '" data-form-tab="' + esc(t.logicalName) + '" data-tab-key="' + esc(tabKey) + '">' + esc(t.displayName) + '</button>';
                }).join('') + '</div>' +
                sectionsOfTab(doc, tabs, active).map(function (s) { return renderSection(s, ctx); }).join('');
        }
        function screen() {
            var doc = entities[state.screen];
            if (!doc) return notRendered('schermata "' + esc(state.screen) + '" inesistente');
            if (targets[state.screen] || state.key !== null) return detailScreen(state.screen, state.key);
            if (doc.entity.dataset) return listScreen(state.screen);
            return '<div class="ca-head"><h1>' + esc(doc.entity.displayName) + '</h1></div>' +
                (doc.sections || []).map(function (s) { return renderSection(s, { screen: state.screen, record: null, key: null }); }).join('');
        }
        function render() {
            var current = targets[state.screen] || state.screen;
            root.innerHTML = '<div class="ca-app"><header class="ca-top"><span class="ca-logo"></span><span class="ca-name">' + esc(app.displayName) + '</span>' +
                '<span class="grow"></span><span class="ca-user">' + esc((cfg.demoUser && cfg.demoUser.initials) || 'DU') + '</span></header>' +
                (cfg.showPrototypeBanner === false ? '' : '<div class="ca-banner"><span class="badge sim">Prototipo</span> <strong>Non è software funzionante.</strong> Dati sintetici, nessuna connessione a Dataverse.</div>') +
                '<div class="ca-body"><nav class="ca-nav">' + navList.map(function (ln) {
                    return entities[ln] ? '<button class="ca-nav-item' + (ln === current ? ' active' : '') + '" data-nav="' + esc(ln) + '">' + esc(entities[ln].entity.displayName) + '</button>' : '';
                }).join('') + '</nav><main class="ca-main">' + screen() + '</main></div></div>';
        }
        document.addEventListener('click', function (event) {
            var t = event.target;
            var formTab = t.closest('[data-form-tab]');
            var nav = t.closest('[data-nav]');
            var open = t.closest('[data-open]');
            if (formTab) state.formTab[formTab.getAttribute('data-tab-key')] = formTab.getAttribute('data-form-tab');
            else if (nav) { state.screen = nav.getAttribute('data-nav'); state.key = null; }
            else if (open) { event.preventDefault(); state.screen = open.getAttribute('data-open'); state.key = open.getAttribute('data-key'); }
            else return;
            window.scrollTo(0, 0);
            render();
        });
        rerender = render;
        render();
    }

    // ===========================================================================
    // Power Pages SPA: sito con menu in alto, persone simulate (anonimo, autenticato,
    // web role) e table permission dichiarate in config.powerPages
    // ===========================================================================
    function startPortal(root) {
        var pp = cfg.powerPages || {};
        var app = cfg.application || {};
        var targets = {};
        Object.keys(entities).forEach(function (ln) { var t = entities[ln].entity && entities[ln].entity.targetForm; if (t) targets[t] = ln; });
        var navList = pp.navigation || (cfg.entities || []).map(function (e) { return e.logicalName; }).filter(function (ln) { return !targets[ln]; });
        var personas = [{ logicalName: 'anonymous', displayName: 'Visitatore anonimo' }, { logicalName: 'authenticated', displayName: 'Utente autenticato' }]
            .concat((pp.webRoles || []).map(function (r) { return { logicalName: r.logicalName, displayName: r.displayName }; }));
        var signedIn = pp.demoPersona && pp.demoPersona !== 'anonymous' ? pp.demoPersona : (personas[2] || personas[1]).logicalName;
        var state = { screen: (cfg.demoPath && cfg.demoPath[0]) || navList[0], key: null, formTab: {}, persona: pp.demoPersona || signedIn, personaMenu: false };

        function personaName(ln) { var p = find(personas, function (x) { return x.logicalName === ln; }); return p ? p.displayName : ln; }
        function canSee(ln) {
            var a = (entities[ln] && entities[ln].entity && entities[ln].entity.access) || 'authenticated';
            var list = Array.isArray(a) ? a : [a];
            if (list.indexOf('anonymous') >= 0) return true;
            if (state.persona === 'anonymous') return false;
            return list.indexOf('authenticated') >= 0 || list.indexOf(state.persona) >= 0;
        }
        // Table permission della persona corrente sulla tabella della schermata (authenticated vale per ogni utente autenticato).
        function perms(ln) {
            var t = entities[ln] && entities[ln].entity && entities[ln].entity.dataverse && entities[ln].entity.dataverse.table;
            if (!t) return [];
            return (pp.tablePermissions || []).filter(function (p) {
                var r = p.roles || [];
                return p.table === t.logicalName && (r.indexOf(state.persona) >= 0 || (state.persona !== 'anonymous' && r.indexOf('authenticated') >= 0));
            });
        }
        function can(ln, privilege) {
            return Boolean(find(perms(ln), function (p) { return (p.privileges || []).indexOf(privilege) >= 0; }));
        }
        function permChips(ln) {
            return perms(ln).map(function (p) {
                return '<span class="pp-perm" title="Table permission">' + G.lock + ' ' + esc(p.displayName) + ' · scope ' + esc(p.scope) + ' · ' + esc((p.privileges || []).join(', ')) + '</span>';
            }).join('');
        }
        function denied(ln) {
            return '<div class="pp-denied"><h1>' + esc(entities[ln].entity.displayName) + '</h1><p>' +
                (state.persona === 'anonymous' ? 'Accedi per continuare: la pagina è riservata agli utenti autenticati.' : 'La persona ' + esc(personaName(state.persona)) + ' non ha accesso a questa pagina.') + '</p>' +
                (state.persona === 'anonymous' ? '<button class="ca-btn primary" data-persona-signin="1">Accedi</button>' : '') + '</div>';
        }
        function listScreen(ln) {
            var ent = entities[ln].entity;
            var meta = metaForDataset(ent.dataset);
            var grid = !data[ent.dataset] ? notRendered('nessun dataset demo "' + esc(ent.dataset) + '"')
                : can(ln, 'read') ? '<div class="ca-surface">' + table(records(ent.dataset), columns(ent.columns, ent.dataset, meta, ent.primaryColumn), ent.dataset, ent.targetForm || null, meta) + '</div>'
                    : '<div class="ca-surface"><div class="grid-empty">Nessuna table permission con read: la Web API risponderebbe 403.</div></div>';
            return '<div class="ca-head"><h1>' + esc(ent.displayName) + '</h1><span class="grow"></span>' +
                (can(ln, 'create') ? '<button class="ca-btn primary">' + G.plus + ' Nuovo</button>' : '') + '</div>' +
                '<div class="pp-perms">' + permChips(ln) + '</div>' +
                (entities[ln].sections || []).map(function (s) { return renderSection(s, { screen: ln, record: null, key: null, ds: ent.dataset }); }).join('') + grid;
        }
        function detailScreen(ln, key) {
            var doc = entities[ln];
            var ctx = recordFor(ln, key);
            var tabs = formTabs(doc);
            var tabKey = ln + '|' + key;
            var active = state.formTab[tabKey] || tabs[0].logicalName;
            var back = targets[ln];
            return '<div class="ca-head">' + (back ? '<button class="ca-btn" data-nav="' + esc(back) + '">' + G.back + ' ' + esc(entities[back].entity.displayName) + '</button>' : '') +
                '<h1>' + esc(ctx.record ? recordLabel(ctx.ds, ctx.record) : doc.entity.displayName) + '</h1><span class="grow"></span>' +
                (can(ln, 'write') ? '<button class="ca-btn primary">' + G.save + ' Salva</button>' : '') + '</div>' +
                '<div class="pp-perms">' + permChips(ln) + '</div>' +
                '<div class="ca-header-fields">' + headerFields(doc, ctx) + '</div>' +
                '<div class="form-tabs">' + tabs.map(function (t) {
                    return '<button class="' + (t.logicalName === active ? 'active' : '') + '" data-form-tab="' + esc(t.logicalName) + '" data-tab-key="' + esc(tabKey) + '">' + esc(t.displayName) + '</button>';
                }).join('') + '</div>' +
                sectionsOfTab(doc, tabs, active).map(function (s) { return renderSection(s, ctx); }).join('');
        }
        function screen() {
            var doc = entities[state.screen];
            if (!doc) return notRendered('pagina "' + esc(state.screen) + '" inesistente');
            if (!canSee(state.screen)) return denied(state.screen);
            if (targets[state.screen] || state.key !== null) return detailScreen(state.screen, state.key);
            if (doc.entity.dataset) return listScreen(state.screen);
            var hero = doc.entity.hero || {};
            return '<div class="pp-hero"><h1>' + esc(hero.title || doc.entity.displayName) + '</h1>' + (hero.text ? '<p>' + esc(hero.text) + '</p>' : '') + '</div>' +
                (doc.sections || []).map(function (s) { return renderSection(s, { screen: state.screen, record: null, key: null }); }).join('');
        }
        function render() {
            var current = targets[state.screen] || state.screen;
            root.innerHTML = '<div class="ca-app pp-app"><header class="pp-top"><span class="ca-logo"></span><span class="ca-name">' + esc(app.displayName) + '</span>' +
                '<nav class="pp-nav">' + navList.map(function (ln) {
                    return entities[ln] ? '<button class="pp-nav-item' + (ln === current ? ' active' : '') + '" data-nav="' + esc(ln) + '">' + esc(entities[ln].entity.displayName) + '</button>' : '';
                }).join('') + '</nav><span class="grow"></span>' +
                '<span class="pp-persona-anchor"><button class="pp-persona" data-persona-menu="1">' + esc(personaName(state.persona)) + ' ' + G.chevron + '</button>' +
                (state.personaMenu ? '<div class="pp-menu"><div class="pp-menu-label">Simula la persona</div>' + personas.map(function (p) {
                    return '<button class="' + (p.logicalName === state.persona ? 'active' : '') + '" data-persona-select="' + esc(p.logicalName) + '">' + esc(p.displayName) + '</button>';
                }).join('') + '</div>' : '') + '</span></header>' +
                (cfg.showPrototypeBanner === false ? '' : '<div class="ca-banner"><span class="badge sim">Prototipo</span> <strong>Non è software funzionante.</strong> Sito Power Pages simulato: dati sintetici, persone e table permission dichiarate nel YAML.</div>') +
                '<main class="pp-main">' + screen() + '</main><footer class="pp-footer">' + esc(app.displayName) + ' · sito Power Pages (SPA)</footer></div>';
        }
        document.addEventListener('click', function (event) {
            var t = event.target;
            var menu = t.closest('[data-persona-menu]');
            var persona = t.closest('[data-persona-select]');
            var signin = t.closest('[data-persona-signin]');
            var formTab = t.closest('[data-form-tab]');
            var nav = t.closest('[data-nav]');
            var open = t.closest('[data-open]');
            var menuWasOpen = state.personaMenu;
            if (menu) { state.personaMenu = !state.personaMenu; render(); return; }
            state.personaMenu = false;
            if (!persona && !signin && !formTab && !nav && !open) { if (menuWasOpen) render(); return; }
            if (persona) state.persona = persona.getAttribute('data-persona-select');
            else if (signin) state.persona = signedIn;
            else if (formTab) state.formTab[formTab.getAttribute('data-tab-key')] = formTab.getAttribute('data-form-tab');
            else if (nav) { state.screen = nav.getAttribute('data-nav'); state.key = null; }
            else if (open) { event.preventDefault(); state.screen = open.getAttribute('data-open'); state.key = open.getAttribute('data-key'); }
            window.scrollTo(0, 0);
            render();
        });
        rerender = render;
        render();
    }

    global.PocApp = {
        registerComponent: function (type, fn) { custom[type] = fn; },
        // Simulazione condivisa: chiamata dopo ogni cambio dei dati (evento { type: change|reset|resync, dataset?, key? }).
        onDataChanged: function (fn) { dataListeners.push(fn); },
        model: M
    };
    function start() {
        var root = document.getElementById('app') || document.body;
        if (isMD) startModelDriven(root);
        else if (cfg.appType === 'power-pages') startPortal(root);
        else startCodeApp(root);
        // Con npm run sim i dati arrivano dallo stato condiviso; senza server resta tutto come prima.
        var S = global.PocSim;
        if (S) {
            S.onData(applySimData);
            S.connect().then(function (ok) { if (ok) applySimData({ type: 'resync' }); });
        }
    }
    // custom.js (caricato dopo) puo registrare renderer prima del primo render.
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
    else setTimeout(start, 0);
})(window);
