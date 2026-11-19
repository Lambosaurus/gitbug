import './style.css';
import { search } from './fuzzy.js';
import { gh, fetchAllRepos, AuthError } from './github.js';

const TOKEN_KEY = 'gitbug.token';
const CACHE_KEY = 'gitbug.repos.v1';
const MAX_RENDER = 300;
const STALE_MS = 60 * 1000; // background refresh if cache is older than this

const $ = (id) => document.getElementById(id);

let repos = [];      // [{id, n, d, u, p, f, a, l, t, o, nl, dl}]
let results = [];    // [{r, score, hits}]
let sel = 0;
let fetchedAt = 0;
let loading = false;

/* ---------- storage ---------- */

function sget(k) { try { return localStorage.getItem(k); } catch { return null; } }
function sset(k, v) {
  try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch { /* ignore */ }
}

/* ---------- rendering ---------- */

function ago(t) {
  const s = (Date.now() - t) / 1000;
  if (s < 60) return 'just now';
  const units = [[60, 'm'], [24, 'h'], [30, 'd'], [12, 'mo'], [Infinity, 'y']];
  let v = s / 60;
  for (const [div, u] of units) {
    if (v < div) return Math.floor(v) + u + ' ago';
    v /= div;
  }
  return '';
}

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

function highlighted(text, hits) {
  const frag = document.createDocumentFragment();
  const set = new Set(hits);
  let buf = '';
  let inHit = false;
  const flush = () => {
    if (!buf) return;
    frag.appendChild(inHit ? el('mark', null, buf) : document.createTextNode(buf));
    buf = '';
  };
  for (let i = 0; i < text.length; i++) {
    const h = set.has(i);
    if (h !== inHit) { flush(); inHit = h; }
    buf += text[i];
  }
  flush();
  return frag;
}

function render() {
  const list = $('list');
  list.textContent = '';
  const frag = document.createDocumentFragment();
  const shown = results.slice(0, MAX_RENDER);
  shown.forEach(({ r, hits }, i) => {
    const li = el('li');
    const a = el('a');
    a.href = r.u;
    a.rel = 'noopener';
    if (i === sel) a.classList.add('sel');

    if (r.o) {
      const img = el('img', 'avatar');
      img.src = r.o + (r.o.includes('?') ? '&' : '?') + 's=48';
      img.alt = '';
      img.loading = 'lazy';
      a.appendChild(img);
    }
    const body = el('div', 'body');
    const title = el('div', 'title');
    const slash = r.n.indexOf('/');
    const owner = el('span', 'owner');
    owner.appendChild(highlighted(r.n.slice(0, slash + 1), hits));
    const name = el('span', 'name');
    name.appendChild(highlighted(r.n.slice(slash + 1), hits.map((h) => h - slash - 1)));
    title.append(owner, name);
    if (r.p) title.appendChild(el('span', 'badge', 'private'));
    if (r.f) title.appendChild(el('span', 'badge', 'fork'));
    if (r.a) title.appendChild(el('span', 'badge warn', 'archived'));
    body.appendChild(title);
    if (r.d) body.appendChild(el('div', 'desc', r.d));
    a.appendChild(body);

    const meta = el('div', 'meta');
    if (r.l) meta.appendChild(el('span', 'lang', r.l));
    meta.appendChild(el('span', 'time', ago(r.t)));
    a.appendChild(meta);

    li.appendChild(a);
    frag.appendChild(li);
  });
  if (!shown.length && repos.length) frag.appendChild(el('li', 'empty', 'No matches.'));
  list.appendChild(frag);
  updateStatus();
}

function updateStatus() {
  const q = $('q').value.trim();
  let s = q ? `${results.length} of ${repos.length}` : `${repos.length} repos`;
  if (results.length > MAX_RENDER) s += ` (showing ${MAX_RENDER})`;
  if (loading) s += ' · refreshing…';
  else if (fetchedAt) s += ` · updated ${ago(fetchedAt)}`;
  $('status').textContent = s;
}

function moveSel(delta) {
  const n = Math.min(results.length, MAX_RENDER);
  if (!n) return;
  sel = (sel + delta + n) % n;
  const links = $('list').querySelectorAll('a');
  links.forEach((a, i) => a.classList.toggle('sel', i === sel));
  links[sel].scrollIntoView?.({ block: 'nearest' });
}

function runSearch() {
  results = search(repos, $('q').value);
  sel = 0;
  render();
  window.scrollTo(0, 0);
}

/* ---------- data flow ---------- */

function setRepos(list) {
  repos = list.map((r) => ({ ...r, nl: r.n.toLowerCase(), dl: r.d.toLowerCase() }));
  runSearch();
}

function loadCache() {
  try {
    const c = JSON.parse(sget(CACHE_KEY));
    if (c && Array.isArray(c.repos)) {
      fetchedAt = c.at || 0;
      setRepos(c.repos);
      return true;
    }
  } catch { /* ignore */ }
  return false;
}

async function refresh() {
  const token = sget(TOKEN_KEY);
  if (!token || loading) return;
  loading = true;
  $('refresh').disabled = true;
  updateStatus();
  try {
    const list = await fetchAllRepos(token);
    fetchedAt = Date.now();
    sset(CACHE_KEY, JSON.stringify({ at: fetchedAt, repos: list }));
    loading = false;
    const q = $('q').value;
    const selId = results[sel] && results[sel].r.id;
    setRepos(list);
    // keep the selection stable if the user was navigating
    if (q && selId) {
      const i = results.findIndex((x) => x.r.id === selId);
      if (i >= 0 && i < MAX_RENDER) { sel = 0; moveSel(i); }
    }
  } catch (e) {
    loading = false;
    if (e instanceof AuthError) return logout(e.message);
    $('status').textContent = e.message;
  } finally {
    $('refresh').disabled = false;
  }
}

function showLogin(msg) {
  $('app').hidden = true;
  $('login').hidden = false;
  const err = $('login-error');
  err.hidden = !msg;
  err.textContent = msg || '';
  $('token').focus();
}

function showApp() {
  $('login').hidden = true;
  $('app').hidden = false;
  $('q').focus();
}

function logout(msg) {
  sset(TOKEN_KEY, null);
  sset(CACHE_KEY, null);
  repos = [];
  results = [];
  $('list').textContent = '';
  showLogin(typeof msg === 'string' ? msg : '');
}

/* ---------- wiring ---------- */

$('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const token = $('token').value.trim();
  if (!token) return;
  const btn = e.submitter || $('login-form').querySelector('button');
  btn.disabled = true;
  try {
    await gh('/user', token);
    sset(TOKEN_KEY, token);
    $('token').value = '';
    showApp();
    $('status').textContent = 'Loading…';
    refresh();
  } catch (err) {
    showLogin(err.message);
  } finally {
    btn.disabled = false;
  }
});

$('q').addEventListener('input', runSearch);

$('q').addEventListener('keydown', (e) => {
  if (e.key === 'ArrowDown' || (e.ctrlKey && e.key === 'n')) { e.preventDefault(); moveSel(1); }
  else if (e.key === 'ArrowUp' || (e.ctrlKey && e.key === 'p')) { e.preventDefault(); moveSel(-1); }
  else if (e.key === 'Enter') {
    e.preventDefault();
    const hit = results[sel];
    if (!hit) return;
    if (e.metaKey || e.ctrlKey) window.open(hit.r.u, '_blank', 'noopener');
    else location.href = hit.r.u;
  } else if (e.key === 'Escape') {
    if ($('q').value) { $('q').value = ''; runSearch(); }
  }
});

document.addEventListener('keydown', (e) => {
  if (e.key === '/' && document.activeElement !== $('q') && !$('app').hidden) {
    e.preventDefault();
    $('q').focus();
    $('q').select();
  }
});

$('refresh').addEventListener('click', refresh);
$('logout').addEventListener('click', () => logout());

// Coming back to the tab (or via the back button) — refresh if stale.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && Date.now() - fetchedAt > STALE_MS) refresh();
});
window.addEventListener('pageshow', (e) => {
  if (e.persisted) { $('q').focus(); if (Date.now() - fetchedAt > STALE_MS) refresh(); }
});
setInterval(updateStatus, 30 * 1000);

(function init() {
  if (!sget(TOKEN_KEY)) return showLogin();
  showApp();
  loadCache();
  refresh();
})();
