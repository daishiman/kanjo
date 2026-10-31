---
graph_node_id: "arch-classify-bulk-save-maintenance-ops"
artifact_kind: "architecture"
artifact_subtypes: ["infrastructure"]
title: "明細仕分け一括保存 — O1〜O9 を 4 層のテストと 1264px の画面検査で固定する回帰検出"
project_id: "kanjo"
domain: "maintenance-ops"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: []
tags: ["classify", "bulk-save", "maintenance-ops"]
file_path: "architecture/classify-bulk-save-maintenance-ops.md"
template_id: "architecture"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluator": "system-spec-harness:assign-system-spec-completeness-evaluator", "evidence_ref": "system-spec/completeness-findings.json", "evaluated_digest": "b12cfcee5a7b7de7613084fb545e100724d284e7e09e39aa10317f9544f2317b"}
source_lineage: {"origin_kind": "system-spec-harness", "source_plugin": "system-spec-harness", "source_path": "system-spec/maintenance-ops.md", "source_version": "0.1.16", "source_digest": "b12cfcee5a7b7de7613084fb545e100724d284e7e09e39aa10317f9544f2317b", "imported_at": "2026-10-01T12:13:05Z"}
created_at: "2026-10-01T12:13:05Z"
updated_at: "2026-10-01T12:13:05Z"
depends_on: ["spec-classify-bulk-save"]
related_nodes: ["arch-classify-bulk-save-ui-ux", "arch-classify-bulk-save-frontend", "arch-classify-bulk-save-backend", "arch-classify-bulk-save-database", "arch-classify-bulk-save-auth", "arch-classify-bulk-save-security", "arch-classify-bulk-save-infrastructure"]
resource_scope: ["packages/web/scripts/check-financial-visuals.mjs", "packages/web/scripts/viewports.mjs", "packages/web/package.json", "package.json", ".github/workflows/ci.yml", "packages/core/src/classify-status.ts", "packages/core/src/classify-status.test.ts", "packages/core/test/settings-json.test.ts", "packages/api/src/classify-bulk.integration.test.ts", "packages/api/src/import-lifecycle.test.ts", "packages/api/src/import-diff.test.ts", "packages/api/src/split-lifecycle.test.ts", "packages/api/src/cash-lifecycle.test.ts", "packages/api/src/vendor-memory.test.ts", "packages/api/src/row-transfer-lifecycle.test.ts", "packages/api/src/classify-transactions-shape.test.ts", "packages/api/src/classify-list-paging.integration.test.ts", "packages/api/test/total-cashflow-verdict.integration.test.ts", "packages/api/test/settings-backups.integration.test.ts", "packages/api/src/migration-test-support.ts", "packages/web/src/pages/classify/classify.dom.test.tsx", "packages/web/src/pages/settings/settings.dom.test.tsx", "docs/classify-screen", "docs/ci-cd-operations.md"]
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
classification_candidates: [{"artifact_kind": "architecture", "candidate_path": "architecture/classify-bulk-save-maintenance-ops.md", "confidence": 1.0}]
tracker_binding: "none"
beads_linkage: null
github_publication: {"mode": "local_only", "project_aliases": [], "labels": [], "milestone": null}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"policy": "manual", "status": "not_applicable", "source": null, "completed_at": null, "reconciled_at": null, "evidence_refs": []}
implementation_readiness: {"status": "complete", "missing_sections": [], "checked_at": "2026-10-01T12:13:05Z"}
serves_goals: ["G1", "G2", "G3", "G4", "G5"]
---
# Architecture overview

明細仕分けの一括保存と取引一覧の改善について、保守運用の制約を持つ文書。本書が定めるのは次の 4 つである (根拠: maintenance-ops.md §確定内容 qa-classify-bulk-maintenance-ops-web-001 / 00 O1〜O9)。

- 目標 O1〜O9 を、core の単体テスト・api の統合テスト・web の DOM テスト・headless Chrome の画面検査のどこで固定するか
- 本番で何を観測し、一括保存の失敗をどう辿るか (ログ・監査・調べる手順)
- 勘定科目の対応表の初期 5 行をどう保守するか
- 回帰を止めるテストと CI のゲートをどう緑に保つか (`pnpm verify:full` と PR の CI)

- 正本: 値・エラーコード・受入条件の文面は `specs/spec-classify-bulk-save.md` (以下 spec) に従い、本書と食い違えば spec を優先する。`system-spec/maintenance-ops.md` と `system-spec/00-requirements-definition.md` (以下 00) は承認時の入力である。
- 行番号: commit a63d35c の現物を 2026-10-01 に開いて確かめた値である。
- 分担: 1 起動の問い合わせの予算、migration の適用と本番への反映、環境の構成、ロールバックの手順は `architecture/classify-bulk-save-infrastructure.md` が持ち、本書では繰り返さない。本書はそれらを確かめるテストと、止まったときに辿る手順を持つ。
- 対象の platform は web だけである。端末から失敗を集める仕組みや OS ごとの配布は検討しない (根拠: maintenance-ops.md §カテゴリ別収集状態 / qa-classify-bulk-decision-067)。

## Context and drivers

以下の現物の観測は着手前 (HEAD a63d35c) の記録である。到達点は各節と spec を参照する。

- Business/technical context (根拠: qa-classify-bulk-maintenance-ops-web-evidence-001 と、2026-10-01 に開いた現物):
  - 画面検査: `packages/web/scripts/check-financial-visuals.mjs` は KANJO_VISUAL_SCOPE で範囲を選ぶ (:13)。現金入力・使い方・改善リクエストの範囲はある (fixture は :1426・:1467・:1494、判定は :1917・:2144・:2277) が、明細仕分けの範囲は無い。
    - API の応答は responseFor (:1570) が fixture で返し、本物の API に触れない。`/api/transactions` と `/api/transactions/selected` の枝は無い。
    - 接続先は既定で `http://127.0.0.1:4175` (:12) で、ローカルの vite を前提にする。画面の写しは KANJO_VISUAL_OUTPUT_DIR (:22、既定は OS の一時ディレクトリ) に出る。
    - 幅は既定のラベルの列 (:16-19) を viewportsByLabel (:21) で引く。
  - 幅の定義: `packages/web/scripts/viewports.mjs` の VIEWPORT_CASES には 1280 (:35) があり、1264 は無い。viewportsByLabel (:48-56) は登録の無いラベルで例外を投げる。
  - verify:full: `package.json:40` は test・typecheck・lint・build の後に、web の画面検査 9 本 (check:thead〜check:improvement-screen) と preview:smoke を順に実行する。明細仕分けの画面検査は含まない。web の画面検査の script は `packages/web/package.json:20-26` に並ぶ。
  - 初期 JS 予算: check:js-budget (`packages/web/package.json:15`) は web の build (:9) の中で走る。
  - PR の CI: `.github/workflows/ci.yml` は push (main)・pull_request・手動 (workflow_dispatch) で走り (:3-7)、次の 4 つのジョブを verify (:95) が束ねる。main の必須チェックは verify の 1 本である。
    - 静的検査 (:32): lint・typecheck・test:aux (:39-44)。test:aux は skills:test を含む (`package.json:20`)。timeout 20 分。
    - テスト (core・web) (:57): timeout 15 分 (:60)。
    - テスト (api) (:71): timeout 20 分 (:74)。
    - ビルド (:83): `pnpm build` (:90) で初期 JS 予算を確かめる。
  - CI に画面検査は無い: `.github/workflows/` の 3 本 (ci.yml・deploy.yml・migrate.yml) のどれも、headless Chrome も verify:full も走らせない。画面検査はローカルの verify:full だけで走る。
  - api のテストは直列で走る (`packages/api/vitest.config.ts:8-9` の fileParallelism false と maxWorkers 1)。1 件の timeout は 60 秒 (:12-13)。
  - 問い合わせを数える前例: `packages/api/src/import-lifecycle.test.ts:89` の countingDatabase は D1Database を包み、batch は中の文の数だけ数える (:122)。export されていない。`packages/api/src/import-diff.test.ts:37` にも別の countingD1 がある。`packages/api/src/audit-log-d8.test.ts:577` は計画の本数が 49 未満であることを固定している。
  - 既存の明細仕分けのテスト:
    - core: `packages/core/src/classify-status.test.ts` (389 行)
    - api: `packages/api/src/classify-bulk.integration.test.ts` (599 行)。:232 と :296 は、検証で弾かれた明細 (not_found・候補に無い科目) のほかは保存されることを確かめる。書き込みの失敗は :382 が 1 件だけを送って write_failed を確かめ、複数件の全件 write_failed と本数は確かめていない。batch ごとの部分成功はテストではなく実装の側にある (`packages/api/src/routes/classify-bulk.ts:195-196` の「前の batch の成功は取り消さない」)。
    - api: `packages/api/src/classify-list-paging.integration.test.ts` と `classify-transactions-shape.test.ts`
    - web: `packages/web/src/pages/classify/classify.dom.test.tsx` (803 行)。AT-08 の部分失敗を :566 で固定している。ほかに `view-model.test.ts`。
  - 境界の定数: `packages/core/src/classify-status.ts` の REVIEW_CONFIDENCE_THRESHOLD 80 (:43)・CONFIDENCE_TIER_HIGH_MIN 80 (:51)・MF_MID_CONFIDENCE 70 (:88)。選択の上限 50 は web の 2 か所に分かれている (`TransactionTable.tsx:24` の MAX_SELECTION、`view-model.ts:272` の MAX_URL_SELECTION)。表示件数は 50 で固定されている (`ClassifyPage.tsx:72`)。
  - 本番の観測: Workers observability は有効で、head_sampling_rate は 1 (`packages/api/wrangler.jsonc:33-36`)。
- Quality attribute priorities: 優先順は次のとおりで、G1〜G5 に資する。
  1. 回帰の検出: テストは 1 つの理由で落ち、旧実装で落ちる (前サイクルの「Reliability and recovery」を引き継ぐ)。
  2. 再現性: 同じ入力で同じ結果になり、時刻や並びの偶然に頼らない。
  3. 運用の追跡: 利用者の報告から、止まった一括保存を opId と requestId で辿れる。
  4. テストの所要時間: CI の timeout の内に収める。
- Constraints:
  - 既存のテスト基盤 (Vitest・Miniflare のインメモリ D1・DOM テスト・check 系の script) だけを使う。
  - 本リポジトリは public である。テストと fixture は架空の名前と匿名化済みの値だけで作り、実データ (`data/`) を持ち込まない。
  - lint・typecheck・test・skills:test・初期 JS 予算・verify:full を全て exit 0 に保つ (根拠: 00 O7 / qa-classify-bulk-decision-074)。
  - 件数や上限の期待値を、緑にするために緩めない。

**前サイクルとの関係**: `architecture/classify-maintenance-ops.md` は /classify 画面を作った前のサイクルの文書で、正本のまま残す。本書はそれを引き継いだ上で、次の 6 点を定める。前の文書は書き換えない。

- (a) 引き継ぐ: 同書「Reliability and recovery」の「新しいテストは確定前に旧実装に当てて落ちることを確かめ、件数を固定する検査は対象の件数が 0 でないことも併せて確かめる」。今回の旧実装は HEAD a63d35c の一括保存・一覧・候補の算出である。
- (b) 引き継ぐ: 同書「Goals and non-goals」の Non-goals「新しい監視・アラート・ダッシュボード」と、「Cross-cutting contracts」の「取引の履歴が変更の記録を担う」。今回も観測は既存のログと履歴で行う。
- (c) 変える: 同書の Non-goals「E2E の実ブラウザ試験の追加 (既存の DOM テストと verify:full の範囲に留める)」のうち、画面の幅の検査について。今回は既存の画面検査の script に明細仕分けの範囲を新設し、1264px と 1280px を測る (根拠: qa-classify-bulk-maintenance-ops-web-001)。新しい E2E の枠組みは足さない。
- (d) 変える: 同書「Goals and non-goals」の G3「一括保存の部分失敗と上限を API 統合テストで固定する」を、「書き込みの段は全件か無しで、失敗したら保存対象の全件が write_failed、1 要求は 49 本以内」を固定することに改める (根拠: 00 O8 / qa-classify-bulk-decision-057 / qa-classify-bulk-delegated-001)。
- (e) 変える: 同書「Container and component view」の「(予定)」のパス 3 本を、実在するテストのパス (`packages/core/src/classify-status.test.ts`・`packages/api/src/classify-bulk.integration.test.ts`・`packages/web/src/pages/classify/classify.dom.test.tsx`) に改める。
- (f) 変える: 同書「IaC and delivery」と「Delivery, migration and rollback」の「CI → Migrate → Deploy」を、現物どおり「PR の CI (verify) → main → Deploy (migration の判定を含む)」に改める。手順の詳細は `architecture/classify-bulk-save-infrastructure.md` が持つ。同書「Risks and verification」の「verify:full はローカルの vite 4175 を前提にする」は引き継ぐ。

## Goals and non-goals

- Goals:
  - G1〜G5: 目標 O1〜O9 を、それぞれの測り方に書かれた層のテストで固定し、旧実装で落ちることを確かめてから確定する (根拠: 00 O1〜O9 / qa-classify-bulk-maintenance-ops-web-001 の訂正 2026-10-01T10:34:36Z)。
  - G4: headless Chrome の画面検査に明細仕分けの範囲 (KANJO_VISUAL_SCOPE=classify) を新設し、1264px と 1280px で一覧の各列が最小幅以上・本体の横はみ出し 0・編集パネルを閉じると一覧が広がることを確かめる。verify:full に組み込み、記録は `docs/classify-screen/` に置く (根拠: 00 O5 / maintenance-ops.md §上流指針 operations)。
  - G1・G5: 上限と閾値を名前付き定数に置き、境界 (79 と 80、60 と既存の 70、50 と 51、100 と 101、本文 256KB) をテストで固定する (根拠: maintenance-ops.md §適用された設計知識 Clean Code)。
  - G1: 一括保存の 1 要求の問い合わせを API テストで数え、50 件・100 件とも 49 本以内であることを固定する (根拠: 00 O8)。
  - G3: 一覧の応答から全件の transactions を外すのに合わせて、それを読む API テスト 8 本を rows か選択の読み出しを読む形へ移す (根拠: qa-classify-bulk-backend-web-007 (2)、agent の推定で利用者は未確認)。
  - G1〜G5: lint・typecheck・test・skills:test・初期 JS 予算・verify:full を全て exit 0 に保つ (根拠: 00 O7)。
- Non-goals:
  - 新しい監視・警報・当番・SLO・ダッシュボード。
  - 新しい E2E の枠組み (実ブラウザの操作試験) の導入。画面の幅は既存の画面検査の script で測る。
  - 夜間保守の job とそのテストの変更。
  - web 以外の platform の配布と、端末からの失敗の収集 (根拠: qa-classify-bulk-decision-067)。

## System context and boundaries

- Users/external systems:
  - 開発と保守の担い手は、利用者と同じ 1 人である。
  - テスト基盤は Vitest と Miniflare、画面検査はローカルの headless Chrome (CDP) と vite (4175 番)、CI は GitHub Actions、本番のログは Cloudflare の Workers observability を使う。
  - 利用者は、画面の通知と一括保存の結果から、止まった保存に気づく。
- Trust/deployment/data boundaries:
  - テストのデータは架空の fixture と匿名化済みの値だけで作る。実データの持ち込みは `scripts/hooks/guard-real-data.sh` が止める。
  - テストと画面検査は本番の D1 とログに触れない。画面検査の API は fixture で返す (check-financial-visuals.mjs:1570)。
  - `packages/api/.dev.vars` は読まず、git の操作に含めない。
- Context diagram:
  - 開発: 変更 → core・api・web のテスト → ローカルの `pnpm verify:full` (vite 4175 を起動して) → PR の CI (verify) → main → Deploy の順に進む。
  - 運用: 利用者の報告 → 画面の通知と応答の opId → `GET /api/transactions/:txId/history` → observability を requestId で検索 → `wrangler tail kanjo-console`、の順に辿る。

## Container and component view

| Container/Component | Responsibility | Interface | Data owner | Deployment unit |
|---|---|---|---|---|
| core の単体テスト (`packages/core/src/classify-status.test.ts` ほか) | O1 の値の解決順と『カテゴリなし』、O3 の提案の由来と信頼度、閾値の境界 | Vitest | core | CI のテスト (core・web) |
| api の統合テスト (`packages/api/src/classify-bulk.integration.test.ts` ほか) | O3 の対応表の API、O4 の引き直し、O6 の認可と入力検証、O8 の本数と全件 write_failed、O9 の送り直し | Vitest + Miniflare | api | CI のテスト (api) |
| 問い合わせを数える proxy | D1Database を包み、prepare の実行と batch の中の文を 1 本ずつ数える | テスト用の関数 | api のテスト | CI のテスト (api) |
| web の DOM テスト (`classify.dom.test.tsx`・`settings.dom.test.tsx`) | O1・O2・O4 の操作、O5 の 6 列と表示件数、O3 の設定画面の行の足し引き | Vitest + jsdom | web | CI のテスト (core・web) |
| 設定の JSON とバックアップの往復のテスト (`packages/core/test/settings-json.test.ts`・`packages/api/test/settings-backups.integration.test.ts`) | O3 の往復と、版 1・旧いバックアップが初期 5 行になること | Vitest | core・api | CI |
| 画面検査の明細仕分けの範囲 (`check-financial-visuals.mjs`・`viewports.mjs`) | O5 の 1264px と 1280px の実描画 | Node + CDP | web | ローカルの verify:full |
| web の画面検査の script (`packages/web/package.json`) | KANJO_VISUAL_SCOPE=classify で上の範囲を呼ぶ | npm script | web | verify:full から呼ぶ |
| 移す API テスト 8 本 | 全件の transactions の代わりに rows か選択の読み出しを読む | Vitest | api | CI のテスト (api) |
| `docs/classify-screen/` | 画面検査の結果と、前サイクルの規定を置き換えた記録 | Markdown | リポジトリ | リポジトリ |
| `docs/ci-cd-operations.md` | 失敗の切り分け (§9) とロールバック (§10) の既存の手順 | Markdown | リポジトリ | 変更なし |

テストを既存のファイルに足すか新しいファイルに分けるか、ファイル名は実装時に決める (章 §確定内容 qa-classify-bulk-maintenance-ops-web-001 は検査の層だけを決め、ファイルを名指さない)。

## Cross-cutting contracts

規範は spec に従い、本書は契約表を複製しない。

- Identity/access: 認可のテスト (未認証 401・フェンス拒否 403・他の利用者の行が見つからない扱い) は `architecture/classify-bulk-save-auth.md` と `-security.md` の検証項目に従い、本書は置き場所だけを持つ。
- Errors/resilience: 413 too_many_classify_changes・413 payload_too_large・write_failed (保存対象の全件)・409 canonical_write_busy の意味は spec「エラー・例外・回復」と `architecture/classify-bulk-save-backend.md` が持つ。本書はそれぞれをテストで 1 回ずつ起こして固定する。
- Observability/audit:
  - 本番のログは既存の 4 種を使い、新しい運用信号を足さない。
    - 未処理の例外: onError (`packages/api/src/index.ts:152-`) が level・requestId・path・name・呼び出し位置 (at) を JSON で出す。明細の内容・金額・message は出さない。
    - requestId: `packages/api/src/index.ts:58` が要求ごとに振り、失敗応答とログを同じ id で結ぶ。
    - schema の不一致: `packages/api/src/schema-guard.ts:70-79` が schema_guard_blocked を、期待と適用済みの migration の名前つきで出し、503 を返す。
    - lease の解放の失敗: `packages/api/src/canonical-mutation-fence.ts:301` が canonical_lease_release_failed を出す。
  - 監査は既存の 2 つで行う。
    - 取引の履歴: 一括保存は値が変わった項目ごとに source=bulk の行を残し、各行に opId を持つ (`packages/api/src/classify-history.ts:133-169`)。一括保存の応答も opId を返す (`packages/api/src/routes/classify-bulk.ts:207`)。明細ごとの履歴は `GET /api/transactions/:txId/history` (classify-bulk.ts:212、limit は 50 まで :210) で読める。
    - 設定の変更履歴: 勘定科目の対応表の変更を残す (根拠: 00 G5 / qa-classify-bulk-decision-049)。
- Configuration/secrets: N/A: テストと画面検査に秘密情報を使わない。observability の設定 (wrangler.jsonc:33-36) は変えない。
- Compatibility/versioning:
  - 前サイクルの仕様 `specs/spec-classify-screen.md` は書き換えない。置き換える規定は spec と本書で宣言し、置き換えた記録を `docs/classify-screen/` に残す (根拠: qa-classify-bulk-prior-cycle-001、agent の推定で利用者は未確認)。
  - 既存のテストの期待値を変えるときは、変えた理由 (どの決定で規定が置き換わったか) をテストの名前か記録に残し、契約を緩めたのか定義を変えたのかを区別できるようにする。

## Subtype architecture

- Frontend: N/A: 画面の部品と状態は `architecture/classify-bulk-save-frontend.md` が持ち、本書は DOM テストと画面検査の置き場所だけを持つ。
- Backend: N/A: API の契約と一括保存の段は `architecture/classify-bulk-save-backend.md` が持ち、本書はそれを固定するテストだけを持つ。
- Infrastructure: 下記の「Infrastructure architecture」を合成する。
- Data: N/A: 対応表の表と変更履歴の作り直しは `architecture/classify-bulk-save-database.md` が持つ。
- Security: N/A: 入力検証と履歴の脅威は `architecture/classify-bulk-save-security.md` が持つ。

### Infrastructure architecture

#### Environments and topology

- Local/test/staging/production parity:
  - ローカル: `pnpm verify:full` は vite (4175 番) が動いていることを前提にする。画面検査は接続先に `KANJO_VISUAL_BASE_URL` を受ける (check-financial-visuals.mjs:3-4・:12)。
  - テスト: api の統合テストは Miniflare のインメモリ D1 に `migrations/` を全件当てて走り、直列で動く (vitest.config.ts:8-9)。
  - CI: PR の CI は lint・typecheck・test:aux・テスト (core・web)・テスト (api)・build を走らせ、verify で束ねる。画面検査と verify:full は走らせない。
  - 本番: Worker kanjo-console の Workers observability と `wrangler tail` でログを見る。staging は無い。
  - 画面検査は CI に無いので、O5 の画面検査は PR の前にローカルの verify:full で通す。CI に画面検査を足すかは実装時に決める (章 §上流指針 は verify:full への組み込みまでを名指す)。
- Regions/zones/network/trust boundaries: N/A: 配置と信頼境界を変えない。
- DNS/TLS/edge/ingress/egress: N/A: 画面検査は 127.0.0.1 の vite に接続し、外部へ通信しない。

#### Compute and storage

- Runtime/compute/scaling:
  - api のテストは 1 worker の直列で走る。新しい統合テストもこの前提で書き、ファイルの並列に頼らない。
  - CI の timeout は テスト (api) が 20 分、テスト (core・web) が 15 分である。API テストのファイル数や件数が大きく変わったときは、`docs/ci-cd-operations.md` §2.1 の条件で測り直してから timeout と並列度を見直す。timeout を超えたジョブは cancelled になる (§2.2)。
- 問い合わせを数える proxy (O8):
  - D1Database を包み、prepare した文の実行 (first・all・run・raw) を 1 本、batch は中の文の数だけ数える。前例の countingDatabase (import-lifecycle.test.ts:89-131) と同じ数え方で、batch 内の文を 1 本ずつ数える安全側の規則 (`architecture/classify-bulk-save-infrastructure.md` ADR-INF-02) に合わせる。
  - 数える範囲は、ミドルウェア (認証・schema の確認・lease) から書き込みまでの 1 要求の全部である。route の関数だけを数えて 49 本に収まったことにしない。
  - 前例の 2 つの数える関数は export されていない。共通化して import するか、同じ形を写すかは実装時に決める (章 §確定内容 は数えることだけを決める)。
- Database/object/cache/queue:
  - テストの D1 は Miniflare のインメモリで、本番の D1 と R2 に触れない。
  - 画面検査の fixture は script の中に匿名の値で置く。明細仕分けの範囲では、responseFor に `/api/transactions` (rows・total・page・limit) と `/api/transactions/selected` (rows・missing) と勘定科目の対応表の読み出しの枝を足す。fixture の件数は、表示件数の選択とページ送りが描かれる件数 (100 件を超える件数) にする。具体の件数は実装時に決める (章 §確定内容 qa-classify-bulk-maintenance-ops-web-001 が委ねる)。
- Capacity and cost budgets:
  - 費用: 既存の GitHub Actions と無料の道具だけを使う。
  - 初期 JS 予算 110KiB は CI の `pnpm build` で判定する。CI の方がローカルより約 0.5〜0.67KiB 大きく出る (`docs/ci-cd-operations.md` §9「初期JS予算がCIだけで落ちるとき」)。

#### IaC and delivery

- IaC tool/state/locking: N/A: 基盤の定義を変えない。migration の番号と適用は `architecture/classify-bulk-save-infrastructure.md` が持つ。
- CI/CD stages, approvals, provenance:
  - 画面検査の組み込み:
    1. `viewports.mjs` の VIEWPORT_CASES に 1264 の幅を足す。
    2. `check-financial-visuals.mjs` に KANJO_VISUAL_SCOPE=classify の範囲を足し、1264px と 1280px で、一覧の各列が最小幅以上・本体の横はみ出し 0・編集パネルを閉じると一覧が広がることを測る (根拠: 00 O5)。
    3. `packages/web/package.json` に、その範囲を呼ぶ script を既存の check:improvement-screen (:26) と同じ形で足す。script の名前は実装時に決める。
    4. `package.json:40` の verify:full に、その script を足す。
  - 既定のラベルの列 (check-financial-visuals.mjs:16-19) に 1264 を足すと、全画面の範囲 (all) でも 1264 を測るようになり所要が延びる。明細仕分けの範囲だけで 1264 を引くか、既定の列に足すかは実装時に決める (章 §確定内容 qa-classify-bulk-maintenance-ops-web-001 が委ねる)。
  - PR の CI の verify を緑にして merge する。main の必須チェックは verify の 1 本で、ジョブを足すと verify の needs (ci.yml:98) にも足す必要がある。
  - migration の行が失われないことを確かめるテスト (`architecture/classify-bulk-save-infrastructure.md` の手順 3) は、前例 `packages/api/src/improvement-migration-0057.test.ts` と同じく api の src に置き、補助 `packages/api/src/migration-test-support.ts` を使う。ファイル名は migration の番号が決まってから決める。
- Immutable artifacts/config promotion: N/A: 成果物と設定の昇格は既存の Deploy のまま (`architecture/classify-bulk-save-infrastructure.md`)。

#### Secrets and access

- Secret authority/rotation/injection: N/A: テスト・画面検査・CI のジョブに新しい secret を使わない。Actions のログに secret の値を出して調べない (`docs/ci-cd-operations.md` §9)。
- Human/service access and least privilege:
  - 本番のログを見るのは運用者 (利用者と同じ人) で、`wrangler tail` と Cloudflare の画面を使う。
  - ログに明細の内容・金額を出さない既存の規則 (index.ts:152-) を、一括保存の経路でも守る。

#### Reliability and recovery

- SLO/alerts/on-call: N/A: 個人利用のため、SLO・警報・当番を置かない。本番へ届かなかった配信は Deploy の report が Issue で知らせる (`architecture/classify-bulk-save-infrastructure.md`)。
- 一括保存が止まったときの調べ方 (運用の手順):
  1. 画面の通知と応答を見る。明細ごとの失敗 (not_found・invalid_item・split_line_not_supported・no_value) か、保存対象の全件の write_failed か、要求全体の失敗 (400・403・409・413・5xx・通信の失敗) かで分ける (spec「エラー・例外・回復」)。
  2. 応答の opId で、保存した明細の `GET /api/transactions/:txId/history` を読み、source=bulk の行がその opId で残ったかを見る。全件 write_failed なら行は 1 つも無いはずである。
  3. 5xx なら、observability で requestId を検索し、onError の name と at を見る。503 なら schema_guard_blocked の expectedMigration と appliedMigration を見る。
  4. 再現しないときは `pnpm --filter @kanjo/api exec wrangler tail kanjo-console` で次の要求を見る。配信の失敗は `gh run view` に run の id と `--log-failed` を付けて読む (`docs/ci-cd-operations.md` §9)。
  - 今の一括保存は、batch の失敗を catch して write_failed にするだけで、ログを出さない (classify-bulk.ts:195-203)。write_failed のときにログを出すか、何を出すかは spec「可観測性」に従い、実装時に決める (章 §確定内容 はログの新設を決めていない)。
- 勘定科目の対応表の初期 5 行の保守:
  - 初期 5 行は、通信費→通信費・水道・光熱費→水道光熱費・交通費→旅費交通費・交際費→接待交際費・日用品→消耗品費である (根拠: 00 G2 / qa-classify-bulk-decision-049・qa-classify-bulk-decision-050)。
  - 同じ 5 行が 2 つの経路に現れる。既存の持ち主への migration と、版 1 の設定の JSON と旧いバックアップの読み替えである (根拠: 00 O3)。新しい持ち主へ入れる経路は、spec の未決事項 7 が閉じるときに 3 つ目として加わる。値の置き場所は `architecture/classify-bulk-save-backend.md` と `-database.md` に従い、本書は経路どうしが同じ 5 行になることをテストで確かめる。
  - 適用済みの migration の本文を後から直しても、本番の D1 には当たらない (d1_migrations は名前で記録する)。初期 5 行を変えることは本件の範囲に無い。
  - 14 の大項目を初期の行に入れない理由 (科目が割れる・合う科目が無い・振替か意味の無い値・中身を 1 つに決められない) を、テストの名前か記録に残し、後から行を足すときの判断材料にする (根拠: qa-classify-bulk-decision-050)。
- Backup/restore/RPO/RTO/DR: N/A: バックアップと復元の手順は `architecture/classify-bulk-save-infrastructure.md` と `docs/ci-cd-operations.md` §10 が持つ。本書は設定の JSON とバックアップの往復をテストで固定するだけである。

#### Infrastructure verification

- O1〜O9 を固定する層は次のとおりである (根拠: 00 O1〜O9 の measure)。

  | 目標 | core の単体テスト | api の統合テスト | web の DOM テスト | 画面検査・ゲート |
  |---|---|---|---|---|
  | O1 | 値の解決順 (未整理は下書き→提案、確定済みは下書き→今の値)、区分だけの指定、『カテゴリなし』の件数、集計で未分類・説明できない側・手動 | なし | 提案なしの 3 件を指定して保存すると要求に 3 件、通知『選択した3件を保存しました。』、外した行が失敗に数えられない | なし |
  | O2 | なし | なし | 再試行の有無と送る明細、通信の失敗・5xx・409 の『同じ内容で再試行』、400・403・413 で再試行が出ない | なし |
  | O3 | 個人の明細に MF の分類 (60)、事業の明細に対応表の科目 (60)、付かない明細、集計ルールの当たる明細、既存の由来の順位と信頼度 | 対応表の読み出し・追加・削除が利用者ごと、設定の変更履歴、既存の持ち主に初期 5 行 (利用者を作っても消した行が戻らない) | 設定画面の行の足し引き | 設定の JSON とバックアップの往復、版 1 と旧いバックアップが初期 5 行 |
  | O4 | なし | 表示外の明細を選択の読み出しと一括保存で引き直せる、一覧の応答に全件が無い | ページと絞り込みをまたぐ 3 件、選べない行の理由、全選択が 50 件で止まる | なし |
  | O5 | なし | なし | 6 列 (取引先/内容が 2 段)・表示件数の選択・ページ送り | 1264px と 1280px の画面検査 |
  | O6 | なし | 401・403・400 の各上限と重複・『カテゴリなし』の 400・256KB 超の 413・他の利用者の行・履歴 source=bulk | なし | なし |
  | O7 | なし | なし | なし | lint・typecheck・test・skills:test・初期 JS 予算・verify:full が exit 0 |
  | O8 | なし | 50 件・100 件が 49 本以内、batch の失敗で 2xx と全件 write_failed、予算超過で 413 too_many_classify_changes | なし | なし |
  | O9 | なし | 同じ要求を 2 回送っても結果・明細の値・月次集計・履歴の行数が同じ | なし | なし |

- 境界値のテスト (根拠: maintenance-ops.md §適用された設計知識 Clean Code):
  - core: 信頼度 79 と 80 (要確認の閾値)、MF の分類の 60 と既存の MF 中項目の対応表の 70。値は名前付きの定数から読み、テストに数字を直書きしない。
  - api: 選択の 50 件と 51 件、一括の 100 件と 101 件、一括保存の本文の 256KB ちょうどと 256KB を 1 byte 超えたもの。
- 前サイクルの規定を置き換えるテスト (根拠: qa-classify-bulk-prior-cycle-001・qa-classify-bulk-backend-web-007 (2)(3)、いずれも agent の推定で利用者は未確認):
  - AT-08 (`specs/spec-classify-screen.md:1592`、今のテストは classify.dom.test.tsx:566) を 2 つに分ける。検証で 1 件が invalid_item になると 2 件を保存し、その 1 件には理由と直し方を出して再試行を出さないもの。書き込みが失敗すると 3 件とも write_failed になり、再試行は 3 件を送るもの。
  - 検証の段の明細ごとの失敗を確かめる api の it (classify-bulk.integration.test.ts:232・:296) は、新しい二段の扱いでも成り立つので残す。書き込みの失敗の it (:382) は 1 件だけを送るので、検証を通った複数件を送り、保存対象の全件が write_failed になって 1 件も書かれないことを確かめる形に広げる (根拠: 00 O8 / qa-classify-bulk-decision-057)。
  - no_suggestion (spec-classify-screen.md:820) と、提案が無い明細を失敗に数える規定 (:410) を前提にするテストは、保存前に外して失敗に数えない形 (O1) と、サーバの no_value に改める。
  - AT-04 (:1588) の「51 件目は 2 ページ目に出る」は、表示件数 50 のときの確認として残す。
- transactions を読む API テスト 8 本を、rows か選択の読み出しを読む形へ移す。8 本は次のとおりで、どれも `.transactions` を読んでいる。
  - `packages/api/src/split-lifecycle.test.ts`・`import-diff.test.ts`・`cash-lifecycle.test.ts`・`vendor-memory.test.ts`・`row-transfer-lifecycle.test.ts`・`classify-transactions-shape.test.ts`・`classify-list-paging.integration.test.ts`
  - `packages/api/test/total-cashflow-verdict.integration.test.ts`
- 旧実装で落ちることの確認: 新しいテストは確定の前に HEAD a63d35c の実装に当て、落ちたことを記録する。O8 は 50 件で 49 本を超えること (旧実装は 50 件で 200 本を超える)、O4 は一覧の応答に全件があること、O5 は 1264px の範囲が無いことで落ちる。
- 記録: 画面検査の結果 (測った幅・列の最小幅・はみ出し) と、置き換えた前サイクルの規定の一覧を `docs/classify-screen/` に残す。既存の `docs/classify-screen/design-decisions.md` に足すか新しいファイルに分けるかは実装時に決める (前例は `docs/improvement-screen/evidence.md`)。

## Architecture decisions

| ADR | Decision | Alternatives | Trade-on rationale | Consequences |
|---|---|---|---|---|
| ADR-MO-01 | O1〜O9 を core・api・DOM・画面検査の 4 層で、測り方に書かれた層に固定する (根拠: qa-classify-bulk-maintenance-ops-web-001 / 00 O1〜O9) | DOM テストだけで確かめる | 規則の違反を最も小さい単位で見つけ、見た目の回帰は実描画で捕まえる | 1 つの目標が複数のテストに分かれるので、Infrastructure verification の表で対応を保つ |
| ADR-MO-02 | 既存の画面検査の script に KANJO_VISUAL_SCOPE=classify と 1264px を足し、verify:full に組み込む (根拠: maintenance-ops.md §上流指針 operations / 00 O5) | 新しい E2E の枠組みを入れる。DOM テストで幅を測る | jsdom は幅を描かないので単体テストでは崩れを捕まえられない。既存の範囲と同じ形で保守できる | 画面検査はローカルだけで走り、CI では止まらない (Risks) |
| ADR-MO-03 | 問い合わせは D1Database を包む proxy で数え、batch 内の文も 1 本ずつ数える (根拠: 00 O8 / qa-classify-bulk-infrastructure-web-evidence-002) | route の中で手で数える。batch を 1 本として数える | 認証から書き込みまでの全部を、本番と同じ数え方で測れる | 前例の数える関数が export されておらず、共通化か複製を選ぶ |
| ADR-MO-04 | 閾値と上限を名前付き定数に置き、境界の両側をテストで固定する (根拠: maintenance-ops.md §適用された設計知識 Clean Code) | 代表値だけを確かめる | 境界を 1 つずらす回帰を確実に落とせる | テストが定数を import するので、定数の置き場所の変更がテストにも及ぶ |
| ADR-MO-05 | 前サイクルの仕様は書き換えず、置き換える規定とテストを今回の文書と記録で宣言し、AT-08 を 2 つに分ける (根拠: qa-classify-bulk-prior-cycle-001、agent の推定で利用者は未確認) | 前サイクルの仕様を直接直す | 前サイクルの承認の記録を残したまま、どの規定がどの決定で変わったかを辿れる | 置き換えの一覧を `docs/classify-screen/` で保守する |
| ADR-MO-06 | 新しい監視を足さず、既存のログ・取引の履歴の opId・requestId で辿る (根拠: maintenance-ops.md §確定内容 / 前サイクルの Non-goals) | 一括保存の専用の運用信号と警報を足す | 個人利用で当番がいない。既存の手順書 (§9) で辿れる | write_failed のときのログの有無は spec「可観測性」と実装に委ねる |

## Delivery, migration and rollback

- Build/deploy topology: PR の CI (verify) → main → Deploy の既存の流れのまま。migration の判定と適用、Worker の配信は `architecture/classify-bulk-save-infrastructure.md` が持つ。
- Migration sequence (テストと記録の順):
  1. core の単体テスト (O1・O3 と境界値) を書き、旧実装で落ちることを確かめる。
  2. api の統合テスト (O3・O4・O6・O8・O9) と、問い合わせを数える proxy を書き、旧実装で落ちることを確かめる。
  3. 8 本の API テストを rows か選択の読み出しを読む形へ移し、書き込みの失敗の it (:382) を複数件へ広げる。
  4. web の DOM テスト (O1・O2・O4・O5・O3 の設定画面) を書き、AT-08 を 2 つに分ける。
  5. 画面検査に明細仕分けの範囲と 1264 の幅を足し、web の script と verify:full に組み込む。
  6. 実装を入れて全てを緑にし、ローカルで vite 4175 を起動して `pnpm verify:full` を通す。
  7. 画面検査の結果と置き換えの一覧を `docs/classify-screen/` に残し、PR の CI を緑にして merge する。
- Rollback trigger/procedure:
  - CI が赤なら merge しない。テストを緑にするために上限や件数の期待値を緩めない。
  - 配信の後に一括保存が spec と違う結果を返したときは、上の「一括保存が止まったときの調べ方」で原因を分け、戻す手順は `architecture/classify-bulk-save-infrastructure.md` と `docs/ci-cd-operations.md` §10 に従う。
  - 戻した後は、戻した版で落ちるテストを足してから直し直す。

## Risks and verification

- Risk/assumption: 画面検査は CI で走らない。ローカルで verify:full を通さずに PR を出すと、1264px の崩れが CI を素通りする。章の上流指針は「CI で止める」と書くが、現物の CI は verify:full を走らせない (code_findings)。
- Risk/assumption: verify:full は vite 4175 が動いていないと、画面検査が接続できずに落ちる。起動の前提を手順に書く。
- Risk/assumption: 問い合わせを数える範囲を route だけに絞ると、認証・schema の確認・lease の本数が漏れ、49 本に収まったように見える。1 要求の全部を数える。
- Risk/assumption: 8 本の移行と前サイクルの規定の置き換えは agent の推定で、利用者は未確認である (qa-classify-bulk-backend-web-007・qa-classify-bulk-prior-cycle-001)。移す途中で別の意味の食い違いが見つかったら、spec の決定に戻って問い直す。
- Risk/assumption: API テストが増えると テスト (api) の 20 分に近づく。cancelled は timeout 超過でも付くので、まず同じ commit で再実行し、続くなら `docs/ci-cd-operations.md` §2.1 の条件で測り直す。
- Risk/assumption: 初期 JS 予算は CI の方が大きく出る。ローカルで上限ぎりぎりを通しても CI で赤になりうる。
- Architecture fitness test:
  - O1〜O9 のそれぞれに、Infrastructure verification の表の層のテストが 1 本以上あること。
  - 新しいテストが旧実装で落ちた記録があり、件数を固定する検査の対象が 0 件でないこと。
  - verify:full に明細仕分けの画面検査が含まれ、VIEWPORT_CASES に 1264 があること。
  - 一覧の応答の全件 transactions を読むテストが残っていないこと。
- Load/failure/security validation:
  - 50 件と 100 件の一括保存が 49 本以内で、batch の失敗で全件 write_failed、予算の超過で 413 になること (00 O8)。
  - 同じ要求の 2 回目で、明細の値・月次集計・履歴の行数が変わらないこと (00 O9)。
  - 他の利用者の行の key・txId・対応表の行が見つからない扱いになること (00 O6)。
  - lint・typecheck・test・skills:test・初期 JS 予算・verify:full が全て exit 0 であること (00 O7)。
