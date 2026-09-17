---
graph_node_id: "arch-reconciliation-ui-ux"
artifact_kind: "architecture"
artifact_subtypes: ["frontend"]
title: "照合画面 — 情報の優先順位と 3 カラム画面構成・共通シェル"
project_id: "kanjo"
domain: "ui-ux"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: []
tags: ["reconciliation", "ui-ux"]
file_path: "architecture/reconciliation-ui-ux.md"
template_id: "architecture"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluator": "system-spec-harness:assign-system-spec-completeness-evaluator", "evidence_ref": "system-spec/archive/2026-09-16-reconciliation/completeness-findings.json", "evaluated_digest": "36880c07d7b18428bc7692ba8123110c7c4d8da6603939b28b2ffd84437f3fec"}
source_lineage: {"origin_kind": "system-spec-harness", "source_plugin": "system-spec-harness", "source_path": "system-spec/archive/2026-09-16-reconciliation/ui-ux.md", "source_version": "0.1.14", "source_digest": "36880c07d7b18428bc7692ba8123110c7c4d8da6603939b28b2ffd84437f3fec", "imported_at": "2026-09-15T10:39:59Z"}
created_at: "2026-09-15T10:39:59Z"
updated_at: "2026-09-15T10:39:59Z"
depends_on: ["spec-reconciliation"]
related_nodes: ["arch-reconciliation-frontend", "arch-reconciliation-backend", "arch-reconciliation-database", "arch-reconciliation-auth", "arch-reconciliation-security", "arch-reconciliation-infrastructure", "arch-reconciliation-maintenance-ops"]
resource_scope: ["design/FINAL-UI/images/04-reconciliation.png", "design/FINAL-UI/spec/AUDIT.md", "design/FINAL-UI/spec/FUNCTION-MATRIX.md", "design/FINAL-UI/spec/DESIGN-SYSTEM.md", "docs/design-system.md", "docs/ui-decisions.md", "packages/web/src/pages/analysis/Reconciliation.tsx", "packages/web/src/components/Layout.tsx"]
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
classification_candidates: [{"artifact_kind": "architecture", "confidence": 1.0, "candidate_path": "architecture/reconciliation-ui-ux.md"}]
tracker_binding: "none"
beads_linkage: null
github_publication: {"mode": "local_only", "project_aliases": [], "labels": [], "milestone": null}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"policy": "manual", "status": "not_applicable", "source": null, "completed_at": null, "reconciled_at": null, "evidence_refs": []}
implementation_readiness: {"status": "complete", "missing_sections": [], "checked_at": "2026-09-15T10:39:59Z"}
serves_goals: ["G1", "G4", "G5"]
---

# Architecture overview

照合画面 — 情報の優先順位と 3 カラム画面構成・共通シェル。`system-spec/archive/2026-09-16-reconciliation/ui-ux.md` は承認時入力、本書は UI/UX 制約を持つ。現行の機能仕様の正本は `specs/spec-reconciliation.md`。

## Context and drivers

- Business/technical context: 目標画面 `04-reconciliation.png` の 3 列マスタ詳細を基準に、現行の 5 状態・`actionRequiredCount`・下段プレビューへ意味を更新する。画面構造と状態の正本は `specs/spec-reconciliation.md`、見た目の正本は画像、値の正本は design tokens とする。
- Quality attribute priorities: G1・G4・G5 に資する。Information Design の『task 頻度 × 失敗コストで束に順位を付ける』、Apple HIG の『破壊的な操作は取り消せるようにし結果をその場で知らせる』『色だけに頼らない』、WCAG 2.2 のステータスメッセージを適用する。
- Constraints: C2 (トークン・共通 Button・PageShell・--aside-panel-w・WCAG 2.2 AA)。web SPA 1 系統のレスポンシブ。

## Goals and non-goals

- Goals:
  - G1: 画像の全構成要素と、読込・空・失敗・部分成功・確認の各状態を描く。
  - G4: 共通シェルを画像に揃える (文言もバッジも、qa-reconciliation-decision-004)。
  - G5: KPI・キュー・ステータス・一致の理由・操作ボタン・ヘッダー・フッター・サイドバーでアイコンを表示する。
- Non-goals:
  - 総収支・マトリクス・推移・診断タブと他画面の中身の作り直し
  - 利用規約・プライバシー・データ出典の本文作成
  - 専用アプリの OS 標準遷移への対応

## System context and boundaries

- Users/external systems: 利用者 1 名が月次クローズで差異を解消する。
- Trust/deployment/data boundaries: 画面は共通シェル内。freee / MoneyForward へは書き戻さず、『仕分けを開く』『明細仕分けで対応する』『データ取込を確認する』の導線で扱う。
- Context diagram: `system-spec/index.md` の章相互参照を参照する。

## Container and component view

| Container/Component | Responsibility | Interface | Data owner | Deployment unit |
|---|---|---|---|---|
| 問いの見出しと KPI 4 枚 | 事業支出 / MFのみ (対応不要) / 対応が必要 (`actionRequiredCount`) / 解消済み (③) | KpiCard | packages/web | web ビルド |
| 絞り込みと対応キュー | どこから手を付けるか (②キュー / ⑤絞り込み) | フォーム / リスト | packages/web | web ビルド |
| 照合候補一覧+取引の詳細パネル | 候補の比較と判定根拠・操作・直前の操作と元に戻す (①主役) | 表 / 右パネル | packages/web | web ビルド |
| 下段プレビュー | `mfOnly` / `reviewRows` の代表行とマスタへの導線 (④)。読み取り専用 | コンパクト表 | packages/web | web ビルド |
| 選択中バー | N件選択中・選択をクリア・選択した取引を照合 | 固定バー | packages/web | web ビルド |
| 共通シェル | パンくず・サイドバー・月次クローズ 3/4・ヘッダー・フッター・改善を送る | Layout | packages/web | web ビルド |

## Cross-cutting contracts

- Identity/access: N/A: 表示範囲は認証済みシェルに従う。
- Errors/resilience: 一括照合は確認ダイアログで件数を示す。操作の結果は詳細パネルの直前の操作に内容と元に戻すで示す。解消率の分母 0 は『対象なし』。
- Observability/audit: N/A: 実行時の信号を追加しない。
- Configuration/secrets: N/A: 設定値・秘密情報を追加しない。
- Compatibility/versioning: 既存ルートと旧 URL のテストを緑に保つ (S4)。

## Subtype architecture

- Frontend: 下記 architecture-frontend.md を合成
- Backend: N/A: 本章の関心外
- Infrastructure: N/A: 本章の関心外
- Data: N/A: 本章の関心外
- Security: N/A: 本章の関心外

### Frontend architecture

#### Rendering and application pattern

PC は 3 列のマスタ詳細を保つ。狭幅では KPI→対応キュー→候補一覧→選択行の詳細の順にし、絞り込みは折りたたむ。補助列を段階的に隠し、下段は件数・代表行・導線だけに減らす。状態や操作は削らず、情報密度を落として横スクロールを防ぐ。

#### Routes, screens and navigation

パンくず『確認 / 支出分析 / 照合』。サイドバーのグループ (取込 / 整える / 確認 / 計画 / 管理) と文言 (概要/データ取込/現金入力/明細仕分け/サブスク/累計収支/支出分析/決算書/AI分析/予算/トレードオフ/設定/使い方/改善リクエスト)、決算書の子行シェブロン。導線は『仕分けを開く』『明細仕分けで対応する』『データ取込を確認する』。

#### Component and design-system boundaries

詳細パネルは選択中の MoneyForward と freee 候補、比較根拠、主要操作、直前の操作を一続きで示す。下段は仕様正本どおり `mfOnly` と `reviewRows` の短い読み取り専用プレビューに限る。ステータスは文字のバッジ、一致理由はアイコンと文言、一致度は数値とバーを併用する。

#### State and data flow

一致の理由の内容行のチェックは内容類似 0.5 以上で付く (qa-backend-web-rc-decision-013)。解消率は照合済み ÷ (照合済み + 要確認 + 未処理) で、分母 0 は『対象なし』(qa-backend-web-rc-decision-010)。

#### Backend integration

照合の件数バッジと月次クローズの照合ステップは、仕様正本に従い全期間の同じ `actionRequiredCount` を使う。web は内訳から再計算しない。

#### Performance and observability

ヘッダー: 防衛ライン：正常 (盾アイコン)・未記録 Nか月・最終更新・⌘K 検索・ダウンロード・ヘルプのアイコンボタン・アバター。フッター: 取込データは外部送信しません / 税務上の正本はfreee / 毎晩バックアップ、利用規約 | プライバシー | データ出典 | v1.0。右下に『改善を送る』。狭幅で横スクロールしない。

#### Frontend verification

O1 の DOM テスト (構成要素と各状態)、O4 の shell 系 DOM テスト、O5 のアイコン表示テスト。check:mobile-layout で狭幅の縦積みと横スクロール無しを確かめる。

## Architecture decisions

| ADR | Decision | Alternatives | Trade-on rationale | Consequences |
|---|---|---|---|---|
| qa-ui-ux-web-rc-decision-006 | ①候補一覧+詳細 ②キュー ③KPI ④下段 ⑤絞り込み | KPI が主役 / 画像どおり差を付けない | 誤照合が最も失敗コストが高く、根拠と操作を離さない | 狭幅で絞り込みを折りたたむ |
| qa-reconciliation-decision-001 | 共通シェルの差分を全て今回直す | 照合本体だけ / アイコンと文言だけ | 画像との差を一度に解消する | 全画面に波及する |
| qa-reconciliation-decision-004 | サイドバーの文言もバッジも揃える | バッジだけ / 照合子行だけ | 画像と一致させ見出し・パンくず・コマンドパレットも追随 | 既存 DOM テストの文言を更新する |
| qa-reconciliation-decision-005 | 月次クローズは 3 つ自動+レビュー手動 | 4 つとも自動 / 判定なし | 利用者の確認行為を記録できる | 月次レビューの保存と取消 UI が要る |

## Delivery, migration and rollback

- Build/deploy topology: 既存 web ビルド。
- Migration sequence: 共通シェルの文言・グループ・バッジ → 月次クローズ 3/4 → ヘッダー・フッター → 照合画面の 3 カラム → 各状態と確認ダイアログ。
- Rollback trigger/procedure: DOM テスト・check 系が落ちたら差し戻し、配信済みなら直前のビルドへ戻す。

## Risks and verification

- Risk/assumption: 共通シェルの変更が全画面に波及する。類似判定の限界と表示先は仕様正本および `docs/data-schema.md` を参照し、本書では再定義しない。
- Architecture fitness test: 根拠 (一致の理由・一致度) を見ずに照合ボタンを押せる配置が無いこと。色だけで状態を示す箇所が無いこと。
- Load/failure/security validation: 狭幅で横スクロールしない (S6)、WCAG 2.2 AA を維持する。
