---
graph_node_id: "tasks-attachments-transit"
artifact_kind: "task"
title: "レシート添付と交通費の記帳 — タスク分解"
project_id: "kanjo"
domain: "accounting-records"
status: "complete"
file_path: "tasks/attachments-and-transit-tasks.md"
parent_feature: "spec-attachments-transit"
template_id: "task"
template_version: "1.0.1"
---

# タスク分解

`specs/attachments-and-transit.md` を実装単位に割ったもの。上から順に依存する。

## T01 スキーマ — `attachments` 表と `cash_entries` の交通費列

- 変更: `migrations/0010_attachments_transit.sql`, `packages/api/src/db/schema.ts`
- 受入: マイグレーション適用後に `attachments` が存在し、`cash_entries` に 4 列が増えている。
        既存行の `transit_round`/`receipt_waived` が 0 で埋まる。
- 依存: なし

## T02 コア — 添付の検証ロジック(純関数)

- 変更: `packages/core/src/attachments.ts`, `packages/core/src/index.ts`
- 内容: 許可 MIME 判定・サイズ上限・件数上限・ファイル名の無害化・R2 キー生成・拡張子解決。
- 受入: 不正入力それぞれに日本語の理由が返る。パス区切り・制御文字がファイル名から除去される。
- 依存: なし

## T03 コア — 交通費の組み立て(純関数)

- 変更: `packages/core/src/cash.ts`
- 内容: `CashEntry` に `transitFrom`/`transitTo`/`transitRound`/`receiptWaived` を追加。
        区間と片道金額から金額・内容文を作る `buildTransitEntry`、証憑状態を出す `receiptStatus`。
- 受入: 往復で金額が 2 倍、内容が `電車代 A→B(往復)`。片道は `(片道)`。
- 依存: T01

## T03A 横断契約 — 添付identity/lifecycle/archive

- 変更: `migrations/0011_attachment_lifecycle.sql`, core型, API共通helper, 本仕様
- 内容: `AttachmentTarget(kind+key)`、MFの`identity_stable`、`ready/delete_pending/delete_failed`、親更新とのmutation fence、
        単一snapshotの`attachmentArchive(inventory-only)`を上流契約として確定する。
- 受入: 競合・R2失敗・名前空間衝突で対象keyを失わず、archiveをrestore-capableと誤表示しない。
- 依存: T01, T02, T03

## T04 API — 添付エンドポイント

- 変更: `packages/api/src/routes/attachments.ts`, `packages/api/src/index.ts`
- 内容: GET 一覧 / POST 登録 / GET 原本 / DELETE。R2 put成功後のD1 insert失敗を補償削除。
- 受入: 仕様の受入条件のうち API に属するものすべて。未認証で 401。
- 依存: T03A

## T05 API — 現金の記帳への統合

- 変更: `packages/api/src/routes/cash.ts`, `packages/api/src/store.ts`
- 内容: 交通費列の受け取りと検証、`attachmentCount` の同梱、削除時の添付カスケード(R2 込み)。
- 受入: 記帳削除で D1 行と R2 原本が両方消える。
- 依存: T03A, T04

## T06 API — 取込明細への統合

- 変更: `packages/api/src/routes/classify.ts`
- 内容: `/transactions` の各行に `attachmentCount` と `idStable` を付ける。
- 受入: 添付済み明細のみ 1 以上になる。安定ID行は再取込後も維持され、合成ID行は添付不可になる。
- 依存: T03A, T04

## T07 画面 — 添付パネル(共通コンポーネント)

- 変更: `packages/web/src/components/Attachments.tsx`, `packages/web/src/api.ts`, `styles.css`
- 内容: カメラ・ファイル選択・ドロップ・貼り付けの4経路、一覧、閲覧、削除。
- 受入: モバイル幅で撮影ボタンが出る。PC でドロップと貼り付けが動く。
- 依存: T04

## T08 画面 — 現金の記帳(交通費タブ + 証憑列)

- 変更: `packages/web/src/pages/Cash.tsx`
- 受入: 交通費タブから記帳でき、証憑列が 3 状態を出し分ける。
- 依存: T05, T07

## T09 画面 — 公私仕分け(証憑列)

- 変更: `packages/web/src/pages/Classify.tsx`
- 受入: 安定IDの取込明細から添付でき、合成IDは理由付きで添付不可となる。
- 依存: T06, T07

## T10 単一snapshotの添付archive

- 変更: `packages/api/src/store.ts`
- 内容: `BACKUP_SNAPSHOT_SQL`のsource集合に添付を加え、`attachmentArchive`として出力する。
- 受入: 同一statement snapshotから出力され、`restoreCapable=false`、旧`attachments`項目なし。
- 依存: T03A

## T11 テスト

- 変更: `packages/api/src/attachments-lifecycle.test.ts`,
        `packages/api/src/import-lifecycle-pure.test.ts`, `packages/api/src/import-lifecycle.test.ts`,
        `packages/api/src/import-pipeline.test.ts`,
        `packages/core/test/attachments-contract.test.ts`, `packages/core/test/cash-contract.test.ts`,
        `packages/core/test/parsers.test.ts`, `packages/web/src/attachments-cash-regression.test.ts`
- 受入: happy pathに加え、R2削除失敗と再試行、並行上限、予約ID衝突、単一snapshot archive、
        複数panel paste、部分成功再同期をtraceする。加えて安定ID付きMF CSVの実取込→添付→
        同IDの変更再取込で件数/原本が維持されること、R2削除成功後の親D1 batch失敗で
        親/pending添付/旧集計が残って再試行で収束すること、親削除とmonthly_agg入れ替えが
        単一D1 batchに含まれることをfailure injectionで固定する。正規化差分は行数非依存の
        `json_each` 1 UPDATEとし、添付10件+多数差分でも1 requestのD1 query ledgerが49以下であること、
        不正/過大JSON bulk payloadをR2操作前にfail-fastすることを固定する。
        `pnpm test` / `pnpm typecheck` / `pnpm run build` が通る。
- 依存: T01〜T10

## T12 用語辞書・文言

- 変更: `packages/web/src/glossary.ts`(必要な場合), `docs/product/backlog.md`
- 内容: backlog から実装済み行を消す。
- 依存: T08, T09

## T13 原本fact・durable cleanup・保持

- 変更: `migrations/0012_attachment_recovery.sql`, `migrations/0013_attachment_object_tombstones.sql`,
        `packages/api/src/attachment-availability.ts`, `packages/api/src/attachment-recovery.ts`,
        `packages/api/src/routes/attachments.ts`, `packages/api/src/index.ts`, core設定。
- 内容: `object_deleted_at`をR2 DELETE成功の単調なD1 fact、応答時exact-key R2 HEADをwire可用性の
        正本として分離し、PUT前intent、DELETE共通processor、scheduledの有界backoff/dead-letter、
        quota・magic signature・retentionを一つのlifecycleへ統合する。
- 受入: routeの二重障害でもkeyがledgerに残り、件数/link/文言が原本factと一致する。
- 依存: T03A, T04

## T14 MF孤児・archive safe recovery

- 変更: import commit builder、添付route、Settings/共通添付UI。
- 内容: 親なしstable IDの可視化と再出現復帰、同一bucket exact-keyのsize/hash照合、
        一致metadataだけの再結合、欠損・不一致reportを実装する。
- 受入: 原本なしを成功扱いせず、孤児を管理画面から閲覧・削除できる。
- 依存: T10, T13

## T15 実DOM・route境界受入

- 変更: `packages/web/src/components/Attachments.dom.test.tsx`,
        `packages/api/src/attachments-lifecycle.test.ts`。
- 内容: source文字列試験を補助へ降格し、file/drop/paste/部分成功/invalidation/badge/open/delete/
        capture属性をDOM操作、過大multipart・二重障害・quota・signature・孤児・recoveryをMiniflare routeで検証する。
- 受入: AC-ATT-01〜11の自動化可能部分が実行結果でPASS。物理カメラ起動は実機手動項目として残す。
- 依存: T13, T14

## T16 preview readiness・SSOT・証拠台帳

- 変更: `scripts/preview-local.mjs`, `scripts/preview-smoke.mjs`, `package.json`, README、仕様3文書、本書。
- 内容: local migration→build→有限Workers smokeを架空認証・一時stateだけで行い、仕様の所有者を
        製品不変条件／feature lifecycle／永続形状へ分け、受入証拠を本書へ集約する。
- 受入: `pnpm run preview:smoke`が自動停止し、以下の台帳が全PASSになる。
- 依存: T15

## T17 password login防御

- 変更: `migrations/0014_password_login_rate_limits.sql`, `packages/api/src/login-rate-limit.ts`,
        `packages/api/src/login-rate-limit.test.ts`, 認証route・nightly scheduled・SSOT。
- 内容: Access未設定時のpassword loginを、raw IP/passwordを残さないD1 atomic throttleで保護する。
- 受入: 5回目429、scope分離、成功clear、期限回復、並行失敗、Access非干渉、有界cleanup、query予算を実routeで固定する。
- 依存: 0014 local migration readiness, 既存認証route, 既存scheduled

# 受入証拠台帳

実テスト名と実行結果だけを記録する。`.dev-graph/state`はworkflowの派生cacheであり、feature完了の
第二の正本にはしない。タスク依存と受入結果は本書、詳細契約はfeature仕様を正とする。

| 受入ID | exact test file + exact `it/test` title | 実行コマンド | fresh result |
|---|---|---|---|
| AC-ATT-01 | `packages/api/src/attachments-lifecycle.test.ts` — `現金の記帳に添付して一覧・原本取得・削除まで往復する`<br>`packages/web/src/components/Attachments.dom.test.tsx` — `badgeは0/1/2件を未添付・添付あり 1・添付あり 2としてexact表示する` | `pnpm test` | PASS（最終差分で2回連続、各317/317） |
| AC-ATT-02 | `packages/api/src/attachments-lifecycle.test.ts` — `MF orphan一覧もexact R2 HEADで帯域外欠損をoriginal_missingとし、R2再出現で復帰する`<br>`packages/web/src/components/Attachments.dom.test.tsx` — `keeps MF orphan evidence visible and only links originals that still exist` | `pnpm test` | PASS（最終差分2/2） |
| AC-ATT-03 | `packages/api/src/attachments-lifecycle.test.ts` — `ID列がないMF明細は再取込で同一性を保証できないため新規添付を拒否する` | `pnpm test` | PASS（最終差分2/2） |
| AC-ATT-04 | `packages/api/src/attachments-lifecycle.test.ts` — `POST成功responseもD1確定後のexact HEADを正本とし、帯域外欠損をoriginal_missingで返す`<br>`packages/api/src/attachments-lifecycle.test.ts` — `POSTのcommit後HEAD障害はstaleなoriginalAvailableを返さず503にし、再送をduplicateへ安全収束させる`<br>`packages/api/src/attachments-lifecycle.test.ts` — `一覧はD1がreadyでもR2原本が帯域外削除されるとoriginal_missingへfail closedし、再出現で復帰する`<br>`packages/api/src/attachments-lifecycle.test.ts` — `cash/classifyの添付件数はexact R2 HEADだけを数え、原本復元後に再び1へ戻る`<br>`packages/api/src/attachments-lifecycle.test.ts` — `R2 HEAD障害はmissingに偽装せずlist/orphan/content/cash/classifyを同じ503でfail closedする`<br>`packages/api/src/attachments-lifecycle.test.ts` — `R2削除成功後のD1 cleanup失敗は専用メッセージを返し、削除fact後の同key再出現を復活表示せず再削除する`<br>`packages/web/src/components/Attachments.dom.test.tsx` — `originalAvailable wire欠落はready stateでもfail closedしてopen/copyを出さない`<br>`packages/web/src/components/Attachments.dom.test.tsx` — `out-of-band missingではlink/open/copyを隠し、R2原本が再出現すると自然に再表示する` | `pnpm test` | PASS（API 134/134 + Web 51/51を2回連続） |
| AC-ATT-05 | `packages/api/src/attachments-lifecycle.test.ts` — `8MiBを1バイト超えるmultipartを実routeで400にする`<br>`packages/api/src/attachments-lifecycle.test.ts` — `申告MIMEと拡張子が正しくてもmagicが違うファイルを拒否する`<br>`packages/core/test/attachments-contract.test.ts` — `JPEG/PNG/WebP/PDF/HEIC/HEIFをmagic signatureで判別する` | `pnpm test` | PASS（Core 105/105 + API 134/134を2回連続） |
| AC-ATT-06 | `packages/api/src/attachments-lifecycle.test.ts` — `設定可能な利用者別bytes quotaをwriter lease内で判定し、使用量を返す`<br>`packages/web/src/components/Attachments.dom.test.tsx` — `shows quota exhaustion and prevents new file selection without hiding existing evidence` | `pnpm test` | PASS（2/2） |
| AC-ATT-07 | `packages/api/src/attachments-lifecycle.test.ts` — `POSTのD1 commit失敗と補償R2 DELETE失敗でもkeyを保持し、補償完了後に永久tombstoneを残さない`<br>`packages/api/src/attachments-lifecycle.test.ts` — `R2削除成功後のD1 cleanup失敗は専用メッセージを返し、削除fact後の同key再出現を復活表示せず再削除する`<br>`packages/api/src/attachments-lifecycle.test.ts` — `scheduled cleanupは10件bounded・43 queries以下で、grace経過+max attemptsだけdead-letter化する` | `pnpm test` | PASS（2/2） |
| AC-ATT-08 | `packages/api/src/attachments-lifecycle.test.ts` — `区間と往復を保存し、金額は集計にも反映される`<br>`packages/core/test/attachments-contract.test.ts` — `往復は片道運賃の2倍で、内容に区間と往復/片道を残す` | `pnpm test` | PASS（2/2） |
| AC-ATT-09 | `packages/api/src/attachments-lifecycle.test.ts` — `通常記帳で証憑不要だけを指定する入力を400で拒否する`<br>`packages/core/test/attachments-contract.test.ts` — `添付があれば attached、無ければ waived の有無で分かれる` | `pnpm test` | PASS（2/2） |
| AC-ATT-10 | `packages/api/src/attachments-lifecycle.test.ts` — `archiveの一致原本だけ部分復元し、欠損・他owner・hash/size不一致は成功扱いにしない`<br>`packages/api/src/attachments-lifecycle.test.ts` — `archive recoverは実byte検証後にscheduled tombstoneが確定してもready metadataを挿入しない`<br>`packages/web/src/components/Attachments.dom.test.tsx` — `partially recovers only valid metadata and reports missing, mismatch, and skipped as unsuccessful` | `pnpm test` | PASS（2/2） |
| AC-ATT-11 | `packages/web/src/components/Attachments.dom.test.tsx` — `通常file pickerとcamera inputのchangeからtarget/file入りFormDataを実POSTする`<br>`packages/web/src/components/Attachments.dom.test.tsx` — `accepts a drop, keeps partial successes, and invalidates both panel and parent queries`<br>`packages/web/src/components/Attachments.dom.test.tsx` — `commit済みPOSTのHEAD障害は再送失敗にせず成功件数と状態確認警告を同時表示する`<br>`packages/web/src/components/Attachments.dom.test.tsx` — `routes a page paste only to the currently open target`<br>`packages/web/src/components/Attachments.dom.test.tsx` — `derives open links, copy, and actions from original availability and cleanup stage`<br>`packages/web/src/components/Attachments.dom.test.tsx` — `ready行の通常deleteはconfirm後にDELETEし、一覧と親badgeをinvalidateして空一覧を再取得する` | `pnpm --filter @kanjo/web test` | PASS（Web 51/51を2回連続。物理カメラ起動だけ実機手動） |
| AC-ATT-12 | `scripts/preview-smoke.test.mjs` — `一時local D1/R2でmigrationから現金記帳・証憑の登録/閲覧/削除まで有限に往復する` | `pnpm run preview:smoke` | PASS（1/1、全15 migration、約31.6秒で自動停止） |

## 認証・資源予算の証拠

| exact test file + exact `it/test` title | 実行コマンド | fresh result |
|---|---|---|
| `packages/api/src/login-rate-limit.test.ts` — `同scopeの5回目の失敗を429にしRetry-Afterを返す`<br>`別scopeは独立し、成功時にそのscopeの失敗履歴だけをclearする`<br>`windowとlockの期限後は同じscopeで再試行できる`<br>`並行失敗もatomicに上限へ収束し、raw IP/passwordをDBとログへ露出しない`<br>`Cloudflare Access modeはpassword throttleへ触れず既存契約を維持する`<br>`stale cleanupは100件を1 queryにboundedし、scheduled総D1 worst-caseを44で固定する`<br>`password loginは成功・失敗とも1 request最大2 D1 queryに収める` | `pnpm --filter @kanjo/api test` | PASS（7/7、root API 134/134を2回連続） |

# 全体品質ゲート（2026-08-27 JST）

| ゲート | 結果 |
|---|---|
| `pnpm test` | PASS（最終差分で2回連続。各 Core 105 + API 134 + Web 51 + Skill 27 = 317） |
| `pnpm typecheck` | PASS（3 workspace） |
| `pnpm lint` | PASS（Biome 126 files + Skill sync + 用語27語） |
| `pnpm build` | PASS（Vite 133 modules + Wrangler dry-run） |
| `pnpm audit --prod` | PASS（known vulnerabilities 0） |
| `pnpm run preview:smoke` | PASS（1/1。全15 migration + SPA/auth + cash/添付upload/list/count/content/delete、空きport・一時state・架空認証、外部変更なし） |
| `git diff --check` | PASS |
| `bash aidd-agent-kit/verify-codex-layout.sh` | PASS（path/hash一致） |
| `./aidd-agent-kit/doctor-codex-layout.sh` | PASS（read-only診断。既知のuser-scope重複warning 33、error 0、project scope正本） |
| `launch-security`最終監査 | PASS（Critical/High 0。production dependency 0 vulnerabilities、secret/XSS/sensitive-log差分なし） |

`bash aidd-agent-kit/sync-project-mac.command --check`は有効なread-only optionではなく、引数を同期処理へ
渡すため実行していない。layout evidenceには実在するread-onlyの`verify-codex-layout.sh`と
`doctor-codex-layout.sh`だけを使用した。

実機のOSカメラUI起動は自動化対象外。`accept="image/*"` / `capture="environment"`
のDOM契約と通常file取込後の後続動作は自動試験済みで、公開前の実機手動確認だけを運用項目とする。
