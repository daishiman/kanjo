# FINAL-UI デザインシステム共通化 — 実装要件

- Feature: `feat-design-system-foundation`
- Package: `feature-package/feat-design-system-foundation`
- Handoff target: `task-graph`
- Snapshot: `sha256:7bfb3f2c725825141b26ab254b61ca8a7ce0ec28fb006d61a62f15f3f0b21e1b`
- System plan: `sha256:d9e77bf715718b82970a4664a1fce41d7ce136543f789e442bf0010338dc3887`
- Readiness: **PASS**（missing sections 0、3 gate 同一 snapshot）

契約正本は `specs/spec-design-system-foundation.md`。本書は要件と system task の対応だけを持ち、実装コードや task spec を生成しない。

## 目的

正式採用された FINAL-UI (Focus Ledger, design/FINAL-UI の 20 画面) を見た目の正本とし、色・文字・余白・角丸・影・動き・部品・共通シェル・図の見た目を単一の共通定義へ集約する。今後つくる画面・図・成果物が個別に色や寸法を決めなくても、共通定義を参照するだけで自動的に同じ見た目になり、ずれた値を持ち込めば機械的に検出される状態にする。

## 到達状態

design-tokens.ts を唯一の正本として styles.css と charts.ts の値がそこから導出され、20 ルートが共通シェルと共通ボタンの下で描画され、直書き色・写しのずれ・コントラスト未達が pnpm lint とテストで機械的に検出され、新しい画面や図をつくるときの参照先が規約文書 1 つに定まっている状態。

## 実装要件

### REQ-DS-001 トークン正本の値一致

packages/core/src/design-tokens.ts に色・文字・余白・角丸・影・動き・寸法を定義し、DESIGN-SYSTEM.md の規定値 (10 色、サイドバー 220px、ヘッダー 64px、本文最大幅 1180px、角丸 8px、タップ領域 44px) と単体テストで全件一致させる。

- 根拠: FR-001 / S3 / AC-003
- 担当 task: `SYS-DSFOUND-P01`、`SYS-DSFOUND-P02`、`SYS-DSFOUND-P04`、`SYS-DSFOUND-P05`、`SYS-DSFOUND-P07`
- Source: `specs/spec-design-system-foundation.md`、`features/feat-design-system-foundation.md`

### REQ-DS-002 写しの導出と直書き色の検出

styles.css の :root と charts.ts の COLORS を design-tokens.ts から導出した写しにし、写しのずれと packages/web/src の 6 桁 hex 直書きを pnpm lint が exit 非 0 で検出する。チャートは収入=青系・支出=赤系・純収支=ティール線。

- 根拠: FR-002 / S1 / S2 / AC-001 / AC-002
- 担当 task: `SYS-DSFOUND-P04`、`SYS-DSFOUND-P05`、`SYS-DSFOUND-P07`、`SYS-DSFOUND-P08`
- Source: `specs/spec-design-system-foundation.md`、`features/feat-design-system-foundation.md`

### REQ-DS-003 共通シェルと共通ボタン

Layout (サイドバー・ヘッダー・フッター)・固定アクションバー・ページ骨格・ボタン (主/副/危険/テキスト) を共通部品にし、20 ルートすべてが共通シェルの下で描画されることを DOM テストで確認する。

- 根拠: FR-003 / S5 / AC-005
- 担当 task: `SYS-DSFOUND-P02`、`SYS-DSFOUND-P04`、`SYS-DSFOUND-P05`、`SYS-DSFOUND-P07`
- Source: `specs/spec-design-system-foundation.md`、`features/feat-design-system-foundation.md`

### REQ-DS-004 コントラストと境界色の役割分離

文字用トークンは背景・面の双方に 4.5:1 以上、部品の枠とチャート系列色は 3:1 以上をテストで検証する。装飾罫線 #D7E0E2 は対象外とし、入力欄・チェックボックスの枠が装飾罫線を参照しないことも同じテストで確かめる。チャート系列色を調整するか (dec-chart-series-contrast) は P02 で利用者の選択を記録し、未記録なら P05 に着手しない。

- 根拠: FR-004 / S4 / AC-004 / dec-border-color-roles
- 担当 task: `SYS-DSFOUND-P02`、`SYS-DSFOUND-P04`、`SYS-DSFOUND-P05`、`SYS-DSFOUND-P09`
- Source: `specs/spec-design-system-foundation.md`、`features/feat-design-system-foundation.md`

### REQ-DS-005 規約文書の単一参照先

色の役割 (塗り/文字)・タイポグラフィ・余白・シェル・ボタン・チャートの各節を持つ規約文書を docs 配下に 1 つ置き、README または AGENTS.md から参照する。

- 根拠: FR-005 / G4
- 担当 task: `SYS-DSFOUND-P01`、`SYS-DSFOUND-P10`、`SYS-DSFOUND-P12`
- Source: `specs/spec-design-system-foundation.md`、`features/feat-design-system-foundation.md`

### REQ-DS-006 既存品質の非退行と非機能制約

pnpm test / typecheck / lint と packages/web の check 系 (thead / mobile-layout / financial-figure / financial-routes / js-budget) を緑のまま保ち、外部ライブラリ・Web フォントを追加せず CSP を広げず、配信構成を変えない。

- 根拠: S6 / AC-006 / 非機能要件
- 担当 task: `SYS-DSFOUND-P06`、`SYS-DSFOUND-P09`、`SYS-DSFOUND-P11`、`SYS-DSFOUND-P13`
- Source: `specs/spec-design-system-foundation.md`、`features/feat-design-system-foundation.md`

## 着手前提

- `SYS-DSFOUND-P05` の着手前に、チャート系列色 (収入 #599AE9 / 支出 #EB9099) を 3:1 へ調整するか (`dec-chart-series-contrast`) を利用者が選び、`docs/design-system/architecture-decision.md` に記録する。推定のまま confirmed にしない。

## 実行グラフ

13 nodes、12 edges、1 root の直列依存。状態・資源・lineage は各 task frontmatter を正本とする。

| Task | 固有成果 | 依存 |
|---|---|---|
| SYS-DSFOUND-P01 | FINAL-UI 抽出値による要件ベースライン確定 | — |
| SYS-DSFOUND-P02 | トークン正本配置とワークストリーム設計の決定記録 | SYS-DSFOUND-P01 |
| SYS-DSFOUND-P03 | トークン設計の独立レビュー | SYS-DSFOUND-P02 |
| SYS-DSFOUND-P04 | トークン値・コントラスト・共通シェルの失敗テスト先行作成 | SYS-DSFOUND-P03 |
| SYS-DSFOUND-P05 | design-tokens.ts 正本の実装と styles.css / charts.ts / 共通部品への反映 | SYS-DSFOUND-P04 |
| SYS-DSFOUND-P06 | 全テスト・型検査・lint の実行記録 | SYS-DSFOUND-P05 |
| SYS-DSFOUND-P07 | S1-S6 受入検証 | SYS-DSFOUND-P06 |
| SYS-DSFOUND-P08 | COLOR_FALLBACKS と重複トークン値の除去 | SYS-DSFOUND-P07 |
| SYS-DSFOUND-P09 | アクセシビリティ・セキュリティ・パフォーマンスの保証確認 | SYS-DSFOUND-P08 |
| SYS-DSFOUND-P10 | 独立最終レビュー | SYS-DSFOUND-P09 |
| SYS-DSFOUND-P11 | 再現可能な証跡索引の作成 | SYS-DSFOUND-P10 |
| SYS-DSFOUND-P12 | デザインシステム規約文書と README / AGENTS.md 参照の同期 | SYS-DSFOUND-P11 |
| SYS-DSFOUND-P13 | 単一 PR での配信とクローズアウト | SYS-DSFOUND-P12 |

## Readiness

| Gate | 結果 |
|---|---|
| C11 validate-graph-schema | valid、violations 0 |
| C02 saved state | feature + 13 task が confirmed / pass / complete、registration expected 13 = applied 13 |
| validate-system-plan | pass、P01..P13、`sha256:d9e77bf715718b82970a4664a1fce41d7ce136543f789e442bf0010338dc3887` |

1 周目は task artifact md 13 件の未実体化で blocked となり、C02 `run-dev-graph-node` の dry-run → 本実行で解消した。
