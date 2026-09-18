---
graph_node_id: "arch-expense-matrix-security"
artifact_kind: "architecture"
artifact_subtypes: ["security"]
title: "支出マトリックス — 入力は列挙値で閉じ、出力へ明細を漏らさない"
project_id: "kanjo"
domain: "security"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: []
tags: ["expense-matrix", "security"]
file_path: "architecture/expense-matrix-security.md"
template_id: "architecture"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluator": "system-spec-harness:assign-system-spec-completeness-evaluator", "evidence_ref": "system-spec/completeness-findings.json", "evaluated_digest": "fede51eb4a0dd594e4e8cafb51c3ca7d389aea3a16228fcc353061d9679490db"}
source_lineage: {"origin_kind": "system-spec-harness", "source_plugin": "system-spec-harness", "source_path": "system-spec/security.md", "source_version": "0.1.14", "source_digest": "fede51eb4a0dd594e4e8cafb51c3ca7d389aea3a16228fcc353061d9679490db", "imported_at": "2026-09-16T11:55:20Z"}
created_at: "2026-09-16T11:55:20Z"
updated_at: "2026-09-16T11:55:20Z"
depends_on: ["spec-expense-matrix-screen"]
related_nodes: ["arch-expense-matrix-ui-ux", "arch-expense-matrix-frontend", "arch-expense-matrix-backend", "arch-expense-matrix-database", "arch-expense-matrix-auth", "arch-expense-matrix-infrastructure", "arch-expense-matrix-maintenance-ops"]
resource_scope: ["packages/api/src/routes/analytics.ts", "packages/web/src/pages/analysis/Matrix.tsx", "packages/core/src/csv.ts"]
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
classification_candidates: [{"artifact_kind": "architecture", "confidence": 1.0, "candidate_path": "architecture/expense-matrix-security.md"}]
tracker_binding: "none"
beads_linkage: null
github_publication: {"mode": "local_only", "project_aliases": [], "labels": [], "milestone": null}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"policy": "manual", "status": "not_applicable", "source": null, "completed_at": null, "reconciled_at": null, "evidence_refs": []}
implementation_readiness: {"status": "complete", "missing_sections": [], "checked_at": "2026-09-16T11:55:20Z"}
serves_goals: ["G4", "G5"]
---

# Architecture overview

支出マトリックス — 入力は列挙値で閉じ、出力へ明細を漏らさない。`system-spec/security.md` は承認時入力、本書は入出力の防御制約を持つ。doctrine anchor は OWASP ASVS 5.0.0。

## Context and drivers

- Business/technical context: 本サイクルは URL クエリで表示モード・スコープ・軸・選択セルを受け取り、セル内訳として取引先名・内容・金額を含む明細を返す。入力経路と出力経路がどちらも増えるため、検証と漏出防止を明示的に置く。
- Quality attribute priorities: G4・G5 に資する。ASVS の入力検証 (許可リスト)、出力エンコーディング、機微情報の露出防止を適用する。
- Constraints: 依存を増やさない (既存の検証手段だけで満たす)。web のみ。

## Goals and non-goals

- Goals:
  - G4: 新設クエリの値域をサーバ側で閉じ、想定外の値を 400 で返す。
  - G5: 明細を含む応答・CSV・URL・ログのいずれからも、意図しない形で内容が漏れないようにする。
- Non-goals:
  - 新しい認証・暗号方式の導入 (`architecture/expense-matrix-auth.md`)
  - 外部サービスへのデータ送出を伴う機能
  - 端末側のセキュア保存 (web のみ)

## System context and boundaries

- Users/external systems: 外部送信なし。取引データをアプリの外へ出さない。
- Trust/deployment/data boundaries: 信頼できない入力は URL クエリのみ。出力の信頼境界は JSON 応答・CSV・ブラウザ DOM の 3 つ。
- Context diagram: `system-spec/index.md` の章相互参照を参照する。

## Container and component view

| Container/Component | Responsibility | Interface | Data owner | Deployment unit |
|---|---|---|---|---|
| クエリ検証 | `mode` / `scope` / `axis` / `month` / `key` の値域検査 | Hono route 前段 | packages/api | Worker |
| JSON 応答 | 必要な項目だけを返す | Hono route | packages/api | Worker |
| CSV 書き出し | 数式解釈を防ぐエスケープ | `packages/core/src/csv.ts` | packages/core | Worker |
| 画面描画 | React の既定エスケープのみで描く | packages/web | packages/web | web ビルド |

## Cross-cutting contracts

- Identity/access: `architecture/expense-matrix-auth.md` に従い、全読み取りを `userId` で絞る。
- Errors/resilience: 列挙値に無い値・長すぎる `key`・書式不正な `month` は 400。エラー本文に SQL・スタック・内部パスを含めない。
- Observability/audit: 監査ログに明細金額・取引先名を書かない。記録するのは操作の種別と時刻までとする。
- Configuration/secrets: 新しい秘密情報を持たない。
- Compatibility/versioning: 応答に `Cache-Control: no-store` を付け、明細を含む応答が中間で保持されないようにする。

## Subtype architecture

- Frontend: N/A: 本章の関心外
- Backend: N/A: 本章の関心外
- Infrastructure: N/A: 本章の関心外
- Data: N/A: 本章の関心外
- Security: 下記 Security architecture を合成

### Security architecture

#### Input validation

`mode` / `scope` / `axis` は列挙値の許可リストで検査し、外れた値は 400 とする (既定値へ黙って落とさない)。`month` は `YYYY-MM` の書式検査を行う。`key` (カテゴリ名または取引先名) は完全一致で照合し、長さ上限を設け、LIKE や部分一致の条件に使わない。条件値は全てプレースホルダ束縛で渡す。

#### Output protection

画面は React の既定エスケープだけで描き、本画面のどこにも `dangerouslySetInnerHTML` を使わない。CSV は先頭が `=` `+` `-` `@` の値をエスケープし、表計算ソフトが数式として解釈しないようにする。明細を含む応答には `Cache-Control: no-store` を付ける。

#### Data exposure control

URL には金額や個人名を置かない。選択中セルの識別は行キーと年月に留め、詳細は認証済み API で取りに行く。これは URL が履歴・共有・参照元ヘッダーを通じて残るためである。

#### Dependency and supply chain

本サイクルで新しい依存を追加しない。ヒートマップも表も既存資産で組む。

#### Security verification

API テストで列挙値違反が 400 になること、`key` の長さ上限が効くこと、CSV エスケープが掛かることを検証する。web 側は `dangerouslySetInnerHTML` の不在を検索で確認する。

## Architecture decisions

| Basis (qa_ref) | Decision | Alternatives | Trade-on rationale | Consequences |
|---|---|---|---|---|
| qa-matrix-security-web-003 | 列挙値違反は既定値へ倒さず 400 を返す | 不正値を既定値に丸める | 想定外の入力が黙って別の集計として通らない | 画面側も不正な URL を扱える必要がある |
| qa-matrix-security-web-003 | `key` は完全一致・長さ上限・LIKE 禁止 | 部分一致検索を許す | 条件の組み立てに利用者入力を混ぜない | 表記ゆれの吸収は既存の正規化に委ねる |
| qa-matrix-security-web-004 | URL に金額・個人名を置かない | セル内訳を URL に載せる | 履歴や共有で明細が流出しない | 選択の復元には API 再取得が要る |
| qa-matrix-security-web-003 | CSV の `= + - @` をエスケープする | そのまま書く | 表計算ソフトでの数式実行を防ぐ | 先頭文字が変わる値の見え方に注意する |

## Delivery, migration and rollback

- Build/deploy topology: 既存 Worker と web ビルド。依存追加なし。
- Migration sequence: クエリ検証 → 応答ヘッダー → CSV エスケープ → 画面側の描画確認。
- Rollback trigger/procedure: セキュリティ関連テストが落ちたら差し戻し。データ変更が無いため巻き戻し不要。

## Risks and verification

- Risk/assumption: 利用者入力の `key` を条件式へ文字列連結すると注入の余地が生まれる。束縛の使用をテストとレビューで固定する。
- Architecture fitness test: 条件式に文字列連結が無いこと。`dangerouslySetInnerHTML` が本画面に無いこと。
- Load/failure/security validation: 列挙値違反の 400、長すぎる `key` の拒否、CSV エスケープ、`no-store` の付与。
