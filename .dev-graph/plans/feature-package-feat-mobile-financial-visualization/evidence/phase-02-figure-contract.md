# P02 FinancialFigure 契約

- 結果: PASS
- 入力: P01 inventory、`arch-mobile-financial-experience`、`arch-mobile-financial-frontend`
- 採用案: 既存 Chart.js と route の会計 adapter を維持し、pure view-model と共通 `FinancialFigure` で semantic companion / responsive host だけを統一する。
- 却下案: chart library 交換（bundle と既存操作を壊す）、モバイルで chart を非表示（意味同等性違反）、各 page で semantic table を手書き（値の二重計算）。

## 利用場面と情報設計

- 場面: 利用者が外出先で片手操作し、375px 前後の画面で1 figureずつ、変化・異常・次の確認先を短時間に判断する。
- 中心対象: 期間内の財務変化。
- 最頻動作: 結論を読む → 異常な series を特定 → 必要な場合だけ正確な値を開く。
- 絶対に避けるミス: 符号、期間、単位、比較基準の取り違え。
- 成功時の感情: canvas を細かく触らなくても「どこを確認すればよいか分かった」。

第一階層は `結論 / 期間・単位 / 次の行動`、第二階層は `chart / series`、第三階層は `<details>` 内の正確な値とする。対象間の時間・量の関係を一目で探すため chart を保持し、正確な照合には table が最速なので semantic table を従属させる。chart だけ、table だけの単一形式は、それぞれ傾向把握または短時間判断が遅くなるため不採用。

## component / data flow

```text
existing API response
  -> route-specific pure adapter (会計文脈・series表現を保持)
  -> FinancialFigureModel (値の単一正本)
       |- visible summary / period / unit / action
       |- visible series labels
       |- Chart.js data
       `- semantic rows
  -> FinancialFigure
       |- figcaption + summary/meta
       |- responsive chart host (canvasは補助表現)
       `- details > labelled local scroll > table
```

## view-model fields

| field | contract |
|---|---|
| `id` | route 内で一意。heading/details の関連付けに使用 |
| `title` | 可視見出し。業務語で1文以内 |
| `summary` | 符号・比較基準を含む結論。数値を再計算せず入力 series から pure helper で導出または caller が明示 |
| `period` | `2026年1月〜6月` 等。label 群から一意に作る |
| `unit` | `円` / `%` / `件` / `単位なし`。table header と meta で可視化 |
| `series[]` | `key / label / values / kind?`。chart と表が同じ配列参照を使う |
| `rows[]` | `label / values[]`。`series` との長さ一致を pure builder が保証 |
| `action` | 次に確認する page/表/対象を直接表現。見て終わりにしない |
| `tableLabel` | local scroll region と table caption の accessible name |

## container contract

- `.financial-figure` は `container-type: inline-size; min-width: 0`。
- `.financial-figure__chart` は `position: relative; min-width: 0; width: 100%; height: var(--financial-chart-height)`。
- Chart.js は `responsive: true; maintainAspectRatio: false`。親の正値寸法を正本にする。
- SP は高さを増やして tick/legend の重なりを避ける。canvas や figure を `display:none` にしない。
- legend は折返し可能な文言付き list とし、色だけで series を識別させない。
- `<details>` の summary は44px以上、focus-visible、押下開始から90ms以内のpressed feedback、`aria-expanded`相当の開閉状態を持つ。同じ見た目のsummaryは常に同じ場所で正確な値を開閉する。閉じても結論・期間・単位・series・行動は残る。
- canvas はfigureの可視図として短い目的だけをaccessible nameにし、値の列挙はしない。正確な値の読み上げ正本はheading/summaryに関連付けたsemantic tableとし、canvasと表で同じ値を二重に読み上げない。
- `prefers-reduced-motion: reduce` では chart animation と UI transition を停止し、DOM の意味は不変。

## responsive / scroll contract

| width | contract |
|---:|---|
| 320 | WCAG 2.2 Reflowの下限。document横overflow 0、七要素・正寸法・操作の欠落0。accessibleな局所表だけ横scroll可 |
| 360/375/390 | 1列、summary を先頭、chart 高さ正値、legend は縦方向、table は figure 内だけ横 scroll |
| 768 | summary/meta と series の余白を拡大し、chart/table は同一 container 内 |
| 1280/1600 | 既存 content max-width を維持。figure を画面幅なりに伸ばさない |
| 200%相当 | 640 CSS pxの内容を320 CSS px相当へreflowした条件でも同じ契約。文字拡大とReflowを別々に検査し、情報を非表示にしない |

document の横 overflow は常に 0。例外は `.financial-figure__table-scroll`, `.scroll-x`, `.heatmap-scroll` のみで、`role=region`、accessible name、`tabIndex=0`、edge affordance を持つ。Matrix/Statements は同じ列を突合する作業なので表を保持し、無理なカード化をしない。

## route adapters と残す差異

- Overview: 4 series と防衛ラインの比較基準。
- Household: 収入/支出と選択月の文脈。
- Subscriptions: 多 series、tooltip の月合計、上位確認先。
- Trends: scope、事業/家計、前半/後半、円/%二軸を route で明示。
- Matrix: mover の絶対増減順と赤=増加/緑=減少の語による説明。
- Statements: P/L、CF、B/S の会計等式と分岐。
- ReportChart: kind 固有の Chart.js dataset と available/source-missing 状態。

共通化するのは値の入れ物・semantic companion・responsive/a11y surface だけで、会計 adapter と chart kind は route に残す。

## 状態と回復

- loading / empty / API error は既存 `PageState` を維持。
- figure unavailable は理由と次の操作を表示し、空白にしない。
- canvas が未対応・0寸法でも summary/series/table を DOM に残す。
- resize を重ねても model/series を追加せず、純粋導出で再生成する。

## 機械検査への写像

- 七要素: `[data-financial-figure]` 内の heading、`data-financial-summary`、`data-financial-period`、`data-financial-unit`、series list、`data-financial-action`、table。
- 0寸法: figure/chart host/canvas の `getBoundingClientRect()`。
- overflow: `document.documentElement.scrollWidth <= clientWidth`、許可された local scroll のみ `scrollWidth > clientWidth` 可。
- 44px: coarse pointer 時の `summary`, button, link, select を実測。
- focus: `:focus-visible` outline を static CSS + keyboard 操作で確認。
- pressed/expanded: pointer down直後から90ms以内にborder/surface/scaleのいずれかが変わり、layoutを動かさないこと、開閉状態と`open`/accessibility treeが一致することを検査。
- screen reader: figure name、短いcanvas名、summary、table caption/headersをDOM testし、canvas accessible nameへ表の全値を重複列挙しない。
- 320/200%: deviceScaleFactorだけで代替せず320 CSS px相当のlayout viewport / zoom条件で七要素、正寸法、document overflow 0、局所scroll、focus到達を再検査。
- safe-area/fixed tabbar: 最終本文・主操作を`scrollIntoView()`した後の`targetRect.bottom <= tabbarRect.top`、計算後main padding-bottomがtabbar高さ以上、全focus targetがheader下端とtabbar上端の間へ到達可能であることを幾何検査。
- popover/tooltip代替: 開いたsurfaceと最終項目が`visualViewport`の左右・上端および`tabbarRect.top`内にあり、縮小`visualViewport`でも遮蔽0件であることを検査。

## rollback 境界

新規 `FinancialFigure.tsx` / `financial-figure-model.ts`、owned page の adapter、FinancialCharts/ReportChart の接続、関連 CSS と test/script だけを戻せる。API、会計 calculation、auth、database、navigation、Cloudflare は変更しない。

## readiness

七要素、non-zero、overflow、44px、focus-visible、pressed/expanded、screen reader重複防止、320px Reflow、safe-area/tabbar/popover/focus遮蔽、reduced-motion、200% zoom を DOM/Chrome assertion へ一意に写像できる。P03 独立 review の再評価入力として確定する。
