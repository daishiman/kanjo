---
graph_node_id: "arch-import-deletion-undo-boundary"
artifact_kind: "architecture"
artifact_subtypes: ["backend", "data", "infrastructure"]
title: "取込データ削除・上書きと取り消しの境界"
project_id: "kanjo"
domain: "backend"
status: "draft"
owners: []
tags: ["import", "deletion", "undo", "d1-budget"]
priority: "high"
start_date: null
target_date: null
iteration: null
created_at: "2026-08-31T00:00:00Z"
updated_at: "2026-09-02T00:00:00Z"
depends_on: []
related_nodes: ["arch-override-reapply-three-way-merge", "arch-d1-schema-lifecycle"]
resource_scope: ["architecture/arch-import-deletion-undo-boundary.md"]
parent_feature: null
feature_package_id: null
phase_ref: null
file_path: "architecture/arch-import-deletion-undo-boundary.md"
template_id: "architecture"
template_version: "1.0.1"
confirmation_status: "confirmed"
evaluation_status: "pending"
confirmation_evidence: {"evaluator": "manual-review", "evidence_ref": "system-spec/spec-state.json", "evaluated_digest": null}
source_lineage: {"origin_kind": "manual", "source_plugin": null, "source_path": "system-spec/spec-state.json", "source_version": "1.0", "source_digest": null, "imported_at": "2026-09-02T00:00:00Z"}
classification_confidence: 1.0
classification_reason: "4粒度の削除が明細・派生状態・指紋・手動記録の4系統をまたぐ横断契約であり、単一 feature の実装詳細に収まらないためアーキテクチャ層。"
classification_candidates: []
github_publication: {"mode": "local_only", "project_aliases": [], "labels": [], "milestone": null}
issue_linkage: null
tracker_binding: "none"
beads_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"policy": "manual", "status": "open", "source": null, "completed_at": null, "reconciled_at": null, "evidence_refs": []}
implementation_readiness: {"status": "blocked", "missing_sections": ["大規模 undo の分割・再開境界と query budget の完了証拠"], "checked_at": "2026-09-02T00:00:00Z"}
purpose: "取込データの削除と上書きを、単発の破壊操作ではなく preflight → 退避 → 実行 → 再収束 の1本の経路へ閉じる。"
goal: "どの粒度で消しても、消える範囲が事前に数で示され、直後に戻せ、派生状態が実データと一致する状態へ必ず収束する。"
scope_in: ["4粒度(明細/取込単位/期間/全件)の削除境界", "preflight の責務範囲", "undo 退避テーブルの原子性と保持期間", "監査記録に載せてよい情報の境界", "import_active_targets の指紋巻き戻しと monthly_agg の再計算", "D1 Free の制約に対する分割実行"]
scope_out: ["CSV/ZIP パース仕様の変更", "freee/マネーフォワード側への波及", "取込以外の経路で作られたデータの一括削除", "R2 原本オブジェクトの保持期間ポリシー", "認証方式の変更"]
acceptance: []
architecture_refs: []
---

# Architecture overview

本ノードは、利用者が明示して行う削除・上書きを **preflight (事前提示) → 退避 → 実行 → 再収束** という単一経路へ閉じ、その各段が何を保証し何を保証しないかを定める。規範の正本は `system-spec/spec-state.json` (G1/G3/G4/G5、D1〜D8) であり、本書はそれを再掲せず境界だけを書く。

## Context and drivers

- ビジネス/技術文脈: 取込元 (freee / マネーフォワード ME) は生きたサービスであり、既に取り込んだ内容と再ダウンロードした CSV が食い違う。利用者には「この取込をなかったことにする」「この期間を空にする」手段が無い。
- 品質属性の優先順: 消えないこと > 戻せること > 派生状態の一致 > 所要時間 > 実装量。記帳データは確定申告の根拠であり、意図しない欠落を他のすべてに優先して防ぐ。
- 制約: 本番 D1 への破壊的操作であり、実行は利用者の明示的な確認を経る。既存の月単位洗い替えと `POST /restore` の挙動を壊さない。スキーマ追加は `migrations/` へ連番 append-only。

## Goals and non-goals

- Goals: 削除の粒度を4つに固定し、どの粒度でも「事前に数で見える」「直後に戻せる」「後から辿れる」を同時に満たす。削除と派生状態の巻き戻しを対で不可分にする。
- Non-goals: 取込元サービス側のデータ変更、パース仕様の見直し、削除を無確認で行う経路、取込以外の由来を持つデータの一括初期化。

## System context and boundaries

- 利用者/外部システム: 記帳担当 (単一利用者)、Cloudflare D1 (`kanjo-db`)、R2 (`kanjo-files`、取込原本)、Workers ランタイム。
- 信頼/配備/データ境界: 削除範囲の解決はサーバ側で `user_id` スコープに閉じ、クライアントから渡された範囲をそのまま信用しない。退避行は明細を含むため保存先を増やさず `kanjo-db` 内に留め、既存の `user_id` によるアクセス制御をそのまま効かせる。
- 排他境界: 削除・上書きは取込と同じ `import_writer_claims` (利用者別の単一 writer claim・TTL 15分) の配下で実行し、取込と削除が同時に走らない。
- 文脈図:

```mermaid
flowchart LR
  UI["仕分け明細 / 取込履歴 / 削除UI"] -->|1. preflight (件数・範囲・巻き添え)| PF["事前確認"]
  PF -->|2. 利用者の明示確認| EXEC["削除・上書き実行"]
  CLAIM["import_writer_claims (単一writer)"] --> EXEC
  EXEC -->|同一バッチ| SNAP["undo 退避テーブル (保持期間つき)"]
  EXEC --> TX["mf_transactions / freee_deals / balance_entries"]
  CASH["cash_entries (手動記録)"] -. "対象外 / 巻き添え 0件" .-> EXEC
  EXEC --> AUDIT["監査記録 (種別・範囲・件数・日時)"]
  TX --> RECONV["再収束: import_active_targets 指紋 / monthly_agg"]
  SNAP -->|保持期間内| UNDO["取り消し"]
  UNDO --> TX
  UNDO --> RECONV
  SWEEP["掃除ジョブ"] -->|期限切れ削除| SNAP
```

## Container and component view

| Container/Component | Responsibility | Interface | Data owner | Deployment unit |
|---|---|---|---|---|
| preflight | 対象件数・対象期間・巻き添えになる手動記録の件数を、書き換えを起こさずに返す | 削除系 API の事前照会 | backend | Worker |
| 削除実行 | 4粒度 (明細/取込単位/期間/全件) の対象解決と本体変更 | 削除系 API | backend | Worker |
| undo 退避テーブル | 直前状態の行を保持期間つきで保持する (決定 D1-undo-snapshot-store) | SQL | D1 | migrations |
| 操作監査テーブル | 操作種別・範囲・件数・日時・結果を残す。明細 payload を持たない | SQL | D1 | migrations |
| 指紋巻き戻し | `import_active_targets` の現行指紋を削除範囲に合わせて戻す | 削除実行の内部 | backend | Worker |
| 派生再計算 | `monthly_agg` を実データから再計算する | 削除実行の内部 | backend | Worker |
| 掃除ジョブ | 保持期間を過ぎた退避行を確実に消す | scheduled | backend | Worker |

## Cross-cutting contracts

- Identity/access: 削除系・上書き系・preflight・undo の各 API は既存の session/token 認証後の共通入口の配下に置き、public auth 経路から到達させない。単一利用者運用のため step-up 再認証は求めず、範囲の明示入力と二段階確認を歯止めとする。
- Errors/resilience: 退避行の書込・本体変更・変更後 snapshot から計画した `monthly_agg` 置換を同じバッチに載せ、いずれか片側だけが成立した状態を作らない。件数超過で分割実行する場合も、分割の途中終了が「消えたが戻せない」状態を残さないことを設計条件とする。
- Observability/audit: D8 に従い、操作種別・範囲・件数・日時・結果のヘッダと、
  属性別 before/after・採用根拠の判定明細を別層にする。判定明細は明細本体や金額を持たない。
  undo の行 payload は期限付きの非公開退避であり、監査ログではない。明細内容・金額をログおよびエラー応答へ含めない。
- Configuration/secrets: 追加なし。保持期間はコードで定数として持ち、秘密値を伴わない。
- Compatibility/versioning: 既存の月単位洗い替えと `POST /restore` の挙動を変えない。削除は `import_active_targets` の指紋巻き戻しと必ず対で行い、片方だけを実行する経路を作らない。

## Subtype architecture

- Backend: preflight / 実行 / undo / 再収束の責務分割と、writer claim 配下での排他をここで定義する。
- Data: 退避テーブルと監査記録テーブルの新設、および由来参照 (`import_id` 等) の不足を append-only migration で補う判断をここで定義する。
- Infrastructure: D1 Free の枠に対する分割実行と掃除経路をここで定義する。
- Frontend: 既存の仕分け明細・取込履歴から共通の preflight → 指紋付き実行 → undo 導線を呼ぶ。内部 ID 入力や新しい最上位画面は作らない。
- Security: 境界は「Cross-cutting contracts」に集約し、認証方式は変更しない。

## Architecture decisions

| ADR | Decision | Alternatives | Trade-off rationale | Consequences |
|---|---|---|---|---|
| DEL-001 | 削除の粒度を明細/取込単位/期間/全件の4つに固定し、いずれも preflight を必ず通す | 取込単位だけを提供 / 範囲を自由式で受ける | 粒度が有限なら対象解決の SQL とテスト対象も有限になり、「消えるはずでないものが消えた」を機械的に排除できる | 4粒度それぞれに対象解決と件数照会の実装と回帰が要る |
| DEL-002 | undo は D1 の退避テーブルで持つ (`spec-state.json` の決定 D1-undo-snapshot-store) | R2 スナップショット / D1 Time Travel に委ねる | 明細単位の部分巻き戻しが SQL で直接でき、削除本体と同じデータベース内で原子性が取れる。Time Travel は Free で 7 日かつデータベース単位の復元にとどまり undo の代替にならない | 退避行がストレージを消費するため保持期間が設計上の必須項目になる |
| DEL-003 | 操作ヘッダ(400日)と属性別の判定明細(90日)を分け、復元 payload は undo 退避に限定する (D8) | 判定明細を持たない / 明細本体を監査へ写す | 年を跨ぐ操作の事実と短期間の判断根拠は寿命が異なる。明細本体・金額は監査に複製しない | 判定明細は独立した容量監視・掃除が必要。復元経路は30日・300 MB上限の退避テーブルに一本化される |
| DEL-004 | 削除・undo は指紋巻き戻しと、変更後 snapshot から計画した `monthly_agg` 置換までを同じ D1 batch で確定する | 削除だけ先に反映し再収束を非同期にする | 重複判定は `import_active_targets` の現行指紋で行い、画面は `monthly_agg` を読むため、片方を遅延すると「消えたのに再取込できない」「明細と月次数値が違う」状態を作る | 変更前に派生状態まで計画し、D1 query budget 内へ収める必要がある |
| DEL-005 | 件数に依存する処理はすべて分割実行を前提に設計する | 1リクエストで全件処理する | Worker 1回の呼び出しあたりのクエリ本数は D1 Free で 50 本であり、既存の query budget 設計 (`D1_FREE_QUERY_LIMIT`) を壊さない | 分割の境界で中断した場合の再開点を持つ必要がある |
| DEL-006 | 現行データの「取り消す」と、非有効な取込履歴の「履歴を削除」を別操作にする。履歴削除は `failed` / `duplicate` に限定し、参照をサーバで再検証する | すべての履歴に共通の削除操作を出す | 見た目の整理が帳簿本体の削除へ化ける経路を閉じ、provenanceを証明できない状態ではfail-closedにできる | 履歴削除はundo不可。共有原本は最後の参照まで保持し、R2失敗はcleanup ledgerで再試行する |

## Delivery, migration and rollback

- ビルド/デプロイ配置: 既存の `deploy.yml` / `migrate.yml` に従い、スキーマ追加は `migrations/` へ連番 append-only で足し、expand としてコード配信より先に適用する (`arch-d1-schema-lifecycle` の適用系統に従う)。
- 移行順序: 由来参照の不足確認 → `0030_import_deletion_and_vendor_memory.sql` によるundo退避の追加 → `0033_audit_log.sql` による二層監査の追加 → `0034_import_discard_audit.sql` による履歴破棄監査の追加 → preflight → 削除実行と再収束 → undo → 層別の掃除ジョブ。次の migration は `0035`。
- D1 Free の枠に対する見積り: undo 退避は30日・300 MBのいずれか先で古い世代から掃除し、1日あたりの削除対象は5万行以内から運用を始める。操作監査は明細を持たず400日保持する。
- ロールバック契機/手順: preflight の提示件数と実行後の実件数が食い違う、または再収束後に `monthly_agg` が実データと一致しない場合。保持期間内は退避テーブルから戻し、期間外は R2 原本からの `POST /restore` へ退避する。

## Risks and verification

- リスク/前提: 大規模 undo の分割・再開と query budget の完了証拠が残る。退避行は30日または300 MB到達で前倒しに消える可能性がある。全件削除は影響が最大であり、単一のクリックで到達させない。
- アーキテクチャ適合テスト: 削除経路で発行されるクエリ本数が `D1_FREE_QUERY_LIMIT` 未満であること。削除実行が writer claim を取得せずに走る経路が存在しないこと。監査記録の列に明細本体を持つものが無いこと。
- 検証: 指定範囲外の行が1件も減らないこと、取り消し後の各テーブルの行数と内容が実行前と一致すること、削除後の `import_active_targets` / `monthly_agg` が実データからの再計算値と一致すること、保持期間を過ぎた退避行が残っていないこと。

## 出典

- Cloudflare D1 limits — https://developers.cloudflare.com/d1/platform/limits/ (確認 2026-08-30)
- Cloudflare D1 Time Travel — https://developers.cloudflare.com/d1/reference/time-travel/ (確認 2026-08-30)
