---
graph_node_id: "spec-design-system-foundation"
artifact_kind: "specification"
artifact_subtypes: ["frontend"]
title: "FINAL-UI デザインシステム共通化 仕様"
project_id: "kanjo"
domain: "design-system"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: []
tags: ["design-system"]
file_path: "specs/spec-design-system-foundation.md"
template_id: "specification"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluator": "system-spec-harness:assign-system-spec-completeness-evaluator", "evidence_ref": "system-spec/completeness-findings.json", "evaluated_digest": "c648cbc5bb47312ecb597a6416cfc4755418de9d706ffd0eb28a23752f76cb3a"}
source_lineage: {"origin_kind": "system-spec-harness", "source_plugin": "system-spec-harness", "source_path": "system-spec/00-requirements-definition.md", "source_version": "0.1.14", "source_digest": "c648cbc5bb47312ecb597a6416cfc4755418de9d706ffd0eb28a23752f76cb3a", "imported_at": "2026-09-13T08:15:21Z"}
created_at: "2026-09-13T08:15:21Z"
updated_at: "2026-09-13T08:15:21Z"
depends_on: []
related_nodes: ["arch-design-system-ui-ux", "arch-design-system-frontend", "arch-design-system-backend", "arch-design-system-database", "arch-design-system-auth", "arch-design-system-security", "arch-design-system-infrastructure", "arch-design-system-maintenance-ops"]
resource_scope: ["design/FINAL-UI/spec/DESIGN-SYSTEM.md", "packages/core/src", "packages/web/src", "scripts", "docs"]
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
classification_reason: "system-spec の要件定義書 (U1-U9) を実装計画の入口として参照する単一の specification。API 変更が無いため api-contract overlay は合成しない。"
classification_candidates: [{"artifact_kind": "specification", "confidence": 1.0, "candidate_path": "specs/spec-design-system-foundation.md"}]
tracker_binding: "none"
beads_linkage: null
github_publication: {"mode": "local_only", "project_aliases": [], "labels": [], "milestone": null}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"policy": "manual", "status": "not_applicable", "source": null, "completed_at": null, "reconciled_at": null, "evidence_refs": []}
implementation_readiness: {"status": "complete", "missing_sections": [], "checked_at": "2026-09-13T08:15:21Z"}
serves_goals: ["G1", "G2", "G3", "G4", "G5"]
---

# FINAL-UI デザインシステム共通化 仕様

本書は `system-spec/00-requirements-definition.md` (承認 `appr-foundation-design-system-002`) を dev-graph の specification として参照する入口である。規範本文は system-spec 側が正本で、ここでは実装計画が必要とする節だけを要約し、領域別の制約は architecture ノード (arch-design-system-ui-ux, arch-design-system-frontend, arch-design-system-backend, arch-design-system-database, arch-design-system-auth, arch-design-system-security, arch-design-system-infrastructure, arch-design-system-maintenance-ops) に分ける。

## 目的と成功状態

正式採用された FINAL-UI (Focus Ledger, design/FINAL-UI の 20 画面) を見た目の正本とし、色・文字・余白・角丸・影・動き・部品・共通シェル・図の見た目を単一の共通定義へ集約する。今後つくる画面・図・成果物が個別に色や寸法を決めなくても、共通定義を参照するだけで自動的に同じ見た目になり、ずれた値を持ち込めば機械的に検出される状態にする。

成功状態:
- S1 (G1, G4): packages/web/src の .ts/.tsx/.css において、トークン定義とその生成物以外での hex/rgb/hsl/CSS Color 構文による色の直書きが 0 件であり、lint がこれを検査する。
- S2 (G3): charts.ts と全ての実描画consumerの系列色・軸・グリッド・文字色が全て design-tokens.ts 由来で、収入=青系・支出=赤系・純収支=ティール線になっている。
- S3 (G1): design-tokens.ts を唯一の実装正本とし、10色・寸法のschema/関係不変条件と、CSS/charts consumerへの生成・参照一致を自動検査する。DESIGN-SYSTEM.md は由来・意図の参照資料とする。
- S4 (G5): 文字用トークンのコントラストが背景と面の双方に対し 4.5:1 以上、部品を見分ける枠のトークンとチャート系列色が 3:1 以上である。装飾罫線 (#D7E0E2) は 1.4.11 の対象外で、部品の枠には使われていない。
- S5 (G2): route registry由来の20ルートすべてが共通PageShell (サイドバー 220px・ヘッダー 64px・フッター) の下で描画される。
- S6 (G1-G5): 既存の pnpm test / typecheck / lint と packages/web の check 系スクリプト (thead / mobile-layout / financial-figure / financial-routes) が全て緑のままである。

## スコープ

- In:
  - design/FINAL-UI の画像と DESIGN-SYSTEM.md からの色・構成・タイポグラフィ・寸法の抽出
  - packages/core へのデザイントークン正本 (依存ゼロの TypeScript) の新設
  - styles.css の :root トークンと charts.ts の COLORS をトークン正本から導出する形への置換と、写しのずれ検出 lint
  - サイドバー・ヘッダー・共通フッター・固定アクションバー・ページ骨格・ボタンの共通部品化と、既存 20 画面からの参照
  - チャート配色と描画規約の統一
  - 色の直書き検出と、文字・部品の枠・チャート系列のコントラスト検証のテスト
  - トークンと共通部品の使い方を示す規約文書
- Out:
  - 各画面の中身 (表・カード・フォームの配置) を FINAL-UI の画像どおりに作り直すこと (次サイクル)
  - 新機能の追加
  - API・データベースの変更
  - ネイティブアプリ (スマートフォン・タブレット・デスクトップ)
  - ダークテーマ
  - Web フォントの追加 (system-ui 系の和文ゴシックと既存の IBM Plex Mono を維持し規約化する)
  - 会計レポート用 report-design-system (report.css / report-css.ts) の配色移行と、その 2 ファイルの変更 (次サイクル。今回はトークン正本を依存ゼロの packages/core に置くことで、レポート側から同じ値を import できる前提だけを用意する)

## 用語と主体

| Term/Actor | Definition/Responsibility |
|---|---|
| FINAL-UI | design/FINAL-UI の 20 画面と DESIGN-SYSTEM.md。見た目の正本 |
| デザイントークン | 役割名から値への対応。packages/core/src/design-tokens.ts が正本 |
| 写し | 正本から導出する styles.css の CSS 変数と charts.ts の予備値 |
| 塗り用 / 文字用 | 状態色の 2 つの役割。塗りは画像どおり、文字は 4.5:1 の派生色 |
| 装飾罫線 / 部品の枠 | 境界の 2 つの役割。装飾罫線は #D7E0E2、部品の枠は 3:1 の派生色 |
| 利用者 | 単独の個人事業主 1 名 (唯一の利用者・保守者) |
| 保守エージェント | 規約に従って画面・図を追加するコーディングエージェント |

## ユースケースとユーザーフロー

1. 新しい画面をつくるとき、色・余白・角丸・文字サイズを design-tokens から選ぶだけで FINAL-UI と同じ見た目になる。
2. どの画面を開いても、左に同じネイビーのサイドバー (220px)、上に同じヘッダー (64px・期間 1年/2年/3年/任意)、下に同じフッターが出る。
3. 月次の収入・支出・純収支の図は、どの画面でも収入が青い棒、支出が赤系の棒、純収支がティールの線で描かれる。
4. 誰かが画面のコードに #xxxxxx の色を直書きしたら、pnpm lint が落ちて共通トークンを使うよう促す。
5. 注意 (アンバー) の表示は、バッジやアイコンの塗りは画像どおりの色で、文字は読みやすい濃さで出る。表の罫線は画像どおり淡く、入力欄の枠は見分けられる濃さで出る。

## 機能要件

- `FR-001` (O1): packages/core/src/design-tokens.ts に色・文字・余白・角丸・影・動き・寸法のトークンを定義し、唯一の実装正本とする。 判定: schema、役割集合、互換CSS変数、reading/data幅、44px操作領域などの関係不変条件が単体テストで通り、CSS生成物とのずれは lint が検出する。
- `FR-002` (O2): styles.css の :root トークンと charts.ts の COLORS を design-tokens.ts から導出した写しに置き換え、写しのずれと色構文の直書きを検出する lint を組み込む。 判定: pnpm lint が写しの不一致またはhex/rgb/hsl/CSS Color構文の未許可リテラルで exit 非0になり、一致時に exit 0 になる。
- `FR-003` (O3): Layout (サイドバー・ヘッダー・フッター)・PageShell・PageActions・Button (主/副/危険/テキスト) を共通部品として定義する。route registry 由来の20ルートは共通シェルと PageShell を経由し、標準の主・副・危険・submit操作は Button を使う。menu/tab/sort/toggleなど ARIA 固有状態と一体の低レベル control は native button の明示例外とする。 判定: route registry から導出する DOM テストが全ルートのランドマークと PageShell を検査し、静的検査が標準variant/submitを直接所有する native button を拒否する。
- `FR-004` (O4): 文字・部品の枠・チャート系列に使う全トークンの、背景/面に対するコントラストを計算するテストを置く。 判定: 文字用トークンは背景 #F6F8F9 と面 #FFFFFF の双方に対し 4.5:1 以上、部品を見分ける枠のトークンとチャート系列色は 3:1 以上であることをテストが検証し、基準未満の値を入れると落ちる。装飾罫線トークン (#D7E0E2) は 1.4.11 の対象外として検査から外し、入力欄・チェックボックスの枠が装飾罫線トークンを参照していないことを同じテストで確かめる。
- `FR-005` (O5): トークンと共通部品の使い方を規約文書 (docs 配下) にまとめ、新しい画面・図をつくるときの参照先を 1 つにする。 判定: 規約文書が色の役割 (塗り/文字の分離)・タイポグラフィ・余白と寸法・シェル・ボタン・チャートの6つのH2節を各1つ持ち、README と AGENTS.md の双方から `docs/design-system.md` への正規相対リンクがある。`check-design-system-document-contract.mjs` が見出し・導線・意思決定状態を機械検査する。

## 非機能要件

- Performance: 初期 JS 予算 (packages/web の check:js-budget) を超えない。外部ライブラリを追加しない (C2)。
- Availability/Reliability: 配信構成 (Cloudflare Workers の静的アセットと /api/*) を変えない。
- Accessibility/Usability: WCAG 2.2 AA。文字 4.5:1、部品を見分ける枠と図形 3:1。prefers-contrast: more と狭幅のドロワー・下部タブを壊さない (C4, C5)。
- Security/Privacy: CSP を広げず Web フォントを追加しない。表示値は匿名・架空のサンプルだけ (C3, C7)。
- Maintainability/Operability: 直書き色・写しのずれ・FR-005文書契約を pnpm lint が検出し、規約文書を 1 か所に置く (G4)。lint が証明するのは機械的整合のみで、リリースには外部の人間による承認が別途必要。

## UI・状態遷移

- 画面/CLI/API状態: route registry由来の20ルートが共通Layout/PageShell (サイドバー 220px・ヘッダー 64px・フッター) の下で描画される。未認証時は業務メニューをロック表示する。
- 遷移条件: 既存のルーティングと全体期間の保持 (PR #45) を変えない。
- Loading/Empty/Error: 既存の表示を維持し、色と部品だけを共通トークンへ寄せる。

## ビジネスルールと検証

- `BR-001`: 色の値はトークン定義とその生成物以外に書かない (S1)。
- `BR-002`: 状態色は塗り用と文字用を別の役割名で呼ぶ (G5)。
- `BR-003`: 入力欄・チェックボックスの枠は装飾罫線トークンを参照しない (dec-border-color-roles)。
- `BR-004`: チャート系列は収入=青系・支出=赤系・純収支=ティール線とし、3:1 以上で描く (G3, C4)。

## API契約

N/A: API を公開・変更しない (scope.out『API・データベースの変更』)。

## データモデル

- Entity/Value: デザイントークン (色・文字サイズ・行高・余白・角丸・影・動き・シェル寸法の役割名と値)。
- Fields/Types/Nullability: TypeScript の readonly 定数。null を持たない。
- Relations/Constraints/Indexes: N/A: 永続化しない。
- Ownership/Retention/Migration: packages/core が所有する。D1・R2 は変更しない。

## 認証・認可

- Authentication: 既存の /api/auth/login と authGuard を変えない。
- Authorization: 見た目の部品は認可を判断しない。表示のロックは案内に留める。
- Tenant/data boundary: N/A: 単一利用者で境界を変えない。

## エラー・例外・回復

- Error taxonomy: lint の不一致は exit 非 0 と契約違反の表示で示す。
- Retry/Timeout/Fallback: charts.ts は CSS を読めない環境で正本由来の予備値を使う。
- Idempotency/Concurrency: 写しの生成は同じ正本から同じ出力になる。

## イベント・非同期処理

- Producer/Consumer: N/A: 非同期処理を追加しない。
- Delivery/Ordering/Deduplication/DLQ: N/A: 同上。

## 可観測性

- Logs/Metrics/Traces/Audit: N/A: 実行時の信号を追加しない。検証は CI の lint とテストで行う。
- Alert/SLO dashboard: N/A: 同上。

## 互換性・移行・リリース

- Compatibility/versioning: CSS 変数名と charts.ts の公開関数を維持し、画面側の参照を壊さない。
- Migration/backfill: 正本を新設し、styles.css と charts.ts の値を正本由来へ置き換える。各画面の中身の作り直しは次サイクル。
- Rollout/rollback: 単一の PR で配信し、問題があれば直前のビルドへ戻す。

## テストと受入条件

- [ ] `AC-001`: S1 (G1, G4): packages/web/src の .ts/.tsx/.css において、トークン定義とその生成物以外での hex/rgb/hsl/CSS Color 構文による色の直書きが 0 件であり、lint がこれを検査する。
- [ ] `AC-002`: S2 (G3): charts.ts と全ての実描画consumerの系列色・軸・グリッド・文字色が全て design-tokens.ts 由来で、収入=青系・支出=赤系・純収支=ティール線になっている。
- [ ] `AC-003`: S3 (G1): design-tokens.ts が唯一の実装正本であり、schema/関係不変条件と CSS/charts consumer の一致を自動検査する。
- [ ] `AC-004`: S4 (G5): 文字用トークンのコントラストが背景と面の双方に対し 4.5:1 以上、部品を見分ける枠のトークンとチャート系列色が 3:1 以上である。装飾罫線 (#D7E0E2) は 1.4.11 の対象外で、部品の枠には使われていない。
- [ ] `AC-005`: S5 (G2): route registry由来の20ルートすべてが共通PageShell (サイドバー 220px・ヘッダー 64px・フッター) の下で描画される。
- [ ] `AC-006`: S6 (G1-G5): 既存の pnpm test / typecheck / lint と packages/web の check 系スクリプト (thead / mobile-layout / financial-figure / financial-routes) が全て緑のままである。
- Contract/integration/e2e/security/performance: トークン値照合 (O1)、写しずれ lint (O2)、20 ルートの DOM テスト (O3)、コントラスト計算 (O4)、FR-005文書契約 (O5)、既存 check 系と check:js-budget。

## 未決事項

- `human-design-token-approval`: リリース対象の正確な `approval_subject_digest` に対する外部の人間承認。機械検査では代替せず、`token-approval.json` の `humanApproval.status` は `pending-external` のまま保つ。

## 確定意思決定

- `dec-design-token-source`: デザイントークンの正本をどこに置くか 採択『packages/core の design-tokens.ts を正本にし、CSS 変数とチャートの予備値を生成する』 (他案: styles.css の :root を正本に維持し、予備値のずれを lint で塞ぐ)。理由: G1 と O1・O4 の検証を CSS の解析なしで書け、次サイクルのレポート配色移行でも同じ値を import できる。実行時の図の色の読み方 (getComputedStyle) は変えず、ずれている予備値だけを正本から取るので、現行実装の利点を保ったまま直書きを 0 件にできる。
- [`dec-chart-series-contrast`](../docs/design-system/architecture-decision.md#dec-chart-series-contrast-チャート系列色): 収入を `#428ce6`、支出を `#e2606d` へ同色相のまま暗くし、背景・面の双方で3:1に余裕を持たせる。2026-09-13T11:06:08Zの利用者選択により confirmed。値・根拠・不採用案はリンク先を正本とする。
- `dec-border-color-roles`: 境界色 #D7E0E2 (白に 1.34:1) を、WCAG 2.2 の 1.4.11 とどう両立させるか 採択『装飾罫線は #D7E0E2、部品を見分ける枠は 3:1 の派生色』 (他案: すべての境界を 3:1 以上にする / すべて画像どおり #D7E0E2)。理由: 1.4.11 は部品を識別するのに必要な視覚情報に適用され、装飾だけの罫線は対象外である。そのため罫線は画像どおりに残し、部品の枠だけを加工すれば、U1 (FINAL-UI を正本) と G5 (AA 維持) を同時に満たせる。
