---
graph_node_id: "arch-expense-matrix-database"
artifact_kind: "architecture"
artifact_subtypes: ["data"]
title: "支出マトリックス — 読み取り範囲 ±12 か月・新しい保存を作らない"
project_id: "kanjo"
domain: "database"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: []
tags: ["expense-matrix", "database"]
file_path: "architecture/expense-matrix-database.md"
template_id: "architecture"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluator": "system-spec-harness:assign-system-spec-completeness-evaluator", "evidence_ref": "system-spec/completeness-findings.json", "evaluated_digest": "5819bdcc8ddab7f90e038451e3835e406b3c84c98a492dcb7088451ad73a674a"}
source_lineage: {"origin_kind": "system-spec-harness", "source_plugin": "system-spec-harness", "source_path": "system-spec/database.md", "source_version": "0.1.14", "source_digest": "5819bdcc8ddab7f90e038451e3835e406b3c84c98a492dcb7088451ad73a674a", "imported_at": "2026-09-16T11:55:20Z"}
created_at: "2026-09-16T11:55:20Z"
updated_at: "2026-09-16T11:55:20Z"
depends_on: ["spec-expense-matrix-screen"]
related_nodes: ["arch-expense-matrix-ui-ux", "arch-expense-matrix-frontend", "arch-expense-matrix-backend", "arch-expense-matrix-auth", "arch-expense-matrix-security", "arch-expense-matrix-infrastructure", "arch-expense-matrix-maintenance-ops"]
resource_scope: ["packages/core/src/dataset.ts", "packages/api/src/routes/analytics.ts", "migrations", "docs/data-schema.md"]
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
classification_reason: "system-spec の database 章 (web 確定・他 platform 対象外) を領域別の architecture 制約として参照する。"
classification_candidates: [{"artifact_kind": "architecture", "confidence": 1.0, "candidate_path": "architecture/expense-matrix-database.md"}]
tracker_binding: "none"
beads_linkage: null
github_publication: {"mode": "local_only", "project_aliases": [], "labels": [], "milestone": null}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"policy": "manual", "status": "not_applicable", "source": null, "completed_at": null, "reconciled_at": null, "evidence_refs": []}
implementation_readiness: {"status": "complete", "missing_sections": [], "checked_at": "2026-09-16T11:55:20Z"}
serves_goals: ["G4"]
---

# Architecture overview

支出マトリックス — 読み取り範囲 ±12 か月・新しい保存を作らない。`system-spec/database.md` は承認時入力、本書はデータアクセス制約を持つ。スキーマの正本は `docs/data-schema.md`。

## Context and drivers

- Business/technical context: 画像の選択セル (広告宣伝費 × 2026年03月) は前年同月比 +300.0% を表示し、前年同月 (2025年03月) は表が並べている月の範囲に含まれない。前月比についても表示期間の先頭月のひとつ前が要る。マトリックスが表示する値は全て既存の明細から導出できる。
- Quality attribute priorities: G4 に資する。Clean Architecture の gateways/repositories boundary、Google SRE の『変更を小さく可逆に保つ』を適用する。
- Constraints: Cloudflare D1 + Drizzle。既存明細 (日付・取引先・内容・金額・カテゴリ・事業/家計の区分・決済手段) と既存の除外・判断 (freee 除外表、duplicate_verdicts) の読み取りだけで満たす。

## Goals and non-goals

- Goals:
  - G4: 期間・スコープ・軸を変えても同じ明細集合から導けるようにし、セル内訳も同じ Dataset の絞り込みで組む。
- Non-goals:
  - 新しいテーブル・集計結果の永続化・キャッシュ表
  - 既存データの書き換え
  - 端末内複製やオフライン同期 (web のみ)

## System context and boundaries

- Users/external systems: D1 のみ。外部ストレージを増やさない。
- Trust/deployment/data boundaries: 読み取りは全て `userId` で絞る (`architecture/expense-matrix-auth.md`)。core の集計関数は D1 を知らない。
- Context diagram: `system-spec/index.md` の章相互参照を参照する。

## Container and component view

| Container/Component | Responsibility | Interface | Data owner | Deployment unit |
|---|---|---|---|---|
| 明細読み取り | 表示期間 ±12 か月の明細を 1 往復で取得する | Drizzle クエリ (プレースホルダ束縛) | packages/api | Worker |
| Dataset 構築 | 月次系列・カテゴリ系列・取引先集約・未記帳月を組み立てる | `packages/core/src/dataset.ts` | packages/core | Worker |
| セル内訳絞り込み | 月 × 行キー (カテゴリ名 または 取引先名) × スコープ で明細を絞る | 同じ Dataset の絞り込み | packages/core | Worker |

## Cross-cutting contracts

- Identity/access: 集計もセル内訳も `c.get('userId')` を必ず条件に含める。
- Errors/resilience: 比較対象の月に実データが無い場合は欠測として '—' を返し、ゼロと区別する (ゼロ扱いは前月比 -100% という事実と異なる表示を生む)。
- Observability/audit: N/A: 実行時の信号を追加しない。
- Configuration/secrets: N/A: 接続情報は既存 binding のまま。
- Compatibility/versioning: 本サイクルで migration は発生しない。追加の索引が必要になった場合に限り migration を 1 本足す (既存データの書き換えは行わない)。

## Subtype architecture

- Frontend: N/A: 本章の関心外
- Backend: N/A: 本章の関心外 (`architecture/expense-matrix-backend.md`)
- Infrastructure: N/A: 本章の関心外
- Data: 下記 Data architecture を合成
- Security: N/A: 本章の関心外 (`architecture/expense-matrix-security.md`)

### Data architecture

#### Storage model and ownership

新しい保存を作らない。取込済みの freee / MoneyForward 由来の既存明細と既存の除外・判断を読むだけで、集計・セル内訳・偏り 3 点の全てを満たす。切替と選択は URL に置くため保存を要しない。

#### Read path

Dataset の取得範囲は表示期間より前後に 12 か月広く取る。表の集計に要る明細と、比較対象に要る明細は 1 往復にまとめて取得し、月ごとに問い合わせを繰り返さない。期間の絞り込み・区分・取引先の条件は文字列連結ではなくプレースホルダ束縛で渡す。

#### Aggregation inputs

区分で『事業』(`biz`) と『家計』(`personal`) を分ける。両者を足した『総合』は今サイクルでは持たない (仕様 §2.2 の利用者決定)。既存の Dataset が持つ月次系列とカテゴリ系列をそのまま使い、取引先軸のために取引先名での集約を足す。未記帳月の判定は既存の `unrecordedExpMonths` をそのまま使い、集計・比率・濃淡から除外する。

#### Data verification

期間・スコープ・軸を変えても同じ明細集合から導けることをテストで固定し、CSV と画面で二重のクエリを持たない。画像から読み取った数値との突き合わせ (仕入高 2026年03月 35.6万 は前月 27.1万 に対し +31.4%、広告宣伝費 2026年04月 16.2万 は 24.0万 からの -32.5%) を回帰テストの根拠に使う。

## Architecture decisions

| Basis (qa_ref) | Decision | Alternatives | Trade-on rationale | Consequences |
|---|---|---|---|---|
| dec-matrix-out-of-range-comparison | 読み取り範囲を表示期間の前後 12 か月へ広げる | 期間外は空欄 | 画像の前年同月比 +300.0% を再現できる | 読み取り件数が増えるが明細件数に線形 |
| qa-matrix-database-web-003 | 新しい保存・migration を作らない | 集計結果を表へ保存 | 実装を戻せば元の状態に戻り、ロールバック手順が不要になる | 毎回集計するため CPU 時間の見積りが要る |
| dec-matrix-counterparty-axis | 取引先名での集約を Dataset 構築に足す | 表示時に web で集約 | サーバ側で畳めば応答サイズが取引先数に依存しない | 取引先名の表記ゆれは既存の正規化に従う |

## Delivery, migration and rollback

- Build/deploy topology: 既存 Worker + D1。binding の追加なし。
- Migration sequence: なし (本サイクルはスキーマを変えない)。索引追加が必要と判明した場合のみ migration を 1 本足す。
- Rollback trigger/procedure: スキーマ変更が無いため、実装の差し戻しだけで元に戻る。

## Risks and verification

- Risk/assumption: ±12 か月の読み広げで読み取り件数が増える。増加は明細件数に線形で、既存の総収支の読み取りと同程度に収まる見込み。
- Architecture fitness test: セル内訳専用の SQL が増えていないこと。条件式に取引先名が文字列連結されていないこと。
- Load/failure/security validation: 読み取りが `userId` で絞られていること。欠測が '—' で返りゼロと区別されること。
