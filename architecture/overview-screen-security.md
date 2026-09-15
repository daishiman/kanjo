---
graph_node_id: "arch-overview-security"
artifact_kind: "architecture"
artifact_subtypes: ["security"]
title: "概況画面改善 — 入力検証の二重化と書込の直列化"
project_id: "kanjo"
domain: "security"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: []
tags: ["overview-screen", "security"]
file_path: "architecture/overview-screen-security.md"
template_id: "architecture"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pending"
confirmation_evidence: {"evaluator": "system-spec-harness:assign-system-spec-completeness-evaluator", "evidence_ref": "system-spec/archive/2026-09-14-overview-screen/completeness-findings.json", "evaluated_digest": "9d82c40239a577329a95e8673f857b3daef7aa3fc1b4bd2f2fbb98b14a47afa0"}
source_lineage: {"origin_kind": "system-spec-harness", "source_plugin": "system-spec-harness", "source_path": "system-spec/archive/2026-09-14-overview-screen/security.md", "source_version": "0.1.14", "source_digest": "d4114fbfaf233de302221927cc9ac76e37b3a395b499a9afa1c7ebbb401afca3", "imported_at": "2026-09-15T00:18:48Z"}
created_at: "2026-09-14T13:09:32Z"
updated_at: "2026-09-15T00:18:48Z"
depends_on: ["spec-overview-screen"]
related_nodes: ["arch-overview-ui-ux", "arch-overview-frontend", "arch-overview-backend", "arch-overview-database", "arch-overview-auth", "arch-overview-infrastructure", "arch-overview-maintenance-ops"]
resource_scope: ["packages/api/src/index.ts", "packages/api/src/index.test.ts", "packages/web/public/_headers", "packages/api/src/canonical-mutation-fence.ts", "scripts/hooks/guard-real-data.sh"]
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
classification_reason: "system-spec の security 章 (web 確定・他 platform 対象外) を領域別の architecture 制約として参照する。章の関心に合わせて subtype を security とし、architecture-security.md の節を Subtype architecture 節へ合成した。"
classification_candidates: [{"artifact_kind": "architecture", "confidence": 1.0, "candidate_path": "architecture/overview-screen-security.md"}]
tracker_binding: "none"
beads_linkage: null
github_publication: {"mode": "local_only", "project_aliases": [], "labels": [], "milestone": null}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"policy": "manual", "status": "not_applicable", "source": null, "completed_at": null, "reconciled_at": null, "evidence_refs": []}
implementation_readiness: {"status": "complete", "missing_sections": [], "checked_at": "2026-09-14T13:09:32Z"}
serves_goals: ["G2", "G5"]
---

# Architecture overview

概況画面改善 — 入力検証の二重化と書込の直列化。正本は `system-spec/security.md` (system-spec-harness 0.1.14) で、本書は dev-graph から参照する領域別の制約だけを持つ。仕様の入口は `specs/spec-overview-screen.md`。

## Context and drivers

- Business/technical context: CSP は 'self' に限定され (`packages/api/src/index.ts` と `packages/web/public/_headers`)、`packages/api/src/index.test.ts` が両者の差分を検査する。外部送信なしは connect-src 'self' が担保する。security:content (`scripts/hooks/guard-real-data.sh`) があるため、fixture とサンプルは匿名・架空に限る。書込は CANONICAL_MUTATION_ROUTES (`packages/api/src/canonical-mutation-fence.ts`) に登録し、衝突時は 409 canonical_write_busy。
- Quality attribute priorities: G2, G5 に資する。外部送信なしと、未処理キューの明細を安全に表示・操作できることを最優先にする。
- Constraints: C2: 外部送信なし。CSP を広げない。新テーブルに明細本文の写しを持たない。

## Goals and non-goals

- Goals:
  - G2: 保留と月次レビューの入力 (kind、itemKey、month) を core とルートの双方で検証し、書込を直列化する。
  - G5: CSP と外部送信なしを維持し、明細はテキストとして描画する。
- Non-goals:
  - CSP の変更や外部ドメインの許可
  - 認証方式の変更 (auth 章の範囲)

## System context and boundaries

- Users/external systems: 利用者 1 名。外部送信先は無い。
- Trust/deployment/data boundaries: ブラウザと同一オリジンの Worker の間。入力はパスとクエリから入り、D1 へ書かれる。
- Context diagram: `system-spec/index.md` の章相互参照を参照する。

## Container and component view

| Container/Component | Responsibility | Interface | Data owner | Deployment unit |
|---|---|---|---|---|
| CSP ヘッダ | 'self' 限定、connect-src 'self' | index.ts と _headers | packages/api / packages/web | Worker |
| 入力検証 (ルート) | kind / itemKey / month / scope の検査、違反は 400 | HTTP | packages/api | Worker |
| 入力検証 (core) | 同じ規則を純関数で再検査 | 関数引数 | packages/core | core |
| canonicalMutationFence | 書込の直列化、衝突は 409 | middleware | packages/api | Worker |
| 明細の描画 | テキストとして描画 | React | packages/web | web ビルド |

## Cross-cutting contracts

- Identity/access: authGuard の後ろに置く (auth 章)。
- Errors/resilience: 400 / 409 canonical_write_busy を返し、内部情報をエラー本文に含めない。
- Observability/audit: 既存のログの範囲。月次レビューの記録者を残す。
- Configuration/secrets: N/A: 秘密情報を追加しない。
- Compatibility/versioning: CSP の値と index.test の差分検査を変えない。

## Subtype architecture

- Frontend: N/A: 本章の関心外
- Backend: N/A: 本章の関心外
- Infrastructure: N/A: 本章の関心外
- Data: N/A: 本章の関心外
- Security: 下記 architecture-security.md を合成

### Security architecture

#### Assets, actors and threat model

資産は取引明細 (金額・日付・内容) と利用者の判断記録。主体は認証済みの利用者 1 名。脅威は不正な itemKey による過大な入力、明細の内容を HTML として解釈させる注入、同時書込による記録の破損、外部への送信である。

#### Identity and authorization

既存の authGuard に従い、本章では新しい識別・認可を持たない。

#### Data and secret protection

新テーブルは参照キーと内容指紋だけを持ち、明細本文の写しを持たない。fixture は匿名・架空とし、security:content の検査を通す。

#### Application and supply-chain controls

入力検証を core とルートの二重に置く (kind は 3 値、itemKey は長さ上限、month は YYYY-MM)。書込は CANONICAL_MUTATION_ROUTES に登録する。明細はテキストとして描画し HTML として挿入しない。依存ライブラリを追加しない。

#### Detection and response

新しい検知基盤は追加しない。CI の index.test (CSP 差分) と security:content で逸脱を止める。

#### Security verification

API テストで入力検証の 400 と 409 の衝突を確かめる。index.test で CSP が 'self' のままであることを確かめる。DOM テストで明細の文字列がテキストとして描画されることを確かめる。

## Architecture decisions

決定本文・代替案・帰結の正本は `system-spec/00-requirements-definition.md` の決定表。本章は dec-recommendation-confidence-source (外部送信なしを満たす既存根拠の統合) と dec-review-state-storage (明細本文の写しを持たない D1 テーブル) を参照し、領域固有の制約だけを上節に記録する。

## Delivery, migration and rollback

- Build/deploy topology: 既存の CI (static-checks、test-api) と deploy.yml の経路で配信する。
- Migration sequence: 入力検証と書込の登録をルート追加と同じ PR に含める。
- Rollback trigger/procedure: CSP 差分検査や security:content が落ちたら PR を差し戻し、配信済みなら直前のビルドへ戻す。

## Risks and verification

- Risk/assumption: 片側だけの入力検証では、core を別経路から呼んだときに検査が抜ける。二重に置いて同じ規則をテストする。
- Architecture fitness test: index.test の CSP 差分検査と、入力検証の境界値テストを CI で常時実行する。
- Load/failure/security validation: itemKey の長さ上限超過、不正な kind・month、同時書込の 409 を API テストで確かめる。
