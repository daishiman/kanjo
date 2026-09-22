---
graph_node_id: "arch-budget-security"
artifact_kind: "architecture"
artifact_subtypes: ["security"]
title: "予算 — zod の型と範囲・行数上限・フェンス登録・外部送信なし・下書きの消去"
project_id: "kanjo"
domain: "security"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: []
tags: ["budget", "security"]
file_path: "architecture/budget-security.md"
template_id: "architecture"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluator": "system-spec-harness:assign-system-spec-completeness-evaluator", "evidence_ref": "system-spec/completeness-findings.json", "evaluated_digest": "b796b626b18f8470e2c88875dca536473b2a7b53652fc411602769c7900057d2"}
source_lineage: {"origin_kind": "system-spec-harness", "source_plugin": "system-spec-harness", "source_path": "system-spec/security.md", "source_version": "0.1.14", "source_digest": "b796b626b18f8470e2c88875dca536473b2a7b53652fc411602769c7900057d2", "imported_at": "2026-09-21T13:59:08Z"}
created_at: "2026-09-21T13:59:08Z"
updated_at: "2026-09-21T13:59:08Z"
depends_on: ["spec-budget-screen"]
related_nodes: ["arch-budget-ui-ux", "arch-budget-frontend", "arch-budget-backend", "arch-budget-database", "arch-budget-infrastructure", "arch-budget-maintenance-ops", "arch-budget-auth"]
resource_scope: ["packages/api/src/routes/budget-plans.ts", "packages/api/src/routes/settings.ts", "packages/api/src/canonical-mutation-fence.ts", "packages/api/src/import-active.ts", "packages/api/src/import-lifecycle-pure.test.ts", "packages/api/src/ai", "packages/web/src/pages/budget/", "packages/web/public/_headers", "scripts/hooks/guard-real-data.sh"]
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
classification_candidates: [{"artifact_kind": "architecture", "confidence": 1.0, "candidate_path": "architecture/budget-security.md"}]
tracker_binding: "none"
beads_linkage: null
github_publication: {"mode": "local_only", "project_aliases": [], "labels": [], "milestone": null}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"policy": "manual", "status": "not_applicable", "source": null, "completed_at": null, "reconciled_at": null, "evidence_refs": []}
implementation_readiness: {"status": "complete", "missing_sections": [], "checked_at": "2026-09-21T13:59:08Z"}
serves_goals: ["G2", "G3", "G4"]
---

# Architecture overview

予算 — zod の型と範囲・行数上限・フェンス登録・外部送信なし・下書きの消去。`system-spec/security.md` は承認時入力、本書は入力検証・変更系の直列化・外部送信の禁止・端末の下書きの扱いの制約を持つ。認証と利用者単位の認可は `architecture/budget-auth.md`。

## Context and drivers

- Business/technical context: 既存の予算の保存 `PUT /api/budgets` は `packages/api/src/routes/settings.ts` で zod (`科目名 60 字以下・月額は 0 以上の整数か null`) を通し、`packages/api/src/canonical-mutation-fence.ts` の `CANONICAL_MUTATION_ROUTES` に `consumers: ['budgets']` で登録されている。consumer は型の union (`CanonicalConsumer`) で、`budgets` は `packages/api/src/import-active.ts` の JSON snapshot の consumer に含まれる。lease が取れないと 409 `canonical_write_busy`。`packages/api/src/import-lifecycle-pure.test.ts` が登録ルート数を数えている。`POST /api/budgets/suggest` は core の `suggestBudgets` を呼ぶだけで外部へ送らない。`packages/web/public/_headers` の CSP は `connect-src 'self'` で外部への接続を持たない。
- Quality attribute priorities: G2・G3・G4 に資する。OWASP ASVS (V11 業務ロジック: 予算の保存をフェンスに登録して取込の洗替えと重ならないようにする。外部送信の経路を作らない。下書きは保存成功とログアウトで消す) を適用する (https://owasp.org/www-project-application-security-verification-standard/ 5.0.0)。本章での適用は zod での型と範囲の制限と 1 回の保存の行数上限。
- Constraints: 外部 LLM を呼ばず自動提案を決定論で出す (qa-budget-decision-003)。CSP (`_headers`) を緩めない。取込データと予算を外部へ送信しない。

## Goals and non-goals

- Goals:
  - G2: 自動提案と見通しコメントを core の決定論の式と定型文で出し、取込データと予算を外部へ送らない (qa-budget-decision-003)。
  - G3: 保存の本文を zod で検証し、年額・調整額を整数で範囲を制限し、科目名と理由の長さを制限し、1 回の保存の行数に上限を置く。保存をフェンスに登録して取込の洗替えと直列化する (qa-budget-security-web-001)。
  - G4: 調整の理由を含む下書きを端末の localStorage にだけ置き、保存成功とログアウトで消し、サーバへは保存操作でだけ送る。
- Non-goals:
  - 外部 LLM・外部 API への送信
  - CSP・`_headers` の緩和
  - 新しい認証方式 (`architecture/budget-auth.md`)
  - 予算の版管理・変更履歴の監査ログ

## System context and boundaries

- Users/external systems: ログイン済みの利用者本人。外部サービスは呼ばない。
- Trust/deployment/data boundaries: 信頼境界は `/api/*` の入口。本文・クエリは zod を通るまで信頼しない。端末の localStorage の下書きは保存操作まで端末に閉じる。
- Context diagram: `system-spec/index.md` の章相互参照を参照する。

## Container and component view

| Container/Component | Responsibility | Interface | Data owner | Deployment unit |
|---|---|---|---|---|
| zod スキーマ (`routes/budget-plans.ts` 予定) | 開始月・行数・科目名・種別・年額・調整額・理由の型と範囲を検証する | Hono route | packages/api | Worker |
| `canonicalMutationFence` | `PUT /api/budget-plans` を取込の洗替えと直列化する | Hono ミドルウェア | packages/api | Worker |
| core の自動提案 | 決定論の式で提案と根拠を出す (外部送信なし) | 純関数 | packages/core | Worker |
| 画面の下書き (`pages/budget/draft.ts` 予定) | 下書きを端末に置き、保存成功とログアウトで消す | localStorage | packages/web | 静的配信 |
| `_headers` | CSP を含む応答ヘッダ (変更しない) | 静的ファイル | packages/web | 静的配信 |

## Cross-cutting contracts

- Identity/access: `architecture/budget-auth.md` に従う。
- Errors/resilience: 検証違反と行数上限の超過は 400。フェンスの競合は 409。エラー応答に SQL・スタック・他の行の値を含めない。
- Observability/audit: N/A: セキュリティの監査信号は追加しない。
- Configuration/secrets: 新しい秘密情報を持たない。
- Compatibility/versioning: フェンスの登録を足すときは `CanonicalConsumer` の union (`budget_plans`) と登録ルート数のテストを同じ変更で更新する。旧 `PUT /api/budgets` の登録は旧経路が残る間は外さない。

## Subtype architecture

- Frontend: N/A: 本章の関心外 (`architecture/budget-frontend.md`)
- Backend: N/A: 本章の関心外 (`architecture/budget-backend.md`)
- Infrastructure: N/A: 本章の関心外 (`architecture/budget-infrastructure.md`)
- Data: N/A: 本章の関心外 (`architecture/budget-database.md`)
- Security: 下記 Security architecture を合成

### Security architecture

#### Assets, actors and threat model

- Protected assets/data classification: 予算対象の期間ごとの科目別の年額・調整額・調整の理由。取込データ (売上と経費の実績)。理由には事業の計画 (採用・値上げなど) が入りうる。
- Actors/adversaries/abuse cases: 大きな本文や極端な数値で Worker と D1 を疲弊させる・集計を桁あふれさせる。長い理由や HTML を入れて画面に注入する。予算の保存を取込の洗替えと同時に走らせて整合を崩す。共用端末で前の利用者の下書き (理由) が読まれる。
- Trust boundaries/data flows: ブラウザ → zod → D1 (保存)。D1 → core → ブラウザ (取得)。外部への流れは無い。

#### Identity and authorization

- Authentication/session/federation: `architecture/budget-auth.md` に従う。
- Authorization model and deny-by-default rules: 利用者本人のデータだけ。新しいロールを足さない。
- Tenant/resource ownership enforcement: 全ての読み書きに `user_id` の条件を付ける (`architecture/budget-auth.md`)。

#### Data and secret protection

- Encryption in transit/at rest/key ownership: 既存の HTTPS と D1 に従う。
- Secret source/rotation/redaction: 新しい秘密情報を持たない。エラー応答に内部情報を含めない。
- Retention/deletion/privacy requests: 予算と取込データを外部へ送らない。下書きは保存成功とログアウトで消し、サーバへは保存操作でだけ送る。ログアウトでは `kanjo:budget:draft:` で始まるキーを消す (agent 推定・利用者未確認、根拠 qa-budget-auth-web-002)。

#### Application and supply-chain controls

- Input/output validation and injection defenses: `PUT /api/budget-plans` の本文を zod で検証する。上限は 1 回の保存 200 行・科目名 60 字・理由 100 字、年額と調整額は ±10,000,000,000 円以内の整数、開始月は 2000-01〜2100-12 の `YYYY-MM`、種別は `income` か `expense` (agent 推定・利用者未確認、根拠 qa-budget-security-web-002)。同じ科目の重複行は 400 にする。SQL は Drizzle のバインドで組み、文字列連結しない。科目名と理由は React の既定のエスケープで描画し、`dangerouslySetInnerHTML` を使わない。
- 変更系のフェンス登録: `PUT /api/budget-plans` (`consumers: ['budget_plans']`) (agent 推定・利用者未確認、根拠 qa-budget-security-web-002)。取得の `GET` は書かないため登録しない。
- Dependency/artifact provenance/signing/SBOM: 新しい依存を足さない。グラフは自前の SVG で描く。
- CI/CD branch/review/environment protections: 既存の CI とレビューに従う。実データはテストに持ち込まない (`scripts/hooks/guard-real-data.sh`)。

#### Detection and response

- Audit events/security telemetry/alerts: N/A: 新しい監査信号を追加しない。
- Incident response/revocation/recovery: 誤った保存は同じ期間を保存し直して上書きする。失われた予算は夜間バックアップから戻す (`architecture/budget-database.md`)。
- Vulnerability handling and SLA: 既存の運用に従う。

#### Security verification

API 統合テストで、上限を 1 つ超える入力 (201 行・61 字・101 字・10,000,000,001 円・小数・2100-13) が 400 になり、上限ちょうどは通ることを確かめる。フェンスの登録ルート数のテストを新経路のぶん更新し、取込の洗替えと重なった保存が 409 になることを確かめる。予算の経路が `packages/api/src/ai` や外部 URL への `fetch` を含まないこと、`_headers` の CSP が変わっていないことを確かめる。DOM テストで、理由に入れた `<script>` が文字として表示されること、保存成功とログアウトで下書きのキーが消えることを確かめる。

## Architecture decisions

| Basis (qa_ref) | Decision | Alternatives | Trade-on rationale | Consequences |
|---|---|---|---|---|
| qa-budget-security-web-001 | 保存の本文を zod で検証し、数値は整数で範囲を、文字列は長さを制限する | 画面の入力制限に頼る | API を直接叩かれても守れ、集計の桁あふれを防ぐ | 上限の値を画面とテストで揃える |
| qa-budget-security-web-002 | 200 行・科目名 60 字・理由 100 字・±100 億円・2000-01〜2100-12 (agent 推定・利用者未確認) | 上限を置かない | 1 要求の負荷を抑え、D1 batch 1 回に収める | 200 行を超える科目数は保存できない |
| qa-budget-security-web-001 | `PUT /api/budget-plans` をフェンスに登録する | 登録しない | 取込の洗替えと重なって整合が崩れる事故を防ぐ | `CanonicalConsumer` と登録ルート数のテストを更新する |
| qa-budget-decision-003 | 外部送信しない決定論の自動提案 | 外部 LLM | 取込データを外部送信しない約束と一致し、根拠を式で示せる | 画像の『AI・統計推奨』は『自動提案』と表示する |
| qa-budget-security-web-001 | 下書きは保存成功とログアウトで消す | 期限切れまで残す | 共用端末で理由が残らない | ログアウトの処理に予算の下書きの消去を足す |

## Delivery, migration and rollback

- Build/deploy topology: 既存 Worker と web の静的配信。
- Migration sequence: zod スキーマと上限の定義 → フェンス登録と `CanonicalConsumer` の拡張 → 登録ルート数のテストの更新 → 新経路の配信。
- Rollback trigger/procedure: セキュリティテストが落ちたら差し戻し、配信済みなら Worker を直前版へ戻す。

## Risks and verification

- Risk/assumption: 新経路をフェンスに登録し忘れると、取込の洗替えと保存が重なる。登録ルート数のテストは数だけを見るため、新経路が 409 になることを個別に確かめる。
- Risk/assumption: `budget_plans` を JSON snapshot の consumer に入れるかは、バックアップと復元の write-set に入れるか (`architecture/budget-database.md`) と揃える必要がある。片方だけにすると snapshot が古い予算を返す。
- Risk/assumption: 既存の `PUT /api/budgets` の zod は月額を 0 以上に制限しているが、新しい調整額は負の値を取る。負の値を許すのは調整額だけとし、年額は 0 以上とするかは仕様 (`specs/spec-budget-screen.md`) で確かめる。
- Architecture fitness test: 予算の経路が `packages/api/src/ai` や外部 URL への `fetch` を含まないこと。`_headers` が変わっていないこと。
- Load/failure/security validation: 上限超過が 400 になること。フェンスの競合が 409 になること。
