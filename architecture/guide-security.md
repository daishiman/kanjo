---
graph_node_id: "arch-guide-security"
artifact_kind: "architecture"
artifact_subtypes: ["security"]
title: "使い方 — topic は許可リスト・q は 100 字で切り検索はサーバへ送らず、フッタは明細を送らない事実に限って AI 送信の補足を 3 か所に残し、CSP は変えない"
project_id: "kanjo"
domain: "security"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: []
tags: ["guide", "security"]
file_path: "architecture/guide-security.md"
template_id: "architecture"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluator": "system-spec-harness:assign-system-spec-completeness-evaluator", "evidence_ref": "system-spec/completeness-findings.json", "evaluated_digest": "c0921d456f4e06dc42879df45252b78dd5acec3ccf9b7dfccf3103e60f9f82cd"}
source_lineage: {"origin_kind": "system-spec-harness", "source_plugin": "system-spec-harness", "source_path": "system-spec/security.md", "source_version": "0.1.14", "source_digest": "c0921d456f4e06dc42879df45252b78dd5acec3ccf9b7dfccf3103e60f9f82cd", "imported_at": "2026-09-23T13:27:15Z"}
created_at: "2026-09-23T13:27:15Z"
updated_at: "2026-09-23T13:27:15Z"
depends_on: ["spec-guide-screen"]
related_nodes: ["arch-guide-ui-ux", "arch-guide-frontend", "arch-guide-backend", "arch-guide-database", "arch-guide-auth", "arch-guide-infrastructure", "arch-guide-maintenance-ops"]
resource_scope: ["packages/api/src/index.ts", "packages/api/src/routes/analytics.ts", "packages/core/src/period.ts", "packages/web/src/components/Layout.tsx", "packages/web/src/common-shell.dom.test.tsx", "packages/web/src/pages/guide"]
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
classification_candidates: [{"artifact_kind": "architecture", "confidence": 1.0, "candidate_path": "architecture/guide-security.md"}]
tracker_binding: "none"
beads_linkage: null
github_publication: {"mode": "local_only", "project_aliases": [], "labels": [], "milestone": null}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"policy": "manual", "status": "not_applicable", "source": null, "completed_at": null, "reconciled_at": null, "evidence_refs": []}
implementation_readiness: {"status": "complete", "missing_sections": [], "checked_at": "2026-09-23T13:27:15Z"}
serves_goals: ["G4"]
---

# Architecture overview

使い方 — `/api/guide` は authGuard 配下で userId の Dataset だけを読み、期間クエリは既存の `resolvePeriodQuery` に通して壊れた指定を全期間に倒す (400 にしない既存方針)。ガイド内検索は画面内の定数だけを対象にしてサーバへ送らない。フッタは『取込データは外部送信しません』と明細を送らない事実に限定し、AI 実行時に確認した集計データを選択した AI へ渡す事実をフッタの title・プライバシー欄・使い方画面の 3 か所で必ず読めるようにする。CSP は変えない (qa-guide-security-web-001、qa-guide-decision-011)。`system-spec/security.md` は承認時入力、本書は入力の境界と表示の事実性の制約を持つ。行番号は 2026-09-23 時点の現物で確かめた値である。

## Context and drivers

- Business/technical context: 全応答に secureHeaders の CSP (default-src 'self'、frame-ancestors 'none'、connect-src 'self') が掛かる (`packages/api/src/index.ts:58-75`)。業務 API は authGuard 配下で userId を条件に読む (`loadScoped` が `c.get('userId')` を渡す、`analytics.ts:105`)。AI 分析は外部 AI エージェントが使い捨てトークンで集計データを取得する経路で、フッタの現行文言はこの事実を 1 文目に書いている (`Layout.tsx:498`。evidence の記載は :497) (qa-guide-security-web-evidence-001)。
- Quality attribute priorities: G4 に資する。Secure by Design の『入力の境界を許可リストで閉じる』を URL と検索に適用する (security 章の本章での適用。agent 推定・利用者未確認)。
- Constraints: OWASP ASVS 5.0.0 (上流指針)。CSP は変えない。

## Goals and non-goals

- Goals:
  - G4: 表示を事実どおりに保つ。明細を送らない事実と、AI 実行時に集計データを渡す事実の両方が読める。
  - URL の入力 (`topic` / `q`) と期間クエリを既知の範囲に閉じる。
- Non-goals:
  - CSP・secureHeaders の変更
  - 検索語のサーバ送信・記録
  - AI エージェント経路 (`index.ts:101`・:103) の変更

## System context and boundaries

- Users/external systems: 利用者のブラウザ。AI 実行時は選択した外部 AI エージェント (既存経路)。
- Trust/deployment/data boundaries: 使い方画面の検索はブラウザ内で閉じる。`/api/guide` は期間クエリだけを受ける。
- Context diagram: `system-spec/index.md` の章相互参照を参照する。

## Container and component view

| Container/Component | Responsibility | Interface | Data owner | Deployment unit |
|---|---|---|---|---|
| `pages/guide/view-model.ts` | `topic` を許可リストで検証、`q` を 100 字で切る | 純関数 | packages/web | Workers Assets |
| core の検索関数 | 画面内の定数だけを対象に部分一致 | 純関数 | packages/core | 同上 |
| `resolvePeriodQuery` (`core/src/period.ts:198`) | 壊れた期間を全期間に倒す | 純関数 | packages/core | api Worker |
| 共通シェルのフッタ (`Layout.tsx:494-521`) | 1 文目・title・プライバシー欄の補足 | React | packages/web | Workers Assets |
| secureHeaders (`index.ts:58-75`) | CSP | Hono middleware | packages/api | api Worker |

## Cross-cutting contracts

- Identity/access: `architecture/guide-auth.md` のとおり。
- Errors/resilience: 未知の `topic` は『月次の流れ』に倒し、長すぎる `q` は切る。いずれもエラーにしない (qa-guide-security-web-003、agent 推定・利用者未確認)。
- Observability/audit: 検索語はサーバに届かないのでログに残る経路を持たない。金額はログに出さない。
- Configuration/secrets: N/A: 新しい秘密情報を持たない。
- Compatibility/versioning: フッタの 2・3 文目 (「税務上の正本はfreeeです」「毎晩バックアップ(30日保持)」) は変えない。

## Subtype architecture

- Frontend: N/A: 本章の関心外
- Backend: N/A: 本章の関心外 (`architecture/guide-backend.md`)
- Infrastructure: N/A: 本章の関心外
- Data: N/A: 本章の関心外
- Security: 下記 Security architecture を合成

### Security architecture

#### Assets, actors and threat model

資産は利用者の集計値と、表示の事実性 (データがどこへ行くかの説明)。脅威は、URL 経由の不正な値による表示の乱れ、検索語の漏えい、そしてフッタの文言が事実より狭く見えること (AI 送信を隠す誤表示)。

#### Input validation

`topic` は既知の節 id 7 つの許可リストだけを受け、未知の値は `flow` に倒す。`q` は 100 字で切り、React のテキストとして描いて HTML として解釈しない (qa-guide-security-web-003、agent 推定・利用者未確認)。期間は `resolvePeriodQuery` に通す。

#### Identity and authorization

`/api/guide` は userId の Dataset だけを読む (`architecture/guide-auth.md`)。

#### Data and secret protection

フッタ 1 文目は『取込データは外部送信しません』と明細を送らない事実に限る。AI 実行時に確認した集計データを選択した AI へ渡す事実を、フッタの title・プライバシー欄 (現行「取り込んだ明細は収支管理と復元のためにだけ使用します。」に続ける)・使い方画面のデータ出典の 3 か所に残す (qa-guide-decision-011)。

#### Application and supply-chain controls

CSP (default-src 'self'・connect-src 'self') を変えない。新しい依存を足さない。

#### Detection and response

N/A: 新しい検知を足さない。

#### Security verification

DOM テストで、フッタ 1 文目と 3 か所の補足、未知 `topic` の倒れ方、`q` の切り詰めとテキスト描画を確かめる。`common-shell.dom.test.tsx:182-185` の現行の期待 (「外部送信しませんでは嘘になるので」とコメントし 'アプリからは自動送信しません' を期待する) は決定 011 と逆向きなので、1 文目と補足 3 か所の期待に書き換える。API テストで他の利用者の数値が返らないこと (O5)。

## Architecture decisions

| Basis (qa_ref) | Decision | Alternatives | Trade-on rationale | Consequences |
|---|---|---|---|---|
| qa-guide-decision-011 | フッタ 1 文目を明細を送らない事実に限り、AI 送信の補足を 3 か所に置く | 現行の 1 文目のまま | 画像に合わせつつ事実を隠さない | 補足が 1 か所でも欠けると誤表示になる |
| qa-guide-security-web-001 | 検索をブラウザ内で閉じる | サーバ検索 | 検索語が記録に残る経路を持たない | 検索対象は画面内の定数に限る |
| qa-guide-security-web-003 | `topic` は許可リスト、`q` は 100 字 (agent 推定・利用者未確認) | 自由入力 | 表示の乱れを入口で止める | 上限は利用者未確認 |
| qa-guide-security-web-001 | 壊れた期間を全期間に倒す (既存方針) | 400 を返す | 既存経路と挙動を揃える | 誤った指定に気付きにくい |

## Delivery, migration and rollback

- Build/deploy topology: 既存の web と api。
- Migration sequence: 入力の検証 → 検索のブラウザ内実装 → フッタの文言と補足 → common-shell のテスト更新。
- Rollback trigger/procedure: DOM テスト (補足 3 か所) が赤なら差し戻す。

## Risks and verification

- Risk/assumption: 補足を title 属性だけに置くと、タッチ端末や読み上げで読めない。プライバシー欄と使い方画面の本文にも置くことで補う。
- Risk/assumption: 1 文目だけを変えて補足を忘れると、AI 送信の事実が隠れる。3 か所をテストで固定する。
- Architecture fitness test: CSP の見出しが変わらないこと、検索で `fetch` が呼ばれないこと。
- Load/failure/security validation: 他の利用者のセッションで `/api/guide` が数値を返さないこと (O5)。
