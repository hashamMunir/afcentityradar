// Account page: plan, remaining checks, referral link, billing portal, account deletion.
(function () {
  'use strict';
  var el = function (id) { return document.getElementById(id); };
  function show(me) {
    var box = el('account-box'); if (!box) return;
    var A = window.AFC_AUTH;
    if (!A || !A.session()) { el('acc-out').hidden = false; el('acc-in').hidden = true; return; }
    el('acc-out').hidden = true; el('acc-in').hidden = false;
    el('acc-email').textContent = me.email || '';
    el('acc-plan').textContent = (me.plan || 'free').toUpperCase();
    el('acc-left').textContent = me.remaining + ' of ' + me.limit + ' checks left this ' + (String(me.period).length === 7 ? 'month' : 'day');
    el('acc-use').textContent = me.useType || 'personal';
    var link = location.origin + '/?ref=' + me.ref; el('acc-ref').value = link;
    el('acc-biz').hidden = !(me.useType === 'business' && me.plan === 'free');
    if (/checkout=success/.test(location.search)) el('acc-thanks').hidden = false;
  }
  function wait(n) {
    var A = window.AFC_AUTH;
    if (A && A.me()) return show(A.me());
    if (n > 40) return show({});
    setTimeout(function () { wait(n + 1); }, 250);
  }
  document.addEventListener('DOMContentLoaded', function () {
    wait(0);
    var cp = el('acc-copy'); if (cp) cp.onclick = function () { try { navigator.clipboard.writeText(el('acc-ref').value); cp.textContent = 'Copied'; } catch (e) {} };
    var pb = el('acc-portal'); if (pb) pb.onclick = function () { window.AFC_AUTH.api('/api/portal', {}).then(function (j) { if (/^https:\/\/billing\.stripe\.com\//.test(j.url)) location.href = j.url; }).catch(function (e) { window.AFC_AUTH.toast(e.message); }); };
    var del = el('acc-delete'); if (del) del.onclick = function () {
      var t = prompt('This permanently deletes your account. Cancel any subscription in "Manage billing" first. Type DELETE to confirm.');
      if (t !== 'DELETE') return;
      window.AFC_AUTH.api('/api/delete-account', {}).then(function () { return window.AFC_AUTH.client.auth.signOut(); }).then(function () { location.href = '/?deleted=1'; }).catch(function (e) { window.AFC_AUTH.toast(e.message); });
    };
  });
})();
