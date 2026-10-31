---
graph_node_id: "arch-subscriptions-merge-infrastructure"
artifact_kind: "architecture"
artifact_subtypes: ["infrastructure"]
title: "サブスク統合 — Workers + D1 の上限の内側で統合を完了させ、lease を短くする"
project_id: "kanjo"
domain: "infrastructure"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: []
tags: ["subscriptions", "infrastructure"]
file_path: "architecture/subscriptions-merge-infrastructure.md"
template_id: "architecture"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluator": "system-spec-harness:assign-system-spec-completeness-evaluator", "evidence_ref": "docs/evidence/subscriptions-merge/spec-evaluation-waiver.json", "evaluated_digest": "ac7dee30b17547a9d9573e1efef2e33c7d28c342ac3f323e5af78b4709cc1921"}
source_lineage: {"origin_kind": "system-spec-harness", "source_plugin": "system-spec-harness", "source_path": "system-spec/infrastructure.md", "source_version": "0.1.14", "source_digest": "8bc7c72bdc980f5ef7f00da0356e8fcc3bced2203e554f656eb2e02774bbc017", "imported_at": "2026-09-30T15:18:20Z"}
created_at: "2026-09-30T15:18:20Z"
updated_at: "2026-09-30T15:18:20Z"
depends_on: ["spec-subscriptions-merge"]
related_nodes: ["arch-subscriptions-merge-ui-ux", "arch-subscriptions-merge-frontend", "arch-subscriptions-merge-backend", "arch-subscriptions-merge-database", "arch-subscriptions-merge-auth", "arch-subscriptions-merge-security", "arch-subscriptions-merge-maintenance-ops"]
resource_scope: ["packages/api/wrangler.jsonc", "packages/api/src/import-lifecycle.ts", "packages/api/src/canonical-mutation-fence.ts", "packages/api/src/store.ts", ".github/scripts/plan-auto-migration.mjs", ".github/migration-approvals.json", "migrations"]
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
classification_reason: "system-spec の infrastructure 章 (web 確定・他 platform 対象外) を領域別の architecture 制約として参照する。"
classification_candidates: [{"artifact_kind": "architecture", "confidence": 1.0, "candidate_path": "architecture/subscriptions-merge-infrastructure.md"}]
tracker_binding: "none"
beads_linkage: null
github_publication: {"mode": "local_only", "project_aliases": [], "labels": [], "milestone": null}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"policy": "manual", "status": "not_applicable", "source": null, "completed_at": null, "reconciled_at": null, "evidence_refs": []}
implementation_readiness: {"status": "complete", "missing_sections": [], "checked_at": "2026-09-30T15:18:20Z"}
serves_goals: ["G2"]
---
# Architecture overview

サブスク統合の infrastructure の制約を持つ文書。既存の Worker kanjo-console・D1 kanjo-db・R2 kanjo-files・cron の構成と binding を変えずに、統合・取り消しを 1 要求 20 文未満の D1 問い合わせで完了させ、canonical mutation の lease を 2 分に縮め、操作の記録の掃除を書込みの batch に載せ、migration 0058 を追加型として既存の Deploy に載せる〔決定 qa-subsmerge-decision-005〕〔-003 由来: qa-subsmerge-infrastructure-web-003〕。

- 正本: 値・エラーコード・FR/BR/AC の番号は `specs/spec-subscriptions-merge.md` (以下 spec) に従い、本書と食い違えば spec を優先する。`system-spec/infrastructure.md` は承認時の入力である。
- 行番号: commit a63d35c の現物を 2026-09-30 に開いて確かめた値である。
- 前サイクルとの関係: `architecture/subscriptions-infrastructure.md` は、binding を変えず、初回の応答をベンダー数 × 月数に比例させ、明細を詳細の要求へ分けると定めた。本書はこれをそのまま引き継ぎ、書込み側の 4 点 (問い合わせの予算・lease の TTL・掃除の置き場所・0058 の配信) だけを足す。前サイクルの文書は cron を `0 18 * * *` と書いているが、現物は `0 17 * * *` (`packages/api/wrangler.jsonc:31`) である〔現物 2026-09-30〕。

## Context and drivers

以下の既存実装の観測は開発着手前 (2026-09-30) の記録。現在の構造・契約は各設計節と spec を参照する。

- Business/technical context:
  - 実行基盤〔観測 qa-subsmerge-infrastructure-web-evidence-001〕〔現物 2026-09-30〕: `packages/api/wrangler.jsonc` は Worker kanjo-console (:3)・compatibility_date 2026-08-24 (:5)・nodejs_compat (:6)・assets の run_worker_first `/api/*` (:13)・D1 kanjo-db (:15-22)・R2 kanjo-files (:23-28)・cron `0 17 * * *` (:31)・observability (:33-36、head_sampling_rate 1)・secret SESSION_SECRET (:40) を持つ。Durable Objects と Queues の binding は無い。
  - 問い合わせの上限〔現物 2026-09-30〕: `packages/api/src/import-lifecycle.ts:304` の D1_FREE_QUERY_LIMIT は 50 (Workers Free の 1 invocation の上限)。:323 の sumPlan は合計が 50 未満のときだけ受理する。
  - 書込みの lease〔現物 2026-09-30〕:
    - `canonical-mutation-fence.ts:46` の CANONICAL_MUTATION_ROUTES (サブスクの書込みは :219-249) に載った要求を、:282 の acquireImportWriter で import_writer_claims のテナント単位の lease に直列化する。取れなければ :284-291 の 409 canonical_write_busy を返す。
    - :296-303 の finally で解放する。解放に失敗したときは :301 のログ canonical_lease_release_failed だけを残し、TTL の期限切れで回復させる。
    - acquireImportWriter (import-lifecycle.ts:424) は TTL の引数を持たず、:446 で IMPORT_CLAIM_TTL_MS (:300、15 分) を使う。そのため取込と canonical mutation が同じ 15 分を使っている。
  - 夜間保守〔現物 2026-09-30〕:
    - `scheduled-maintenance-budget.ts:21` の SCHEDULED_D1_QUERY_PLAN_MAX 49 を、:23-32 の 8 job が使い切っている。:17 は「新規 job は既存枠を再配分しない限り追加できない」とする。
    - `routes/imports.ts:2905-2917` は、期限切れの行を夜間ではなく要求のついでに消す前例である (purgeExpiredImportRows)。
- Quality attribute priorities: 優先順は次のとおりで、G2 に資する。
  1. 信頼性: 上限に当たって 500 で止まる経路を残さない (Google SRE の reliability)。
  2. 配信の安全: 変更を小さく保ち、戻せるようにする (Google SRE の operations)。
  3. 費用: 有料機能を足さない。
  4. 遅延
- Constraints:
  - 既存の Workers + D1 + R2 の範囲で作る。次のものは足さない〔決定 qa-subsmerge-decision-003・qa-subsmerge-decision-004・qa-subsmerge-decision-005・qa-subsmerge-retention-001〕。
    - Durable Objects・Queues・有料機能
    - 新しい binding
    - 新しい夜間 job
  - D1 の制約 (出典 cloudflare-d1-limits・cloudflare-d1-batch):
    - 1 文の bound parameter は 100 まで。
    - batch は 1 つのトランザクションとして実行される。
    - 1 つの DB は問い合わせを 1 本ずつ処理し、溢れると overloaded を返す。
  - 対象の platform は Web だけで、Web 以外の専用アプリは spec のスコープの Out にある〔現物 2026-09-30〕。

## Goals and non-goals

- Goals:
  - G2: 統合・取り消しの 1 要求で使う D1 の問い合わせを、lease の取得と解放も含めて 20 文未満にし、上限 50 に届かせない〔-003 由来: qa-subsmerge-infrastructure-web-003〕。
  - G2: 解放されなかった canonical mutation の lease が後続の書込みを止める時間を、15 分から 2 分 (CANONICAL_MUTATION_CLAIM_TTL_MS) へ縮める〔-003 由来: qa-subsmerge-infrastructure-web-003〕。
  - G2: D1 の overloaded を 500 にせず、503 d1_overloaded (retryable、未適用) で返す〔-003 由来: qa-subsmerge-infrastructure-web-003〕。
  - G2: 操作の記録の掃除 (30 日で NULL 化、400 日で削除) を、夜間の予算 49/49 を動かさずに行う〔決定 qa-subsmerge-retention-001〕。
  - G2: 0058 を追加型にし、main への merge だけで既存の Deploy が Migrate → Deploy の順に本番の D1 へ適用する〔-003 由来: qa-subsmerge-infrastructure-web-003〕。
- Non-goals:
  - binding・cron・R2・Workers Assets・compatibility_date の変更。Durable Objects・Queues・有料機能の追加〔決定 qa-subsmerge-decision-005〕。
  - 警報・SLO・監視基盤の新設 (spec の「可観測性」は個人利用のため N/A とする)。
  - 取込の lease (15 分) と、夜間保守の 8 job の配分の変更。

## System context and boundaries

- Users/external systems:
  - 利用者のブラウザは Workers Assets (画面) と Worker (/api/*) に接続する。Worker が読み書きするのは D1 kanjo-db だけで、外部の API は呼ばない。
  - R2 と cron は本件では使わない。既存の nightly_backup は、これまでどおり D1 を R2 へ写す。
  - 運用者は Cloudflare の observability と GitHub Actions の結果を見る。
- Trust/deployment/data boundaries:
  - 信頼境界は既存のまま。/api/* は run_worker_first (wrangler.jsonc:13) で必ず Worker の認証を通る。
  - デプロイの単位は Worker 1 本と D1 1 つで、増えない。
  - 新しい 2 表と列は既存の kanjo-db に置き、業務データはテナント (user_id) で分ける。
- Context diagram: ブラウザ → Worker kanjo-console (/api/*) → D1 kanjo-db。GitHub の main → CI → Deploy (migration の判定と適用 → Worker の配信) → 本番。操作のログ → Workers observability。

## Container and component view

| Container/Component | Responsibility | Interface | Data owner | Deployment unit |
|---|---|---|---|---|
| Worker kanjo-console (Hono) | 統合・取り消し・操作履歴と既存のサブスクの書込み。subs 範囲の行を組み立てて batch に渡す | HTTP /api/* | packages/api | Worker 1 本 (既存) |
| canonicalMutationFence + acquireImportWriter | テナントごとに書込みを 1 本へ直列化する lease。canonical mutation は 2 分、取込は 15 分 | Hono middleware、import_writer_claims | packages/api | Worker |
| D1 kanjo-db | sub_vendors (merged_into_id)・subscription_operations・subscription_revisions・monthly_agg の subs 範囲・import_writer_claims | SQL (prepare と batch) | packages/api と migrations | D1 1 つ (既存) |
| Workers observability | 操作 id・kind・結果・所要 ms・actor の id の構造化ログを検索する | Cloudflare dashboard | Cloudflare | 既存の設定 (wrangler.jsonc:33-36) |
| Deploy workflow | 追加型の migration を判定して適用し、Worker を配信する | GitHub Actions (`.github/workflows/deploy.yml`) | リポジトリ | CI (既存) |
| 夜間保守 (cron) | 既存の 8 job。本件では変えない | scheduled handler | packages/api | Worker (既存) |

## Cross-cutting contracts

規範は [spec-subscriptions-merge](../specs/spec-subscriptions-merge.md) に従う。

- 認証・所有者・操作者: spec「認証・認可」。
- 入力・応答・エラー・冪等性・revision: spec「API契約」「ビジネスルールと検証」。
- 操作状態・再試行・表示文言: spec「UI・状態遷移」「エラー・例外・回復」。
- 列・制約・保持・復元: spec「データモデル」「確定した実装契約」。
- 検証: spec「テストと受入条件」。実行結果は [docs の検証索引](../docs/subscriptions-screen.md#verification-records)。

本領域の追加参照: FR-011・FR-015・FR-016 (revisionと再試行)。具体値と期待値は spec を参照する。

本書は構造と採用理由を持ち、契約表を複製しない。現行の追加契約と推定月額の再計算規則は spec の「推定月額の契約確定」を参照する。

## Subtype architecture

- Frontend: N/A: 画面の待ち行列と自動再送は `architecture/subscriptions-merge-frontend.md` が持ち、基盤の変更は無い
- Backend: N/A: API の契約と batch の各文の中身は `architecture/subscriptions-merge-backend.md` が持つ。本書が持つのは文の数と lease だけ
- Infrastructure: 下記の「Infrastructure architecture」を参照
- Data: N/A: 表・列・保持の文の形は `architecture/subscriptions-merge-database.md` が持つ。本書が持つのは 0058 の配信だけ
- Security: N/A: ログの項目の制限は `architecture/subscriptions-merge-security.md` が持つ

### Infrastructure architecture

#### Environments and topology

- Local/test/staging/production parity:
  - 環境は次の 3 つで、staging は既存と同じく置かない。
    - ローカル: wrangler dev (D1 はローカルの SQLite) と vite で動かし、`scripts/seed-local.mjs` が作る匿名サンプルを取り込む。
    - テスト: Miniflare のインメモリ D1 に migrations を全件適用して動かす (前例は `packages/api/src/subs-screen.integration.test.ts`)。
    - 本番: Workers と D1 kanjo-db。
  - 3 つの環境とも、同じ migrations と同じ wrangler.jsonc を使う。
  - D1 の overloaded は Miniflare では起きないので、例外を投げる D1 をテストに注入して確かめる〔本書で置いた値〕。
- Regions/zones/network/trust boundaries:
  - Cloudflare の既存の配置のまま変えない。
  - D1 は 1 つの DB を 1 本ずつ処理する。そのため、テナントの書込みは lease で 1 本にそろえ、1 要求の問い合わせの数を抑える。
  - Worker → D1 以外の通信は無い。
- DNS/TLS/edge/ingress/egress:
  - 変えない。/api/* は run_worker_first で Worker を通り、それ以外は Workers Assets が返す。
  - 新しいホスト名・ルート・外向きの通信を足さない。

#### Compute and storage

- Runtime/compute/scaling:
  - Worker 1 本のまま。統合と取り消しは 1 要求の中で完結させ、キューや後段の処理に分けない〔決定 qa-subsmerge-decision-005〕。
  - 数え方は import-lifecycle.ts:308 の ImportQueryPlan と同じにする。prepare の実行は 1 文、batch は中の文の数で数える。
  - 1 要求の問い合わせの予算は次のとおり〔spec の非機能 Performance、配分は本書で置いた値〕。

    | 区分 | 文の数 | 根拠 |
    |---|---|---|
    | lease の取得 | 最悪 4 | IMPORT_CLAIM_WORST_CASE_QUERY_COUNT (import-lifecycle.ts:306) |
    | lease の解放 | 1 | fence の finally |
    | `db.batch` | 8 と、見直し判断の付け替えの 1 | spec FR-013・FR-006 |
    | 読み取り | 5 以内 | 20 未満から上の 14 を引いた残り |

  - 読み取りの 5 文には、次のものをすべて収める。1 文で複数の値を返す形 (副問い合わせ) にまとめる。
    - テナントの検査 (targetId と sourceVendorIds を 1 回で)
    - 冪等キーの照会
    - 現在の revision
    - subs 範囲の入力 (freee 仕訳のサブスク対象分と事業分の現金明細)
    - 見直し判断
  - どうまとめるかは backend 文書と実装が決め、統合テストで実測して 20 未満を確かめる。
- Database/object/cache/queue:
  - 使うのは D1 kanjo-db だけで、R2・KV・Cache API・Queues・Durable Objects は使わない。
  - monthly_agg の subs 範囲は、(d) の削除と (e) の `json_each(?)` の 1 文による再挿入で置き換える。前例は `store.ts:1937` の aggregateReplacementQueries (:1943-1950) で、行数に関係なく bound parameter の上限 100 を避けられる (出典 cloudflare-d1-limits)。
  - 統合元の更新も `json_each(?)` か `WHERE id IN (...)` の 1 文で行い、統合元 50 件でも文の数を増やさない。IN の束縛は最大 51 個で、100 未満に収まる〔本書で置いた値〕。
  - (f) は `import-active.ts:7` の INVALIDATE_JSON_ACTIVE_SQL で、JSON snapshot を無効にする。
- Capacity and cost budgets:
  - 問い合わせ: 1 要求 20 文未満 (上限 50)。
  - lease: 2 分。
  - 夜間の予算: 49/49 のままで、1 文も足さない。
  - 掃除: 書込み 1 回あたり、NULL 化 50 件と削除 50 件まで〔決定 qa-subsmerge-retention-001〕。
  - rows written: 統合と取り消しは、subs 範囲の行 (月数 × (登録ベンダー数 + 1) 程度) を削除と再挿入で 2 回書く。D1 Free の 1 日 100,000 行 (出典 cloudflare-d1-pricing) に対して、個人利用の操作回数なら余裕がある見込みである。統合テストで batch の結果の meta から書込み行数を記録する〔本書で置いた値〕。
  - 保存: 操作の行は 1 操作 1 行 (取り消しはもう 1 行)。payload_json と before_json は vendor の name・aliases・accounts・merged_into_id・見直し判断だけを持ち、30 日で NULL になり、400 日で行が消える。
  - 費用: Durable Objects の課金 (出典 cloudflare-do-pricing) が生じる構成は選ばない〔決定 qa-subsmerge-decision-005〕。

#### IaC and delivery

- IaC tool/state/locking:
  - 構成の正本は `packages/api/wrangler.jsonc` と `migrations/` で、どちらもリポジトリで管理する。wrangler.jsonc は変えない。
  - D1 の適用状態は d1_migrations 表が持つ。
  - Deploy と Migrate は、`.github/workflows/deploy.yml:27-29` の concurrency group production-mutation で直列化される (cancel-in-progress は false)。
- CI/CD stages, approvals, provenance:
  - PR: `.github/workflows/ci.yml` の次のジョブを緑にしてから merge する。main の必須チェックは verify の 1 本だけである。
    - テスト (core・web) (:58)
    - テスト (api) (:72)
    - ビルドできることを確認 (:84)
    - verify (:95、上のジョブの結果を束ねる)
  - main への push で CI が緑になると、Deploy (workflow_run) が次の順に進む。Migrate → Deploy の順は、この job の中で固定されている。
    1. Web のビルド (:71-72)
    2. 自動適用してよいかの判定 (:73-75、`.github/scripts/plan-auto-migration.mjs`)
    3. Time Travel の復元地点の記録 (:76-78)
    4. D1 migration の適用 (:79-81)
    5. 未適用の検査 (:82-83)
    6. Worker のデプロイ (:84-85)
    7. smoke を 2 回 (:86-89)
  - 0058 は、plan-auto-migration.mjs:49 の DESTRUCTIVE_PATTERNS に当たらないので、`.github/migration-approvals.json` の承認は要らない〔-003 由来: qa-subsmerge-infrastructure-web-003〕。
    - DESTRUCTIVE_PATTERNS の中身: DROP TABLE・DROP COLUMN・DELETE FROM・TRUNCATE・UPDATE … SET・ALTER TABLE … RENAME。
    - 判定はコメントと文字列を除いてから行う (:30-35)。
    - backfill などの UPDATE・DELETE の文を 0058 に入れると、承認が要る migration に変わる。だから入れない〔本書で置いた値〕。
- Immutable artifacts/config promotion:
  - Deploy は workflow_run の head_sha (deploy.yml:46) を checkout し、その commit を build して配信する。
  - 環境ごとの設定の昇格は無い。本番の値は、Cloudflare の secret store と GitHub の environment production (:38) にだけ置く。

#### Secrets and access

- Secret authority/rotation/injection:
  - 新しい secret は足さない。
  - SESSION_SECRET の正本は Cloudflare の secret store で、wrangler.jsonc:37-40 は必須の名前だけを検査する。
  - ローカルでは `packages/api/.dev.vars` に置き、git の操作に含めない。テストでは合成の値を使う。
  - Deploy は GitHub の secrets の CLOUDFLARE_API_TOKEN・CLOUDFLARE_ACCOUNT_ID (deploy.yml:40-41) を使う。rotation の手順は変えない。
- Human/service access and least privilege:
  - 本番の D1 を書くのは、Worker の binding DB と Deploy の migration の段だけである。人が本番の D1 を直接書く運用は足さない。
  - observability を見られるのは、Cloudflare のアカウントを持つ運用者だけである。
  - 新しい API はログインした利用者全員が使え、role では分けない〔決定 qa-subsmerge-undo-scope-001〕。

#### Reliability and recovery

- SLO/alerts/on-call: N/A: 個人利用のため、SLO・警報・当番は置かない。代わりに次の 2 つで守る。
  - 5 件連続・2 件同時の送信で 500 が 0 件であることを、テストで固定する (O2)。
  - 止まった操作は 3 段で辿る〔-003 由来: qa-subsmerge-maintenance-ops-web-003〕。手順は `architecture/subscriptions-merge-maintenance-ops.md` が持つ。
    1. 画面の操作状態
    2. `GET /api/subscription-operations?limit=20`
    3. observability を操作 id で検索
- Backup/restore/RPO/RTO/DR:
  - 既存の 2 つをそのまま使う。
    - nightly_backup (D1 → R2、30 日保持、wrangler.jsonc:30-31)
    - Deploy の Time Travel の復元地点 (deploy.yml:76-78)
  - 新しい 2 表は、`import-active.ts:10` の JSON_SNAPSHOT_MUTATION_CONSUMERS に足す。
  - merged_into_id は sub_vendors の snapshot に含める。
  - 操作の記録と revision は、復元では書き戻さない。復元自体が revision を +1 する (spec のデータモデル)。
  - RPO・RTO は既存のままで、新しい目標は置かない。
- Failure domains/failover:
  - lease:
    - acquireImportWriter に TTL の引数を足す。既定値は IMPORT_CLAIM_TTL_MS で、2 分 (CANONICAL_MUTATION_CLAIM_TTL_MS) を渡すのは fence だけにする。取込の lease は 15 分のまま〔-003 由来: qa-subsmerge-infrastructure-web-003〕。
    - Worker の強制終了などで解放されなかった lease は、2 分で期限が切れ、次の書込みが取り直す。
    - 取込が lease を持っている間は、サブスクの書込みが 409 canonical_write_busy になる。画面が 3 回自動で送り直し (合計 7 秒)、それでも取れなければ失敗 (再試行ボタン) になる。
  - D1 の overloaded: 例外の message で判定し、未適用の 503 d1_overloaded に言い換える。画面は同じ Idempotency-Key で送り直す。
  - batch:
    - (a) から (h) の 8 文は 1 つのトランザクションで実行される。
    - (a) の条件付き挿入が 0 行なら、後の文も書かれず、409 subscription_revision_conflict になる。
    - 掃除の (g)(h) は書込みの batch の中にあるので、掃除の文が落ちると書込みも戻る。この点が前例と違う。前例の purgeExpiredImportRows (imports.ts:2911-2919) は、別の try の中で失敗をログにするだけで、要求は落とさない。
    - そのため (g)(h) は `WHERE id IN (SELECT id … LIMIT 50)` の単純な形に限り、31 日前・401 日前の行を含む統合テストで通す〔本書で置いた値〕。
  - 5xx と通信の失敗は、適用されたか分からない。そのため自動では送らず、同じ Idempotency-Key での再送で二重の適用を防ぐ。

#### Infrastructure verification

- Plan/policy/security/drift/smoke/restore tests:
  - Plan/policy:
    - 0058 に対して destructiveFindings (plan-auto-migration.mjs:62) が空を返すこと。
    - `packages/api/src/index.test.ts:6` と `packages/api/src/deletion-schema.test.ts:18` が、EXPECTED_D1_MIGRATION が 0058 の状態で緑になること。
  - Drift:
    - wrangler.jsonc に差分が無いこと。
    - CANONICAL_MUTATION_ROUTES に `POST /api/sub-vendors/merge` と `POST /api/subscription-operations/:id/undo` が載り、classifyCanonicalMutation (canonical-mutation-fence.ts:264) が canonical-mutation を返すこと。
    - SCHEDULED_MAINTENANCE_JOB_NAMES が 8 件のままであること。
  - Capacity: 統合と取り消しの 1 要求の問い合わせ数を、`import-lifecycle.test.ts:89` の countingDatabase と同じ数え方で数え、統合元 50 件・取引名 50 件の入力でも 20 未満であること。
  - Failure:
    - 2 分の lease が、期限の前は 409 canonical_write_busy になり、期限の後は別の書込みで取れること (nowMs を注入して確かめる)。
    - 取込の lease が 15 分のままであること。
    - overloaded を投げる D1 で 503 d1_overloaded が返り、何も書かれないこと。
  - Smoke: Deploy の smoke (deploy.yml:86-89) の後、`GET /api/subscriptions` が 503 schema_unavailable でなく、revision を含む応答を返すこと。
  - Restore: backup → restore の後に merged_into_id が戻り、revision が進むこと (前例は `packages/api/test/settings-backups.integration.test.ts`)〔本書で置いた値〕。

## Architecture decisions

| ADR | Decision | Alternatives | Trade-on rationale | Consequences |
|---|---|---|---|---|
| ADR-INF-01 | 既存の Workers + D1 だけで直列化する (画面の scope・テナントの lease・revision の一意制約) | Durable Objects でテナントの書込みを 1 本にする。Queues で順に流す | 新しい binding と有料機能を足さない〔決定 qa-subsmerge-decision-003・qa-subsmerge-decision-004・qa-subsmerge-decision-005〕 | 同時の 2 件目は 409 になり、画面が送り直す |
| ADR-INF-02 | canonical mutation の lease を 2 分にし、取込の 15 分と分ける | 取込と同じ 15 分のまま | 解放されなかった lease が後続を止める時間を縮める〔-003 由来: qa-subsmerge-infrastructure-web-003〕 | acquireImportWriter の引数が 1 つ増える。2 分を超えた書込みは lease を失い、revision の一意制約が最後の防壁になる |
| ADR-INF-03 | 1 要求の問い合わせを 20 文未満に数えて収め、monthly_agg の再挿入は json_each の 1 文にする | 上限 50 まで使う。行ごとに INSERT する | 上限に当たって 500 で止まる経路を残さず、入力の件数で文の数を変えない〔-003 由来: qa-subsmerge-infrastructure-web-003〕 | 読み取りを 5 文以内にまとめる必要があり、問い合わせ数を実測するテストが要る |
| ADR-INF-04 | 操作の記録の掃除を、書込みの batch の (g)(h) で 50 件ずつ行う | 夜間 job を足す。既存の job の枠を削る | 夜間の予算 49/49 を動かさない〔決定 qa-subsmerge-retention-001〕 | 書込みが無い期間は期限切れの行が残る。掃除の文が落ちると書込みも戻る |
| ADR-INF-05 | D1 の overloaded を 503 d1_overloaded (retryable) で返す | 既存の onError の 500 のまま | 未適用と分かる失敗を、利用者に「失敗」として見せない〔-003 由来: qa-subsmerge-infrastructure-web-003〕 | message での判定をテストで固定する |
| ADR-INF-06 | 0058 を追加型にし、既存の Deploy で自動適用する | 破壊的な変更を含め、PR で承認する | 承認の手順を増やさず、merge だけで本番に届く〔-003 由来: qa-subsmerge-infrastructure-web-003〕 | 0058 に UPDATE・DELETE・DROP・RENAME を書かない。差し戻しても列と表は残る |

## Delivery, migration and rollback

- Build/deploy topology: 既存のまま。PR の CI が緑 → main へ merge → CI (push) → Deploy (workflow_run) の順に進み、Deploy の中で Web のビルド → migration の判定と適用 → Worker のデプロイ → smoke を行う。
- Migration sequence:
  1. 着手時に origin/main を取り直し、0058 が空いていることを確かめる。現物の最新は `migrations/0057_improvement_request_screen.sql` で、schema-guard.ts:4 も 0057 を指す〔現物 2026-09-30〕。埋まっていれば次の番号へ直し、schema-guard.ts・テスト・spec を同じ変更で直す。
  2. `migrations/0058_subscription_merge_operations.sql` を、ALTER TABLE ADD COLUMN・CREATE TABLE・CREATE INDEX だけで書く。backfill はしない。既存の行の merged_into_id は NULL で、revision の行が無ければ 0 とみなす。
  3. schema-guard.ts:4 を 0058 へ進める。
  4. Deploy が Migrate → Deploy の順に適用する。Deploy が先だと、新しい列と表を読む API に runtimeSchemaGuard が 503 schema_unavailable (schema-guard.ts:80) を返す。だから Worker だけを手で先に出さない。
- Rollback trigger/procedure:
  - trigger: 次のどれかが起きたとき。
    - Deploy の smoke が失敗する。
    - 5xx が増える。
    - 409 canonical_write_busy が 2 分を超えて続く。
  - procedure:
    - 実装の commit を revert し、同じ Deploy で出す。
    - 0058 の列と表は残し、migration も戻さない。DROP は承認が要る破壊的な変更になるためである。schema-guard.ts:30-34 は、適用済みの版が期待値より新しければ通すので、旧い実装は 0058 が適用された D1 でも 503 にならない〔現物 2026-09-30〕。
    - 統合済みの行 (merged_into_id が NULL でない行) は、旧い実装では独立した行として再び現れる。差し戻す前に統合を取り消すか、再び現れることを許容するかを決める (spec の「互換性・移行・リリース」)。

## Risks and verification

- Risk/assumption: 問い合わせ数は予算であって、まだ実測していない。読み取りを月やベンダーごとに分けると 20 を超える。統合テストで実測し、超えるなら読み取りをまとめる (spec の「実装時に確かめる事項」)。
- Risk/assumption: lease を 2 分にすると、2 分を超える書込みは lease を失い、別の書込みと重なりうる。統合は 1 要求の batch で終わるので 2 分には届かない見込みで、revision の `UNIQUE (user_id, base_revision)` が最後の防壁になる。fence は他の canonical mutation (設定・名義など) にも掛かるので、2 分はそれらにも効く。
- Risk/assumption: (d)(e) の subs 範囲の組み立ては Worker の CPU を使う。規模は既存の `GET /api/subscriptions` と同じ入力の照合で、新しい上限は増やさない。所要 ms をログに出して見張る。
- Risk/assumption: observability のログは保持期間が短い。古い操作は、3 段目ではなく 2 段目の操作履歴までで辿る〔本書で置いた値〕。
- Architecture fitness test:
  - 新しい route に、月ごと・ベンダーごとのループ問い合わせが無いこと。
  - wrangler.jsonc と SCHEDULED_MAINTENANCE_JOB_NAMES が変わっていないこと。
  - 0058 の destructiveFindings が空であること。
- Load/failure/security validation:
  - 統合を 5 件連続・2 件同時に送り、500 が 0 件で、取り合いが 409 canonical_write_busy か 409 subscription_revision_conflict になること (spec AC-004・AC-005)。
  - 問い合わせ数が 20 未満であること (spec「テストと受入条件」の performance)。
  - 31 日前と 401 日前の行が、書込み 1 回でそれぞれ 50 件まで掃除されること (AC-019)。
  - `pnpm verify:full` と CI が緑であること (AC-023)。
