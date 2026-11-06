/* mda-shell.js — motore di navigazione riusabile per prototipi Dataverse in stile
   Dynamics 365 CE (Unified Interface / Copilot Service workspace).
   Fa parte della skill prototype-dataverse-app: copiare in <poc-root>/app/ e
   comporre con i renderer di dominio del progetto (KPI, BPF, griglie, ecc.).
   Non contiene alcuna logica specifica di un progetto: legge solo le convenzioni
   dichiarate in config/index.yaml (entities[].pageType, navigation.areas).
   Riferimenti: references/dynamics-365-chrome.md nella stessa skill. */
(function (global) {
    'use strict';

    var GLYPH = {
        waffle: '\u229E', dashboard: '\u25A6', view: '\u2630', 'custom-page': '\u25A4',
        form: '\u25A2', home: '\u2302', recent: '\u25F7', pinned: '\u2691',
        search: '\u2315', settings: '\u2699', help: '?', plus: '+', refresh: '\u21BB',
        save: '\u2714', del: '\u2715', edit: '\u270E', down: '\u21E9', mail: '\u2709',
        flow: '\u26A1', chart: '\u25A4', more: '\u22EF', chevron: '\u25BE',
        back: '\u2190', assign: '\u21C4', close: '\u2715', link: '\u26AD'
    };

    function esc(value) {
        return String(value === undefined || value === null ? '' : value)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    // --- stato --------------------------------------------------------------
    // Una sola scheda all'avvio, come la sessione Home di un'app model-driven.
    function createState(cfg) {
        return {
            tabs: [{ screen: cfg.demoPath[0], key: null }],
            active: 0,
            sitemapOpen: true,
            sitemapWidth: 260,
            area: (cfg.navigation.areas[0] || {}).logicalName,
            areaMenuOpen: false,
            appMenuOpen: false,
            appLogicalName: cfg.application.logicalName,
            recent: [],
            pinned: [],
            expand: { recent: true, pinned: false },
            viewMenuOpen: false
        };
    }

    function activeTab(state) { return state.tabs[state.active]; }

    // Learn: "when a representative opens a page from the site map, the page
    // loads in the current focused session" -> sostituisce la scheda a fuoco.
    function openInCurrentTab(state, screen) {
        state.tabs[state.active] = { screen: screen, key: null };
        state.viewMenuOpen = false;
    }

    // Learn: aprire un record da una vista apre una nuova scheda (max 10),
    // riusando quella esistente se il record e gia aperto.
    function openRecord(state, screen, key) {
        var existing = -1;
        state.tabs.forEach(function (t, i) { if (t.screen === screen && t.key === key) existing = i; });
        if (existing >= 0) { state.active = existing; return; }
        if (state.tabs.length >= 10) state.tabs.shift();
        state.tabs.push({ screen: screen, key: key });
        state.active = state.tabs.length - 1;
        state.viewMenuOpen = false;
        pushRecent(state, screen, key);
    }

    function closeTab(state, index) {
        if (state.tabs.length === 1) return;
        state.tabs.splice(index, 1);
        if (state.active >= state.tabs.length) state.active = state.tabs.length - 1;
    }

    function pushRecent(state, screen, key) {
        state.recent = state.recent.filter(function (r) { return !(r.screen === screen && r.key === key); });
        state.recent.unshift({ screen: screen, key: key });
        if (state.recent.length > 10) state.recent.pop();
    }

    function pinRecent(state, index) {
        var item = state.recent[index];
        if (item && !state.pinned.some(function (p) { return p.key === item.key && p.screen === item.screen; })) {
            state.pinned.push(item);
        }
        state.expand.pinned = true;
    }

    function switchArea(state, cfg) {
        var areas = cfg.navigation.areas;
        var index = areas.findIndex(function (a) { return a.logicalName === state.area; });
        state.area = areas[(index + 1) % areas.length].logicalName;
    }

    function selectArea(state, logicalName) {
        state.area = logicalName;
        state.areaMenuOpen = false;
    }

    function selectApp(state, logicalName) {
        state.appLogicalName = logicalName;
        state.appMenuOpen = false;
    }

    // --- rendering: shell fissa -----------------------------------------------
    function renderHeader(cfg, userInitials) {
        var selectedApp = (cfg.modelDrivenApps || [cfg.application]).filter(function (app) {
            return app.logicalName === state.appLogicalName;
        })[0] || cfg.application;
        var appMenu = (cfg.modelDrivenApps || [cfg.application]).map(function (app) {
            return '<button class="shell-menu-item' + (app.logicalName === selectedApp.logicalName ? ' selected' : '') +
                '" data-app-select="' + esc(app.logicalName) + '"><span class="check">' +
                (app.logicalName === selectedApp.logicalName ? '\u2713' : '') + '</span><span>' +
                esc(app.displayName) + '</span></button>';
        }).join('');
        return '<header class="mda-header">' +
            '<button class="hdr-btn" data-toggle-sitemap="1" title="Espandi o comprimi la site map">\u2261</button>' +
            '<span class="hdr-btn" title="Utilita">' + GLYPH.waffle + '</span>' +
            '<span class="product">Dynamics 365</span>' +
            '<span class="sep"></span>' +
            '<span class="app-menu-anchor"><button class="app-name" data-app-menu="1">' + esc(selectedApp.displayName) +
            '<span class="chev">' + GLYPH.chevron + '</span></button>' +
            (state.appMenuOpen ? '<div class="shell-menu app-menu"><div class="shell-menu-label">App model-driven</div>' + appMenu + '</div>' : '') +
            '</span>' +
            '<span class="grow"></span>' +
            '<span class="search">' + GLYPH.search + ' Cerca record</span>' +
            '<span class="grow"></span>' +
            '<span class="hdr-btn">' + GLYPH.plus + '</span>' +
            '<span class="hdr-btn">' + GLYPH.settings + '</span>' +
            '<span class="hdr-btn">' + GLYPH.help + '</span>' +
            '<span class="avatar">' + esc(userInitials || 'MD') + '</span>' +
            '</header>';
    }

    // cfg.showPrototypeBanner === false nasconde l'avviso di pagina (utile per una
    // demo gia rodata con lo sponsor). I badge "Simulazione" sui singoli componenti
    // NON dipendono da questo flag e restano sempre visibili: e' una regola di
    // sicurezza della skill, non negoziabile per progetto (vedi dynamics-365-chrome.md).
    // Effetto collaterale voluto: aggiorna --banner-h cosi la barra schede e la
    // site map restano agganciate correttamente sotto l'header quando il banner e
    // nascosto.
    function renderProtoBanner(cfg, message) {
        var show = !cfg || cfg.showPrototypeBanner !== false;
        if (document.documentElement) {
            document.documentElement.style.setProperty('--banner-h', show ? '29px' : '0px');
        }
        if (!show) return '';
        return '<div class="proto-banner"><span class="badge sim">Prototipo</span>' +
            '<span>' + (message || '<strong>Non \u00e8 software funzionante.</strong> Dati sintetici, nessuna connessione a Dataverse.') + '</span></div>';
    }

    // titleForTab(tab) -> string; pageTypeForTab(tab) -> 'dashboard'|'view'|'form'|'custom-page'
    function renderTabstrip(state, titleForTab, pageTypeForTab) {
        var html = '<div class="tabstrip">';
        state.tabs.forEach(function (tab, index) {
            var type = pageTypeForTab(tab);
            var isHomeTab = index === 0 && !tab.key;
            html += '<button class="tab' + (index === state.active ? ' active' : '') + '" data-tab="' + index + '">' +
                '<span class="glyph">' + (isHomeTab ? GLYPH.home : GLYPH[type]) + '</span>' +
                '<span class="label">' + esc(titleForTab(tab)) + '</span>' +
                (state.tabs.length > 1 ? '<span class="close" data-close-tab="' + index + '">' + GLYPH.close + '</span>' : '') +
                '</button>';
        });
        html += '<span class="tab-count">' + state.tabs.length + ' di 10 schede</span>';
        return html + '</div>';
    }

    // opts.entityByName(screen) -> { entity: { pageType, displayName } } | null
    // opts.navCount(screen) -> { value, alert } | null
    // opts.recordLabel(screen, key) -> string, usata per Recenti/Aggiunti
    function renderSitemap(state, cfg, opts) {
        var current = activeTab(state).screen;
        var area = cfg.navigation.areas.filter(function (a) { return a.logicalName === state.area; })[0] || cfg.navigation.areas[0];
        var home = cfg.demoPath[0];

        function navItem(screen, isActive) {
            var entity = opts.entityByName(screen);
            var standard = opts.standardPageByName ? opts.standardPageByName(screen) : null;
            if (!entity && !standard) return '';
            var count = opts.navCount ? opts.navCount(screen) : null;
            var pageType = entity ? entity.entity.pageType : standard.pageType;
            var displayName = entity ? entity.entity.displayName : standard.displayName;
            return '<button class="nav-item' + (isActive ? ' active' : '') + '" data-nav="' + esc(screen) + '">' +
                '<span class="glyph">' + (GLYPH[pageType] || GLYPH.view) + '</span>' +
                '<span class="nav-label">' + esc(displayName) + '</span>' +
                (count ? '<span class="nav-count' + (count.alert && count.value ? ' alert' : '') + '">' + count.value + '</span>' : '') +
                '</button>';
        }

        var widthStyle = state.sitemapOpen ? ' style="width:' + state.sitemapWidth + 'px;flex-basis:' + state.sitemapWidth + 'px"' : '';
        var html = '<nav class="sitemap' + (state.sitemapOpen ? '' : ' collapsed') + '"' + widthStyle + '>';

        if (cfg.navigation.showHome) {
            html += '<button class="nav-item' + (current === home ? ' active' : '') + '" data-nav="' + esc(home) + '">' +
                '<span class="glyph">' + GLYPH.home + '</span><span class="nav-label">Home</span></button>';
        }

        if (cfg.navigation.showRecent) {
            html += '<button class="nav-item" data-expand="recent"><span class="glyph">' + GLYPH.recent + '</span>' +
                '<span class="nav-label">Recenti</span><span class="nav-count">' + GLYPH.chevron + '</span></button>';
            if (state.expand.recent) {
                if (!state.recent.length) html += '<div class="sub-empty">Nessun record aperto di recente.</div>';
                state.recent.forEach(function (item, index) {
                    html += '<button class="sub-item" data-open="' + esc(item.screen) + '" data-key="' + esc(item.key) + '">' +
                        '<span class="name">' + esc(opts.recordLabel(item.screen, item.key)) + '</span>' +
                        '<span class="pin" data-pin="' + index + '" title="Aggiungi ai preferiti">' + GLYPH.pinned + '</span></button>';
                });
            }
        }

        if (cfg.navigation.showPinned) {
            html += '<button class="nav-item" data-expand="pinned"><span class="glyph">' + GLYPH.pinned + '</span>' +
                '<span class="nav-label">Aggiunti</span><span class="nav-count">' + GLYPH.chevron + '</span></button>';
            if (state.expand.pinned) {
                if (!state.pinned.length) html += '<div class="sub-empty">Usa l\'icona nei Recenti per aggiungere un record.</div>';
                state.pinned.forEach(function (item) {
                    html += '<button class="sub-item" data-open="' + esc(item.screen) + '" data-key="' + esc(item.key) + '">' +
                        '<span class="name">' + esc(opts.recordLabel(item.screen, item.key)) + '</span></button>';
                });
            }
        }

        html += '<div class="divider"></div>';
        (area.groups || []).forEach(function (group) {
            html += '<div class="group-label">' + esc(group.displayName) + '</div>';
            (group.items || []).forEach(function (screen) {
                var logicalName = typeof screen === 'object' ? screen.logicalName : screen;
                html += navItem(logicalName, logicalName === current);
            });
        });

        html += '<div class="spacer"></div>';
        if (cfg.navigation.areas.length > 1) {
            var areaMenu = cfg.navigation.areas.map(function (menuArea) {
                return '<button class="shell-menu-item' + (menuArea.logicalName === state.area ? ' selected' : '') +
                    '" data-area-select="' + esc(menuArea.logicalName) + '"><span class="check">' +
                    (menuArea.logicalName === state.area ? '\u2713' : '') + '</span><span>' +
                    esc(menuArea.displayName) + '</span></button>';
            }).join('');
            html += '<span class="area-menu-anchor"><button class="area-switcher" data-area-menu="1">' +
                '<span class="glyph">' + GLYPH.view + '</span>' +
                '<span class="area-name">' + esc(area.displayName) + '</span>' +
                '<span class="chev">' + GLYPH.chevron + '</span></button>' +
                (state.areaMenuOpen ? '<div class="shell-menu area-menu"><div class="shell-menu-label">Area di lavoro</div>' + areaMenu + '</div>' : '') +
                '</span>';
        }
        html += '</nav>';
        // Maniglia di drag-resize: solo da aperta, per non farla comparire sopra la
        // rail collassata a 48px.
        if (state.sitemapOpen) html += '<div class="sitemap-resizer" data-resizer="1"></div>';
        return html;
    }

    // --- rendering: comandi e griglia ------------------------------------------
    // commands: array di { label, glyph?, disabled? } oppure '|' per un separatore.
    function commandBar(commands) {
        var html = '<div class="command-bar">';
        commands.forEach(function (cmd) {
            if (cmd === '|') { html += '<span class="sep"></span>'; return; }
            html += '<button class="cmd' + (cmd.disabled ? ' disabled' : '') + '">' +
                (cmd.glyph ? '<span class="glyph">' + cmd.glyph + '</span>' : '') + esc(cmd.label) + '</button>';
        });
        return html + '<span class="grow"></span></div>';
    }

    function gridFooter(count) {
        var letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
        return '<div class="grid-footer"><span>1 - ' + count + ' di ' + count + '</span>' +
            '<span class="grow"></span>' +
            '<div class="jump-bar">' + letters.map(function (l) { return '<span>' + l + '</span>'; }).join('') + '</div>' +
            '<span class="grow"></span>' +
            '<div class="pager"><span>Pagina 1</span><span>\u2039</span><span>\u203A</span></div></div>';
    }

    // --- interazioni comuni -----------------------------------------------------
    // Da chiamare da un unico listener 'click' del renderer di dominio, prima
    // delle interazioni specifiche del progetto (kpi, viste, campi...). Ritorna
    // true se ha gestito il click e il chiamante deve solo ri-renderizzare.
    function handleShellClick(event, state, cfg, render) {
        var closeTabBtn = event.target.closest('[data-close-tab]');
        if (closeTabBtn) { event.stopPropagation(); closeTab(state, Number(closeTabBtn.getAttribute('data-close-tab'))); render(); return true; }

        var pin = event.target.closest('[data-pin]');
        if (pin) { event.stopPropagation(); pinRecent(state, Number(pin.getAttribute('data-pin'))); render(); return true; }

        var tabBtn = event.target.closest('[data-tab]');
        if (tabBtn) { state.active = Number(tabBtn.getAttribute('data-tab')); state.viewMenuOpen = false; render(); return true; }

        var nav = event.target.closest('[data-nav]');
        if (nav) { openInCurrentTab(state, nav.getAttribute('data-nav')); window.scrollTo(0, 0); render(); return true; }

        var expand = event.target.closest('[data-expand]');
        if (expand) { var key = expand.getAttribute('data-expand'); state.expand[key] = !state.expand[key]; render(); return true; }

        if (event.target.closest('[data-toggle-sitemap]')) { state.sitemapOpen = !state.sitemapOpen; render(); return true; }

        if (event.target.closest('[data-area-menu]')) {
            state.areaMenuOpen = !state.areaMenuOpen;
            state.appMenuOpen = false;
            render();
            return true;
        }

        var areaPick = event.target.closest('[data-area-select]');
        if (areaPick) { selectArea(state, areaPick.getAttribute('data-area-select')); render(); return true; }

        if (event.target.closest('[data-app-menu]')) {
            state.appMenuOpen = !state.appMenuOpen;
            state.areaMenuOpen = false;
            render();
            return true;
        }

        var appPick = event.target.closest('[data-app-select]');
        if (appPick) { selectApp(state, appPick.getAttribute('data-app-select')); render(); return true; }

        var open = event.target.closest('[data-open]');
        if (open) {
            event.preventDefault();
            openRecord(state, open.getAttribute('data-open'), open.getAttribute('data-key'));
            window.scrollTo(0, 0);
            render();
            return true;
        }

        return false;
    }

    // Da chiamare una sola volta all'avvio (non dentro render()): il drag muta
    // direttamente lo stile DOM di .sitemap per restare fluido, e scrive il
    // valore finale in state.sitemapWidth solo al rilascio, cosi il prossimo
    // render() completo lo mantiene. Disabilitato quando la site map e' collassata
    // perche' in quel caso non esiste alcuna maniglia nel markup.
    function enableSitemapResize(state) {
        var resizing = false;
        document.addEventListener('mousedown', function (event) {
            if (!event.target.closest('[data-resizer]')) return;
            resizing = true;
            document.body.style.cursor = 'col-resize';
            event.preventDefault();
        });
        document.addEventListener('mousemove', function (event) {
            if (!resizing) return;
            var sitemapEl = document.querySelector('.sitemap');
            if (!sitemapEl) return;
            var rect = sitemapEl.getBoundingClientRect();
            var width = Math.max(200, Math.min(420, event.clientX - rect.left));
            state.sitemapWidth = width;
            sitemapEl.style.width = width + 'px';
            sitemapEl.style.flexBasis = width + 'px';
        });
        document.addEventListener('mouseup', function () {
            if (!resizing) return;
            resizing = false;
            document.body.style.cursor = '';
        });
    }

    global.MdaShell = {
        GLYPH: GLYPH,
        esc: esc,
        createState: createState,
        activeTab: activeTab,
        openInCurrentTab: openInCurrentTab,
        openRecord: openRecord,
        closeTab: closeTab,
        pushRecent: pushRecent,
        pinRecent: pinRecent,
        switchArea: switchArea,
        selectArea: selectArea,
        selectApp: selectApp,
        renderHeader: renderHeader,
        renderProtoBanner: renderProtoBanner,
        renderTabstrip: renderTabstrip,
        renderSitemap: renderSitemap,
        commandBar: commandBar,
        gridFooter: gridFooter,
        handleShellClick: handleShellClick,
        enableSitemapResize: enableSitemapResize
    };
})(window);
