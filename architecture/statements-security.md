---
graph_node_id: "arch-statements-security"
artifact_kind: "architecture"
artifact_subtypes: ["security"]
title: "決算書 — 負債の保存経路に金額と本文の上限・監査を足し、CSV エクスポートの数式注入を防ぐ"
project_id: "kanjo"
domain: "security"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: []
tags: ["statements", "security"]
file_path: "architecture/statements-security.md"
template_id: "architecture"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluator": "system-spec-harness:assign-system-spec-completeness-evaluator", "evidence_ref": "system-spec/completeness-findings.json", "evaluated_digest": "e7373096230225e022ceb7e55f8c181d0384679fa70979420a0b218130e20a76"}
source_lineage: {"origin_kind": "system-spec-harness", "source_plugin": "system-spec-harness", "source_path": "system-spec/security.md", "source_version": "0.1.14", "source_digest": "e7373096230225e022ceb7e55f8c181d0384679fa70979420a0b218130e20a76", "imported_at": "2026-09-19T22:38:08Z"}
created_at: "2026-09-19T12:06:39Z"
updated_at: "2026-09-19T22:38:08Z"
depends_on: ["spec-statements-screen"]
related_nodes: ["arch-statements-ui-ux", "arch-statements-frontend", "arch-statements-backend", "arch-statements-database", "arch-statements-auth", "arch-statements-infrastructure", "arch-statements-maintenance-ops"]
resource_scope: ["packages/api/src/routes/balances.ts", "packages/api/src/audit-log.ts", "packages/api/src/canonical-mutation-fence.ts", "packages/web/src/pages/statements/"]
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
classification_candidates: [{"artifact_kind": "architecture", "confidence": 1.0, "candidate_path": "architecture/statements-security.md"}]
tracker_binding: "none"
beads_linkage: null
github_publication: {"mode": "local_only", "project_aliases": [], "labels": [], "milestone": null}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"policy": "manual", "status": "not_applicable", "source": null, "completed_at": null, "reconciled_at": null, "evidence_refs": []}
implementation_readiness: {"status": "complete", "missing_sections": [], "checked_at": "2026-09-19T12:06:39Z"}
serves_goals: ["G5"]
---

# Architecture overview

決算書画面 — 負債の保存経路に金額と本文の上限・監査を足し、CSV エクスポートの数式注入を防ぐ。`system-spec/security.md` は承認時入力、本書は security 制約を持つ。

## Context and drivers

- Business/technical context: `packages/api/src/index.ts` の bodyLimit は `/api/auth/*` だけに 16 KiB で掛かり (85-92 行)、保護された API には掛かっていない。`balances.ts` の amount は `z.number().int().nonnegative()` で上限が無い。取込との直列化は `packages/api/src/canonical-mutation-fence.ts`。監査ログの書込みは `packages/api/src/audit-log.ts` の buildAuditStatements。
- Quality attribute priorities: G5 に資する。OWASP ASVS 5.0 の入力検証と 1.2.10 (CSV / 数式注入)。
- Constraints: 既存の防御 (authGuard、SameSite=Strict の Cookie、JSON の Content-Type 検証、canonical-mutation-fence) を保つ。

## Goals and non-goals

- Goals:
  - G5: 金額は整数・0 以上・1 兆円以下、本文は 8 KiB 以下 (超過 413)、保存ごとに監査 1 件、CSV の数式注入対策、取込データと下書きを外部へ送らない。
- Non-goals:
  - WAF・レート制限の新設
  - 監査への金額の記録

## System context and boundaries

- Users/external systems: 利用者 1 名。外部サービスへは何も送らない。
- Trust/deployment/data boundaries: 本文は信頼しない入力として zod strict で受ける。CSV は利用者の表計算ソフトへ渡る出力として無害化する。
- Context diagram: `system-spec/index.md` の章相互参照を参照する。

## Container and component view

| Container/Component | Responsibility | Interface | Data owner | Deployment unit |
|---|---|---|---|---|
| bodyLimit (PUT /api/balances/liabilities) | 8 KiB、超過 413 | Hono middleware | packages/api | Worker |
| zod スキーマ | month は YYYY-MM、category は列挙、status は unset/zero/amount、amount は status=amount のときだけ必須で整数・0〜1,000,000,000,000、strict | zod | packages/api | Worker |
| liability_audit_log 書込み | 保存ごとに 1 件、項目ごとの状態遷移と件数のみ | D1 | packages/api | Worker |
| CSV 書き出し関数 | ASVS 5.0 1.2.10: = + - @ タブ NUL で始まる文字列セルに ' を前置、RFC 4180 の引用、数値は数値のまま | 純関数 | packages/web | web ビルド |

## Cross-cutting contracts

- Identity/access: `architecture/statements-auth.md` を参照。
- Errors/resilience: 不正な本文 400 (理由は項目名だけを返し入力値を反射しない)、本文超過 413、未認証 401、取込中 409。
- Observability/audit: liability_audit_log。
- Configuration/secrets: N/A: 設定値・秘密情報を追加しない。
- Compatibility/versioning: 上限は既存の正当な入力 (4 項目・現実的な金額) を拒まない。

## Subtype architecture

- Frontend: N/A: 本章の関心外
- Backend: N/A: 本章の関心外
- Infrastructure: N/A: 本章の関心外
- Data: N/A: 本章の関心外
- Security: 下記 Security architecture を合成

### Security architecture

#### Threat model and trust boundaries

(1) 巨大な本文・巨大な金額による資源消費と表示崩れ、(2) 不正な状態の保存、(3) CSV を開いた表計算ソフトでの数式実行、(4) 下書きや取込データの外部送信。

#### Identity, authentication and authorization

既存のまま (`architecture/statements-auth.md`)。

#### Data protection and secrets

下書きはブラウザ内の localStorage に留める。監査に金額を残さない。

#### Input, API and dependency security

bodyLimit 8 KiB → zod strict → canonical-mutation-fence → D1 batch の順。新しい外部依存を足さない。

#### Security monitoring and response

liability_audit_log に保存ごと 1 件 (actor_user_id・month・changed_json・occurred_at)。

#### Security verification

API テスト: 1 兆円超 400、負数 400、小数 400、未知の category 400、余分なキー 400、8 KiB 超 413、未認証 401、監査 1 件、取込中 409。web テスト: CSV の `=SUM(1)`・`+1`・`-1`・`@A1`・先頭タブのセルに ' が付き、数値セルには付かないこと。

## Architecture decisions

| Basis (qa_ref) | Decision | Alternatives | Trade-on rationale | Consequences |
|---|---|---|---|---|
| qa-statements-security-web-002 | 金額の上限を 1 兆円に置く | 上限なし (現行) | 表示と集計の桁あふれを防ぎ、現実の負債額を拒まない | 上限超過は 400 |
| qa-statements-security-web-002 | 負債の PUT に bodyLimit 8 KiB | API 全体に掛ける | 本サイクルの範囲に限り既存経路の挙動を変えない | 他の保存経路は従来どおり |
| qa-statements-csv-chars-001 | CSV は ASVS 5.0 1.2.10 に従い先頭文字に ' を前置 | 危険な文字を削る | 値を失わずに数式実行だけを防ぐ | 表計算ソフトで ' が見える場合がある |

## Delivery, migration and rollback

- Build/deploy topology: 既存 Worker と web ビルド。
- Migration sequence: zod の上限 → bodyLimit → 監査書込み (0046 の後) → CSV 書き出し関数。
- Rollback trigger/procedure: API テストが落ちたら差し戻し。

## Risks and verification

- Risk/assumption: 400 の応答に入力値を反射すると、画面に出したときに注入の足場になる。理由は項目名と規則だけにする。
- Architecture fitness test: PUT /api/balances/liabilities に bodyLimit が掛かっていること。CSV 書き出しが 1 関数を通ること。
- Load/failure/security validation: 上記 API テストと CSV テスト。
