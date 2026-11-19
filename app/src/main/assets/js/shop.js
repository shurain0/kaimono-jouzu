/* =========================================================
   欲しいもの・買ったもの・満足度
   ========================================================= */
'use strict';

const WISH_SORTS = [
  { v: 'new', label: '新しい' },
  { v: 'desire', label: '欲しい度' },
  { v: 'old', label: '寝かせ' },
];

// ---------- 欲しいものリスト ----------
function viewWish() {
  const t = today();
  let list = S.items.filter((x) => x.status === 'wish');
  const sort = UI.wishSort || 'new';
  if (sort === 'new') list.sort((a, b) => (b.addedAt || '').localeCompare(a.addedAt || '') || (b.createdAt || 0) - (a.createdAt || 0));
  if (sort === 'old') list.sort((a, b) => (a.addedAt || '').localeCompare(b.addedAt || ''));
  if (sort === 'desire') list.sort((a, b) => b.desire - a.desire || (a.addedAt || '').localeCompare(b.addedAt || ''));
  const total = list.reduce((s, x) => s + (x.price || 0), 0);

  if (!list.length) {
    return `<div class="empty">
      <div class="empty-icon">${ICON.wish}</div>
      <p class="empty-title">欲しいものを登録しよう</p>
      <p>右下の <b>＋</b> から追加できます。<br>Amazonアプリなどの「共有」→「買い物上手」からも追加できます。</p>
      <p class="muted">すぐ買わずにいったん寝かせて、それでも欲しいか確かめるのがコツです。</p>
    </div>`;
  }
  return `
    <div class="list-head">
      <div class="sum">${list.length}件${total ? `<span class="muted">・合計 ${yen(total)}</span>` : ''}</div>
      ${chips('wishSort', WISH_SORTS, sort, 'small')}
    </div>
    <div class="cards">${list.map((it) => wishCard(it, t)).join('')}</div>`;
}

function thumb(it) {
  return it.image
    ? `<div class="thumb"><img src="${esc(it.image)}" loading="lazy" referrerpolicy="no-referrer" onerror="this.parentNode.classList.add('noimg');this.remove()"></div>`
    : `<div class="thumb noimg"></div>`;
}

function wishCard(it, t) {
  const days = it.addedAt ? diffDays(it.addedAt, t) : null;
  return `<button class="card item" data-act="openItem" data-id="${it.id}">
    ${thumb(it)}
    <div class="card-main">
      <div class="name">${esc(it.name)}</div>
      <div class="meta">${desireIcon(it.desire)}<span>${days != null ? (days === 0 ? '今日登録' : `寝かせて${spanText(days)}`) : ''}</span>${it.price ? `<span class="price">${yen(it.price)}</span>` : ''}</div>
    </div>
  </button>`;
}

// ---------- 買ったもの ----------
function viewBought() {
  const t = today();
  const bought = S.items.filter((x) => x.status === 'bought').sort((a, b) => (b.boughtAt || '').localeCompare(a.boughtAt || ''));
  const pending = bought.filter((x) => pendingCp(x, t));
  const skipped = S.items.filter((x) => x.status === 'skipped');

  if (!bought.length) {
    return `<div class="empty">
      <div class="empty-icon">${ICON.bag}</div>
      <p class="empty-title">まだ買ったものはありません</p>
      <p>欲しいものリストで「買った！」を押すとここに移ります。<br>3日後・1週間後…1年後に満足度を通知でお聞きします。</p>
    </div>${skipped.length ? skippedLink(skipped) : ''}`;
  }
  let html = '';
  if (pending.length) {
    html += `<h3 class="sec">記録待ち <span class="badge">${pending.length}</span></h3><div class="cards">`;
    html += pending.map((it) => {
      const p = pendingCp(it, t);
      return `<div class="card pending">
        <button class="pending-main" data-act="openItem" data-id="${it.id}">
          <div class="name">${esc(it.name)}</div>
          <div class="meta"><span>買ってから<b>${p.cp.label.replace('後', '')}</b></span></div>
        </button>
        <button class="btn primary sm" data-act="rate" data-id="${it.id}" data-k="${p.cp.k}">記録する</button>
      </div>`;
    }).join('');
    html += `</div>`;
  }
  html += `<h3 class="sec">買ったもの <span class="muted">${bought.length}件</span></h3><div class="cards">`;
  html += bought.map((it) => boughtCard(it, t)).join('');
  html += `</div>`;
  if (skipped.length) html += skippedLink(skipped);
  return html;
}

function skippedLink(skipped) {
  return `<button class="link-row" data-act="openSkipped">${ICON.list}<span>見送ったもの（${skipped.length}件）</span>${ICON.chev}</button>`;
}

function dots(it, t) {
  return `<div class="dots">${cpStates(it, t).map((s) => {
    const cls = s.state === 'done' ? `s${s.r.s}` : s.state;
    return `<span class="dot ${cls}" title="${s.cp.label}"></span>`;
  }).join('')}</div>`;
}

function boughtCard(it, t) {
  const lr = latestRating(it);
  return `<button class="card item" data-act="openItem" data-id="${it.id}">
    ${thumb(it)}
    <div class="card-main">
      <div class="name">${esc(it.name)}</div>
      <div class="meta"><span>${fullD(it.boughtAt)}</span>${it.paid ? `<span class="price">${yen(it.paid)}</span>` : ''}</div>
      ${dots(it, t)}
    </div>
    <div class="face-lg">${lr ? scoreFace(lr.r.s) : ''}</div>
  </button>`;
}

// ---------- 追加・編集 ----------
function itemForm(it, mode) {
  const isNew = mode === 'new';
  const st = it.status;
  return `
    <h2 class="sheet-title">${isNew ? '欲しいものを追加' : '編集'}</h2>
    <form class="form" id="itemForm" onsubmit="return false">
      <label class="field"><span>商品ページのURL（任意）</span>
        <div class="url-row">
          <input id="f-url" type="url" inputmode="url" placeholder="https://…" value="${esc(it.url || '')}">
          <button type="button" class="btn ghost sm" data-act="fetchMeta">取得</button>
        </div>
        <small class="hint" id="fetchHint">URLを貼ると商品名・値段・画像を自動で取ってきます</small>
      </label>
      <div id="f-imgbox">${it.image ? `<img class="preview" src="${esc(it.image)}">` : ''}</div>
      <input type="hidden" id="f-image" value="${esc(it.image || '')}">
      <label class="field"><span>商品名</span><textarea id="f-name" rows="2" placeholder="例）ワイヤレスイヤホン">${esc(it.name || '')}</textarea></label>
      <label class="field"><span>値段</span><input id="f-price" inputmode="numeric" placeholder="円" value="${it.price || ''}"></label>
      <div class="field"><span>どのくらい欲しい？</span>${chips('desire', DESIRES, it.desire || 2, 'desire-chips')}</div>
      <label class="field"><span>欲しい理由・使う場面（任意）</span><textarea id="f-note" rows="2" placeholder="あとで振り返るときのヒントになります">${esc(it.note || '')}</textarea></label>
      <label class="field"><span>欲しいと思った日</span><input id="f-added" type="date" value="${esc(it.addedAt || today())}"></label>
      ${isNew ? `<div class="field"><span>状態</span>${chips('status', [{ v: 'wish', label: 'まだ買ってない' }, { v: 'bought', label: 'もう買った' }], st || 'wish')}</div>` : ''}
      <div id="boughtFields" class="${(st === 'bought') ? '' : 'hide'}">
        <label class="field"><span>買った日</span><input id="f-bought" type="date" value="${esc(it.boughtAt || today())}"></label>
        <label class="field"><span>実際に払った金額</span><input id="f-paid" inputmode="numeric" placeholder="円" value="${it.paid || ''}"></label>
      </div>
      <button class="btn primary block" data-act="saveItem" data-id="${it.id || ''}">${isNew ? '追加する' : '保存する'}</button>
    </form>`;
}

function openItemForm(it, mode) {
  const draft = Object.assign({}, it);
  openSheet('itemForm', () => itemForm(draft, mode), {
    after: (body) => {
      const url = $('#f-url', body);
      url.addEventListener('paste', () => setTimeout(() => autoFetch(body), 50));
      url.addEventListener('change', () => autoFetch(body));
      body.addEventListener('chipchange', (e) => {
        if (e.target.dataset.chips === 'status') $('#boughtFields', body).classList.toggle('hide', chipVal(body, 'status') !== 'bought');
      });
      if (draft._autofetch) { delete draft._autofetch; autoFetch(body, true); }
    },
  });
}

function autoFetch(body, force) {
  const url = val(body, '#f-url');
  if (!/^https?:\/\//.test(url)) return;
  if (body._lastFetched === url && !force) return;
  body._lastFetched = url;
  doFetch(body, url);
}

async function doFetch(body, url) {
  const hint = $('#fetchHint', body);
  hint.textContent = '取得中…'; hint.className = 'hint loading';
  const r = await native.fetchMeta(url);
  if (!document.body.contains(body)) return;
  if (r && r.ok) {
    const name = $('#f-name', body);
    if (!name.value.trim() || body._nameFromFetch) { name.value = r.title || ''; body._nameFromFetch = true; }
    if (r.price && !val(body, '#f-price')) $('#f-price', body).value = r.price;
    if (r.image) { $('#f-image', body).value = r.image; $('#f-imgbox', body).innerHTML = `<img class="preview" src="${esc(r.image)}">`; }
    hint.textContent = '取得しました（違っていたら直してください）'; hint.className = 'hint ok';
  } else {
    hint.textContent = '自動では取れませんでした。商品名を手で入れてください'; hint.className = 'hint warn';
  }
}
actions.fetchMeta = (el) => { const body = el.closest('.sheet-body'); const u = val(body, '#f-url'); if (u) { body._lastFetched = u; doFetch(body, u); } else toast('URLを入れてください'); };

actions.saveItem = (el) => {
  const body = el.closest('.sheet-body');
  const name = val(body, '#f-name').replace(/\s+/g, ' ');
  if (!name) { toast('商品名を入れてください'); $('#f-name', body).focus(); return; }
  const id = el.dataset.id;
  let it = id ? itemById(id) : null;
  const isNew = !it;
  if (isNew) it = { id: uid(), createdAt: Date.now(), ratings: {}, status: 'wish' };
  const desire = Number(chipVal(body, 'desire')) || 2;
  if (!isNew && it.desire !== desire && it.status === 'wish') {
    (it.desireLog = it.desireLog || []).push({ at: today(), from: it.desire, to: desire });
  }
  Object.assign(it, {
    url: val(body, '#f-url'), name, price: num(val(body, '#f-price')), desire,
    note: val(body, '#f-note'), addedAt: val(body, '#f-added') || today(), image: val(body, '#f-image'),
  });
  const status = isNew ? chipVal(body, 'status') || 'wish' : it.status;
  if (status === 'bought') {
    it.status = 'bought';
    it.boughtAt = val(body, '#f-bought') || today();
    it.paid = num(val(body, '#f-paid'));
    if (it.boughtAt < it.addedAt) it.addedAt = it.boughtAt;
  }
  if (isNew) S.items.push(it);
  save(); closeSheet();
  if (isNew) { UI.tab = status === 'bought' ? 'bought' : 'wish'; toast(status === 'bought' ? '買ったものに登録しました' : '欲しいものに追加しました'); }
  rerender();
};

actions.addItem = () => openItemForm({ desire: 2, addedAt: today(), status: 'wish' }, 'new');

/** 共有されたテキストから追加画面を開く */
function addFromShare(text) {
  const m = text.match(/https?:\/\/[^\s　）)」]+/);
  const url = m ? m[0] : '';
  let name = text.replace(url, ' ')
    .replace(/Amazon\.co\.jp\s*[:：]?\s*/g, '').replace(/をAmazonでチェック[!！]?/g, '')
    .replace(/Amazonで(見る|チェック)/g, '').replace(/【楽天市場】/g, '').replace(/\s*-\s*楽天市場\s*$/g, '')
    .replace(/^[「『]|[」』]$/g, '').replace(/\s+/g, ' ').trim();
  if (name.length > 120) name = name.slice(0, 120);
  UI.tab = 'wish'; renderMain(); closeAllSheets();
  openItemForm({ desire: 2, addedAt: today(), status: 'wish', url, name, _autofetch: !!url }, 'new');
}

// ---------- 詳細 ----------
actions.openItem = (el) => openItem(el.dataset.id);
function openItem(id) {
  openSheet('item:' + id, () => {
    const it = itemById(id);
    if (!it) return '<p class="muted">削除されました</p>';
    return it.status === 'bought' ? boughtDetail(it) : wishDetail(it);
  });
}

function detailHead(it) {
  return `<div class="detail-head">
    ${it.image ? `<img class="detail-img" src="${esc(it.image)}" referrerpolicy="no-referrer" onerror="this.remove()">` : ''}
    <h2 class="detail-name">${esc(it.name)}</h2>
    ${it.url ? `<button class="link" data-act="openUrl" data-url="${esc(it.url)}">${ICON.link}商品ページを開く</button>` : ''}
  </div>`;
}

function wishDetail(it) {
  const t = today();
  const days = it.addedAt ? diffDays(it.addedAt, t) : 0;
  const log = (it.desireLog || []).map((l) => `<li>${fullD(l.at)}　${DESIRES.find((d) => d.v === l.from).label} → <b>${DESIRES.find((d) => d.v === l.to).label}</b></li>`).join('');
  return `${detailHead(it)}
    <div class="facts">
      <div><span>欲しい度</span><b>${desireIcon(it.desire)} ${esc(DESIRES.find((d) => d.v === it.desire).label)}</b></div>
      <div><span>値段</span><b>${it.price ? yen(it.price) : '—'}</b></div>
      <div><span>登録日</span><b>${fullD(it.addedAt)}</b></div>
      <div><span>寝かせ期間</span><b>${days ? spanText(days) : '今日から'}</b></div>
    </div>
    ${it.note ? `<div class="note-box">${esc(it.note)}</div>` : ''}
    ${log ? `<div class="sub-sec"><h4>欲しい度の変化</h4><ul class="log">${log}</ul></div>` : ''}
    <button class="btn primary block lg" data-act="buy" data-id="${it.id}">${ICON.bag}買った！</button>
    <div class="btn-row">
      <button class="btn ghost" data-act="editItem" data-id="${it.id}">編集</button>
      ${it.status === 'wish' ? `<button class="btn ghost" data-act="skipItem" data-id="${it.id}">買わないことにした</button>` : ''}
    </div>
    ${it.status === 'skipped' ? `<p class="muted center">${fullD(it.skippedAt)} に見送り${it.skipNote ? `：${esc(it.skipNote)}` : ''}</p><button class="btn ghost block" data-act="unskip" data-id="${it.id}">欲しいものに戻す</button>` : ''}
    <button class="btn text danger block" data-act="deleteItem" data-id="${it.id}">削除</button>`;
}

function boughtDetail(it) {
  const t = today();
  const w = waitDays(it);
  const rows = cpStates(it, t).map((s) => {
    let right = '';
    if (s.state === 'done') {
      const sc = SCORES.find((x) => x.v === s.r.s);
      const use = USES.find((u) => u.v === s.r.use);
      right = `<button class="tl-rate done" data-act="rate" data-id="${it.id}" data-k="${s.cp.k}">
        <span class="face">${sc.face}</span><span><b>${sc.label}</b>${use ? `<em>${use.label}</em>` : ''}${s.r.note ? `<small>${esc(s.r.note)}</small>` : ''}</span></button>`;
    } else if (s.state === 'due') {
      right = `<button class="btn primary sm" data-act="rate" data-id="${it.id}" data-k="${s.cp.k}">記録する</button>`;
    } else if (s.state === 'skip') {
      right = `<button class="tl-rate skip" data-act="rate" data-id="${it.id}" data-k="${s.cp.k}">記録なし</button>`;
    } else {
      right = `<span class="muted">${mdw(s.due)}〜</span>`;
    }
    return `<li class="tl ${s.state}"><div class="tl-label"><b>${s.cp.label}</b><small>${md(s.due)}</small></div><div class="tl-body">${right}</div></li>`;
  }).join('');
  return `${detailHead(it)}
    <div class="facts">
      <div><span>買った日</span><b>${fullD(it.boughtAt)}</b></div>
      <div><span>払った金額</span><b>${it.paid ? yen(it.paid) : '—'}</b></div>
      <div><span>欲しいと思った日</span><b>${fullD(it.addedAt)}</b></div>
      <div><span>買うまで</span><b>${w == null ? '—' : w === 0 ? '即決' : spanText(w)}</b></div>
    </div>
    ${it.note ? `<div class="note-box"><small>欲しかった理由</small>${esc(it.note)}</div>` : ''}
    <div class="sub-sec"><h4>満足度の経過</h4>${trendSvg(it)}<ul class="timeline">${rows}</ul></div>
    <div class="btn-row">
      <button class="btn ghost" data-act="editItem" data-id="${it.id}">編集</button>
      <button class="btn ghost" data-act="unbuy" data-id="${it.id}">欲しいものに戻す</button>
    </div>
    <button class="btn text danger block" data-act="deleteItem" data-id="${it.id}">削除</button>`;
}

/** 1つの商品の満足度の推移（小さな折れ線） */
function trendSvg(it) {
  const pts = CPS.map((cp, i) => ({ i, r: it.ratings[cp.k] })).filter((p) => p.r && p.r.s);
  if (pts.length < 2) return '';
  const W = 300, H = 70, px = (i) => 12 + (i * (W - 24)) / (CPS.length - 1), py = (s) => H - 10 - ((s - 1) * (H - 20)) / 4;
  const d = pts.map((p, j) => `${j ? 'L' : 'M'}${px(p.i).toFixed(1)},${py(p.r.s).toFixed(1)}`).join('');
  return `<svg class="trend" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
    ${[1, 3, 5].map((s) => `<line x1="0" x2="${W}" y1="${py(s)}" y2="${py(s)}" class="grid"/>`).join('')}
    <path d="${d}" class="line"/>
    ${pts.map((p) => `<circle cx="${px(p.i)}" cy="${py(p.r.s)}" r="4" class="pt"/>`).join('')}
  </svg>`;
}

actions.editItem = (el) => { const it = itemById(el.dataset.id); if (it) openItemForm(it, 'edit'); };

actions.deleteItem = async (el) => {
  const it = itemById(el.dataset.id); if (!it) return;
  if (!(await confirmBox(`「${it.name}」を削除しますか？満足度の記録も消えます。`, '削除する', true))) return;
  S.items = S.items.filter((x) => x !== it); save(); closeSheet(); rerender(); toast('削除しました');
};

// ---------- 買った・見送った ----------
actions.buy = (el) => {
  const it = itemById(el.dataset.id);
  openSheet('buy', () => `
    <h2 class="sheet-title">買った！</h2>
    <p class="muted">${esc(it.name)}</p>
    <div class="form">
      <label class="field"><span>買った日</span><input id="b-date" type="date" value="${today()}"></label>
      <label class="field"><span>実際に払った金額</span><input id="b-paid" inputmode="numeric" placeholder="円" value="${it.price || ''}"></label>
      <button class="btn primary block" data-act="confirmBuy" data-id="${it.id}">記録する</button>
    </div>`, { cls: 'small' });
};
actions.confirmBuy = (el) => {
  const body = el.closest('.sheet-body');
  const it = itemById(el.dataset.id);
  it.status = 'bought';
  it.boughtAt = val(body, '#b-date') || today();
  it.paid = num(val(body, '#b-paid'));
  if (it.addedAt && it.boughtAt < it.addedAt) it.addedAt = it.boughtAt;
  save(); closeSheet(); rerender();
  const p = pendingCp(it);
  toast(p ? '記録しました。満足度も記録してみましょう' : '記録しました。3日後に満足度をお聞きします');
};
actions.unbuy = async (el) => {
  const it = itemById(el.dataset.id);
  if (!(await confirmBox('欲しいものリストに戻しますか？（満足度の記録は残ります）', '戻す'))) return;
  it.status = 'wish'; delete it.boughtAt; save(); closeSheet(); rerender();
};
actions.skipItem = (el) => {
  const it = itemById(el.dataset.id);
  openSheet('skip', () => `
    <h2 class="sheet-title">買わないことにした</h2>
    <p class="muted">見送ったものも記録しておくと、「買わなくてよかったもの」が振り返れます。</p>
    <div class="form">
      <label class="field"><span>理由（任意）</span><input id="s-note" placeholder="例）もう要らなくなった・代わりがあった"></label>
      <button class="btn primary block" data-act="confirmSkip" data-id="${it.id}">見送りにする</button>
    </div>`, { cls: 'small' });
};
actions.confirmSkip = (el) => {
  const body = el.closest('.sheet-body');
  const it = itemById(el.dataset.id);
  it.status = 'skipped'; it.skippedAt = today(); it.skipNote = val(body, '#s-note');
  save(); closeSheet(); closeSheet(); rerender(); toast('見送りにしました');
};
actions.unskip = (el) => {
  const it = itemById(el.dataset.id);
  it.status = 'wish'; delete it.skippedAt; delete it.skipNote; save(); closeSheet(); rerender();
};
actions.openSkipped = () => {
  openSheet('skipped', () => {
    const list = S.items.filter((x) => x.status === 'skipped').sort((a, b) => (b.skippedAt || '').localeCompare(a.skippedAt || ''));
    if (!list.length) return '<h2 class="sheet-title">見送ったもの</h2><p class="muted">ありません</p>';
    const total = list.reduce((s, x) => s + (x.price || 0), 0);
    return `<h2 class="sheet-title">見送ったもの</h2>
      ${total ? `<p class="muted">買わずに済んだ金額 <b class="accent">${yen(total)}</b></p>` : ''}
      <div class="cards">${list.map((it) => `<button class="card item" data-act="openItem" data-id="${it.id}">
        ${thumb(it)}<div class="card-main"><div class="name">${esc(it.name)}</div>
        <div class="meta"><span>寝かせて${spanText(diffDays(it.addedAt, it.skippedAt))}で見送り</span>${it.price ? `<span class="price">${yen(it.price)}</span>` : ''}</div>
        ${it.skipNote ? `<div class="meta"><span>${esc(it.skipNote)}</span></div>` : ''}</div></button>`).join('')}</div>`;
  });
};

// ---------- 満足度の記録 ----------
actions.rate = (el) => openRate(el.dataset.id, el.dataset.k);
function openRate(id, k) {
  const it = itemById(id); const cp = CPS.find((c) => c.k === k);
  if (!it || !cp || it.status !== 'bought') { toast('見つかりませんでした'); return; }
  const r = it.ratings[k] && !it.ratings[k].skip ? it.ratings[k] : {};
  const prev = latestRating(it);
  openSheet('rate', () => `
    <p class="eyebrow">${cp.label}の満足度</p>
    <h2 class="sheet-title">${esc(it.name)}</h2>
    ${prev && prev.cp.k !== k ? `<p class="muted">前回（${prev.cp.label}）は ${scoreFace(prev.r.s)} ${SCORES.find((x) => x.v === prev.r.s).label}</p>` : ''}
    <div class="form">
      <div class="field"><span>買ってよかった？</span>
        ${chips('score', SCORES.map((s) => ({ v: s.v, html: `<span class="f">${s.face}</span><span class="l">${s.label}</span>` })), r.s || '', 'faces')}</div>
      <div class="field"><span>使ってる？</span>${chips('use', USES, r.use || '', 'toggle')}</div>
      <label class="field"><span>ひとこと（任意）</span><textarea id="r-note" rows="2" placeholder="良かったところ・気になるところ">${esc(r.note || '')}</textarea></label>
      <button class="btn primary block" data-act="saveRate" data-id="${id}" data-k="${k}">記録する</button>
      <button class="btn text block" data-act="skipRate" data-id="${id}" data-k="${k}">今回は記録しない</button>
    </div>`);
}
actions.saveRate = (el) => {
  const body = el.closest('.sheet-body');
  const s = Number(chipVal(body, 'score'));
  if (!s) { toast('満足度を選んでください'); return; }
  const it = itemById(el.dataset.id);
  it.ratings[el.dataset.k] = { s, use: Number(chipVal(body, 'use')) || null, note: val(body, '#r-note'), at: today() };
  save(); closeSheet(); rerender(); toast('記録しました');
};
actions.skipRate = (el) => {
  const it = itemById(el.dataset.id);
  it.ratings[el.dataset.k] = { skip: true, at: today() };
  save(); closeSheet(); rerender();
};
