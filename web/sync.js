/* Synchronisation Mac / iPhone via Supabase, sans bibliothèque (fetch uniquement).
   Local d'abord : l'app marche hors ligne, la sync envoie puis récupère les changements.
   Conflit : la modification la plus récente (champ u) gagne. Suppression : pierre tombale (x). */
(function () {
  'use strict';
  var CFG = window.TODO_CONFIG || {};
  var BASE = String(CFG.supabaseUrl || '').replace(/\/+$/, ''), APIKEY = CFG.supabaseKey || '';
  var configured = !!(BASE && APIKEY);
  var AUTHK = 'todo.auth', CURK = 'todo.cursor', TYPES = ['day', 'week', 'month', 'quarter', 'year'];
  var ad = null, subs = [], timer = null, running = false, again = false, refreshing = null;

  function read(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } }
  function write(k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }

  var auth = read(AUTHK);
  var st = { status: !configured ? 'off' : (auth && auth.refresh_token ? 'idle' : 'signedout'), email: (auth && auth.email) || '', last: 0, error: '' };
  function set(p) { for (var k in p) st[k] = p[k]; subs.forEach(function (f) { try { f(st); } catch (e) {} }); }

  /* ---------- HTTP ---------- */
  function http(method, path, o) {
    o = o || {};
    var headers = { apikey: APIKEY, 'Content-Type': 'application/json' };
    if (o.token) headers.Authorization = 'Bearer ' + o.token;
    if (o.prefer) headers.Prefer = o.prefer;
    return fetch(BASE + path, { method: method, headers: headers, body: o.body ? JSON.stringify(o.body) : undefined }).then(function (r) {
      return r.text().then(function (tx) {
        var j = null; try { j = tx ? JSON.parse(tx) : null; } catch (e) {}
        if (!r.ok) {
          var e = new Error((j && (j.error_description || j.msg || j.message || j.hint)) || ('HTTP ' + r.status));
          e.status = r.status; throw e;
        }
        return j;
      });
    });
  }
  function fr(e) {
    var m = String((e && e.message) || '');
    if (!e || !e.status) return 'Pas de connexion.';
    if (/invalid login/i.test(m)) return 'Email ou mot de passe incorrect.';
    if (/already registered|already been registered/i.test(m)) return 'Ce compte existe déjà : utilise « Se connecter ».';
    if (/not confirmed/i.test(m)) return 'Email non confirmé : clique le lien reçu par mail.';
    if (/signups? not allowed|signup is disabled/i.test(m)) return 'La création de compte est désactivée sur ce projet.';
    if (/at least \d+ char/i.test(m)) return 'Mot de passe : 6 caractères minimum.';
    if (/valid email|invalid email/i.test(m)) return 'Adresse email invalide.';
    if (/rate limit/i.test(m)) return 'Trop de tentatives, réessaie dans une minute.';
    return m;
  }

  /* ---------- session ---------- */
  function setAuth(j, email) {
    auth = { access_token: j.access_token, refresh_token: j.refresh_token, expires_at: Math.floor(Date.now() / 1000) + (j.expires_in || 3600),
      email: email || (j.user && j.user.email) || (auth && auth.email) || '' };
    write(AUTHK, auth);
  }
  function refresh() {
    if (refreshing) return refreshing;
    refreshing = http('POST', '/auth/v1/token?grant_type=refresh_token', { body: { refresh_token: auth.refresh_token } }).then(function (j) {
      refreshing = null; setAuth(j); return auth.access_token;
    }, function (e) {
      refreshing = null;
      if (e.status === 400 || e.status === 401 || e.status === 403) { auth = null; write(AUTHK, null); e.auth = true; }
      throw e;
    });
    return refreshing;
  }
  function token() {
    if (!auth) { var e = new Error('Non connecté'); e.auth = true; return Promise.reject(e); }
    return auth.expires_at - 60 > Date.now() / 1000 ? Promise.resolve(auth.access_token) : refresh();
  }
  function withToken(fn) {
    return token().then(fn).catch(function (e) { if (e && e.status === 401 && auth) return refresh().then(fn); throw e; });
  }
  function started(email) { TABLES.forEach(function (T) { write(T.cur, null); }); set({ status: 'idle', email: email, error: '' }); return run().then(function () { return { ok: true }; }); }
  function signIn(email, pw) {
    return http('POST', '/auth/v1/token?grant_type=password', { body: { email: email, password: pw } })
      .then(function (j) { setAuth(j, email); return started(email); }, function (e) { throw new Error(fr(e)); });
  }
  function signUp(email, pw) {
    return http('POST', '/auth/v1/signup', { body: { email: email, password: pw } }).then(function (j) {
      if (j && j.access_token) { setAuth(j, email); return started(email); }
      return { ok: false, confirm: true };
    }, function (e) { throw new Error(fr(e)); });
  }
  function signOut() { auth = null; write(AUTHK, null); TABLES.forEach(function (T) { write(T.cur, null); }); set({ status: 'signedout', email: '', error: '' }); }

  /* ---------- tables : tâches et créneaux ---------- */
  function byO(a, b) { return a.o - b.o || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0); }
  function byA(a, b) { return a.k < b.k ? -1 : a.k > b.k ? 1 : a.a - b.a || a.e - b.e || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0); }
  function byU(a, b) { return b.u - a.u || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0); }
  var TABLES = [
    { name: 'tasks', rows: 'tasks', tombs: 'tombs', cur: CURK, sort: byO, cols: 'id,text,done,t,k,o,u,x,s,c,b,ts',
      valid: function (r) { return r && typeof r.id === 'string' && typeof r.text === 'string' && TYPES.indexOf(r.t) >= 0 && typeof r.k === 'string'; },
      toRow: function (r) { return { id: r.id, text: r.text, done: !!r.done, t: r.t, k: r.k, o: r.o, u: r.u, x: !!r.x, s: (r.s || []).filter(function (x) { return x && x.text; }), c: r.c || '', b: r.b || '' }; },
      mk: function (r) { return { id: r.id, text: r.text, done: !!r.done, t: r.t, k: r.k, o: +r.o || 0, u: +r.u, d: false, s: Array.isArray(r.s) ? r.s : [], c: typeof r.c === 'string' ? r.c : '', b: typeof r.b === 'string' ? r.b : '' }; } },
    { name: 'blocks', rows: 'blocks', tombs: 'btombs', cur: CURK + '.blocks', sort: byA, cols: 'id,k,a,e,u,x,ts',
      valid: function (r) { return r && typeof r.id === 'string' && typeof r.k === 'string' && isFinite(r.a) && isFinite(r.e); },
      toRow: function (r) { return { id: r.id, k: r.k, a: r.a, e: r.e, u: r.u, x: !!r.x }; },
      mk: function (r) { return { id: r.id, k: r.k, a: +r.a, e: +r.e, u: +r.u, d: false }; } },
    { name: 'notes', rows: 'notes', tombs: 'ntombs', cur: CURK + '.notes', sort: byU, cols: 'id,text,cr,u,x,ts',
      valid: function (r) { return r && typeof r.id === 'string' && typeof r.text === 'string'; },
      toRow: function (r) { return { id: r.id, text: r.text, cr: r.cr || r.u, u: r.u, x: !!r.x }; },
      mk: function (r) { return { id: r.id, text: r.text, cr: +r.cr || +r.u, u: +r.u, d: false }; } }
  ];

  /* ---------- fusion (exposée pour les tests) ---------- */
  function merge(rows, T) {
    T = T || TABLES[0];
    var s = ad.get(), byId = {}, changed = false;
    s[T.rows].forEach(function (r) { byId[r.id] = r; });
    s[T.tombs].forEach(function (r) { byId[r.id] = r; });
    rows.forEach(function (r) {
      if (!T.valid(r)) return;
      var l = byId[r.id];
      if (l && +r.u <= l.u) return;
      var n = T.mk(r);
      if (r.x) n.x = true;
      byId[r.id] = n; changed = true;
    });
    if (!changed) return false;
    var live = [], dead = [];
    Object.keys(byId).forEach(function (id) { var r = byId[id]; (r.x ? dead : live).push(r); });
    live.sort(T.sort);
    var out = {}; out[T.rows] = live; out[T.tombs] = dead;
    ad.set(out);
    return true;
  }

  /* ---------- envoi puis réception ---------- */
  function seq(fns) { return fns.reduce(function (p, f) { return p.then(f); }, Promise.resolve()); }
  function push(tk, T) {
    var s = ad.get(), recs = s[T.rows].concat(s[T.tombs]).filter(function (r) { return r.d; });
    if (!recs.length) return Promise.resolve(false);
    var chunks = []; for (var i = 0; i < recs.length; i += 50) chunks.push(recs.slice(i, i + 50));
    return seq(chunks.map(function (ch) {
      return function () { return http('POST', '/rest/v1/' + T.name + '?on_conflict=id', { token: tk, prefer: 'resolution=merge-duplicates,return=minimal', body: ch.map(T.toRow) }); };
    })).then(function () {
      var sent = {}, cur = ad.get(), ch = false;
      recs.forEach(function (r) { sent[r.id] = r.u; });
      cur[T.rows].concat(cur[T.tombs]).forEach(function (r) { if (r.d && sent[r.id] === r.u) { r.d = false; ch = true; } }); // inchangé pendant l'envoi
      if (ch) ad.save();
      return true;
    });
  }
  function pull(tk, T) {
    var since = read(T.cur) || '1970-01-01T00:00:00.000Z', all = [], off = 0, max = 0;
    function page() {
      return http('GET', '/rest/v1/' + T.name + '?select=' + T.cols + '&ts=gt.' + encodeURIComponent(since) + '&order=ts.asc,id.asc&limit=1000&offset=' + off, { token: tk }).then(function (rows) {
        rows.forEach(function (r) { all.push(r); var m = Date.parse(r.ts); if (m > max) max = m; });
        if (rows.length === 1000) { off += 1000; return page(); }
      });
    }
    return page().then(function () {
      if (all.length) merge(all, T);
      if (max) write(T.cur, new Date(max - 120000).toISOString()); // 2 min de recouvrement : une transaction tardive n'est jamais ratée
    });
  }
  // récupérer d'abord (on adopte ce qui est plus récent ailleurs), envoyer ensuite, puis récupérer encore si on a envoyé
  function cycle() {
    return withToken(function (tk) {
      return seq(TABLES.map(function (T) {
        return function () { return pull(tk, T).then(function () { return push(tk, T); }).then(function (sent) { if (sent) return pull(tk, T); }); };
      }));
    });
  }

  function run() {
    if (!configured || !auth || !ad) return Promise.resolve();
    if (running) { again = true; return Promise.resolve(); }
    running = true; set({ status: 'syncing', error: '' });
    return cycle().then(function () { set({ status: 'idle', last: Date.now(), error: '' }); }, function (e) {
      if (e && e.auth) set({ status: 'signedout', email: '', error: '' });
      else if (!e || !e.status) set({ status: 'offline' });
      else set({ status: 'error', error: e.message });
    }).then(function () { running = false; if (again) { again = false; return run(); } });
  }
  function schedule() { if (!configured || !auth) return; clearTimeout(timer); timer = setTimeout(run, 1200); }

  function init(adapter) {
    ad = adapter;
    if (!configured) return;
    document.addEventListener('visibilitychange', function () { if (!document.hidden) run(); });
    window.addEventListener('focus', run);
    window.addEventListener('online', run);
    setInterval(function () { if (!document.hidden) run(); }, 60000);
    run();
  }

  window.TodoSync = {
    configured: configured, init: init, schedule: schedule, run: run, signIn: signIn, signUp: signUp, signOut: signOut,
    state: function () { return st; }, on: function (f) { subs.push(f); }, _merge: merge, _tables: TABLES
  };
})();
