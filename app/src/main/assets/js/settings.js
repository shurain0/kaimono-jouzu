/* =========================================================
   設定・バックアップ・アップデート
   ========================================================= */
'use strict';

const LEAD_OPTS = [
  { v: 30, label: '1ヶ月前' }, { v: 14, label: '2週間前' }, { v: 7, label: '1週間前' },
  { v: 3, label: '3日前' }, { v: 1, label: '前日' }, { v: 0, label: '当日' },
];

actions.openSettings = () => {
  openSheet('settings', () => {
    const allowed = N ? N.notifAllowed() : false;
    const hour = N ? N.getHour() : 20;
    const leads = S.settings.giftLeads || [];
    return `<h2 class="sheet-title">設定</h2>
      <div class="set-group"><h4>通知</h4>
        <div class="set-row"><span>通知の許可</span>${allowed ? '<b class="ok">オン</b>' : `<button class="btn primary sm" data-act="reqNotif">オンにする</button>`}</div>
        <div class="set-row"><span>通知する時刻</span>
          <select id="set-hour">${Array.from({ length: 24 }, (_, h) => `<option value="${h}" ${h === hour ? 'selected' : ''}>${h}:00</option>`).join('')}</select></div>
        <div class="set-col"><span>プレゼントのお知らせ</span>
          <div class="chips multi small" data-chips="leads">${LEAD_OPTS.map((o) => `<button type="button" class="chip ${leads.includes(o.v) ? 'on' : ''}" data-act="chip" data-v="${o.v}">${o.label}</button>`).join('')}</div></div>
        <div class="set-row"><span>テスト</span><button class="btn ghost sm" data-act="testNotif">テスト通知を送る</button></div>
      </div>
      <div class="set-group"><h4>データ</h4>
        <p class="muted small">データはこのスマホの中だけに保存されています。機種変更やもしものときのために、ときどき書き出しておくと安心です。</p>
        <button class="btn ghost block" data-act="exportData">バックアップを書き出す</button>
        <button class="btn ghost block" data-act="importData">バックアップから読み込む</button>
        ${N ? `<button class="btn text block" data-act="openAutoBackups">自動バックアップから戻す</button>` : ''}
      </div>
      <div class="set-group"><h4>アプリ</h4>
        <div class="set-row"><span>バージョン</span><b>${esc(native.version())}</b></div>
        <div class="set-row"><span>起動時にアップデートを確認</span>${chips('autoUpdate', [{ v: '1', label: 'する' }, { v: '0', label: 'しない' }], S.settings.autoUpdate ? '1' : '0', 'small')}</div>
        <button class="btn primary block" data-act="checkUpdate">アップデートを確認</button>
      </div>`;
  }, {
    after: (body) => {
      const hs = $('#set-hour', body);
      hs.addEventListener('change', () => { if (N) N.setHour(Number(hs.value)); save(); toast(`毎日 ${hs.value}:00 に確認します`); });
      body.addEventListener('chipchange', (e) => {
        const k = e.target.dataset.chips;
        if (k === 'leads') { S.settings.giftLeads = $$('.chip.on', e.target).map((c) => Number(c.dataset.v)); save(); }
        if (k === 'autoUpdate') { S.settings.autoUpdate = chipVal(body, 'autoUpdate') === '1'; save(); }
      });
    },
  });
};

actions.reqNotif = () => { if (N) N.requestNotif(); };
window.__notifChanged = () => { const s = topSheet(); if (s && s.id === 'settings') refreshSheet(s); };
actions.testNotif = () => {
  if (!N) { toast('アプリ版で使えます'); return; }
  if (!N.notifAllowed()) { toast('先に通知をオンにしてください'); N.requestNotif(); return; }
  N.testNotify(); toast('送りました');
};

// ---------- バックアップ ----------
actions.exportData = () => {
  const json = JSON.stringify(S, null, 1);
  if (N) N.exportData(json);
  else {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    a.download = `kaimono-backup-${today().replace(/-/g, '')}.json`; a.click();
  }
};
window.__exported = (ok) => toast(ok ? '書き出しました' : '書き出せませんでした');

actions.importData = () => {
  if (N) N.importData();
  else {
    const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.json,application/json';
    inp.onchange = () => { const f = inp.files[0]; if (f) f.text().then(window.__imported); };
    inp.click();
  }
};
window.__imported = async (text) => {
  let d;
  try { d = JSON.parse(text); } catch (e) { toast('読み込めないファイルです'); return; }
  if (!d || !Array.isArray(d.items)) { toast('買い物上手のバックアップではないようです'); return; }
  const n = d.items.length, g = (d.gifts || []).length;
  if (!(await confirmBox(`商品${n}件・プレゼント${g}件のデータで、今のデータを置き換えますか？`, '置き換える', true))) return;
  S = migrate(d); save(); closeAllSheets(); rerender(); toast('読み込みました');
};

actions.openAutoBackups = () => {
  const names = JSON.parse(N.listBackups() || '[]');
  openSheet('autoBackups', () => `<h2 class="sheet-title">自動バックアップ</h2>
    <p class="muted small">保存した日ごとに1つ、最大20日分残っています。</p>
    ${names.length ? `<div class="mini-list">${names.map((n) => {
      const s = n.slice(5, 13);
      return `<button class="mini" data-act="restoreBackup" data-name="${esc(n)}"><span class="mini-name">${s.slice(0, 4)}/${Number(s.slice(4, 6))}/${Number(s.slice(6))} の状態</span>${ICON.chev}</button>`;
    }).join('')}</div>` : '<p class="muted">まだありません</p>'}`);
};
actions.restoreBackup = (el) => { const t = N.readBackup(el.dataset.name); if (t) window.__imported(t); };

// ---------- アップデート ----------
async function checkUpdate(manual) {
  if (!native.has) { if (manual) toast('アプリ版で使えます'); return; }
  if (manual) toast('確認しています…');
  const r = await native.checkUpdate();
  localStorage.setItem('lastUpdateCheck', String(Date.now()));
  if (!r || !r.ok) { if (manual) toast('確認できませんでした（' + ((r && r.error) || '通信エラー') + '）'); return; }
  const cur = native.versionCode();
  if (r.number > cur) {
    UI.update = r; renderMain();
    localStorage.setItem('pendingUpdate', JSON.stringify(r));
    if (manual) openUpdate();
  } else if (manual) toast(`最新版です（v${cur}）`);
}
actions.checkUpdate = () => checkUpdate(true);
actions.openUpdate = () => openUpdate();
function openUpdate() {
  const r = UI.update; if (!r) return;
  const notes = (r.body || '').split('---')[0].trim();
  openSheet('update', () => `<h2 class="sheet-title">新しいバージョン ${esc(r.tag)}</h2>
    <p class="muted small">今のバージョン：v${native.versionCode()}</p>
    ${notes ? `<div class="note-box pre">${esc(notes)}</div>` : ''}
    <ol class="steps"><li>下のボタンでダウンロード</li><li>ダウンロードした .apk をタップ</li><li>「更新」を押す（データはそのまま残ります）</li></ol>
    <button class="btn primary block" data-act="downloadUpdate">ダウンロード</button>
    <button class="btn text block" data-act="openUrl" data-url="${esc(r.page)}">リリースページを開く</button>`, { cls: 'small' });
}
actions.downloadUpdate = () => { const r = UI.update; native.open(r.apk || r.page); };

function autoCheckUpdate() {
  if (!native.has || !S.settings.autoUpdate) return;
  const last = Number(localStorage.getItem('lastUpdateCheck') || 0);
  if (Date.now() - last > 6 * 3600 * 1000) checkUpdate(false);
}
