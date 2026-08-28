/**
 * レポートHTMLに埋め込むCSS。
 *
 * 正本は skills/report-design-system/assets/report.css。
 * 単一HTMLファイル(外部参照ゼロ)で配れることがデザインシステム側の絶対原則なので、
 * ここへ全文を写して <style> に流し込む。写しである以上ズレるので、
 * scripts/check-report-css.mjs が正本との一致を lint で検査する。手で編集しない。
 */
export const REPORT_CSS = `/* ============================================================
   レポート用デザインシステム — 正本CSS
   出自: 平賀運送 車両収益性の構造分析(13ヶ月パネル)ほか検収済みレポート群
   使い方: このファイル全体を <style> にコピーして単一HTMLに埋め込む
   ============================================================ */

/* ---- トークン ---- */
:root {
  --brand: #1d63be; /* 主役・構造・黒字。チャートの subject */
  --brand-deep: #15498f; /* brandの文字用の濃色 */
  --brand-soft: #e3edfa; /* チップ地・強調の面 */
  --accent: #e8590c; /* 結論のキー数字専用。1文書1〜2箇所まで */
  --ink: #16191d; /* 本文 */
  --ink-muted: #545e6b; /* 補足・ラベル。これより薄い文字を本文に使わない */
  --line: #e3e6ea; /* 罫線 */
  --subtle: #f5f6f8; /* 極薄の面(表ヘッダー・methodボックス) */
  --danger: #d93025; /* 損失・悪化・赤字 */
  --danger-soft: #fbe9e7; /* dangerのチップ地 */
  --ok: #1d7a46; /* 利益・改善(多用しない) */
  --font-num: "Helvetica Neue", -apple-system, "Segoe UI", Roboto, Arial, sans-serif;
}
* {
  box-sizing: border-box;
}
body {
  margin: 0;
  background: #fff;
  color: var(--ink);
  font-family: "Helvetica Neue", Arial, "Hiragino Kaku Gothic ProN", "Hiragino Sans", "Noto Sans JP", Meiryo,
    sans-serif;
  font-size: 14px;
  line-height: 1.85;
  font-feature-settings: "palt";
  -webkit-font-smoothing: antialiased;
}
.wrap {
  max-width: 1020px;
  margin: 0 auto;
  padding: 44px 24px 100px;
}

/* ---- 数字は必ず欧文・等幅 ---- */
.num {
  font-family: var(--font-num);
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.02em;
  white-space: nowrap;
}

/* ---- 文書ヘッダー ---- */
header.doc {
  border-bottom: 3px solid var(--ink);
  padding-bottom: 24px;
}
.crumb {
  font-size: 12px;
  color: var(--ink-muted);
  letter-spacing: .08em;
  margin: 0 0 10px;
}
h1 {
  font-size: 27px;
  margin: 0 0 6px;
  font-weight: 700;
  line-height: 1.45;
  text-wrap: balance;
}
.sub {
  font-size: 12.5px;
  color: var(--ink-muted);
  margin: 0;
}

/* ---- セクション ---- */
section {
  margin-top: 60px;
}
.secno {
  display: inline-block;
  background: var(--brand-soft);
  color: var(--brand-deep);
  font-family: var(--font-num);
  font-weight: 700;
  font-size: 12px;
  padding: 2px 10px;
  border-radius: 4px;
  letter-spacing: .06em;
  margin-bottom: 8px;
}
h2 {
  font-size: 20px;
  margin: 0 0 4px;
  font-weight: 700;
  line-height: 1.5;
  text-wrap: balance;
}
.lede {
  font-size: 13px;
  color: var(--ink-muted);
  margin: 0 0 20px;
}
h3 {
  font-size: 14px;
  font-weight: 700;
  margin: 30px 0 10px;
}
p {
  margin: 0 0 13px;
  max-width: 46em;
}
ul,
ol {
  margin: 0 0 13px;
  padding-left: 1.5em;
  max-width: 46em;
}
li {
  margin-bottom: 7px;
}
.note {
  font-size: 12px;
  color: var(--ink-muted);
  margin-top: 8px;
}
.loss {
  color: var(--danger);
  font-weight: 700;
}
.profit {
  color: var(--ok);
  font-weight: 700;
}

/* ---- ヒーロー数字(KPIカード列) ---- */
.hero {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1px;
  background: var(--line);
  border: 1px solid var(--line);
  margin: 22px 0;
}
.hero .cell {
  background: #fff;
  padding: 18px 20px 14px;
}
.hero .k {
  font-size: 12px;
  color: var(--ink-muted);
  margin-bottom: 4px;
}
.hero .v {
  font-family: var(--font-num);
  font-weight: 700;
  font-size: 31px;
  letter-spacing: -0.015em;
  font-variant-numeric: tabular-nums;
  line-height: 1.2;
}
.hero .v .unit {
  font-size: 55%;
  font-weight: 600;
  color: var(--ink-muted);
  margin-left: 2px;
  letter-spacing: 0;
}
.hero .s {
  font-size: 11.5px;
  color: var(--ink-muted);
  margin-top: 4px;
}
.v.red {
  color: var(--danger);
}
.v.blue {
  color: var(--brand-deep);
}
.v.acc {
  color: var(--accent);
}

/* ---- 図(チャート容器) ---- */
figure {
  margin: 18px 0;
  border: 1px solid var(--line);
  padding: 18px 16px 12px;
  background: #fff;
}
figcaption {
  font-size: 13px;
  font-weight: 700;
  margin-bottom: 2px;
}
figcaption small {
  display: block;
  font-weight: 400;
  font-size: 11.5px;
  color: var(--ink-muted);
  margin-top: 2px;
}
.chartbox {
  overflow-x: auto;
  margin-top: 10px;
}
svg.chart {
  width: 100%;
  min-width: 640px;
  display: block;
}
svg .ax {
  font-size: 11px;
  fill: var(--ink-muted);
  font-family: var(--font-num);
} /* 軸ラベル */
svg .lb {
  font-size: 12px;
  fill: var(--ink);
} /* 項目ラベル */
svg .vl {
  font-size: 12px;
  font-weight: 700;
  fill: var(--ink);
  font-family: var(--font-num);
} /* 値(主) */
svg .vl2 {
  font-size: 11px;
  font-weight: 700;
  fill: var(--ink-muted);
  font-family: var(--font-num);
} /* 値(副) */
svg .an {
  font-size: 11.5px;
  font-weight: 700;
} /* 図中の注記 */

/* ---- 表 ---- */
.tblwrap {
  overflow-x: auto;
  border: 1px solid var(--line);
  margin: 16px 0;
}
table {
  border-collapse: collapse;
  width: 100%;
  font-size: 13px;
  min-width: 600px;
}
th {
  background: var(--subtle);
  text-align: left;
  font-size: 11.5px;
  color: var(--ink-muted);
  font-weight: 600;
  padding: 8px 12px;
  border-bottom: 1px solid var(--line);
  white-space: nowrap;
}
th.r {
  text-align: right;
}
td {
  padding: 8px 12px;
  border-bottom: 1px solid var(--line);
  vertical-align: top;
}
tr:last-child td {
  border-bottom: none;
}
tbody tr:hover td {
  background: var(--subtle);
}
td.r {
  text-align: right;
  font-family: var(--font-num);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
td.ex {
  color: var(--ink-muted);
  background: #fbfcfd;
} /* 記入例の行 */

/* ---- method(仮説→手法→結果→限界 の説明グリッド) ---- */
.method {
  display: grid;
  grid-template-columns: 104px 1fr;
  gap: 8px 14px;
  background: var(--subtle);
  border: 1px solid var(--line);
  padding: 14px 18px;
  font-size: 12.5px;
  margin: 14px 0;
  line-height: 1.9;
}
.method b {
  font-weight: 700;
  color: var(--ink-muted);
  font-size: 12px;
}
@media (max-width: 600px) {
  .method {
    grid-template-columns: 1fr;
  }
  .method b {
    margin-bottom: -4px;
  }
}

/* ---- 類型カード(良い型/悪い型の対比) ---- */
.typecards {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
  margin: 18px 0;
}
@media (max-width: 760px) {
  .typecards {
    grid-template-columns: 1fr;
  }
}
.tc {
  border: 1px solid var(--line);
  padding: 16px 18px;
}
.tc .h {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: .08em;
  margin-bottom: 6px;
}
.tc.good .h {
  color: var(--brand-deep);
}
.tc.bad .h {
  color: var(--danger);
}
.tc h4 {
  margin: 0 0 8px;
  font-size: 15.5px;
  line-height: 1.55;
}
.tc p {
  font-size: 12.5px;
  color: var(--ink-muted);
  margin: 0 0 8px;
  line-height: 1.75;
}
.tc .kv {
  display: flex;
  gap: 14px;
  flex-wrap: wrap;
  font-size: 12px;
  border-top: 1px dashed var(--line);
  padding-top: 8px;
  margin-top: 8px;
}
.tc .kv span b {
  font-family: var(--font-num);
  font-size: 14px;
}

/* ---- アクション(連番リスト・担当チップつき) ---- */
.actions {
  counter-reset: act;
  border: 1px solid var(--line);
}
.act {
  display: flex;
  gap: 16px;
  padding: 14px 18px;
  border-bottom: 1px solid var(--line);
  align-items: baseline;
}
.act:last-child {
  border-bottom: none;
}
.act::before {
  counter-increment: act;
  content: counter(act, decimal-leading-zero);
  font-family: var(--font-num);
  font-weight: 700;
  color: var(--brand-deep);
  font-size: 15px;
}
.act .who {
  font-size: 11px;
  font-weight: 700;
  color: var(--brand-deep);
  background: var(--brand-soft);
  border-radius: 4px;
  padding: 1px 8px;
  white-space: nowrap;
}
.act .body {
  flex: 1;
  font-size: 13.5px;
}
.act .body small {
  display: block;
  color: var(--ink-muted);
  font-size: 12px;
  margin-top: 2px;
}

/* ---- 原則・規律の連番ボックス ---- */
.rules {
  counter-reset: r;
  border: 1px solid var(--line);
}
.rule {
  display: flex;
  gap: 15px;
  padding: 13px 18px;
  border-bottom: 1px solid var(--line);
  align-items: baseline;
}
.rule:last-child {
  border-bottom: none;
}
.rule::before {
  counter-increment: r;
  content: counter(r);
  font-family: var(--font-num);
  font-weight: 700;
  color: var(--brand-deep);
  font-size: 15px;
  min-width: 1em;
  text-align: center;
}
.rule .b {
  flex: 1;
  font-size: 13.5px;
}
.rule .b small {
  display: block;
  color: var(--ink-muted);
  font-size: 12.5px;
  margin-top: 2px;
  line-height: 1.8;
}

/* ---- 現場に伝える言葉 / やってはいけないこと(手順書用) ---- */
.say {
  background: var(--brand-soft);
  border-left: 3px solid var(--brand);
  padding: 10px 14px;
  font-size: 13px;
  margin: 10px 0;
  line-height: 1.9;
}
.say b {
  display: block;
  font-size: 11px;
  letter-spacing: .06em;
  color: var(--brand-deep);
  margin-bottom: 2px;
}
.guard {
  background: #fdf6e3;
  border: 1px solid #e6c96a;
  padding: 9px 14px;
  font-size: 12.5px;
  margin: 10px 0;
  line-height: 1.85;
}
.guard b {
  color: #8a6d1a;
  font-size: 11px;
  letter-spacing: .06em;
  display: block;
  margin-bottom: 2px;
}

/* ---- 小型KPI帯(施策カードの頭に置く数字) ---- */
.kpi {
  display: flex;
  gap: 10px 22px;
  flex-wrap: wrap;
  background: var(--subtle);
  border: 1px solid var(--line);
  padding: 10px 16px;
  margin: 8px 0 12px;
  font-size: 12.5px;
}
.kpi .item b {
  font-family: var(--font-num);
  font-size: 16px;
  font-weight: 700;
}
.kpi .item span {
  color: var(--ink-muted);
  font-size: 11.5px;
  display: block;
}

/* ---- タグ(pill) — 意味は文書内で固定して使う ---- */
.pill {
  display: inline-block;
  font-size: 11px;
  font-weight: 700;
  padding: 1px 8px;
  border-radius: 999px;
  margin: 1px 2px 1px 0;
  white-space: nowrap;
}
.pill.bad {
  background: var(--danger-soft);
  color: var(--danger);
}
.pill.info {
  background: var(--brand-soft);
  color: var(--brand-deep);
}
.pill.warn {
  background: #fdf6e3;
  color: #8a6d1a;
  border: 1px solid #e6c96a;
}
.pill.plain {
  background: var(--subtle);
  color: var(--ink-muted);
  border: 1px solid var(--line);
}

/* ---- ホバーツールチップ(チャートのdata-tip用・JSとセット) ---- */
#tip {
  position: fixed;
  z-index: 50;
  pointer-events: none;
  background: var(--ink);
  color: #fff;
  font-size: 12px;
  font-family: var(--font-num);
  padding: 5px 10px;
  border-radius: 5px;
  opacity: 0;
  transition: opacity 80ms;
  max-width: 300px;
  line-height: 1.5;
}

/* ---- フッター ---- */
footer {
  margin-top: 72px;
  padding-top: 16px;
  border-top: 1px solid var(--line);
  font-size: 11.5px;
  color: var(--ink-muted);
}

@media (prefers-reduced-motion: reduce) {
  * {
    transition: none !important;
  }
}
`;
