const $ = s => document.querySelector(s);
const el = (t, a = {}, ...k) => { const e = document.createElement(t); for (const [x, v] of Object.entries(a)) x.startsWith('on') ? e.addEventListener(x.slice(2), v) : x === 'class' ? e.className = v : e.setAttribute(x, v);
  for (const c of k.flat()) e.append(c instanceof Node ? c : document.createTextNode(c ?? '')); return e; };
const ST = { created: 'Created', assigned: 'Assigned', picked_up: 'Picked up', out_for_delivery: 'Out for delivery', delivered: 'Delivered', failed: 'Delivery failed', cancelled: 'Cancelled' };
const FLOW = ['created', 'assigned', 'picked_up', 'out_for_delivery', 'delivered'];
const S = { role: sessionStorage.role, token: sessionStorage.token };
const when = s => new Date(s).toLocaleString();
async function api(p, method = 'GET', body) {
  const r = await fetch('/api' + p, { method, headers: { 'content-type': 'application/json', ...(S.token ? { authorization: 'Bearer ' + S.token } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({}));
  if (r.status === 401 && S.token) { logout(); throw new Error('Your session ended. Sign in again.'); }
  if (!r.ok) throw new Error(j.error || 'Something went wrong. Try again.'); return j;
}
function logout() { if (S.token) api('/auth/logout', 'POST').catch(() => {}); sessionStorage.clear(); S.role = S.token = null; render(); }
const msgBox = () => el('p', { role: 'status', 'aria-live': 'polite' });
const say = (box, text, bad) => { box.className = bad ? 'err' : 'good'; box.textContent = text; };
function load(box, fn, empty) { box.replaceChildren(el('p', { class: 'muted', role: 'status' }, 'Loading'));
  fn().then(n => box.replaceChildren(n ?? el('p', { class: 'muted' }, empty))).catch(e => box.replaceChildren(el('p', { class: 'err', role: 'alert' }, e.message))); }
const field = (id, label, type = 'text', extra = {}) => [el('label', { for: id }, label), el('input', { id, type, required: '', autocomplete: 'off', ...extra })];
const steps = st => el('div', { class: 'steps', role: 'img', 'aria-label': 'Progress: ' + ST[st] }, FLOW.map(s => el('span', FLOW.indexOf(s) <= FLOW.indexOf(st) ? { class: 'on' } : {})));

function render() {
  document.body.className = S.role || ''; const nav = $('#nav'), app = $('#app'); nav.replaceChildren(); app.replaceChildren();
  if (!S.token) return loginView(app);
  const tabs = { customer: customerTabs, partner: partnerTabs, admin: adminTabs }[S.role]();
  let cur = 0; const body = el('div');
  const show = i => { cur = i; [...nav.children].forEach((b, j) => b.setAttribute('aria-current', j === i)); tabs[i][1](body); };
  tabs.forEach((t, i) => nav.append(el('button', { onclick: () => show(i) }, t[0])));
  nav.append(el('button', { onclick: logout }, 'Sign out')); app.append(body); show(0);
}
function loginView(app) {
  let role = 'customer'; const form = el('form'), out = msgBox(), pick = el('div', { class: 'roles' });
  const draw = () => { document.body.className = role; pick.replaceChildren(...[['customer', 'Customer', 'Track your orders'], ['partner', 'Delivery partner', 'Your assigned deliveries'], ['admin', 'Administrator', 'Staff only']]
    .map(([r, a, b]) => el('button', { type: 'button', 'aria-pressed': r === role, onclick: () => { role = r; draw(); } }, el('strong', {}, a), el('br'), el('span', { class: 'muted' }, b))));
    form.replaceChildren(...fields(), el('p'), el('button', { type: 'submit' }, role === 'customer' && !otpSent ? 'Send code' : 'Sign in')); };
  let otpSent = false;
  const fields = () => role === 'customer' ? [...field('phone', 'Phone number with country code', 'tel', { placeholder: '+919000000001', inputmode: 'tel' }), ...(otpSent ? field('code', 'Six digit code', 'text', { inputmode: 'numeric', maxlength: 6 }) : [])]
    : role === 'partner' ? [...field('email', 'Email', 'email'), ...field('pw', 'Password', 'password')]
    : [...field('email', 'Administrator email', 'email'), ...field('aid', 'Administrator ID'), ...field('pw', 'Password', 'password')];
  form.addEventListener('submit', async e => { e.preventDefault(); const v = id => $('#' + id)?.value.trim(); try {
    let r;
    if (role === 'customer' && !otpSent) { await api('/auth/otp/request', 'POST', { phone: v('phone') }); otpSent = true; draw(); $('#phone').value = v('phone') || ''; say(out, 'If this number is registered, a code is on its way.'); return; }
    r = role === 'customer' ? await api('/auth/otp/verify', 'POST', { phone: v('phone'), code: v('code') })
      : role === 'partner' ? await api('/auth/partner/login', 'POST', { email: v('email'), password: $('#pw').value })
      : await api('/auth/admin/login', 'POST', { email: v('email'), admin_id: v('aid'), password: $('#pw').value });
    sessionStorage.token = S.token = r.token; sessionStorage.role = S.role = r.role; render();
  } catch (err) { say(out, err.message, true); } });
  app.append(el('h1', {}, 'Sign in'), pick, el('div', { class: 'card' }, form, out)); draw();
}
const statusLine = o => el('div', { class: 'row' }, el('span', {}, o.item), el('strong', {}, ST[o.status]));

// ---- Customer ----
function customerTabs() { return [['Orders', b => { const list = el('div'); b.replaceChildren(el('h1', {}, 'Your orders'), list);
  load(list, async () => { const o = await api('/orders'); return o.length ? el('div', {}, o.map(x => el('div', { class: 'card' }, statusLine(x), steps(x.status), el('div', { class: 'row' }, el('span', { class: 'muted' }, 'Updated ' + when(x.updated_at)), el('button', { onclick: () => customerOrder(b, x.id) }, 'Track order'))))) : null; }, 'You have no orders yet.'); }],
  ['Notifications', b => { const l = el('div'); b.replaceChildren(el('h1', {}, 'Notifications'), l);
    load(l, async () => { const n = await api('/notifications'); return n.length ? el('div', {}, n.map(x => el('div', { class: 'card' }, x.text, el('div', { class: 'muted' }, when(x.at))))) : null; }, 'No notifications yet.'); }]]; }
function customerOrder(b, id) { const info = el('div'), chat = el('div');
  b.replaceChildren(el('button', { class: 'quiet', onclick: render }, 'Back to orders'), el('h1', {}, 'Order details'), info, el('h2', {}, 'Support chat'), chat);
  load(info, async () => { const o = await api('/orders/' + id); return el('div', { class: 'card' }, statusLine(o), steps(o.status), el('p', {}, 'Delivering to ' + o.recipient_name), el('p', { class: 'muted' }, o.address), el('p', { class: 'muted' }, 'Order ' + o.id.slice(0, 8) + ', placed ' + when(o.created_at)),
    o.status === 'out_for_delivery' ? el('p', {}, 'Your delivery code was sent by SMS. Share it with the partner only when you receive the parcel.') : ''); });
  const draw = () => { const f = el('form'), t = el('textarea', { id: 'm', maxlength: 1000, required: '', 'aria-label': 'Message to support' }), o = msgBox(), list = el('div');
    f.append(t, el('p'), el('button', {}, 'Send message'), o);
    f.addEventListener('submit', async e => { e.preventDefault(); try { await api(`/orders/${id}/support`, 'POST', { body: t.value }); draw(); } catch (x) { say(o, x.message, true); } });
    chat.replaceChildren(list, f);
    load(list, async () => { const m = await api(`/orders/${id}/support`); return m.length ? el('div', {}, m.map(x => el('div', { class: 'msg ' + x.sender_role }, el('strong', {}, x.sender_role === 'customer' ? 'You: ' : 'Support: '), x.body))) : null; }, 'No messages yet. Ask support about this order here.'); };
  draw(); }

// ---- Partner ----
function partnerTabs() { return [['Assigned', b => { const l = el('div'); b.replaceChildren(el('h1', {}, 'Assigned deliveries'), l);
  load(l, async () => { const o = await api('/partner/orders'); return o.length ? el('div', {}, o.map(x => el('div', { class: 'card' }, el('div', { class: 'row' }, el('strong', {}, 'Order ' + x.id.slice(0, 8)), el('span', {}, ST[x.status])), el('button', { onclick: () => partnerOrder(b, x.id) }, 'Open delivery')))) : null; }, 'No active deliveries.'); }],
  ['History', b => { const l = el('div'); b.replaceChildren(el('h1', {}, 'Delivery history'), l);
    load(l, async () => { const h = await api('/partner/history'); return h.length ? el('div', { class: 'card wrap' }, el('table', {}, el('tr', {}, ['Order', 'Result', 'Completed'].map(x => el('th', {}, x))), h.map(x => el('tr', {}, el('td', {}, x.id.slice(0, 8)), el('td', {}, ST[x.status]), el('td', {}, when(x.completed_at)))))) : null; }, 'Completed deliveries will appear here.'); }],
  ['Ratings', b => { const l = el('div'); b.replaceChildren(el('h1', {}, 'Ratings'), l);
    load(l, async () => { const r = await api('/partner/ratings'); return r.length ? el('div', {}, r.map(x => el('div', { class: 'card row' }, el('span', {}, 'Order ' + x.order_id.slice(0, 8)), el('strong', {}, x.stars + ' of 5')))) : null; }, 'No ratings yet.'); }]]; }
function partnerOrder(b, id) { const info = el('div'), out = msgBox();
  const act = (label, status, cls) => el('button', { class: cls || '', onclick: async () => { try { await api(`/partner/orders/${id}/status`, 'POST', { status }); partnerOrder(b, id); } catch (e) { say(out, e.message, true); } } }, label);
  b.replaceChildren(el('button', { class: 'quiet', onclick: render }, 'Back to deliveries'), el('h1', {}, 'Delivery details'), info, out);
  load(info, async () => { const o = await api('/partner/orders/' + id); const c = el('div', { class: 'card' }, statusLine(o), el('p', {}, 'Recipient: ' + o.recipient_first_name),
    o.address ? el('p', {}, 'Address: ' + o.address) : el('p', { class: 'muted' }, 'The address appears after pickup.'),
    el('p', { class: 'muted' }, 'Customer phone numbers are never shown to partners.'));
    if (o.status === 'assigned') c.append(act('Mark picked up', 'picked_up'));
    if (o.status === 'picked_up') c.append(act('Start delivery', 'out_for_delivery'));
    if (o.status === 'out_for_delivery') { const f = el('form'), box = msgBox(); f.append(...field('dc', 'Delivery code from customer', 'text', { inputmode: 'numeric', maxlength: 6 }), el('p'), el('button', {}, 'Confirm delivery'), box);
      f.addEventListener('submit', async e => { e.preventDefault(); try { await api(`/partner/orders/${id}/deliver`, 'POST', { code: $('#dc').value.trim() }); render(); } catch (x) { say(box, x.message, true); } });
      c.append(f, el('p'), act('Report failed delivery', 'failed', 'warn')); }
    return c; }); }

// ---- Administrator ----
function adminTabs() { return [['Orders', adminOrders], ['Support', adminSupport], ['Audit log', b => { const l = el('div'); b.replaceChildren(el('h1', {}, 'Audit log'), l);
  load(l, async () => { const a = await api('/admin/audit'); return a.length ? el('div', { class: 'card wrap' }, el('table', {}, el('tr', {}, ['When', 'Actor', 'Action', 'Order'].map(x => el('th', {}, x))), a.map(x => el('tr', {}, el('td', {}, when(x.at)), el('td', {}, x.actor_role + ' ' + x.actor_id.slice(0, 8)), el('td', {}, x.action), el('td', {}, x.order_id ? x.order_id.slice(0, 8) : ''))))) : null; }, 'No events recorded.'); }]]; }
function adminOrders(b) { const sum = el('div'), list = el('div'), out = msgBox(), f = el('form');
  f.append(...field('cp', 'Customer phone', 'tel', { placeholder: '+919000000001' }), ...field('rn', 'Recipient name'), ...field('ad', 'Delivery address'), ...field('it', 'Item'), el('p'), el('button', {}, 'Create order'), out);
  f.addEventListener('submit', async e => { e.preventDefault(); try { await api('/admin/orders', 'POST', { customer_phone: $('#cp').value.trim(), recipient_name: $('#rn').value, address: $('#ad').value, item: $('#it').value }); say(out, 'Order created.'); f.reset(); draw(); } catch (x) { say(out, x.message, true); } });
  b.replaceChildren(el('h1', {}, 'Orders'), sum, el('h2', {}, 'New order'), el('div', { class: 'card' }, f), el('h2', {}, 'All orders'), list);
  load(sum, async () => { const s = await api('/admin/summary'); return el('p', { class: 'card' }, `Today: ${s.delivered} delivered, ${s.failed} failed, ${s.cancelled} cancelled.`); });
  const draw = () => load(list, async () => { const [o, p] = await Promise.all([api('/admin/orders'), api('/admin/partners')]);
    return o.length ? el('div', {}, o.map(x => { const sel = el('select', { 'aria-label': 'Delivery partner' }, el('option', { value: '' }, 'Choose partner'), p.map(y => el('option', { value: y.id, ...(y.id === x.partner_id ? { selected: '' } : {}) }, y.name))); const m = msgBox();
      const call = (path, body) => async () => { try { await api(`/admin/orders/${x.id}/${path}`, 'POST', body()); draw(); } catch (e) { say(m, e.message, true); } };
      return el('div', { class: 'card' }, el('div', { class: 'row' }, el('strong', {}, x.item), el('span', {}, ST[x.status])), el('p', { class: 'muted' }, `${x.recipient_name}, ${x.address} (order ${x.id.slice(0, 8)})`), steps(x.status),
        el('div', { class: 'row' }, sel, el('button', { onclick: call('assign', () => ({ partner_id: sel.value })) }, x.partner_id ? 'Reassign' : 'Assign'), el('button', { class: 'warn', onclick: call('cancel', () => null) }, 'Cancel order')), m); })) : null; }, 'No orders yet. Create the first one above.');
  draw(); }
function adminSupport(b) { const l = el('div'); b.replaceChildren(el('h1', {}, 'Support inbox'), l);
  load(l, async () => { const m = await api('/admin/support'); if (!m.length) return null; return el('div', {}, m.map(x => { const t = el('input', { 'aria-label': 'Reply', maxlength: 1000 }), o = msgBox();
    return el('div', { class: 'card' }, el('div', { class: 'muted' }, 'Order ' + x.order_id.slice(0, 8) + ', ' + when(x.at)), el('div', { class: 'msg ' + x.sender_role }, el('strong', {}, x.sender_role + ': '), x.body),
      x.sender_role === 'customer' ? el('div', { class: 'row' }, t, el('button', { onclick: async () => { try { await api(`/admin/orders/${x.order_id}/support`, 'POST', { body: t.value }); say(o, 'Reply sent.'); t.value = ''; } catch (e) { say(o, e.message, true); } } }, 'Send reply')) : '', o); })); }, 'No support requests.'); }
render();
