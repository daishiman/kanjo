---
graph_node_id: "arch-total-cashflow-security"
artifact_kind: "architecture"
artifact_subtypes: ["security"]
title: "トータル収支 — 脅威モデルと対策"
project_id: "kanjo"
domain: "security"
status: "active"
owners: ["daishiman"]
tags: ["total-cashflow", "system-spec", "security"]
priority: null
start_date: null
target_date: null
iteration: null
created_at: "2026-09-05T12:42:39Z"
updated_at: "2026-09-05T12:42:39Z"
depends_on: []
related_nodes: ["spec-total-cashflow-requirements"]
resource_scope: ["packages/api/src"]
purpose: null
goal: null
scope_in: []
scope_out: []
acceptance: []
architecture_refs: []
parent_feature: null
feature_package_id: null
phase_ref: null
file_path: "architecture/total-cashflow-security.md"
template_id: "architecture"
template_version: "1.0.1"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluator": "system-spec-harness:assign-system-spec-completeness-evaluator", "evidence_ref": "eval-log/completeness-findings-r7.json", "evaluated_digest": "b2c10d6b0ea7473d6d33e4a062f35af35d3aa8cdafff6c38a18f66be03bf2764"}
source_lineage: {"origin_kind": "system-spec-harness", "source_plugin": "system-spec-harness", "source_path": "system-spec/security.md", "source_version": "0.1.11", "source_digest": "b2c10d6b0ea7473d6d33e4a062f35af35d3aa8cdafff6c38a18f66be03bf2764", "imported_at": "2026-09-05T12:42:39Z"}
classification_confidence: 1.0
classification_reason: "system-spec-harness が確定させた章 system-spec/security.md の取込である。artifact_kind は章の性質から決まり (要件定義書=specification、技術章=architecture)、分類の余地が無いため確信度 1.0。serves_goals=G2,G3,G4 を通じて上位概念のゴールへ接地する。"
classification_candidates: [{"artifact_kind": "architecture", "confidence": 1.0, "candidate_path": "architecture/total-cashflow-security.md"}]
tracker_binding: "none"
beads_linkage: null
github_publication: {"mode": "local_only", "project_aliases": [], "labels": [], "milestone": null}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"policy": "manual", "status": "not_applicable", "source": null, "completed_at": null, "reconciled_at": null, "evidence_refs": []}
implementation_readiness: {"status": "complete", "missing_sections": [], "checked_at": "2026-09-05T12:42:39Z"}
serves_goals: ["G2", "G3", "G4"]
---

# トータル収支 — 脅威モデルと対策

トータル収支一覧機能の security 領域のアーキテクチャ。要件仕様は `spec-total-cashflow-requirements` を参照する。

> 本文の正本は `system-spec/security.md` (system-spec-harness 所有)。本ノードは複製ではなく、
> 正本への lineage 参照と、dev-graph 上の実装境界・確定根拠を保持する。
> 資するゴール: G2, G3, G4

## Architecture overview

扱うのは利用者本人の事業帳簿と家計の金額データであり、機密性 (第三者に見られない) と
完全性 (税務の正本である freee 帳簿を壊さない) を最重要とする。

## Context and drivers

本機能は「事業と家計が一体になった実態に対し、トータルでいくらプラスマイナスなのかが読めない」
という利用者の課題から出発している。現状 `analysis.ts` の `balanceMonth()` は Money Forward 側の
収支だけを balance とし、`comparison()` は事業と家計を左右に並べる割合ビューで合算しない。
単純合算ができないのは、個人カード・口座から払った事業経費 (bizAdvance) が freee にも記帳され、
事業口座から個人口座への振替 (bizIncome) が freee 売上の再登場であるため、収入・支出の双方で
二重計上が起きるからである。

セキュリティ側の駆動要因は完全性の側にある。freee 帳簿は税務申告の正本であり、本機能はそれを
読むだけで書き換えない。この一方向性が保たれる限り、本機能の不具合が税務上の記録を壊すことはない。

## Goals and non-goals

Goals: G2 (二重計上のない支出合計) / G3 (検算可能性) / G4 (要確認の可視化) を、脅威に対して
成り立たせ続けること。

Non-goals: 新しい認証基盤の導入、証明書ピンニング、端末紛失時のローカルデータ保護
(専用アプリを提供しないため保護対象は転送中のデータと D1 上のデータに限られる)。

## System context and boundaries

OWASP ASVS の適用範囲は web セルへ閉じる。攻撃面は `/api` と、そこから読む D1 のデータである。

## Container and component view

脅威と対策 (S1-S6):
- **S1** 未認証の第三者による財務データ閲覧 → `run_worker_first` による `/api` 全面の認証ゲート、
  Cloudflare Access JWT 検証または HMAC 署名 HttpOnly Cookie、タイミング非依存比較
  (SHA-256 ダイジェスト同士の比較)。
- **S2** パスワードへのブルートフォース → 既存 `login-rate-limit.ts` の窓・上限・ロック。
- **S3** 本機能が canonical データを破壊すること → 読み取り専用の投影として実装し canonical を
  書き換えない。書込面は `DuplicateVerdict` の upsert 1 点のみに限定し、既存
  `canonical-mutation-fence` と同じ方針で正本更新経路と分離する。
- **S4** 不正・不整合な入力によるデータ汚染 → 追加 API の入出力を zod スキーマで検証し、明細識別子を
  `MfTx.idStable` に限定して不安定な識別子での判断保存を拒否する。
- **S5** ログ・エラー応答からの金額や取引先の漏洩 → observability は有効だが、追加する処理で
  リクエストボディや明細内容をログへ出さない。
- **S6** 誤った重複判定による金額の過小計上 → 事業費へ寄せるのは freee 側の件数を上限 (`min(n, m)`)
  とし、freee に存在しない分の MF 明細を消さない不変条件を契約テストで固定する。

## Cross-cutting contracts

- 書込面は `DuplicateVerdict` upsert のただ 1 点。ここ以外から canonical へ書かない。
- 監査証跡は既存 `audit-log.ts` の方針に従い、`DuplicateVerdict` の変更を追跡可能にする。

## Subtype architecture

**security**: S6 は他と性質が違う。認証や入力検証が「外からの攻撃」を防ぐのに対し、S6 は
「自分の実装の誤りが金額を静かに過小計上する」という内側の失敗であり、対策は防御ではなく
不変条件のテスト固定である。金額の正しさを守ることをセキュリティ要件として扱っている。

## Architecture decisions

本ノード固有の意思決定レコードは持たない。認証境界は `dec-auth-boundary-001`、書込面の限定は
上位概念の制約 (canonical を書き換えない読み取りモデル) に従属する。

## Delivery, migration and rollback

既存の防御機構をそのまま使うため、セキュリティ構成の変更を伴わない。

## Risks and verification

- リスク: S6 の過小計上は「両方とも動いている」ため検出が遅れる性質を持つ。契約テストで
  `min(n, m)` 基数と freee 件数を超える付替 0 件を固定することが唯一の防御線である。
- 検証: S1-S6 それぞれに対応するテストを置き、各テストが旧実装に対して RED になることを確認する。
