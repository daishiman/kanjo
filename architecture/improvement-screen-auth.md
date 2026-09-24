---
graph_node_id: "arch-improvement-screen-auth"
artifact_kind: "architecture"
artifact_subtypes: ["security"]
title: "改善リクエスト — 削除・復元・一覧の検索を既存のセッション Cookie と authGuard の配下に置き、他の利用者の依頼と削除中の依頼をどの経路からも 404 にそろえる"
project_id: "kanjo"
domain: "auth"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: []
tags: ["improvement", "auth"]
file_path: "architecture/improvement-screen-auth.md"
template_id: "architecture"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluator": "system-spec-harness:assign-system-spec-completeness-evaluator", "evidence_ref": "system-spec/completeness-findings.json", "evaluated_digest": "30106b66c01475aa275cd370397c6ef81957b9e72d67d9d306b720c51a812aca"}
source_lineage: {"origin_kind": "system-spec-harness", "source_plugin": "system-spec-harness", "source_path": "system-spec/auth.md", "source_version": "0.1.14", "source_digest": "30106b66c01475aa275cd370397c6ef81957b9e72d67d9d306b720c51a812aca", "imported_at": "2026-09-23T13:47:00Z"}
created_at: "2026-09-23T13:47:00Z"
updated_at: "2026-09-23T13:47:00Z"
depends_on: ["spec-improvement-screen"]
related_nodes: ["arch-improvement-screen-ui-ux", "arch-improvement-screen-frontend", "arch-improvement-screen-backend", "arch-improvement-screen-database", "arch-improvement-screen-security", "arch-improvement-screen-infrastructure", "arch-improvement-screen-maintenance-ops"]
resource_scope: ["packages/api/src/index.ts", "packages/api/src/auth.ts", "packages/api/src/routes/improvement.ts", "packages/core/src/improvement.ts", "packages/api/src/improvement-lifecycle.test.ts"]
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
classification_candidates: [{"artifact_kind": "architecture", "confidence": 1.0, "candidate_path": "architecture/improvement-screen-auth.md"}]
tracker_binding: "none"
beads_linkage: null
github_publication: {"mode": "local_only", "project_aliases": [], "labels": [], "milestone": null}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"policy": "manual", "status": "not_applicable", "source": null, "completed_at": null, "reconciled_at": null, "evidence_refs": []}
implementation_readiness: {"status": "complete", "missing_sections": [], "checked_at": "2026-09-23T13:47:00Z"}
serves_goals: ["G4"]
---

# Architecture overview

改善リクエスト — 新しく足す削除 (`DELETE /api/improvements/:id`)・復元 (`POST /api/improvements/:id/restore`)・一覧の検索/件数/ページングを、既存のセッション Cookie (HttpOnly・Secure・SameSite=Strict) の認証と `authGuard` の配下の `/api/*` に置く。全クエリを `user_id` で絞り、他の利用者の依頼は存在してもしなくても同じ 404 にする。agent 経路 (使い捨てトークン、接頭辞 `imp_`) は再発行で旧ハッシュを上書きして即失効させ、削除中の依頼には届かせない。新しい資格情報・役割は作らない (qa-imp-auth-web-001、qa-imp-decision-003)。`system-spec/auth.md` は承認時入力、本書は認証境界と認可の置き場所の制約を持つ。行番号は 2026-09-23 時点の現物で確かめた値である。経路名 (`DELETE` / `restore`) は `system-spec/backend.md` の設計知識の適用 (agent 推定・利用者未確認) に従う。

## Context and drivers

- Business/technical context: `/api/*` は `packages/api/src/index.ts:107` の `authGuard()`・:109 の `mustChangePasswordFence()`・:110 の `runtimeSchemaGuard`・:111 の `canonicalMutationFence()` を通り、`improvementRoute` は :132 で結線される。agent 経路 `improvementAgentRoute` は :103 で authGuard より前にあり、`agentGuard` (`packages/api/src/routes/improvement.ts:399-436`) が Bearer トークンのハッシュと依頼 id の組で照合する。トークンは接頭辞 `imp_` (`packages/core/src/improvement.ts:328`)、24 時間 (:73)、取得 20 回まで (:76)。セッション Cookie の属性は `packages/api/src/auth.ts:129-131`。役割は `admin|member` (`auth.ts:41`) で `adminGuard` (`auth.ts:309-317`) があるが、改善リクエストの経路では使っていない (qa-imp-auth-web-evidence-001)。
- 現状との差分: 依頼の読み取りは `loadRow` (`routes/improvement.ts:71-77`) と一覧 (:242-252) が `userId` で絞るだけで、論理削除の条件は無い (列が無い)。DELETE・復元・検索の経路は無い。
- Quality attribute priorities: G4 に資する。Secure by Design の『既定で拒否し、境界で一度だけ判定する』を新しい経路の置き場所に適用する (auth 章の本章での適用。agent 推定・利用者未確認)。
- Constraints: OWASP ASVS + Secrets Management Cheat Sheet (上流指針)。単一利用者の運用 (U7 対象外)。web のみ (qa-imp-decision-005)。

## Goals and non-goals

- Goals:
  - G4: 他の利用者の依頼を指す id は、取得・画像・指示文・コピー記録・状態の変更・再発行・削除・復元のどれでも 404 にし、存在の有無を応答の違いから推測させない。
  - G4: 削除中の依頼は、一覧・件数・詳細・agent 経路のどこからも読めない (qa-imp-decision-003)。
  - G4: 再発行した時点で旧トークンが使えなくなる。
- Non-goals:
  - 新しい資格情報・トークンの種類・役割 (家族間の共有と権限分離は U7 対象外)
  - セッション Cookie の属性・寿命の変更
  - `adminGuard` を改善リクエストに掛けること

## System context and boundaries

- Users/external systems: 利用者のブラウザ (セッション Cookie)。Claude Code / Codex (指示文に埋めた使い捨てトークンで agent 経路を読む)。
- Trust/deployment/data boundaries: 境界は 2 つ。利用者の経路は `index.ts:107`・:109 の 2 段の内側、agent 経路は `agentGuard` のトークン照合 1 段。新しい経路は前者の内側だけに置き、agent 経路は増やさない。
- Context diagram: `system-spec/index.md` の章相互参照を参照する。

## Container and component view

| Container/Component | Responsibility | Interface | Data owner | Deployment unit |
|---|---|---|---|---|
| `authGuard` (`index.ts:107`) | セッション Cookie の検証、未認証を 401 `unauthorized` (`auth.ts:242`) | Hono middleware | packages/api | api Worker |
| `mustChangePasswordFence` (`index.ts:109`) | 一時パスワードの利用者を 403 `password_change_required` | Hono middleware | packages/api | 同上 |
| `improvementRoute` (`routes/improvement.ts:61`) | 既存 8 経路と、削除・復元・一覧の検索 (新設) | HTTP JSON | packages/api | 同上 |
| `loadRow` (`routes/improvement.ts:71`) | `user_id` と id の組で 1 行を読む。削除中は読まない (改修) | 関数 | packages/api | 同上 |
| `agentGuard` (`routes/improvement.ts:399`) | トークンのハッシュと id の照合、期限・回数の判定。削除中を除外 (改修) | Hono middleware | packages/api | 同上 |
| `mintAgentToken` / `IMPROVEMENT_TOKEN_PREFIX` (`core/src/improvement.ts:328`) | 使い捨てトークンの発行規則 | 純関数・定数 | packages/core | api Worker |

## Cross-cutting contracts

- Identity/access: route の中に個別の役割判定を書かない。利用者の判定は境界の 1 回だけで、以後は `c.get('userId')` を全クエリの条件に入れる。
- Errors/resilience: 他の利用者の id と存在しない id は同じ 404 `not_found` (現行の `routes/improvement.ts:258` と同じ形)。未認証 401、一時パスワード 403 は既存の値。agent 経路の期限切れ (`token_expired`)・回数超過 (`token_fetch_limit`) の区別 (:416-426) は保つ。
- Observability/audit: トークン値はログにも応答にも出さない (現行 :397 の方針)。削除・復元・状態の変更・再発行はアクティビティの表に 1 行ずつ残す (`architecture/improvement-screen-database.md`)。
- Configuration/secrets: N/A: 新しい秘密情報を持たない。トークンはハッシュ (`sha256Hex`) だけを保存する現行のまま。
- Compatibility/versioning: 既存 8 経路のパスは変えない。再発行は既存の `POST /api/improvements/:id/prompt` (`routes/improvement.ts:311`) で、`token_hash` を上書きする現行の挙動 (:327-334) を契約として固定する。

## Subtype architecture

- Frontend: N/A: 本章の関心外 (`architecture/improvement-screen-frontend.md`)
- Backend: N/A: 本章の関心外 (`architecture/improvement-screen-backend.md`)
- Infrastructure: N/A: 本章の関心外
- Data: N/A: 本章の関心外 (`architecture/improvement-screen-database.md`)
- Security: 下記 Security architecture を合成

### Security architecture

#### Assets, actors and threat model

資産は利用者の依頼 (本文・画像・マスク済み診断・履歴) と、agent 経路のトークン。脅威は 3 つ。他の利用者のセッションから id を推測して読む・変える・消す・戻すこと、削除した依頼が agent 経路や一覧から読めてしまうこと、指示文から漏れた古いトークンで再発行後も読めてしまうこと。

#### Authentication boundary

利用者の経路はセッション Cookie だけで通す。新しい経路 (削除・復元・一覧の検索) も `index.ts:132` の `improvementRoute` の中に置き、authGuard より前には置かない。agent 経路は既存の 2 経路 (`/improvements/:id/agent/data`・`/improvements/:id/agent/screenshot`、`routes/improvement.ts:438-441`) から増やさない。

#### Identity and authorization

役割は作らない (単一利用者の運用)。認可は「その行の `user_id` がセッションの userId と一致するか」だけで、クエリの条件に入れて表す。削除中の行 (`deleted_at` が入った行) は、復元の経路を除く全経路で `deleted_at IS NULL` を条件に入れて読まない。復元だけは同じ利用者の削除中の行を対象にする。agent 経路は `agentGuard` の照合条件に `deleted_at IS NULL` を足し、削除中の依頼には届かせない。

#### Data and secret protection

トークンは平文を指示文の中だけに渡し、D1 にはハッシュだけを置く (現行)。再発行で `token_hash` を上書きした瞬間に旧トークンは照合に当たらなくなる。30 日後の完全消去で行ごと消えるので、トークンのハッシュも残らない。Cookie の属性は変えない。

#### Application and supply-chain controls

N/A: 新しい依存を足さない。入力の検証は `architecture/improvement-screen-security.md` が持つ。

#### Detection and response

既存の認証失敗の扱いのまま。新しい検知は足さない。削除・復元の事実はアクティビティの行で追える。

#### Security verification

API テスト (`improvement-lifecycle.test.ts` の系列) で、利用者を 2 人作り、他の利用者の id が取得・画像・指示文・コピー記録・状態の変更・再発行・削除・復元の 8 経路すべてで 404 になり、応答の本文が存在しない id と同じであること。削除中の依頼が一覧・件数・詳細・agent の 2 経路に出ないこと。再発行の前のトークンが再発行の後に 401 になること。未認証 401・一時パスワード 403 が新しい経路にも掛かること (O4・S4)。

## Architecture decisions

| Basis (qa_ref) | Decision | Alternatives | Trade-on rationale | Consequences |
|---|---|---|---|---|
| qa-imp-auth-web-001 | 新しい経路を既存のセッション認証の `/api/*` の `improvementRoute` に置く | 改善リクエスト専用の認証 | 境界が 1 つで判定を書き直さない | 未ログインでは何も読めない |
| qa-imp-auth-web-001 | 他の利用者の id と存在しない id を同じ 404 にする | 403 で区別する | 存在の有無を推測させない | 利用者の誤操作と攻撃を応答で区別できない |
| qa-imp-auth-web-001 | 再発行で `token_hash` を上書きし旧トークンを即失効させる (現行の挙動を契約にする) | 旧トークンを期限まで残す | 漏れた指示文の効力を再発行 1 回で断てる | 手元の古い指示文は使えなくなる |
| qa-imp-decision-003 | 削除中の依頼を agent 経路からも読まない | agent 経路だけ読ませる | 削除の意思をどの経路でも同じに守る | 削除中は Claude Code / Codex が着手できない |
| qa-imp-auth-web-001 | 役割・権限を作らない | 閲覧専用の役割 | 単一利用者の運用に合う (U7) | 家族間の共有は対象外 |

## Delivery, migration and rollback

- Build/deploy topology: 既存の api Worker。
- Migration sequence: 0054 で `deleted_at` の列が入った後に、`loadRow`・一覧・`agentGuard`・その他の読み取り経路へ `deleted_at IS NULL` を足し、最後に削除・復元の経路を開く。境界の順序 (`index.ts:107`・:109・:110・:111) は変えない。0054 の前の D1 では `runtimeSchemaGuard` が新しい経路を動かさない (`architecture/improvement-screen-infrastructure.md`)。
- Rollback trigger/procedure: 分離・削除中の除外・再発行の API テストが赤なら差し戻す。Worker を戻しても 0054 の列は残してよい (読まれないだけ)。

## Risks and verification

- Risk/assumption: 読み取り経路を 1 本でも条件の付け忘れで残すと、削除中の依頼がそこから漏れる。経路の一覧 (一覧・件数・詳細・画像・指示文・コピー記録・状態・agent の 2 経路・関連する依頼、`system-spec/backend.md` の data-access 行) ごとに API テストを 1 件置く。
- Risk/assumption: `auth.md` の上流指針は「削除中・完全消去済みの依頼では 404」と書くが、現行の `agentGuard` は照合に当たらない行を 401 `unauthorized` (`routes/improvement.ts:415`) で返す。完全消去の後は行が無く、無効なトークンと区別できない。削除中を 404 にするか 401 のままにするかを実装の前に backend 側で決める (本書では決めない)。
- Architecture fitness test: 新しい経路が `index.ts` の authGuard より後ろに結線されていること、`improvementRoute` のクエリに `userId` の条件が無いものが 0 件であること。
- Load/failure/security validation: 他の利用者のセッションで 8 経路が 404 を返し、本文が存在しない id と一致すること (O4)。
