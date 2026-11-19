/* =========================================================
   振り返り（買い物の精度を見る）
   ========================================================= */
'use strict';

const WAIT_GROUPS = [
  { label: '即決（2日以内）', test: (d) => d <= 2 },
  { label: '3日〜1ヶ月', test: (d) => d > 2 && d <= 30 },
  { label: '1ヶ月以上', test: (d) => d > 30 },
];

function viewStats() {
  const bought = S.items.filter((x) => x.status === 'bought');
  const skipped = S.items.filter((x) => x.status === 'skipped');
  const rated = bought.map((it) => ({ it, lr: latestRating(it) })).filter((x) => x.lr);

  if (!bought.length) {
    return `<div class="empty"><div class="empty-icon">${ICON.chart}</div>
      <p class="empty-title">振り返りはこれから</p>
      <p>買ったものの満足度がたまると、<br>「どんな買い方だとうまくいくか」がここに出てきます。</p></div>`;
  }

  const scores = rated.map((x) => x.lr.r.s);
  const avgScore = avg(scores);
  const good = rated.filter((x) => x.lr.r.s >= 4).length;
  const savedMoney = skipped.reduce((s, x) => s + (x.price || 0), 0);
  const spent = bought.reduce((s, x) => s + (x.paid || 0), 0);

  // 期間ごとの平均
  const curve = CPS.map((cp) => {
    const v = bought.map((it) => it.ratings[cp.k]).filter((r) => r && r.s).map((r) => r.s);
    return { cp, n: v.length, a: avg(v) };
  });

  // 欲しい度別・検討期間別
  const byDesire = DESIRES.slice().reverse().map((d) => {
    const v = rated.filter((x) => x.it.desire === d.v).map((x) => x.lr.r.s);
    return { label: d.label, n: v.length, a: avg(v) };
  });
  const byWait = WAIT_GROUPS.map((g) => {
    const v = rated.filter((x) => waitDays(x.it) != null && g.test(waitDays(x.it))).map((x) => x.lr.r.s);
    return { label: g.label, n: v.length, a: avg(v) };
  });

  const sleeping = bought.filter((it) => { const lr = latestRating(it); return lr && lr.r.use === 1; });
  const best = rated.filter((x) => x.lr.r.s >= 4).sort((a, b) => b.lr.r.s - a.lr.r.s || CPS.indexOf(b.lr.cp) - CPS.indexOf(a.lr.cp)).slice(0, 3);
  const worst = rated.filter((x) => x.lr.r.s <= 2).sort((a, b) => a.lr.r.s - b.lr.r.s).slice(0, 3);

  return `
    <div class="kpis">
      <div class="kpi"><span>買ったもの</span><b>${bought.length}<small>件</small></b>${spent ? `<em>${yen(spent)}</em>` : ''}</div>
      <div class="kpi"><span>平均満足度</span><b>${fmt1(avgScore)}<small>/5</small></b><em>${rated.length}件の最新評価</em></div>
      <div class="kpi"><span>満足した割合</span><b>${rated.length ? Math.round((good / rated.length) * 100) : '—'}<small>%</small></b><em>「満足」以上</em></div>
      <div class="kpi"><span>見送ったもの</span><b>${skipped.length}<small>件</small></b>${savedMoney ? `<em>${yen(savedMoney)} 節約</em>` : ''}</div>
    </div>

    ${insights(byWait, byDesire, curve, sleeping)}

    <section class="panel">
      <h3>時間がたつと満足度はどう変わる？</h3>
      <p class="muted small">各タイミングで記録した満足度の平均（全商品）</p>
      ${curveSvg(curve)}
    </section>

    <section class="panel">
      <h3>欲しい度と満足度</h3>
      <p class="muted small">登録したときの「欲しい度」ごとの最新の満足度</p>
      ${hbars(byDesire)}
    </section>

    <section class="panel">
      <h3>じっくり考えたほうが満足？</h3>
      <p class="muted small">欲しいと思ってから買うまでの期間ごとの最新の満足度</p>
      ${hbars(byWait)}
    </section>

    ${best.length ? `<section class="panel"><h3>いい買い物だったもの</h3>${miniList(best)}</section>` : ''}
    ${worst.length ? `<section class="panel"><h3>後悔したもの</h3>${miniList(worst)}</section>` : ''}
    ${sleeping.length ? `<section class="panel"><h3>あまり使っていないもの</h3>${miniList(sleeping.map((it) => ({ it, lr: latestRating(it) })))}</section>` : ''}
  `;
}

function insights(byWait, byDesire, curve, sleeping) {
  const out = [];
  const [quick, , slow] = byWait;
  if (quick.n >= 2 && slow.n >= 2) {
    if (slow.a - quick.a >= 0.5) out.push(`1ヶ月以上考えてから買ったものは満足度 <b>${fmt1(slow.a)}</b>、即決は <b>${fmt1(quick.a)}</b>。じっくり寝かせたほうがうまくいっています。`);
    else if (quick.a - slow.a >= 0.5) out.push(`即決したもののほうが満足度が高め（${fmt1(quick.a)} vs ${fmt1(slow.a)}）。直感が当たるタイプかも。`);
  }
  const [hi, , lo] = byDesire;
  if (hi.n >= 2 && lo.n >= 2 && lo.a - hi.a >= 0.5) out.push(`「めっちゃ欲しい」より「ちょっと欲しい」もののほうが満足度が高めです。勢いに注意。`);
  if (hi.n >= 3 && hi.a >= 4) out.push(`「めっちゃ欲しい」ものの満足度は <b>${fmt1(hi.a)}</b>。本当に欲しいものは買って正解が多いようです。`);
  const early = curve.find((c) => c.cp.k === 'w1'), late = curve.find((c) => c.cp.k === 'm3');
  if (early.n >= 3 && late.n >= 3 && early.a - late.a >= 0.5) out.push(`買って1週間（${fmt1(early.a)}）から3ヶ月（${fmt1(late.a)}）で満足度が下がりがち。長く使うイメージができるかを買う前に考えてみましょう。`);
  if (sleeping.length >= 2) out.push(`「ほぼ使ってない」ものが ${sleeping.length}件あります。`);
  if (!out.length) return `<p class="insight muted">満足度の記録がもう少したまると、ここに傾向が出てきます。</p>`;
  return out.map((s) => `<p class="insight">${s}</p>`).join('');
}

function curveSvg(curve) {
  const pts = curve.map((c, i) => ({ ...c, i })).filter((c) => c.n);
  if (!pts.length) return `<p class="muted center small">まだ記録がありません</p>`;
  const W = 320, H = 178, L = 22, R = 14, T = 12, B = 52;
  const px = (i) => L + (i * (W - L - R)) / (CPS.length - 1);
  const py = (s) => T + ((5 - s) * (H - T - B)) / 4;
  const d = pts.map((p, j) => `${j ? 'L' : 'M'}${px(p.i).toFixed(1)},${py(p.a).toFixed(1)}`).join('');
  return `<svg class="chart" viewBox="0 0 ${W} ${H}">
      ${[1, 2, 3, 4, 5].map((s) => `<line x1="${L}" x2="${W - R}" y1="${py(s)}" y2="${py(s)}" class="grid"/><text x="${L - 8}" y="${py(s) + 3.5}" class="ax" text-anchor="end">${s}</text>`).join('')}
      ${curve.map((c, i) => `<text x="${px(i)}" y="${H - 34}" class="ax" text-anchor="middle">${c.cp.short}</text>
        <text x="${px(i)}" y="${H - 17}" class="val" text-anchor="middle">${c.n ? fmt1(c.a) : '—'}</text>
        <text x="${px(i)}" y="${H - 4}" class="ax n" text-anchor="middle">${c.n ? c.n + '件' : ''}</text>`).join('')}
      ${pts.length > 1 ? `<path d="${d}" class="line"/>` : ''}
      ${pts.map((p) => `<circle cx="${px(p.i)}" cy="${py(p.a)}" r="4.5" class="pt"/>`).join('')}
    </svg>`;
}

function hbars(rows) {
  if (!rows.some((r) => r.n)) return `<p class="muted center small">まだ記録がありません</p>`;
  return `<div class="hbars">${rows.map((r) => `
    <div class="hbar">
      <span class="hb-label">${esc(r.label)}</span>
      <span class="hb-track">${r.n ? `<i style="width:${((r.a - 0) / 5) * 100}%"></i>` : ''}</span>
      <span class="hb-val">${r.n ? `<b>${fmt1(r.a)}</b><small>${r.n}件</small>` : '<small>—</small>'}</span>
    </div>`).join('')}</div>`;
}

function miniList(rows) {
  return `<div class="mini-list">${rows.map(({ it, lr }) => `
    <button class="mini" data-act="openItem" data-id="${it.id}">
      <span class="face">${lr ? scoreFace(lr.r.s) : ''}</span>
      <span class="mini-name">${esc(it.name)}</span>
      <span class="muted small">${lr ? lr.cp.label : ''}</span>
    </button>`).join('')}</div>`;
}
