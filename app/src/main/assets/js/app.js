/* =========================================================
   起動・タブ切り替え・通知からの移動
   ========================================================= */
'use strict';

const UI = { tab: 'wish', giftTab: 'plan', wishSort: 'new', update: null };
const TABS = [
  { v: 'wish', label: '欲しい', title: '欲しいもの', icon: 'wish', view: () => viewWish(), fab: 'addItem' },
  { v: 'bought', label: '買った', title: '買ったもの', icon: 'bag', view: () => viewBought(), fab: 'addBought' },
  { v: 'stats', label: '振り返り', title: '振り返り', icon: 'chart', view: () => viewStats(), fab: null },
  { v: 'gift', label: 'プレゼント', title: 'プレゼント', icon: 'gift', view: () => viewGift(), fab: () => ({ plan: 'addEvent', idea: 'addIdea', log: 'addGift', people: 'addPerson' }[UI.giftTab]) },
];

function renderMain() {
  const tab = TABS.find((t) => t.v === UI.tab) || TABS[0];
  $('#title').textContent = tab.title;
  $('#updateBanner').innerHTML = UI.update && UI.update.number > native.versionCode()
    ? `<button class="banner" data-act="openUpdate">新しいバージョン ${esc(UI.update.tag)} があります<b>更新する</b></button>` : '';
  $('#main').innerHTML = tab.view();
  const fab = typeof tab.fab === 'function' ? tab.fab() : tab.fab;
  const f = $('#fab');
  f.classList.toggle('hide', !fab);
  if (fab) f.dataset.act = fab;
  // 下のタブ
  const t = today();
  const pending = S.items.filter((x) => pendingCp(x, t)).length;
  const soon = occurrences(t, addDays(t, 14)).filter((o) => !giftForOcc(o.key) && !(S.plans[o.key] && S.plans[o.key].text)).length;
  const badges = { bought: pending, gift: soon };
  $('#nav').innerHTML = TABS.map((x) => `<button class="${x.v === UI.tab ? 'on' : ''}" data-act="tab" data-v="${x.v}">
      <span class="ni">${ICON[x.icon]}${badges[x.v] ? `<i class="nb">${badges[x.v]}</i>` : ''}</span><span>${x.label}</span></button>`).join('');
}

actions.tab = (el) => { if (UI.tab === el.dataset.v) { window.scrollTo({ top: 0, behavior: 'smooth' }); return; } UI.tab = el.dataset.v; renderMain(); window.scrollTo(0, 0); };
actions.addBought = () => openItemForm({ desire: 2, addedAt: today(), status: 'bought', boughtAt: today() }, 'new');

// 並び替えチップ
document.addEventListener('chipchange', (e) => {
  if (e.target.dataset.chips === 'wishSort') { UI.wishSort = chipVal(document, 'wishSort'); renderMain(); }
});

/** 通知・共有から開いたときの移動先 */
function route(r) {
  if (!r) return;
  if (r.startsWith('share:')) { addFromShare(r.slice(6)); return; }
  const [kind, a, b] = r.split(':');
  if (kind === 'rate') {
    closeAllSheets(); UI.tab = 'bought'; renderMain();
    const it = itemById(a);
    if (it && it.ratings[b] && !it.ratings[b].skip) openItem(a); else openRate(a, b);
  } else if (kind === 'occ') {
    closeAllSheets(); UI.tab = 'gift'; UI.giftTab = 'plan'; renderMain();
    openOcc(r.slice(4));
  }
}
window.__route = route;
/** 戻るボタン：開いている画面を閉じる → 最初のタブに戻る → アプリを閉じる */
window.__back = () => {
  if (closeSheet()) return true;
  if (UI.tab !== 'wish') { UI.tab = 'wish'; renderMain(); return true; }
  return false;
};

// ダークモード（端末の設定に合わせる）
function applyChrome() {
  const dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const bg = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim() || '#F7F3EE';
  if (N && N.setChrome) N.setChrome(dark, bg);
}

function init() {
  loadData();
  try { const u = JSON.parse(localStorage.getItem('pendingUpdate') || 'null'); if (u && u.number > native.versionCode()) UI.update = u; } catch (e) { /* なし */ }
  renderMain();
  applyChrome();
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyChrome);
  // 日付が変わったときのために、戻ってきたら描き直す
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { renderMain(); } });
  save(); // 通知予定を最新にしておく
  if (N) route(N.takeRoute());
  setTimeout(autoCheckUpdate, 1500);
}
document.addEventListener('DOMContentLoaded', init);
