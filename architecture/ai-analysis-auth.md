---
graph_node_id: "arch-ai-analysis-auth"
artifact_kind: "architecture"
artifact_subtypes: ["security"]
title: "AI分析 — 利用者経路はフェンスの内側、エージェント経路は agentGuard 1 か所で 401 に揃える"
project_id: "kanjo"
domain: "auth"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: []
tags: ["ai-analysis", "auth"]
file_path: "architecture/ai-analysis-auth.md"
template_id: "architecture"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluator": "system-spec-harness:assign-system-spec-completeness-evaluator", "evidence_ref": "system-spec/completeness-findings.json", "evaluated_digest": "43dfdc557b5f5aaf98b06b941235ed93dba451d3a240fd2721a898a582678f37"}
source_lineage: {"origin_kind": "system-spec-harness", "source_plugin": "system-spec-harness", "source_path": "system-spec/auth.md", "source_version": "0.1.14", "source_digest": "43dfdc557b5f5aaf98b06b941235ed93dba451d3a240fd2721a898a582678f37", "imported_at": "2026-09-19T13:11:57Z"}
created_at: "2026-09-19T13:11:57Z"
updated_at: "2026-09-19T13:11:57Z"
depends_on: ["spec-ai-analysis-screen"]
related_nodes: ["arch-ai-analysis-ui-ux", "arch-ai-analysis-frontend", "arch-ai-analysis-backend", "arch-ai-analysis-database", "arch-ai-analysis-security", "arch-ai-analysis-infrastructure", "arch-ai-analysis-maintenance-ops"]
resource_scope: ["packages/api/src/index.ts", "packages/api/src/routes/ai.ts", "packages/api/src/auth.ts", "packages/api/src/schema-guard.ts"]
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
classification_reason: "system-spec の auth 章 (web 確定・他 platform 対象外) を領域別の architecture 制約として参照する。"
classification_candidates: [{"artifact_kind": "architecture", "confidence": 1.0, "candidate_path": "architecture/ai-analysis-auth.md"}]
tracker_binding: "none"
beads_linkage: null
github_publication: {"mode": "local_only", "project_aliases": [], "labels": [], "milestone": null}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"policy": "manual", "status": "not_applicable", "source": null, "completed_at": null, "reconciled_at": null, "evidence_refs": []}
implementation_readiness: {"status": "complete", "missing_sections": [], "checked_at": "2026-09-19T13:11:57Z"}
serves_goals: ["G3", "G5"]
---

# Architecture overview

AI分析 — 利用者経路はフェンスの内側、エージェント経路は agentGuard 1 か所で 401 に揃える。`system-spec/auth.md` は承認時入力、本書は 2 系統の認証の配置と拒否の規則を持つ。規則の正本は spec-ai-analysis-screen の認証と認可の節。

## Context and drivers

- Business/technical context: `packages/api/src/index.ts` は `aiAgentRoute` を `/api/*` のフェンスより前に載せ、利用者向けの `aiRoute` を `authGuard` → `mustChangePasswordFence` → `runtimeSchemaGuard` → `canonicalMutationFence` の後に載せる。エージェント経路は `agentGuard` (`packages/api/src/routes/ai.ts:446`) が Bearer トークンを SHA-256 で `ai_tasks.token_hash` と照合し、期限切れと受信済みを 401 で拒否する。トークンの寿命は 24 時間 (`ai.ts:36`) (qa-ai-auth-web-evidence-001)。
- Quality attribute priorities: G3・G5 に資する。Secure by Design の『既定で拒否し、境界で一度だけ判定する』を 2 系統の配置に適用する。上流指針は OWASP ASVS 5.0.0 (トークンの失効)。
- Constraints: 新しい役割・長期トークン・新しいログイン手段を設けない。

## Goals and non-goals

- Goals:
  - G3: キャンセル・再実行・使用するデータの 3 経路を既存 `aiRoute` と同じフェンスの内側に置き、`c.get('userId')` で自分の依頼だけを扱う。
  - G5: キャンセル済みの依頼のトークンを、期限切れ・受信済みと同じ 401 で拒否する。
  - G3: 再実行は新しいトークンを発行し、元のトークンは生かさない。
- Non-goals:
  - 役割 (閲覧者・管理者) の導入
  - エージェント用の長期トークン
  - 410 など拒否理由ごとの状態コードの使い分け

## System context and boundaries

- Users/external systems: 利用者 (セッション cookie)、外部のエージェント (依頼ごとの使い捨てトークン)。
- Trust/deployment/data boundaries: 利用者経路の認可は `/api/*` のフェンス 1 か所で、route の中に個別の認証を書かない。エージェント経路の認可は `agentGuard` 1 か所で、トークンが指す依頼の `user_id` をそのまま文脈に載せる。
- Context diagram: `system-spec/index.md` の章相互参照を参照する。

## Container and component view

| Container/Component | Responsibility | Interface | Data owner | Deployment unit |
|---|---|---|---|---|
| `authGuard` → `mustChangePasswordFence` → `runtimeSchemaGuard` → `canonicalMutationFence` | 利用者経路の認証と前提の確認 | Hono middleware | packages/api | Worker |
| `aiRoute` のキャンセル・再実行・使用するデータ | 自分の依頼と明細だけを扱う | Hono route | packages/api | Worker |
| `agentGuard` | トークン照合と、期限切れ・受信済み・キャンセル済みの拒否 | Hono middleware | packages/api | Worker |
| core 段階の導出 | `agentGuard` と画面が共有する判定 | 純関数 | packages/core | 同一 Worker |

## Cross-cutting contracts

- Identity/access: 利用者経路は既存のセッション cookie、エージェント経路は既存のトークン認証のまま。
- Errors/resilience: エージェント経路の拒否は 401 に統一する。文は理由ごとに変えて (期限切れ・受信済み・キャンセル済み) 作り直しを促すが、状態コードは 1 つにする。利用者経路で他の利用者の依頼 id を渡されたときは 404 を返し、存在を漏らさない。
- Observability/audit: N/A: 新しい信号を追加しない。取り消しは `canceled_at` として依頼の行に残る。
- Configuration/secrets: 追加の秘密情報を持たない。トークンは平文を保存せず、発行時にだけ利用者へ示す (既存)。
- Compatibility/versioning: 既存のトークンの形式・寿命・照合方法は変えない。

## Subtype architecture

- Frontend: N/A: 本章の関心外
- Backend: N/A: 本章の関心外 (`architecture/ai-analysis-backend.md`)
- Infrastructure: N/A: 本章の関心外
- Data: N/A: 本章の関心外
- Security: 下記 Security architecture を合成

### Security architecture

#### Assets, actors and threat model

- 守る資産: 依頼ごとのトークン (保存はハッシュだけ)、利用者のセッション、依頼とレポートの利用者単位の区切り。
- 主体と悪用の筋書き: 利用者、外部のエージェント、トークンを手に入れた第三者、他の利用者の依頼 id を推測する利用者。想定する悪用は、キャンセル済み・受信済み・期限切れのトークンでのデータ取得とレポート送信、再実行後の元トークンの使い回し、他の利用者の依頼へのキャンセル・再実行・削除。
- 信頼境界: 利用者経路は `/api/*` のフェンス 1 か所、エージェント経路は `agentGuard` 1 か所。境界の内側では認証を再判定しない。

#### Authentication boundary

利用者経路の 3 経路は `app.route('/api', aiRoute)` の中に足し、登録順でフェンスの後ろに来ることを保つ。エージェント経路は従来どおり `aiAgentRoute` だけで、新しい経路は足さない。現行は `agentGuard` が `runtimeSchemaGuard` より先に登録されており、migration 0046 の適用前に新しい列を含む行を読むと 503 ではなく 500 になり得る。エージェント経路でも `runtimeSchemaGuard` を `agentGuard` の前へ移す (agent 判断・利用者未確認)。

#### Identity and authorization

利用者経路は `c.get('userId')` と依頼の `user_id` の一致を検索条件に含め、一致しなければ 404。エージェント経路はトークンが指す 1 件の依頼だけを扱い、`c.set('userId', task.userId)` の後は他の依頼に触れない。役割は持たない。

#### Data and secret protection

キャンセルはトークンの削除ではなく `canceled_at` の記録で表し、`agentGuard` は core の段階の導出で キャンセル・完了・失敗 のどれかなら 401 で拒否する。キャンセル済みへの応答は 401 に統一する (evaluator の指摘を反映。成功基準 S3 の『401 / 410 相当』のうち 401 を採る)。再実行は新しい行に新しいトークンを発行し、元の依頼のトークンは元の行の状態に従って拒否され続ける。

#### Application and supply-chain controls

新しい依存・認証ライブラリは足さない。フェンスとガードは既存の Hono middleware のままで、登録順 (フェンスの後ろに利用者経路、`runtimeSchemaGuard` の後ろに `agentGuard`) を `index.ts` の系列のテストで固定する。入力の大きさと契約の検証は `architecture/ai-analysis-security.md` に従う。

#### Detection and response

新しい検知の仕組みは足さない。取り消しは `canceled_at` として依頼の行に残り、実行中の表にキャンセルとして出る。トークンの漏洩に利用者が気づいたときの対応はキャンセルで、その時点から `agentGuard` がそのトークンを 401 で拒否する。期限 24 時間を待たずに失効できることが、この経路の即時の対応手段である。

#### Security verification

API テストで、キャンセル済みのトークンでの `GET /ai/tasks/:id/data` と `POST /ai/tasks/:id/report` が 401、期限切れ・受信済みも 401 であることを同じ表で確かめる。他の利用者の依頼 id でのキャンセル・再実行・削除が 404 になること、再実行後に元のトークンが 401 になることを確かめる。フェンスの登録順は既存の `index.ts` のテスト系列で固定する。

## Architecture decisions

| Basis (qa_ref) | Decision | Alternatives | Trade-on rationale | Consequences |
|---|---|---|---|---|
| qa-ai-auth-web-001 | 新しい利用者経路を既存フェンスの内側に置く | 経路ごとに個別の認証を書く | 既存の AI 経路と同じ保護を漏れなく受ける | 登録順を変えると保護が外れるため順序をテストで固定する |
| qa-ai-auth-web-001 | キャンセル済みトークンを 401 で拒否する | 410 Gone で区別する | 期限切れ・受信済みと同じ扱いで、エージェント側の分岐が増えない | 理由の区別は応答の文だけに残る |
| qa-ai-decision-003 | キャンセルを `canceled_at` の記録で表す | トークンのハッシュを消す | 拒否の理由を画面と応答の両方に残せる | 段階の導出がキャンセルを最優先にする |
| qa-ai-auth-web-001 | 他の利用者の依頼 id に 404 | 403 | 依頼の存在を漏らさない | 403 を使う経路は増やさない |

## Delivery, migration and rollback

- Build/deploy topology: 既存 Worker のビルド。
- Migration sequence: migration 0046 の適用 → `runtimeSchemaGuard` を `agentGuard` の前へ → `agentGuard` にキャンセル済みの判定 → キャンセル・再実行・使用するデータの経路。
- Rollback trigger/procedure: 認可のテストが落ちたら差し戻す。キャンセル済みの行は旧 Worker では 結果待ち に見えるため、差し戻す間はキャンセル操作を画面から出さない。

## Risks and verification

- Risk/assumption: `agentGuard` が独自に状態を判定すると、画面でキャンセル済みの依頼をエージェントが送信できてしまう。判定を core の段階の導出に寄せ、同じ入力で画面と拒否が一致することをテストで確かめる。
- Architecture fitness test: route の中にセッションやトークンの検査が無いこと。`agentGuard` に段階の文字列比較が無く core の判定を呼んでいること。
- Load/failure/security validation: トークンの照合はハッシュと id の一致による 1 行の読み取りで、件数に依らない。
