// Accounts, quota badge, sign-up / sign-in modal, checkout buttons. Uses Supabase Auth (email + password or magic link).
(function () {
  'use strict';
  var C = window.AFC_CONFIG || {};
  var el = function (id) { return document.getElementById(id); };
  var mk = function (t, c, x) { var e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; };
  var sb = (window.supabase && C.SUPABASE_URL && C.SUPABASE_ANON_KEY) ? window.supabase.createClient(C.SUPABASE_URL, C.SUPABASE_ANON_KEY, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' } }) : null;
  var session = null, me = null, quota = null;

  // Referral: ?ref=<id> is remembered so the referrer gets bonus checks when this visitor signs up
  try { var ref = new URLSearchParams(location.search).get('ref'); if (ref && /^[0-9a-f-]{36}$/i.test(ref)) localStorage.setItem('afc_ref', ref); } catch (e) {}

  function token() { return session && session.access_token ? session.access_token : null; }
  function api(path, body) {
    var h = { 'Content-Type': 'application/json' }; if (token()) h.Authorization = 'Bearer ' + token();
    return fetch(path, { method: body ? 'POST' : 'GET', headers: h, body: body ? JSON.stringify(body) : undefined, credentials: 'same-origin' })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok) { var e = new Error(j.error || 'Request failed'); e.status = r.status; throw e; } return j; }); });
  }

  // ---------- header account box ----------
  function renderBox() {
    var box = el('acct'); if (!box) return; box.replaceChildren();
    var q = quota || me;
    if (q && q.limit != null) {
      var b = mk('span', 'quota', (q.plan === 'anonymous' ? 'Free checks today: ' : (q.plan || 'free').toUpperCase() + ' · checks left: ') + (q.remaining != null ? q.remaining : '—') + ' / ' + q.limit);
      box.appendChild(b);
    }
    if (session) {
      var a = mk('a', 'btn', 'Account'); a.href = '/account/'; box.appendChild(a);
      var o = mk('button', 'btn', 'Sign out'); o.type = 'button'; o.onclick = function () { sb.auth.signOut().then(function () { location.reload(); }); }; box.appendChild(o);
    } else {
      var s = mk('button', 'btn', 'Sign in'); s.type = 'button'; s.onclick = function () { open('signin'); }; box.appendChild(s);
      var u = mk('button', 'btn primary-sm', 'Create free account'); u.type = 'button'; u.onclick = function () { open('signup'); }; box.appendChild(u);
    }
    if (me && me.useType === 'business' && me.plan === 'free') {
      var n = el('biz-note'); if (n) n.hidden = false;
    }
  }
  function refreshMe() { return api('/api/me').then(function (j) { me = j; quota = null; renderBox(); return j; }).catch(function () { renderBox(); }); }

  // ---------- modal ----------
  var modal, captchaToken = null, tsWidget = null;
  function loadTurnstile(cb) {
    if (!C.TURNSTILE_SITE_KEY) return cb();
    if (window.turnstile) return cb();
    var s = document.createElement('script'); s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'; s.async = true; s.onload = cb; document.head.appendChild(s);
  }
  function field(label, type, name, attrs) {
    var l = mk('label', 'fld'); l.appendChild(mk('span', null, label)); var i = mk('input'); i.type = type; i.name = name; Object.keys(attrs || {}).forEach(function (k) { i.setAttribute(k, attrs[k]); }); l.appendChild(i); return l;
  }
  function open(mode) {
    if (!sb) { alertBox('Accounts are not configured on this site yet.'); return; }
    close(); captchaToken = null;
    modal = mk('div', 'modal-back'); var m = mk('div', 'modal card'); m.setAttribute('role', 'dialog'); m.setAttribute('aria-modal', 'true');
    var x = mk('button', 'modal-x', '×'); x.type = 'button'; x.setAttribute('aria-label', 'Close'); x.onclick = close; m.appendChild(x);
    m.appendChild(mk('h2', null, mode === 'signup' ? 'Create your free account' : mode === 'magic' ? 'Sign in with an email link' : 'Sign in'));
    m.appendChild(mk('p', 'note', mode === 'signup' ? 'Free accounts get ' + (C.FREE_MONTHLY_LIMIT || 30) + ' checks per month. Free for personal, research, journalism and non-profit use; business use needs a paid plan.' : 'Welcome back.'));
    var f = mk('form', 'authform'); f.noValidate = false;
    f.appendChild(field('Email', 'email', 'email', { required: '', autocomplete: 'email', maxlength: '200' }));
    if (mode !== 'magic') f.appendChild(field('Password', 'password', 'password', { required: '', minlength: '10', maxlength: '128', autocomplete: mode === 'signup' ? 'new-password' : 'current-password' }));
    if (mode === 'signup') {
      var l = mk('label', 'fld'); l.appendChild(mk('span', null, 'I will use it for')); var s = mk('select'); s.name = 'use_type';
      [['personal', 'Personal / learning'], ['research', 'Research / academic'], ['journalism', 'Journalism'], ['ngo', 'Non-profit / NGO'], ['business', 'Business (needs a paid plan)']].forEach(function (o) { s.appendChild(new Option(o[1], o[0])); });
      l.appendChild(s); f.appendChild(l);
      var t = mk('label', 'chk'); var cb = mk('input'); cb.type = 'checkbox'; cb.required = true; cb.name = 'terms'; t.appendChild(cb);
      var tx = mk('span', null, 'I accept the '); var a1 = mk('a', null, 'terms'); a1.href = '/terms/'; a1.target = '_blank'; var a2 = mk('a', null, 'privacy notice'); a2.href = '/privacy/'; a2.target = '_blank';
      tx.appendChild(a1); tx.appendChild(document.createTextNode(' and the ')); tx.appendChild(a2); t.appendChild(tx); f.appendChild(t);
    }
    var cap = mk('div', 'cap'); f.appendChild(cap);
    var msg = mk('div', 'note msg'); f.appendChild(msg);
    var go = mk('button', 'btn primary', mode === 'signup' ? 'Create account' : mode === 'magic' ? 'Email me a sign-in link' : 'Sign in'); go.type = 'submit'; f.appendChild(go);
    f.onsubmit = function (e) {
      e.preventDefault(); msg.textContent = ''; go.disabled = true;
      var email = f.email.value.trim(), pw = f.password ? f.password.value : null;
      if (C.TURNSTILE_SITE_KEY && !captchaToken) { msg.textContent = 'Please complete the security check.'; go.disabled = false; return; }
      var opts = captchaToken ? { captchaToken: captchaToken } : {};
      var p;
      if (mode === 'signup') {
        var ref = null; try { ref = localStorage.getItem('afc_ref'); } catch (x) {}
        p = sb.auth.signUp({ email: email, password: pw, options: Object.assign({ emailRedirectTo: location.origin + '/account/', data: { use_type: f.use_type.value, referred_by: ref || undefined } }, opts) })
          .then(function (r) { if (r.error) throw r.error; msg.textContent = 'Check your inbox to confirm your email, then sign in.'; });
      } else if (mode === 'magic') {
        p = sb.auth.signInWithOtp({ email: email, options: Object.assign({ emailRedirectTo: location.origin + '/' }, opts) }).then(function (r) { if (r.error) throw r.error; msg.textContent = 'Sign-in link sent. Check your inbox.'; });
      } else {
        p = sb.auth.signInWithPassword({ email: email, password: pw, options: opts }).then(function (r) { if (r.error) throw r.error; close(); });
      }
      p.catch(function (err) { msg.textContent = (err && err.message) || 'Something went wrong.'; }).then(function () { go.disabled = false; if (window.turnstile && tsWidget != null) { try { window.turnstile.reset(tsWidget); captchaToken = null; } catch (x) {} } });
    };
    m.appendChild(f);
    var sw = mk('div', 'chips');
    if (mode !== 'signin') { var b1 = mk('button', 'chip', 'I have an account'); b1.type = 'button'; b1.onclick = function () { open('signin'); }; sw.appendChild(b1); }
    if (mode !== 'signup') { var b2 = mk('button', 'chip', 'Create free account'); b2.type = 'button'; b2.onclick = function () { open('signup'); }; sw.appendChild(b2); }
    if (mode !== 'magic') { var b3 = mk('button', 'chip', 'Email me a link instead'); b3.type = 'button'; b3.onclick = function () { open('magic'); }; sw.appendChild(b3); }
    m.appendChild(sw);
    modal.appendChild(m); modal.addEventListener('click', function (e) { if (e.target === modal) close(); });
    document.body.appendChild(modal); f.email.focus();
    document.addEventListener('keydown', escClose);
    loadTurnstile(function () { if (window.turnstile && C.TURNSTILE_SITE_KEY) tsWidget = window.turnstile.render(cap, { sitekey: C.TURNSTILE_SITE_KEY, theme: 'dark', callback: function (t) { captchaToken = t; }, 'expired-callback': function () { captchaToken = null; } }); });
  }
  function escClose(e) { if (e.key === 'Escape') close(); }
  function close() { if (modal) { modal.remove(); modal = null; document.removeEventListener('keydown', escClose); } }
  function alertBox(t) { var d = mk('div', 'toast', t); document.body.appendChild(d); setTimeout(function () { d.remove(); }, 4500); }

  // ---------- checkout buttons (pricing page and anywhere with data-checkout) ----------
  function checkout(plan, btn) {
    if (!session) { open('signup'); return; }
    if (btn) btn.disabled = true;
    api('/api/checkout', { plan: plan }).then(function (j) { if (j.url && /^https:\/\/checkout\.stripe\.com\//.test(j.url)) location.href = j.url; else throw new Error('Unexpected payment link'); })
      .catch(function (e) { alertBox(e.message); if (btn) btn.disabled = false; });
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-checkout]'); if (b) { e.preventDefault(); checkout(b.getAttribute('data-checkout'), b); }
    var s = e.target.closest && e.target.closest('[data-signup]'); if (s) { e.preventDefault(); open('signup'); }
  });

  window.AFC_AUTH = {
    token: function () { return sb ? sb.auth.getSession().then(function (r) { session = r.data.session; return token(); }) : null; },
    setQuota: function (q) { if (q) { quota = q; renderBox(); } },
    open: open,
    limitReached: function () {},
    api: api, client: sb, me: function () { return me; }, session: function () { return session; }, toast: alertBox, refresh: refreshMe,
  };

  if (sb) {
    sb.auth.getSession().then(function (r) { session = r.data.session; refreshMe(); });
    sb.auth.onAuthStateChange(function (_e, s) { session = s; refreshMe(); });
  } else { refreshMe(); }
})();
