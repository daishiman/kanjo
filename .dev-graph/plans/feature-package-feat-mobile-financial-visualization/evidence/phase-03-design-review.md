# P03 モバイル UX・アクセシビリティ独立デザインレビュー

## 現行判定

- 最終判定: **PASS**
- 判定理由: P02 改訂版で初回 `P03-F01`〜`P03-F04` がすべて解消され、現行 finding は `CRITICAL=0 / HIGH=0 / MEDIUM=0 / LOW=0`。
- reviewed P02 digest: `85e5b6c3c9ac09ab8fb17981b41844abbb29e212714b619d36078bd48208ff13`
- P04 entry gate: **OPEN**
- 履歴方針: 以下の初回 FAIL と finding は削除せず、再評価の入力・解消根拠として保持する。

## 初回レビュー履歴

- 初回判定: **FAIL**
- 初回判定理由: `HIGH` finding が 2 件あったため、P04 entry gate を閉じた。
- reviewer: `/root/mobile_implementation/mobile_design_review`
- reviewer 分離: P02 producer とは別の agent context でレビューした。本 reviewer は P02、architecture、spec、実装コードを変更していない。
- review date: 2026-08-30 (Asia/Tokyo)
- initial reviewed P02 digest: `648bcbc6ed582b9c1c8df3e9c3483a1aa11e9e87f0414cb609724b554ac9c864`

## 入力と方法

次の正本を読み、P02 の記述だけで実装と検証を一意に導けるかを fail-closed で評価した。

- `tasks/feat-mobile-financial-visualization/SYS-MOBFIN-P03.md`
- `specs/mobile-financial-visualization.md`
- `architecture/arch-mobile-financial-experience.md`
- `architecture/arch-mobile-financial-frontend.md`
- `evidence/phase-01-figure-inventory.md`
- `evidence/phase-02-figure-contract.md`
- Apple Human Interface Guidelines: Accessibility / Buttons
- W3C WCAG 2.2, SC 1.4.10 Reflow / Understanding Reflow
- Chart.js: Responsive Charts

設計判断は、分析画面の中心対象を「期間内の財務変化」、最頻シナリオを「結論を読む → 異常系列を特定 → 必要時だけ正確な値を開く」と固定して評価した。見た目の好みではなく、情報同等性、操作の直接性・即応性・予測可能性、認知負荷、支援技術、実測可能性を判定軸にした。

## 自動確認

```text
rg -n "44|safe-area|focus-visible|200%|semantic|non-zero|overflow" \
  .dev-graph/plans/feature-package-feat-mobile-financial-visualization/evidence/phase-02-figure-contract.md

result: exit 0
```

キーワードの存在は確認できた。ただし `safe-area` は readiness の自己宣言にだけ現れ、機械検査節に判定式がない。キーワード存在を契約充足とは扱わない。

## Finding

| ID | severity | 観点 | 根拠 | 対象決定 |
|---|---|---|---|---|
| P03-F01 | **HIGH** | WCAG 2.2 Reflow | 仕様 NFR は `320 CSS px reflow` を要求する。W3C SC 1.4.10 も縦スクロールコンテンツを幅 320 CSS px 相当で情報・機能欠落なく提示する条件を定め、200% text resize とは別条件である。一方 P02 は 360/375/390px と「layout viewport 375 相当の 200%」だけを定義し、320px の layout・geometry・七要素検査を欠く。 | P02 へ差し戻す。responsive table と機械検査へ 320 CSS px を追加し、document overflow 0、七要素保持、非例外領域の二方向 scroll 0 を明記する。高密度 data table の局所 scroll 例外は accessible name / keyboard / edge affordance を同条件で検査する。 |
| P03-F02 | **HIGH** | safe-area / focus not obscured | Spec FR-005 は本文最終行、主操作、popover、tooltip 代替を safe-area と固定 tabbar で隠さないことを要求する。P02 は readiness で `safe-area` を「DOM/Chrome assertion へ一意に写像」と宣言するが、機械検査節には遮蔽判定がない。既存 CSS の safe-area padding を「維持する」だけでは、popover、展開後 details、keyboard focus の実際の bounding box が固定 tabbar と重ならないことを証明できない。 | P02 へ差し戻す。通常 viewport と縮小 `visualViewport` の双方で、本文最終要素・主操作・popover 最終項目・Tab 移動先の rect が `tabbar top` および `safe-area-inset-bottom` を含む可視領域内にある幾何 assertion を定義する。focus が隠れた場合は FAIL とする。 |
| P03-F03 | MEDIUM | Apple 的な即応性・予測可能性 | P02 は 44px と focus-visible を定義するが、新規 interaction である `<details>` summary と `action` の pressed feedback、展開中状態、同じ見た目から同じ結果へ至る規則を明示していない。Apple HIG は十分な hit region に加え custom control の press state を求める。 | P02 または P04 test contract に、押下開始時の即時 feedback、`aria-expanded`、同種 action の一貫した結果、touch では hover 非依存、reduced-motion 時も状態が残ることを追加する。 |
| P03-F04 | MEDIUM | screen reader / canvas fallback | P02 は canvas を補助表現とし semantic table を同一 model から生成する点は良いが、canvas と companion の重複・無意味な読み上げを避ける accessibility tree 契約がない。 | `figure` の accessible name、summary/table の関連付けに加え、canvas を説明対象にするか `aria-hidden` にするかを一意に決め、主要 screen reader で七要素を重複なく読める DOM test を追加する。 |

## 観点別評価

| 観点 | 評価 | 根拠 |
|---|---|---|
| 業務構造・認知負荷 | PASS | 「結論 / 期間・単位 / 次の行動 → chart / series → 正確な値」の段階的開示は、短時間の分析シナリオと一致する。chart と table の役割も「傾向把握」と「正確な照合」に分離されている。 |
| Apple: 直接性 | PASS | chart から別設定画面へ迂回させず、同一 figure 内で要約・series・正確な値へ到達できる。次の確認先も `action` で対象に近接する。 |
| Apple: 即応性 | CONDITIONAL | canvas failure 時も summary/table を残す設計は良いが、P03-F03 の pressed/expanded feedback 契約が不足する。 |
| Apple: 予測可能性・空間的一貫性 | CONDITIONAL | 共通 `FinancialFigure` は一貫性を高めるが、action/details の状態規則と safe-area 遮蔽検査が未確定。 |
| Apple: 可逆性 | PASS | 正確な値の `<details>` は開閉可能で、書込・不可逆操作を追加しない。canvas failure fallback も利用者を行き止まりにしない。 |
| 七要素 | PASS | heading、summary、period、unit、series、action、semantic table を data attribute と同一 view-model へ写像している。 |
| Chart.js responsive contract | PASS | dedicated relative parent、正値の明示高さ、`responsive: true`、`maintainAspectRatio: false` は Chart.js 公式 responsive contract と整合する。`min-width: 0` も grid/flex 縮小を補う。 |
| non-zero geometry | PASS | figure/chart host/canvas の bounding box を実 Chrome で測り、検査不能を成功扱いしない契約がある。 |
| document overflow / local scroll | PASS | document 横 overflow 0、局所 scroll の allowlist、region name、keyboard 到達、edge affordance を定義している。320px 条件の欠落は P03-F01 として別途 FAIL 要因。 |
| 44px touch target | PASS | coarse pointer の summary/button/link/select を 44 CSS px 以上で実測する契約がある。 |
| focus / keyboard | CONDITIONAL | `focus-visible` と keyboard details は定義済みだが、固定 tabbar / popover / safe-area による focus obscuring の実測がない。P03-F02。 |
| 非色依存 | PASS | legend は文言付き list、Matrix の増減は色に加えて語と符号を使う。期間・単位・比較基準も DOM text で保持する。 |
| safe-area | **FAIL** | P03-F02。readiness 宣言に対応する一意な検査がない。 |
| 200% zoom | PASS | deviceScaleFactor で代替せず、狭い layout viewport / zoom 条件で情報存在と geometry を再検査する。320 CSS px Reflow は別条件として P03-F01。 |
| reduced motion | PASS | chart animation と UI transition を停止し、DOM の意味を不変とする。 |
| privacy | PASS | geometry と DOM 存在だけを保存し、匿名 fixture を使い財務値をログへ出さない。 |

## 装飾除去・情報設計テスト

- 色、カード、影、角丸を除いても `結論 → 文脈 → chart → 正確な値` の DOM 順で主役と詳細が判別できるため、構造は装飾へ依存しない。
- 画面目的は「期間内の財務変化と次の確認先を把握する」と 30 秒以内に説明できる。
- 主作業領域は figure 1つであり、chart と table は競合する二主役ではなく、傾向把握と照合の主従関係を持つ。
- loading / empty / error / ready / canvas failure は通常状態と同じ意味密度で設計されている。

## 公式根拠

- W3C WCAG 2.2 SC 1.4.10 Reflow: <https://www.w3.org/TR/WCAG22/#reflow>
- W3C Understanding Reflow: <https://www.w3.org/WAI/WCAG22/Understanding/reflow.html>
- Apple HIG Accessibility: <https://developer.apple.com/design/human-interface-guidelines/accessibility>
- Apple HIG Buttons: <https://developer.apple.com/design/human-interface-guidelines/buttons>
- Chart.js Responsive Charts: <https://www.chartjs.org/docs/latest/configuration/responsive.html>

## 初回 gate decision（履歴）

`CRITICAL=0 / HIGH=2 / MEDIUM=2 / LOW=0`。

初回 P03 は **FAIL** とし、P04 を閉じた。P02 producer が P03-F01〜F04 を設計契約へ反映し、P02 digest を更新したため、以下の独立再評価を実施した。

## 改訂 P02 の独立再評価

- re-review date: 2026-08-30 (Asia/Tokyo)
- reviewer: `/root/mobile_implementation/mobile_design_review`（P02 producer と別 context）
- reviewed P02 digest: `85e5b6c3c9ac09ab8fb17981b41844abbb29e212714b619d36078bd48208ff13`
- 自動確認: `rg -n "44|safe-area|focus-visible|200%|semantic|non-zero|overflow|320|pressed|expanded|screen reader|tabbarRect|visualViewport" evidence/phase-02-figure-contract.md` → exit 0

### 初回 finding の解消確認

| ID | 初回 severity | 改訂内容 | 再評価 |
|---|---|---|---|
| P03-F01 | HIGH | responsive contract に 320 CSS px を独立した WCAG 2.2 Reflow 下限として追加。七要素、正寸法、document overflow 0、操作欠落 0、accessible local-scroll 例外を同 viewport で再検査する。200% text resize と Reflow を別条件として明記した。 | **RESOLVED** |
| P03-F02 | HIGH | 最終本文・主操作を `scrollIntoView()` した後の `targetRect.bottom <= tabbarRect.top`、main bottom padding、全 focus target の header/tabbar 間到達を矩形で判定。popover/tooltip 代替も `visualViewport` と `tabbarRect.top` 内に収まることを縮小 viewport で検査する。 | **RESOLVED** |
| P03-F03 | MEDIUM | `<details>` summary に 44px、focus-visible、押下開始から90ms以内の pressed feedback、native `open` と accessibility tree が一致する expanded state、同形同結果、touch の hover 非依存、reduced-motion 後の意味保持を定義した。 | **RESOLVED** |
| P03-F04 | MEDIUM | canvas は図の目的を表す短い accessible name に限定し、正確な値の読み上げ正本を heading/summary と関連付けた semantic table とした。canvas name へ全値を列挙せず、DOM test で重複を防ぐ。 | **RESOLVED** |

### 再評価の観点

| 観点 | 最終評価 | 根拠 |
|---|---|---|
| Apple: 直接性・即応性・予測可能性・可逆性 | PASS | 同一 figure 内で結論から正確な値へ到達でき、押下開始90ms以内の feedback、同形同結果、展開状態の一致、可逆な details 開閉が契約化された。 |
| WCAG 2.2 Reflow / 200% zoom | PASS | 320 CSS px Reflow と 200%文字拡大を分離し、両条件で情報欠落・document overflow・geometry・focus を再検査する。 |
| focus / keyboard / safe-area | PASS | focus-visible に加え、固定 header/tabbar、safe-area、縮小 visual viewport、popover 最終項目を矩形で fail-closed 判定できる。 |
| 非色依存 / semantic companion | PASS | 文言付き legend、符号・語による増減、短い canvas name、同一 view-model の semantic table で視覚・支援技術の意味 parity を維持する。 |
| Chart.js responsive / non-zero | PASS | dedicated relative parent、明示高さ、`responsive: true`、`maintainAspectRatio: false`、figure/host/canvas の実 Chrome rect 測定を維持する。 |
| 七要素 / overflow / 44px | PASS | heading、summary、period、unit、series、action、table を 320〜1600pxで検査し、local-scroll allowlist と coarse-pointer target を実測する。 |
| 認知負荷・情報構造 | PASS | 結論・文脈・行動を第一階層、傾向 chart を第二階層、正確な値を第三階層へ置く主従が保たれ、装飾を除いても読解順が崩れない。 |
| reduced motion / privacy | PASS | 動きを止めても DOM の意味を保持し、匿名 fixture の geometry/DOM だけを保存して財務値を記録しない。 |

## 最終 gate decision

現行 finding は `CRITICAL=0 / HIGH=0 / MEDIUM=0 / LOW=0`。

改訂 P02 は、P03 の全観点を根拠付きで満たす。P03 の最終判定を **PASS** とし、P04 entry gate を開く。実装・test design は digest `85e5b6c3c9ac09ab8fb17981b41844abbb29e212714b619d36078bd48208ff13` の契約を入力とする。
