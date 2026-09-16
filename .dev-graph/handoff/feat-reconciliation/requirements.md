# 04 照合画面 作り直しと照合専用 API・共通シェル・アイコン — 実装要件

- Feature: `feat-reconciliation`
- Package: `feature-package/feat-reconciliation`
- Handoff target: `task-graph`
- Snapshot: `sha256:ddb836b6af870607fc2a1e3e17c596246a95aa649898efca45bcea7517413d32`
- System plan: `sha256:76c705dfa24c67d6b3bf7e3e42d55f2e7b60c0a316f4df01b0343abd909431ad`
- Readiness: **PASS**（missing sections 0、3 gate 同一 snapshot）

契約正本は `specs/spec-reconciliation.md`。本書は要件と system task の対応だけを持ち、実装コードや task spec を生成しない。

## 目的

照合画面を、帳簿 (freee の仕訳) と口座 (MoneyForward の取引) の差異を「どこから解消するか」判断し、一件ずつ確認・照合・別取引として処理・除外・元に戻すまでを 1 画面で完結できる作業場にする。現行の照合画面はデータ取得が GET /api/business-spend の 1 本だけである。

## 到達状態

/analysis/reconciliation が 04-reconciliation.png の全構成要素をトークンと共通部品で描画し、一致度・一致の理由・ステータス・対応キュー・KPI の規則が core の境界値テストと docs で固定されて照合画面・ハブのバッジ・総収支の要確認件数が一致し、照合 / 別取引 / 除外 / 一括 / 元に戻すが照合専用 API と追加 migration で永続化され、共通シェル (サイドバー文言と件数バッジ・月次クローズ 3/4・ヘッダー・フッター・改善を送る) と画像の全アイコンが揃い、既存の test / typecheck / lint / check 系が緑のままの状態。

## 実装要件

### REQ-RC-001 照合判定の一致度・内容類似・一致の理由

packages/core の純関数で、一致度を 金額一致 50 + 日付差 (同日 30 / 1 日 20 / 2 日 10 / 3 日 5 / それ以外 0) + 内容類似×20 の 100 点満点で算出し、内容点は二値化せず連続値にする。内容類似は NFKC・空白除去・小文字化で正規化した文字 bigram の Dice 係数とし、0.5 以上で一致の理由の内容行にチェックを付ける。内容類似 1.0 / 0 / 0.67 / 0.33、アマゾン と Amazon.co.jp が 0、ちょうど 0.5 と 0.5 未満、日付差 3 日と 4 日、金額一致と不一致の境界を core 単体テストで確かめる。

- 根拠: FR-003 / BR-001 / BR-002 / O2 / AC-002 / qa-reconciliation-decision-003 / qa-backend-web-rc-decision-011 / qa-backend-web-rc-decision-012 / qa-backend-web-rc-decision-013
- 担当 task: `SYS-RECON-P02`、`SYS-RECON-P03`、`SYS-RECON-P04`、`SYS-RECON-P05`、`SYS-RECON-P07`
- Source: `specs/spec-reconciliation.md`、`features/feat-reconciliation.md`

### REQ-RC-002 ステータス・対応キュー 4 分類・KPI・解消率

core でステータス (未処理 / 要確認 / 照合済み / 除外)、対応キュー 4 分類 (要確認の候補 / MF未計上 / 金額の差異=日付差 ±3 日以内かつ内容類似 0.5 以上かつ金額不一致 / 日付の近い取引=金額一致で日付差 1〜3 日)、KPI 4 種 (事業支出 / MF未計上の件数と金額 / 要確認件数 / 解消率) を 1 か所で導出する。解消率は 照合済み ÷ (照合済み + 要確認 + 未処理) で除外を分母に入れず、分母 0 は『対象なし』とする。キュー条件の各辺を 1 つずつ外すと所属が外れることと、分母 0 の扱いを core 単体テストで確かめる。

- 根拠: FR-003 / BR-003 / BR-004 / BR-005 / O2 / AC-002 / qa-backend-web-rc-decision-010 / qa-backend-web-rc-decision-013
- 担当 task: `SYS-RECON-P02`、`SYS-RECON-P03`、`SYS-RECON-P04`、`SYS-RECON-P05`、`SYS-RECON-P07`
- Source: `specs/spec-reconciliation.md`、`features/feat-reconciliation.md`

### REQ-RC-003 判断と除外の反映による 3 か所の件数一致

照合判断は duplicate_verdicts を総収支と共用し、bindDuplicateVerdicts で tx_id→stable_key の順に結び直す。buildExpenseProjection とハブのバッジに判断と除外を受け取らせ、api/web へ判定を重複実装しない。同じデータで GET /api/reconciliation の要確認件数・支出分析ハブのバッジ・総収支の要確認件数が一致することを統合テストで確かめ、ずれたときの切り分け手順を runbook に残す。

- 根拠: FR-003 / BR-007 / O2 / AC-002 / qa-reconciliation-decision-002
- 担当 task: `SYS-RECON-P02`、`SYS-RECON-P04`、`SYS-RECON-P05`、`SYS-RECON-P07`、`SYS-RECON-P12`
- Source: `specs/spec-reconciliation.md`、`features/feat-reconciliation.md`

### REQ-RC-004 GET /api/reconciliation による照合レポートの一括取得

GET /api/reconciliation を新設し、期間クエリだけを受けて KPI・対応キュー 4 分類の件数・期間内の候補全件 (ステータス・日付・MF の取引内容・金額・freee の候補・差額・一致度・一致の理由)・下段 2 表・直前の操作を 1 回で返す。route は loadDataset・freee 系テーブル・MF 除外・操作履歴を読んで core へ渡す adapter に留め、全読取りを userId で絞る。既存 GET /api/business-spend と GET /api/total-cashflow は残す。認証付き 200、未認証 401、他利用者のデータが混ざらないことを API 統合テストで確かめる。

- 根拠: API GET /api/reconciliation / FR-004 / BR-001..BR-005 / BR-007 / O2 / AC-002 / qa-backend-web-rc-decision-007
- 担当 task: `SYS-RECON-P02`、`SYS-RECON-P03`、`SYS-RECON-P04`、`SYS-RECON-P05`、`SYS-RECON-P07`
- Source: `specs/spec-reconciliation.md`、`features/feat-reconciliation.md`

### REQ-RC-005 POST /api/reconciliation/actions による照合・別取引・除外・一括の保存

POST /api/reconciliation/actions で action (same / different / exclude-mf / exclude-freee) を保存し、same / different は duplicate_verdicts、exclude-freee は freee_deal_exclusions、exclude-mf は mf_tx_exclusions へ書き、操作前後の判断を reconciliation_actions に記録する。一括は 1〜200 件で件ごとの成否を返す部分成功とし、成功後に ['reconciliation', period]・analysisHubQueryKey・['total-cashflow', period]・['summary', period] を invalidate する。各 action の保存が再読込後も保持されること、200 件受理・201 件 400・部分成功の内訳を API 統合テストで確かめる。

- 根拠: API POST /api/reconciliation/actions / FR-004 / BR-009 / O3 / AC-003 / qa-reconciliation-decision-002
- 担当 task: `SYS-RECON-P02`、`SYS-RECON-P03`、`SYS-RECON-P04`、`SYS-RECON-P05`、`SYS-RECON-P07`、`SYS-RECON-P09`
- Source: `specs/spec-reconciliation.md`、`features/feat-reconciliation.md`

### REQ-RC-006 POST /api/reconciliation/actions/:id/undo による直前の操作の取消

直前の操作 1 件 (一括なら一括単位) だけを、reconciliation_actions に保存した操作前の判断へ 1 回の D1 batch で書き戻し、判断・除外・履歴の取消済みフラグを同じ単位で更新する。取消済みの操作は再取消できず、中間の操作は各行の判断解除で戻す。user_id 一致を WHERE 条件に含め、他人または存在しない操作 id は 404 にする。照合→取消で KPI とキューが操作前の値へ戻ること、一括の取消が一括単位で戻ること、他人の id で 404 を API 統合テストで確かめる。

- 根拠: API POST /api/reconciliation/actions/:id/undo / FR-004 / BR-008 / O3 / AC-003 / qa-database-web-rc-decision-008
- 担当 task: `SYS-RECON-P02`、`SYS-RECON-P03`、`SYS-RECON-P04`、`SYS-RECON-P05`、`SYS-RECON-P07`
- Source: `specs/spec-reconciliation.md`、`features/feat-reconciliation.md`

### REQ-RC-007 D1 新表 3 件の追加 migration と保持・バックアップ整合

0040 以降の追加だけの migration で mf_tx_exclusions・reconciliation_actions・monthly_reviews を CREATE し、duplicate_verdicts (0036)・freee_deal_exclusions (0037) の列を変えず、バックフィルを持たない。利用者の意思 (判断・除外・操作の事実・月次レビュー完了) だけを保存し、一致度・キュー・KPI・解消率・月次クローズの自動 3 ステップは保存しない。reconciliation_actions は 90 日を超えた行だけを既存の夜間 cron (0 18 * * *) で削除する。新表をバックアップ/復元の対象に含めてバックアップ関連テストを緑に保ち、DROP/RENAME を含まない CREATE ONLY の migration が deploy.yml の自動適用経路で適用可能と判定されることを確かめる。

- 根拠: FR-004 / O3 / AC-003 / データモデル / qa-reconciliation-decision-002 / qa-database-web-rc-decision-008
- 担当 task: `SYS-RECON-P02`、`SYS-RECON-P03`、`SYS-RECON-P05`、`SYS-RECON-P08`、`SYS-RECON-P13`
- Source: `specs/spec-reconciliation.md`、`features/feat-reconciliation.md`

### REQ-RC-008 照合画面 3 カラムと KPI・下段 2 表・選択中バーの作り直し

Reconciliation.tsx を問いの見出し『帳簿と口座の差異を、どこから解消しますか？』・5 タブ・KPI 4 枚・左 (絞り込みと対応キュー 4 行)・中央 (照合候補一覧 列 8、行選択、ページ送り)・右 (取引の詳細パネル: MF の取引・freee の候補・一致の理由 3 行・一致度バー・同じ取引として照合 / 別の取引として処理 / 仕分けを開く・直前の操作と元に戻す)・下段 2 表と導線・選択中バーの構成に作り直し、行選択で詳細パネルを切り替える。色・余白・部品はトークンと共通 Button/PageShell 経由にし、読込・空・失敗・部分成功・確認の各状態を持つ。一括照合は確認ダイアログで件数を示し、409 は『取込中のため保存できませんでした』と再試行を出す。構成要素と各状態を DOM テストで、直書き色 lint 0 件を lint で確かめる。

- 根拠: FR-001 / O1 / AC-001 / qa-ui-ux-web-rc-decision-006
- 担当 task: `SYS-RECON-P04`、`SYS-RECON-P05`、`SYS-RECON-P07`、`SYS-RECON-P09`
- Source: `specs/spec-reconciliation.md`、`features/feat-reconciliation.md`

### REQ-RC-009 候補一覧の検索・絞り込み・キュー選択・ページ送り

候補一覧の検索 (取引内容・金額・メモ)、絞り込み (データソース・ステータス・対象年月)、キュー選択、ページ送りと件数切替 (10 / 20 / 50 件)、条件リセットを web のコンポーネント状態で持ち、検索語と絞り込みは URL にもサーバーにも送らない。選択中の行は MF tx id で持ち、絞り込みで見えなくなった選択も選択中バーの件数に含め『選択をクリア』で外せる。絞り込み・検索・ページ送りで結果が変わり、リセットで初期状態に戻ることを DOM テストで確かめる。

- 根拠: FR-002 / O1 / AC-001
- 担当 task: `SYS-RECON-P04`、`SYS-RECON-P05`、`SYS-RECON-P07`
- Source: `specs/spec-reconciliation.md`、`features/feat-reconciliation.md`

### REQ-RC-010 共通シェルと月次クローズ進捗 3/4・月次レビュー完了

routeMetadata のグループ (取込 / 整える / 確認 / 計画 / 管理) と文言を画像に揃え、ページ見出し・パンくず『確認 / 支出分析 / 照合』・コマンドパレットを追随させ、件数バッジ (データ取込=要確認の取込件数・明細仕分け=未整理明細数・サブスク=判定待ち候補数・照合=要確認件数)、ヘッダーのアイコンボタン、フッター、改善を送るボタンを共通シェルに入れる。月次クローズは直近の締め月について データ取込=未記録月 0・仕分け=未整理明細 0・照合=要確認+MF未計上 0 を自動判定し、月次レビューは利用者の完了操作を月単位で monthly_reviews に保存し取消できるようにして、月次レビュー API を authGuard 配下へマウントする。shell 系 DOM テストの更新と月次レビュー API の統合テストが緑で、既存ルートと旧 URL のテストが緑のままであることを確かめる。

- 根拠: FR-005 / BR-006 / O4 / AC-004 / qa-reconciliation-decision-001 / qa-reconciliation-decision-004 / qa-reconciliation-decision-005
- 担当 task: `SYS-RECON-P02`、`SYS-RECON-P04`、`SYS-RECON-P05`、`SYS-RECON-P07`
- Source: `specs/spec-reconciliation.md`、`features/feat-reconciliation.md`

### REQ-RC-011 画像内アイコンの網羅登録と重複検査

04-reconciliation.png で使われるアイコンの対応表を docs/reconciliation-icons.md に書き、不足分を lucide-static 由来の SVG として RouteIcon に登録して KPI・キュー・ステータス・一致の理由・操作ボタン・ヘッダー・フッター・サイドバーで表示する。外部アイコンライブラリは追加しない。docs の一覧と RouteIcon の登録名の一致、各表示箇所の svg の存在と aria-hidden、route-icon-distinct テストの絵柄重複なしを DOM テストで確かめる。

- 根拠: FR-006 / O5 / AC-005 / 非機能 (アイコン網羅)
- 担当 task: `SYS-RECON-P04`、`SYS-RECON-P05`、`SYS-RECON-P07`、`SYS-RECON-P09`
- Source: `specs/spec-reconciliation.md`、`features/feat-reconciliation.md`

### REQ-RC-012 判定規則の docs 記載と境界値テストによる固定

一致度・キュー・ステータス・月次クローズ判定の規則と、カナと英字の表記違いが内容類似 0 になる限界を docs/data-schema.md に書き、古い候補条件 (L120-124) を新規則へ直す。規則を変えると core テストが落ちる状態にし、docs/reconciliation.md の規則要約と docs/data-schema.md が実装と矛盾しないことを最終同期で確かめる。

- 根拠: FR-007 / BR-002 / O2 / AC-002
- 担当 task: `SYS-RECON-P01`、`SYS-RECON-P04`、`SYS-RECON-P05`、`SYS-RECON-P12`
- Source: `specs/spec-reconciliation.md`、`features/feat-reconciliation.md`

### REQ-RC-013 書き込み排他・入力検証・認可境界

照合の書込系 (actions・undo・月次レビュー完了) と既存 POST /api/total-cashflow/verdicts を CANONICAL_MUTATION_ROUTES に加え、取込 (POST /api/imports・/api/restore) と重なる書込を 409 canonical_write_busy で拒否する。新 route は authGuard → mustChangePasswordFence → runtimeSchemaGuard → canonicalMutationFence の後に置き、読み書きを userId で絞る。zValidator で action 列挙 4 種・件数 1〜200・tx id と freee key の形を検証し、取引内容は React のテキストとして描画して innerHTML を使わず、外部送信しない。未認証 401・列挙外 action / 201 件 / id 形式不正で 400・取込中 409 を API 統合テストで確かめる。

- 根拠: 非機能 (Security/Privacy・書き込み排他) / API POST /api/reconciliation/actions / API POST /api/reconciliation/actions/:id/undo / FR-004 / FR-005 / AC-003 / qa-security-web-rc-decision-009
- 担当 task: `SYS-RECON-P02`、`SYS-RECON-P03`、`SYS-RECON-P04`、`SYS-RECON-P05`、`SYS-RECON-P09`
- Source: `specs/spec-reconciliation.md`、`features/feat-reconciliation.md`

### REQ-RC-014 アクセシビリティと狭幅レイアウト

WCAG 2.2 AA を維持し、ステータスは文字のバッジ、一致の理由はチェックアイコンと文言、一致度は数値とバーの両方で示して色だけに頼らず、操作の結果はその場で知らせる。狭幅 (アイコンレール・下部タブ) では KPI→対応キュー→候補一覧→詳細→下段 2 表 の順に縦積みして絞り込みを折りたたみ、横スクロールしない。check:mobile-layout と check:financial-routes の対象に /analysis/reconciliation を含めて exit 0 を確かめる。

- 根拠: 非機能 (Accessibility/Usability) / AC-001 / AC-006 / qa-ui-ux-web-rc-decision-006
- 担当 task: `SYS-RECON-P05`、`SYS-RECON-P07`、`SYS-RECON-P09`
- Source: `specs/spec-reconciliation.md`、`features/feat-reconciliation.md`

### REQ-RC-015 初期 JS 予算と D1 読取り・一括件数の性能制約

照合画面の追加で初期 JS を packages/web/scripts/check-initial-js-budget.mjs の予算内 (gzip 110KiB) に保ち、check:js-budget を build:bundle の直後に実行して exit 0 を確かめる。GET /api/reconciliation の D1 読取りは既存 /total-cashflow と同程度で d1-limits.ts の制限内に保ち、一括操作は 200 件で打ち切る。

- 根拠: 非機能 (Performance・JS 予算) / BR-009 / AC-006
- 担当 task: `SYS-RECON-P05`、`SYS-RECON-P09`
- Source: `specs/spec-reconciliation.md`、`features/feat-reconciliation.md`

### REQ-RC-016 品質ゲート・非退行・運用文書と単一 PR 配信

要件ベースラインの転記から始め、pnpm test / typecheck / lint と packages/web の check 系 (thead / mobile-layout / financial-figure / financial-routes) を緑に保つ。Worker・binding・cron・デプロイ経路は変えない。AC-001..AC-006 と S1..S6 を実測で受入検証し、再実行可能な証跡索引を残す。照合機能の docs と件数ずれの runbook を整え、build:artifact と github-scripts:test を緑にして単一 PR で配信し、Worker を直前ビルドへ戻し新表は残置する rollback 手順を記録する。

- 根拠: 非機能 (Availability/Reliability・Maintainability/Operability) / AC-006 / S6
- 担当 task: `SYS-RECON-P01`、`SYS-RECON-P06`、`SYS-RECON-P07`、`SYS-RECON-P11`、`SYS-RECON-P12`、`SYS-RECON-P13`
- Source: `specs/spec-reconciliation.md`、`features/feat-reconciliation.md`

## 着手前提

- `SYS-RECON-P01` の着手時に、FR / BR / API 3 本 / AC / 確定意思決定を `docs/reconciliation/requirements-baseline.md` へ転記し、未決事項 7 件を値を置かずに一覧化する。
- 未決事項 7 件 (`low-content-similarity-rounding` / `low-dice-bigram-multiset-counting` / `low-threshold-0.5-comparison-method` / `low-monthly-review-api-path-and-response` / `low-undo-re-undo-status` / `low-actions-success-status-code` / `low-status-determination-is-inference`) は着手前に値を決めず、`SYS-RECON-P04` の契約テストで確定し、確定値を `SYS-RECON-P11` の `docs/reconciliation/evidence.md` に記録する。`specs/spec-reconciliation.md` への反映は本 package の書込範囲外のため follow-up とする。ステータス判定の推定は推定のまま confirmed にしない。
- plan-findings の low 指摘 2 件のうち、workstream-inventory の source_version 食い違い (0.1.0 と 0.1.14) は `SYS-RECON-P01` で確認して記録し、『元に戻す』の rotate-ccw 併記は `SYS-RECON-P05` で画像と照合して確定する。
- 確定意思決定 13 件 (`qa-reconciliation-decision-001..005` / `qa-backend-web-rc-decision-007` / `010` / `011` / `012` / `013` / `qa-database-web-rc-decision-008` / `qa-security-web-rc-decision-009` / `qa-ui-ux-web-rc-decision-006`) は変更せず、各要件の根拠として引用する。

## 実行グラフ

13 nodes、12 edges、1 root の直列依存。状態・資源・lineage は各 task frontmatter を正本とする。

| Task | 固有成果 | 依存 |
|---|---|---|
| SYS-RECON-P01 | 要件ベースライン確定と未決事項7件の着手時整理 | — |
| SYS-RECON-P02 | 照合 API・D1 新表3件・core 判定規則のワークストリーム設計決定記録 | SYS-RECON-P01 |
| SYS-RECON-P03 | API契約・D1新表設計・一致度規則の独立レビュー | SYS-RECON-P02 |
| SYS-RECON-P04 | core境界値・API統合・DOMの失敗テスト先行作成 (契約テストで7件の未決事項を固定) | SYS-RECON-P03 |
| SYS-RECON-P05 | 照合core判定関数・3API・月次レビューAPI・D1 migration・Reconciliation.tsx・共通シェル・アイコンの実装 | SYS-RECON-P04 |
| SYS-RECON-P06 | 全テスト・型検査・lintの実行記録 | SYS-RECON-P05 |
| SYS-RECON-P07 | AC-001..AC-006・S1..S6受入検証 | SYS-RECON-P06 |
| SYS-RECON-P08 | migration 0040の前進のみ整合とバックアップ/復元対象の整理 | SYS-RECON-P07 |
| SYS-RECON-P09 | アクセシビリティ・入力検証・JS予算・route-icon-distinctの保証確認 | SYS-RECON-P08 |
| SYS-RECON-P10 | 独立最終レビュー | SYS-RECON-P09 |
| SYS-RECON-P11 | 再現可能な証跡索引の作成 | SYS-RECON-P10 |
| SYS-RECON-P12 | docs/runbooksへの切り分け手順とdocs/data-schema.mdの最終同期 | SYS-RECON-P11 |
| SYS-RECON-P13 | 単一PRでの配信とクローズアウト | SYS-RECON-P12 |

`SYS-RECON-P10` (独立最終レビュー) は全要件を横断するため個別要件に割り当てない。

## Readiness

| Gate | 結果 |
|---|---|
| C11 validate-graph-schema | valid、violations 0 |
| C02 saved state | feature + 13 task が confirmed / pass / complete、registration expected 13 = applied 13 |
| validate-system-plan | pass、P01..P13、`sha256:76c705dfa24c67d6b3bf7e3e42d55f2e7b60c0a316f4df01b0343abd909431ad` |

1 周目は task artifact md 13 件の未実体化で blocked となり、C02 `run-dev-graph-node` の dry-run → 本実行で解消した。
