---
graph_node_id: "arch-expense-matrix-maintenance-ops"
artifact_kind: "architecture"
artifact_subtypes: ["infrastructure"]
title: "支出マトリックス — 検算済みフィクスチャと語彙の統一"
project_id: "kanjo"
domain: "maintenance-ops"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: []
tags: ["expense-matrix", "maintenance-ops"]
file_path: "architecture/expense-matrix-maintenance-ops.md"
template_id: "architecture"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluator": "system-spec-harness:assign-system-spec-completeness-evaluator", "evidence_ref": "system-spec/completeness-findings.json", "evaluated_digest": "73ddaf752a28edcc278ef0accb77411a9a77dae0857990352307db902f74f9b1"}
source_lineage: {"origin_kind": "system-spec-harness", "source_plugin": "system-spec-harness", "source_path": "system-spec/maintenance-ops.md", "source_version": "0.1.14", "source_digest": "73ddaf752a28edcc278ef0accb77411a9a77dae0857990352307db902f74f9b1", "imported_at": "2026-09-16T11:55:20Z"}
created_at: "2026-09-16T11:55:20Z"
updated_at: "2026-09-16T11:55:20Z"
depends_on: ["spec-expense-matrix-screen"]
related_nodes: ["arch-expense-matrix-ui-ux", "arch-expense-matrix-frontend", "arch-expense-matrix-backend", "arch-expense-matrix-database", "arch-expense-matrix-auth", "arch-expense-matrix-security", "arch-expense-matrix-infrastructure"]
resource_scope: ["specs/spec-expense-matrix-screen.md", "packages/web/src/routeMetadata.ts", "packages/web/src/matrix-visual.dom.test.tsx", "packages/web/src/matrix-legend.dom.test.tsx", "packages/core/test/analysis-contract.test.ts", "docs/ui-decisions.md"]
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
classification_reason: "system-spec の maintenance-ops 章 (web 確定・他 platform 対象外) を領域別の architecture 制約として参照する。"
classification_candidates: [{"artifact_kind": "architecture", "confidence": 1.0, "candidate_path": "architecture/expense-matrix-maintenance-ops.md"}]
tracker_binding: "none"
beads_linkage: null
github_publication: {"mode": "local_only", "project_aliases": [], "labels": [], "milestone": null}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"policy": "manual", "status": "not_applicable", "source": null, "completed_at": null, "reconciled_at": null, "evidence_refs": []}
implementation_readiness: {"status": "complete", "missing_sections": [], "checked_at": "2026-09-16T11:55:20Z"}
serves_goals: ["G3", "G4", "G5"]
---

# Architecture overview

支出マトリックス — 検算済みフィクスチャと語彙の統一。`system-spec/maintenance-ops.md` は承認時入力、本書は保守・運用の制約を持つ。数値の正本は `specs/spec-expense-matrix-screen.md` §3.5。

## Context and drivers

- Business/technical context: 参照画像の合計欄は閉じていない。画像は 1,065.5 / 1,066.2 / 1,082.0 の 3 つの値を掲げるが、セル値から算出した実際の和は 1,062.6 である。画像をそのまま期待値にすると、実装が正しくてもテストが落ちるか、誤った合計を仕様として固定してしまう。
- Quality attribute priorities: G3・G4・G5 に資する。Google SRE の『再現できる形で残す』、DDD の用語一致を適用する。
- Constraints: 既存のサイドバー・ヘッダー・フッターは踏襲するが、表記の不一致 (マトリクス / マトリックス) は是正する。

## Goals and non-goals

- Goals:
  - G3: 回帰テストの期待値をセル値から検算した値に固定し、集計の誤りが厳密一致で検出されるようにする。
  - G4: 仕様書 §3.5 を数値の単一の正本とし、実装・テスト・画面がそこを参照する。
  - G5: 画面名の表記を『マトリックス』へ統一し、導線の文言と一致させる。
- Non-goals:
  - サイドバー構造・共通シェルの作り直し
  - 新しい運用手順・当番・監視の追加
  - 参照画像の合計欄を正としての追認

## System context and boundaries

- Users/external systems: 開発・保守の担い手 (単独) と既存テスト基盤 (Vitest)。
- Trust/deployment/data boundaries: フィクスチャは仕様書の表を正本とし、画像は観測の根拠に留める。
- Context diagram: `system-spec/index.md` の章相互参照を参照する。

## Container and component view

| Container/Component | Responsibility | Interface | Data owner | Deployment unit |
|---|---|---|---|---|
| 仕様書 §3.5 | 行 × 月のセル値と検算済み合計・平均の正本 | Markdown 表 | specs/ | リポジトリ |
| core テスト | セル値から合計・平均・階級・順位を厳密一致で検証 | Vitest | packages/core | CI |
| DOM テスト | 画面の表示と URL 復元を検証 | Vitest + DOM | packages/web | CI |
| routeMetadata | 画面名と導線文言 | TypeScript | packages/web | web ビルド |

## Cross-cutting contracts

- Identity/access: N/A: 本章の関心外。
- Errors/resilience: N/A: 本章の関心外。
- Observability/audit: 新しい監視・当番を作らない。回帰はテストで検出する。
- Configuration/secrets: N/A: 追加の設定を持たない。
- Compatibility/versioning: 表記変更は routeMetadata の label と journeyHint を含めて一度に揃える。

## Subtype architecture

- Frontend: N/A: 本章の関心外
- Backend: N/A: 本章の関心外
- Infrastructure: 下記 Operations architecture を合成
- Data: N/A: 本章の関心外
- Security: N/A: 本章の関心外

### Operations architecture

#### Fixture authority

回帰テストはセル値を正本とし、合計・平均は実計算値を使う。§3.5 の検算値は 仕入高 367.4 / 30.6、人件費 214.8 / 17.9、家賃・地代 144.0 / 12.0、広告宣伝費 110.6 / 9.2、外注費 115.9 / 9.7、通信費 28.7 / 2.4、その他 81.2 / 6.8、総計 1,062.6 / 平均 88.5 (平均行の合計・平均は '-')。画像が掲げる 1,065.5 / 1,066.2 / 1,082.0 は採らず、一致しない事実を仕様書に明記して残す。

#### Terminology consistency

画面名の表記を『マトリックス』へ統一する。サイドバーの現行表記が異なる場合は語だけを是正し、構造・並び・導線は変えない。`routeMetadata` の label と journeyHint も同語へ揃える。

#### Regression scope

既存の matrix-visual / matrix-legend のテストは新構成に合わせて更新し、色の凡例と未記帳月の扱いという既存の振る舞いは維持する。選択セルの例 (広告宣伝費 × 2026年03月 ¥240,000 / 前月比 +¥120,000 (+100.0%) / 前年同月比 +¥180,000 (+300.0%) / 取引 3 件) を詳細パネルの回帰根拠に使う。

#### Documentation upkeep

数値・決定の変更は仕様書を先に直してからテストと実装へ降ろす。UI の決定は `docs/ui-decisions.md` に追記する。

#### Operations verification

テストが旧実装に対して確実に落ちることを確かめる (合計・平均・階級・順位の三点が同時に固定されていること)。表記の統一はサイドバー・routeMetadata・画面見出しの 3 か所で確認する。

## Architecture decisions

| Basis (qa_ref) | Decision | Alternatives | Trade-on rationale | Consequences |
|---|---|---|---|---|
| dec-matrix-fixture-authority | セル値を正本とし合計・平均は実計算値 | 画像の合計欄を正本 | 期待値が算術的に閉じ、`toBe` の厳密一致で誤りが検出される | 画像と合計欄が一致しない事実を仕様書に明記する |
| qa-matrix-maintenance-ops-web-004 | 表記を『マトリックス』へ統一する | 現行表記を残す | 画面名と導線の文言が一致し、参照が一意になる | routeMetadata と既存テストの文言更新が要る |
| qa-matrix-maintenance-ops-web-003 | 新しい運用手順・監視を増やさない | 監視項目を追加 | 単独運用の負荷を増やさずテストで回帰を捕まえる | 検出はデプロイ前に限られる |

## Delivery, migration and rollback

- Build/deploy topology: 既存 CI (Vitest) と web ビルド。
- Migration sequence: 仕様書 §3.5 の検算値を確定 → core テストのフィクスチャ化 → DOM テスト更新 → 表記統一 (サイドバー / routeMetadata / 見出し)。
- Rollback trigger/procedure: テストが落ちたら差し戻す。ドキュメントの変更は git で戻せる。

## Risks and verification

- Risk/assumption: 画像の合計欄を無批判に期待値へ写すと、誤った合計が仕様として固定される。§3.5 の検算値を正本にすることで塞ぐ。
- Architecture fitness test: テスト内の期待値が §3.5 と一致していること。**サイドバーおよびルート定義**に『マトリクス』表記が残っていないこと (検査対象はこの 2 か所に限る。仕様 §8 が画面内の表題とコード内コメントの変更を明示的に禁じているため、リポジトリ全体の `grep` 0 件は達成不能であり検査条件にしない)。
- Load/failure/security validation: 旧実装に対してテストが落ちること。既存 matrix 系テストが新構成で緑であること。
