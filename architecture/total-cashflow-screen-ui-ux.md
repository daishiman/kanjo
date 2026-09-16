---
graph_node_id: "arch-total-cashflow-screen-ui-ux"
artifact_kind: "architecture"
artifact_subtypes: ["frontend"]
title: "総収支画面 — 情報の優先順位と 3 ペイン判定作業"
project_id: "kanjo"
domain: "ui-ux"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: []
tags: ["total-cashflow-screen", "ui-ux"]
file_path: "architecture/total-cashflow-screen-ui-ux.md"
template_id: "architecture"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluator": "system-spec-harness:assign-system-spec-completeness-evaluator", "evidence_ref": "system-spec/completeness-findings.json", "evaluated_digest": "0533374f8a891a9c97862dfd8e1032d7a6f3031a9c35943fe6f05df77b35c089"}
source_lineage: {"origin_kind": "system-spec-harness", "source_plugin": "system-spec-harness", "source_path": "system-spec/ui-ux.md", "source_version": "0.1.14", "source_digest": "0533374f8a891a9c97862dfd8e1032d7a6f3031a9c35943fe6f05df77b35c089", "imported_at": "2026-09-15T14:50:54Z"}
created_at: "2026-09-15T14:50:54Z"
updated_at: "2026-09-15T14:50:54Z"
depends_on: ["spec-total-cashflow-screen"]
related_nodes: ["spec-total-cashflow-screen", "arch-total-cashflow-screen-frontend", "arch-total-cashflow-screen-backend", "arch-total-cashflow-screen-database", "arch-total-cashflow-screen-auth", "arch-total-cashflow-screen-security", "arch-total-cashflow-screen-infrastructure", "arch-total-cashflow-screen-maintenance-ops"]
resource_scope: ["packages/web/src/pages/analysis/TotalCashflow.tsx", "packages/web/src/components/Layout.tsx", "packages/web/src/components/Page.tsx", "packages/web/src/components/Button.tsx", "packages/core/src/design-tokens.ts", "design/FINAL-UI/images/05-total-cashflow.png", "design/FINAL-UI/spec/AUDIT.md"]
purpose: null
goal: null
scope_in: []
scope_out: []
acceptance: []
architecture_refs: []
parent_feature: null
feature_package_id: null
phase_ref: null
classification_confidence: 1.0
classification_reason: "system-spec の ui-ux 章 (web 確定・他 platform 対象外) を領域別の architecture 制約として参照する。"
classification_candidates: [{"artifact_kind": "architecture", "confidence": 1.0, "candidate_path": "architecture/total-cashflow-screen-ui-ux.md"}]
tracker_binding: "none"
beads_linkage: null
github_publication: {"mode": "local_only", "project_aliases": [], "labels": [], "milestone": null}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"policy": "manual", "status": "not_applicable", "source": null, "completed_at": null, "reconciled_at": null, "evidence_refs": []}
implementation_readiness: {"status": "complete", "missing_sections": [], "checked_at": "2026-09-15T14:50:54Z"}
serves_goals: ["G1", "G2", "G5"]
---

# Architecture overview

総収支画面 — 情報の優先順位と 3 ペイン判定作業。正本は `system-spec/ui-ux.md` (system-spec-harness 0.1.14) で、本書は dev-graph から参照する領域別の制約だけを持つ。仕様の入口は `specs/spec-total-cashflow-screen.md`。

## Context and drivers

- Business/technical context: 主たる接地根拠は qa-ui-ux-web-tc-observed-001。05-total-cashflow.png は見出し・5 タブ・セグメント・KPI 3 枚・チャート・3 ペイン判定作業・freee から除外した明細・完全一致候補 (自動検出)・進捗通知・下部固定バー・共通フッターで構成される。FUNCTION-MATRIX は必須を『1/2/3年比較、事業/家計/総合、freee除外理由、複数選択、一致候補、同一/別取引判定、復元、全選択/解除』、AUDIT.md は『重複判定ワークベンチへ再設計』とする。現行 TotalCashflow.tsx (805 行) は 9 列月次表・FreeeCoverageSection・要確認表を縦に積み、KPI・前期比・チャート・セグメント切替・3 ペイン・一致度・並列詳細・元に戻す・進捗通知が無い。共通ヘッダーは『防衛線』、フッターは『毎晩バックアップ(30日保持)』。
- Quality attribute priorities: G1・G2・G5 に資する。doctrine は Apple Human Interface Guidelines で、明瞭さと一貫性を、判定状態を色と文字の両方で示すこと、破壊的でない『集計から除外』にも取消の導線を同じ位置に出すこと、狭幅で 3 ペインを縦に積み詳細を選択時に開くことに反映した。設計知識は Information Design card (task 頻度 × 失敗コストで束に順位を付け、残す・落とす・加工するを決める)。
- Constraints: C2: トークン・チャート系列色・共通 Button・PageShell、WCAG 2.2 AA、色だけで判定状態を伝えない。 C4: 表示していないタブの API は呼ばない。

## Goals and non-goals

- Goals:
  - G1: 画像どおりの構成を共通シェルの上に組み、9 列月次表は『月次の内訳を表示』で閉じて残す (qa-total-cashflow-decision-001)。
  - G2: 3 ペイン判定作業と下部の選択バーで単票・一括の判定を行える。
  - G5: 一覧名・説明文・ヘッダー/フッター文言を事実と画像に揃え、サイドバーは現在地と照合バッジの確認だけにする (qa-total-cashflow-decision-010/011/016)。
- Non-goals:
  - サイドバーの構成と見た目の変更
  - 他タブの画面の作り直し
  - 画像の見本値・架空の口座名の再現

## System context and boundaries

- Users/external systems: 利用者 1 名 (SH1)。外部システムの追加は無い。
- Trust/deployment/data boundaries: 画面は GET /api/total-cashflow の結果を描くだけで、規則の計算は持たない (arch-total-cashflow-screen-frontend / backend が担う)。
- Context diagram: `system-spec/index.md` の章相互参照を参照する。

## Container and component view

| Container/Component | Responsibility | Interface | Data owner | Deployment unit |
|---|---|---|---|---|
| 見出し・セグメント・期間表示 | 問い『家計と事業を合わせた、本当の収支はいくらですか?』、総合/事業/家計、選択中期間と前年同期 | React コンポーネント | packages/web | Workers Assets の SPA |
| KPI 3 枚とチャート | 総収入/総支出/純収支と前年同期比 (額・率・符号・矢印)、月次の棒と純収支の折れ線 | React + Chart.js | packages/web | 同上 |
| 判定作業 3 ペイン | 左ナビ (件数付き 3 区分)、中央明細表 (フィルタ・検索・選択)、右詳細 (並列比較・一致度内訳・判定ボタン・直前の操作と元に戻す) | React コンポーネント | packages/web | 同上 |
| freee 除外一覧・自動一致の候補 | 理由区分バッジとメモ・集計へ戻す・一括で理由を設定、一致度と判定状態・同じ取引にする | React コンポーネント | packages/web | 同上 |
| 進捗通知と下部選択バー | 『N件中M件の判定が完了しました』と元に戻す、選択件数と一括操作 | React コンポーネント | packages/web | 同上 |

## Cross-cutting contracts

- Identity/access: 既存の認証済みシェル配下に置き、画面固有のアクセス制御を持たない。
- Errors/resilience: 前年同期が欠けるときは 0% と書かず『比較データなし』。送信中はボタンを無効にし、別のタブで新しい操作があって取り消せないときは理由と再読込の導線を出す。
- Observability/audit: N/A: 画面に実行時の信号を足さない。判定の記録は API 側の操作履歴が持つ。
- Configuration/secrets: N/A: 設定値・秘密情報を扱わない。
- Compatibility/versioning: 9 列月次表を検算根拠として残す。一覧名は『完全一致候補』から『自動一致の候補』へ改め、上位概念・画面・docs の語を揃える。

## Subtype architecture

- Frontend: 下記 architecture-frontend.md を合成
- Backend: N/A: 本章の関心外
- Infrastructure: N/A: 本章の関心外
- Data: N/A: 本章の関心外
- Security: N/A: 本章の関心外

### Frontend architecture

#### Rendering and application pattern

情報の優先順位 (qa-ui-ux-web-tc-inference-004): 1 位 KPI 3 枚と前年同期比を見出しの問いの直下、2 位 判定作業の左ナビの件数 (件数 0 の区分も 0 と出す)、3 位 チャート、4 位 freee 除外一覧と自動一致の一覧 (理由区分とメモを常に見せる)。9 列の月次表は『月次の内訳を表示』で閉じて置く。

#### Routes, screens and navigation

/analysis/total-cashflow の総収支タブ。サイドバーは支出分析 > 総収支 を現在地とし、照合の件数バッジが判定後に追随することを確認するだけで構成と見た目は変えない (qa-total-cashflow-decision-011)。共通ヘッダー/フッターの文言は画像に揃える (防衛ライン・毎朝バックアップ。cron は UTC 18 時 = 日本時間 3 時で『毎朝』と矛盾しない) (qa-total-cashflow-decision-010)。

#### Component and design-system boundaries

前年同期比は額と率を並べ符号と矢印と色で示す。表記は『前年同期』でハブの『前期間』と区別する (qa-total-cashflow-decision-006)。一致度は数値 % とバーに加え、右ペインで配点の内訳 (金額・日付・口座・摘要) を文字で出す (qa-total-cashflow-decision-007)。自動一致の組の一致度は 78〜100% をそのまま出す (qa-total-cashflow-decision-012)。判定状態は 未判定/同じ/別/除外 の文字バッジ。自動一致の候補の説明文は『日付と金額が一致して自動で寄せた取引です。摘要や口座の違いは一致度に出ます』。

#### State and data flow

下部選択バーは 1 件以上選択したときだけ出し、0 件で消す。操作後の通知『N件中M件の判定が完了しました』と『元に戻す』を同じ場所に出す。『元に戻す』はその画面を開いてから行った未取消の操作が残っている間は取消の後も出し続け、押すたびに 1 つ前の操作へ遡る。再読込や画面の移動の後は出さない (qa-total-cashflow-decision-013/017)。

#### Backend integration

確認文の意味を API の規則に合わせる。『同じ取引にする』は判定の記録だけで総額は動かない (qa-total-cashflow-decision-008)。『集計から除外』は対応する freee 取引を除外し、MF 明細が公私仕分けに従って事業/家計へ数え直されること、その freee 取引が唯一の候補だった要確認の明細も要確認から出て数えられることを確認文に出す (qa-total-cashflow-decision-009/014/015)。

#### Performance and observability

狭幅では 3 ペインを 左ナビ→明細表→詳細 の順に縦積みし、詳細は選択時に開く。横スクロールを出さない。

#### Frontend verification

DOM テストで見出し・5 タブ・セグメント・期間表示・KPI 3 枚・チャート・判定作業・freee 除外一覧・自動一致の候補・選択バーの描画、月次表の開閉、サイドバーの現在地と照合バッジを確かめる (O1・S1・S5)。

## Architecture decisions

| ADR | Decision | Alternatives | Trade-on rationale | Consequences |
|---|---|---|---|---|
| qa-total-cashflow-decision-001 | 9 列月次表を開閉で残し既定は閉じる | 削除 / 常時表示 | 検算根拠を落とさず画像の構成を保つ | 『月次の内訳を表示』の開閉を足す |
| qa-total-cashflow-decision-012 / 016 | 一致度は規則どおり 78〜100% を出し、一覧名を『自動一致の候補』に改める | 常に 100% / 画像の文言を残す | 表示される一致度と説明が矛盾しない | 画像の『完全一致候補』の文言から外れる |
| qa-total-cashflow-decision-013 / 017 | 元に戻すは 1 つ前へ遡り、その画面を開いている間だけ | 直前 1 回だけ / 上限なし / 当日だけ | 古い判定を誤って戻す危険が小さい | 再読込後は導線を出さない |
| qa-ui-ux-web-tc-inference-004 | 優先順位 1 位 KPI と前年同期比 2 位 左ナビ件数 3 位 チャート 4 位 除外一覧と自動一致一覧 | 差を付けない | 未判断が残ると総額が確定しない失敗コストを 2 位で常時示す | inference-003 を置き換える (アシスタント推定) |

## Delivery, migration and rollback

- Build/deploy topology: 既存の web SPA のビルドと Workers Assets 配信に載せる。
- Migration sequence: API の加算 → 画面ブロックの作り直し → 文言の差し替えと DOM テストの期待値更新を同じ変更で行う。
- Rollback trigger/procedure: DOM テストや check 系が落ちたら PR を差し戻し、配信済みなら直前のビルドへ戻す。

## Risks and verification

- Risk/assumption: 優先順位・説明文・409 時の文言はアシスタント推定 (qa-ui-ux-web-tc-inference-004)。適用文と doctrine に『前期比』と『前年同期比』の表記が混在する (completeness-findings low)。画面の見出しは『前年同期』を正とする。
- Architecture fitness test: 判定状態が文字バッジで示され色だけに頼らないこと、直書き色の lint が 0 件であること。
- Load/failure/security validation: check:mobile-layout で狭幅の横スクロールが無いこと、既存 test / typecheck / lint が緑 (S6)。
