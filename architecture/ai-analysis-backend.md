---
graph_node_id: "arch-ai-analysis-backend"
artifact_kind: "architecture"
artifact_subtypes: ["backend"]
title: "AI分析 — 依頼の段階を core の純関数 1 か所で導き、キャンセル・再実行・使用するデータの経路を足す"
project_id: "kanjo"
domain: "backend"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: []
tags: ["ai-analysis", "backend"]
file_path: "architecture/ai-analysis-backend.md"
template_id: "architecture"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluator": "system-spec-harness:assign-system-spec-completeness-evaluator", "evidence_ref": "system-spec/completeness-findings.json", "evaluated_digest": "e39b090e33900452ae1d5ce73e97bb80e02c65be0deb210278f19af238dafca4"}
source_lineage: {"origin_kind": "system-spec-harness", "source_plugin": "system-spec-harness", "source_path": "system-spec/backend.md", "source_version": "0.1.14", "source_digest": "e39b090e33900452ae1d5ce73e97bb80e02c65be0deb210278f19af238dafca4", "imported_at": "2026-09-19T13:11:57Z"}
created_at: "2026-09-19T13:11:57Z"
updated_at: "2026-09-19T13:11:57Z"
depends_on: ["spec-ai-analysis-screen"]
related_nodes: ["arch-ai-analysis-ui-ux", "arch-ai-analysis-frontend", "arch-ai-analysis-database", "arch-ai-analysis-auth", "arch-ai-analysis-security", "arch-ai-analysis-infrastructure", "arch-ai-analysis-maintenance-ops"]
resource_scope: ["packages/api/src/routes/ai.ts", "packages/api/src/ai/contract.ts", "packages/api/src/ai/dataset.ts", "packages/api/src/ai/period.ts", "packages/api/src/ai-lifecycle.test.ts", "packages/core/src/index.ts"]
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
classification_reason: "system-spec の backend 章 (web 確定・他 platform 対象外) を領域別の architecture 制約として参照する。"
classification_candidates: [{"artifact_kind": "architecture", "confidence": 1.0, "candidate_path": "architecture/ai-analysis-backend.md"}]
tracker_binding: "none"
beads_linkage: null
github_publication: {"mode": "local_only", "project_aliases": [], "labels": [], "milestone": null}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"policy": "manual", "status": "not_applicable", "source": null, "completed_at": null, "reconciled_at": null, "evidence_refs": []}
implementation_readiness: {"status": "complete", "missing_sections": [], "checked_at": "2026-09-19T13:11:57Z"}
serves_goals: ["G2", "G3", "G5"]
---

# Architecture overview

AI分析 — 依頼の段階を core の純関数 1 か所で導き、キャンセル・再実行・使用するデータの経路を足す。`system-spec/backend.md` は承認時入力、本書は段階の判定と API 契約の制約を持つ。契約と規則の正本は `specs/spec-ai-analysis-screen.md` (spec-ai-analysis-screen) の API 契約の節と段階の導出の節。

## Context and drivers

- Business/technical context: 現行の `taskStatus` (`packages/api/src/routes/ai.ts:68`) は `used_at` があれば done、`expires_at` を過ぎれば expired、それ以外 waiting の 3 値だけを返す。形式エラーは `reportValidator` (`ai.ts:40`) が 400 `invalid_report` で返すが差し戻しの事実を記録せず、エージェントのデータ取得 `GET /ai/tasks/:id/data` も取得時刻を記録しない。`DELETE /ai/tasks/:id` (`ai.ts:373`) は結果待ちの依頼を行ごと消し、受信済みは 409 で拒否する。再実行の経路は無い (qa-ai-backend-web-evidence-001)。
- Quality attribute priorities: G2・G3・G5 に資する。Clean Architecture の Dependency Rule (core ← api ← web の一方向) と data-access の境界 (永続化を route 側に閉じる) を適用する。
- Constraints: packages/core は依存ゼロの純関数。Cloudflare Workers (Hono) + D1。レポート JSON 契約 v3 (`packages/api/src/ai/contract.ts`) と skill `run-kanjo-accounting-report` は変えない。アプリから LLM を呼ばない。

## Goals and non-goals

- Goals:
  - G2: 段階と進捗 (待機中 0 / 実行中 50 / 実行中 75 / 完了 100 / 失敗 / キャンセル) を core の純関数 1 か所で `ai_tasks` の時刻列と現在時刻から導き、api の `taskStatus` をこれに置き換える。T-番号の整形も core に置く。
  - G3: `POST /ai/tasks/:id/cancel` と `POST /ai/tasks/:id/retry` を足し、`DELETE /ai/tasks/:id` を結果の無い依頼だけに限る (qa-ai-decision-003)。
  - G5: `GET /ai/inventory` で期間の使用するデータの件数を返し、AI へ渡すのは `dataset.ts` の集計値だけに保つ (qa-ai-decision-004)。
- Non-goals:
  - 段階名・進捗 % の保存 (記録から導く)
  - レポート JSON 契約 v3 と skill の変更
  - アプリからの LLM 呼び出し・キュー・外部ストレージ (scope.out)

## System context and boundaries

- Users/external systems: web (AI分析画面) と外部のエージェント (Claude Code / Codex)。エージェントは依頼ごとのトークンで `GET /ai/tasks/:id/data` と `POST /ai/tasks/:id/report` だけを呼ぶ。
- Trust/deployment/data boundaries: core は D1 を知らず、依頼の記録 (時刻列・連番・補足指示) と現在時刻だけを受け取る。route が D1 を読み書きし、判定は純関数へ渡して JSON へ写すだけにする。
- Context diagram: `system-spec/index.md` の章相互参照を参照する。

## Container and component view

| Container/Component | Responsibility | Interface | Data owner | Deployment unit |
|---|---|---|---|---|
| core 段階の導出 | 名前付きの順序表で段階と進捗を 1 つに決める | 純関数 | packages/core | 同一 Worker |
| core T-番号の整形 | 連番を T-0001 形式に、連番の無い旧行を『旧』と作成日にする | 純関数 | packages/core | 同一 Worker |
| core 版の説明 | 補足指示の 1 行目、無ければ v1『初回レポート』・v2 以降『最新のデータで再分析』 | 純関数 | packages/core | 同一 Worker |
| core タブの振り分け | レポート本文を 要約 / 根拠データ / 改善提案 / 関連リンク に問い順で配る | 純関数 | packages/core | 同一 Worker |
| core JSON エラー位置 | 取り込み欄の構文エラーの行と位置を返す | 純関数 | packages/core | 同一 Worker |
| `GET /ai/tasks` | 段階・進捗・T-番号を加えて返す | Hono route | packages/api | Worker |
| `POST /ai/tasks/:id/cancel` | `canceled_at` を記録し行を残す | Hono route | packages/api | Worker |
| `POST /ai/tasks/:id/retry` | 同じ期間と補足指示で新しい依頼とトークンを返す | Hono route | packages/api | Worker |
| `DELETE /ai/tasks/:id` | 結果の無い依頼だけを消す | Hono route | packages/api | Worker |
| `GET /ai/inventory` | 期間の freee 取引件数・MF 明細件数・科目数・取引先数を返す | Hono route | packages/api | Worker |
| `GET /ai/tasks/:id/data` / `POST /ai/tasks/:id/report` | データ取得時刻と差し戻し時刻・回数を記録する | Hono route (agent) | packages/api | Worker |

## Cross-cutting contracts

- Identity/access: 利用者経路は既存 `/api/*` のフェンス配下、エージェント経路は `agentGuard` (`architecture/ai-analysis-auth.md`)。
- Errors/resilience: id と期間は zod で書式を検証し、違反は 400。他の利用者の依頼 id は 404。受信済みの削除は従来どおり 409。エラー応答に内部の SQL・スタックを含めない。
- Observability/audit: N/A: 新しい信号を追加しない。出来事の時刻列が依頼ごとの監査記録を兼ねる。
- Configuration/secrets: 追加の秘密情報を持たない。
- Compatibility/versioning: `GET /ai/tasks` の各行は段階・進捗・T-番号を加法的に持つ。レポート JSON 契約 v3 と `POST /ai/tasks/:id/report` の受け付け形は変えない。

## Subtype architecture

- Frontend: N/A: 本章の関心外 (`architecture/ai-analysis-frontend.md`)
- Backend: 下記 Backend architecture を合成
- Infrastructure: N/A: 本章の関心外 (`architecture/ai-analysis-infrastructure.md`)
- Data: N/A: 本章の関心外 (`architecture/ai-analysis-database.md`)
- Security: N/A: 本章の関心外 (`architecture/ai-analysis-security.md`)

### Backend architecture

#### Runtime and architecture pattern

判定は core、入出力は api の 2 層に分ける。段階の優先順位は キャンセル (`canceled_at` あり) → 完了 (`used_at` あり) → 失敗 (期限切れ) → 実行中 75% (`rejected_at` あり) → 実行中 50% (`data_fetched_at` あり) → 待機中 0% で、最初に当たったものを採る。この順序は core の名前付きの順序表 1 か所に置く。順序そのものは agent 推定・利用者未確認 (根拠 qa-ai-backend-web-003)。`agentGuard` の拒否と画面の表示が同じ判定から出るため、キャンセル済みなのに画面では実行中に見えるずれが生じない。

#### Domain and module boundaries

段階・capability・T-番号・版の説明・タブの振り分け・JSON エラー位置は core の純関数で、api と web に同じ判定の重複実装を置かない。`agentTask`・貼り付け・UI操作は `aiTaskCapabilities` を共有する。レポート検証と無害化は `contract.ts` に閉じる。

#### API and service contracts

キャンセルは `canceled_at` を記録してトークンを無効にし、行を残す。再実行は新しい依頼・トークンを作る。レポートはアーカイブ中心で保持し、旧DELETEも参照を切らずアーカイブへ変換する。task claimとreport INSERTはD1 batch、同一系列の版番号はDBで一意にする。

#### Data and transaction behavior

出来事の書き込みはそれぞれの経路 1 か所に置く。データ取得時刻はエージェントのデータ取得、差し戻し時刻と回数はレポートの契約違反の応答、取消時刻はキャンセル経路、連番は依頼の発行と再実行で書く。段階の導出側は読むだけにする。差し戻しの記録は 400 応答を返す前に 1 行の更新で行い、レポート本体は保存しない。列の定義は `architecture/ai-analysis-database.md`。

#### Async processing

N/A: 本章にキューや遅延処理は無い。エージェントは利用者のコピー操作を起点に外部で動き、アプリはそれを待つだけで、状態は次の `GET /ai/tasks` で記録から導く。

#### Security and resilience

レポート送信と貼り付けには固定 4 MiB (4,194,304 bytes) の request budget を置き、境界を 1 byte 超えた転送は JSON 読み込み前に 413 `payload_too_large` で止める。この予算はレポート JSON 契約 v3 の field 上限を代替せず、読み込み後は `reportInputSchema` と `normalizeReport` が個別 field・配列を検証する。詳細は `architecture/ai-analysis-security.md`。

#### Operations and verification

core 単体テストで段階の優先順位を `toBe` で固定し、境界 4 件 (期限切れと受信が同時 = 完了、キャンセル後に期限切れ = キャンセル、差し戻し後にデータを再取得 = 75% のまま、期限ちょうど = 待機中) を含める (境界の選び方は agent 推定・利用者未確認、根拠 qa-ai-maintenance-ops-web-003)。API テスト (`packages/api/src/ai-lifecycle.test.ts` の系列) でキャンセル・再実行・削除・使用するデータの応答、他の利用者の id で 404、受信済みの削除で 409、差し戻しで `reject_count` が 1 増えることを確かめる。

## Architecture decisions

| Basis (qa_ref) | Decision | Alternatives | Trade-on rationale | Consequences |
|---|---|---|---|---|
| qa-ai-decision-002 | 段階を記録から導き保存しない | 段階名の列を持ち経路ごとに更新 | 判定が 1 か所に集まり、画面と拒否が食い違わない | 時刻列を 4 本足す必要がある |
| qa-ai-backend-web-001 | 判定を core の純関数に置き `taskStatus` を置き換える | api 内で 3 値を 6 値へ拡張 | web と api が同じ判定を使える | 旧 `taskStatus` の参照を全て移す |
| qa-ai-decision-003 | キャンセルは行を残し、削除は結果の無い依頼だけ | キャンセル = 行削除 (現行の『取り消し』) | 取り消した事実が一覧と拒否理由に残る | 削除とキャンセルの 2 操作を画面に並べる |
| qa-ai-backend-web-003 | 段階の優先順位を キャンセル → 完了 → 失敗 → 75% → 50% → 0% とする (agent 推定・利用者未確認) | 時刻の新しい出来事を優先 | 順序表 1 つで決定論になり、テストで固定できる | 順序の変更は表とテストの同時更新になる |
| qa-ai-decision-004 | 使用するデータを件数の読み取りで返し、AI へは集計値だけ | 明細の抜粋を見せる | 外へ出る範囲を利用者が確かめられ、持ち出し範囲は広がらない | `GET /ai/inventory` が 1 本増える |

## Delivery, migration and rollback

- Build/deploy topology: 既存 Worker (Hono) と packages/core のビルド。
- Migration sequence: core の段階・T-番号・版の説明・タブ・JSON エラー位置 → migration 0046 の適用 (`architecture/ai-analysis-database.md`) → 出来事の記録 (データ取得・差し戻し) → `GET /ai/tasks` の段階化 → キャンセル・再実行・使用するデータの経路 → `DELETE` の限定 → `taskStatus` の削除。
- Rollback trigger/procedure: core / API テストが落ちたら差し戻す。列は追加だけなので、旧 Worker に戻しても新しい列を読まないだけで壊れない。

## Risks and verification

- Risk/assumption: 段階が api と web に二重実装されると表示と拒否が食い違う。判定を core 1 か所に置き、api と web に段階の文字列比較が無いことを検索で確かめる。
- Architecture fitness test: core が D1 / Hono の型を参照しないこと。`taskStatus` の参照が残らないこと。レポート JSON 契約 v3 と skill の差分が 0 件であること (skills:test)。
- Load/failure/security validation: 使用するデータの件数は既存の表の件数読み取りで作り、D1 の待ち時間は Worker の CPU 時間に数えない。上限ちょうどのレポートが通り、1 バイト超えが 413 になる境界テストを置く。
