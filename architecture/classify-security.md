---
graph_node_id: "arch-classify-security"
artifact_kind: "architecture"
artifact_subtypes: ["security"]
title: "明細仕分け — zod の長さ制限・フェンス登録・外部送信なし・証憑面を持たない"
project_id: "kanjo"
domain: "security"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: []
tags: ["classify", "security"]
file_path: "architecture/classify-security.md"
template_id: "architecture"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluator": "system-spec-harness:assign-system-spec-completeness-evaluator", "evidence_ref": "system-spec/completeness-findings.json", "evaluated_digest": "9d1fbf27441cf7ee74f85d419f4611beeda5aac386765a3f669b0a939c1508d6"}
source_lineage: {"origin_kind": "system-spec-harness", "source_plugin": "system-spec-harness", "source_path": "system-spec/security.md", "source_version": "0.1.14", "source_digest": "9d1fbf27441cf7ee74f85d419f4611beeda5aac386765a3f669b0a939c1508d6", "imported_at": "2026-09-19T14:03:38Z"}
created_at: "2026-09-19T14:03:38Z"
updated_at: "2026-09-19T14:03:38Z"
depends_on: ["spec-classify-screen"]
related_nodes: ["arch-classify-ui-ux", "arch-classify-frontend", "arch-classify-backend", "arch-classify-database", "arch-classify-infrastructure", "arch-classify-maintenance-ops", "arch-classify-auth"]
resource_scope: ["packages/api/src/routes/classify.ts", "packages/api/src/canonical-mutation-fence.ts", "packages/api/src/import-lifecycle-pure.test.ts", "packages/web/src/pages/classify/", "packages/web/public/_headers", "packages/api/src/ai", "scripts/hooks/guard-real-data.sh"]
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
classification_reason: "system-spec の security 章 (web 確定・他 platform 対象外) を領域別の architecture 制約として参照する。"
classification_candidates: [{"artifact_kind": "architecture", "confidence": 1.0, "candidate_path": "architecture/classify-security.md"}]
tracker_binding: "none"
beads_linkage: null
github_publication: {"mode": "local_only", "project_aliases": [], "labels": [], "milestone": null}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"policy": "manual", "status": "not_applicable", "source": null, "completed_at": null, "reconciled_at": null, "evidence_refs": []}
implementation_readiness: {"status": "complete", "missing_sections": [], "checked_at": "2026-09-19T14:03:38Z"}
serves_goals: ["G2", "G3", "G4", "G5"]
---

# Architecture overview

明細仕分け — zod の長さ制限・フェンス登録・外部送信なし・証憑面を持たない。`system-spec/security.md` は承認時入力、本書は入力検証・変更系の直列化・外部送信の禁止・攻撃面の制約を持つ。認証と利用者単位の認可は `architecture/classify-auth.md`。

## Context and drivers

- Business/technical context: 既存の classify route は zod で入力を検証し、`packages/api/src/canonical-mutation-fence.ts` の `CANONICAL_MUTATION_ROUTES` に `PUT /transactions/:txId/class|edit`・分割・`/data/deletions`・`/data/undo`・ルールの `POST` / `PATCH` / `PUT` / `DELETE` などを登録している。consumer は型の union (`CanonicalConsumer`) で、lease が取れないと 409 `canonical_write_busy`。`import-lifecycle-pure.test.ts` が登録ルート数を数えている。`packages/web/public/_headers` が CSP を持つ。`packages/api/src/ai` は仕分けから呼ばない。`scripts/hooks/guard-real-data.sh` が実データの持ち込みを止める (qa-classify-security-web-evidence-001)。
- Quality attribute priorities: G2・G3・G4・G5 に資する。OWASP ASVS の入力検証と、取込データを外部へ送らない約束 (『取込データは外部送信しません』) を守る。
- Constraints: 証憑を受け付けない (qa-classify-decision-001)。外部 LLM を呼ばない (qa-classify-decision-003)。CSP を緩めない。

## Goals and non-goals

- Goals:
  - G2: 提案と信頼度を決定論の規則で出し、明細を外部へ送らない。
  - G3: 一括保存の件数に上限を置き、上限超過を 400 で止める。明細ごとの検証の失敗を他の明細に波及させない。
  - G4: ルールの条件 (取引先・キーワード) と分割の型を zod で検証し、ルール適用をフェンスで取込と直列化する。
  - G5: 保存フィルタの名前と条件 JSON の長さを制限し、履歴は変更経路と同じ書込で残す。
- Non-goals:
  - 証憑のアップロード・保存・プレビュー
  - 外部 LLM・外部 API への送信
  - CSP・`_headers` の緩和
  - 新しい認証方式 (`architecture/classify-auth.md`)

## System context and boundaries

- Users/external systems: ログイン済みの利用者本人。外部サービスは呼ばない。
- Trust/deployment/data boundaries: 信頼境界は `/api/*` の入口。本文・クエリは zod を通るまで信頼しない。端末の localStorage の下書きはサーバへ送らない。
- Context diagram: `system-spec/index.md` の章相互参照を参照する。

## Container and component view

| Container/Component | Responsibility | Interface | Data owner | Deployment unit |
|---|---|---|---|---|
| zod スキーマ (classify route) | 新経路の本文・クエリの型・長さ・件数を検証する | Hono route | packages/api | Worker |
| `canonicalMutationFence` | 新しい変更系経路を取込の洗替えと直列化する | Hono ミドルウェア | packages/api | Worker |
| core の提案 | 決定論の規則で提案と信頼度を出す (外部送信なし) | 純関数 | packages/core | Worker |
| `_headers` | CSP を含む応答ヘッダ (変更しない) | 静的ファイル | packages/web | 静的配信 |
| 画面の証憑欄の代わり | freee で管理する旨の案内だけを出し、入力を持たない | React | packages/web | 静的配信 |

## Cross-cutting contracts

- Identity/access: `architecture/classify-auth.md` に従う。
- Errors/resilience: 検証違反と上限超過は 400。エラー応答に SQL・スタック・他の明細の値を含めない。
- Observability/audit: 取引の履歴が変更の記録を担う。セキュリティの監査信号は追加しない。
- Configuration/secrets: 新しい秘密情報を持たない。
- Compatibility/versioning: フェンスの登録を足すときは `CanonicalConsumer` の union と登録ルート数のテストを同じ変更で更新する。

## Subtype architecture

- Frontend: N/A: 本章の関心外 (`architecture/classify-frontend.md`)
- Backend: N/A: 本章の関心外 (`architecture/classify-backend.md`)
- Infrastructure: N/A: 本章の関心外 (`architecture/classify-infrastructure.md`)
- Data: N/A: 本章の関心外 (`architecture/classify-database.md`)
- Security: 下記 Security architecture を合成

### Security architecture

#### Assets, actors and threat model

- Protected assets/data classification: 明細の手当て・分割・ルール・保存フィルタ・取引の履歴。家計と事業の取引内容。
- Actors/adversaries/abuse cases: 大きな本文や長い文字列で Worker と D1 を疲弊させる。条件 JSON に想定外の構造を入れる。ルール適用を取込の洗替えと同時に走らせて手当てを失わせる。画面に証憑の入力があると思って機微な書類を置こうとする。
- Trust boundaries/data flows: ブラウザ → zod → core → D1。外部への流れは無い。

#### Identity and authorization

- Authentication/session/federation: `architecture/classify-auth.md` に従う。
- Authorization model and deny-by-default rules: 利用者本人のデータだけ。新しいロールを足さない。
- Tenant/resource ownership enforcement: 全ての読み書きに `user_id` の条件を付ける (`architecture/classify-auth.md`)。

#### Data and secret protection

- Encryption in transit/at rest/key ownership: 既存の HTTPS と D1 に従う。
- Secret source/rotation/redaction: 新しい秘密情報を持たない。エラー応答に内部情報を含めない。
- Retention/deletion/privacy requests: 明細を外部へ送らない。証憑を受け付けず、保存しない。下書きは端末に閉じ、保存成功で消す。

#### Application and supply-chain controls

- Input/output validation and injection defenses: 全ての新経路を zod で検証する。上限は一括 100 件・フィルタ名 40 字・キーワード 100 字・条件 JSON 2000 字 (agent 推定・利用者未確認、根拠 qa-classify-security-web-002)。SQL は Drizzle のバインドで組み、文字列連結しない。条件 JSON は保存前に zod で構造を検証し、未知のキーを捨てる。
- 変更系のフェンス登録: `POST /api/transactions/bulk` (`tx_edits`・`tx_splits`・`tx_history`)、`POST /api/rules/:id/apply` (`rules`・`tx_edits`・`tx_splits`・`tx_history`)、`POST` / `DELETE /api/saved-filters` (`saved_filters`) (agent 推定・利用者未確認、根拠 qa-classify-security-web-002)。ルールのプレビュー (`POST /api/rules/preview`) は書かないため登録しない。
- Dependency/artifact provenance/signing/SBOM: 新しい依存を足さない。
- CI/CD branch/review/environment protections: 既存の CI とレビューに従う。実データはテストに持ち込まない (`guard-real-data.sh`)。

#### Detection and response

- Audit events/security telemetry/alerts: N/A: 新しい監査信号を追加しない。
- Incident response/revocation/recovery: 誤ったルール適用は取引の履歴と既存の `/data/undo` で戻す。
- Vulnerability handling and SLA: 既存の運用に従う。

#### Security verification

API 統合テストで、上限を 1 つ超える入力 (101 件・41 字・101 字・2001 字) が 400 になり、上限ちょうどは通ることを確かめる。フェンスの登録ルート数のテストを新経路のぶん更新し、取込の洗替えと重なった一括保存・ルール適用が 409 になることを確かめる。`packages/api/src/ai` を仕分けの経路から import していないこと、`_headers` の CSP が変わっていないこと、画面に証憑の入力要素が無いことを確かめる。

## Architecture decisions

| Basis (qa_ref) | Decision | Alternatives | Trade-on rationale | Consequences |
|---|---|---|---|---|
| qa-classify-security-web-001 | 全ての新経路を zod で検証し、長さと件数に上限を置く | 画面の入力制限に頼る | API を直接叩かれても守れる | 上限の値を画面とテストで揃える |
| qa-classify-security-web-002 | 一括 100 件・名前 40 字・キーワード 100 字・条件 JSON 2000 字 (agent 推定・利用者未確認) | 上限を置かない | Worker と D1 の負荷を 1 要求で抑える | 101 件目以降は分けて送る |
| qa-classify-security-web-001 | 変更系の新経路をフェンスに登録する | 登録しない | 取込の洗替えと重なって手当てを失う事故を防ぐ | `CanonicalConsumer` と登録ルート数のテストを更新する |
| qa-classify-decision-003 | 外部送信しない決定論の提案 | 外部 LLM | 『取込データは外部送信しません』と一致する | 規則に無い取引は提案が出ない |
| qa-classify-decision-001 | 証憑を再導入しない | 証憑欄を戻す | 機微な書類の保管責任を持たない | 画面は freee で管理する旨を案内する |

## Delivery, migration and rollback

- Build/deploy topology: 既存 Worker と web の静的配信。
- Migration sequence: zod スキーマと上限の定義 → フェンス登録と `CanonicalConsumer` の拡張 → 登録ルート数のテストの更新 → 新経路の配信。
- Rollback trigger/procedure: セキュリティテストが落ちたら差し戻し、配信済みなら Worker を直前版へ戻す。

## Risks and verification

- Risk/assumption: 新経路をフェンスに登録し忘れると、取込の洗替えと一括保存が重なって手当てが失われる。登録ルート数のテストは数だけを見るため、新経路ごとに 409 になることを個別に確かめる。
- Risk/assumption: 条件 JSON を保存フィルタから読み戻して一覧のクエリに使うとき、保存時と同じ zod を通さないと古い形や改ざんされた値がそのまま SQL の組み立てに入る。読込時にも検証する。
- Architecture fitness test: 仕分けの経路が `packages/api/src/ai` や外部 URL への `fetch` を含まないこと。`_headers` が変わっていないこと。
- Load/failure/security validation: 上限超過が 400 になること。フェンスの競合が 409 になること。
