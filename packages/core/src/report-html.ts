/**
 * 会計レポートHTMLの組み立て(FR-05 の書き出し)。
 *
 * 画面は「今どうなっているか」を見るためのもので、手元に残して人へ渡す形にはならない。
 * 税理士・家族・自分の来期の見直しに渡せる単一ファイルをここで作る。
 *
 * 見た目の規律は skills/report-design-system に従う:
 *   - 単一HTML・外部参照ゼロ(CDN/Webフォント/画像リンクを使わない)
 *   - 白背景固定・色は意味にだけ使う(赤=悪化, 青=主役, 橙=結論のキー数字1〜2箇所)
 *   - 数字はすべて実データの計算結果。概数で誤魔化さない。出所をfooterに書く
 *   - 分析には method(仮説/手法/結果/前提と限界)を必ず添える
 *   - 円グラフ・二軸・3D・外部チャートライブラリは使わない
 */
import { matrix, overview } from './analysis.js';
import { REPORT_CSS } from './report-css.js';
import type { Dataset } from './types.js';

/** HTMLに値を差し込む前の逃がし。属性値にも使うので " と ' も落とす */
export function escapeHtml(v: string | number): string {
  return String(v)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const yen = (n: number): string => `${n < 0 ? '▲' : ''}¥${Math.abs(Math.round(n)).toLocaleString('ja-JP')}`;
const pct = (r: number): string => `${(r * 100).toFixed(1)}%`;

/** レポートの寸法。SVGの座標計算で何度も使うのでここに集める */
const CHART = { w: 880, h: 260, left: 76, right: 24, top: 20, bottom: 44 } as const;

/**
 * 単月棒(経費)+3ヶ月移動平均線。デザインシステムが認める4形のうち
 * 「ブレと実力を同時に見せる」形。未記帳月は棒を描かず、線も切る。
 */
function expenseChart(o: ReturnType<typeof overview>): string {
  const un = new Set(o.unrecordedExpMonths);
  const { w, h, left, right, top, bottom } = CHART;
  const plotW = w - left - right;
  const plotH = h - top - bottom;
  const max = Math.max(1, ...o.expenseTotal.map((v, i) => (un.has(o.months[i]) ? 0 : v)));
  const n = Math.max(1, o.months.length);
  const step = plotW / n;
  const barW = Math.min(34, step * 0.62);
  const y = (v: number): number => top + plotH - (v / max) * plotH;
  const x = (i: number): number => left + step * i + step / 2;

  const bars = o.months
    .map((m, i) => {
      if (un.has(m)) return '';
      const v = o.expenseTotal[i];
      return `<rect x="${(x(i) - barW / 2).toFixed(1)}" y="${y(v).toFixed(1)}" width="${barW.toFixed(1)}" height="${(top + plotH - y(v)).toFixed(1)}" rx="2" fill="#1d63be" data-tip="${escapeHtml(`${m} 経費 ${yen(v)}`)}"/>`;
    })
    .join('');

  // 移動平均は「値がある区間だけ」を線で結ぶ。未記帳をまたいで直線を引かない
  const segs: string[][] = [];
  let open: string[] | null = null;
  o.expenseMovingAvg.forEach((v, i) => {
    if (v == null || un.has(o.months[i])) {
      open = null;
      return;
    }
    if (!open) {
      open = [];
      segs.push(open);
    }
    open.push(`${x(i).toFixed(1)},${y(v).toFixed(1)}`);
  });
  const line = segs
    .filter((s) => s.length >= 2)
    .map((s) => `<polyline points="${s.join(' ')}" fill="none" stroke="#8b94a1" stroke-width="2"/>`)
    .join('');

  // 目盛は0と最大値だけ。線を増やすほど数字が読みにくくなる
  const grid = [0, max]
    .map(
      (v) =>
        `<line x1="${left}" y1="${y(v).toFixed(1)}" x2="${w - right}" y2="${y(v).toFixed(1)}" stroke="#e3e6ea"/>` +
        `<text x="${left - 8}" y="${(y(v) + 4).toFixed(1)}" text-anchor="end" class="ax">${escapeHtml(yen(v))}</text>`,
    )
    .join('');

  // 月ラベルは詰まると読めないので、12個を超えたら間引く
  const every = Math.ceil(n / 12);
  const labels = o.months
    .map((m, i) =>
      i % every === 0
        ? `<text x="${x(i).toFixed(1)}" y="${h - 16}" text-anchor="middle" class="ax">${escapeHtml(m.slice(2))}</text>`
        : '',
    )
    .join('');

  // 凡例は figcaption 側に置く。SVGの中に重ねると、月数が多いときに
  // 棒や移動平均線と重なって両方読めなくなる(実描画で確認済み)
  return `<svg viewBox="0 0 ${w} ${h}" class="chart" role="img" aria-label="月別の事業経費と3ヶ月移動平均">
${grid}${bars}${line}${labels}
</svg>`;
}

/** 科目別の年比較表。前年実績・当年年換算・増減を右揃えで並べる */
function yearTable(o: ReturnType<typeof overview>): string {
  const rows = o.yearTable
    .map(
      (r) =>
        `<tr><td>${escapeHtml(r.account)}</td><td class="r">${escapeHtml(yen(r.prevActual))}</td>` +
        `<td class="r">${escapeHtml(yen(r.currAnnualized))}</td>` +
        `<td class="r${r.delta > 0 ? ' loss' : ''}">${escapeHtml(`${r.delta > 0 ? '+' : ''}${pct(r.delta)}`)}</td></tr>`,
    )
    .join('');
  const t = o.yearTotals;
  return `<div class="tblwrap"><table>
<thead><tr><th>科目</th><th class="r">${escapeHtml(o.years.prev)}年 実績（円）</th><th class="r">${escapeHtml(o.years.curr)}年 年換算（円）</th><th class="r">増減</th></tr></thead>
<tbody>${rows}<tr><td><strong>経費計</strong></td><td class="r">${escapeHtml(yen(t.prevActual))}</td><td class="r">${escapeHtml(yen(t.currAnnualized))}</td><td class="r${t.delta > 0 ? ' loss' : ''}">${escapeHtml(`${t.delta > 0 ? '+' : ''}${pct(t.delta)}`)}</td></tr></tbody>
</table></div>`;
}

/**
 * データセットから単一HTMLのレポートを組み立てる。
 * generatedAt は呼び出し側から渡す(純関数のまま保ち、テストで日付を固定できるようにする)。
 */
export function buildReportHtml(data: Dataset, generatedAt: string): string {
  const o = overview(data);
  const m = matrix(data);
  const period = o.months.length ? `${o.months[0]} 〜 ${o.months[o.months.length - 1]}` : '対象期間なし';
  const expenseRatio = o.kpi.avgRevenue > 0 ? o.kpi.avgExpense / o.kpi.avgRevenue : 0;
  const avgProfit = o.kpi.avgRevenue - o.kpi.avgExpense;
  const unrecorded = o.unrecordedExpMonths;

  // 橙(accent)は結論のキー数字専用で1文書1〜2箇所まで。ここでは月平均の利益だけに使う
  const hero = `<div class="hero">
<div class="cell"><div class="k">月平均の売上</div><div class="v num blue">${escapeHtml(yen(o.kpi.avgRevenue))}</div><div class="s">売上のあった ${escapeHtml(o.kpi.revenueMonths)}ヶ月の平均</div></div>
<div class="cell"><div class="k">月平均の経費</div><div class="v num">${escapeHtml(yen(o.kpi.avgExpense))}</div><div class="s">経費率 ${escapeHtml(pct(expenseRatio))}</div></div>
<div class="cell"><div class="k">月平均の利益</div><div class="v num acc">${escapeHtml(yen(avgProfit))}</div><div class="s">売上 − 経費</div></div>
<div class="cell"><div class="k">直近月の経費</div><div class="v num${o.kpi.expenseMom > 0 ? ' red' : ''}">${escapeHtml(yen(o.kpi.lastExpense))}</div><div class="s">前月比 ${escapeHtml(`${o.kpi.expenseMom > 0 ? '+' : ''}${pct(o.kpi.expenseMom)}`)}</div></div>
</div>`;

  const caveat = unrecorded.length
    ? `<div class="guard"><b>集計から外した月</b>${escapeHtml(unrecorded.join(', '))} は経費が未記帳のため、平均・年換算・移動平均のいずれからも除いている。記帳後に数字は変わる。</div>`
    : '';

  return `<title>会計レポート</title>
<style>
${REPORT_CSS}</style>

<div class="wrap">
<header class="doc">
  <p class="crumb">kanjo｜事業と家計の月次レポート</p>
  <h1>会計レポート — 月平均の経費は${escapeHtml(yen(o.kpi.avgExpense))}、売上の${escapeHtml(pct(expenseRatio))}を占める</h1>
  <p class="sub">対象: ${escapeHtml(period)}（${escapeHtml(o.months.length)}ヶ月・明細 ${escapeHtml(data.mfTx.length)}件）｜経費は freee、家計は マネーフォワード の取込値｜作成日 ${escapeHtml(generatedAt)}</p>
</header>

<section>
  <span class="secno">結論</span>
  <h2>売上の水準に対して経費がどれだけ乗っているかを、月平均で押さえる</h2>
  ${hero}
  ${caveat}
</section>

<section>
  <span class="secno">DATA</span>
  <h2>この数字は取り込んだ明細をそのまま集計したもので、推計を含まない</h2>
  <div class="method">
    <b>仮説</b><span>月ごとのブレを均すと、事業の経費の実力値が見える</span>
    <b>手法</b><span>単月の経費合計と3ヶ月移動平均を併置する。移動平均を選んだのは、スポットの支出1件で水準の判断が動くのを避けるため</span>
    <b>結果</b><span>月平均 ${escapeHtml(yen(o.kpi.avgExpense))}、直近月 ${escapeHtml(yen(o.kpi.lastExpense))}（前月比 ${escapeHtml(pct(o.kpi.expenseMom))}）</span>
    <b>前提と限界</b><span>未記帳の月は除外している。除外月がある間は年換算の精度が落ちる。売上が0の月は利益を算出していない</span>
  </div>
  <figure>
    <figcaption>月別の事業経費<small>青=単月の経費合計 / グレー=3ヶ月移動平均。棒にマウスを載せると月と金額が出る</small></figcaption>
    <div class="chartbox">${expenseChart(o)}</div>
  </figure>
</section>

<section>
  <span class="secno">分析 1</span>
  <h2>科目別に前年と並べると、増えた科目と減った科目が分かれる</h2>
  <div class="method">
    <b>仮説</b><span>経費の増減は全体ではなく特定の科目に偏っている</span>
    <b>手法</b><span>前年の実績と、当年の記帳済み月から年換算した額を科目ごとに並べる</span>
    <b>結果</b><span>経費計は前年 ${escapeHtml(yen(o.yearTotals.prevActual))} に対し当年 年換算 ${escapeHtml(yen(o.yearTotals.currAnnualized))}（${escapeHtml(`${o.yearTotals.delta > 0 ? '+' : ''}${pct(o.yearTotals.delta)}`)}）</span>
    <b>前提と限界</b><span>年換算は「記帳済み月の平均×12」で、季節性を考慮していない。年の途中では上振れ・下振れしやすい</span>
  </div>
  ${yearTable(o)}
  <p class="note">対象科目 ${escapeHtml(m.rows.length)}行・対象年 ${escapeHtml(m.years.join(', '))}。増加は赤で示している。</p>
</section>

<footer>
kanjo｜会計レポート｜出所: 取込済みの freee 決算書CSV と マネーフォワード 収入・支出詳細CSV（明細 ${escapeHtml(data.mfTx.length)}件）｜手法: 月次合計・3ヶ月移動平均・記帳済み月からの年換算｜数値はすべて実データからの計算結果。
</footer>
</div>

<div id="tip" role="status" aria-hidden="true"></div>
<script>
(function(){
  var tip=document.getElementById('tip');
  document.addEventListener('mouseover',function(e){
    var t=e.target.closest('[data-tip]');
    if(!t){tip.style.opacity=0;return}
    tip.textContent=t.getAttribute('data-tip'); tip.style.opacity=1;
  });
  document.addEventListener('mousemove',function(e){
    if(tip.style.opacity=='1'){
      var x=Math.min(e.clientX+14,window.innerWidth-tip.offsetWidth-8);
      tip.style.left=x+'px'; tip.style.top=(e.clientY+16)+'px';
    }
  });
})();
</script>
`;
}
