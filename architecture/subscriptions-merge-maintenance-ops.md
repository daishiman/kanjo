---
graph_node_id: "arch-subscriptions-merge-maintenance-ops"
artifact_kind: "architecture"
artifact_subtypes: ["infrastructure"]
title: "サブスク統合 — 統合・並行操作・取り消しを core・api・web のテストで固定する"
project_id: "kanjo"
domain: "maintenance-ops"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: []
tags: ["subscriptions", "maintenance-ops"]
file_path: "architecture/subscriptions-merge-maintenance-ops.md"
template_id: "architecture"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluator": "system-spec-harness:assign-system-spec-completeness-evaluator", "evidence_ref": "docs/evidence/subscriptions-merge/spec-evaluation-waiver.json", "evaluated_digest": "5cdf2eac7056d85a8e79f7bf4a79fd06b9b642489c8ad8fcd7361df3d15a8d75"}
source_lineage: {"origin_kind": "system-spec-harness", "source_plugin": "system-spec-harness", "source_path": "system-spec/maintenance-ops.md", "source_version": "0.1.14", "source_digest": "85038de93396791d5832c9a757f7103bfed977078321c558b9b5cfc63274e5f6", "imported_at": "2026-09-30T15:18:20Z"}
created_at: "2026-09-30T15:18:20Z"
updated_at: "2026-09-30T15:18:20Z"
depends_on: ["spec-subscriptions-merge"]
related_nodes: ["arch-subscriptions-merge-ui-ux", "arch-subscriptions-merge-frontend", "arch-subscriptions-merge-backend", "arch-subscriptions-merge-database", "arch-subscriptions-merge-auth", "arch-subscriptions-merge-security", "arch-subscriptions-merge-infrastructure"]
resource_scope: ["packages/core/test", "packages/api/src", "packages/api/src/subs-screen.integration.test.ts", "packages/web/src/subscriptions-screen.dom.test.tsx", "samples", "scripts/seed-local.mjs", "docs/subscriptions-screen.md", "docs/data-schema.md"]
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
classification_reason: "system-spec の maintenance-ops 章 (web 確定・他 platform 対象外) を領域別の architecture 制約として参照する。"
classification_candidates: [{"artifact_kind": "architecture", "confidence": 1.0, "candidate_path": "architecture/subscriptions-merge-maintenance-ops.md"}]
tracker_binding: "none"
beads_linkage: null
github_publication: {"mode": "local_only", "project_aliases": [], "labels": [], "milestone": null}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"policy": "manual", "status": "not_applicable", "source": null, "completed_at": null, "reconciled_at": null, "evidence_refs": []}
implementation_readiness: {"status": "complete", "missing_sections": [], "checked_at": "2026-09-30T15:18:20Z"}
serves_goals: ["G1", "G2", "G3", "G4"]
---
# Architecture overview

サブスク統合の保守運用の制約を持つ文書。本書が定めるのは次の 4 つである〔-003 由来: qa-subsmerge-maintenance-ops-web-003〕〔決定 qa-subsmerge-retention-001〕。

- 統合・並行操作・取り消し・保持を、core・api・web のどのテストで固定するか
- テストのデータ (fixture と samples) をどう作るか
- 止まった操作を辿る 3 段の手順・保持期間・注意を、どの docs に書くか
- `pnpm verify:full` と CI をどう緑にするか

- 正本: 値・エラーコード・FR/BR/AC の番号は `specs/spec-subscriptions-merge.md` (以下 spec) に従い、本書と食い違えば spec を優先する。`system-spec/maintenance-ops.md` は承認時の入力である。
- 行番号: commit a63d35c の現物を 2026-09-30 に開いて確かめた値である。
- 前サイクルとの関係: `architecture/subscriptions-maintenance-ops.md` は、次の 3 つを定めた。本書はこれを引き継ぎ、「監視・当番を新設しない」方針も変えない。
  - 金額の正本を検算済みの fixture に置く。
  - 規則と閾値を `docs/subscriptions-screen.md` に書く。
  - 旧テストを対応表で移す。
- 本書が新しく足すのは次の 3 つである。
  - 回帰テスト: aquavoice 型の不具合 (登録済みの行を別の登録済みの行へ統合しても何も変わらない) と、連続・同時の送信。
  - 保持の掃除の検査。
  - 運用の手順を docs に書くこと。

## Context and drivers

以下の既存実装の観測は開発着手前 (2026-09-30) の記録。現在の構造・契約は各設計節と spec を参照する。

- Business/technical context〔観測 qa-subsmerge-maintenance-ops-web-evidence-001〕〔現物 2026-09-30〕:
  - 既存のテストは次にある。
    - core の契約: `packages/core/test/subs-contract.test.ts`・`subs-screen-contract.test.ts`・`subs-review-contract.test.ts`。fixture は `subs-screen-fixture.ts`。
    - api: `packages/api/src/subs-screen.integration.test.ts`・`subs-vendor-scope.test.ts`
    - web の DOM: `packages/web/src/subscriptions-screen.dom.test.tsx`
  - 次を検査するテストは無い。
    - 登録済みの行どうしの統合
    - 連続と同時の送信
    - 統合の取り消し
    - 他画面の集計との名寄せの一致
  - 旧実装で aquavoice 型が何も変えない理由は、次のとおりである。
    - 画面は、開いている行が登録済みなら、その行自身を統合先にする (`packages/web/src/pages/Subscriptions.tsx:233`)。
    - API は、別名が変わらなければ書かずに返す (`packages/api/src/routes/subs.ts:220`)。
  - 前例:
    - 操作の記録と取り消し: `packages/api/test/total-cashflow-operations.integration.test.ts`。:128 の `describe('受入AC-004 直前の操作を元に戻す (BR-008)')` は、AC の番号を describe に置き、it の名前を利用者の言葉で書く。
    - 他テナントの検査: `packages/api/src/improvement-screen.integration.test.ts:4-5` は、行の user_id を別の値へ付け替えて作る。
    - 問い合わせ数の数え方: `packages/api/src/import-lifecycle.test.ts:89` の countingDatabase。export されていない。
    - 保持の定数: `packages/api/src/deletion-lifecycle.ts:42` の `DELETION_UNDO_RETENTION_DAYS = 30`。
  - api のテストは直列で走る: `packages/api/vitest.config.ts:8-9` が fileParallelism false・maxWorkers 1 にしている。
  - 完了の条件は、次の 2 つが緑であること (spec AC-023)。
    - `package.json:40` の `pnpm verify:full`
    - `.github/workflows/ci.yml` の「テスト (core・web)」(:58)・「テスト (api)」(:72)・「ビルドできることを確認」(:84) と、それを束ねる verify (:95)
- Quality attribute priorities: G1・G2・G3・G4 に資する。優先順は次のとおり。
  1. 回帰の検出: テストは 1 つの理由で落ち、旧実装で落ちる。
  2. 再現性: 同じ入力で同じ結果になり、時刻や並びの偶然に頼らない。
  3. 運用の追跡: 止まった操作を利用者の報告から辿れる。
  4. テストの所要時間
- Constraints:
  - 既存のテスト基盤 (Vitest・Miniflare のインメモリ D1・DOM テスト・check 系のスクリプト) だけを使う。
  - 本リポジトリは public である。テストとサンプルは、架空の名前と匿名化済みのデータだけで作り、実データ (`data/`) をコミットしない〔現物 2026-09-30〕。
  - `samples/*.csv` は `scripts/seed-local.mjs` の生成物である (:16 の outDir)〔現物 2026-09-30〕。
  - 期待値は `expect` の値の比較で固定する (出典 vitest-expect、5.0.3)。

## Goals and non-goals

- Goals:
  - G1: aquavoice 型を固定する。統合元の行が 0 件になり、統合先の推定月額の再計算と各月の実支払額の保存を確かめる。同じ取引を同じベンダーへ割り当てることを core で確かめる (spec AC-001〜003)。
  - G2: 次を固定する (AC-004〜AC-006・AC-014・AC-015・AC-021)。
    - 5 件連続・2 件同時の送信で 500 が 0 件である。
    - 取り合いは 409 canonical_write_busy か 409 subscription_revision_conflict になり、最終の集計が最後に完了した操作と一致する。
    - 同じ Idempotency-Key の再送は 1 回だけ適用される。
  - G3: 画面の選択・操作状態・元に戻すを DOM テストで固定する (AC-007〜AC-011・AC-016・AC-022)。止まった操作を 3 段で辿る手順を docs に書く〔-003 由来: qa-subsmerge-maintenance-ops-web-003〕。
  - G4: 次を固定する (AC-012・AC-013・AC-017〜AC-020)。
    - 他テナントの id は 404 になる。
    - 別の利用者の取り消しで、統合前に戻る。
    - 後続がある取り消しは 409 undo_blocked_by_later_operation になる。
    - 30 日を過ぎた取り消しは 410 undo_expired になる。
    - 掃除は 1 回 50 件までである。
    - 応答とログに、秘匿すべき項目が出ない。
- Non-goals:
  - 新しい監視・警報・当番・SLO (spec の「可観測性」は N/A)。
  - e2e のブラウザテストの新設 (spec の「テストと受入条件」で N/A)。
  - 夜間保守の job とそのテストの追加〔決定 qa-subsmerge-retention-001〕。

## System context and boundaries

- Users/external systems:
  - 開発と保守の担い手は、利用者と同じ人である。
  - テスト基盤は Vitest と Miniflare、CI は GitHub Actions、ログは Cloudflare の Workers observability を使う。
  - 利用者は、止まった操作を運用者へ知らせる。
- Trust/deployment/data boundaries:
  - テストのデータは、fixture の架空のサービス名と匿名化済みの `samples/` だけで作る。
  - 本番のログと D1 は、テストから触らない。
  - `packages/api/.dev.vars` は git の操作に含めない。
- Context diagram:
  - 開発: 変更 → core・api・web のテスト → `pnpm verify:full` → PR の CI → main → Deploy の順に進む。
  - 運用: 利用者の報告 → 画面の操作状態 → `GET /api/subscription-operations?limit=20` → observability を操作 id で検索、の順に辿る。

## Container and component view

| Container/Component | Responsibility | Interface | Data owner | Deployment unit |
|---|---|---|---|---|
| core の契約テスト (`packages/core/test/subs-contract.test.ts`・`subs-screen-contract.test.ts`) | spec の core 契約: 照合の一致 (applyFreeeDeals とサブスク画面)・AC-003 (連鎖・循環・自己統合)・defaultMergeTarget・照合の順序 (FR-009) | Vitest | packages/core | CI「テスト (core・web)」 |
| api の統合テスト (`packages/api/src/subs-screen.integration.test.ts`) | AC-001 (aquavoice 型で統合元 0 件と推定月額の再計算)。既存の別名の経路は残す | Vitest + インメモリ D1 | packages/api | CI「テスト (api)」 |
| api の統合テスト (新しい `packages/api/src/subs-merge-operations.integration.test.ts`) | AC-004〜006・012〜014・017〜020 と問い合わせ数 (20 未満) | Vitest + インメモリ D1 | packages/api | CI「テスト (api)」 |
| web の DOM テスト (`packages/web/src/subscriptions-screen.dom.test.tsx`) | AC-007〜011・015・016・021・022 | Vitest + DOM | packages/web | CI「テスト (core・web)」 |
| check-financial-visuals (`packages/web/scripts/check-financial-visuals.mjs`) | `/api/subscriptions` のモックと図の数 | Node スクリプト | packages/web | verify:full |
| `scripts/seed-local.mjs` と `samples/` | ローカル確認用の匿名サンプルの生成と取込 | Node スクリプト、CSV | リポジトリ | ローカル |
| `docs/subscriptions-screen.md`・`docs/data-schema.md` | 照合の規則・操作の種類・利用者の行動・3 段の手順・保持と注意・0058 の表 | Markdown | docs | リポジトリ |

## Cross-cutting contracts

規範は [spec-subscriptions-merge](../specs/spec-subscriptions-merge.md) に従う。

- 認証・所有者・操作者: spec「認証・認可」。
- 入力・応答・エラー・冪等性・revision: spec「API契約」「ビジネスルールと検証」。
- 操作状態・再試行・表示文言: spec「UI・状態遷移」「エラー・例外・回復」。
- 列・制約・保持・復元: spec「データモデル」「確定した実装契約」。
- 検証: spec「テストと受入条件」。実行結果は [docs の検証索引](../docs/subscriptions-screen.md#verification-records)。

本領域の追加参照: AC-018 (既存書込みの互換)。具体値と期待値は spec を参照する。

本書は構造と採用理由を持ち、契約表を複製しない。現行の追加契約と推定月額の再計算規則は spec の「推定月額の契約確定」を参照する。

## Subtype architecture

- Frontend: N/A: 画面の部品と状態は `architecture/subscriptions-merge-frontend.md` が持ち、本書は DOM テストの配置だけを持つ
- Backend: N/A: API の契約は `architecture/subscriptions-merge-backend.md` が持ち、本書は統合テストの配置だけを持つ
- Infrastructure: 下記の「Infrastructure architecture」を参照 (テストと運用の基盤として書く)
- Data: N/A: 表と保持の文は `architecture/subscriptions-merge-database.md` が持ち、本書は fixture の作り方と docs への記載だけを持つ
- Security: N/A: 秘匿項目の規則は `architecture/subscriptions-merge-security.md` が持ち、本書は AC-012・014・020 の検査の配置だけを持つ

### Infrastructure architecture

#### Environments and topology

- Local/test/staging/production parity:
  - 環境は次の 4 つで、staging は置かない。
    - ローカル: vite (4175 番) と wrangler dev。
    - テスト: Miniflare のインメモリ D1。既存の統合テストと同じく migrations を全件適用する。
    - CI: GitHub Actions。
    - 本番: 今回の変更は無い。
  - `pnpm verify:full` の check:financial-routes は、4175 番の vite が起動していることを前提にする。
  - ローカルで login が 503 になるときは、`.dev.vars` が足りない。
  - ローカルの jsdom は、CI と版が違うことがある。ローカルが緑でも CI が赤になりうるので、完了の判定は CI の結果で行う。
  - CI の headless Chrome は pointer が none として振る舞う。見た目の検査では `@media (pointer: fine)` に頼らない。
- Regions/zones/network/trust boundaries: N/A: テストと運用の手順は Cloudflare の配置に依存しない。
- DNS/TLS/edge/ingress/egress: N/A: テストは外部と通信しない。運用の手順が使うのは、既存の画面と Cloudflare の dashboard だけである。

#### Compute and storage

- Runtime/compute/scaling:
  - テストの配置と AC の対応は、次のとおり (spec の「テストと受入条件」)。
    - core: spec の core 契約 (照合の一致・AC-003・defaultMergeTarget)。照合の一致の fixture には、照合の順序を 1 つにそろえる前後で割り当てが変わる取引 (科目で先に絞るか、照合の後で弾くかで結果が違うもの) を入れる。こうすると旧実装で正しい理由で落ちる (FR-009)。
    - api (`subs-screen.integration.test.ts`): AC-001。
    - api (`subs-merge-operations.integration.test.ts`): AC-004〜006・012〜014・017〜020 と、問い合わせ数が 20 未満であること (spec の performance)。
    - web: AC-007〜011・015・016・021・022。既存の DOM テストのうち、画面の統合を `/api/sub-vendors/3/aliases` の送信で確かめている箇所 (`subscriptions-screen.dom.test.tsx:916-917`) は、`POST /api/sub-vendors/merge` の送信へ書き換える。
  - 連続と同時は、別の it に分ける。
    - 連続: 5 件を順に待って送る。
    - 同時: 同じ baseRevision から 2 件を並べて送る。どちらが先に着いても、1 件は 200、もう 1 件は 409 (canonical_write_busy か subscription_revision_conflict) になることを見る。到着の順序には頼らない。
  - 問い合わせ数は countingDatabase と同じ数え方の proxy で数える。prepare の実行は 1 文、batch は中の文の数で数える。
    - countingDatabase は export されていないので、新しいテストに同じ数え方の proxy を置く。
    - 入力は、統合元 50 件と取引名 50 件にする。
- Database/object/cache/queue:
  - 保持の fixture は、created_at を直接 INSERT して作る (spec AC-019)。
    - 取り消し: 31 日前の統合を取り消すと 410 undo_expired になる。
    - 掃除: 31 日前と 401 日前の行を、それぞれ 51 件置き、新しい書込みを 1 回送る。
      - 31 日前の行は、50 件の payload_json と before_json が NULL になり、1 件は残る。
      - 401 日前の行は、50 件が消え、1 件は残る。
  - 金額は整数の円なので、`toBe` で比べる。
  - 金額の正本は fixture である。画像 (`design/FINAL-UI/images/09-subscriptions.png`) は、構成・文言・配置の根拠に留める (前サイクルと同じ)。
  - 本件では samples を変えない。テストは fixture だけで完結させる。
  - ローカルの確認に統合できるサンプルが要るときは、`scripts/seed-local.mjs` を直して samples を作り直し、生成物と一緒にコミットする。CSV を直接編集すると、次の生成で上書きされる。
  - seed-local.mjs の既定の送信先は 8787 (:3、:17) で、別の worktree の wrangler dev を指していることがある。KANJO_BASE_URL で送信先を明示する〔現物 2026-09-30〕。
- Capacity and cost budgets:
  - api のテストは直列で走る (vitest.config.ts:8-9)。そのため新しいファイルは「テスト (api)」の合計時間 (timeout 20 分、ci.yml:71-78) にそのまま足される。
  - 「テスト (core・web)」の timeout は 15 分 (ci.yml:56-65) である。
  - 新しいテストの所要時間は、`docs/ci-cd-operations.md` の「2.1 CIテストの測定記録」と比べる。timeout に近づいたら、timeout を上げずにジョブを分ける〔本書で置いた値〕。
  - 費用: 既存の CI の範囲に収まり、新しい有料の実行環境を足さない。

#### IaC and delivery

- IaC tool/state/locking: N/A: テストと docs はリポジトリのファイルで、インフラの状態を持たない。0058 の配信は `architecture/subscriptions-merge-infrastructure.md` が持つ。
- CI/CD stages, approvals, provenance:
  - PR で `.github/workflows/ci.yml` のテスト (core・web)・テスト (api)・ビルドを緑にする。main の必須チェックは verify の 1 本である。
  - docs (3 段の手順・保持・注意、0058 の表) は、実装と同じ PR で直す。
  - 0058 は追加型なので、migration の承認は要らない〔-003 由来: qa-subsmerge-infrastructure-web-003〕。
  - 「テスト (api)」が cancelled になったら、まず同じ commit を再実行する。それでも timeout を超えるなら、ファイルかジョブを分ける〔現物 2026-09-30〕。
- Immutable artifacts/config promotion: N/A: 本書の成果物はテストと docs で、ビルドの成果物と設定の昇格は既存の Deploy のままである。

#### Secrets and access

- Secret authority/rotation/injection:
  - テストは合成の SESSION_SECRET だけを使い、実の secret を読まない。
  - ローカルの `packages/api/.dev.vars` は git の操作に含めない。
  - 実データを含む操作は、`scripts/hooks/guard-real-data.sh` の PreToolUse フックが止める。止まった操作は、回避せずに進め方を変える。
- Human/service access and least privilege:
  - 3 段の手順は、段ごとに見られる人が違う。
    - 1・2 段目 (画面と操作履歴): ログインした利用者なら誰でも見られる。
    - 3 段目 (observability): Cloudflare のアカウントを持つ運用者だけが見られる。
  - 操作履歴の応答には、before_json・payload_json・key を含めない (AC-020)。

#### Reliability and recovery

- SLO/alerts/on-call: N/A: 個人利用のため、SLO・警報・当番は置かない。止まった操作は、次の 3 段で辿る。手順は `docs/subscriptions-screen.md` に新しい節を足して書く〔-003 由来: qa-subsmerge-maintenance-ops-web-003〕(spec UC-8)。
  1. 画面の操作状態で、処理中・待機中・完了・失敗と操作者を見る。
  2. `GET /api/subscription-operations?limit=20` で、操作 id・kind・created_at・undone_at を見る。
  3. Workers の observability を操作 id で検索し、結果と所要 ms を見る。
- Backup/restore/RPO/RTO/DR: 保持を次の形で docs に書く〔決定 qa-subsmerge-retention-001〕(FR-023・BR-013)。
  - 取り消せる期間は 30 日。30 日を過ぎると payload_json と before_json を NULL にする。
  - 記録は 400 日で消す。
  - 掃除は新しい書込みのついでに 50 件ずつ行う。
  - 注意として次を書く。
    - 書込みが無い期間は、期限を過ぎた行も残る。
    - 取り消せるかどうかは created_at で判定する。そのため、NULL になる前の 31 日目の行でも 410 undo_expired になる。
    - observability のログは保持期間が短い。古い操作は 2 段目の操作履歴までで辿る。
  - 復元は既存の nightly_backup と Time Travel を使い、本書で新しい手順は足さない。
- Failure domains/failover:
  - テストの失敗は、1 つの AC に 1 つの理由で結び付ける。describe に AC の番号を置き、it の名前を利用者の言葉で書く (例:「同じ操作 id を二度送っても、戻るのは一回ぶんだけ」の前例)。
  - デバッグ用のテストファイルは scratchpad に置く。空の `*.test.ts` をリポジトリに残すと、vitest が失敗して verify:full を止める。

#### Infrastructure verification

- Plan/policy/security/drift/smoke/restore tests:
  - Plan (旧実装で落ちること): 新しいテストを、実装の前に旧実装で 1 度走らせ、落ちることを確かめる。落ちた理由を `docs/subscriptions-screen.md` に記録する (前例は「旧実装での失敗の確認 (P04)」の節)。その際、0 件の違反と、0 件しか調べていないことを区別する。
  - Policy (値の固定):
    - 件数と金額を `toBe` で固定する。
    - 緑にするために契約を緩めない。
    - 保持の日数は定数から作る。
    - CANONICAL_MUTATION_CLAIM_TTL_MS だけは spec の名前に合わせる。ほかの定数の名前は、DELETION_UNDO_RETENTION_DAYS の前例に倣って実装で決める。
  - Security: AC-012・AC-014・AC-020 と、本文の user_id と actor を無視する検査が緑であること。
  - Drift: docs の kind の 8 種が 0058 の CHECK 制約と一致すること。check-financial-visuals の `/api/subscriptions` のモック (:421 に形の説明、:1590 で返す) に revision を足し、`/subscriptions` の図の数 (:2717 の expectedFigures 1) は変えないこと。
  - Smoke: `pnpm verify:full` と CI が緑であること (AC-023)。
  - Restore: 取り消しで統合前と同じ行・同じ月額・同じ subs 範囲に戻ること (AC-013)。backup と restore の検査は、`architecture/subscriptions-merge-infrastructure.md` の Restore に従う。

## Architecture decisions

| ADR | Decision | Alternatives | Trade-on rationale | Consequences |
|---|---|---|---|---|
| ADR-OPS-01 | 統合・並行・取り消し・保持の api テストを、新しい `packages/api/src/subs-merge-operations.integration.test.ts` に置く〔-003 由来: qa-subsmerge-maintenance-ops-web-003〕 | 既存の subs-screen の統合テストに足す。`packages/api/test/` に置く | 画面の読み取りの検査と、書込み・並行・保持の検査を、別の理由で落ちるファイルに分ける | api は直列で走るので、分けても合計時間は縮まない。所要時間を測って記録と比べる |
| ADR-OPS-02 | 保持の検査は、created_at を直接 INSERT した 31 日前と 401 日前の fixture (各 51 件) で行う〔本書で置いた値〕 | テストの時計を進める。本番と同じだけ待つ | Worker 側の時刻に頼らず、境界と 50 件の上限を 1 回の書込みで確かめられる | 日付は定数から作り、直書きしない |
| ADR-OPS-03 | 止まった操作の 3 段の手順を docs に書き、警報・SLO は置かない〔-003 由来: qa-subsmerge-maintenance-ops-web-003〕 | 警報と当番を足す。手順を残さない | 個人利用で監視基盤を作らずに、止まった操作を後から追える | ログの項目や API を変えるときは、docs を同じ PR で直す |
| ADR-OPS-04 | 掃除は書込みの batch の (g)(h) で行い、その検査を api の統合テストに置く〔決定 qa-subsmerge-retention-001〕 | 夜間 job を足し、scheduled のテストに置く | 夜間の予算 49/49 を動かさない | 書込みが無い期間は行が残ることを、docs の注意に書く |
| ADR-OPS-05 | テストのデータは架空の名前で fixture に組み、samples は seed-local.mjs の生成物として直接編集しない〔現物 2026-09-30〕 | 実データから抜き出す。CSV を手で直す | public リポジトリに実データを入れず、生成物との食い違いを作らない | サンプルを変えるときは seed-local.mjs を直して作り直す |
| ADR-OPS-06 | 問い合わせ数を、countingDatabase と同じ数え方で統合テストの中で数え、20 未満を assert する (spec の performance) | 数えずに本番のエラーで気付く | 上限 50 に近づく変更を CI で止める | 数え方の proxy が新しいテストにもう 1 つ増える |

## Delivery, migration and rollback

- Build/deploy topology: 既存の CI と Deploy のまま。本書の変更 (テストと docs) は、実装と同じ PR で届く。
- Migration sequence:
  1. 旧実装で落ちるテストを書き、落ちることを確かめる。
  2. core の照合一覧と defaultMergeTarget を作る。
  3. api の統合・取り消し・操作履歴と掃除を作る。
  4. web の選択と操作状態を作る。
  5. docs を書く。
     - `docs/subscriptions-screen.md` に新しい節を足す: 照合の規則、kind の 8 種、エラーごとの利用者の行動、3 段の手順、保持 30 日と 400 日と注意、AC と検証手段の対応 (前例は「要件表」の節)。
     - `docs/data-schema.md` に「サブスクの統合と操作の記録 (migration 0058)」の節を足し、「照合の規則」(:132) を FR-009 の順序に直す (前例は :167 の「サブスクのカテゴリ上書きと見直し判断 (migration 0043)」)。
  6. `pnpm verify:full` と CI を緑にする。
- Rollback trigger/procedure:
  - trigger: テストか verify:full が赤のまま直せないとき。または、本番で統合の結果が spec と違うとき。
  - procedure: 実装と同じ commit を revert し、テストと docs も一緒に戻す。0058 の列と表は残るので、docs の data-schema にも「列は残る」と書き残す (差し戻しの手順は `architecture/subscriptions-merge-infrastructure.md`)。

## Risks and verification

- Risk/assumption: 同時送信のテストは、インメモリの D1 では到着の順序が本番と違うことがある。どちらが先でも同じ結論になる形で書いて、順序に頼らない。
- Risk/assumption: 照合の順序を 1 つにそろえる (FR-009) と、既存の fixture の期待値が変わることがある。core の契約テストで差を確かめ、変わる場合は差を docs に記録する (spec の「実装時に確かめる事項」)。
- Risk/assumption: 新しい api のテストは直列の合計時間に足され、「テスト (api)」の timeout 20 分に近づきうる。所要時間を測って、記録と比べる。
- Risk/assumption: 利用者は 3 段目のログを長くは遡れない。3 段目で見つからないときは、2 段目の操作履歴と画面の表示で判断する。
- Architecture fitness test:
  - 新しいテストが旧実装で落ちること。
  - docs の kind の一覧と CHECK 制約の値が一致すること。
  - samples の差分が seed-local.mjs の再生成だけから来ていること。
- Load/failure/security validation:
  - spec AC-001〜AC-022 がすべて自動テストで緑であること。
  - 統合 1 回の問い合わせ数が 20 未満であること。
  - `pnpm verify:full` と CI が緑であること (AC-023)。
