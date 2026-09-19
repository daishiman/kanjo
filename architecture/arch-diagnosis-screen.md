---
graph_node_id: "arch-diagnosis-screen"
artifact_kind: "architecture"
artifact_subtypes: ["frontend", "backend", "data", "security", "infrastructure"]
title: "診断画面 (08-diagnosis) のアーキテクチャ"
project_id: "kanjo"
domain: "analysis"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: []
tags: ["diagnosis", "analysis", "system-spec-import"]
file_path: "architecture/arch-diagnosis-screen.md"
template_id: "architecture"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence:
  evaluator: "system-spec-harness/assign-system-spec-completeness-evaluator@0.1.14"
  evidence_ref: "system-spec/completeness-findings.json"
  evaluated_digest: "bdf85a500e716a7cc8a76dd25d91d5c9ff1cae62ab1b9002cbbd197fe0a75047"
source_lineage:
  origin_kind: "system-spec-harness"
  source_plugin: "system-spec-harness"
  source_path: "system-spec/index.md"
  source_version: "0.1.14"
  source_digest: "981e7c821de2de5b44e158922e6285e30b75637137c22e47ea324910f2d47c55"
  imported_at: "2026-09-18T01:29:14Z"
created_at: "2026-09-18T01:29:14Z"
updated_at: "2026-09-18T01:29:14Z"
depends_on: []
related_nodes: ["spec-diagnosis-screen"]
resource_scope:
  - "packages/core/src"
  - "packages/api/src/routes"
  - "migrations"
  - "packages/web/src/pages/analysis"
  - "docs"
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
classification_reason: "system-spec-harness の確定章のうち frontend / backend / database / auth / security / infrastructure / maintenance-ops の 7 章を出典とする構造と境界の決定であり、artifact_kind=architecture に一意に定まる。5 つの subtype すべてに該当する章が確定済みのため subtype を 5 件宣言する。"
classification_candidates: []
tracker_binding: "none"
beads_linkage: null
github_publication:
  mode: "local_only"
  project_aliases: []
  labels: []
  milestone: null
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence:
  policy: "manual"
  status: "not_applicable"
  source: null
  completed_at: null
  reconciled_at: null
  evidence_refs: []
implementation_readiness:
  status: "complete"
  missing_sections: []
  checked_at: "2026-09-18T01:29:14Z"
---

<!-- 本書は依存境界と ADR の正本。観測可能な振る舞いは spec、算式は docs/diagnosis-screen.md を参照する。 -->

# 診断画面アーキテクチャ

既存の React SPA → Hono Worker → core 純粋関数 / D1 という依存方向を保ち、新しいサービスや依存パッケージを増やさない。検知規則は core、認証済み所有権は API、判断の永続化は D1、表示状態は web が所有する。

## 依存境界

| 境界 | 責務 | 禁止 |
|---|---|---|
| `packages/core/src/diagnosis-detectors.ts` | 検知器、impactBasis、scope / metric、claimKeys、query 付き nextAction、`detectImprovements()` | HTTP・D1・React への依存 |
| `packages/core/src/diagnosis-health.ts` | 健全性スコア | 画面文脈・永続化 |
| `packages/core/src/diagnosis-screen.ts` | 既存診断と改善項目を `diagnosisScreen()` で画面応答へ合成 | 検知器 id の分岐、D1 読み書き |
| `packages/api/src/routes/analytics.ts` | 認証、期間 Dataset、core 呼出し、action state の join / upsert | 検知規則、クライアント指定 user_id の採用 |
| `migrations/` | D1 schema の正本 | package 配下への migration 複製 |
| `packages/api/src/db/schema.ts` | migration の Drizzle 投影 | migration と異なる所有キー |
| `packages/web/src/pages/analysis/Diagnosis.tsx` | 状態・取得・保存・master-detail のページ制御 | 検知器 id 分岐、金額の再集計 |
| `packages/web/src/pages/analysis/diagnosis/` | 汎用表示コンポーネント | API 契約・計算規則の再定義 |

依存方向は `web → API contract`、`api → core / D1`、`core → 依存なし`。D1 は web から直接触らない。

## データフローと所有

1. web が `usePeriod` の期間と URL の scope / metric / compare を API へ送る。
2. API がセッションの user_id で Dataset と action state を読み、期間を適用する。
3. `diagnosisScreen()` が selection を `detectImprovements()` へ渡す。
4. `detectImprovements()` が scope / metric を適用し、annualImpact → claimKeys 数 → confidence → action_key の順で安定化して claim overlap を除外する。
5. API が同じ user_id の status / note / decided_at を重ね、同じ改善項目集合から totals / waterfall / signals を再構成して返す。
6. web は返却値を master、detail、primary、固定アクションバーへ投影し、再計算しない。

| 状態 | system of record |
|---|---|
| 期間 | `usePeriod` / localStorage |
| scope / metric / compare / action / done / stats | URL searchParams |
| 検知結果・primary・totals・waterfall・signals | core の導出値。保存しない |
| status / note / decided_at | D1 `diagnosis_action_states` |
| action state の所有境界 | `(user_id, action_key)` |

## 永続化とセキュリティ

`diagnosis_action_states` は user_id / action_key / status / note / decided_at / created_at / updated_at を持ち、PRIMARY KEY は `(user_id, action_key)`。status は 4 語の CHECK 制約を持つ。

- API は user_id をクライアント入力として受け取らず、セッションから取得する。
- SELECT / UPSERT は必ず user_id を束縛する。
- action_key / status / note は許可リストと長さで検証し、SQL はプレースホルダ束縛する。
- note、取引先名、金額をログへ出さない。
- 検知結果は派生値なので保存せず、検知されなくなった action state は再発時の復元用に残す。
- 外部 API・キュー・キャッシュ・新しい秘密情報は追加しない。

## Frontend 構造

`Diagnosis.tsx` はページ制御だけを持ち、条件、結果カード、シグナル、アクション表、詳細、ウォーターフォール、根拠、結果指標、固定アクションバー、旧統計を子コンポーネントへ分ける。

- primary improvement は有効な改善項目の先頭。
- アクション表を master、選択項目を detail とする。
- 固定アクションバーは detail と同じ action_key を参照し、本文を隠さない末尾余白を確保する。
- nextAction は core が返す percent encode 済み query を含む URL を Link へ渡す。
- status 保存は楽観更新せず、成功後に diagnosis query を invalidate する。
- 色・文字・余白・チャートは `docs/design-system.md` と design tokens に従う。

## ADR

| ADR | 決定 | 理由 / 帰結 |
|---|---|---|
| ADR-001 | 検知規則をレジストリへ置き、`detectImprovements()` が scope / metric / claim 排他を一括適用する | web / api の id 分岐をなくし、合計と図表を同じ集合へ揃える。Improvement は自己記述型になる |
| ADR-002 | 改善余地を保存せず、利用者の判断だけを保存する | 明細更新後も判断を残し、古い金額を正本にしない |
| ADR-003 | action state を D1 の `(user_id, action_key)` へ置く | 端末・利用者間の混線を防ぎ、再ログイン後も復元する |
| ADR-004 | 健全性スコアは自データだけから規則で出す | 外部ベンチマークなしで再現できる |
| ADR-005 | ウォーターフォールは既存 chart.js の floating bar を使う | 新規依存と bundle 増を避ける |
| ADR-006 | status は楽観更新せず、保存後のサーバ応答を正とする | totals / collapse / signals の一時的不整合を避ける |
| ADR-007 | 期間は usePeriod / localStorage、診断固有状態は URL に分ける | 画面間の期間共有と共有リンク復元を両立する |
| ADR-008 | primary + master-detail + 固定アクションバーを使う | 画像の情報密度を保ち、選択中の次の操作を見失わせない |

## 配信・移行

- schema 変更は repository 直下の `migrations/` に連番 1 本で追加する。
- Drizzle schema は migration と同じ `(user_id, action_key)` を投影する。
- 本番反映順は manifest → Migrate APPLY → Deploy。新表を参照するコードを先に配信しない。
- rollback は web / API を戻す。追加専用の表は残してよく、既存行の巻き戻しは行わない。
- GET は追加フィールドだけの後方互換とし、旧 Worker 応答では web が旧統計表示へフォールバックする。

## Fitness checks

- packages/web と packages/api に登録済み検知器 id の分岐がない。
- core の同じ重複排除済み集合から primary / totals / waterfall / signals が導出される。
- user A / user B の同じ action_key が別行になり、互いに読めない。
- recurring_monthly だけを 12 倍し、one_off は 1 倍、waterfall の結果は 0 を下限にする。
- business / household / total と expense / income / net が改善項目へ適用される。
- migration の正本が `migrations/`、期間の正本が `usePeriod` / localStorage である。

振る舞いの受入条件は `specs/spec-diagnosis-screen.md`、算式は `docs/diagnosis-screen.md`、テスト入力は `docs/diagnosis-screen-test-plan.md`、実測は `docs/diagnosis-screen-evidence.md` を参照する。
