/* =========================================================
   プレゼント（予定・候補・記録・人）
   ========================================================= */
'use strict';

const GIFT_TABS = [
  { v: 'plan', label: '予定' },
  { v: 'idea', label: '候補' },
  { v: 'log', label: 'あげたもの' },
  { v: 'people', label: '人' },
];
const RELATIONS = ['家族', '友達', 'パートナー', '職場', '親戚'];

const pname = (id) => { const p = personById(id); return p ? p.name : '（未設定）'; };
const bandChips = (o) => chips('band', BANDS.map((b) => ({ v: b.k, label: b.label })), o.band || '', 'toggle small');

function viewGift() {
  const tab = UI.giftTab || 'plan';
  const body = tab === 'plan' ? giftPlanView() : tab === 'idea' ? giftIdeaView() : tab === 'log' ? giftLogView() : giftPeopleView();
  return `<div class="seg">${GIFT_TABS.map((t) => `<button class="${t.v === tab ? 'on' : ''}" data-act="giftTab" data-v="${t.v}">${t.label}</button>`).join('')}</div>${body}`;
}
actions.giftTab = (el) => { UI.giftTab = el.dataset.v; renderMain(); window.scrollTo(0, 0); };

// ---------- 予定 ----------
function giftPlanView() {
  const t = today();
  const list = occurrences(addDays(t, -14), addDays(t, 365))
    .filter((o) => o.date >= t || !giftForOcc(o.key)); // 過ぎた予定は「まだ渡してない」ものだけ出す
  if (!list.length) {
    return `<div class="empty"><div class="empty-icon">${ICON.cal}</div>
      <p class="empty-title">プレゼントの予定はまだありません</p>
      <p>「人」に誕生日を登録すると、毎年自動でここに並びます。<br>クリスマスや記念日は右下の＋から追加できます。</p>
      <button class="btn primary" data-act="addPerson">人を登録する</button></div>`;
  }
  let html = '', month = '';
  for (const o of list) {
    const m = o.date.slice(0, 7);
    if (m !== month) { month = m; html += `<h3 class="sec month">${Number(m.slice(0, 4))}年${Number(m.slice(5))}月</h3>`; }
    html += occRow(o, t);
  }
  return `<div class="occ-list">${html}</div>`;
}

function occRow(o, t) {
  const d = parseD(o.date);
  const left = diffDays(t, o.date);
  const plan = S.plans[o.key];
  const given = giftForOcc(o.key);
  let badge;
  if (given) badge = `<span class="pill done">あげた</span>`;
  else if (left < 0) badge = `<span class="pill warn">${-left}日前</span>`;
  else if (left === 0) badge = `<span class="pill hot">今日</span>`;
  else badge = `<span class="pill ${left <= 14 ? 'hot' : ''}">あと${left}日</span>`;
  const planText = given ? `🎁 ${esc(given.item)}` : plan && plan.text ? `🎁 ${esc(plan.text)}${priceLabel(plan) ? `<span class="muted">・${esc(priceLabel(plan))}</span>` : ''}` : `<span class="muted">プレゼント未定</span>`;
  return `<button class="occ ${left < 0 && !given ? 'past' : ''}" data-act="openOcc" data-key="${esc(o.key)}">
    <div class="occ-date"><b>${d.getDate()}</b><small>${WD[d.getDay()]}</small></div>
    <div class="occ-main">
      <div class="occ-title">${esc(pname(o.personId))}<span class="tag">${esc(o.title)}</span></div>
      <div class="occ-plan">${planText}</div>
    </div>
    ${badge}
  </button>`;
}

function findOcc(key) {
  const y = key.split('@')[1];
  if (!y) return null;
  return occurrences(`${y}-01-01`, `${y}-12-31`).find((o) => o.key === key) || null;
}

actions.openOcc = (el) => openOcc(el.dataset.key);
function openOcc(key) {
  openSheet('occ:' + key, () => {
    const o = findOcc(key);
    if (!o) return `<p class="muted">この予定は見つかりませんでした（削除された可能性があります）</p>`;
    const p = personById(o.personId);
    const plan = S.plans[key] || {};
    const given = giftForOcc(key);
    const left = diffDays(today(), o.date);
    const past = S.gifts.filter((g) => g.personId === o.personId).sort((a, b) => b.date.localeCompare(a.date));
    const ideas = S.ideas.filter((i) => !i.done && (i.personId === o.personId || !i.personId));
    const head = `<p class="eyebrow">${fullD(o.date)}（${WD[parseD(o.date).getDay()]}）・${left > 0 ? `あと${left}日` : left === 0 ? '今日' : `${-left}日前`}</p>
      <h2 class="sheet-title">${esc(p ? p.name : '')}さんの${esc(o.title)}</h2>
      ${p && p.memo ? `<div class="note-box"><small>メモ</small>${esc(p.memo)}</div>` : ''}`;
    const history = past.length ? `<div class="sub-sec"><h4>${esc(p ? p.name : '')}さんにあげたもの</h4>${giftRows(past.slice(0, 8))}</div>` : '';
    if (given) {
      return `${head}<div class="given-box"><span>🎁 あげたもの</span><b>${esc(given.item)}</b><small>${priceLabel(given)} ${given.reaction ? (REACTIONS.find((r) => r.v === given.reaction) || {}).face : ''}</small>
        <button class="btn ghost sm" data-act="editGift" data-id="${given.id}">記録を見る</button></div>${history}`;
    }
    return `${head}
      <div class="form">
        <label class="field"><span>何をあげる？</span><input id="o-text" placeholder="例）ハンドクリームのセット" value="${esc(plan.text || '')}"></label>
        ${ideas.length ? `<div class="field"><span>候補から選ぶ</span><div class="chips idea-chips">${ideas.map((i) =>
          `<button type="button" class="chip" data-act="pickIdea" data-id="${i.id}">${esc(i.item)}${priceLabel(i) ? `<small>${esc(priceLabel(i))}</small>` : ''}</button>`).join('')}</div></div>` : ''}
        <div class="field"><span>予算</span>${bandChips(plan)}</div>
        <label class="field"><span>金額（決まっていれば）</span><input id="o-price" inputmode="numeric" placeholder="円" value="${plan.price || ''}"></label>
        <label class="field"><span>メモ</span><input id="o-memo" placeholder="買う場所・渡し方など" value="${esc(plan.memo || '')}"></label>
        <input type="hidden" id="o-idea" value="${esc(plan.ideaId || '')}">
        <div class="btn-row">
          <button class="btn ghost" data-act="savePlan" data-key="${esc(key)}">予定を保存</button>
          <button class="btn primary" data-act="givePlan" data-key="${esc(key)}">🎁 あげた！</button>
        </div>
      </div>
      ${history}
      <div class="btn-row">
        ${p ? `<button class="btn text" data-act="openPerson" data-id="${p.id}">${ICON.user}${esc(p.name)}さんのページ</button>` : ''}
        ${o.src && !o.evId.startsWith('bd:') ? `<button class="btn text" data-act="editEvent" data-id="${o.evId}">予定を編集</button>` : ''}
      </div>`;
  });
}

actions.pickIdea = (el) => {
  const body = el.closest('.sheet-body');
  const i = S.ideas.find((x) => x.id === el.dataset.id); if (!i) return;
  $('#o-text', body).value = i.item;
  $('#o-price', body).value = i.price || '';
  $('#o-idea', body).value = i.id;
  $$('[data-chips="band"] .chip', body).forEach((c) => c.classList.toggle('on', c.dataset.v === i.band));
  $$('.idea-chips .chip', body).forEach((c) => c.classList.toggle('on', c === el));
};

function readPlan(body) {
  const price = num(val(body, '#o-price'));
  return { text: val(body, '#o-text'), band: chipVal(body, 'band') || (bandForPrice(price) || {}).k || '', price, memo: val(body, '#o-memo'), ideaId: val(body, '#o-idea') };
}
actions.savePlan = (el) => {
  const body = el.closest('.sheet-body');
  const p = readPlan(body);
  if (!p.text && !p.band && !p.price && !p.memo) delete S.plans[el.dataset.key]; else S.plans[el.dataset.key] = p;
  save(); closeSheet(); rerender(); toast('予定を保存しました');
};
actions.givePlan = (el) => {
  const body = el.closest('.sheet-body');
  const key = el.dataset.key;
  const p = readPlan(body);
  S.plans[key] = p; save();
  const o = findOcc(key);
  openGiftForm({ personId: o.personId, item: p.text, date: o.date > today() ? today() : o.date, occasion: o.title, band: p.band, price: p.price, memo: p.memo, occKey: key, ideaId: p.ideaId });
};

// ---------- あげたものの記録 ----------
function giftRows(list) {
  return `<div class="gift-rows">${list.map((g) => `
    <button class="gift-row" data-act="editGift" data-id="${g.id}">
      <span class="gr-date">${fullD(g.date)}</span>
      <span class="gr-main"><b>${esc(g.item)}</b><small>${esc(g.occasion || '')}${priceLabel(g) ? '・' + esc(priceLabel(g)) : ''}</small></span>
      <span class="face">${g.reaction ? (REACTIONS.find((r) => r.v === g.reaction) || {}).face : ''}</span>
    </button>`).join('')}</div>`;
}

function giftLogView() {
  const list = S.gifts.slice().sort((a, b) => b.date.localeCompare(a.date));
  if (!list.length) {
    return `<div class="empty"><div class="empty-icon">${ICON.gift}</div>
      <p class="empty-title">あげたプレゼントを記録しよう</p>
      <p>誰に・何を・いつ・何のためにあげたかを残しておくと、<br>次のプレゼント選びで「かぶり」を防げます。</p></div>`;
  }
  let html = '', year = '';
  for (const g of list) {
    const y = g.date.slice(0, 4);
    if (y !== year) {
      year = y;
      const ys = list.filter((x) => x.date.startsWith(y));
      const total = ys.reduce((s, x) => s + (x.price || 0), 0);
      html += `<h3 class="sec">${y}年 <span class="muted">${ys.length}件${total ? `・${yen(total)}` : ''}</span></h3>`;
    }
    html += `<button class="card gift" data-act="editGift" data-id="${g.id}">
      <div class="card-main">
        <div class="meta"><span>${md(g.date)}</span><span class="tag">${esc(g.occasion || 'プレゼント')}</span></div>
        <div class="name">${esc(g.item)}</div>
        <div class="meta"><span>${ICON.user}${esc(pname(g.personId))}</span>${priceLabel(g) ? `<span class="price">${esc(priceLabel(g))}</span>` : ''}</div>
      </div>
      <div class="face-lg">${g.reaction ? (REACTIONS.find((r) => r.v === g.reaction) || {}).face : ''}</div>
    </button>`;
  }
  return `<div class="cards">${html}</div>`;
}

function personPicker(selected) {
  return `<div class="field"><span>だれに？</span>
    <select id="p-sel">
      ${S.people.length ? '' : '<option value="">（選んでください）</option>'}
      ${S.people.map((p) => `<option value="${p.id}" ${p.id === selected ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}
      <option value="__new" ${!S.people.length ? 'selected' : ''}>＋ 新しい人を追加</option>
    </select>
    <input id="p-new" class="${S.people.length ? 'hide' : ''}" placeholder="名前">
  </div>`;
}
document.addEventListener('change', (e) => {
  if (e.target.id === 'p-sel') { const n = $('#p-new', e.target.parentNode); n.classList.toggle('hide', e.target.value !== '__new'); if (e.target.value === '__new') n.focus(); }
});
/** 人の選択を読み取る（新しい人ならその場で作る） */
function resolvePerson(body, allowEmpty) {
  const sel = val(body, '#p-sel');
  if (sel && sel !== '__new') return sel;
  const name = val(body, '#p-new');
  if (!name) { if (!allowEmpty) toast('相手の名前を入れてください'); return allowEmpty ? '' : null; }
  const p = { id: uid(), name, memo: '' };
  S.people.push(p);
  return p.id;
}

function openGiftForm(g) {
  const isNew = !g.id;
  const occOpts = OCCASIONS.map((o) => ({ v: o, label: o }));
  openSheet('giftForm', () => `
    <h2 class="sheet-title">${isNew ? 'あげたものを記録' : 'プレゼントの記録'}</h2>
    <div class="form">
      ${personPicker(g.personId)}
      <label class="field"><span>何をあげた？</span><input id="g-item" placeholder="例）名入れのボールペン" value="${esc(g.item || '')}"></label>
      <label class="field"><span>あげた日</span><input id="g-date" type="date" value="${esc(g.date || today())}"></label>
      <div class="field"><span>なんで？</span>${chips('occ', occOpts, OCCASIONS.includes(g.occasion) ? g.occasion : '', 'toggle small')}
        <input id="g-occ" placeholder="その他（自由入力）" value="${esc(OCCASIONS.includes(g.occasion) ? '' : g.occasion || '')}"></div>
      <div class="field"><span>値段</span>${bandChips(g)}<input id="g-price" inputmode="numeric" placeholder="金額（細かく分かれば）" value="${g.price || ''}"></div>
      <div class="field"><span>反応</span>${chips('reaction', REACTIONS.map((r) => ({ v: r.v, html: `${r.face} ${r.label}` })), g.reaction || '', 'toggle small')}</div>
      <label class="field"><span>メモ</span><textarea id="g-memo" rows="2" placeholder="選んだ理由・相手の反応など">${esc(g.memo || '')}</textarea></label>
      <button class="btn primary block" data-act="saveGift">${isNew ? '記録する' : '保存する'}</button>
      ${isNew ? '' : `<button class="btn text danger block" data-act="deleteGift">削除</button>`}
    </div>`);
  actions.saveGift = (el) => {
    const body = el.closest('.sheet-body');
    const personId = resolvePerson(body); if (!personId) return;
    const item = val(body, '#g-item'); if (!item) { toast('何をあげたか入れてください'); return; }
    const price = num(val(body, '#g-price'));
    const rec = isNew ? { id: uid() } : S.gifts.find((x) => x.id === g.id);
    Object.assign(rec, {
      personId, item, date: val(body, '#g-date') || today(),
      occasion: val(body, '#g-occ') || chipVal(body, 'occ'),
      band: chipVal(body, 'band') || (bandForPrice(price) || {}).k || '', price,
      reaction: Number(chipVal(body, 'reaction')) || null, memo: val(body, '#g-memo'),
    });
    if (g.occKey) rec.occKey = g.occKey;
    if (isNew) S.gifts.push(rec);
    if (g.ideaId) { const i = S.ideas.find((x) => x.id === g.ideaId); if (i) i.done = true; }
    save(); closeSheet(); rerender(); toast('記録しました');
  };
  actions.deleteGift = async () => {
    if (!(await confirmBox('この記録を削除しますか？', '削除する', true))) return;
    S.gifts = S.gifts.filter((x) => x.id !== g.id); save(); closeSheet(); rerender();
  };
}
actions.editGift = (el) => { const g = S.gifts.find((x) => x.id === el.dataset.id); if (g) openGiftForm(Object.assign({}, g)); };
actions.addGift = (el) => openGiftForm({ personId: el && el.dataset.person });

// ---------- 候補 ----------
function giftIdeaView() {
  const list = S.ideas.filter((i) => !i.done);
  if (!list.length) {
    return `<div class="empty"><div class="empty-icon">${ICON.bulb}</div>
      <p class="empty-title">あげたいものの候補をメモ</p>
      <p>街やネットで「あの人に良さそう」と思ったらすぐ登録。<br>誕生日が近づいたらここから選べます。</p></div>
      ${doneIdeasLink()}`;
  }
  const groups = {};
  for (const i of list) (groups[i.personId || ''] = groups[i.personId || ''] || []).push(i);
  const order = Object.keys(groups).sort((a, b) => (a === '' ? 1 : b === '' ? -1 : pname(a).localeCompare(pname(b), 'ja')));
  return order.map((pid) => `<h3 class="sec">${pid ? esc(pname(pid)) + 'さんに' : 'だれかに'}</h3>
    <div class="cards">${groups[pid].map(ideaCard).join('')}</div>`).join('') + doneIdeasLink();
}
function doneIdeasLink() {
  const n = S.ideas.filter((i) => i.done).length;
  return n ? `<button class="link-row" data-act="showDoneIdeas">${ICON.list}<span>あげた・使った候補（${n}件）</span>${ICON.chev}</button>` : '';
}
actions.showDoneIdeas = () => openSheet('doneIdeas', () => `<h2 class="sheet-title">あげた・使った候補</h2>
  <div class="cards">${S.ideas.filter((i) => i.done).map(ideaCard).join('')}</div>`);

function ideaCard(i) {
  return `<button class="card idea" data-act="editIdea" data-id="${i.id}">
    <div class="card-main">
      <div class="name">${esc(i.item)}</div>
      <div class="meta">${priceLabel(i) ? `<span class="price">${esc(priceLabel(i))}</span>` : ''}${i.memo ? `<span>${esc(i.memo)}</span>` : ''}</div>
    </div>
    ${i.url ? `<span class="icon-btn" data-act="openUrl" data-url="${esc(i.url)}">${ICON.link}</span>` : ''}
  </button>`;
}

function openIdeaForm(i) {
  const isNew = !i.id;
  openSheet('ideaForm', () => `
    <h2 class="sheet-title">${isNew ? 'プレゼント候補を追加' : 'プレゼント候補'}</h2>
    <div class="form">
      <label class="field"><span>なにを？</span><input id="i-item" placeholder="例）〇〇のコーヒー豆" value="${esc(i.item || '')}"></label>
      <div class="field"><span>だれに？</span>
        <select id="p-sel">
          <option value="">まだ決めてない（だれかに）</option>
          ${S.people.map((p) => `<option value="${p.id}" ${p.id === i.personId ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}
          <option value="__new">＋ 新しい人を追加</option>
        </select>
        <input id="p-new" class="hide" placeholder="名前">
      </div>
      <div class="field"><span>値段</span>${bandChips(i)}<input id="i-price" inputmode="numeric" placeholder="金額（細かく分かれば）" value="${i.price || ''}"></div>
      <label class="field"><span>URL（任意）</span><input id="i-url" type="url" inputmode="url" placeholder="https://…" value="${esc(i.url || '')}"></label>
      <label class="field"><span>メモ</span><input id="i-memo" placeholder="どこで見つけたか・なぜ良さそうか" value="${esc(i.memo || '')}"></label>
      <button class="btn primary block" data-act="saveIdea">${isNew ? '追加する' : '保存する'}</button>
      ${isNew ? '' : `<div class="btn-row">
        <button class="btn ghost" data-act="ideaGive">🎁 これをあげた</button>
        <button class="btn ghost" data-act="ideaDone">${i.done ? '候補に戻す' : '使用済みにする'}</button></div>
        <button class="btn text danger block" data-act="deleteIdea">削除</button>`}
    </div>`);
  const read = (body) => {
    const price = num(val(body, '#i-price'));
    return { item: val(body, '#i-item'), personId: resolvePerson(body, true), band: chipVal(body, 'band') || (bandForPrice(price) || {}).k || '', price, url: val(body, '#i-url'), memo: val(body, '#i-memo') };
  };
  actions.saveIdea = (el) => {
    const body = el.closest('.sheet-body');
    const d = read(body); if (!d.item) { toast('なにをあげるか入れてください'); return; }
    const rec = isNew ? { id: uid(), addedAt: today(), done: false } : S.ideas.find((x) => x.id === i.id);
    Object.assign(rec, d); if (isNew) S.ideas.push(rec);
    save(); closeSheet(); rerender(); toast(isNew ? '候補に追加しました' : '保存しました');
  };
  actions.ideaGive = (el) => {
    const rec = S.ideas.find((x) => x.id === i.id);
    closeSheet();
    openGiftForm({ personId: rec.personId, item: rec.item, band: rec.band, price: rec.price, memo: rec.memo, ideaId: rec.id });
  };
  actions.ideaDone = () => { const rec = S.ideas.find((x) => x.id === i.id); rec.done = !rec.done; save(); closeSheet(); rerender(); };
  actions.deleteIdea = async () => {
    if (!(await confirmBox('この候補を削除しますか？', '削除する', true))) return;
    S.ideas = S.ideas.filter((x) => x.id !== i.id); save(); closeSheet(); rerender();
  };
}
actions.editIdea = (el) => { const i = S.ideas.find((x) => x.id === el.dataset.id); if (i) openIdeaForm(Object.assign({}, i)); };
actions.addIdea = (el) => openIdeaForm({ personId: el && el.dataset.person });

// ---------- 人 ----------
function nextOccOf(pid) {
  const t = today();
  return occurrences(t, addDays(t, 366)).find((o) => o.personId === pid);
}
function giftPeopleView() {
  if (!S.people.length) {
    return `<div class="empty"><div class="empty-icon">${ICON.user}</div>
      <p class="empty-title">プレゼントを渡す人を登録</p>
      <p>誕生日を入れておくと、毎年の予定に自動で並びます。</p>
      <button class="btn primary" data-act="addPerson">人を登録する</button></div>`;
  }
  const t = today();
  const rows = S.people.map((p) => ({ p, next: nextOccOf(p.id), n: S.gifts.filter((g) => g.personId === p.id).length }))
    .sort((a, b) => (a.next ? a.next.date : '9999').localeCompare(b.next ? b.next.date : '9999'));
  return `<div class="cards">${rows.map(({ p, next, n }) => `
    <button class="card person" data-act="openPerson" data-id="${p.id}">
      <div class="avatar">${esc(p.name.slice(0, 1))}</div>
      <div class="card-main">
        <div class="name">${esc(p.name)}${p.relation ? `<span class="tag">${esc(p.relation)}</span>` : ''}</div>
        <div class="meta">${p.birthday ? `<span>🎂 ${Number(p.birthday.slice(0, 2))}/${Number(p.birthday.slice(3))}</span>` : ''}<span>あげた ${n}回</span></div>
      </div>
      ${next ? `<span class="pill ${diffDays(t, next.date) <= 14 ? 'hot' : ''}">${esc(next.title)}まで${diffDays(t, next.date)}日</span>` : ''}
    </button>`).join('')}</div>`;
}

actions.openPerson = (el) => openPerson(el.dataset.id);
function openPerson(id) {
  openSheet('person:' + id, () => {
    const p = personById(id); if (!p) return '<p class="muted">削除されました</p>';
    const t = today();
    const occ = occurrences(t, addDays(t, 365)).filter((o) => o.personId === id);
    const gifts = S.gifts.filter((g) => g.personId === id).sort((a, b) => b.date.localeCompare(a.date));
    const ideas = S.ideas.filter((i) => !i.done && i.personId === id);
    const total = gifts.reduce((s, g) => s + (g.price || 0), 0);
    return `<div class="person-head"><div class="avatar lg">${esc(p.name.slice(0, 1))}</div>
        <div><h2 class="sheet-title">${esc(p.name)}</h2><p class="muted">${[p.relation, p.birthday ? `誕生日 ${Number(p.birthday.slice(0, 2))}月${Number(p.birthday.slice(3))}日` : ''].filter(Boolean).join('・')}</p></div></div>
      ${p.memo ? `<div class="note-box"><small>好きなもの・メモ</small>${esc(p.memo)}</div>` : ''}
      <div class="sub-sec"><h4>これからの予定</h4>
        ${occ.length ? `<div class="occ-list">${occ.map((o) => occRow(o, t)).join('')}</div>` : '<p class="muted small">予定はありません</p>'}
        <button class="btn text" data-act="addEvent" data-person="${id}">${ICON.plus}予定を追加（記念日など）</button></div>
      <div class="sub-sec"><h4>候補</h4>
        ${ideas.length ? `<div class="cards">${ideas.map(ideaCard).join('')}</div>` : '<p class="muted small">候補はありません</p>'}
        <button class="btn text" data-act="addIdea" data-person="${id}">${ICON.plus}候補を追加</button></div>
      <div class="sub-sec"><h4>あげたもの${gifts.length ? `<span class="muted">（${gifts.length}回${total ? `・計${yen(total)}` : ''}）</span>` : ''}</h4>
        ${gifts.length ? giftRows(gifts) : '<p class="muted small">まだ記録はありません</p>'}
        <button class="btn text" data-act="addGift" data-person="${id}">${ICON.plus}あげたものを記録</button></div>
      <div class="btn-row"><button class="btn ghost" data-act="editPerson" data-id="${id}">編集</button></div>`;
  });
}

function openPersonForm(p) {
  const isNew = !p.id;
  const [bm, bd] = p.birthday ? p.birthday.split('-').map(Number) : [0, 0];
  openSheet('personForm', () => `
    <h2 class="sheet-title">${isNew ? '人を登録' : '編集'}</h2>
    <div class="form">
      <label class="field"><span>名前</span><input id="pp-name" placeholder="例）母、田中さん" value="${esc(p.name || '')}"></label>
      <div class="field"><span>関係</span>${chips('rel', RELATIONS.map((r) => ({ v: r, label: r })), p.relation || '', 'toggle small')}</div>
      <div class="field"><span>誕生日</span><div class="row2">
        <select id="pp-bm"><option value="">月</option>${Array.from({ length: 12 }, (_, i) => `<option value="${i + 1}" ${bm === i + 1 ? 'selected' : ''}>${i + 1}月</option>`).join('')}</select>
        <select id="pp-bd"><option value="">日</option>${Array.from({ length: 31 }, (_, i) => `<option value="${i + 1}" ${bd === i + 1 ? 'selected' : ''}>${i + 1}日</option>`).join('')}</select>
      </div><small class="hint">入れておくと毎年の予定に自動で出てきます</small></div>
      <label class="field"><span>好きなもの・メモ</span><textarea id="pp-memo" rows="3" placeholder="好きなブランド・苦手なもの・サイズなど">${esc(p.memo || '')}</textarea></label>
      <button class="btn primary block" data-act="savePerson">${isNew ? '登録する' : '保存する'}</button>
      ${isNew ? '' : `<button class="btn text danger block" data-act="deletePerson">この人を削除</button>`}
    </div>`, { focus: isNew ? '#pp-name' : null });
  actions.savePerson = (el) => {
    const body = el.closest('.sheet-body');
    const name = val(body, '#pp-name'); if (!name) { toast('名前を入れてください'); return; }
    const m = num(val(body, '#pp-bm')), d = num(val(body, '#pp-bd'));
    const rec = isNew ? { id: uid() } : personById(p.id);
    Object.assign(rec, { name, relation: chipVal(body, 'rel'), birthday: m && d ? `${pad(m)}-${pad(d)}` : '', memo: val(body, '#pp-memo') });
    if (isNew) S.people.push(rec);
    save(); closeSheet(); rerender(); toast(isNew ? '登録しました' : '保存しました');
  };
  actions.deletePerson = async () => {
    if (!(await confirmBox(`${p.name}さんを削除しますか？予定・候補・あげたものの記録もすべて消えます。`, '削除する', true))) return;
    S.people = S.people.filter((x) => x.id !== p.id);
    S.events = S.events.filter((x) => x.personId !== p.id);
    S.gifts = S.gifts.filter((x) => x.personId !== p.id);
    S.ideas = S.ideas.filter((x) => x.personId !== p.id);
    save(); closeSheet(); closeSheet(); rerender();
  };
}
actions.addPerson = () => openPersonForm({});
actions.editPerson = (el) => { const p = personById(el.dataset.id); if (p) openPersonForm(Object.assign({}, p)); };

// ---------- 予定（誕生日以外） ----------
function openEventForm(e) {
  const isNew = !e.id;
  openSheet('eventForm', () => `
    <h2 class="sheet-title">${isNew ? 'プレゼントの予定を追加' : '予定を編集'}</h2>
    <p class="muted small">誕生日は「人」に登録すると自動で出てきます。</p>
    <div class="form">
      ${personPicker(e.personId)}
      <div class="field"><span>なんの日？</span>${chips('etitle', OCCASIONS.filter((o) => o !== '誕生日').map((o) => ({ v: o, label: o })), OCCASIONS.includes(e.title) ? e.title : '', 'toggle small')}
        <input id="e-title" placeholder="その他（例：結婚記念日）" value="${esc(OCCASIONS.includes(e.title) ? '' : e.title || '')}"></div>
      <label class="field"><span>日付</span><input id="e-date" type="date" value="${esc(e.date || '')}"></label>
      <div class="field"><span>くり返し</span>${chips('yearly', [{ v: '1', label: '毎年' }, { v: '0', label: '1回だけ' }], e.yearly === false ? '0' : '1')}</div>
      <button class="btn primary block" data-act="saveEvent">${isNew ? '追加する' : '保存する'}</button>
      ${isNew ? '' : `<button class="btn text danger block" data-act="deleteEvent">この予定を削除</button>`}
    </div>`);
  actions.saveEvent = (el) => {
    const body = el.closest('.sheet-body');
    const title = val(body, '#e-title') || chipVal(body, 'etitle');
    const date = val(body, '#e-date');
    if (!title) { toast('なんの日か入れてください'); return; }
    if (!date) { toast('日付を入れてください'); return; }
    const personId = resolvePerson(body); if (!personId) return;
    const rec = isNew ? { id: uid() } : S.events.find((x) => x.id === e.id);
    Object.assign(rec, { personId, title, date, yearly: chipVal(body, 'yearly') !== '0' });
    if (isNew) S.events.push(rec);
    save(); closeSheet(); rerender(); toast(isNew ? '予定を追加しました' : '保存しました');
  };
  actions.deleteEvent = async () => {
    if (!(await confirmBox('この予定を削除しますか？', '削除する', true))) return;
    S.events = S.events.filter((x) => x.id !== e.id); save(); closeAllSheets(); rerender();
  };
}
actions.addEvent = (el) => openEventForm({ personId: el && el.dataset.person, yearly: true });
actions.editEvent = (el) => { const e = S.events.find((x) => x.id === el.dataset.id); if (e) openEventForm(Object.assign({}, e)); };
