'use strict';
const $ = s => document.querySelector(s), app = $('#app');
let tok = null, role = null, view = 'orders', mode = 'customer', cur = null;
const h = (t, a = {}, ...k) => { const e = document.createElement(t); for (const [n, v] of Object.entries(a)) n.startsWith('on') ? e.addEventListener(n.slice(2), v) : e.setAttribute(n, v);
  k.flat().forEach(c => e.append(c)); return e; };
const api = async (m, p, b) => { const r = await fetch(p, { method: m, headers: { 'content-type': 'application/json', ...(tok && { authorization: 'Bearer ' + tok }) }, body: b && JSON.stringify(b) });
  const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || 'Something went wrong. Try again.'); return j; };
const say = (e, t, bad) => { e.textContent = t; e.className = bad ? 'err' : 'mute'; };
const field = (id, label, type = 'text', ac) => h('label', {}, label, h('input', { id, type, autocomplete: ac || 'off', required: '' }));
const FORMS = {
  customer: { fields: () => [field('phone', 'Phone number', 'tel', 'tel')], otp: true },
  partner: { fields: () => [field('u', 'Partner username'), field('pw', 'Password', 'password', 'current-password')], path: '/api/auth/partner', body: () => ({ username: $('#u').value, password: $('#pw').value }) },
  admin: { fields: () => [field('em', 'Administrator email', 'email'), field('aid', 'Administrator ID'), field('pw', 'Password', 'password', 'current-password')], path: '/api/auth/admin',
    body: () => ({ email: $('#em').value, adminId: $('#aid').value, password: $('#pw').value }) } };
function login() {
  const f = FORMS[mode], msg = h('p', { role: 'status' }), tabs = h('div', { class: 'tabs', role: 'tablist' }, ['customer', 'partner', 'admin'].map(m =>
    h('button', { role: 'tab', 'aria-selected': m === mode, onclick: () => { mode = m; login(); } }, { customer: 'Customer', partner: 'Delivery partner', admin: 'Administrator' }[m])));
  const form = h('form', {}, f.fields(), h('button', { class: 'primary' }, f.otp ? 'Send code' : 'Sign in'), msg);
  form.onsubmit = async e => { e.preventDefault(); say(msg, 'Working...');
    try {
      if (f.otp && !form.querySelector('#code')) { await api('POST', '/api/auth/otp/request', { phone: $('#phone').value });
        form.insertBefore(field('code', 'Code from your SMS', 'text', 'one-time-code'), form.lastChild.previousSibling); form.querySelector('button').textContent = 'Verify and sign in'; say(msg, 'If this number is registered, a code was sent.'); return; }
      const r = f.otp ? await api('POST', '/api/auth/otp/verify', { phone: $('#phone').value, code: $('#code').value }) : await api('POST', f.path, f.body());
      tok = r.token; role = r.role; view = 'orders'; shell();
    } catch (x) { say(msg, x.message, true); } };
  app.replaceChildren(h('h1', {}, 'Sign in'), tabs, form); $('#nav').replaceChildren(); $('#out').hidden = true;
}
const VIEWS = { customer: ['orders', 'history', 'notifications'], partner: ['orders', 'history'], admin: ['orders', 'audit'] };
function shell() {
  $('#out').hidden = false; $('#out').onclick = () => { tok = null; login(); };
  $('#nav').replaceChildren(...VIEWS[role].map(v => h('button', { 'aria-current': v === view, onclick: () => { view = v; cur = null; shell(); } }, v[0].toUpperCase() + v.slice(1))));
  render();
}
async function render() {
  app.replaceChildren(h('p', {}, 'Loading...'));
  try {
    if (cur) return detail();
    const path = { orders: '/api/orders', history: '/api/history', notifications: '/api/notifications', audit: '/api/audit' }[view], rows = await api('GET', path);
    if (!rows.length) return app.replaceChildren(h('p', { class: 'mute' }, view === 'orders' ? 'No orders yet. New orders appear here.' : 'Nothing to show yet.'));
    app.replaceChildren(h('h1', {}, view[0].toUpperCase() + view.slice(1)), ...rows.map(r => h('div', { class: 'card' },
      Object.entries(r).filter(([k]) => k !== 'id' || view !== 'audit').map(([k, v]) => h('div', {}, h('span', { class: 'mute' }, k.replace(/_/g, ' ') + ': '), String(v ?? '-'))),
      r.id && view !== 'history' ? h('button', { onclick: () => { cur = r.id; render(); } }, 'Open') : '')));
  } catch (x) { app.replaceChildren(h('p', { class: 'err' }, x.message), h('button', { onclick: render }, 'Try again')); }
}
async function detail() {
  const o = await api('GET', '/api/orders/' + cur), msg = h('p', { role: 'status' }), parts = [h('button', { onclick: () => { cur = null; render(); } }, 'Back'), h('h1', {}, 'Order ' + o.id.slice(0, 8)),
    h('div', { class: 'card' }, h('p', { class: 'status' }, o.status.replace(/_/g, ' ')), Object.entries(o).filter(([k]) => !['id', 'status'].includes(k)).map(([k, v]) => h('div', {}, k.replace(/_/g, ' ') + ': ' + (v ?? '-'))), msg)];
  const act = (label, status, withCode) => h('button', { class: 'primary', onclick: async () => { try { const b = { status }; if (withCode) b.code = $('#dc').value; await api('POST', `/api/orders/${cur}/status`, b); say(msg, 'Saved.'); setTimeout(render, 600); } catch (x) { say(msg, x.message, true); } } }, label);
  if (role === 'partner') parts.push(h('div', { class: 'row' }, o.status === 'assigned' ? act('Mark picked up', 'picked_up') : '', o.status === 'picked_up' ? act('Start delivery', 'out_for_delivery') : '',
    o.status === 'out_for_delivery' ? [h('input', { id: 'dc', inputmode: 'numeric', maxlength: 6, placeholder: 'Delivery code', 'aria-label': 'Delivery code' }), act('Confirm delivered', 'delivered', true), act('Report failed', 'failed')] : ''));
  if (role === 'admin' && !['delivered', 'cancelled'].includes(o.status)) parts.push(act('Cancel order', 'cancelled'));
  if (role !== 'partner') parts.push(await chat());
  app.replaceChildren(...parts);
}
async function chat() {
  const list = await api('GET', `/api/orders/${cur}/messages`).catch(() => []), box = h('div', { class: 'card' }, h('h2', {}, 'Support'), list.length ? list.map(m => h('p', {}, m.body)) : h('p', { class: 'mute' }, 'No messages yet. Ask about this order below.'));
  const i = h('input', { 'aria-label': 'Message', maxlength: 500 }), s = h('button', { class: 'primary', onclick: async () => { if (!i.value) return; try { await api('POST', `/api/orders/${cur}/messages`, { body: i.value }); render(); } catch (x) { s.after(h('span', { class: 'err' }, x.message)); } } }, 'Send');
  box.append(h('div', { class: 'row' }, i, s)); return box;
}
login();
