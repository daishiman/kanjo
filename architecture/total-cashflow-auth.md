---
graph_node_id: "arch-total-cashflow-auth"
artifact_kind: "architecture"
artifact_subtypes: ["security"]
title: "トータル収支 — 認証境界"
project_id: "kanjo"
domain: "auth"
status: "active"
owners: ["daishiman"]
tags: ["total-cashflow", "system-spec", "auth"]
priority: null
start_date: null
target_date: null
iteration: null
created_at: "2026-09-05T12:42:39Z"
updated_at: "2026-09-05T12:42:39Z"
depends_on: []
related_nodes: ["spec-total-cashflow-requirements"]
resource_scope: ["packages/api/src/auth.ts", "packages/api/wrangler.jsonc"]
purpose: null
goal: null
scope_in: []
scope_out: []
acceptance: []
architecture_refs: []
parent_feature: null
feature_package_id: null
phase_ref: null
file_path: "architecture/total-cashflow-auth.md"
template_id: "architecture"
template_version: "1.0.1"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluator": "system-spec-harness:assign-system-spec-completeness-evaluator", "evidence_ref": "eval-log/completeness-findings-r7.json", "evaluated_digest": "a87513e0ed417ea678374665baa176e4a2272dcd5aaa730aa658e2e339e2a635"}
source_lineage: {"origin_kind": "system-spec-harness", "source_plugin": "system-spec-harness", "source_path": "system-spec/auth.md", "source_version": "0.1.11", "source_digest": "a87513e0ed417ea678374665baa176e4a2272dcd5aaa730aa658e2e339e2a635", "imported_at": "2026-09-05T12:42:39Z"}
classification_confidence: 1.0
classification_reason: "system-spec-harness が確定させた章 system-spec/auth.md の取込である。artifact_kind は章の性質から決まり (要件定義書=specification、技術章=architecture)、分類の余地が無いため確信度 1.0。serves_goals=G1,G7 を通じて上位概念のゴールへ接地する。"
classification_candidates: [{"artifact_kind": "architecture", "confidence": 1.0, "candidate_path": "architecture/total-cashflow-auth.md"}]
tracker_binding: "none"
beads_linkage: null
github_publication: {"mode": "local_only", "project_aliases": [], "labels": [], "milestone": null}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"policy": "manual", "status": "not_applicable", "source": null, "completed_at": null, "reconciled_at": null, "evidence_refs": []}
implementation_readiness: {"status": "complete", "missing_sections": [], "checked_at": "2026-09-05T12:42:39Z"}
serves_goals: ["G1", "G7"]
---

# トータル収支 — 認証境界

トータル収支一覧機能の auth 領域のアーキテクチャ。要件仕様は `spec-total-cashflow-requirements` を参照する。

> 本文の正本は `system-spec/auth.md` (system-spec-harness 所有)。本ノードは複製ではなく、
> 正本への lineage 参照と、dev-graph 上の実装境界・確定根拠を保持する。
> 資するゴール: G1, G7

## Architecture overview

本機能の追加 API (一覧表の読み取り、`DuplicateVerdict` の更新) を、既存の `/api` 認証ゲートの
内側に置く。認証境界を 1 つに保ち、本機能だけ到達性が異なる状態を作らない。

## Context and drivers

本機能は「事業と家計が一体になった実態に対し、トータルでいくらプラスマイナスなのかが読めない」
という利用者の課題から出発している。現状 `analysis.ts` の `balanceMonth()` は Money Forward 側の
収支だけを balance とし、`comparison()` は事業と家計を左右に並べる割合ビューで合算しない。
単純合算ができないのは、個人カード・口座から払った事業経費 (bizAdvance) が freee にも記帳され、
事業口座から個人口座への振替 (bizIncome) が freee 売上の再登場であるため、収入・支出の双方で
二重計上が起きるからである。

認証側の駆動要因は、守る対象が「事業と家計を合算した財務データそのもの」であることと、利用者が
単独でロール分割が存在しないことである。この条件下で境界を増やすと、得られる利得に対して失う
安全性 (失効漏れ・ローテーション漏れの経路増加) が明らかに大きい。

## Goals and non-goals

Goals: G1 と G7 の前提条件としての到達性の保証。

Non-goals: 読み取り専用トークンの発行、Cloudflare Access への一本化とアプリ内セッション認証の廃止、
ロール分割の導入。いずれも代替案として提示のうえ棄却されている。

## System context and boundaries

`wrangler.jsonc` の `run_worker_first: ['/api/*']` により、追加する読み取り API も
`DuplicateVerdict` 更新 API も必ずゲートを通る。ゲートの迂回経路が構造的に存在しない。

## Container and component view

既存の二段構えをそのまま使う。
- `ACCESS_AUD` / `ACCESS_TEAM_DOMAIN` 設定時: Cloudflare Access JWT を検証する。
- 未設定時 (ローカル開発・プレビュー): アプリ内セッション認証 (HMAC 署名 HttpOnly Cookie)。
新しいコンポーネントを追加しない。

## Cross-cutting contracts

- 認可はロール分割を持たない単一主体モデル。複数人で使い始める場合はこの前提が崩れる。
- 資格情報の保持はブラウザのセッションに限定される (専用アプリを提供しないため、OS のセキュア
  ストレージや生体認証を認証要素に含めるという検討自体が発生しない)。

## Subtype architecture

**security**: 二段構えを保つこと自体が防御である。Access 一本化案は本番の防御こそ強いが、
ローカル開発・プレビューで認証が働かず開発と本番で経路が分岐する。分岐は「開発用の迂回経路を
本番へ持ち込む」事故形態を生み、二段構えではその事故形態が起こらない。

## Architecture decisions

- `dec-auth-boundary-001` = `opt-existing-gate` (確定、`qa-decision-auth-boundary-002` で
  代替案 B・C を提示のうえ利用者が明示選択)。この記録は、前サイクルの `qa-auth-web-001` が
  代替案を示さない Yes/No 誘導であったという独立ヒアリング監査の指摘を受けて取り直したものである。

## Delivery, migration and rollback

認証まわりの構成変更を伴わない。追加 API を既存ゲートの内側へ置くだけで、シークレット
(`AUTH_PASSWORD` / `SESSION_SECRET`) も増えない。

## Risks and verification

- リスク: `SESSION_SECRET` の漏洩は本機能を含む全 API に同時に影響する。これは既存システム全体の
  既知リスクであり本機能が新たに増やすものではないが、ローテーション手順の存在は前提となる。
- リスク: 将来、税理士など第三者へ一覧表だけを見せたくなった場合はこの決定の見直しが要る。
  その時点で改めて意思決定として扱う。
- 検証: 追加 API が未認証で到達できないことをテストで固定する。
