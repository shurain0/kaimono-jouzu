/* =========================================================
   買い物上手 — 共通部品（データ・日付・画面の土台）
   ========================================================= */
'use strict';

// ---------- 定数 ----------
const SCHEMA = 1; // データ形式のバージョン。形を変えるときは migrate() に処理を足す

// 満足度を記録するタイミング
const CPS = [
  { k: 'd3', label: '3日後', short: '3日', days: 3 },
  { k: 'w1', label: '1週間後', short: '1週', days: 7 },
  { k: 'w2', label: '2週間後', short: '2週', days: 14 },
  { k: 'm1', label: '1ヶ月後', short: '1月', months: 1 },
  { k: 'm3', label: '3ヶ月後', short: '3月', months: 3 },
  { k: 'm6', label: '半年後', short: '半年', months: 6 },
  { k: 'y1', label: '1年後', short: '1年', months: 12 },
];
const CONS_DAYS = 7; // 消耗品は買ってから1週間後に1回だけ感想を聞く
const KINDS = [
  { v: '', label: '長く使うもの' },
  { v: 'consumable', label: '消耗品' },
];
const SCORES = [
  { v: 1, face: '😞', label: '後悔' },
  { v: 2, face: '😕', label: 'いまいち' },
  { v: 3, face: '😐', label: 'ふつう' },
  { v: 4, face: '😊', label: '満足' },
  { v: 5, face: '🤩', label: '大満足' },
];
const USES = [
  { v: 3, label: 'よく使う' },
  { v: 2, label: 'たまに' },
  { v: 1, label: 'ほぼ使ってない' },
];
const DESIRES = [
  { v: 1, label: 'ちょっと欲しい' },
  { v: 2, label: '欲しい' },
  { v: 3, label: 'めっちゃ欲しい' },
];
const BANDS = [
  { k: 'b0', label: '〜1,000円', min: 0, max: 999 },
  { k: 'b1', label: '1,000円台', min: 1000, max: 1999 },
  { k: 'b2', label: '2,000円台', min: 2000, max: 2999 },
  { k: 'b3', label: '3,000円台', min: 3000, max: 4999 },
  { k: 'b5', label: '5,000円台', min: 5000, max: 9999 },
  { k: 'b10', label: '1万円台', min: 10000, max: 19999 },
  { k: 'b20', label: '2万円台', min: 20000, max: 29999 },
  { k: 'b30', label: '3万円〜', min: 30000, max: Infinity },
];
const OCCASIONS = ['誕生日', 'クリスマス', '記念日', 'お祝い', 'お礼', '母の日', '父の日', 'バレンタイン', 'ホワイトデー', '手土産'];
const REACTIONS = [
  { v: 3, face: '😍', label: 'すごく喜んだ' },
  { v: 2, face: '🙂', label: '喜んでくれた' },
  { v: 1, face: '😐', label: 'ふつう' },
];

// ---------- 小物 ----------
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const yen = (n) => (n == null || n === '' || isNaN(n) ? '' : '¥' + Number(n).toLocaleString('ja-JP'));
const num = (v) => { const n = parseInt(String(v || '').replace(/[^\d]/g, ''), 10); return isNaN(n) ? null : n; };
const avg = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
const fmt1 = (n) => (n == null ? '—' : n.toFixed(1));

// ---------- 日付（すべて端末の日付で 'YYYY-MM-DD' 文字列として扱う） ----------
const pad = (n) => String(n).padStart(2, '0');
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseD = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const today = () => ymd(new Date());
const addDays = (s, n) => { const d = parseD(s); d.setDate(d.getDate() + n); return ymd(d); };
const addMonths = (s, n) => {
  const d = parseD(s); const day = d.getDate();
  d.setDate(1); d.setMonth(d.getMonth() + n);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, last)); return ymd(d);
};
const diffDays = (a, b) => Math.round((parseD(b) - parseD(a)) / 86400000); // b - a
const WD = ['日', '月', '火', '水', '木', '金', '土'];
const md = (s) => { if (!s) return ''; const d = parseD(s); return `${d.getMonth() + 1}/${d.getDate()}`; };
const mdw = (s) => { if (!s) return ''; const d = parseD(s); return `${d.getMonth() + 1}/${d.getDate()}(${WD[d.getDay()]})`; };
const fullD = (s) => { if (!s) return ''; const d = parseD(s); return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`; };
const spanText = (days) => {
  if (days == null) return '';
  if (days <= 0) return '当日';
  if (days < 30) return days + '日';
  if (days < 365) return Math.floor(days / 30) + 'ヶ月' + (days % 30 >= 15 ? '半' : '');
  const y = Math.floor(days / 365), m = Math.floor((days % 365) / 30);
  return y + '年' + (m ? m + 'ヶ月' : '');
};
const cpDue = (bought, cp) => (cp.days ? addDays(bought, cp.days) : addMonths(bought, cp.months));

// ---------- ネイティブとの橋渡し（ブラウザで開いたときは代わりの動き） ----------
const N = window.Native || null;
const callbacks = {}; let cbSeq = 1;
window.__cb = (id, res) => { const f = callbacks[id]; delete callbacks[id]; if (f) f(res); };
const native = {
  has: !!N,
  call(method, ...args) { return new Promise((res) => { const id = cbSeq++; callbacks[id] = res; N[method](id, ...args); }); },
  fetchMeta(url) { return N ? this.call('fetchMeta', url) : Promise.resolve({ ok: false, error: 'ブラウザ版では取得できません' }); },
  checkUpdate() { return N ? this.call('checkUpdate') : Promise.resolve({ ok: false, error: 'ブラウザ版' }); },
  open(url) { if (N) N.openUrl(url); else window.open(url, '_blank'); },
  version() { return N ? N.versionName() : 'web'; },
  versionCode() { return N ? N.versionCode() : 0; },
};

// ---------- データ ----------
let S = null; // アプリの全データ

function blankData() {
  return {
    v: SCHEMA,
    items: [],   // 欲しいもの・買ったもの
    people: [],  // プレゼントを渡す相手
    events: [],  // 誕生日以外の記念日など
    plans: {},   // 予定ごとのプレゼント案 { "イベントID@年": {...} }
    gifts: [],   // あげたプレゼントの記録
    ideas: [],   // プレゼント候補
    settings: { giftLeads: [14, 3], autoUpdate: true },
  };
}

/** 古い形式のデータを今の形にそろえる。項目を足すときはここに既定値を足すだけでOK */
function migrate(d) {
  const b = blankData();
  for (const k of Object.keys(b)) if (d[k] == null) d[k] = b[k];
  d.settings = Object.assign({}, b.settings, d.settings || {});
  for (const it of d.items) {
    it.ratings = it.ratings || {};
    it.desire = it.desire || 2;
    it.status = it.status || 'wish';
    if (it.kind === 'consumable') ensurePurchases(it);
  }
  // if (d.v < 2) { ...形式の変更... }
  d.v = SCHEMA;
  return d;
}

function loadData() {
  let raw = '';
  try { raw = N ? N.load() : localStorage.getItem('kaimono-data') || ''; } catch (e) { raw = ''; }
  try { S = raw ? migrate(JSON.parse(raw)) : blankData(); } catch (e) { S = blankData(); toast('データの読み込みに失敗しました。設定から復元できます'); }
}

function save() {
  S.savedAt = new Date().toISOString();
  const data = JSON.stringify(S);
  const sched = JSON.stringify(buildSchedule());
  try {
    if (N) { if (!N.save(data, sched)) toast('保存に失敗しました'); }
    else localStorage.setItem('kaimono-data', data);
  } catch (e) { toast('保存に失敗しました'); }
}

const itemById = (id) => S.items.find((x) => x.id === id);
const personById = (id) => S.people.find((x) => x.id === id);

// ---------- 満足度まわりの計算 ----------
/** 買ったものの各タイミングの状態 */
function cpStates(it, t = today()) {
  return CPS.map((cp) => {
    const due = cpDue(it.boughtAt, cp);
    const r = it.ratings[cp.k];
    let state = 'future';
    if (r && r.skip) state = 'skip';
    else if (r) state = 'done';
    else if (due <= t) state = 'due';
    return { cp, due, r, state };
  });
}
/** 今記録してほしいタイミング（日付が来ていて未記録のうち一番新しいもの） */
function pendingCp(it, t = today()) {
  if (it.status !== 'bought' || !it.boughtAt || isCons(it)) return null;
  const st = cpStates(it, t);
  let last = null;
  for (const s of st) if (s.due <= t) last = s;
  return last && last.state === 'due' ? last : null;
}
// ---------- 消耗品（購入のたびに1回だけ感想・リピートを積み重ねる） ----------
const isCons = (it) => it.kind === 'consumable';
/** 消耗品の購入履歴を用意する（最初の購入は boughtAt / paid から作る） */
function ensurePurchases(it) {
  if (!Array.isArray(it.purchases)) it.purchases = [];
  if (!it.purchases.length && it.boughtAt) it.purchases.push({ id: uid(), at: it.boughtAt, paid: it.paid == null ? null : it.paid });
  return it.purchases;
}
/** 購入履歴（古い順）。最初の購入日を boughtAt にそろえる */
function purchasesOf(it) {
  const ps = ensurePurchases(it).slice().sort((a, b) => a.at.localeCompare(b.at));
  if (ps.length) { it.boughtAt = ps[0].at; it.paid = ps[0].paid; }
  return ps;
}
const totalPaid = (it) => (isCons(it) ? purchasesOf(it).reduce((s, p) => s + (p.paid || 0), 0) : it.paid || 0);
/** 平均の購入間隔（日）。2回以上買っていれば */
function repeatInterval(it) {
  const ps = purchasesOf(it);
  if (ps.length < 2) return null;
  return Math.round(diffDays(ps[0].at, ps[ps.length - 1].at) / (ps.length - 1));
}

/** 今記録してほしいもの（記録待ちの一覧・通知から開くとき用） */
function pendingOf(it, t = today()) {
  if (it.status !== 'bought' || !it.boughtAt) return null;
  if (isCons(it)) {
    const ps = purchasesOf(it);
    const last = ps[ps.length - 1];
    if (last && !last.s && !last.skip && addDays(last.at, CONS_DAYS) <= t) {
      return { k: 'p:' + last.id, text: ps.length > 1 ? `${ps.length}回目の<b>使ってみた感想</b>` : '<b>使ってみた感想</b>' };
    }
    return null;
  }
  const p = pendingCp(it, t);
  return p ? { k: p.cp.k, text: `買ってから<b>${p.cp.label.replace('後', '')}</b>` } : null;
}

/** 最新の満足度 */
function latestRating(it) {
  if (isCons(it)) {
    const ps = purchasesOf(it);
    for (let i = ps.length - 1; i >= 0; i--) if (ps[i].s) return { cp: { k: 'p:' + ps[i].id, label: `${i + 1}回目` }, r: ps[i] };
    return null;
  }
  for (let i = CPS.length - 1; i >= 0; i--) { const r = it.ratings[CPS[i].k]; if (r && !r.skip && r.s) return { cp: CPS[i], r }; }
  return null;
}
const waitDays = (it) => (it.addedAt && it.boughtAt ? Math.max(0, diffDays(it.addedAt, it.boughtAt)) : null);

// ---------- プレゼント予定の計算 ----------
/** 期間内の予定（誕生日は人の登録から自動、ほかは events から） */
function occurrences(from, to) {
  const out = [];
  const y0 = parseD(from).getFullYear(), y1 = parseD(to).getFullYear();
  const push = (evId, personId, title, date, src) => {
    if (date >= from && date <= to) out.push({ key: `${evId}@${date.slice(0, 4)}`, evId, personId, title, date, src });
  };
  const yearly = (mmdd, y) => {
    let [m, d] = mmdd.split('-').map(Number);
    const last = new Date(y, m, 0).getDate();
    return `${y}-${pad(m)}-${pad(Math.min(d, last))}`;
  };
  for (const p of S.people) {
    if (!p.birthday) continue;
    for (let y = y0; y <= y1; y++) push('bd:' + p.id, p.id, '誕生日', yearly(p.birthday, y), p);
  }
  for (const e of S.events) {
    if (!e.date) continue;
    if (e.yearly) for (let y = y0; y <= y1; y++) push(e.id, e.personId, e.title, yearly(e.date.slice(5), y), e);
    else push(e.id, e.personId, e.title, e.date, e);
  }
  out.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  return out;
}
const giftForOcc = (key) => S.gifts.find((g) => g.occKey === key);
const bandOf = (k) => BANDS.find((b) => b.k === k);
const bandForPrice = (p) => (p == null ? null : BANDS.find((b) => p >= b.min && p <= b.max));
const priceLabel = (o) => (o.price ? yen(o.price) : o.band && bandOf(o.band) ? bandOf(o.band).label : '');

// ---------- 通知予定（ネイティブに渡す一覧） ----------
function buildSchedule() {
  const t = today();
  const from = addDays(t, -14), to = addDays(t, 400);
  const list = [];
  for (const it of S.items) {
    if (it.status !== 'bought' || !it.boughtAt) continue;
    if (isCons(it)) {
      const ps = purchasesOf(it);
      const last = ps[ps.length - 1];
      const due = last && addDays(last.at, CONS_DAYS);
      if (last && !last.s && !last.skip && due >= from && due <= to) {
        list.push({
          key: `r:${it.id}:p:${last.id}`, at: due, ch: 'rate',
          title: '感想を記録しよう',
          text: `「${it.name}」を使ってみてどうですか？`,
          route: `rate:${it.id}:p:${last.id}`,
        });
      }
      continue;
    }
    for (const s of cpStates(it, t)) {
      if (s.state === 'done' || s.state === 'skip') continue;
      if (s.due < from || s.due > to) continue;
      const span = s.cp.label.replace('後', '');
      list.push({
        key: `r:${it.id}:${s.cp.k}`, at: s.due, ch: 'rate',
        title: `満足度を記録しよう（${s.cp.label}）`,
        text: `「${it.name}」を買って${span}。満足度はどうですか？`,
        route: `rate:${it.id}:${s.cp.k}`,
      });
    }
  }
  const leads = (S.settings.giftLeads || []).slice().sort((a, b) => b - a);
  for (const o of occurrences(t, addDays(t, 400))) {
    if (giftForOcc(o.key)) continue;
    const p = personById(o.personId);
    const who = p ? p.name + 'さん' : '';
    const plan = S.plans[o.key];
    for (const lead of leads) {
      const at = addDays(o.date, -lead);
      if (at < from) continue;
      list.push({
        key: `g:${o.key}:${lead}`, at, until: o.date, ch: 'gift',
        title: lead === 0 ? `🎁 今日は${who}の${o.title}` : `🎁 ${who}の${o.title}まであと${lead}日`,
        text: plan && plan.text ? `プレゼント予定：${plan.text}` : 'プレゼントは決まりましたか？候補を見てみましょう。',
        route: `occ:${o.key}`,
      });
    }
  }
  return list;
}

// ---------- 画面の土台：トースト・シート・確認 ----------
function toast(msg) {
  const el = $('#toast'); el.textContent = msg; el.classList.add('show');
  clearTimeout(toast._t); toast._t = setTimeout(() => el.classList.remove('show'), 2400);
}

const sheets = []; // 開いているシート（重ねて開ける）
/** 下から出てくる画面を開く。render は中身のHTMLを返す関数 */
function openSheet(id, render, opts = {}) {
  const wrap = document.createElement('div');
  wrap.className = 'sheet-wrap';
  wrap.innerHTML = `<div class="sheet-bg" data-act="closeSheet"></div><div class="sheet ${opts.cls || ''}" role="dialog"><div class="grab"></div><div class="sheet-body"></div></div>`;
  document.body.appendChild(wrap);
  const s = { id, wrap, render, opts };
  sheets.push(s);
  refreshSheet(s);
  requestAnimationFrame(() => wrap.classList.add('open'));
  if (opts.focus) setTimeout(() => { const f = $(opts.focus, wrap); if (f) f.focus(); }, 280);
  return s;
}
function refreshSheet(s) { if (s) { const body = $('.sheet-body', s.wrap); body.innerHTML = s.render(); if (s.opts.after) s.opts.after(body); } }
function topSheet() { return sheets[sheets.length - 1]; }
function closeSheet() {
  const s = sheets.pop(); if (!s) return false;
  s.wrap.classList.remove('open');
  setTimeout(() => s.wrap.remove(), 260);
  if (s.opts.onClose) s.opts.onClose();
  return true;
}
function closeAllSheets() { while (sheets.length) closeSheet(); }
/** 保存などのあとで、開いている画面をすべて描き直す */
function rerender() { renderMain(); sheets.forEach(refreshSheet); }

function confirmBox(msg, okLabel = 'OK', danger = false) {
  return new Promise((resolve) => {
    let done = false;
    const finish = (v) => { if (done) return; done = true; resolve(v); };
    openSheet('confirm', () => `
      <p class="confirm-msg">${esc(msg)}</p>
      <div class="btn-row">
        <button class="btn ghost" data-act="confirmNo">やめる</button>
        <button class="btn ${danger ? 'danger' : 'primary'}" data-act="confirmYes">${esc(okLabel)}</button>
      </div>`, { cls: 'small', onClose: () => finish(false) });
    actions.confirmYes = () => { finish(true); closeSheet(); };
    actions.confirmNo = () => { finish(false); closeSheet(); };
  });
}

// ---------- 入力部品 ----------
/** 選択チップ（1つ選ぶ） */
function chips(name, options, value, cls = '') {
  return `<div class="chips ${cls}" data-chips="${name}">${options.map((o) =>
    `<button type="button" class="chip ${String(o.v) === String(value) ? 'on' : ''}" data-act="chip" data-v="${esc(o.v)}">${o.html || esc(o.label)}</button>`).join('')}</div>`;
}
const chipVal = (root, name) => { const c = $(`[data-chips="${name}"] .chip.on`, root); return c ? c.dataset.v : ''; };
const val = (root, sel) => { const el = $(sel, root); return el ? el.value.trim() : ''; };

const desireIcon = (d) => `<span class="desire d${d}" title="${esc((DESIRES.find((x) => x.v === d) || {}).label || '')}">${'<i></i>'.repeat(3)}</span>`;
const scoreFace = (s) => (SCORES.find((x) => x.v === s) || {}).face || '';

// アイコン（線画SVG）
const ICON = {
  wish: '<svg viewBox="0 0 24 24"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/></svg>',
  bag: '<svg viewBox="0 0 24 24"><path d="M5 8h14l-1 12H6z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/></svg>',
  chart: '<svg viewBox="0 0 24 24"><path d="M4 20h16"/><path d="M7 16v-5M12 16V7M17 16v-3"/></svg>',
  gift: '<svg viewBox="0 0 24 24"><rect x="4" y="9" width="16" height="11" rx="1.5"/><path d="M3 9h18M12 9v11"/><path d="M12 9c-2-4-6-4-6-1.5S10 9 12 9c2 0 6 1 6-1.5S14 5 12 9z"/></svg>',
  gear: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/></svg>',
  plus: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
  link: '<svg viewBox="0 0 24 24"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/></svg>',
  chev: '<svg viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg>',
  cal: '<svg viewBox="0 0 24 24"><rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/></svg>',
  user: '<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4.5-6 8-6s7 2 8 6"/></svg>',
  bulb: '<svg viewBox="0 0 24 24"><path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2V16h5v-.1c0-.8.4-1.5 1-2A6 6 0 0 0 12 3z"/></svg>',
  list: '<svg viewBox="0 0 24 24"><path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01"/></svg>',
};

// ---------- アクション（data-act で呼ばれる処理を各画面が登録する） ----------
const actions = {
  closeSheet: () => closeSheet(),
  chip: (el) => {
    const box = el.closest('[data-chips]');
    const multi = box.classList.contains('multi');
    if (multi) el.classList.toggle('on');
    else {
      const wasOn = el.classList.contains('on');
      $$('.chip', box).forEach((c) => c.classList.remove('on'));
      if (!(wasOn && box.classList.contains('toggle'))) el.classList.add('on');
    }
    box.dispatchEvent(new CustomEvent('chipchange', { bubbles: true }));
  },
  openUrl: (el) => native.open(el.dataset.url),
};
document.addEventListener('click', (ev) => {
  const el = ev.target.closest('[data-act]');
  if (!el) return;
  const f = actions[el.dataset.act];
  if (f) { ev.preventDefault(); f(el, ev); }
});
