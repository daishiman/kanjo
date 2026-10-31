---
graph_node_id: "arch-guide-maintenance-ops"
artifact_kind: "architecture"
artifact_subtypes: ["infrastructure"]
title: "使い方 — check:guide-screen (KANJO_VISUAL_SCOPE=guide) を verify:full に足し、境界値と防衛ラインの説明文をテストで固定し、記録は docs/guide-screen/ に置き、check-glossary のため用語と目安で全用語を出し続ける"
project_id: "kanjo"
domain: "maintenance-ops"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: []
tags: ["guide", "maintenance-ops"]
file_path: "architecture/guide-maintenance-ops.md"
template_id: "architecture"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluator": "system-spec-harness:assign-system-spec-completeness-evaluator", "evidence_ref": "system-spec/completeness-findings.json", "evaluated_digest": "cc113059f1c56ef51d31fd20416c85d51894eaba0cb8c8af7f351e8acafe56e6"}
source_lineage: {"origin_kind": "system-spec-harness", "source_plugin": "system-spec-harness", "source_path": "system-spec/maintenance-ops.md", "source_version": "0.1.14", "source_digest": "cc113059f1c56ef51d31fd20416c85d51894eaba0cb8c8af7f351e8acafe56e6", "imported_at": "2026-09-23T13:27:15Z"}
created_at: "2026-09-23T13:27:15Z"
updated_at: "2026-09-23T13:27:15Z"
depends_on: ["spec-guide-screen"]
related_nodes: ["arch-guide-ui-ux", "arch-guide-frontend", "arch-guide-backend", "arch-guide-database", "arch-guide-auth", "arch-guide-security", "arch-guide-infrastructure"]
resource_scope: ["package.json", "packages/web/package.json", "packages/web/scripts/check-financial-visuals.mjs", "scripts/check-glossary.mjs", "packages/web/src/guide.dom.test.tsx", "packages/web/src/guide-sections.test.ts", "packages/web/src/common-shell.dom.test.tsx", "packages/core/src/guide-screen.ts", "docs/cash-screen"]
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
classification_candidates: [{"artifact_kind": "architecture", "confidence": 1.0, "candidate_path": "architecture/guide-maintenance-ops.md"}]
tracker_binding: "none"
beads_linkage: null
github_publication: {"mode": "local_only", "project_aliases": [], "labels": [], "milestone": null}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"policy": "manual", "status": "not_applicable", "source": null, "completed_at": null, "reconciled_at": null, "evidence_refs": []}
implementation_readiness: {"status": "complete", "missing_sections": [], "checked_at": "2026-09-23T13:27:15Z"}
serves_goals: ["G1", "G3"]
---

# Architecture overview

使い方 — 描画検査 `check:guide-screen` (`KANJO_VISUAL_SCOPE=guide node scripts/check-financial-visuals.mjs`) を新設して `verify:full` に足す。信頼度の境界値 (80/79・50/49) と、防衛ラインの定数から組んだ説明文を core の単体テストで固定する。画面の規則・設計判断・証跡は `docs/guide-screen/{rules,design-decisions,evidence}.md` に新設して置く。`scripts/check-glossary.mjs` が落ちないよう、『用語と目安』の節で用語集の全用語を出し続ける (qa-guide-maintenance-ops-web-001)。`system-spec/maintenance-ops.md` は承認時入力、本書は回帰の範囲と記録の置き場所の制約を持つ。行番号は 2026-09-23 時点の現物で確かめた値である。

## Context and drivers

- Business/technical context: `verify:full` (`package.json:40`) は test → typecheck → lint → build → web の描画検査 (`check:thead` から `check:cash-screen` まで) → `preview:smoke` の順。`lint` (`package.json:24`) は `check-glossary.mjs` を含む。前例は `check:cash-screen` (`packages/web/package.json:24`) で、`check-financial-visuals.mjs` は `VISUAL_SCOPE` を :13 で読み、cash のスコープを :1782 で分岐する。記録の前例は `docs/cash-screen/{rules,design-decisions,evidence}.md` (qa-guide-maintenance-ops-web-evidence-001)。
- Quality attribute priorities: G1・G3 に資する。Clean Code の『境界値は両側をテストする』と『説明文は定数から組み、定数の変更で説明がずれないことをテストで固定する』を適用する。
- Constraints: vitest の expect (出典 vitest-expect 5.0.1)。`verify:full` は 4175 の vite が前提 (`check:financial-routes`)。

## Goals and non-goals

- Goals:
  - G1: 使い方画面の見た目の退行 (4 ステップの帯・読み解き・目次・フッタ) を描画検査で止める。
  - G3: 信頼度の段階と防衛ラインの説明が、core の定数と食い違わないことをテストで止める。
- Non-goals:
  - 新しい CI ジョブ・ワークフロー
  - 画像比較の閾値の変更
  - 既存スコープ (`all` / `cash` / `ai` 等) の内容変更

## System context and boundaries

- Users/external systems: 開発者のローカルと CI (GitHub Actions の既存ジョブ)。
- Trust/deployment/data boundaries: 描画検査は seed したローカル環境だけを読む。本番データに触れない。
- Context diagram: `system-spec/index.md` の章相互参照を参照する。

## Container and component view

| Container/Component | Responsibility | Interface | Data owner | Deployment unit |
|---|---|---|---|---|
| `check:guide-screen` (`packages/web/package.json`) | guide スコープの描画検査 | npm script | packages/web | CI |
| `check-financial-visuals.mjs` の guide 分岐 | 使い方画面の描画と崩れの判定 | Node script | packages/web | CI |
| core の単体テスト (`guide-screen` の隣) | 境界値 80/79・50/49、防衛ラインの説明文 | vitest | packages/core | CI |
| `guide.dom.test.tsx` / `guide-sections.test.ts` | 節・URL・検索・api 失敗時の本文 | vitest | packages/web | CI |
| `scripts/check-glossary.mjs` | 用語集の全用語が画面に出ること | lint の一段 | scripts | CI |
| `docs/guide-screen/` (新設) | rules / design-decisions / evidence | Markdown | docs | リポジトリ |

## Cross-cutting contracts

- Identity/access: N/A: 本章の関心外。
- Errors/resilience: 描画検査に `/api/guide` の失敗 (503) の場面を 1 つ含め、本文が描かれることを見る。
- Observability/audit: 検査の結果は `docs/guide-screen/evidence.md` に日付と commit で残す。
- Configuration/secrets: N/A。
- Compatibility/versioning: `verify:full` の末尾の順序 (描画検査 → `preview:smoke`) を保ち、`check:cash-screen` の後ろに足す。

## Subtype architecture

- Frontend: N/A: 本章の関心外
- Backend: N/A: 本章の関心外
- Infrastructure: 下記 Operations architecture を合成
- Data: N/A: 本章の関心外
- Security: N/A: 本章の関心外

### Operations architecture

#### Fixture authority

描画検査の数値は `check-financial-visuals.mjs` の guide スコープが seed する固定データを正とする。境界値のテストは core の純関数に直接値を渡す (DB を使わない)。`samples/*.csv` は `seed-local.mjs` の生成物なので直接編集しない。

#### Documentation upkeep

`docs/guide-screen/rules.md` に画面の規則 (4 ステップ・信頼度の段階と %・ヘッダは防衛ライン・フッタの 1 文目と補足 3 か所)、`design-decisions.md` に決定 (qa-guide-decision-009〜011 と agent 推定の値)、`evidence.md` に検査結果を置く。ガイド本文の変更時は用語集と同じ commit で直す。

#### Regression scope

`check:guide-screen` は使い方画面だけを見る。共通シェルのフッタの変更は `common-shell.dom.test.tsx` (現行 :182-185 は決定 011 と逆向きの期待で、書き換えが要る) と既存の `all` スコープで見る。防衛ラインの値そのものは既存の `defenseLine` のテストで見る (値を変えない)。

#### Operations verification

`pnpm --filter @kanjo/web run check:guide-screen` が単独で緑、`verify:full` が末尾まで緑、`lint` の `check-glossary` が緑であること。デバッグ用のテストは scratchpad に置き、空の `*.test.ts` をリポジトリに残さない。

### Infrastructure architecture (運用の観点)

#### Environments and topology

ローカル (wrangler dev + 4175 の vite) と CI の既存ジョブ。環境を足さない。

#### Compute and storage

N/A: 検査の成果物 (スクリーンショット) は既存の出力先のまま。

#### IaC and delivery

`packages/web/package.json` に `check:guide-screen` を 1 行、`package.json` の `verify:full` に 1 段を足すだけ。

#### Secrets and access

N/A: 検査に秘密情報を使わない (`.dev.vars` の既存の前提のまま)。

#### Reliability and recovery

CI の api ジョブの cancelled はランナーのばらつきとして同一 commit を再実行する。描画検査の時間が延びる場合はスコープを分けて足し、timeout は上げない。

#### Infrastructure verification

CI の既存ジョブで `verify:full` の新しい段が走ったことをログで確かめる。

## Architecture decisions

| Basis (qa_ref) | Decision | Alternatives | Trade-on rationale | Consequences |
|---|---|---|---|---|
| qa-guide-maintenance-ops-web-001 | `check:guide-screen` を `KANJO_VISUAL_SCOPE=guide` で新設し `verify:full` に足す | 新しい検査スクリプト | 前例 `check:cash-screen` と同じ仕組みで保守が 1 か所 | `check-financial-visuals.mjs` がさらに長くなる |
| qa-guide-maintenance-ops-web-001 | 境界値 80/79・50/49 と防衛ラインの説明文を core でテストする | DOM テストだけ | 純関数で速く、定数の変更に追従する | core のテストが増える |
| qa-guide-maintenance-ops-web-001 | 記録を `docs/guide-screen/` に新設する | 既存 docs に追記 | 前例 `docs/cash-screen/` と同じ形 | 画面ごとに 3 ファイル増える |
| qa-guide-maintenance-ops-web-001 | 『用語と目安』で全用語を出し続ける | 節を絞る | `check-glossary` を緑に保つ | 節が長くなる |

## Delivery, migration and rollback

- Build/deploy topology: CI の既存ジョブ。
- Migration sequence: core の単体テスト → web の DOM テスト → `check:guide-screen` の追加 → `verify:full` への追加 → `docs/guide-screen/` の記録。
- Rollback trigger/procedure: `check:guide-screen` が不安定 (同一 commit で結果が揺れる) なら `verify:full` から一時的に外し、`docs/guide-screen/evidence.md` に理由を残す。

## Risks and verification

- Risk/assumption: `@media (pointer: fine)` のような条件は CI の headless Chrome (pointer:none) で効かず、ローカルだけ緑になる。否定形で書く。
- Risk/assumption: 境界値のテストが新しい実装だけを見ていると、旧実装でも緑になる。旧実装 (Overview.tsx:209-210 の 80/60) で落ちることを一度確かめる。
- Architecture fitness test: `verify:full` の文字列に `check:guide-screen` が含まれること。
- Load/failure/security validation: `/api/guide` 503 の場面で本文が描かれること。
