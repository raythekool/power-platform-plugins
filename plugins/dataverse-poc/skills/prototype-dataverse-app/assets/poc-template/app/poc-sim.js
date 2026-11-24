/* poc-sim.js — client della simulazione condivisa (references/simulazione-condivisa.md).
   Caricato solo in poc-runtime.html, mai in dist/*.html. Si attiva solo se /_sim/health risponde
   (npm run sim): altrimenti il prototipo resta in sola lettura come sempre.
   Espone window.PocSim: connect(), update(), create(), reload(), reset(), revOf(), onData(). */
(function (global) {
    'use strict';

    var POLL_MS = 5000;
    var clientId;
    try {
        clientId = sessionStorage.getItem('poc-sim-client');
        if (!clientId) { clientId = 'w-' + Math.random().toString(36).slice(2, 10); sessionStorage.setItem('poc-sim-client', clientId); }
    } catch (e) { clientId = 'w-' + Math.random().toString(36).slice(2, 10); }

    var datasets = {};   // ln -> { keyField, records (senza _rev) }
    var revs = {};       // ln -> { key -> _rev }
    var listeners = [];
    var lastRev = 0;
    var health = null;
    var source = null;
    var pollTimer = null;

    function esc(v) { return String(v === undefined || v === null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

    function request(method, path, body, headers) {
        var h = { 'X-Sim-Client': clientId };
        if (body !== undefined) h['Content-Type'] = 'application/json';
        Object.keys(headers || {}).forEach(function (k) { h[k] = headers[k]; });
        return fetch(path, { method: method, headers: h, body: body === undefined ? undefined : JSON.stringify(body), cache: 'no-store' })
            .then(function (res) {
                return res.text().then(function (text) {
                    var json = null;
                    try { json = text ? JSON.parse(text) : null; } catch (e) { json = null; }
                    if (!res.ok) { var err = new Error((json && json.message) || ('HTTP ' + res.status)); err.status = res.status; err.body = json || {}; throw err; }
                    return json;
                });
            });
    }

    // Toglie _rev dal record e lo memorizza a parte: il renderer non vede colonne tecniche.
    function strip(ln, rec) {
        var kf = datasets[ln] ? datasets[ln].keyField : null;
        var out = {};
        Object.keys(rec).forEach(function (k) { if (k !== '_rev') out[k] = rec[k]; });
        if (kf) { revs[ln] = revs[ln] || {}; revs[ln][String(rec[kf])] = rec._rev; }
        return out;
    }
    function upsert(ln, rec) {
        var d = datasets[ln];
        var clean = strip(ln, rec);
        var key = String(clean[d.keyField]);
        for (var i = 0; i < d.records.length; i++) {
            if (String(d.records[i][d.keyField]) === key) { d.records[i] = clean; return clean; }
        }
        d.records.push(clean);
        return clean;
    }
    function drop(ln, key) {
        var d = datasets[ln];
        d.records = d.records.filter(function (r) { return String(r[d.keyField]) !== String(key); });
        if (revs[ln]) delete revs[ln][String(key)];
    }
    function emit(event) { listeners.forEach(function (fn) { try { fn(event); } catch (e) { console.error(e); } }); }

    function loadAll() {
        return request('GET', '/_sim/api/data').then(function (summary) {
            var names = Object.keys(summary.datasets);
            return Promise.all(names.map(function (ln) { return request('GET', '/_sim/api/data/' + encodeURIComponent(ln)); })).then(function (lists) {
                datasets = {};
                revs = {};
                names.forEach(function (ln, i) {
                    datasets[ln] = { keyField: lists[i].keyField, records: [] };
                    lists[i].records.forEach(function (r) { datasets[ln].records.push(strip(ln, r)); });
                });
                lastRev = summary.rev;
            });
        });
    }

    // --- banner, messaggi e dialog ------------------------------------------------
    function banner() {
        var el = document.getElementById('poc-sim-banner');
        if (!el) {
            el = document.createElement('div');
            el.id = 'poc-sim-banner';
            el.setAttribute('role', 'status');
            document.body.appendChild(el);
            el.addEventListener('click', function (e) { if (e.target.closest('[data-sim-reset]')) confirmReset(); });
        }
        var warn = !health ? '' : health.status === 'corrupt'
            ? '<span class="sim-warn">Stato della simulazione illeggibile.</span>'
            : health.seedChanged ? '<span class="sim-warn">Dati iniziali cambiati (config/data).</span>' : '';
        el.className = warn ? 'warn' : '';
        el.innerHTML = '<span class="sim-dot"></span><strong>Simulazione locale</strong> · dati sintetici, nessun Dataverse' +
            (health && health.status === 'ok' ? ' · rev <span data-sim-rev>' + esc(lastRev) + '</span>' : '') + warn +
            '<button type="button" data-sim-reset>Ripristina</button>';
    }

    function dialog(title, text, buttons) {
        return new Promise(function (resolve) {
            var wrap = document.createElement('div');
            wrap.className = 'poc-sim-dialog';
            wrap.innerHTML = '<div class="box" role="dialog" aria-modal="true" aria-label="' + esc(title) + '"><h2>' + esc(title) + '</h2><p>' + esc(text) + '</p><div class="actions">' +
                buttons.map(function (b) { return '<button type="button" data-choice="' + esc(b.value) + '"' + (b.primary ? ' class="primary"' : '') + '>' + esc(b.label) + '</button>'; }).join('') + '</div></div>';
            wrap.addEventListener('click', function (e) {
                var btn = e.target.closest('[data-choice]');
                if (!btn) return;
                document.body.removeChild(wrap);
                resolve(btn.getAttribute('data-choice'));
            });
            document.body.appendChild(wrap);
            var first = wrap.querySelector('button.primary') || wrap.querySelector('button');
            if (first) first.focus();
        });
    }

    function confirmReset() {
        return dialog('Ripristinare la simulazione?', 'Tutte le finestre tornano ai dati iniziali di config/data. Lo stato attuale viene salvato in .sim/backup/.',
            [{ label: 'Annulla', value: 'no' }, { label: 'Ripristina', value: 'yes', primary: true }])
            .then(function (choice) { if (choice === 'yes') return api.reset(); });
    }

    // --- sincronizzazione ---------------------------------------------------------
    function resync(reason) {
        return loadAll().then(function () {
            return request('GET', '/_sim/health').then(function (h) { health = h; banner(); });
        }).then(function () { emit({ type: reason || 'resync' }); });
    }

    function checkHealth() {
        return request('GET', '/_sim/health').then(function (h) {
            var changed = h.rev !== lastRev || (health && (h.status !== health.status || h.seedChanged !== health.seedChanged));
            health = h;
            if (h.status !== 'ok') { banner(); emit({ type: 'unavailable' }); return; }
            if (changed) return resync('resync');
            banner();
        }).catch(function () { /* server fermo: si riprova al prossimo giro */ });
    }

    function startPolling() {
        if (!pollTimer) pollTimer = setInterval(checkHealth, POLL_MS);
    }

    function listen() {
        if (!global.EventSource) { startPolling(); return; }
        source = new EventSource('/_sim/events');
        source.addEventListener('hello', function (e) {
            var data = JSON.parse(e.data);
            if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
            if (data.rev !== lastRev) resync('resync');
        });
        source.addEventListener('change', function (e) {
            var ev = JSON.parse(e.data);
            if (ev.clientId === clientId) { lastRev = Math.max(lastRev, ev.rev); banner(); return; }
            if (!datasets[ev.dataset]) return;
            if (ev.op === 'delete') {
                drop(ev.dataset, ev.key);
                lastRev = Math.max(lastRev, ev.rev);
                banner();
                emit({ type: 'change', dataset: ev.dataset, key: ev.key, op: ev.op });
                return;
            }
            request('GET', '/_sim/api/data/' + encodeURIComponent(ev.dataset) + '/' + encodeURIComponent(ev.key)).then(function (rec) {
                upsert(ev.dataset, rec);
                lastRev = Math.max(lastRev, ev.rev);
                banner();
                emit({ type: 'change', dataset: ev.dataset, key: ev.key, op: ev.op });
            }).catch(function () { resync('resync'); });
        });
        source.addEventListener('reset', function () { resync('reset'); });
        source.onerror = function () { startPolling(); };
        document.addEventListener('visibilitychange', function () { if (!document.hidden) checkHealth(); });
    }

    var api = {
        enabled: false,
        clientId: clientId,
        get health() { return health; },
        datasets: function () { return datasets; },
        revOf: function (ln, key) { return revs[ln] ? revs[ln][String(key)] : undefined; },
        onData: function (fn) { listeners.push(fn); },

        // Risolve true se la simulazione e attiva (server raggiungibile e stato leggibile).
        connect: function () {
            if (location.protocol !== 'http:' && location.protocol !== 'https:') return Promise.resolve(false);
            return request('GET', '/_sim/health').then(function (h) {
                health = h;
                api.enabled = true;
                banner();
                listen();
                if (h.status !== 'ok') return false;
                return loadAll().then(function () { banner(); return true; });
            }).catch(function () { return false; });
        },

        // rev: la revisione su cui l'utente ha iniziato a modificare (default: l'ultima nota).
        update: function (ln, key, patch, rev) {
            var expected = rev === undefined || rev === null ? api.revOf(ln, key) : rev;
            return request('PATCH', '/_sim/api/data/' + encodeURIComponent(ln) + '/' + encodeURIComponent(key), patch, { 'If-Match': '"' + expected + '"' })
                .then(function (rec) { return upsert(ln, rec); });
        },
        create: function (ln, record) {
            return request('POST', '/_sim/api/data/' + encodeURIComponent(ln), record).then(function (rec) { return upsert(ln, rec); });
        },
        // Chiede conferma ed elimina; 409 referenced se altri record lo usano nei lookup.
        remove: function (ln, key) {
            return dialog('Eliminare il record?', 'Il record ' + key + ' viene eliminato in tutte le finestre. Ripristina riporta i dati iniziali.',
                [{ label: 'Annulla', value: 'no' }, { label: 'Elimina', value: 'yes', primary: true }])
                .then(function (choice) {
                    if (choice !== 'yes') return false;
                    return request('DELETE', '/_sim/api/data/' + encodeURIComponent(ln) + '/' + encodeURIComponent(key), undefined, { 'If-Match': '"' + api.revOf(ln, key) + '"' })
                        .then(function () { drop(ln, key); return true; });
                });
        },
        // Conflitto 409: aggiorna il record locale con quello del server e chiede cosa fare.
        resolveConflict: function (ln, err) {
            var current = err.body && err.body.current;
            if (current) upsert(ln, current);
            return dialog('Record modificato in un\'altra finestra', 'Qualcuno ha salvato questo record dopo che lo hai aperto. Ricarica per vedere la sua versione, oppure sovrascrivi con le tue modifiche.',
                [{ label: 'Ricarica', value: 'reload' }, { label: 'Sovrascrivi', value: 'overwrite', primary: true }]);
        },
        reload: function () { return resync('resync'); },
        reset: function () { return request('POST', '/_sim/reset', {}).then(function () { return resync('reset'); }); },
        confirmReset: confirmReset
    };

    global.PocSim = api;
})(window);
