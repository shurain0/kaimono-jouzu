/* =========================================================
   指の操作：下にスライドで閉じる・横スワイプでタブ切り替え
   ========================================================= */
'use strict';

// ---------- 下から出た画面を、下にスライドして閉じる ----------
(() => {
  let g = null; // 操作中の情報
  document.addEventListener('touchstart', (e) => {
    g = null;
    const sheet = e.target.closest('.sheet');
    const s = topSheet();
    if (!sheet || !s || !s.wrap.contains(sheet) || e.touches.length !== 1) return;
    const t = e.touches[0];
    const rect = sheet.getBoundingClientRect();
    const onHandle = t.clientY - rect.top < 36; // 上のつまみ付近はいつでも引っぱれる
    // 入力欄の中は文字選択やスクロールを優先
    if (!onHandle && e.target.closest('input, textarea, select')) return;
    g = { sheet, s, x0: t.clientX, y0: t.clientY, t0: Date.now(), dy: 0, active: false, canPull: onHandle || sheet.scrollTop <= 0 };
  }, { passive: true });

  document.addEventListener('touchmove', (e) => {
    if (!g) return;
    const t = e.touches[0];
    const dx = t.clientX - g.x0, dy = t.clientY - g.y0;
    if (!g.active) {
      if (g.canPull && dy > 8 && dy > Math.abs(dx) * 1.2) {
        g.active = true; g.y0 = t.clientY; g.sheet.style.transition = 'none';
        if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
      } else if (Math.abs(dy) > 8 || Math.abs(dx) > 8) { g = null; return; } else return;
    }
    e.preventDefault();
    g.dy = Math.max(0, t.clientY - g.y0);
    g.sheet.style.transform = `translateY(${g.dy}px)`;
    const bg = g.s.wrap.querySelector('.sheet-bg');
    if (bg) bg.style.opacity = String(Math.max(0, 1 - g.dy / (g.sheet.offsetHeight || 600)));
  }, { passive: false });

  const end = () => {
    if (!g || !g.active) { g = null; return; }
    const { sheet, s, dy, t0 } = g;
    const fast = dy > 40 && dy / Math.max(1, Date.now() - t0) > 0.6;
    const bg = s.wrap.querySelector('.sheet-bg');
    sheet.style.transition = '';
    if (dy > Math.min(140, sheet.offsetHeight * 0.3) || fast) {
      sheet.style.transform = 'translateY(100%)';
      if (bg) bg.style.opacity = '';
      if (topSheet() === s) closeSheet();
    } else {
      sheet.style.transform = '';
      if (bg) bg.style.opacity = '';
    }
    g = null;
  };
  document.addEventListener('touchend', end);
  document.addEventListener('touchcancel', end);
})();

// ---------- プレゼント画面：横スワイプで「予定・候補・あげたもの・人」を切り替え ----------
(() => {
  let g = null;
  const main = () => document.getElementById('main');
  document.addEventListener('touchstart', (e) => {
    g = null;
    if (UI.tab !== 'gift' || sheets.length || e.touches.length !== 1) return;
    if (e.target.closest('.nav, .top, .fab, #updateBanner')) return; // 画面の中身（下の余白も含む）でスワイプ
    if (e.target.closest('input, textarea, select')) return;
    const t = e.touches[0];
    g = { x0: t.clientX, y0: t.clientY, t0: Date.now() };
  }, { passive: true });
  document.addEventListener('touchend', (e) => {
    if (!g) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - g.x0, dy = t.clientY - g.y0, dt = Date.now() - g.t0;
    g = null;
    if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.8 || dt > 700) return;
    const i = GIFT_TABS.findIndex((x) => x.v === (UI.giftTab || 'plan'));
    const j = i + (dx < 0 ? 1 : -1);
    if (j < 0 || j >= GIFT_TABS.length) return;
    UI.giftTab = GIFT_TABS[j].v;
    renderMain();
    window.scrollTo(0, 0);
    const m = main();
    m.classList.remove('swipe-l', 'swipe-r');
    void m.offsetWidth; // アニメーションをやり直す
    m.classList.add(dx < 0 ? 'swipe-l' : 'swipe-r');
  });
})();
