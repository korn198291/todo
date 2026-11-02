(function () {
  'use strict';
  var electron = /Electron/.test(navigator.userAgent);
  if (electron) document.documentElement.classList.add('electron');
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  /* ---------- dates ---------- */
  var MONTHS = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
  var MON3 = ['janv.','févr.','mars','avr.','mai','juin','juil.','août','sept.','oct.','nov.','déc.'];
  var DAYS = ['dimanche','lundi','mardi','mercredi','jeudi','vendredi','samedi'];
  var WD1 = ['L','M','M','J','V','S','D'];
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function dayKey(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function parseDay(k) { var p = k.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function addDays(d, n) { return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n); }
  function startOfWeek(d) { return addDays(d, -((d.getDay() + 6) % 7)); }
  function isoWeek(d) {
    var t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    var n = t.getUTCDay() || 7;
    t.setUTCDate(t.getUTCDate() + 4 - n);
    var y = t.getUTCFullYear();
    return { y: y, w: Math.ceil(((t - Date.UTC(y, 0, 1)) / 864e5 + 1) / 7) };
  }
  function quarter(d) { return Math.floor(d.getMonth() / 3) + 1; }
  function key(type, d) {
    switch (type) {
      case 'day': return dayKey(d);
      case 'week': var w = isoWeek(d); return w.y + '-W' + pad(w.w);
      case 'month': return d.getFullYear() + '-' + pad(d.getMonth() + 1);
      case 'quarter': return d.getFullYear() + '-Q' + quarter(d);
      default: return '' + d.getFullYear();
    }
  }
  function range(s, e) {
    return s.getMonth() === e.getMonth()
      ? s.getDate() + ' au ' + e.getDate() + ' ' + MON3[e.getMonth()]
      : s.getDate() + ' ' + MON3[s.getMonth()] + ' au ' + e.getDate() + ' ' + MON3[e.getMonth()];
  }
  var todayK = dayKey(new Date());
  // Aujourd'hui / Demain / Hier, sinon chaîne vide
  function rel(d) {
    var n = Math.round((d - parseDay(todayK)) / 864e5);
    return n === 0 ? 'Aujourd’hui' : n === 1 ? 'Demain' : n === -1 ? 'Hier' : '';
  }
  function info(type, d) {
    switch (type) {
      case 'day': return { tag: rel(d) || 'Jour', title: cap(DAYS[d.getDay()]) + ' ' + d.getDate() + ' ' + MONTHS[d.getMonth()], sub: '' };
      case 'week': var s = startOfWeek(d); return { tag: 'Semaine', title: 'Semaine ' + isoWeek(d).w, sub: range(s, addDays(s, 6)) };
      case 'month': return { tag: 'Mois', title: cap(MONTHS[d.getMonth()]), sub: '' + d.getFullYear() };
      case 'quarter': var q = quarter(d); return { tag: 'Trimestre', title: 'T' + q, sub: MONTHS[(q - 1) * 3] + ' à ' + MONTHS[q * 3 - 1] };
      default: return { tag: 'Année', title: '' + d.getFullYear(), sub: '' };
    }
  }

  /* ---------- données : localStorage "todo.v2" [{id,text,done,t,k}], l'ordre du tableau = l'ordre d'affichage ---------- */
  var KEY = 'todo.v2';
  var TYPES = ['day', 'week', 'month', 'quarter', 'year'];
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function load() {
    try {
      var v = JSON.parse(localStorage.getItem(KEY));
      if (Array.isArray(v)) return v.filter(function (t) { return t && typeof t.text === 'string' && TYPES.indexOf(t.t) >= 0 && typeof t.k === 'string'; })
        .map(function (t, i) { return { id: t.id || uid(), text: t.text, done: !!t.done, t: t.t, k: t.k, o: typeof t.o === 'number' ? t.o : i, u: t.u || Date.now(), d: t.u ? !!t.d : true, s: cleanSubs(t.s), c: cleanColor(t.c) }; });
    } catch (e) {}
    try { // migration depuis la v1 (liste simple) : tout va sur aujourd'hui
      var o = JSON.parse(localStorage.getItem('todo.v1'));
      if (Array.isArray(o)) return o.map(function (t, i) { return { id: t.id || uid(), text: String(t.text), done: !!t.done, t: 'day', k: todayK, o: i, u: Date.now(), d: true }; });
    } catch (e) {}
    return [];
  }
  var COLORS = ['y', 'p', 'g', 'b', 'v'];
  function cleanColor(c) { return COLORS.indexOf(c) >= 0 ? c : ''; }
  function cleanSubs(a) {
    return Array.isArray(a) ? a.filter(function (x) { return x && typeof x.text === 'string' && x.text; })
      .map(function (x) { return { id: x.id || uid(), text: x.text, done: !!x.done }; }) : [];
  }
  var TKEY = 'todo.tombs';
  var tasks = load();
  var tombs = (function () { // suppressions à propager à l'autre appareil (pierres tombales)
    try { var v = JSON.parse(localStorage.getItem(TKEY)); if (Array.isArray(v)) return v.filter(function (r) { return r && r.id && !(!r.d && r.u < Date.now() - 30 * 864e5); }); } catch (e) {}
    return [];
  })();
  function persist() { try { localStorage.setItem(KEY, JSON.stringify(tasks)); localStorage.setItem(TKEY, JSON.stringify(tombs)); } catch (e) {} }
  function save() { persist(); if (window.TodoSync) TodoSync.schedule(); }
  function touch(t) { t.u = Date.now(); t.d = true; }   // modifiée : à envoyer
  function orderAt(t) {                                  // ordre entre ses voisins du tableau (une seule ligne modifiée)
    var i = tasks.indexOf(t), p = tasks[i - 1], n = tasks[i + 1];
    t.o = p && n ? (p.o + n.o) / 2 : p ? p.o + 1 : n ? n.o - 1 : 0;
    touch(t);
  }
  function entomb(t) { tombs = tombs.filter(function (r) { return r.id !== t.id; }); tombs.push({ id: t.id, text: t.text, done: t.done, t: t.t, k: t.k, o: t.o, s: t.s || [], c: t.c || '', u: Date.now(), d: true, x: true }); }
  function unTomb(t) { tombs = tombs.filter(function (r) { return r.id !== t.id; }); }
  function byId(id) { return tasks.filter(function (x) { return x.id === id; })[0]; }
  function undoneFirst(l) { return l.filter(function (t) { return !t.done; }).concat(l.filter(function (t) { return t.done; })); }
  function tasksFor(type, d) { var k = key(type, d); return undoneFirst(tasks.filter(function (t) { return t.t === type && t.k === k; })); }
  function overdue() { return tasks.filter(function (t) { return t.t === 'day' && t.k < todayK && !t.done; }).sort(function (a, b) { return a.k < b.k ? -1 : a.k > b.k ? 1 : 0; }); }

  /* ---------- état ---------- */
  var state = { view: 'hz', sel: parseDay(todayK), cal: null };
  state.cal = new Date(state.sel.getFullYear(), state.sel.getMonth(), 1);
  var entering = {}, focusType = null, focusSub = null, timer = null, dragId = null;

  /* ---------- DOM ---------- */
  function ico(p) { return '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true">' + p + '</svg>'; }
  var IC = {
    check: ico('<path pathLength="1" d="M7 12.5l3.2 3.2L17 8.8"/>'),
    x: ico('<path d="M6 12h12"/>'),
    cal: ico('<rect x="4" y="5.5" width="16" height="14" rx="3"/><path d="M4 10h16M9 3.5v4M15 3.5v4"/>'),
    plus: ico('<path d="M12 5v14"/>'),
    left: ico('<path d="M14.5 6l-6 6 6 6"/>'),
    right: ico('<path d="M9.5 6l6 6-6 6"/>'),
    help: ico('<circle cx="12" cy="12" r="8.5"/><path d="M9.7 9.6a2.4 2.4 0 1 1 3.4 2.2c-.7.4-1.1.9-1.1 1.7M12 16.6v.1"/>'),
    cfg: ico('<path d="M4 8h9M17 8h3M4 16h3M11 16h9"/><circle cx="15" cy="8" r="2"/><circle cx="9" cy="16" r="2"/>'),
    sub: ico('<path d="M7 5v8a3 3 0 0 0 3 3h8"/><path d="M15 12.5l3 3.5-3 3.5"/>'),
    close: ico('<path d="M6 6l12 12M18 6L6 18"/>')
  };
  function h(tag, props, kids) {
    var e = document.createElement(tag);
    for (var k in (props || {})) {
      var v = props[k];
      if (k === 'class') e.className = v;
      else if (k === 'text') e.textContent = v;
      else if (k === 'html') e.innerHTML = v;
      else if (k.slice(0, 2) === 'on') e[k] = v;
      else e.setAttribute(k, v);
    }
    (kids || []).forEach(function (c) { if (c) e.append(c); });
    return e;
  }
  function navBtn(dir, label, fn) { return h('button', { class: 'nav', type: 'button', 'aria-label': label, html: IC[dir], onclick: fn }); }
  var live = h('div', { class: 'sr', role: 'status', 'aria-live': 'polite' });
  function say(msg) { live.textContent = ''; setTimeout(function () { live.textContent = msg; }, 30); }

  /* ---------- actions sur les données ---------- */
  function place(t, target, after) { // déplace t à côté de target (dans la carte de target)
    tasks = tasks.filter(function (x) { return x !== t; });
    t.t = target.t; t.k = target.k;
    var i = tasks.indexOf(target);
    tasks.splice(after ? i + 1 : i, 0, t);
    orderAt(t);
    save(); render();
  }
  function move(t, type, d) { t.t = type; t.k = key(type, d); tasks = tasks.filter(function (x) { return x !== t; }); tasks.push(t); orderAt(t); entering[t.id] = 1; save(); closeMenu(); render(); say('Tâche déplacée'); }
  function nudge(t, dir) { // réordonne au clavier (Alt + flèches)
    var sib = tasks.filter(function (x) { return x.t === t.t && x.k === t.k && x.done === t.done; });
    var nb = sib[sib.indexOf(t) + dir];
    if (!nb) return;
    var a = tasks.indexOf(t), b = tasks.indexOf(nb);
    tasks[a] = nb; tasks[b] = t;
    var oo = t.o; t.o = nb.o; nb.o = oo; touch(t); touch(nb);
    save(); render(); say('Tâche déplacée ' + (dir < 0 ? 'vers le haut' : 'vers le bas'));
  }
  function addSub(t, after) { // nouvelle sous-tâche (vide : retirée si on la quitte sans rien écrire)
    var n = { id: uid(), text: '', done: false };
    t.s = t.s || [];
    t.s.splice(after ? t.s.indexOf(after) + 1 : t.s.length, 0, n);
    touch(t); focusSub = n.id; save(); render();
  }
  function removeSub(t, s) { t.s = (t.s || []).filter(function (x) { return x !== s; }); touch(t); save(); render(); }
  function setColor(t, c) { t.c = c; touch(t); save(); closeMenu(); render(); say(c ? 'Tâche surlignée' : 'Surlignage retiré'); }
  function remove(t, li) {
    var i = tasks.indexOf(t);
    function commit() {
      tasks = tasks.filter(function (x) { return x !== t; }); entomb(t); save(); render();
      toast('Tâche supprimée', 'Annuler', function () { tasks.splice(Math.min(i, tasks.length), 0, t); unTomb(t); orderAt(t); save(); render(); say('Suppression annulée'); });
    }
    if (li && li.animate && !reduceMotion.matches) {
      li.style.overflow = 'hidden';
      li.animate([{ height: li.offsetHeight + 'px', opacity: 1 }, { height: '0px', opacity: 0, paddingTop: '0px', paddingBottom: '0px' }], { duration: 170, easing: 'ease-in' }).onfinish = commit;
    } else commit();
  }

  /* ---------- glisser-déposer ---------- */
  function dropTarget(el, type, getDate) {
    el.addEventListener('dragover', function (e) { if (!dragId) return; e.preventDefault(); el.classList.add('over'); });
    el.addEventListener('dragleave', function (e) { if (!el.contains(e.relatedTarget)) el.classList.remove('over'); });
    el.addEventListener('drop', function (e) {
      e.preventDefault(); el.classList.remove('over');
      var t = byId(dragId);
      if (t) move(t, type, getDate());
    });
  }

  /* ---------- toast ---------- */
  var toastEl = null, toastTimer = null;
  function toast(msg, label, fn) {
    if (toastEl) toastEl.remove();
    clearTimeout(toastTimer);
    toastEl = h('div', { class: 'toast', role: 'status' }, [h('span', { text: msg }),
      label ? h('button', { type: 'button', text: label, onclick: function () { fn(); toastEl.remove(); } }) : null]);
    document.body.append(toastEl);
    toastTimer = setTimeout(function () { if (toastEl) toastEl.remove(); }, 5000);
  }

  /* ---------- menu "déplacer" (popover sur Mac, feuille sur iPhone) ---------- */
  var menuEls = [], menuBtn = null;
  function closeMenu(skipFocus) {
    if (!menuEls.length) return;
    var els = menuEls, b = menuBtn; menuEls = []; menuBtn = null;
    if (!skipFocus && b && document.body.contains(b)) b.focus();
    els.forEach(function (n) { n.classList.add('out'); });
    setTimeout(function () { els.forEach(function (n) { n.remove(); }); }, reduceMotion.matches ? 0 : 160);
  }
  function openMenu(btn, t) {
    closeMenu(true);
    var d = state.sel, now = parseDay(todayK), k = t.k;
    var scrim = h('div', { class: 'scrim', onclick: function () { closeMenu(); } });
    var m = h('div', { class: 'menu', role: 'menu', 'aria-label': 'Options de la tâche' });
    function item(label, sub, type, date) {
      var here = t.t === type && t.k === key(type, date);
      return h('button', { class: 'mi', type: 'button', role: 'menuitem', 'aria-current': here ? 'true' : 'false', onclick: function () { move(t, type, date); } },
        [h('span', { text: label }), here ? h('span', { html: IC.check.replace('class="ico"', 'class="ico" style="stroke-width:2"') }) : sub ? h('span', { class: 'ms', text: sub }) : null]);
    }
    var wk = info('week', d), qt = info('quarter', d);
    m.append(
      h('div', { class: 'grab' }),
      h('div', { class: 'mh', text: 'Déplacer vers' }),
      item('Aujourd’hui', null, 'day', now),
      item('Demain', null, 'day', addDays(now, 1)),
      item(wk.title, wk.sub, 'week', d),
      item(cap(MONTHS[d.getMonth()]), '' + d.getFullYear(), 'month', d),
      item(qt.title, qt.sub, 'quarter', d),
      item('' + d.getFullYear(), null, 'year', d),
      h('label', { class: 'mi' }, [
        h('span', { text: 'Jour précis' }),
        h('input', { type: 'date', value: k.length === 10 ? k : dayKey(d), 'aria-label': 'Choisir un jour',
          onchange: function (e) { if (e.target.value) move(t, 'day', parseDay(e.target.value)); } })
      ]),
      h('div', { class: 'msep' }),
      h('div', { class: 'mh', text: 'Surligner' }),
      h('div', { class: 'hls', role: 'group', 'aria-label': 'Couleur du surlignage' }, [['', 'Aucun'], ['y', 'Jaune'], ['p', 'Rose'], ['g', 'Vert'], ['b', 'Bleu'], ['v', 'Violet']].map(function (c) {
        return h('button', { class: 'hl', type: 'button', 'data-c': c[0], 'aria-label': c[1], 'aria-pressed': String((t.c || '') === c[0]), onclick: function () { setColor(t, c[0]); } });
      })),
      h('div', { class: 'msep' }),
      h('button', { class: 'mi dng', type: 'button', role: 'menuitem', text: 'Supprimer', onclick: function () { closeMenu(true); remove(t, btn.closest('.task')); } })
    );
    m.onkeydown = function (e) {
      var its = [].slice.call(m.querySelectorAll('button.mi')), i = its.indexOf(document.activeElement);
      if (e.key === 'ArrowDown') { e.preventDefault(); its[(i + 1) % its.length].focus(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); its[(i - 1 + its.length) % its.length].focus(); }
      else if (e.key === 'Escape') { e.stopPropagation(); closeMenu(); }
    };
    document.body.append(scrim, m);
    menuEls = [scrim, m]; menuBtn = btn;
    if (window.innerWidth > 600) {
      var r = btn.getBoundingClientRect(), w = m.offsetWidth, hh = m.offsetHeight;
      var left = Math.min(Math.max(8, r.right - w), window.innerWidth - w - 8);
      var top = r.bottom + 6;
      if (top + hh > window.innerHeight - 8) top = Math.max(8, r.top - hh - 6);
      m.style.left = left + 'px'; m.style.top = top + 'px';
    }
    m.querySelector('button.mi').focus();
  }

  /* ---------- aide clavier ---------- */
  var helpEl = null;
  function openHelp() {
    if (!helpEl) {
      var rows = [
        [['⌘', 'N'], 'Nouvelle tâche'],
        [['←', '→'], 'Jour précédent ou suivant'],
        [['T'], 'Revenir à aujourd’hui'],
        [['⌥', '↑ ↓'], 'Réordonner la tâche active'],
        [['↵'], 'Valider une saisie'],
        [['Échap'], 'Annuler ou fermer'],
        [['⌘', ','], 'Réglages : thème, synchronisation'],
        [['?'], 'Afficher cette aide']
      ];
      var dl = h('dl');
      rows.forEach(function (r) { dl.append(h('dt', null, r[0].map(function (k) { return h('kbd', { text: k }); })), h('dd', { text: r[1] })); });
      helpEl = h('dialog', { class: 'help', 'aria-labelledby': 'help-t' }, [
        h('h2', { id: 'help-t', text: 'Raccourcis' }), dl,
        h('button', { class: 'ghost close', type: 'button', text: 'Fermer', onclick: function () { helpEl.close(); } })
      ]);
      helpEl.addEventListener('click', function (e) { if (e.target === helpEl) helpEl.close(); });
      document.body.append(helpEl);
    }
    if (!helpEl.open) helpEl.showModal();
  }

  /* ---------- sous-tâche ---------- */
  function subRow(t, s, li) {
    var e = h('li', { class: 'sub' + (s.done ? ' done' : '') });
    var c = h('button', { class: 'schk', type: 'button', role: 'checkbox', 'aria-checked': String(!!s.done), 'aria-label': 'Terminer : ' + s.text, html: IC.check });
    var x = h('div', { class: 'stx', role: 'textbox', 'aria-label': 'Sous-tâche', 'data-sid': s.id, text: s.text });
    x.contentEditable = 'true'; x.spellcheck = false;
    c.onclick = function () {
      s.done = !s.done; touch(t); e.classList.toggle('done', s.done);
      c.setAttribute('aria-checked', String(s.done)); save(); say(s.done ? 'Sous-tâche terminée' : 'Sous-tâche rouverte');
    };
    x.onkeydown = function (ev) {
      if (ev.key === 'Enter') {
        ev.preventDefault();
        var v = x.textContent.trim();
        if (!v) { x.blur(); return; }
        if (v !== s.text) { s.text = v; touch(t); }
        addSub(t, s);                     // Entrée enchaîne sur la sous-tâche suivante
      } else if (ev.key === 'Escape') { ev.stopPropagation(); x.textContent = s.text; x.blur(); }
    };
    x.onpaste = function (ev) {
      ev.preventDefault();
      document.execCommand('insertText', false, ((ev.clipboardData || window.clipboardData).getData('text') || '').replace(/\s*\n\s*/g, ' '));
    };
    x.onblur = function () {
      li.draggable = true;
      var v = x.textContent.trim();
      if (!v) removeSub(t, s);
      else if (v !== s.text) { s.text = v; touch(t); save(); }
    };
    x.addEventListener('mousedown', function () { li.draggable = document.activeElement !== x; }, true);
    e.append(c, x);
    return e;
  }

  /* ---------- tâche ---------- */
  function row(t, late) {
    var li = h('li', { class: 'task' + (t.done ? ' done' : '') + (entering[t.id] ? ' enter' : ''), 'data-id': t.id });
    var c = h('button', { class: 'chk', type: 'button', role: 'checkbox', 'aria-checked': String(!!t.done), 'aria-label': 'Terminer : ' + t.text, html: IC.check });
    var x = h('div', { class: 'txt', role: 'textbox', 'aria-label': 'Tâche', text: t.text });
    x.contentEditable = 'true'; x.spellcheck = false;
    var mv = h('button', { class: 'act mv', type: 'button', 'aria-label': 'Déplacer : ' + t.text, 'aria-haspopup': 'menu', html: IC.cal });
    var sb = h('button', { class: 'act sub', type: 'button', 'aria-label': 'Ajouter une sous-tâche : ' + t.text, html: IC.sub });
    var d = h('button', { class: 'act del', type: 'button', 'aria-label': 'Supprimer : ' + t.text, html: IC.x });

    c.onclick = function () {
      t.done = !t.done; touch(t);
      li.classList.toggle('done', t.done);
      c.setAttribute('aria-checked', String(t.done));
      save(); say(t.done ? 'Tâche terminée' : 'Tâche rouverte');
      clearTimeout(timer);
      timer = setTimeout(render, t.done ? 600 : 250);
    };
    x.onkeydown = function (e) {
      if (e.key === 'Enter') { e.preventDefault(); x.blur(); }
      else if (e.key === 'Escape') { e.stopPropagation(); x.textContent = t.text; x.blur(); }
    };
    x.onpaste = function (e) {
      e.preventDefault();
      var s = ((e.clipboardData || window.clipboardData).getData('text') || '').replace(/\s*\n\s*/g, ' ');
      document.execCommand('insertText', false, s);
    };
    x.onblur = function () {
      li.draggable = true;
      var v = x.textContent.trim();
      if (!v) remove(t, li);
      else if (v !== t.text) { t.text = v; touch(t); save(); }
    };
    mv.onclick = function () { openMenu(mv, t); };
    sb.onclick = function () { addSub(t); };
    d.onclick = function () { remove(t, li); };
    li.onkeydown = function (e) { // réordonner au clavier : Alt + haut/bas
      if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) { e.preventDefault(); e.stopPropagation(); nudge(t, e.key === 'ArrowUp' ? -1 : 1); }
    };

    li.draggable = true;
    x.addEventListener('mousedown', function () { li.draggable = document.activeElement !== x; }, true);
    li.ondragstart = function (e) { dragId = t.id; e.dataTransfer.setData('text/plain', t.id); e.dataTransfer.effectAllowed = 'move'; setTimeout(function () { li.classList.add('drag'); }, 0); };
    li.ondragend = function () { dragId = null; li.classList.remove('drag'); };
    if (!late) { // dépôt entre deux tâches : réordonne (ou insère depuis une autre carte)
      li.addEventListener('dragover', function (e) {
        if (!dragId || dragId === t.id) return;
        e.preventDefault(); e.stopPropagation();
        var r = li.getBoundingClientRect(), after = e.clientY > r.top + r.height / 2;
        li.classList.toggle('drop-after', after); li.classList.toggle('drop-before', !after);
        li.closest('.card').classList.remove('over');
      });
      li.addEventListener('dragleave', function () { li.classList.remove('drop-after', 'drop-before'); });
      li.addEventListener('drop', function (e) {
        var s = byId(dragId); if (!s || s === t) return;
        e.preventDefault(); e.stopPropagation();
        place(s, t, li.classList.contains('drop-after'));
      });
    }

    if (t.c) li.dataset.c = t.c;
    var body = h('div', { class: 'tbody' }, [x]);
    if (t.s && t.s.length) body.append(h('ul', { class: 'subs', role: 'list' }, t.s.map(function (s) { return subRow(t, s, li); })));
    if (late) { var dd = parseDay(t.k); body.append(h('span', { class: 'when', text: cap(DAYS[dd.getDay()]) + ' ' + dd.getDate() + ' ' + MON3[dd.getMonth()] })); }
    li.append(c, body, h('div', { class: 'acts' }, [sb, mv, d]));
    return li;
  }

  /* ---------- illustrations ---------- */
  var ART_DAY = '<svg class="art" viewBox="0 0 104 60" aria-hidden="true"><path d="M10 46h84"/><path class="soft" d="M30 54h44"/><path class="sun" d="M34 46a18 18 0 0 1 36 0"/><path class="sun" d="M52 20v-7M32 28l-5-5M72 28l5-5"/></svg>';
  var ART_CAL = '<svg class="art" viewBox="0 0 104 60" aria-hidden="true"><rect x="30" y="10" width="44" height="40" rx="9"/><path d="M30 24h44"/><path class="soft" d="M42 36h20"/><path class="sun" d="M42 4v10M62 4v10"/></svg>';

  /* ---------- carte d'un horizon ---------- */
  function card(type) {
    var d = state.sel, i = info(type, d), list = tasksFor(type, d);
    var nDone = list.filter(function (t) { return t.done; }).length;
    var full = list.length > 0 && nDone === list.length;
    var isToday = type === 'day' && dayKey(d) === todayK;
    var input = h('input', { class: 'add-in', type: 'text', placeholder: type === 'day' ? 'Ajouter une tâche' : 'Ajouter', 'data-type': type,
      'aria-label': 'Ajouter une tâche (' + i.tag.toLowerCase() + ')', enterkeyhint: 'done', autocapitalize: 'sentences' });
    var form = h('form', { class: 'add', autocomplete: 'off' }, [h('span', { class: 'plus', html: IC.plus }), input]);
    form.onsubmit = function (e) {
      e.preventDefault();
      var v = input.value.trim();
      if (!v) return;
      var t = { id: uid(), text: v, done: false, t: type, k: key(type, state.sel), s: [], c: '' };
      tasks.push(t); orderAt(t); entering[t.id] = 1; focusType = type; save(); render();
    };
    input.onkeydown = function (e) { if (e.key === 'Escape') { input.value = ''; input.blur(); } };

    var body;
    if (list.length) body = h('ul', { role: 'list' }, list.map(function (t) { return row(t); }));
    else if (type === 'day') body = h('div', { class: 'empty-state' }, [h('div', { html: ART_DAY }), h('strong', { text: 'Journée libre' }),
      h('span', { text: isToday ? 'Ajoutez ce qui compte aujourd’hui.' : 'Rien n’est prévu ce jour-là.' })]);
    else body = h('p', { class: 'none', text: 'Rien de prévu.' });

    var late = type === 'day' && isToday ? overdue() : [];
    var lateBox = late.length ? h('div', { class: 'late' }, [
      h('div', { class: 'late-h' }, [
        h('span', { class: 'tag', text: 'En retard · ' + late.length }),
        h('button', { type: 'button', text: 'Tout ramener à aujourd’hui', onclick: function () {
          late.forEach(function (t) { t.k = todayK; touch(t); entering[t.id] = 1; });
          save(); render(); say(late.length + (late.length > 1 ? ' tâches ramenées' : ' tâche ramenée') + ' à aujourd’hui');
        } })
      ]),
      h('ul', { role: 'list' }, late.map(function (t) { return row(t, true); }))
    ]) : null;

    var cnt = list.length ? h('span', { class: 'cnt', 'aria-label': nDone + ' sur ' + list.length + ' terminées' }, [h('b', { text: '' + nDone }), '/' + list.length]) : null;
    var head = type === 'day'
      ? h('header', { class: 'hero' }, [
          h('div', null, [
            h('span', { class: 'tag' + (isToday ? ' now' : ''), text: i.tag }),
            h('h2', null, [cap(DAYS[d.getDay()]), h('span', { class: 'sr', text: ' ' + d.getDate() }), h('span', { class: 'dm', text: ' ' + MONTHS[d.getMonth()] + ' ' + d.getFullYear() })])
          ]),
          cnt
        ])
      : h('header', { class: 'ch' }, [
          h('div', null, [h('span', { class: 'tag', text: i.tag }), h('h2', { text: i.title }), i.sub ? h('span', { class: 'sub', text: i.sub }) : null]),
          cnt
        ]);
    var n = list.length > 24 ? 1 : list.length;
    var c = h('section', { class: 'card ' + type + (full ? ' full' : ''), 'aria-label': i.tag + ' : ' + i.title }, [
      head,
      h('div', { class: 'bar' + (list.length ? '' : ' empty'), 'aria-hidden': 'true', role: 'presentation', style: '--n:' + (n || 1) }, [h('i', { style: '--p:' + (list.length ? nDone / list.length : 0) })]),
      body, form, lateBox
    ]);
    dropTarget(c, type, function () { return state.sel; });
    return c;
  }

  /* ---------- vues ---------- */
  function setSel(d, instant) { var dir = d > state.sel ? 'next' : 'prev'; state.sel = d; render(instant ? undefined : dir); }

  function weekStrip() {
    var s = startOfWeek(state.sel), selK = dayKey(state.sel), days = h('div', { class: 'days', role: 'group', 'aria-label': 'Jours de la semaine' });
    for (var i = 0; i < 7; i++) {
      (function (d) {
        var k = dayKey(d);
        var open = tasks.some(function (t) { return t.t === 'day' && t.k === k && !t.done; });
        var b = h('button', { type: 'button', class: 'd' + (k === selK ? ' sel' : '') + (k === todayK ? ' today' : '') + (open ? ' has' : ''),
          'aria-pressed': String(k === selK), 'aria-label': cap(DAYS[d.getDay()]) + ' ' + d.getDate() + ' ' + MONTHS[d.getMonth()] + (open ? ', tâches à faire' : ''),
          onclick: function () { if (k !== selK) setSel(d); } },
          [h('span', { class: 'wd', text: DAYS[d.getDay()].slice(0, 3) }), h('span', { class: 'n', text: '' + d.getDate() }), h('i', { class: 'dot' })]);
        dropTarget(b, 'day', function () { return d; });
        days.append(b);
      })(addDays(s, i));
    }
    return days;
  }

  function hzView() {
    return [weekStrip(), h('div', { class: 'grid' }, [
      h('div', { class: 'col' }, [card('day')]),
      h('div', { class: 'col side' }, [card('week'), card('month'), card('quarter'), card('year')])
    ])];
  }

  function calView() {
    var first = new Date(state.cal.getFullYear(), state.cal.getMonth(), 1);
    var offset = (first.getDay() + 6) % 7;
    var nDays = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
    var weeks = Math.ceil((offset + nDays) / 7), selK = dayKey(state.sel), monthCount = 0;
    var g = h('div', { class: 'cal' }, WD1.map(function (l) { return h('div', { class: 'cwd', 'aria-hidden': 'true', text: l }); }));
    var start = addDays(first, -offset);
    for (var i = 0; i < weeks * 7; i++) {
      (function (d) {
        var k = dayKey(d), inMonth = d.getMonth() === first.getMonth();
        var l = undoneFirst(tasks.filter(function (t) { return t.t === 'day' && t.k === k; }));
        var nOpen = l.filter(function (t) { return !t.done; }).length;
        if (inMonth) monthCount += l.length;
        var kids = [h('span', { class: 'cn', text: '' + d.getDate() })];
        l.slice(0, 3).forEach(function (t) { kids.push(h('span', { class: 'ct' + (t.done ? ' done' : ''), text: t.text })); });
        if (l.length > 3) kids.push(h('span', { class: 'more', text: (l.length - 3) + ' autres' }));
        kids.push(h('span', { class: 'dots' }, nOpen ? [h('i'), nOpen > 1 ? h('i') : null, nOpen > 2 ? h('i') : null] : []));
        var b = h('button', { type: 'button', class: 'cell' + (inMonth ? '' : ' out') + (k === todayK ? ' today' : '') + (k === selK ? ' sel' : ''),
          'aria-label': cap(DAYS[d.getDay()]) + ' ' + d.getDate() + ' ' + MONTHS[d.getMonth()] + (l.length ? ', ' + l.length + ' tâche' + (l.length > 1 ? 's' : '') : ''),
          onclick: function () { state.sel = d; state.view = 'hz'; render('fade'); } }, kids);
        dropTarget(b, 'day', function () { return d; });
        g.append(b);
      })(addDays(start, i));
    }
    var out = [g];
    if (!monthCount) out.push(h('div', { class: 'empty-state cal-none' }, [h('div', { html: ART_CAL }), h('strong', { text: 'Mois dégagé' }),
      h('span', { text: 'Choisissez un jour pour planifier.' })]));
    return out;
  }

  function topbar() {
    var cal = state.view === 'cal', d = cal ? state.cal : state.sel;
    function step(n) {
      if (cal) state.cal = new Date(state.cal.getFullYear(), state.cal.getMonth() + n, 1);
      else state.sel = addDays(state.sel, 7 * n);
      render(n > 0 ? 'next' : 'prev');
    }
    function seg(v, label) {
      return h('button', { type: 'button', text: label, 'aria-pressed': String(state.view === v), onclick: function () { if (state.view !== v) { state.view = v; render('fade'); } } });
    }
    return h('div', { class: 'top' }, [
      h('h1', { 'aria-live': 'polite' }, [cap(MONTHS[d.getMonth()]) + ' ', h('span', { class: 'yr', text: '' + d.getFullYear() })]),
      h('div', { class: 'tr' }, [
        h('div', { class: 'step' }, [
          navBtn('left', cal ? 'Mois précédent' : 'Semaine précédente', function () { step(-1); }),
          h('button', { class: 'ghost today-txt', type: 'button', text: 'Aujourd’hui', onclick: goToday }),
          navBtn('right', cal ? 'Mois suivant' : 'Semaine suivante', function () { step(1); })
        ]),
        h('div', { class: 'dock' }, [
          h('div', { class: 'seg', role: 'group', 'aria-label': 'Vue' }, [seg('hz', 'Listes'), seg('cal', 'Calendrier')]),
          h('button', { class: 'today-fab', type: 'button', 'aria-label': 'Revenir à aujourd’hui', text: '' + new Date().getDate(), onclick: goToday })
        ]),
        h('button', { class: 'nav help-btn', type: 'button', 'aria-label': 'Raccourcis clavier', html: IC.help, onclick: openHelp }),
        h('button', { class: 'nav cfg-btn' + (cfgAlert() ? ' alert' : ''), type: 'button', 'aria-label': 'Réglages', 'aria-haspopup': 'dialog', html: IC.cfg, onclick: openSettings })
      ])
    ]);
  }

  function goToday(e) {
    var instant = !(e && e.type === 'click');
    todayK = dayKey(new Date());
    var t = parseDay(todayK);
    state.sel = t; state.cal = new Date(t.getFullYear(), t.getMonth(), 1);
    render(instant ? undefined : 'fade');
  }

  /* ---------- rendu ---------- */
  // FLIP : les tâches glissent vers leur nouvelle place au lieu de sauter
  function rects() { var m = {}; [].forEach.call(document.querySelectorAll('.task[data-id]'), function (el) { m[el.dataset.id] = el.getBoundingClientRect().top; }); return m; }

  function render(anim) {
    closeMenu(true);
    var root = document.getElementById('app'), a = document.activeElement, keep = null;
    if (a && root.contains(a)) { // conserve le focus et la saisie à travers le rendu
      var li = a.closest && a.closest('.task');
      if (li) keep = { id: li.dataset.id, cls: ['chk', 'txt', 'mv', 'del'].filter(function (c) { return a.classList.contains(c); })[0] || 'chk' };
      else if (a.classList && a.classList.contains('add-in')) keep = { type: a.dataset.type, value: a.value };
    }
    var before = anim ? null : rects();
    var stage = h('div', { class: 'stage' + (anim ? ' ' + anim : '') }, state.view === 'hz' ? hzView() : calView());
    root.dataset.view = state.view;
    root.replaceChildren(topbar(), stage, live);
    entering = {};
    if (before && !reduceMotion.matches) {
      [].forEach.call(document.querySelectorAll('.task[data-id]'), function (el) {
        var was = before[el.dataset.id];
        if (was === undefined) return;
        var dy = was - el.getBoundingClientRect().top;
        if (dy) el.animate([{ transform: 'translateY(' + dy + 'px)' }, { transform: 'none' }], { duration: 240, easing: 'cubic-bezier(.2,.8,.2,1)' });
      });
    }
    if (focusSub) {
      var se = document.querySelector('.stx[data-sid="' + focusSub + '"]');
      if (se) se.focus();
      focusSub = null;
    } else if (focusType) {
      var i = document.querySelector('input.add-in[data-type="' + focusType + '"]');
      if (i) i.focus();
      focusType = null;
    } else if (keep) {
      var el = keep.id ? document.querySelector('.task[data-id="' + keep.id + '"] .' + keep.cls) : document.querySelector('input.add-in[data-type="' + keep.type + '"]');
      if (el) { el.focus({ preventScroll: true }); if (keep.value) el.value = keep.value; }
    }
  }

  /* ---------- thèmes et réglages ---------- */
  var THEMES = [['papier', 'Neutre'], ['sauge', 'Sauge'], ['encre', 'Encre'], ['minuit', 'Minuit']];
  var PKEY = 'todo.ui';
  var prefs = { theme: 'papier', mode: 'auto' };
  try {
    var sp = JSON.parse(localStorage.getItem(PKEY));
    if (sp && THEMES.some(function (t) { return t[0] === sp.theme; })) prefs.theme = sp.theme;
    if (sp && ['auto', 'light', 'dark'].indexOf(sp.mode) >= 0) prefs.mode = sp.mode;
  } catch (e) {}
  function syncMeta() { // couleur de la barre d'état iPhone = fond du thème
    var p = document.createElement('i'); p.style.cssText = 'position:fixed;width:0;height:0;background:var(--bg-solid)';
    document.body.append(p);
    var c = getComputedStyle(p).backgroundColor; p.remove();
    var m = document.querySelector('meta[name="theme-color"]'); if (m && c) m.setAttribute('content', c);
  }
  function applyPrefs() {
    var r = document.documentElement; r.dataset.theme = prefs.theme; r.dataset.mode = prefs.mode;
    try { localStorage.setItem(PKEY, JSON.stringify(prefs)); } catch (e) {}
    syncMeta();
  }
  if (window.matchMedia) window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', syncMeta);

  var cfgEl = null, statusEl = null, cfgView = '';
  function cfgAlert() { var s = window.TodoSync && TodoSync.configured && TodoSync.state(); return !!s && (s.status === 'signedout' || s.status === 'error'); }
  function statusText() {
    var s = TodoSync.state();
    if (s.status === 'syncing') return 'Synchronisation…';
    if (s.status === 'offline') return 'Hors ligne : les changements partiront au retour du réseau.';
    if (s.status === 'error') return 'Erreur : ' + s.error;
    return s.last ? 'Synchronisé à ' + new Date(s.last).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : 'Prêt.';
  }
  function authForm() {
    var email = h('input', { class: 'fld', type: 'email', placeholder: 'Email', 'aria-label': 'Email', autocomplete: 'username', autocapitalize: 'none', autocorrect: 'off', spellcheck: 'false', required: '' });
    var pw = h('input', { class: 'fld', type: 'password', placeholder: 'Mot de passe (6 caractères minimum)', 'aria-label': 'Mot de passe', autocomplete: 'current-password', required: '' });
    var msg = h('p', { class: 'note', role: 'status' });
    var go = h('button', { class: 'btn', type: 'submit', text: 'Se connecter' });
    var mk = h('button', { class: 'btn alt', type: 'button', text: 'Créer le compte' });
    var f = h('form', null, [h('p', { class: 'note', text: 'Utilise le même compte sur le Mac et sur l’iPhone.' }), email, pw, msg, h('div', { class: 'row' }, [go, mk])]);
    function busy(b) { go.disabled = mk.disabled = b; }
    function say2(t, err) { msg.className = 'note' + (err ? ' err' : ''); msg.textContent = t; }
    function fail(e) { busy(false); say2(e.message, true); }
    function done(r) { busy(false); if (r && r.confirm) say2('Compte créé : confirme ton email, puis connecte-toi.'); else drawSettings(); }
    f.onsubmit = function (e) { e.preventDefault(); busy(true); say2('Connexion…'); TodoSync.signIn(email.value.trim(), pw.value).then(done, fail); };
    mk.onclick = function () { if (!f.reportValidity()) return; busy(true); say2('Création du compte…'); TodoSync.signUp(email.value.trim(), pw.value).then(done, fail); };
    return f;
  }
  function syncBody() {
    var sync = window.TodoSync;
    if (!sync || !sync.configured) { cfgView = 'off'; return [h('p', { class: 'note', text: 'Non configurée. Renseigne web/config.js (voir README.md) pour synchroniser le Mac et l’iPhone.' })]; }
    var s = sync.state();
    if (s.status === 'signedout') { cfgView = 'out'; statusEl = null; return [authForm()]; }
    cfgView = 'in';
    statusEl = h('p', { class: 'note', text: statusText() });
    return [h('p', { class: 'note' }, ['Connecté : ', h('strong', { text: s.email })]), statusEl,
      h('div', { class: 'row' }, [
        h('button', { class: 'btn', type: 'button', text: 'Synchroniser', onclick: function () { sync.run(); } }),
        h('button', { class: 'btn alt', type: 'button', text: 'Se déconnecter', onclick: function () { sync.signOut(); drawSettings(); } })
      ])];
  }
  function drawSettings() {
    var minuit = prefs.theme === 'minuit';
    var themes = h('div', { class: 'themes', role: 'group', 'aria-label': 'Thème' }, THEMES.map(function (t) {
      return h('button', { class: 'th', type: 'button', 'data-id': t[0], 'aria-pressed': String(prefs.theme === t[0]),
        onclick: function () { prefs.theme = t[0]; applyPrefs(); drawSettings(); var b = cfgEl.querySelector('.th[data-id="' + t[0] + '"]'); if (b) b.focus(); } },
        [h('span', { class: 'sw', 'data-theme': t[0] }, [h('i'), h('i'), h('b')]), h('span', { class: 'nm', text: t[1] })]);
    }));
    function modeBtn(v, label) {
      return h('button', { type: 'button', text: label, 'aria-pressed': String(prefs.mode === v), 'aria-disabled': String(minuit),
        onclick: function () { if (minuit) return; prefs.mode = v; applyPrefs(); drawSettings(); var b = cfgEl.querySelector('.seg button[aria-pressed="true"]'); if (b) b.focus(); } });
    }
    var secs = [
      h('div', { class: 'sh-head' }, [h('h2', { id: 'cfg-t', text: 'Réglages' }), h('button', { class: 'nav', type: 'button', 'aria-label': 'Fermer', html: IC.close, onclick: function () { cfgEl.close(); } })]),
      h('section', { class: 'sec' }, [h('h3', { text: 'Thème' }), themes]),
      h('section', { class: 'sec' }, [h('h3', { text: 'Apparence' }),
        h('div', { class: 'seg full', role: 'group', 'aria-label': 'Apparence' }, [modeBtn('auto', 'Auto'), modeBtn('light', 'Clair'), modeBtn('dark', 'Sombre')]),
        minuit ? h('p', { class: 'note', style: 'margin:var(--s2) 0 0', text: 'Minuit est toujours sombre.' }) : null]),
      h('section', { class: 'sec' }, [h('h3', { text: 'Synchronisation' })].concat(syncBody()))
    ];
    cfgEl.replaceChildren.apply(cfgEl, secs);
  }
  function openSettings() {
    if (!cfgEl) {
      cfgEl = h('dialog', { class: 'sheet', 'aria-labelledby': 'cfg-t' });
      cfgEl.addEventListener('click', function (e) { if (e.target === cfgEl) cfgEl.close(); });
      document.body.append(cfgEl);
    }
    drawSettings();
    if (!cfgEl.open) cfgEl.showModal();
  }
  function onSync() { // l'état de la sync a changé
    var g = document.querySelector('.cfg-btn');
    if (g) g.classList.toggle('alert', cfgAlert());
    if (!cfgEl || !cfgEl.open) return;
    var out = TodoSync.state().status === 'signedout' ? 'out' : 'in';
    if (out !== cfgView) { var a = document.activeElement; if (!(a && a.tagName === 'INPUT' && cfgEl.contains(a))) drawSettings(); }
    else if (statusEl) statusEl.textContent = statusText();
  }

  /* ---------- rendu différé quand la sync apporte des changements pendant une saisie ---------- */
  var pendingRender = false, flushTimer = null;
  function busyUi() { var a = document.activeElement; return !!((a && a.isContentEditable) || menuEls.length || (helpEl && helpEl.open) || (cfgEl && cfgEl.open && false)); }
  function softRender() { if (busyUi()) { pendingRender = true; return; } render(); }
  function flush() { clearTimeout(flushTimer); if (!pendingRender) return; flushTimer = setTimeout(function () { if (pendingRender && !busyUi()) { pendingRender = false; render(); } }, 450); }
  document.addEventListener('focusout', flush);
  document.addEventListener('focusin', flush);

  /* ---------- événements globaux ---------- */
  function newTask() {
    if (state.view !== 'hz') { state.view = 'hz'; render(); }
    var i = document.querySelector('input.add-in[data-type="day"]');
    if (i) { i.focus(); i.scrollIntoView({ block: 'nearest' }); }
  }
  document.addEventListener('keydown', function (e) {
    if ((e.metaKey || e.ctrlKey) && !e.altKey && e.key.toLowerCase() === 'n') { e.preventDefault(); newTask(); return; }
    if ((e.metaKey || e.ctrlKey) && !e.altKey && e.key === ',') { e.preventDefault(); openSettings(); return; }
    if (e.key === 'Escape') { closeMenu(); return; }
    var a = document.activeElement;
    if (e.metaKey || e.ctrlKey || e.altKey || (helpEl && helpEl.open) || (cfgEl && cfgEl.open) || (a && (a.tagName === 'INPUT' || a.isContentEditable))) return;
    if (menuEls.length) return;
    if (state.view === 'hz' && e.key === 'ArrowLeft') { e.preventDefault(); setSel(addDays(state.sel, -1), true); }
    else if (state.view === 'hz' && e.key === 'ArrowRight') { e.preventDefault(); setSel(addDays(state.sel, 1), true); }
    else if (e.key === 't') goToday();
    else if (e.key === 'n') { e.preventDefault(); newTask(); }
    else if (e.key === '?') openHelp();
  });
  function refreshToday() { if (dayKey(new Date()) !== todayK) goToday(); }
  document.addEventListener('visibilitychange', refreshToday);
  window.addEventListener('focus', refreshToday);

  applyPrefs();
  render('fade');
  if (window.TodoSync) {
    TodoSync.on(onSync);
    TodoSync.init({
      get: function () { return { tasks: tasks, tombs: tombs }; },
      set: function (r) { tasks = r.tasks; tombs = r.tombs; persist(); softRender(); },
      save: persist
    });
  }
  if (electron) { var f = document.querySelector('input.add-in[data-type="day"]'); if (f) f.focus(); }

  if ('serviceWorker' in navigator && location.protocol.indexOf('http') === 0)
    navigator.serviceWorker.register('sw.js').catch(function () {});
})();
