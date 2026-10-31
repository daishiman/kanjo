---
graph_node_id: "arch-import-screen-auth"
artifact_kind: "architecture"
artifact_subtypes: ["security"]
title: "データ取込 — 全経路を既存のセッションのフェンスの内側に置き、他人・期限切れ・別検査の ID はすべて 404 にそろえる"
project_id: "kanjo"
domain: "auth"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: []
tags: ["import-screen", "auth"]
file_path: "architecture/import-screen-auth.md"
template_id: "architecture"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluator": "system-spec-harness:assign-system-spec-completeness-evaluator", "evidence_ref": "system-spec/completeness-findings.json", "evaluated_digest": "f1a1572295b16d6fc096c4b441d4f72748a1460b078fbb5f85e0562dc15adf25"}
source_lineage: {"origin_kind": "system-spec-harness", "source_plugin": "system-spec-harness", "source_path": "system-spec/auth.md", "source_version": "0.1.14", "source_digest": "f1a1572295b16d6fc096c4b441d4f72748a1460b078fbb5f85e0562dc15adf25", "imported_at": "2026-09-21T22:53:09Z"}
created_at: "2026-09-21T22:53:09Z"
updated_at: "2026-09-21T22:53:09Z"
depends_on: ["spec-import-screen"]
related_nodes: ["arch-import-screen-ui-ux", "arch-import-screen-frontend", "arch-import-screen-backend", "arch-import-screen-database", "arch-import-screen-security", "arch-import-screen-infrastructure", "arch-import-screen-maintenance-ops"]
resource_scope: ["packages/api/src/index.ts", "packages/api/src/auth.ts", "packages/api/src/routes/imports.ts", "packages/api/src/routes/deletions.ts", "packages/api/src/schema-guard.ts"]
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
classification_candidates: [{"artifact_kind": "architecture", "confidence": 1.0, "candidate_path": "architecture/import-screen-auth.md"}]
tracker_binding: "none"
beads_linkage: null
github_publication: {"mode": "local_only", "project_aliases": [], "labels": [], "milestone": null}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"policy": "manual", "status": "not_applicable", "source": null, "completed_at": null, "reconciled_at": null, "evidence_refs": []}
implementation_readiness: {"status": "complete", "missing_sections": [], "checked_at": "2026-09-21T22:53:09Z"}
serves_goals: ["G1", "G2", "G3", "G4", "G5", "G6"]
---

# Architecture overview

データ取込 — 全経路を既存のセッションのフェンスの内側に置き、他人・期限切れ・別検査の ID はすべて 404 にそろえる。`system-spec/auth.md` は承認時入力、本書は認証の境界と所有者の判定の制約を持つ。規則の正本は `specs/spec-import-screen.md` (spec-import-screen) の認証・認可の節。

## Context and drivers

- Business/technical context: 取込の経路は `/api` 配下のセッション認証の後ろにあり (`packages/api/src/index.ts` の `app.use('/api/*', authGuard())` とそれに続くフェンス)、セッション Cookie は `SameSite=Strict` (`packages/api/src/auth.ts:131`)。`imports`・`import_runs` の読み書きは `user_id` で絞り込み、原本の取得 `GET /imports/:id/original` も所有者の行だけを返す (qa-imp-auth-web-evidence-001)。
- Quality attribute priorities: G1〜G6 に資する。Secure by Design card の『既定で拒否し、境界で一度だけ判定する』と、OWASP ASVS の認証・利用者単位のデータの閉じ込めを適用する。
- Constraints: 新しい認証方式・トークンは足さない (qa-imp-decision-010)。利用者は 1 人で、共有や代理の操作は無い。

## Goals and non-goals

- Goals:
  - G2: 検査・ファイルの追加と除外・確定・履歴・原本の取得・再取込・取り消し・履歴の削除の全経路を既存のセッション認証の後ろに置き、どの操作も利用者 ID で行を絞る。
  - G6: 他人の検査 ID・取込 ID・期限切れの検査 ID・別の検査のファイル項目 ID はすべて 404 `not_found` を返し、存在の有無を区別させない (qa-imp-decision-010)。
  - G5: 一括削除は本人の履歴だけを対象にし、1 要求 100 件まで、所有者でない ID が混ざれば全体を 404 にして 1 件も消さない。
- Non-goals:
  - 新しい認証方式・API キー・署名付き URL
  - 403 と 410 の使い分け (404 に統一した。評価の medium で『任意の再確認』として申し送られている)
  - 共有・代理の権限

## System context and boundaries

- Users/external systems: ログイン済みの利用者のブラウザ。外部のエージェントや第三者の経路は無い。
- Trust/deployment/data boundaries: 境界は `/api/*` のフェンス 1 か所。各経路の入口で利用者 ID による行の絞り込みを 1 回だけ行い、以降の処理は絞った行だけを扱う。
- Context diagram: `system-spec/index.md` の章相互参照を参照する。

## Container and component view

| Container/Component | Responsibility | Interface | Data owner | Deployment unit |
|---|---|---|---|---|
| `/api/*` のフェンス (既存) | セッションの検証・パスワード変更の強制・schema の確認 | Hono middleware | packages/api | Worker |
| 取込の経路の所有者判定 | 検査 ID・ファイル項目 ID・取込 ID を利用者 ID で絞り、無ければ 404 | route 内の 1 回の問い合わせ | packages/api | Worker |
| ID の発行 | 検査 ID とファイル項目 ID を `crypto.randomUUID` で作る | Web Crypto | packages/api | Worker |

## Cross-cutting contracts

- Identity/access: セッション Cookie (`SameSite=Strict`)。変更要求にはさらに Origin の検査を掛ける (`architecture/import-screen-security.md`)。
- Errors/resilience: 未認証は既存どおり 401。所有者でない・期限切れ・別検査の ID は 404 に統一する。
- Observability/audit: N/A: 新しい信号を足さない。
- Configuration/secrets: 追加の秘密情報を持たない。
- Compatibility/versioning: 既存の `GET /imports/:id/original` と取り消しの経路の認可はそのまま使い、取込単位の経路はそれを束ねる。

## Subtype architecture

- Frontend: N/A: 本章の関心外 (`architecture/import-screen-frontend.md`)
- Backend: N/A: 本章の関心外 (`architecture/import-screen-backend.md`)
- Infrastructure: N/A: 本章の関心外 (`architecture/import-screen-infrastructure.md`)
- Data: N/A: 本章の関心外 (`architecture/import-screen-database.md`)
- Security: 下記 Security architecture を合成 (認証・認可の観点)

### Security architecture

#### Assets, actors and threat model

資産は仮置きの原本・取込済みの明細・取込履歴。脅威は、他人の検査 ID や取込 ID を推測・流用して原本を取得・確定・削除すること、期限切れの検査を確定すること、別の検査のファイル項目を混ぜて確定すること、ID の有無の違いから存在を知ること。

#### Authentication boundary

全経路が `/api/*` のフェンスの内側にある。取込専用の認証は足さない。Cookie は `SameSite=Strict` で、変更要求は Origin の検査を合わせて通す。

#### Identity and authorization

確定は本人が作った未期限の検査 ID と、その検査 ID に属するファイル項目 ID だけを受ける。検査 ID とファイル項目 ID は推測できない乱数 (`crypto.randomUUID`) にする。レート制限は利用者 ID ごとに数える (qa-imp-auth-web-004、agent 推定。値は qa-imp-decision-010 で確定)。

#### Data and secret protection

仮置きの原本は本人だけが確定・取得でき、24 時間で消える。ファイル名は制御文字を除き 255 文字で切って記録する (qa-imp-decision-010)。

#### Application and supply-chain controls

N/A: 新しい依存を足さない。ID の発行は Workers ランタイムの Web Crypto を使う。

#### Detection and response

N/A: 新しい検知の仕組みを足さない。404 の統一は応答から存在を読ませないための対策で、検知は既存の運用に従う。

#### Security verification

API テストで、他人の検査 ID・取込 ID、期限切れの検査 ID、別の検査のファイル項目 ID がすべて 404 になること、所有者でない ID を 1 件混ぜた一括削除が全体 404 で 1 件も消さないこと、100 / 101 件の境界、未認証が 401 になることを確かめる。

## Architecture decisions

| Basis (qa_ref) | Decision | Alternatives | Trade-on rationale | Consequences |
|---|---|---|---|---|
| qa-imp-decision-010 | 他人・期限切れ・別検査の ID はすべて 404 | 403 / 410 を分ける | 存在の有無を区別させない | 期限切れの理由は画面の文言で補う |
| qa-imp-decision-010 | 新しい認証方式を足さない | 取込専用トークン | 既存のフェンスで足り、境界が 1 か所のまま | 外部からの取込の自動化は対象外 |
| qa-imp-auth-web-004 | 一括削除は混入 1 件で全体 404 (agent 推定) | 所有分だけ消す | 部分成功の曖昧さが無い | 再送は本人の ID だけで行う |
| qa-imp-auth-web-004 | ID は `crypto.randomUUID` (agent 推定) | 連番 | 推測による列挙を防ぐ | ID が長くなる |

## Delivery, migration and rollback

- Build/deploy topology: 既存 Worker。認証の構成は変えない。
- Migration sequence: 新しい経路を `/api/*` のフェンスの内側に登録 → 所有者判定と 404 の統一 → 一括削除の全体判定。
- Rollback trigger/procedure: 認可のテストが落ちたら Worker を戻す。

## Risks and verification

- Risk/assumption: 新しい経路をフェンスより前に登録すると認証が掛からない。登録順を API テストの 401 で確かめる。
- Architecture fitness test: 取込の新しい経路の問い合わせがすべて `user_id` の条件を持つこと。
- Load/failure/security validation: 404 の応答本文が、存在する他人の ID と存在しない ID で同じであること。
