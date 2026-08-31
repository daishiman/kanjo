# モバイル財務可視化と認知負荷の改善 — 実装要件

- Feature: `feat-mobile-financial-visualization`
- Package: `feature-package/feat-mobile-financial-visualization`
- Handoff target: `task-graph`
- Snapshot: `sha256:53dcebcef2335c141bfddff53841f5c6548b9f0acae944878435a1e7137bf275`
- System plan: `sha256:e4745a1c30c978feee27da5d14e3bcd1bd0dfbbca3f55483b63524009796ceda`
- Readiness: **PASS**（missing sections 0）

## 目的

外出先や片手操作のスマートフォンでも、財務グラフ・KPI・高密度表が消えず、会計やグラフに不慣れな利用者が「何が変わったか」「どこを確認するか」を短時間で判断できるようにする。画面幅やcanvas操作の可否にかかわらず、同じ集計値から同じ財務上の結論へ到達できる表示契約を共通化する。

## 実装要件

### REQ-MOBFIN-001 狭幅でも財務figureを失わない

360px・375px・390pxで全対象figureを表示し、canvasと表示containerの0寸法を0件にする。

- 担当 task: `SYS-MOBFIN-P01`、`SYS-MOBFIN-P04`、`SYS-MOBFIN-P05`、`SYS-MOBFIN-P06`、`SYS-MOBFIN-P07`

### REQ-MOBFIN-002 canvasに依存しない意味同等表現

各figureに見出し、結論、期間、単位、主要series、次の行動、同一view-model由来のsemantic tableを持たせる。

- 担当 task: `SYS-MOBFIN-P02`、`SYS-MOBFIN-P04`、`SYS-MOBFIN-P05`、`SYS-MOBFIN-P07`、`SYS-MOBFIN-P08`

### REQ-MOBFIN-003 意味を保つresponsive表現

tick間引き、凡例再配置、高さ調整、段階的開示を用いても、主要series・符号・期間・単位・比較基準を変えない。

- 担当 task: `SYS-MOBFIN-P02`、`SYS-MOBFIN-P05`、`SYS-MOBFIN-P08`

### REQ-MOBFIN-004 高密度表と横overflowを局所化

document全体の横あふれを0件にし、高密度表は見出し文脈とedge affordanceを保つ局所scrollまたは意味単位カードに限定する。

- 担当 task: `SYS-MOBFIN-P04`、`SYS-MOBFIN-P05`、`SYS-MOBFIN-P07`、`SYS-MOBFIN-P09`

### REQ-MOBFIN-005 片手操作とsafe-area

coarse pointerの主要操作を44×44 CSS px以上とし、safe-areaと固定tabbarで本文最終行・主操作・補助表示を隠さない。

- 担当 task: `SYS-MOBFIN-P03`、`SYS-MOBFIN-P05`、`SYS-MOBFIN-P07`、`SYS-MOBFIN-P09`

### REQ-MOBFIN-006 拡大・keyboard・非色依存

320 CSS px reflow、200%相当、keyboard、focus-visible、screen reader、reduced motionで意味情報と操作を失わず、色だけで状態を伝えない。

- 担当 task: `SYS-MOBFIN-P03`、`SYS-MOBFIN-P04`、`SYS-MOBFIN-P05`、`SYS-MOBFIN-P09`

### REQ-MOBFIN-007 単一view-modelと既存契約維持

chart・要約・表を同じ派生view-modelから生成し、会計値を二重計算せず、route・API・認証・保存データの契約を変更しない。

- 担当 task: `SYS-MOBFIN-P02`、`SYS-MOBFIN-P05`、`SYS-MOBFIN-P08`、`SYS-MOBFIN-P10`

### REQ-MOBFIN-008 匿名fixtureによる再現可能な品質証跡

unit、React DOM contract、typecheck、build、desktop/mobile実Chrome、200%相当の検証を匿名fixtureでPASSさせ、再実行可能な証跡と手順を残す。

- 担当 task: `SYS-MOBFIN-P04`、`SYS-MOBFIN-P06`、`SYS-MOBFIN-P07`、`SYS-MOBFIN-P09`、`SYS-MOBFIN-P10`、`SYS-MOBFIN-P11`、`SYS-MOBFIN-P12`、`SYS-MOBFIN-P13`

## 非機能要件

- 既存 Chart.js 4 / react-chartjs-2 を維持し、外部chart/UI runtimeを追加しない。
- WCAG 2.2 AA相当、320 CSS px reflow、200% zoom、keyboard、focus-visible、非色依存を満たす。
- API、会計計算、保存データ、認証、インフラの契約を変更しない。
- 実データ、口座明細、実金額、local secretをコード・fixture・証跡・画像へ含めない。
- chartとsemantic表の値を単一view-modelから生成し、resize後もseriesを重複させない。

## 受入と証跡

- P05が共通実装、P06が自動検証、P07が意味同等性と操作性の受入、P09がa11y/responsive、P10が最終レビュー、P11が匿名証跡、P12がlocalhost手順、P13が非deploy close-outを担う。
- 全8要件は1件以上のconfirmed system taskとsystem-spec/feature/architecture lineageに追跡できる。
- commit、push、PR作成、本番deployはこのhandoffのスコープ外。

## Readiness

C11 graph snapshot、C02保存状態、system-dev-planner validatorは同一source/plan digestでPASS。featureと13 taskはconfirmed / pass / complete、missing sectionsは0。13 task文書はplanでgraphのcanonical `file_path`へ登録済みであり、requirementsは実装codeを生成していない。
