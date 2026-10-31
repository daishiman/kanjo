---
graph_node_id: "spec-classify-bulk-save"
artifact_kind: "specification"
artifact_subtypes: ["frontend", "api", "data"]
title: "明細仕分け一括保存 — 選んだ明細を提案・ページ・絞り込みに左右されず、保存前の内訳で確かめて 1 回の batch で確定する"
project_id: "kanjo"
domain: "classify"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: []
tags: ["classify", "bulk-save", "frontend", "api", "data"]
file_path: "specs/spec-classify-bulk-save.md"
template_id: "specification"
template_version: "1.0.0"
source_image: "design/FINAL-UI/images/13-classify.png"
route: "/classify"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluator": "system-spec-harness:assign-system-spec-completeness-evaluator", "evidence_ref": "system-spec/completeness-findings.json", "evaluated_digest": "f0b0a1a8b288f5a152a1b1f2a4c3701b128753ccef2a2fc5c6c248b6c5e851b0"}
source_lineage: {"origin_kind": "system-spec-harness", "source_plugin": "system-spec-harness", "source_path": "system-spec/00-requirements-definition.md", "source_version": "0.1.16", "source_digest": "f0b0a1a8b288f5a152a1b1f2a4c3701b128753ccef2a2fc5c6c248b6c5e851b0", "imported_at": "2026-10-01T12:13:05Z"}
created_at: "2026-10-01T12:13:05Z"
updated_at: "2026-10-01T12:13:05Z"
depends_on: []
related_nodes: ["arch-classify-bulk-save-ui-ux", "arch-classify-bulk-save-frontend", "arch-classify-bulk-save-backend", "arch-classify-bulk-save-database", "arch-classify-bulk-save-auth", "arch-classify-bulk-save-security", "arch-classify-bulk-save-infrastructure", "arch-classify-bulk-save-maintenance-ops"]
resource_scope: ["packages/api/src/routes/classify-bulk.ts", "packages/api/src/routes/classify.ts", "packages/api/src/routes/settings.ts", "packages/api/src/routes/settings-screen.ts", "packages/api/src/index.ts", "packages/api/src/store.ts", "packages/api/src/classify-history.ts", "packages/api/src/classify-row.ts", "packages/api/src/schema-guard.ts", "packages/api/src/db/schema.ts", "packages/api/src/import-lifecycle.ts", "packages/api/src/scheduled-maintenance-budget.ts", "packages/core/src/classify-status.ts", "packages/core/src/categories.ts", "packages/core/src/overview.ts", "packages/core/src/settings-json.ts", "packages/core/src/settings-screen.ts", "packages/core/src/tax-accounts.ts", "packages/core/src/classify.ts", "packages/core/src/cash.ts", "packages/web/src/pages/classify/ClassifyPage.tsx", "packages/web/src/pages/classify/BulkActionBar.tsx", "packages/web/src/pages/classify/TransactionTable.tsx", "packages/web/src/pages/classify/view-model.ts", "packages/web/src/pages/settings/", "packages/web/src/api-client.ts", "packages/web/scripts/check-financial-visuals.mjs", "packages/web/scripts/viewports.mjs", "migrations/", "migrations/0058_tax_account_map.sql", "migrations/0059_settings_change_log_target.sql", "packages/api/src/routes/tax-account-map.ts", "packages/api/src/d1-limits.ts", ".github/migration-approvals.json", "docs/classify-screen/", "packages/api/src/canonical-mutation-fence.ts", "packages/api/src/import-active.ts"]
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
classification_reason: "13-classify.png と system-spec (00・8 章) から、明細仕分け画面の一括保存・選択の読み出し・取引一覧・勘定科目の対応表を定めた機能仕様であり、実装 (web / core / api / migration) が参照する正本。"
classification_candidates: [{"artifact_kind": "specification", "candidate_path": "specs/spec-classify-bulk-save.md", "confidence": 1.0}]
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
# 目的と成功状態

明細仕分け画面 (/classify) で選んだ明細を、提案の有無・表示中のページ・絞り込みに左右されずに、何がどの値で保存されるかを確かめたうえで一括で確定できるようにする仕様。取込直後で取引先の記憶もルールも無い利用者でも未整理を月次クローズまで減らせるようにし、『選んだのに保存できない』『再試行を押しても何も起きない』『一覧が崩れて読めない』ことで仕分けが止まるのを無くす (根拠: 00 U1)。元の指摘は「この選択した項目の読み込み、取引一覧の取引設定がうまいことできていないようです。確認してください。」で、正本の画像は `design/FINAL-UI/images/13-classify.png` である (根拠: 00 U2 / qa-classify-bulk-request-001)。本書の行番号・関数名・定数は、2026-10-01 に commit a63d35c の現物を開いて確かめた値である。

**上位概念**: `system-spec/00-requirements-definition.md` (承認 appr-foundation-classify-bulk-006)。利用者は U1〜U9 の今の全文を 6 つの区分に分け、2 回の提示で承認し直した。第 1 回は提示 2026-10-01T09:02:00.408Z・受領 09:12:13.849Z で、『土台・値の決め方』を qa-classify-bulk-decision-068、『土台・失敗と内訳』を -069、『土台・提案と対応表』を -070 として承認した。第 2 回は提示 09:26:38.058Z・受領 09:28:56.562Z で、『土台・選択と認可』を -072、『土台・目的と背景』を -073、『土台・一覧と制約』を -074 として承認した。6 問で U1〜U9 の全 54 項目を覆う。章ごとの制約は `architecture/classify-bulk-save-*.md` の 8 文書が持つ (根拠: 00 §確定の接地根拠)。

**system-spec の評価との関係**: 完成度評価 (`system-spec/completeness-findings.json`) は 11 周目で総合 PASS (gaps 0) を返した。6 観点 (foundation_trace / decision_guidance / matrix_coverage / design_knowledge_reflection / doc_freshness / prompt_quality) はすべて PASS で、検出は high 0・medium 2・low 7・info 31、評価時の digest は sha256 3859d23ee95b5af86b4274dea7eeb90c3f7bdf84076736b327e3d305f8a14599 である。ヒアリング監査 (C06) と収集マトリクス監査 (C07) も PASS で、評価の後に章も spec-state も変えていない。waiver は使っていない。残った medium と low・info は「未決事項」で扱う。

**前サイクルとの関係**: 前サイクルの `specs/spec-classify-screen.md` は画像 13 の再現を目的とし、画面骨格・KPI・絞り込み・編集パネル・分割・ルール・下書き・通知を定めた。本書はその文言・API・保存を正本のまま引き継ぎ、次の 6 点だけを変える。前サイクルと本書が食い違う箇所は本書を優先し、前の文書は書き換えない (根拠: backend.md §確定内容 / qa-classify-bulk-prior-cycle-001)。

1. 引き継ぐもの: 画面骨格 (§7.1)・期間と見出し (§7.2)・KPI 4 枚 (§7.3)・絞り込み (§7.4)・編集パネル (§7.6)・分割 (§7.9)・ルール適用 (§7.10)・下書き (§7.11)、`PUT /api/transactions/:txId/edit` と履歴 API、一括 100 件と URL の sel 50 件の上限、要確認の閾値 80 と既存の由来の順位・信頼度。「エラー・例外・回復」の回復の原則のうち「利用者の入力は、保存に成功するまで端末から消さない」(:1508 の後半) も変えない。
2. 値の決め方: §7.8 の「提案が無く、下書きも無い明細は、送らずに『提案が無いため保存できません』として失敗に数える」(:410) と一括保存 API の `no_suggestion` (:820) を、一括指定欄・保存前の内訳 (O1 で外す)・`no_value` に置き換える。
3. 書き込みの単位: S3 (:79)・UC-3 (:158)・FR-09 (:212)・一括保存 API の「成功分は、後続の明細が失敗しても取り消さない」(:830)・回復の原則の前半 (:1508) を、書き込みの段は全件か無し (1 回の batch) に置き換える。
4. 再試行: FR-10 (:213)・§7.7 の部分失敗の通知 (:388)・AT-08 (:1592) を、write_failed の明細だけの再試行と、要求全体の失敗に対する『同じ内容で再試行』に置き換える。AT-08 は明細の再試行と要求全体の再試行の 2 つに分ける。
5. 一覧: FR-05 (:208)・§7.5 の「表示件数 50件 (固定表示)」(:344)・性能の C5 (:229)・`limit` の「50 だけを受ける」(:607)・AT-04 (:1588) を、6 列 (取引先/内容の 2 段)・表示件数 25 / 50 / 100 件に置き換える。AT-04 の「51 件目は 2 ページ目に出る」は表示件数 50 のときの確認として残す。
6. 一覧 API の互換: 「`GET /api/transactions` は既存の項目の意味を変えない」(:1545) を、応答から `transactions` を外す変更に置き換える。提案には「MF の分類」を最後の由来として足す (前サイクルの由来の順位と信頼度はそのまま)。

**根拠の表記** (各項目の末尾に `(根拠: …)` で付ける):

- `00 G1` などは要件定義書 (上位概念) の項目。`backend.md §確定内容` などは各章の「確定内容 (質疑録)」、`§上流指針` は各章の「上流指針 (doctrine anchors)」。
- `qa-classify-bulk-decision-NNN`: 利用者が代替案を見て選んだ決定。068〜074 は土台の承認。
- `qa-classify-bulk-delegated-NNN`: 利用者が agent に委ね (decision-033 など)、agent が選んだ案。
- `qa-classify-bulk-backend-web-009` のように章の名前と web を含む id: 利用者の決定の下で agent が章に置いた具体値。利用者は個々の値を選んでいない。細部を agent の案で決めることは decision-058 で承認された。「訂正」と書いたものは、その qa に後から付いた訂正を指す。
- `…-evidence-NNN`: 章に記録された観測事実。`path:行` は本書の作成時に a63d35c で確かめた現物。

利用者価値 (U1・SH1): 月次クローズの前に、取込んだ数百件の未整理を区分・カテゴリ・所有者をまとめて指定して一度に確定でき、何がどの値で保存されるかを保存前に確かめ、失敗したらその分だけ確実にやり直せる。家族名義の明細が誤った所有者や区分にされないことを確かめられる (SH2)。

成功状態 (00 U4・U5):

- O1: 提案の無い明細を一括指定で保存できる。提案なしの 3 件を選び区分とカテゴリを指定して保存すると、要求に 3 件が入り、通知『選択した3件を保存しました。』が出る。埋める値が無い行と確定済みで変わる値が無い行は要求に入らず、外す件数と理由が出て、失敗に数えない。
- O2: 失敗の種類ごとに再試行の有無と理由が正しく出る (write_failed の 1 件の再試行でその 1 件だけが送られる。通信の失敗・5xx・409 の後にだけ『同じ内容で再試行』が出る)。
- O3: 取込直後でも提案が付く (個人は『MF の分類』、事業は『MF の分類 (対応表)』、どちらも信頼度 60)。勘定科目の対応表が利用者ごとに読み書きでき、初期の 5 行を持つ。
- O4: 選択がページと絞り込みをまたいで保たれ、サーバが値を解決する。一覧の応答に絞り込み後の全件が含まれない。
- O5: 1264px と 1280px で取引一覧が崩れない。
- O6: 選択の読み出し・一括保存・勘定科目の対応表の API が認可と入力検証を通る。
- O7: pnpm lint・typecheck・test・skills:test・初期 JS 予算・verify:full が全て exit 0。
- O8: 一括保存の 1 要求が D1 クエリ 49 本以内に収まる。
- O9: 同じ要求を送り直しても二重に保存されない。

## スコープ

- In (00 U7 対象):
  - 一括操作バーの一括指定欄 (区分・カテゴリ大/中・所有者・支払い方法) と、保存前の内訳 (保存する件数と値の出所、そのうち『カテゴリなし』で保存する件数、外す件数と理由) (根拠: 00 I1 / qa-classify-bulk-decision-041・048)。
  - `POST /api/transactions/bulk` の拡張: 一括指定と各明細の下書きを受け、サーバが明細を引き直し、core の解決関数で値を決め、json_each で束ねた 1 回の batch で書く (根拠: 00 I2 / qa-classify-bulk-decision-068 / delegated-001)。
  - 選択の読み出し `GET /api/transactions/selected` の新設と、一覧の応答から絞り込み後の全件 (`transactions`) を外すこと (根拠: 00 I3 / qa-classify-bulk-decision-043・034 / delegated-002)。
  - 選択の保持 (絞り込み・ページ・並べ替え・期間をまたぐ)、選択一覧の全件表示、選べない行の理由、見出しの全選択の 50 件での停止 (根拠: 00 I5 / qa-classify-bulk-decision-038・053)。
  - 提案の最後の由来『MF の分類』『MF の分類 (対応表)』(根拠: 00 I4 / qa-classify-bulk-decision-042・040・050・051・052・028・039)。
  - 再試行を write_failed の明細だけにすること、要求全体の失敗を種類ごとに分けること、一括保存を送り直しても最終の状態が変わらないものにすること (根拠: 00 I7 / qa-classify-bulk-decision-018・054・055・056・057)。
  - 取引一覧の 6 列化・表示件数の選択・編集パネルの可変幅・表の中だけの横スクロール・画面検査への明細仕分けの追加 (根拠: 00 I6 / qa-classify-bulk-decision-044)。
  - 『カテゴリなし』の予約の値 (core の 1 か所、集計・分類の状態・候補の検査・履歴・バックアップ) (根拠: 00 I9 / qa-classify-bulk-decision-045・046・047・048)。
  - 勘定科目の対応表: 表と migration、初期の 5 行、設定画面での追加と削除、読み出し・追加・削除の API、設定の変更履歴 (種類の制約の作り直し)、設定の JSON とバックアップ・復元 (根拠: 00 I8 / qa-classify-bulk-decision-049・050)。
  - 上記の API の認可・入力検証・履歴、テスト、画面検査の記録 (`docs/classify-screen/`)。
- Out (00 U7 対象外):
  - 選択の上限 (URL の sel 50 件) と一括保存の上限 (100 件) の変更。
  - 自動判定の規則 (要確認の閾値 80) と、既存の由来 (記憶・ルール・MF 中項目の対応表) の順位と信頼度の変更。
  - 分割・ルール作成・ルール適用・削除と取消・保存フィルタの仕様変更。
  - 絞り込み結果の全件 (表示外のページを含む) を一度に選ぶ操作。
  - 取込 (CSV の読み込み) の仕様変更、証憑の添付と保管 (#42 で廃止。freee 側で管理する)。
  - モバイル・タブレット・デスクトップ専用アプリ (根拠: qa-classify-bulk-decision-067)。
  - Workers Paid などの有料プランへの変更 (根拠: 00 C4 / qa-classify-bulk-decision-033 / delegated-001)。

## 用語と主体

| Term/Actor | Definition/Responsibility |
|---|---|
| 利用者 | 個人事業主とその家族の家計を 1 人で管理する人 (SH1)。月次クローズの前に未整理をまとめて確定する。ログインした利用者の id は `c.get('userId')` で受け、業務データの user_id 列で利用者ごとに分ける。 |
| 家族 | 配偶者・家族の名義で支出する人 (SH2)。所有者 `spouse`・`family` の明細の持ち主で、画面は操作しない。 |
| 行の key | 一覧の行を指す文字列。最初の ':' の前が種類 (`mf`・`cash`・`split`)、後ろが id。id は `mf` と `cash` では txId、`split` では分割の内訳行の lineId。今は api の `packages/api/src/classify-row.ts:47`・`:64` で作る。本書で作成と解析を core の 1 か所へ移す (根拠: backend.md §確定内容 / qa-classify-bulk-backend-web-009)。 |
| 選択 | URL の `sel` にカンマ区切りで持つ行の key の集合。最大 50 件。絞り込み・ページ・並べ替え・期間を変えても保つ (根拠: 00 G3 / qa-classify-bulk-decision-043)。 |
| 一括指定 | 一括操作バーで区分・カテゴリ (大/中)・所有者・支払い方法を指定した値。指定した項目は選択した全件に当てる (根拠: 00 G1 / qa-classify-bulk-decision-041)。 |
| 下書き | 編集パネルで入力した未保存の値。既存どおりブラウザに置き、保存の要求に入れて送る。サーバには下書きとして保存しない (根拠: 00 C2 / security.md §確定内容 / qa-classify-bulk-security-web-003)。 |
| 未整理 / 確定済み | 分類の状態。未整理は `unsorted`・`review`、確定済みは `manual`・`done` (`packages/api/src/routes/classify.ts:165` の statusValues)。値の解決の順が分かれる (根拠: 00 G1 / qa-classify-bulk-decision-036 / delegated-004)。 |
| 値の出所 | 解決した値がどこから来たか。一括指定・下書き・提案・今の値・『カテゴリなし』。保存前の内訳に出す。 |
| 『カテゴリなし』 | 区分に合うカテゴリの組が、埋める値のどこにも無い明細に入れる予約の値。明細の編集の大項目の欄に持ち、集計では未分類と同じに数え、分類の状態は手動、一括指定の欄と編集パネルでは選べない (根拠: 00 G1・C2 / qa-classify-bulk-decision-045・046・047・048)。 |
| MF の分類 | 取込 CSV の大項目・中項目を使う提案の由来。記憶→ルール→MF 中項目の対応表の後ろに置く最後の由来 (根拠: 00 G2 / qa-classify-bulk-decision-042)。 |
| 勘定科目の対応表 | MF の大項目の名前と、勘定科目の一覧 (`packages/core/src/tax-accounts.ts:42` の TAX_ACCOUNTS、32 件) から選んだ対応先の 1 組を行とする、利用者ごとの DB の表。同じ大項目は 1 行だけ (根拠: 00 G2 / qa-classify-bulk-decision-049)。既存の `account_norm_map` (口座名の正規化、`packages/api/src/db/schema.ts:439`) とは別の表である。 |
| 保存前の内訳 | 保存を押す前に、保存する件数と値の出所、そのうち『カテゴリなし』の件数、外す件数と理由、見つからない件数を示す欄 (根拠: 00 I1 / qa-classify-bulk-decision-048)。 |
| write_failed | D1 の書き込みの batch そのものが失敗したときに、保存対象の全件に付ける明細単位の code。再試行はこの code の明細にだけ出す (根拠: 00 G1 / qa-classify-bulk-decision-018・057)。 |
| 『同じ内容で再試行』 | 通信の失敗・5xx・409 の後に出すボタン。直前の要求の本文をそのまま送り、値を解決し直さない (根拠: 00 G1 / qa-classify-bulk-decision-054・056 / frontend.md §上流指針)。 |
| フェンス | 書き込みの前に順に通す middleware。`authGuard` (`packages/api/src/index.ts:111`)・`mustChangePasswordFence` (:113)・`runtimeSchemaGuard` (:114)・`canonicalMutationFence` (:115)。 |

## ユースケースとユーザーフロー

1. UC-1 提案の無い明細を一括指定で確定する: 利用者が提案なしの 3 件を選ぶ → 一括バーで区分『事業』とカテゴリ (大) を指定する → 保存前の内訳に「3件を一括指定で保存」と出る → 『選択した3件を保存』を押す → 要求に 3 件が入り、通知『選択した3件を保存しました。』が出る (根拠: 00 O1 / qa-classify-bulk-decision-041・069)。
2. UC-2 ページと絞り込みをまたいで選ぶ: 1 ページ目で 2 件、2 ページ目で 1 件を選ぶ → 絞り込みを変える → 一括バーの選択一覧は選択の読み出しから 3 件を出し続ける → 保存要求に 3 件が入る (根拠: 00 O4 / qa-classify-bulk-decision-043)。今は選択一覧が表示中のページの行だけを出し (`packages/web/src/pages/classify/BulkActionBar.tsx:27`)、保存も `allRows` から引くため (`packages/web/src/pages/classify/ClassifyPage.tsx:106`・`:406-408`)、絞り込みの外の選択が黙って落ちる (根拠: 00 U2 (3))。
3. UC-3 区分だけを指定する: 区分『個人』だけを指定する → 各明細は埋める値 (下書き→提案、確定済みは下書き→今の値) のうち区分が同じものからカテゴリの組を取る → 組がどこにも無い明細は『カテゴリなし』で保存の対象に入り、保存前の内訳にその件数が出る (根拠: 00 G1 / qa-classify-bulk-decision-035・037・048 / delegated-003)。
4. UC-4 取込直後の提案で確定する: 記憶もルールも無い利用者が取込直後に /classify を開く → 個人の明細に『MF の分類』(信頼度 60・要確認)、事業の明細に対応表で引いた勘定科目 (『MF の分類 (対応表)』) が出る → 提案のまま選んで保存する (根拠: 00 G2 / qa-classify-bulk-decision-042・040)。
5. UC-5 書き込みが失敗する: 3 件の保存で D1 の batch が失敗する → 応答は 2xx で 3 件とも write_failed → 通知と『失敗した3件のみ再試行』が出る → 押すとその 3 件だけが送られる (根拠: 00 G1 / qa-classify-bulk-decision-018・057)。
6. UC-6 通信が切れる・5xx が返る: 書き込まれたか分からない → 画面は一覧と選択の読み出しを読み直し、選択を残し、『保存できたか確かめられませんでした。一覧を読み直しました。同じ内容で送り直しても二重には保存されません』を role=alert で出す → 『同じ内容で再試行』を押すと直前の本文をそのまま送る。自動では送り直さない (根拠: 00 G1 / qa-classify-bulk-decision-054)。
7. UC-7 取込み中に保存する: 409 canonical_write_busy が返る → サーバの文言と『同じ内容で再試行』が出る (根拠: qa-classify-bulk-decision-056)。
8. UC-8 送り直しても結果が変わらない失敗: 400・403・413 が返る → サーバの文言を role=alert で出し、選択を残し、再試行は出さない (根拠: qa-classify-bulk-decision-055)。
9. UC-9 勘定科目の対応表を足す: 利用者が設定画面で大項目『保険』の行を足す → 以後、大項目『保険』の事業の明細に対応先の勘定科目が提案される。削除すると提案が付かなくなる。変更は設定の変更履歴に残る (根拠: 00 G2・G5 / qa-classify-bulk-decision-049)。
10. UC-10 1264px の画面で一覧を読む: 編集パネルを閉じたまま一覧を読む → 一覧が幅を使い、6 列が最小幅を保つ → 明細を開くと編集パネルが幅を取り、足りない幅は表の中だけが横スクロールする (根拠: 00 G4 / qa-classify-bulk-decision-044)。

## 機能要件

- `FR-01` 一括指定欄: 一括操作バーに区分・カテゴリ (大)・カテゴリ (中)・所有者・支払い方法の欄を置く。指定した項目は選択した全件に当てる。カテゴリ (中) は大を選ぶまで選べず、候補は大に従う。『カテゴリなし』は候補に出さない (根拠: 00 G1・I1 / frontend.md §確定内容 / qa-classify-bulk-decision-041・048)。
- `FR-02` 値の解決: 指定しない項目は、未整理の明細では 下書き→提案、確定済みの明細では 下書き→今の値 の順で埋め、手で決めた値を提案で置き換えない (根拠: 00 G1 / qa-classify-bulk-decision-036 / delegated-004)。支払い方法は `row.edit.paymentMethod` を使い、無ければ送らない (根拠: backend.md §確定内容 / qa-classify-bulk-backend-web-009)。
- `FR-03` 区分とカテゴリの組: 区分とカテゴリは 1 組で決める。カテゴリ (大) を指定したらカテゴリ (中) も一括指定の値 (指定が無ければ空) にする。区分だけを指定したときは、埋める値のうち区分が同じものからカテゴリの組を取り、組がどこにも無い明細は『カテゴリなし』で保存する (根拠: 00 G1 / qa-classify-bulk-decision-035・037・048 / delegated-003)。カテゴリ (大) だけを指定して明細の区分と系統が合わない明細は外し、理由『指定したカテゴリ (大) が明細の区分に合いません』を出す (根拠: backend.md §確定内容 / qa-classify-bulk-backend-web-009 (agent の読み))。
- `FR-04` 保存前の内訳: 保存する件数と値の出所、そのうち『カテゴリなし』で保存する件数、外す件数と理由 (埋める値が無い行、確定済みで変わる値が無い行『変わる値がありません』、系統の合わない行)、選択の読み出しで見つからなかった件数を出す。外した行と見つからない行は失敗に数えない。「選択の件数 = 保存する件数 + 外す件数 + 見つからない件数」が成り立つ (根拠: 00 G1・I1 / frontend.md §確定内容 / qa-classify-bulk-decision-069)。
- `FR-05` 同じ解決関数: 画面の内訳とサーバの保存は、core の同じ解決関数で同じ値を得る。今の `resolveBulkItem` (`packages/web/src/pages/classify/view-model.ts:309-327`、状態を見ずに提案を使う) と `inputFromRow` (同 :98-100、未整理で提案があるときだけ提案を使う) の分岐を 1 つにまとめ、core へ置く (根拠: 00 C1 / backend.md §確定内容 / qa-classify-bulk-backend-web-009)。
- `FR-06` 一括保存 API: `POST /api/transactions/bulk` は一括指定と各明細の下書きを受け、サーバが明細と勘定科目の対応表を引き直し、core で値を解決し、予算を測り、json_each で束ねた 1 回の batch で書く (根拠: 00 I2 / backend.md §上流指針 / qa-classify-bulk-decision-068 / delegated-001)。
- `FR-07` 選択の保持: 選択は URL の `sel` に行の key で持ち、絞り込み・ページ・並べ替え・期間の変更で消さない。一括バーの選択一覧は選択の読み出し API から全件を出す (根拠: 00 G3・I5 / qa-classify-bulk-decision-043)。
- `FR-08` 選べない行: 分割の内訳行はチェックの代わりに理由『分割後の内訳は「内訳を編集」からまとめて変更してください』(サーバの split_line_read_only と同じ文言、`packages/api/src/routes/classify.ts:406`) を、分割の設定が不正な明細の行は理由『分割の設定を直してから保存してください』を示す。選べるかどうかは行から決める (不正な分割の行の key は `mf:` で始まるので、key の接頭辞だけでは決まらない)。sel に選べない行の key が残っていたときは、選択一覧にその行と理由を出し、保存前の内訳の外す件数に数える (根拠: 00 G3 / qa-classify-bulk-decision-034・038 / delegated-002 / qa-classify-bulk-frontend-web-003 の訂正 / 内訳行の文言は qa-classify-bulk-frontend-web-004 (2))。サーバが分割のある明細に返す split_line_not_supported の文言『分割済みの明細は内訳から編集してください』(`packages/api/src/routes/classify-bulk.ts:133`) は変えない。
- `FR-09` 見出しの全選択: 表示中の先頭から 50 件までで止め、止めたことを選択の件数の横に『上限の 50 件で止めました』と示す (根拠: 00 G3 / qa-classify-bulk-decision-053)。今は `packages/web/src/pages/classify/TransactionTable.tsx:84` で黙って切る。
- `FR-10` 選択の読み出し API: `GET /api/transactions/selected?keys=` を新設し、表示外の明細も含めて一覧の行の形で返す (根拠: 00 I3 / qa-classify-bulk-decision-043)。
- `FR-11` 一覧 API: `GET /api/transactions` の応答から `transactions` を外し、`rows`・`total`・`page`・`limit` を返す。`limit` は 25・50・100 を受け、既定は 50 (根拠: 00 G3・G4 / backend.md §確定内容 / qa-classify-bulk-backend-web-008)。
- `FR-12` 取引一覧: 6 列 (選択・日付・取引先/内容の 2 段・金額・提案カテゴリ・信頼度)、表示件数の選択 (25 / 50 / 100 件)、全 N 件のページ送り。ページ数は total を応答の limit で割って数える (根拠: 00 G4・I6 / frontend.md §確定内容 / qa-classify-bulk-decision-044)。
- `FR-13` 編集パネルの可変幅: 明細を開いたときだけ幅を取り、閉じている間は一覧へ幅を渡す。足りない幅は表の中だけを横スクロールし、1264px でも文字を 1 字ずつ折り返さない (根拠: 00 G4 / frontend.md §上流指針 / qa-classify-bulk-decision-044)。
- `FR-14` 提案の最後の由来: 記憶・ルール・MF 中項目の対応表のどれも無い明細に、個人は『MF の分類』、事業は対応表で引いた勘定科目を『MF の分類 (対応表)』で、信頼度 60 で付ける (根拠: 00 G2・I4 / qa-classify-bulk-decision-042・040・051・052)。
- `FR-15` 再試行: write_failed (results の ok=false かつ code=write_failed) を返した明細にだけ再試行を出し、押すとその txId だけを送る。ほかの失敗には理由を出す (根拠: 00 I7 / qa-classify-bulk-decision-018)。
- `FR-16` 要求全体の失敗: ApiError の status を 1 つの関数で分け、文言と再試行の有無をそこから引く (根拠: 00 I7 / frontend.md §上流指針 / qa-classify-bulk-decision-054・055・056)。
- `FR-17` 勘定科目の対応表: 表と migration、持ち主 (user_id) ごとの初期の 5 行 (既存の持ち主には migration で入れ、新しい持ち主へ入れる時機は未決事項 7)、読み出し・追加・削除の API、設定画面での追加と削除、設定の変更履歴、設定の JSON とバックアップ・復元 (根拠: 00 I8 / qa-classify-bulk-decision-049・050)。
- `FR-18` 『カテゴリなし』: 予約の値を core の 1 か所で定め、家計の集計・総収支の内訳・説明可能率・分類の状態・候補の検査・履歴・バックアップで未分類と同じ扱いに通す。予約の値と同じ名前のカテゴリの候補は作れない (根拠: 00 I9 / qa-classify-bulk-decision-045・046・047・048)。
- `FR-19` 画面検査: headless Chrome の画面検査に明細仕分けの範囲 (`KANJO_VISUAL_SCOPE=classify`) を新設し、1264px と 1280px で確かめ、記録を `docs/classify-screen/` に置く (根拠: 00 O5 / maintenance-ops.md §確定内容 / qa-classify-bulk-maintenance-ops-web-001)。

## 非機能要件

| 区分 | 要件 |
|---|---|
| D1 の予算 | 1 回の Worker 起動で D1 へ出すクエリは合計 50 本まで (batch 内の文も 1 本ずつ数える)。一括保存の 1 要求は読み込みと書き込みの合計を 49 本以内にする。書き込みは json_each で束ねた 1 回の batch で約 25 本 (前例は `packages/api/src/store.ts:1937` の aggregateReplacementQueries、json_each は :1939-1950) (根拠: 00 C4・O8 / infrastructure.md §確定内容 / qa-classify-bulk-infrastructure-web-evidence-002 / delegated-001)。 |
| batch の上限 | 1 回の batch の文は 50 本以下、束ねた JSON は 2MB まで。各文の bound parameter は 100 まで。選択の読み出しも bound parameter の上限 100 の内に収める (根拠: 00 I2 / infrastructure.md §確定内容 / qa-classify-bulk-decision-005 / delegated-001)。 |
| 上限の定数 | D1 の上限の定数は api の 1 か所に置き、1 起動の合計 (50 未満) と batch の文 (50 以下) を 2 つの名前で持つ (根拠: backend.md §確定内容 / qa-classify-bulk-backend-web-009 (4))。今は同じ値 50 が `D1_FREE_QUERY_LIMIT` (`packages/api/src/import-lifecycle.ts:304`)・`SCHEDULED_D1_QUERY_LIMIT` (`packages/api/src/scheduled-maintenance-budget.ts:13`)・`CLASSIFY_BATCH_STATEMENTS` (`packages/api/src/routes/classify.ts:90`)・`MAX_BATCH_STATEMENTS` (`packages/api/src/routes/classify-bulk.ts:44`) の 4 か所にある。 |
| 本文の大きさ | 一括保存の本文は 256KB まで。超えたら 413 payload_too_large (根拠: 00 G5 / security.md §確定内容 / qa-classify-bulk-decision-030)。 |
| 性能 | 一覧は表示件数ぶんの行だけを返し、絞り込み後の全件を返さない。選択の中身は選択の読み出しだけが返す (根拠: 00 G3 / backend.md §上流指針)。 |
| 初期 JS 予算 | 110KiB を超えない。測定は `pnpm build:bundle` の直後に `check:js-budget` (`packages/web/package.json:15`) で行う (根拠: 00 C4・O7)。 |
| 品質ゲート | `pnpm lint`・`typecheck`・`test`・`skills:test`・`verify:full` (`package.json:40`) が全て exit 0 (根拠: 00 O7)。 |
| 表示 | design-tokens (`packages/core/src/design-tokens.ts`) と共通部品を使い、`packages/web/src` に色の hex を直書きしない。信頼度と分類ステータスは色だけで区別しない (根拠: 00 C3 / docs/design-system.md)。 |
| アクセシビリティ | 一括操作バーと通知は role=status、エラーは role=alert (根拠: 00 C3)。 |
| 税務 | 税務上の正本は freee。本画面は税務判断をせず、事業の明細への提案は対応表の値を出すだけ (根拠: 00 C4 / qa-classify-bulk-decision-050)。 |
| 費用 | Cloudflare 無料枠の範囲で動かし、有料の機能を足さない (根拠: 00 C4 / qa-classify-bulk-decision-033 / delegated-001)。 |

## UI・状態遷移

画面の正本は `design/FINAL-UI/images/13-classify.png`。前サイクル §7.1〜§7.4・§7.6・§7.9〜§7.11 の表示はそのまま使い、取引一覧 (§7.5)・通知 (§7.7)・一括操作バー (§7.8)・状態遷移 (§7.13) を次のとおり変える。色・文字・余白は docs/design-system.md と design-tokens に従う (根拠: 00 G4・C3 / ui-ux.md §確定内容 / qa-classify-bulk-decision-074)。

### 画面の骨格と取引一覧

| 要素 | 仕様 |
|---|---|
| 3 列の骨格 | 絞り込み・取引一覧・編集パネル。編集パネルは明細を開いたときだけ幅を取り、閉じている間は一覧へ幅を渡す (根拠: 00 G4 / qa-classify-bulk-decision-044)。今は 1200px 以上で 3 列が固定幅で、1264px で一覧が約 270px まで縮む (根拠: 00 U2 (4))。 |
| 件数見出し | 『取引一覧（N件）』(前サイクル §7.5 のまま)。 |
| 表示件数 | 『表示件数』の選択で 25 / 50 / 100 件。既定は 50 件。URL の limit で持ち、25・50・100 以外は 50 件に直す。今は `TransactionTable.tsx:67` が『表示件数 50件』を固定で出す (根拠: 00 G4 / ui-ux.md §確定内容 / qa-classify-bulk-ui-ux-web-003 の訂正)。 |
| 列 | 選択・日付・取引先/内容 (取引先を 1 段目、内容を 2 段目)・金額・提案カテゴリ・信頼度の 6 列。今は `TransactionTable.tsx:74-104` の 7 列で、取引先と内容が別の列 (根拠: 00 G4 / qa-classify-bulk-decision-044)。 |
| 横スクロール | 足りない幅では表の中だけを横スクロールし、本体は横にはみ出さない (根拠: 00 G4・O5)。 |
| ページ送り | 全 N 件のページ送り。ページ数は total を応答の limit で割って数える。今は `TransactionTable.tsx:51` が 50 で固定して割る (根拠: frontend.md §確定内容)。 |
| 選べない行 | 分割の内訳行と分割の設定が不正な行は、チェックの代わりに理由を示す (FR-08)。 |

### 一括操作バー

| 要素 | 仕様 |
|---|---|
| 選択の件数 | 表示外の選択も含めた件数を出す (件数の文言は前サイクル §7.8 のまま)。全選択を 50 件で止めたときは横に『上限の 50 件で止めました』(根拠: 00 G3 / qa-classify-bulk-decision-053 / qa-classify-bulk-frontend-web-002)。 |
| 選択一覧 | 選択の読み出しの結果 (TanStack Query のキーに選択を含める) から全件を出す。今は表示中の `rows` だけを渡している (`ClassifyPage.tsx:402`、`BulkActionBar.tsx:27`) (根拠: frontend.md §上流指針)。 |
| 一括指定欄 | 区分・カテゴリ (大)・カテゴリ (中)・所有者・支払い方法。どれも「指定しない」を既定とする (FR-01)。 |
| 保存前の内訳 | 保存する件数と値の出所 (一括指定・下書き・提案・今の値)、『カテゴリなし』の件数、外す件数と理由、見つからない件数 (FR-04)。 |
| 保存ボタン | 『選択した{n}件を保存』。n は保存する件数。保存する件数が 0 のときは押せない。 |
| role | 一括操作バーと通知は role=status、エラーの文言は role=alert (根拠: 00 C3)。 |

### 文言 (完全一致)

| 場面 | 文言 | 操作 |
|---|---|---|
| 全件成功 | 選択した{n}件を保存しました。 | × |
| 一部が write_failed | 前サイクル §7.7 の部分失敗の通知の文言を使う | 『失敗した{K}件のみ再試行』(write_failed の明細だけ) |
| 明細の理由 | 見つからない・値が不正・分割がある明細にはサーバの理由を出す | 再試行なし |
| 通信の失敗・5xx | 保存できたか確かめられませんでした。一覧を読み直しました。同じ内容で送り直しても二重には保存されません | 『同じ内容で再試行』 |
| 409 | サーバの文言 (例: canonical_write_busy の文言) | 『同じ内容で再試行』 |
| 400・403・413 | サーバの文言 (413 は『リクエストが大きすぎます』か『変更量が多すぎるため、対象を絞ってください』) | 再試行なし |
| 401 | 既存のログイン切れの扱い (`packages/web/src/api-client.ts:18` の AUTH_EVENT) | 既存のまま |
| 外す理由 (確定済み) | 変わる値がありません | 外す (失敗に数えない) |
| 外す理由 (系統) | 指定したカテゴリ (大) が明細の区分に合いません | 外す (失敗に数えない) |
| 内訳行 | 分割後の内訳は「内訳を編集」からまとめて変更してください | 選べない |
| 分割の設定が不正 | 分割の設定を直してから保存してください | 選べない |

(根拠: 00 G1・G3 / ui-ux.md §確定内容 / qa-classify-bulk-decision-018・038・053・054・055・056 / qa-classify-bulk-backend-web-009 / qa-classify-bulk-frontend-web-003 の訂正)

### 状態遷移

1. 選択なし → 行のチェックか見出しの全選択 → 選択あり (URL の `sel` を更新し、選択の読み出しを取り直す)。
2. 選択あり → 一括指定・下書き・提案から内訳を計算 → 保存可 (保存する件数が 1 以上) / 保存不可 (0 件)。
3. 保存可 → 『選択した{n}件を保存』→ 送信中 (ボタンを押せない) → 次のどれか。
   - 2xx で全件 ok → 通知『選択した{n}件を保存しました。』→ 選択を空にし、一覧と選択の読み出しを取り直す。
   - 2xx で write_failed あり → 通知と『失敗した{K}件のみ再試行』→ 選択を失敗の明細だけにする。
   - 2xx で理由つきの失敗あり → 理由を出し、再試行は出さない。
   - 通信の失敗・5xx → 一覧と選択の読み出しを読み直し、選択を残し、文言 (role=alert) と『同じ内容で再試行』。
   - 409 → サーバの文言と『同じ内容で再試行』、選択を残す。
   - 400・403・413 → サーバの文言、選択を残す、再試行なし。
   - 401 → 既存のログイン切れの扱い。
4. 『同じ内容で再試行』→ 直前の要求の本文をそのまま送る (値を解決し直さない)。自動では送り直さない (根拠: 00 G1 / qa-classify-bulk-decision-054・056)。

## ビジネスルールと検証

| ID | ルール |
|---|---|
| BR-01 | 値の解決の順: 未整理の明細は 一括指定→下書き→提案、確定済みの明細は 一括指定→下書き→今の値 (根拠: 00 G1 / qa-classify-bulk-decision-036 / delegated-004)。 |
| BR-02 | 区分とカテゴリは 1 組で決める。大を指定したら中も一括指定の値 (無ければ空)。区分だけの指定では区分が同じ埋める値から組を取り、無ければ『カテゴリなし』(根拠: 00 G1 / qa-classify-bulk-decision-035・037・048 / delegated-003)。 |
| BR-03 | 外す行: 未整理で一括指定・下書き・提案のどれも無い行 (O1)、確定済みで変わる値が無い行 (『変わる値がありません』)、大だけを指定して系統が合わない行。外した行は要求に入れず、失敗に数えない (根拠: 00 O1 / backend.md §確定内容 / qa-classify-bulk-backend-web-009)。 |
| BR-04 | 『カテゴリなし』は予約の値。一括指定と編集の値としては 400、予約の値と同じ名前のカテゴリの候補は作れない (`packages/api/src/routes/settings.ts:496` の候補の作成で拒む)。集計では未分類、説明可能率では説明できない側、分類の状態は手動 (根拠: 00 G1・G5 / qa-classify-bulk-decision-045・046・047・048)。予約の値の字面は core の 1 か所で実装時に決める (章 §確定内容 が委ねる、qa-classify-bulk-decision-058)。 |
| BR-05 | 提案の最後の由来: 記憶・ルール・MF 中項目の対応表のどれも無いときだけ候補に入れ、衝突の判定を働かせない。信頼度は 60 (MF 中項目の対応表の 70 より下、要確認の閾値 80 未満) (根拠: 00 G2 / qa-classify-bulk-decision-042・051)。 |
| BR-06 | 個人の明細: 大項目・中項目をそのまま由来『MF の分類』、根拠文『MFの分類をそのまま提案』。集計ルール (取引先) が当たるときはルールを当てた後のカテゴリと集計ルールの名前の根拠文 (由来の表示は集計ルール)。ルールの値が個人の候補に無ければ付けない (根拠: 00 G2 / qa-classify-bulk-decision-042・028)。 |
| BR-07 | 事業の明細: 対応表で大項目から引いた勘定科目、中項目は空、由来『MF の分類 (対応表)』、根拠文は大項目と勘定科目の対応 (根拠: 00 G2 / qa-classify-bulk-decision-040・052)。 |
| BR-08 | 付けない明細: 対応表に行の無い大項目の事業の明細、MF の大項目が空か『未分類』の明細 (個人・事業とも)、分割の内訳行。保存前の内訳に『提案なし』とその理由を出す (根拠: 00 G2 / qa-classify-bulk-decision-039・050)。 |
| BR-09 | 対応表の行: 大項目の名前と TAX_ACCOUNTS の 32 件から選んだ対応先の 1 組。同じ大項目の 2 行目と一覧に無い対応先は 400 (根拠: 00 G2・G5 / qa-classify-bulk-decision-049)。 |
| BR-10 | 対応表の初期の 5 行: 通信費→通信費、水道・光熱費→水道光熱費、交通費→旅費交通費、交際費→接待交際費、日用品→消耗品費。次の 14 の大項目は初期の行に入れない: 中項目で科目が割れるもの (住宅・自動車・食費・教養・教育・特別な支出・税・社会保障・保険)、合う科目が一覧に無いもの (健康・医療・衣服・美容・趣味・娯楽)、振替か意味の無い値 (現金・カード・未分類)、中身を 1 つに決められないもの (収入・その他) (根拠: 00 G2 / qa-classify-bulk-decision-049・050)。 |
| BR-11 | 上限: 選択 1〜50 件、一括 1〜100 件。選択の key と一括の txId の重複は 400 (根拠: 00 G5 / qa-classify-bulk-decision-072)。 |
| BR-12 | 下書きの値は既存の個別編集と同じ制約 (区分・所有者・支払い方法は列挙、カテゴリ大/中は 60 字、メモは 200 字) で明細ごとに検証し、範囲外の明細だけを invalid_item にする (根拠: security.md §確定内容 / qa-classify-bulk-security-web-003)。 |
| BR-13 | 履歴: 保存した明細の値が変わった項目ごとに、source=bulk の行を同じ op_id で 1 行ずつ残す。値が変わらない明細は書かない (根拠: 00 G5 / qa-classify-bulk-decision-072)。 |
| BR-14 | 冪等: 同じ要求を送り直しても、明細の値 (更新時刻を除く)・提案との一致 (done か manual か)・月次集計・履歴は 1 回目の後と変わらない。2 回目は確定済みとして解決されるので同じ値になる。一括保存は取引先の記憶を書かない (根拠: 00 I2・O9 / backend.md §確定内容 / qa-classify-bulk-backend-web-010 の訂正)。 |
| BR-15 | KPI・ナビのバッジ・月次クローズは既存の 1 か所の関数から数え続ける (根拠: 00 G2)。 |

## API契約

共通の前提: 4 つの API は `/api` の下に mount し (`packages/api/src/index.ts:128`・`:129`・`:132`・`:133`)、`authGuard`・`mustChangePasswordFence`・`runtimeSchemaGuard` を通る。書き込み (一括保存と対応表の追加・削除) はさらに `canonicalMutationFence` を通る。エラーの本文は既存どおり `{ error: { code, message } }` (根拠: 00 G5 / auth.md §確定内容 / qa-classify-bulk-decision-072)。

### API: 一括保存 (POST /api/transactions/bulk、拡張)

#### 識別と目的

- 識別: `POST /api/transactions/bulk`。route は `classifyBulkRoute` (`packages/api/src/routes/classify-bulk.ts`、mount は `index.ts:129`)。
- 目的: 一括指定と各明細の下書きを受け取り、サーバが明細を引き直して core で値を解決し、1 回の batch で保存する。提案が無くても使え、表示中の一覧に依存しない (根拠: 00 G1・I2 / qa-classify-bulk-decision-068)。
- 処理の 5 段: zod で検証 → userId で明細と勘定科目の対応表を引く → core で値を解決 → 書き込みの予算を測る → json_each で束ねた 1 回の batch で書く (根拠: backend.md §上流指針)。

#### 認証・認可

- セッション cookie の認証 (`authGuard`、`index.ts:111`) が要る。未認証は 401。
- パスワードの変更が要る利用者は 403 password_change_required (`packages/api/src/auth.ts:297`)。
- 明細は `c.get('userId')` の利用者自身のものだけを引く。他の利用者の txId は存在を明かさず not_found にする (根拠: 00 G5 / auth.md §確定内容 / qa-classify-bulk-decision-072)。

#### Request

本文 (JSON):

| フィールド | 型 | 制約 |
|---|---|---|
| bulk | object | 任意。指定しない項目は欄ごと省く。 |
| bulk.cls | `biz` / `per` | 任意。 |
| bulk.big | string | 任意。60 字まで。予約の値『カテゴリなし』は 400。 |
| bulk.mid | string | 任意。60 字まで。big を伴わない指定は 400。 |
| bulk.owner | `business` / `spouse` / `family` | 任意。 |
| bulk.paymentMethod | `cash` / `card` / `account` | 任意。 |
| items | Array of object | 1〜100 件。txId の重複は 400。 |
| items[].txId | string | 必須。1 字以上。個別の長さの上限は付けない (本文 256KB が上限になる)。 |
| items[].draft | object | 任意。下書きの値。欄は今の item の値の欄 (cls・big・mid・owner・paymentMethod・note、`classify-bulk.ts:48-56`) と同じ制約。 |

- 旧形式: item が値の欄 (cls・big・mid・owner・paymentMethod・note) を直接持つ今の形も受け付け、その値を下書きとして扱う (根拠: backend.md §確定内容 / qa-classify-bulk-backend-web-003 の訂正 (4)。agent の読みで、利用者は未確認)。
- 本文の上限は 256KB (`bodyLimit`)。今の bulk route には付いていない (根拠: 00 G5 / qa-classify-bulk-decision-030)。
- 下書きは値の解決にだけ使い、サーバに下書きとして保存しない (根拠: qa-classify-bulk-security-web-003)。

#### Response

| Status | Meaning | Schema |
|---|---|---|
| 200 | 要求を処理した。明細ごとの結果を持つ。batch が失敗しても 200 で、保存対象の全件を write_failed にする | `{ results: Array of result, opId: string, saved: number, failed: number }` |
| 400 | 本文の検証の失敗 (3 種) | `{ error: { code: 'invalid_body', message } }` |
| 401 / 403 / 409 / 413 / 503 / 500 | Error contract を参照 | `{ error: { code, message } }` |

- result は `{ txId, ok: true, status }` (status は `done` か `manual`) か、`{ txId, ok: false, error: { code, message } }`。code は not_found / invalid_item / split_line_not_supported / no_value / write_failed のどれか (根拠: backend.md §確定内容 / qa-classify-bulk-decision-068)。
- `saved` と `failed` の和は `results` の件数。今の応答の形 (`classify-bulk.ts:207`) を保つ。
- 『カテゴリなし』で保存した明細は ok:true で、status は `manual` (根拠: qa-classify-bulk-decision-047)。

#### Validation・ビジネスルール

- 要求全体の 400 invalid_body は 3 つだけ: 件数の範囲外 (1〜100)、txId の重複、一括指定の値の範囲外。最後のものには、『カテゴリなし』を一括指定に入れた場合、カテゴリ (中) だけの一括指定、区分と大を両方指定して系統が違う場合を含む (根拠: security.md §確定内容 / qa-classify-bulk-backend-web-010 の訂正 / qa-classify-bulk-security-web-004 / qa-classify-bulk-decision-048)。
- 下書きの値の範囲外と、解決後の科目が区分の系統と合わない明細は invalid_item。本人の明細に無い txId は not_found、分割の内訳行は split_line_not_supported、未整理で一括指定・下書き・提案のどれも無い明細は no_value (根拠: qa-classify-bulk-security-web-003 / qa-classify-bulk-backend-web-009)。
- 値の解決は BR-01〜BR-03 を core の 1 つの関数で行う。区分だけを指定して組が無い明細は『カテゴリなし』で保存の対象に入れ、invalid_item にしない (根拠: 00 G1 / qa-classify-bulk-decision-037・048)。
- 確定済みで変わる値が無い明細が送られたときは、値が変わらないので ok を返し、履歴を書かない (BR-13・BR-14)。

#### Error contract

| HTTP | Code | Condition | Retryable | Client action |
|---|---|---|---|---|
| 400 | invalid_body | 件数の範囲外・txId の重複・一括指定の値の範囲外 | no | サーバの文言を role=alert で出し、選択を残す。再試行は出さない |
| 401 | (authGuard の code) | 未認証・セッション切れ | no | 既存のログイン切れの扱い (AUTH_EVENT) |
| 403 | password_change_required | パスワードの変更が要る | no | サーバの文言を出す。再試行は出さない |
| 409 | canonical_write_busy | 取込みか別の更新が進行中 (`packages/api/src/canonical-mutation-fence.ts:286`) | yes (手動) | サーバの文言と『同じ内容で再試行』 |
| 413 | payload_too_large | 本文が 256KB を超える。文言『リクエストが大きすぎます』 | no | サーバの文言を出す。再試行は出さない |
| 413 | too_many_classify_changes | 書き込む前に、batch の文が 50 本を超えるか束ねた JSON が 2MB を超えると分かった。文言『変更量が多すぎるため、対象を絞ってください』。明細ごとの結果を持たない | no | サーバの文言を出す。再試行は出さない |
| 503 | schema_unavailable | D1 の migration が期待の版に無い (`packages/api/src/schema-guard.ts:7`) | yes (手動) | 5xx として一覧を読み直し、『同じ内容で再試行』 |
| 500 | internal | 予期しない例外 (`index.ts:174` の onError)。batch の後に起きると書き込まれたか分からない | yes (手動) | 一覧と選択の読み出しを読み直し、『同じ内容で再試行』 |
| 200 | write_failed (明細) | D1 の batch そのものが失敗した。保存対象の全件 | yes | その明細だけを再試行の対象にする |
| 200 | not_found / invalid_item / split_line_not_supported / no_value (明細) | 明細単位の失敗 | no | 理由を出す |

- 401・403・409・503 はすべて書き込みの前に返る (根拠: backend.md §確定内容 / qa-classify-bulk-decision-055・056・057)。
- 413 too_many_classify_changes は `planClassifyMutation` (`packages/api/src/routes/classify.ts:98-114`) と同じ検査の関数で判定し、write_failed に丸めない。今は `classify-bulk.ts:191` で予算の超過を例外にし、`:195-203` で write_failed に丸めている (根拠: 00 O8 / qa-classify-bulk-decision-055)。

#### 実行セマンティクス

- 書き込みの段は全件か無し: 値を解決できた明細の編集と履歴を json_each で束ね、`tx_edits` の写しの無効化と月次集計の置き換えと合わせて 1 回の batch で書く。今の `chunkByItem` (`classify-bulk.ts:177`) による明細の境界での分割と、前の batch の成功を残す扱いはやめる (根拠: 00 I2 / qa-classify-bulk-decision-057 / delegated-001)。
- D1 のクエリは読み込みと書き込みの合計で 49 本以内。50 件・100 件のどちらも同じ本数の範囲に収まる (根拠: 00 O8)。
- 冪等: 2 回目は確定済みとして解決され同じ値になる。取引先の記憶は書かず (`saveEditQueries` に disagreeOriginKey を渡さない、`packages/api/src/classify-history.ts:178`・`:189`)、値が変わらなければ履歴は 0 行 (根拠: 00 O9 / qa-classify-bulk-backend-web-010 の訂正 / qa-classify-bulk-decision-054・070)。
- 送り直し: POST は RFC 9110 §9.2.2 の冪等なメソッドではないので、画面は自動では送り直さない。利用者が『同じ内容で再試行』を押したときだけ直前の本文を送る (根拠: qa-classify-bulk-decision-054)。
- op_id: 1 要求に 1 つ振り、値が変わった項目ごとの履歴の行に同じ値を入れ、応答の `opId` で返す。

#### キャッシュ・ページング

- N/A: 書き込みの API で応答をキャッシュしない。ページングは無く、1 要求 100 件までで扱う。
- 画面は成功・write_failed・5xx・通信の失敗の後に、一覧と選択の読み出しのクエリを無効化して取り直す。

#### 可観測性と監査

- 監査: 値が変わった項目ごとに `tx_history` へ source=bulk の行を残す (field は cls・category・owner・payment_method・note、`packages/api/src/db/schema.ts:1111-1126`、'bulk' は :1122)。
- 応答の `opId` と履歴の op_id で 1 要求の変更を辿る。予期しない例外は既存の onError (`index.ts:151-181`) が記録する。
- 新しいログの項目の要否は実装時に決める (maintenance-ops.md §確定内容 が委ねる)。

#### セキュリティ確認

- 他の利用者の txId は not_found で返し、存在を明かさない (00 G5)。
- 本文 256KB の `bodyLimit` で大きな本文を検証の前に止める (00 G5 / qa-classify-bulk-decision-030)。
- zod で一括指定と下書きを検証し、予約の値を一括指定で受け付けない (00 G5 / qa-classify-bulk-decision-048)。
- 変更はフェンスを通す (`canonicalMutationFence`、`index.ts:115`)。
- ASVS 5.0.0 の入力検証の観点 (出典 owasp-asvs) に沿う (根拠: security.md §確定内容)。

#### Contract tests

- 提案なしの 3 件に区分とカテゴリを一括指定すると 3 件とも ok、保存の値が一括指定と一致する。
- 未整理は 下書き→提案、確定済みは 下書き→今の値 で埋まる。区分だけで組が無い明細は『カテゴリなし』で ok・status manual。
- 件数 0・101、txId の重複、『カテゴリなし』の一括指定、中だけの一括指定、系統の違う区分と大は 400 invalid_body。
- 本文 256KB 超は 413 payload_too_large。予算超過は 413 too_many_classify_changes で results を持たない。
- 50 件・100 件の保存で D1 のクエリが 49 本以内。batch の失敗で 200・全件 write_failed。
- 同じ要求を 2 回送ると、2 回とも全件 ok で saved と各 status が同じ、明細の値と月次集計が同じ、履歴の行数が増えない。
- 他の利用者の txId は not_found。値が変わった項目ごとに source=bulk の履歴が 1 行ずつ、値が変わらない明細は 0 行。
- 旧形式の item が下書きとして解決される。

### API: 選択の読み出し (GET /api/transactions/selected、新設)

#### 識別と目的

- 識別: `GET /api/transactions/selected?keys=`。route は classify の route 群 (`packages/api/src/routes/classify.ts`) に足す。置き場所の細部は実装時に決める (backend.md §確定内容 が委ねる)。
- 目的: 選択中の行の key から、表示外の明細も含めて一覧の行の形で返す。一括バーの選択一覧と保存前の内訳はこの結果から作る (根拠: 00 G3・I3 / qa-classify-bulk-decision-043 / delegated-002)。

#### 認証・認可

- 認証済みの利用者だけ (`authGuard`)。未認証は 401、パスワードの変更が要る利用者は 403。
- 母集団は利用者自身の全明細。他の利用者の key と消えた key は区別せず `missing` に入れる (根拠: 00 G5 / auth.md §確定内容 / qa-classify-bulk-decision-072)。

#### Request

| パラメータ | 型 | 制約 |
|---|---|---|
| keys | string (query) | 必須。カンマ区切りの行の key。1〜50 件。重複は 400。 |

- 受ける key は `mf:`・`cash:`・`split:` で始まる一覧の行の key。`split:` は開いた明細の表示に使い、選択には使わない (根拠: backend.md §確定内容 / qa-classify-bulk-backend-web-009)。
- 形の違う key と 200 字を超える key は 400 にせず `missing` に入れる (根拠: security.md §確定内容 / qa-classify-bulk-security-web-003 の訂正 (2)(3))。
- GET なので `bodyLimit` は付けない。

#### Response

| Status | Meaning | Schema |
|---|---|---|
| 200 | 見つかった行と見つからなかった key | `{ rows: Array of ClassifyRow, missing: Array of string }` |
| 400 | keys の件数の範囲外・重複 | `{ error: { code: 'invalid_query', message } }` |
| 401 / 403 / 503 / 500 | Error contract を参照 | `{ error: { code, message } }` |

- `rows` の各行は一覧の `rows` と同じ形 (`buildClassifyRow`、`packages/api/src/classify-row.ts:43`)。提案・信頼度・根拠文も一覧と同じ関数で付ける。
- 画面は `missing` の key を保存前の内訳に『見つからない』として数え、URL の `sel` から外す。失敗には数えない (根拠: frontend.md §確定内容)。

#### Validation・ビジネスルール

- keys は zod で検査する。件数 1〜50 と重複を見る (根拠: 00 G5)。
- 選択の読み出しは一括保存と同じ引き直しの関数を使う (根拠: backend.md §上流指針)。
- 読み出しは bound parameter の上限 100 の内に収める (根拠: infrastructure.md §確定内容 / delegated-001)。
- code の名前は一覧と同じ invalid_query の形を使う。別の名前にするかは実装時に決める (backend.md §確定内容 が委ねる)。

#### Error contract

| HTTP | Code | Condition | Retryable | Client action |
|---|---|---|---|---|
| 400 | invalid_query | keys の件数が 1〜50 の外、または重複 | no | 選択を 50 件以内に保つ画面では通常届かない。文言を出す |
| 401 | (authGuard の code) | 未認証 | no | 既存のログイン切れの扱い |
| 403 | password_change_required | パスワードの変更が要る | no | 文言を出す |
| 503 | schema_unavailable | D1 の migration が期待の版に無い | yes | TanStack Query の既存の再取得に任せる |
| 500 | internal | 予期しない例外 | yes | 同上 |

#### 実行セマンティクス

- 読み取りだけで、D1 に書かない。安全で冪等。
- 期間・絞り込み・並べ替えに関わらず、利用者自身の全明細から key で引く (根拠: 00 G3)。
- `rows` の並びは keys の順に合わせるかを含め、並びの細部は実装時に決める (frontend.md §確定内容 が委ねる)。

#### キャッシュ・ページング

- ページングは無い (最大 50 件)。
- 画面は TanStack Query のキーに選択 (keys) を含める。保存の後と通信の失敗・5xx の後に無効化して取り直す (根拠: frontend.md §上流指針)。

#### 可観測性と監査

- 読み取りなので監査の行は残さない。予期しない例外は既存の onError が記録する。

#### セキュリティ確認

- 他の利用者の key は `missing` に入れ、存在を明かさない (00 G5)。
- key の件数・重複を zod で検査し、長すぎる key は照合せず `missing` に入れる。
- 応答は利用者自身の行だけで、他の利用者の明細の項目を含めない。

#### Contract tests

- 表示中の絞り込みに無い明細の key でも `rows` に返る。
- 51 件と重複は 400。形の違う key と 201 字の key は `missing`。
- 他の利用者の key と消えた key は `missing` で、区別できない。
- `split:` の key は内訳行を返す。
- `rows` の各行が一覧の行と同じ形。

### API: 勘定科目の対応表 (読み出し・追加・削除、新設)

#### 識別と目的

- 識別: 読み出し (GET)・追加 (POST)・削除 (DELETE) の 3 つ。パスは章に書かれていないため実装時に決める (00 I8・backend.md §確定内容 が委ね、細部は qa-classify-bulk-decision-058 で agent の案に任された)。既存の設定 API は `/api` の下に `settingsRoute` (`packages/api/src/routes/settings.ts`、mount は `index.ts:133`) と `settingsScreenRoute` (`packages/api/src/routes/settings-screen.ts`、mount は :132) として並ぶ。
- 目的: 事業の明細の提案に使う、MF の大項目から勘定科目への対応表を利用者ごとに読み書きする (根拠: 00 G2・I8 / qa-classify-bulk-decision-049)。

#### 認証・認可

- 認証済みの利用者だけ。未認証は 401、パスワードの変更が要る利用者は 403。
- 行は利用者ごとに分け、他の利用者の行は見つからない扱いにする (根拠: 00 G5 / qa-classify-bulk-decision-072)。
- 追加と削除は `canonicalMutationFence` を通す。

#### Request

| 操作 | 入力 | 制約 |
|---|---|---|
| 読み出し | なし | 利用者自身の行を返す |
| 追加 | 大項目の名前 (string)、対応先 (string) | 対応先は TAX_ACCOUNTS の 32 件のどれか。同じ大項目の 2 行目は 400 |
| 削除 | 行を指す識別子 | 他の利用者の行と無い行は 404 |

- 欄の名前・行の識別子の形・大項目の名前の長さの上限は実装時に決める (backend.md §確定内容 が委ねる)。

#### Response

| Status | Meaning | Schema |
|---|---|---|
| 200 | 読み出し・追加・削除に成功 | 行の配列 (大項目の名前と対応先の組)。形の細部は実装時に決める |
| 400 | 同じ大項目の 2 行目、一覧に無い対応先、形の不正 | `{ error: { code, message } }` |
| 404 | 他の利用者の行か無い行の削除 | `{ error: { code: 'not_found', message } }` |
| 401 / 403 / 409 / 503 / 500 | Error contract を参照 | `{ error: { code, message } }` |

#### Validation・ビジネスルール

- 行は大項目と対応先の 1 組。同じ大項目は 1 行 (根拠: 00 G2 / qa-classify-bulk-decision-049)。
- 対応先は TAX_ACCOUNTS (`packages/core/src/tax-accounts.ts:42`) から選ぶ (根拠: 00 G5)。
- 初期の 5 行は業務データの持ち主 (user_id) ごとに入れる。既存の持ち主には migration で入れ (BR-10)、新しい持ち主にも入れる (根拠: 00 I8)。今は user_id が全員 `TENANT_ID` (`packages/api/src/auth.ts:36`・`:257`・`:276`) で、利用者の作成 (`packages/api/src/users.ts:247` の prepareUserInvitation) は users に行を足すだけで新しい持ち主を作らない。このため利用者の作成のたびに `TENANT_ID` へ入れ直すことはしない。同じ行が重なるか、利用者が消した行が戻り、追加・削除の契約 (AC-16) を破るからである。新しい持ち主へ入れる時機は未決事項 7。
- 変更 (追加と削除) は設定の変更履歴に、新しい種類の target として前後の値を残す (根拠: 00 G5 / qa-classify-bulk-decision-049)。

#### Error contract

| HTTP | Code | Condition | Retryable | Client action |
|---|---|---|---|---|
| 400 | (検証の code) | 同じ大項目の 2 行目・一覧に無い対応先・形の不正 | no | 設定画面に文言を出す |
| 401 | (authGuard の code) | 未認証 | no | 既存のログイン切れの扱い |
| 403 | password_change_required | パスワードの変更が要る | no | 文言を出す |
| 404 | not_found | 他の利用者の行か無い行 | no | 一覧を取り直す |
| 409 | canonical_write_busy | 取込みか別の更新が進行中 | yes (手動) | 文言を出し、押し直せるようにする |
| 503 | schema_unavailable | migration が期待の版に無い | yes (手動) | 文言を出す |
| 500 | internal | 予期しない例外 | yes (手動) | 文言を出す |

- 400 の code の名前は実装時に決める (backend.md §確定内容 が委ねる)。

#### 実行セマンティクス

- 追加と削除は、対応表の行と設定の変更履歴の行を 1 回の batch で書く (全件か無し)。
- 対応表の変更は以後の提案の算出に効く。保存済みの明細の値は変えない。
- 追加の送り直しは同じ大項目の 2 行目として 400 になり、二重の行はできない。

#### キャッシュ・ページング

- ページングは無い (行は大項目の数まで)。
- 画面は追加・削除の後に、対応表と、提案を含む一覧・選択の読み出しのクエリを無効化して取り直す。

#### 可観測性と監査

- 変更は `settings_change_log` (`packages/api/src/db/schema.ts:412`) に、利用者ごとの連番・前後の値・変更者・時刻・origin で残す。origin は画面からの変更が `screen`、復元が `restore`、初期の行の migration が `migration` (今の CHECK は `migrations/0056_settings_change_log.sql:16`)。
- 初期の 5 行を migration で入れるときに履歴の行を作るかは実装時に決める (database.md §確定内容 が委ねる)。

#### セキュリティ確認

- 他の利用者の行は 404 で、存在を明かさない (00 G5)。
- 入力を zod で検証し、対応先を一覧に限る。
- 変更はフェンスを通す。

#### Contract tests

- 読み出し・追加・削除が利用者ごとに分かれる。
- migration の後、既存の持ち主に初期の 5 行がある。利用者を作っても対応表の行は増えず、利用者が消した行は戻らない。新しい持ち主へ入れる経路のテストは未決事項 7 の閉じ方に従う。
- 同じ大項目の 2 行目と一覧に無い対応先は 400。未認証は 401。他の利用者の行は見つからない扱い。
- 追加と削除が設定の変更履歴に残る。
- 設定の JSON とバックアップ・復元で対応表が往復し、版 1 の JSON と対応表を持たない旧いバックアップは初期の 5 行になる。

### API: 明細一覧の取得 (GET /api/transactions、変更)

#### 識別と目的

- 識別: `GET /api/transactions` (`packages/api/src/routes/classify.ts:253`)。
- 目的: 取引一覧に表示件数ぶんの行と総件数を返す。絞り込み後の全件は返さず、表示外の選択の中身は選択の読み出しだけが返す (根拠: 00 G3・G4 / backend.md §上流指針 / qa-classify-bulk-decision-043)。

#### 認証・認可

- 認証済みの利用者だけ。母集団は利用者自身の明細。既存のまま。

#### Request

| パラメータ | 型 | 制約 |
|---|---|---|
| limit | `25` / `50` / `100` | 任意。既定 50。ほかの値は 400 invalid_query |
| page | integer | 任意。1 以上。既存のまま |
| month / from / to / year / span / all / status / category / owner / method / manual / cls / q / sort | 既存のまま | `classify.ts:168-199` の transactionsQuery |

- 今は `limit` が 50 だけを受ける (`classify.ts:195-200`、`PAGE_LIMIT=50` は :163)。画面も 50 を固定で送る (`ClassifyPage.tsx:72`) (根拠: backend.md §確定内容 / qa-classify-bulk-backend-web-008 の訂正)。

#### Response

| Status | Meaning | Schema |
|---|---|---|
| 200 | 一覧の 1 ページ | 既存の項目から `transactions` を外したもの。`rows` (表示件数ぶん)・`total`・`page`・`limit` (受けた値)・`period`・`summary`・`kpi`・`candidates`・`institutions` |
| 400 | 絞り込みか limit の不正 | `{ error: { code: 'invalid_query', message: '絞り込みの指定が正しくありません' } }` |

- 今は `transactions: matched` (`classify.ts:389`) で絞り込み後の全件を返している。これを外す (根拠: 00 G3 / qa-classify-bulk-decision-043)。

#### Validation・ビジネスルール

- `limit` は zod で 25・50・100 に限る (根拠: qa-classify-bulk-backend-web-008)。
- KPI とページ番号は受けた limit で数える。KPI の件数は既存の 1 か所の関数から数え続ける (00 G2)。

#### Error contract

| HTTP | Code | Condition | Retryable | Client action |
|---|---|---|---|---|
| 400 | invalid_query | limit が 25・50・100 の外、ほかの絞り込みの不正 | no | 既定の 50 で取り直す |
| 401 | (authGuard の code) | 未認証 | no | 既存のログイン切れの扱い |
| 503 | schema_unavailable | migration が期待の版に無い | yes | 既存の再取得に任せる |
| 500 | internal | 予期しない例外 | yes | 同上 |

#### 実行セマンティクス

- 読み取りだけ。安全で冪等。
- 並べ替えと絞り込みは既存のまま。ページの行の切り出し (`classify.ts:335`) を受けた limit で行う。

#### キャッシュ・ページング

- ページングは `page` と `limit`。ページ数は total を応答の limit で割って数える (根拠: frontend.md §確定内容)。
- 画面の queryKey (`ClassifyPage.tsx:89-93`) に limit を含める。

#### 可観測性と監査

- 読み取りなので監査の行は残さない。既存の onError のまま。

#### セキュリティ確認

- 母集団は利用者自身の明細のまま。`transactions` を外すことで、1 回の応答に載る明細の量が表示件数までに減る。

#### Contract tests

- limit 25・50・100 で `rows` がその件数以下、24・51・101 は 400。
- 応答に `transactions` が無い。
- 表示件数 50 のとき、51 件目は 2 ページ目に出る (前サイクル AT-04 の確認を残す)。
- `transactions` を読む API テスト 8 本 (split-lifecycle・import-diff・cash-lifecycle・vendor-memory・row-transfer-lifecycle・classify-transactions-shape・classify-list-paging・total-cashflow-verdict) を `rows` と選択の読み出しへ移す (根拠: backend.md §確定内容 / qa-classify-bulk-backend-web-008)。

## データモデル

| 対象 | 変更 |
|---|---|
| 勘定科目の対応表 (新表) | 利用者ごとの行 (user_id・MF の大項目の名前・対応先の勘定科目)。(user_id, 大項目) で一意。表と列の名前は実装時に決める (database.md §確定内容 が委ねる)。表の追加はこの 1 つに限る (根拠: 00 C2 / qa-classify-bulk-decision-049)。 |
| `tx_edits` | 列は足さない。『カテゴリなし』は大項目の欄 `category_major` (`packages/api/src/db/schema.ts:105` の txEdits) に予約の値で持つ (根拠: 00 C2 / qa-classify-bulk-decision-045)。 |
| `tx_history` | 列は足さない。一括保存は既存の source `bulk` と field を使う (`schema.ts:1111-1126`)。 |
| `settings_change_log` | target の CHECK (`migrations/0056_settings_change_log.sql:10` の norm_rule・owner_label・stat_min_months・cash_override) に対応表の種類を足す。SQLite は CHECK を後から変えられないので表を作り直す (破壊的な migration) (根拠: 00 C2 / qa-classify-bulk-decision-049)。 |
| 設定の JSON (kanjo-settings) | 対応表を加え、版を 2 に上げる。今は `packages/core/src/settings-json.ts:14`・`:19` で version 1。版 1 の JSON は読み込むと初期の 5 行になる (根拠: 00 C2 / qa-classify-bulk-decision-070)。 |
| バックアップ・復元 | 対応表を加える。対応表を持たない旧いバックアップは読み込むと初期の 5 行になる (根拠: 00 C2・O3)。 |
| 下書き | 既存どおりブラウザに置く。サーバの表は足さない (根拠: 00 C2)。 |

migration は 2 本 (予定の番号は 0058・0059。着手時の最新番号の次に振り直す):

1. 対応表の表の作成と、既存の利用者への初期の 5 行の投入 (追加のみ)。
2. `settings_change_log` の作り直し (target の CHECK に対応表の種類を足す)。破壊的なので `.github/migration-approvals.json` に sha256 を足し、PR で承認する (今の baseline は 0056、承認は 0057)。

`packages/api/src/schema-guard.ts:4` の `EXPECTED_D1_MIGRATION` (今は `0057_improvement_request_screen.sql`) を新しい最後の migration へ上げる (根拠: infrastructure.md §確定内容 / qa-classify-bulk-decision-070)。

## 認証・認可

- 4 つの API は既存のセッション cookie の認証 (`authGuard`、`index.ts:111`) の内側に置く。新しい認証の方式は足さない (根拠: auth.md §確定内容 / qa-classify-bulk-decision-072)。
- 認可は利用者ごとの分離: 業務データは `c.get('userId')` の行だけを扱う。他の利用者の txId は not_found、選択の key は missing、対応表の行は 404 で、存在を明かさない (根拠: 00 G5)。
- パスワードの変更が要る利用者は `mustChangePasswordFence` (`index.ts:113`) で 403 password_change_required。
- 書き込み (一括保存・対応表の追加と削除) は `canonicalMutationFence` (`index.ts:115`) を通る。
- 401 のとき画面は、`packages/web/src/api-client.ts:55`・`:73` で AUTH_EVENT を発する既存のログイン切れの扱いに入る。

## エラー・例外・回復

| 種類 | 発生源 | 回復 |
|---|---|---|
| 明細の write_failed | D1 の batch の失敗 | 保存対象の全件が write_failed。再試行はその明細だけを送る。batch は全件か無しなので一部だけ書かれた状態は残らない (根拠: qa-classify-bulk-decision-057)。 |
| 明細の理由つきの失敗 | not_found・invalid_item・split_line_not_supported・no_value | 再試行を出さず理由を出す。画面は保存前に外すので通常は届かない (根拠: 00 I2)。 |
| 通信の失敗・5xx | ネットワーク・onError・503 | 書き込まれたか分からない。一覧と選択の読み出しを読み直し、選択を残し、文言と『同じ内容で再試行』。送り直しても二重には保存されない (根拠: qa-classify-bulk-decision-054)。 |
| 409 | canonicalMutationFence | 書き込みの前に返る。サーバの文言と『同じ内容で再試行』(根拠: qa-classify-bulk-decision-056)。 |
| 400・403・413 | 検証・fence・bodyLimit・予算 | 送り直しても結果が変わらない。サーバの文言を出し、再試行は出さない (根拠: qa-classify-bulk-decision-055)。 |
| 401 | authGuard | 既存のログイン切れの扱い (根拠: 00 I7)。 |

- 要求全体の失敗の分け方は ApiError (`packages/web/src/api-client.ts:2`、status と code を持つ) の status を 1 つの関数で見る。今の catch (`ClassifyPage.tsx:167-173`) は status を分けず、全件を『通信できませんでした。同じ内容で再試行できます。』の失敗にする (根拠: 00 U2 (6) / qa-classify-bulk-decision-054・055・056)。
- 今の再試行 (`ClassifyPage.tsx:178`) は失敗の `item` を送るが、画面側で外した失敗は `item` が null (`ClassifyPage.tsx:420`) で `failure.item ?? []` に落ちるため、押しても何も送らない (`ClassifyPage.tsx:142-147`)。本書では外した行を失敗に数えず再試行も出さない (根拠: 00 U2 (2) / qa-classify-bulk-decision-018)。
- 利用者の入力 (下書き) は保存に成功するまで端末から消さない (前サイクルの回復の原則のまま)。

## イベント・非同期処理

N/A: 本機能は同期の HTTP 要求だけで完結し、Queues・Durable Objects・夜間 job・Webhook を足さない (根拠: 00 C4 / qa-classify-bulk-decision-033 / delegated-001)。画面は自動では送り直さず、送り直しは利用者の『同じ内容で再試行』だけで行う (根拠: qa-classify-bulk-decision-054)。

## 可観測性

- 一括保存の変更は `tx_history` の source=bulk と op_id、対応表の変更は `settings_change_log` で辿る (根拠: 00 G5)。
- 予期しない例外は既存の onError (`index.ts:151-181`) が記録し、500 internal を返す。
- D1 のクエリ本数は API テストで数えて固定する (O8)。本番で本数を測る仕組みを足すかは実装時に決める (maintenance-ops.md §確定内容 が委ねる)。
- 画面検査の記録 (1264px と 1280px のスクリーンショットと計測) を `docs/classify-screen/` に置く (根拠: maintenance-ops.md §確定内容 / qa-classify-bulk-maintenance-ops-web-001)。

## 互換性・移行・リリース

- 一括保存の旧形式 (item が値の欄を直接持つ) を受け付けるので、旧い画面の要求も処理できる (根拠: qa-classify-bulk-backend-web-003 の訂正 (4))。
- `GET /api/transactions` から `transactions` を外すのは互換を壊す変更。画面 (`ClassifyPage.tsx:106` の `data?.transactions ?? rows`) と API テスト 8 本を同じ変更で移す (根拠: qa-classify-bulk-backend-web-008 / qa-classify-bulk-prior-cycle-001)。
- 提案の入力 (ルール・記憶・normRules・対応表) を 1 つの値にまとめ、`classifySuggestion` (`packages/core/src/classify-status.ts:279`) の呼び出し 6 か所 (`packages/core/src/overview.ts:254`・`:339`、`packages/api/src/classify-row.ts:52`・`:151`、`packages/api/src/routes/classify-bulk.ts:155`、`packages/api/src/routes/classify.ts:514`) を揃える (根拠: backend.md §確定内容 / qa-classify-bulk-backend-web-009)。
- `legacyBasisLabel` (`packages/core/src/overview.ts:265`、呼び出しは :259) を消し、`basisLabel` は残す。`RecommendationBasis` (`overview.ts:199`) を `SuggestionBasis` (`classify-status.ts:143`) の別名にする (根拠: backend.md §確定内容)。
- migration の順: 対応表の表と初期の行 → `settings_change_log` の作り直し。破壊的な後者は `.github/migration-approvals.json` の承認を PR で足し、merge を承認とする。`EXPECTED_D1_MIGRATION` を同じ PR で上げる (根拠: 00 C2 / infrastructure.md §確定内容)。
- 設定の JSON は版 2 を書き出し、版 1 を読み込める。旧いバックアップは初期の 5 行で補う (根拠: 00 C2)。
- 1 つの PR の中で api・core・web・migration を揃えて出す。分けて出すかは実装時に決める (infrastructure.md §確定内容 が委ねる)。

## テストと受入条件

| ID | Given | When | Then |
|---|---|---|---|
| AC-01 | 提案なしの未整理 3 件を選んでいる | 区分とカテゴリを一括指定して保存する | 要求に 3 件が入り、通知『選択した3件を保存しました。』が出る (O1) |
| AC-02 | 未整理と確定済みの明細に下書きと提案がある | core の解決関数を呼ぶ | 未整理は 下書き→提案、確定済みは 下書き→今の値 の順で埋まる (O1) |
| AC-03 | 区分だけを指定し、組の無い明細がある | 内訳を計算して保存する | その明細は『カテゴリなし』で保存の対象に入り、内訳にその件数が出る (O1) |
| AC-04 | 埋める値が無い行と確定済みで変わる値が無い行がある | 内訳を出す | 要求に入らず、外す件数と理由が出て、失敗に数えない (O1) |
| AC-05 | 『カテゴリなし』の明細がある | 家計の集計・総収支の内訳・説明可能率を数える | 未分類・説明できない側に入り、分類の状態が手動 (O1) |
| AC-06 | 3 件の保存で batch が失敗する | 保存する | 200 で 3 件とも write_failed、『失敗した3件のみ再試行』を押すと 3 件だけが送られる (O2・O8) |
| AC-07 | write_failed の 1 件と理由つきの失敗がある | 通知を見る | 再試行は write_failed の 1 件にだけ出て、押すとその 1 件だけが送られる (O2) |
| AC-08 | 保存の要求が通信の失敗か 5xx で終わる | 結果を待つ | 一覧と選択の読み出しが読み直され、選択が残り、role=alert の文言と『同じ内容で再試行』が出て、押すと直前の本文がそのまま送られる (O2) |
| AC-09 | 保存の要求が 409 で終わる | 結果を待つ | サーバの文言と『同じ内容で再試行』が出る (O2) |
| AC-10 | 保存の要求が 400・403・413 で終わる | 結果を待つ | サーバの文言が出て選択が残り、再試行が出ない (O2) |
| AC-11 | 記憶・ルール・MF 中項目の対応表が無い個人の明細 | 提案を算出する | MF の大項目・中項目が信頼度 60・根拠文『MFの分類をそのまま提案』で付く (O3) |
| AC-12 | 対応表に行がある大項目の事業の明細 | 提案を算出する | 勘定科目が中項目は空・由来『MF の分類 (対応表)』・信頼度 60 で付き、根拠文に対応が書かれる (O3) |
| AC-13 | 対応表に行の無い大項目の事業の明細、大項目が空か『未分類』の明細 | 提案を算出する | 提案が付かない (O3) |
| AC-14 | 集計ルールが当たる個人の明細 | 提案を算出する | ルールを当てた後のカテゴリと集計ルールの名前の根拠文。ルールの値が候補に無ければ付かない (O3) |
| AC-15 | 既存の由来の明細 | 提案を算出する | 由来の順位と信頼度 (`packages/core/src/classify-status.ts:86-88` の 95・85・70)、要確認の閾値 80 (同 :43) が変わらない (O3) |
| AC-16 | migration の後の既存の持ち主。そのあと利用者を作る | 対応表を読み出す | 初期の 5 行がある。利用者を作っても行は増えず、消した行は戻らない。追加・削除が設定の変更履歴に残る。設定画面から足し引きできる (O3) |
| AC-17 | 版 1 の設定の JSON と対応表を持たない旧いバックアップ | 読み込む | 対応表が初期の 5 行になる。版 2 は往復する (O3) |
| AC-18 | 1 ページ目で 2 件、2 ページ目で 1 件を選んだ | 絞り込みを変えて保存する | 選択一覧に 3 件が出て、保存要求に 3 件が入る (O4) |
| AC-19 | 内訳行と分割の設定が不正な行がある | 一覧を見る | チェックが無く理由が出る (O4) |
| AC-20 | 表示件数 100 | 見出しの全選択を押す | 50 件で止まり、『上限の 50 件で止めました』が件数の横に出る (O4) |
| AC-21 | 表示中の絞り込みに無い明細 | 選択の読み出しと一括保存を呼ぶ | サーバが引き直せる。一覧の応答に `transactions` が無い (O4) |
| AC-22 | /classify を 1264px と 1280px で開く | 画面検査を走らせる | 6 列が最小幅以上、本体の横はみ出し 0、編集パネルを閉じると一覧が広がる (O5) |
| AC-23 | 未認証・フェンス拒否・選択 51 件・key の重複・一括 101 件・txId の重複・予約の値の一括指定・予約の値と同名の候補の作成 | API を呼ぶ | 401・403・400・400・400・400・400・400 (O6) |
| AC-24 | 本文が 256KB を超える一括保存 | 送る | 413 payload_too_large (O6) |
| AC-25 | 他の利用者の key・txId・対応表の行 | 読み出し・保存・削除する | 見つからない扱いで存在を明かさない (O6) |
| AC-26 | 値が変わる明細と変わらない明細 | 一括保存する | 変わった項目ごとに source=bulk の履歴が 1 行ずつ、変わらない明細は 0 行 (O6) |
| AC-27 | 50 件と 100 件の保存 | D1 のクエリを数える | どちらも 49 本以内 (O8) |
| AC-28 | 書き込む前に予算の超過が分かる要求 | 送る | 413 too_many_classify_changes で results を持たず、write_failed にならない (O8) |
| AC-29 | 同じ一括保存の要求 | 2 回送る | 2 回とも全件 ok、saved と各 status が同じ、明細の値と月次集計が同じ、履歴が増えない (O9) |
| AC-30 | 品質ゲート | lint・typecheck・test・skills:test・初期 JS 予算・verify:full を走らせる | 全て exit 0 (O7) |

テストの置き場と境界値 (根拠: maintenance-ops.md §確定内容 / qa-classify-bulk-maintenance-ops-web-001):

- core の単体テスト: 値の解決、『カテゴリなし』、行の key の作成と解析、選べる行の判定、提案の由来。境界は信頼度 79 と 80、60 と既存の 70。
- API テスト: 選択 50 と 51、一括 100 と 101、本文 256KB。D1 のクエリの本数。`transactions` を読む 8 本の移し替え。
- DOM テスト: 6 列・表示件数・ページ送り・選択一覧・内訳・再試行・要求全体の失敗の 5 種。
- 画面検査: `packages/web/scripts/check-financial-visuals.mjs` に `KANJO_VISUAL_SCOPE=classify` を足し、`packages/web/scripts/viewports.mjs` に 1264px を足す (今は :35 の 1280 だけ)。CI の headless Chrome は `pointer: none` なので、hover と pointer の media query に頼らない (出典 chrome-headless-mode)。
- 前サイクルの AT-04 は表示件数 50 のときの確認として残し、AT-08 は明細の再試行 (AC-07) と要求全体の再試行 (AC-08・AC-09) の 2 つに分ける (根拠: qa-classify-bulk-prior-cycle-001)。

## 未決事項

いずれも本書の契約は決まっており、実装を止めない。各項目に、誰が・いつ・何をもって閉じるかを書く。

1. 章の旧い文言 (章の訂正で置き換え済み): 章には「区分に合うカテゴリがありません」が 16 か所、「表・列・migration は足さず」が 2 か所、後の決定の前の文言のまま残る。前者は qa-classify-bulk-decision-037・045・048 で『カテゴリなし』の予約の値に、後者は qa-classify-bulk-decision-049・050 で勘定科目の対応表 (表と migration、初期の 5 行、設定画面) に置き換わった。本書は訂正後の契約を採る。閉じ方: 次に system-spec の章を compile し直すとき、dev-graph の spec 担当 (agent) がこの 18 か所を訂正後の文面に直し、章の grep で旧い文言が 0 件になったことをもって閉じる。
2. 利用者がまだ確かめていない細部 (章の値で実装する): (a) 表示件数の既定 50 件 (qa-classify-bulk-ui-ux-web-003 の訂正 2026-10-01T10:08:23Z、qa-classify-bulk-backend-web-008 の訂正 10:08:23Z)。(b) 選択の key の上限 200 字 (qa-classify-bulk-security-web-003 の訂正 (2)(3))。(c) 一括保存の旧形式の受け付け (qa-classify-bulk-backend-web-003 の訂正 (4))。閉じ方: 実装の PR のレビューで、実装者 (agent) が 3 点を利用者に示し、利用者が承認するか値を改めた時点で閉じる。改めた場合は同じ PR で直す。
3. C07 の low・info (収集マトリクス監査、PASS の内側の注記): (n-2) 確定セルの qa_refs に置き換え済みの qa が残る。主根拠はすべて置き換え先である。(n-3) database・auth・infrastructure の章が、承認の関連区分の一部を補助根拠に持たない。(n-5) qa-classify-bulk-infrastructure-web-001 はどのセルからも参照されず、参照しない理由の文も自身に無い。閉じ方: 次の system-spec の改訂で、spec 担当 (agent) が qa_refs から置き換え済みの id を外し、補助根拠と参照しない理由を足し、C07 の再監査で 3 件が出なくなったことをもって閉じる。本書の契約には影響しない。
4. C06 の medium 2 件 (ヒアリング監査): qa-classify-bulk-decision-018 と qa-classify-bulk-decision-024 に対する指摘。どちらも確定セルの主 qa_ref ではないので、総合 PASS の内側の注記として扱う。本書の契約は両 qa を主根拠にしていない。閉じ方: 次の system-spec の改訂で、spec 担当 (agent) が両 qa の扱い (置き換えか注記の維持) を利用者に示し、利用者の判断を記録した時点で閉じる。
5. 勘定科目の対応表の API のパスと表・列の名前: 章に無いため実装時に決める (00 I8 が委ね、qa-classify-bulk-decision-058 が agent の案に任せる)。閉じ方: 実装の PR で実装者 (agent) が既存の設定 API の並びに合わせて決め、`docs/data-schema.md` と本書の参照先の architecture 文書に書いた時点で閉じる。
6. 『カテゴリなし』の予約の値の字面: core の 1 か所に置くことは決まっており、字面は実装時に決める (qa-classify-bulk-decision-058)。閉じ方: 実装の PR で実装者 (agent) が、既存のカテゴリの候補と衝突しない字面を core に置き、候補の作成の拒否のテストが通った時点で閉じる。
7. 新しい持ち主へ初期の 5 行を入れる時機: 00 I8 は「新しい利用者の作成時にも入れる」と書くが、今のコードには新しい業務データの持ち主 (user_id) を作る経路が無い (「API: 勘定科目の対応表」の Validation を参照)。章は投入の単位も時機も定めない。本書の契約は、投入の単位を user_id とし、利用者の作成のたびに `TENANT_ID` へ入れ直さないところまでで、既存の持ち主 (`TENANT_ID`) への migration の投入は決まっているので実装を止めない。閉じ方: 実装の PR で実装者 (agent) が、新しい持ち主へ入れる時機の案を利用者に示し、利用者の判断のとおりに入れて、O3 の API テスト (まだ対応表を持たない user_id に初期の 5 行が入り、消した行が戻らない) が通った時点で閉じる。
