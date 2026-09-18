---
graph_node_id: "arch-subscriptions-maintenance-ops"
artifact_kind: "architecture"
artifact_subtypes: ["infrastructure"]
title: "サブスク画面 — 検算済み fixture・規則の docs 化・旧テストの移設"
project_id: "kanjo"
domain: "maintenance-ops"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: []
tags: ["subscriptions", "maintenance-ops"]
file_path: "architecture/subscriptions-maintenance-ops.md"
template_id: "architecture"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluator": "system-spec-harness:assign-system-spec-completeness-evaluator", "evidence_ref": "system-spec/completeness-findings.json", "evaluated_digest": "f8daeaa66129e8592eb9875eba41e3ec019734a6d5be99149c79dd5586b29b18"}
source_lineage: {"origin_kind": "system-spec-harness", "source_plugin": "system-spec-harness", "source_path": "system-spec/maintenance-ops.md", "source_version": "0.1.14", "source_digest": "f8daeaa66129e8592eb9875eba41e3ec019734a6d5be99149c79dd5586b29b18", "imported_at": "2026-09-18T07:04:09Z"}
created_at: "2026-09-18T07:04:09Z"
updated_at: "2026-09-18T07:04:09Z"
depends_on: ["spec-subscriptions-screen"]
related_nodes: ["arch-subscriptions-ui-ux", "arch-subscriptions-frontend", "arch-subscriptions-backend", "arch-subscriptions-database", "arch-subscriptions-auth", "arch-subscriptions-security", "arch-subscriptions-infrastructure"]
resource_scope: ["packages/core/test/subs-contract.test.ts", "packages/core/test/subs-review-contract.test.ts", "packages/api/src/subs-vendor-scope.test.ts", "packages/web/src/subs-review.dom.test.tsx", "packages/web/src/components/SubVendors.dom.test.tsx", "packages/web/scripts/check-financial-visuals.mjs", "packages/web/src/routeMetadata.ts", "docs"]
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
classification_candidates: [{"artifact_kind": "architecture", "confidence": 1.0, "candidate_path": "architecture/subscriptions-maintenance-ops.md"}]
tracker_binding: "none"
beads_linkage: null
github_publication: {"mode": "local_only", "project_aliases": [], "labels": [], "milestone": null}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"policy": "manual", "status": "not_applicable", "source": null, "completed_at": null, "reconciled_at": null, "evidence_refs": []}
implementation_readiness: {"status": "complete", "missing_sections": [], "checked_at": "2026-09-18T07:04:09Z"}
serves_goals: ["G3", "G4", "G5"]
---
# Architecture overview

サブスク画面 — 検算済み fixture・規則の docs 化・旧テストの移設。`system-spec/maintenance-ops.md` は承認時入力、本書は保守運用の制約を持つ。寸法・文言・フィクスチャ数値の正本は `specs/spec-subscriptions-screen.md`。

## Context and drivers

- Business/technical context: 参照画像の数値は閉じていない — 一覧 8 行の月額の和は ¥9,778 だが、合計欄は ¥64,800 である。画像をそのまま期待値にすると、実装が正しくてもテストが落ちるか、誤った合計を仕様として固定してしまう。現行のサブスクのテストは `packages/core/test/subs-contract.test.ts`、`packages/core/test/subs-review-contract.test.ts`、`packages/api/src/subs-vendor-scope.test.ts`、`packages/web/src/subs-review.dom.test.tsx`、`packages/web/src/components/SubVendors.dom.test.tsx`。見た目の検査 `packages/web/scripts/check-financial-visuals.mjs` は `/api/subscriptions` のモック (:251-275、:1168) を返し、`/subscriptions` の図を 1 つと数える (:1515 `expectedFigures: 1`、:1562 は `.financial-figure__chart canvas` を数える)。見直し候補の規則・閾値・理由文を書いた docs は無い (`docs/` にサブスク画面の文書が無い)。サイドバーの説明文 (`packages/web/src/routeMetadata.ts:62` の taskDetail) は『重複契約疑いとサブスクの急増を検出する』で、見直し候補の語を持たない。
- Quality attribute priorities: G3・G4・G5 に資する。Google SRE の operations (再現できる形で残す、変更を小さく可逆に保つ) と Clean Code (テストは 1 つの理由で落ちる、名前で意図を示す) を適用する。
- Constraints: 既存テスト基盤 (Vitest・DOM テスト・check 系スクリプト) だけを使う。新しい監視・当番を作らない。

## Goals and non-goals

- Goals:
  - G3: 見直し候補の 5 規則・閾値・理由文テンプレートを `docs/subscriptions-screen.md` に書き、core のテストで固定する。docs とテストは同じ変更で直す (spec §9, §15)。
  - G4: 検算済み fixture で、合計行 = 行の和、カテゴリ別合計 = 一覧合計、KPI 月額 = 一覧合計、last12 = 既存 `last12Total` を突き合わせる。
  - G5: 旧テスト (`subs-review.dom.test.tsx`・`components/SubVendors.dom.test.tsx`) を新しい部品へ移し、移した操作の対応表で欠落 0 件を確かめる。
- Non-goals:
  - 画像の数値の再現
  - 新しい監視・アラート・SLO

## System context and boundaries

- Users/external systems: 開発・保守の担い手 (単独) と既存テスト基盤 (Vitest)・CI。
- Trust/deployment/data boundaries: fixture は仕様書 (spec §15) の検算値を正本とし、画像は構成・文言・配置の根拠に留める。
- Context diagram: `system-spec/index.md` の章相互参照を参照する。

## Container and component view

| Container/Component | Responsibility | Interface | Data owner | Deployment unit |
|---|---|---|---|---|
| 検算済み fixture | 推定月額・年額払い・継続中・カテゴリ・口座 3 分類・5 規則の境界を含む入力と期待値 | core テスト | packages/core | CI |
| core 契約テスト | 金額は `toBe`、割合は `toBeCloseTo` で固定。一致条件 4 つの突き合わせ | Vitest | packages/core | CI |
| API スコープテスト | 新設 4 経路の認証・userId 絞り・許可リスト | Vitest | packages/api | CI |
| DOM テスト | O1 / O2 / O3 の観測点。旧テストの移設先 | Vitest + DOM | packages/web | CI |
| check-financial-visuals | `/api/subscriptions` モックの更新、図の数、ロゴ画像 0 件 | Node スクリプト | packages/web | CI |
| docs/subscriptions-screen.md | 5 規則・閾値・並び順・理由文テンプレート・指紋の定義 | Markdown | docs | リポジトリ |

## Cross-cutting contracts

- Identity/access: N/A: 本章の関心外。
- Errors/resilience: N/A: 本章の関心外。
- Observability/audit: 新しい監視・当番を作らない。回帰はテストで検出する。
- Configuration/secrets: N/A: 追加の設定を持たない。
- Compatibility/versioning: 規則・閾値・テンプレートを変えるときは docs とテストを同じ変更で直す。旧テストの操作は対応表で移設先を示し、黙って消さない。

## Subtype architecture

- Frontend: N/A: 本章の関心外
- Backend: N/A: 本章の関心外
- Infrastructure: 下記 Operations architecture を合成
- Data: N/A: 本章の関心外
- Security: N/A: 本章の関心外

### Operations architecture

#### Fixture authority

数値の正本は core が算出する検算済み fixture (spec §15) で、画像は構成・文言・配置の正本に留める。金額は整数の円なので `toBe`、割合 (売上比・構成比・カバー率・前期間比の率) は `toBeCloseTo` で固定する。一致条件は 合計行 = 行の和、カテゴリ別合計 = 一覧合計、KPI 月額 = 一覧合計、last12 = 既存 `last12Total` の 4 つ。

#### Rule documentation

`docs/subscriptions-screen.md` に 5 規則 (同カテゴリに継続中 2 件以上 / dup / spike / 値上げ 5% 以上が 2 か月 / 四半期見直しの期限切れ)、表示順 (二重請求 → 急増 → 値上げ → 重複 → 期限切れ)、理由文テンプレート、指紋 (当たった規則すべて (表示順) + 基準金額、月を含めない)、2 状態 (未判断 / 確認済み) を書く。テストの境界値と docs の閾値を同じ変更で直す。

#### Regression scope

旧テストの操作 (登録・別名・対象科目・四半期見直し・候補の採用 / 除外 / 取消・一括登録・アラート) を新しい部品 (関連データタブ・検出理由カード・ステータス絞込・詳細パネル) へ移し、対応表で欠落 0 件を確かめる。`subscriptions()` を使う `tradeoffCandidates` と AI 用 dataset の既存テストが緑のままであること。

#### Visual check upkeep

check-financial-visuals の `/api/subscriptions` モックを新しい応答の形へ更新し、図の数 (カテゴリ別推移) を合わせ、ロゴ画像要素 0 件の検査を足す。

#### Operations verification

旧実装に対して新しいテストが落ちること (旧 KPI 月額は実支払で、推定月額の和と一致しない)。docs の閾値とテストの境界値が一致すること。対応表の欠落 0 件。

## Architecture decisions

| Basis (qa_ref) | Decision | Alternatives | Trade-on rationale | Consequences |
|---|---|---|---|---|
| dec-subs-fixture-authority | 数値は検算済み fixture、画像は構成・文言・配置の正本 | 画像の数値を期待値にする | 画像の合計欄は閉じていない (¥9,778 に対し ¥64,800) | UI テストの金額も fixture から取る |
| qa-subs-maintenance-ops-web-004 | 金額は `toBe`、割合は `toBeCloseTo` | 全て `toBeCloseTo` | 金額の 1 円ずれを見逃さない | 割合の許容誤差をテストに書く |
| qa-subs-maintenance-ops-web-004 | 規則・閾値・テンプレートを docs に書き、docs とテストを同じ変更で直す | コードのコメントだけ | 規則の変更が画面の件数を動かすため、根拠を 1 か所に残す | docs が正本、テストが検査 |
| qa-subs-maintenance-ops-web-004 | 旧テストを移し、対応表で欠落 0 件を確かめる | 旧テストを削除して書き直す | 旧機能を失わない (G5) ことを検査で示す | 対応表を変更に含める |
| dec-subs-review-candidate / qa-subs-review-decision-002 | 5 規則の境界・並び順・指紋・2 状態を core テストで固定 | DOM テストだけ | 件数の一致 (KPI・バッジ・理由カード) を入力 1 つで確かめる | 規則ごとの境界値 fixture |
| dec-subs-kpi-definition | KPI 月額 = 一覧合計、last12 = 既存 `last12Total` を突き合わせる | KPI を単独で検査 | 定義の食い違いを突き合わせで見つける | 旧実装では落ちる |
| dec-subs-category / dec-subs-coverage | 辞書の当たり・外れ・上書き、口座 3 分類と分類不能を fixture に含める | 代表例だけ | 境界 (その他・分類不能) を固定する | fixture の行数が増える |
| dec-subs-persistence / dec-subs-legacy-ui | 保存経路と旧 UI の移設をスコープテストと DOM テストで確かめる | 手動確認 | 移設時の欠落と認可の回帰を検出する | subs-vendor-scope.test.ts に新設経路を足す |

## Delivery, migration and rollback

- Build/deploy topology: 既存 CI (Vitest・check 系) と web ビルド。
- Migration sequence: spec §15 の検算値を確定 → core の fixture と契約テスト → docs/subscriptions-screen.md → API スコープテスト → DOM テスト (旧テストの移設と対応表) → check-financial-visuals のモック更新とロゴ 0 件の検査。
- Rollback trigger/procedure: テストが落ちたら差し戻す。docs の変更は git で戻せる。

## Risks and verification

- Risk/assumption: 画像の合計欄を期待値に写すと、誤った合計が仕様として固定される。検算済み fixture を正本にして塞ぐ。
- Risk/assumption: ロゴ 0 件の検査を `role="img"` で数えると、チャートの canvas (`packages/web/src/pages/Subscriptions.tsx:238` の `role="img"`) まで数えて誤検出する。検査はロゴ画像 (`img` 要素と外部画像 URL) に絞る。
- Risk/assumption: 旧テストを移すときに操作が 1 つ消えても、テストは緑のままになる。対応表の件数を固定して欠落を数える。
- Architecture fitness test: テスト内の期待値が spec §15 と一致すること。docs の閾値とテストの境界値が一致すること。対応表の欠落 0 件。
- Load/failure/security validation: 旧実装に対して新しいテストが落ちること。既存 subs 系テストが新構成で緑であること。
