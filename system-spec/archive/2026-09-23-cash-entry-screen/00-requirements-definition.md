---
status: confirmed
category: requirements-definition
---

# 要件定義書 (上位概念)

> 本章は spec-state.json の requirements_foundation を正本とする、システム構築の憲法。
> 以降の各技術章は frontmatter の serves_goals でここ (ゴール) へトレース (anchor) する。
> 上位概念がブレなければ、仕様が整った後もブレない。

- 確定マーカー: `status: confirmed`

## U1 本質的目的 (essential_purpose)

現金入力画面を、『現金と交通費を、漏れなく記録しますか？』という問いに 1 画面で答え切る場にする。銀行・カードの取込に乗らない現金の支払い・受け取りと交通費を、外出から戻ったその場で入力し、同じ画面で一覧・合計を見て訂正まで済ませる。入力途中の離脱や誤削除で記録が欠けないこと (下書きの自動保存と、論理削除による元に戻す) を通じて、集計・月次クローズ・AI分析の入力である台帳から現金の欠けを無くす。

## U2 背景 (background)

現行の /cash (packages/web/src/pages/Cash.tsx、724 行の 1 ファイル) は入力フォームと月別の表だけで、キーワード検索・収支/カテゴリ/名義/入力経路の絞り込み・収入/支出/差額の合計・ページングが無い。削除はモーダル確認のうえ物理削除 (DELETE) で戻す手段が無く、入力途中の内容はページを離れると消える。事業/家計・収支は select で、交通費に入替ボタンと業務の目的が無い。担当者 (名義) と入力経路は DB に列が無い。一方、証憑 (領収書) の保管は以前に廃止し『税務上の正本は freee』と決めている。design/FINAL-UI/images/17-cash.png がこれらを 1 画面に並べた完成形を示したため、画面を作り直す。

## U3 ゴール (goals)

| ID | ゴール |
|---|---|
| G1 | /cash を 17-cash.png どおりの画面にする。問いの見出しと説明、共通の期間 (1年 / 2年 / 3年 / 任意) と対象期間カード、通常入力 / 交通費入力のタブ、現金明細の入力 (日付・事業/個人・収支・金額・内容・カテゴリ・担当者・メモ 0/200・入力をクリア・現金明細を追加・下書き自動保存の表示)、交通費の入力 (出発駅・到着駅・入替・片道運賃・往復・合計金額・業務の目的・メモ・交通費として追加)、現金明細の一覧 (月送り・キーワード検索・4 種の絞り込み・詳細検索・収入/支出/差額の合計・選択・編集/削除・ページング)、インラインの削除確認と元に戻す、空状態、下部固定の追加バーを描く。 |
| G2 | 記録が消えない。入力途中の内容はブラウザ内に自動保存して復元でき、削除は論理削除として一覧と集計から外したうえで『元に戻す』で同じ行を復活でき、30 日後に夜間処理で完全に消える。 |
| G3 | 画面の数字と判定を core の 1 か所から導く。合計・絞り込み・ページング・入力経路・交通費の合計・入力検証を core の純関数に置き、API は JSON に写すだけ、web は描くだけにする。 |
| G4 | 現金明細の入力と変更を安全に保つ。利用者ごとの分離、入力検証、削除・復元の権限確認、削除済み行を集計へ混ぜない不変条件を API と DB の両方で守る。 |

## U4 目標 (objectives)

| ID | 目標 | 測定基準 |
|---|---|---|
| O1 | 現金入力画面が画像の全構成要素を描画する (領収書欄を除く)。 | DOM テストで、問いの見出し・対象期間カード・2 つのタブ・通常入力の全項目とメモの文字数・交通費入力の全項目と入替・合計金額の自動計算・一覧の月送り/検索/4 種の絞り込み/合計 3 枚/表/ページング・インライン削除確認・元に戻すトースト・空状態・下部固定バーの存在を確認し、全て通る。 |
| O2 | 下書きと論理削除で記録が欠けない。 | DOM テストで入力→再描画後に下書きが復元されること、API テストで削除→元に戻すで同じ id が一覧に戻ること、削除中の行が集計 (cashToDeal / cashToTx の入力) に 0 件であることが通る。 |
| O3 | 画面の導出が core の 1 か所に集まる。 | core の cash-screen の単体テストが合計・絞り込み・ページング・入力経路・交通費合計を固定し、web と api に同じ計算の重複が無い (grep で 0 件)。 |
| O4 | 既存の品質ゲートを緑のまま保つ。 | pnpm lint・typecheck・test・skills:test・初期 JS 予算・verify:full が全て exit 0。 |

## U5 成功基準 (success_criteria)

- S1 (G1): /cash で 17-cash.png の構成要素 (領収書欄を除く) がすべて描画され、色・余白・部品はトークンと共通部品経由で、直書き色の lint が 0 件である。
- S2 (G2): 削除した現金明細が『元に戻す』で同じ id のまま一覧に戻り、削除中は一覧・合計・集計のどこにも現れない。入力途中の内容は再読込後に復元される。
- S3 (G3): 合計・絞り込み・ページング・入力経路・交通費合計が core の cash-screen だけで計算され、API と web はその結果を写すだけである。
- S4 (G4): 他の利用者の明細の取得・変更・削除・復元が 404 になり、不正な入力 (実在しない日付、範囲外の金額、候補外の名義・カテゴリ・業務の目的、長すぎる文字列) が 400 になる。

## U6 ステークホルダー (stakeholders)

- SH1 利用者 (個人事業主とその家族の家計を 1 人で管理する): 外出先で使った現金や電車代を、戻ったその場で漏れなく記録し、月次クローズの前に今月の現金の出入りを一覧と合計で確かめたい。途中で離れても入力が消えず、消してしまっても戻せることを期待している。
- SH2 家族 (配偶者・家族の名義で支出する): 利用者が名義 (担当者) を付けて記録することで、誰の支出かが集計で区別される。

## U7 スコープ (scope)

- **対象 (in)**: 現金入力画面 (17-cash.png の構成要素と読込 / 空 / 失敗の各状態) の作り直しと、Cash.tsx の pages/cash/ 配下への分割, 通常入力と交通費入力の 2 タブ。交通費は出発駅・到着駅の入替、往復の自動計算、業務の目的 (固定選択肢＋その他), 一覧の月送り (共通の期間の範囲内)、キーワード検索、収支・カテゴリ・担当者・入力経路の絞り込み、詳細検索 (金額と日付の範囲)、収入/支出/差額の合計、選択と一括削除、ページング, インラインの削除確認と、削除完了トーストの『元に戻す』。論理削除 (deleted_at) と 30 日後の夜間完全消去, 担当者 = 既存の名義 (business / spouse / family) の列、業務の目的の列、論理削除の列を cash_entries へ追加する migration (入力経路は交通費の区間の有無から導く), core の純関数 cash-screen (合計・絞り込み・ページング・入力経路・交通費合計・入力検証) と API の拡張, 下書きのブラウザ内自動保存と保存時刻の表示、画面内だけのサンプル表示、下部固定の追加バー
- **対象外 (out)**: 領収書ファイルの保存 (以前の廃止決定を維持し、欄の代わりに freee への保管を案内する。qa-cash-decision-001), 取込 (MF / freee) の現金明細を一覧に混ぜること (qa-cash-decision-004), 共通シェルの文言 (取引ライン / 防衛ライン、フッター) の変更。画像の文言は期待値にしない, 担当者の自由登録と管理画面 (qa-cash-decision-002), モバイル・タブレット・デスクトップ専用アプリ

## U8 制約 (constraints)

- C1 技術: pnpm monorepo (core は依存ゼロの純関数、api は Hono の Cloudflare Worker と D1/Drizzle、web は React 18 + react-router-dom 7 + TanStack Query 5)。判定と導出は core に置き api/web は写すだけにする。
- C2 データ: D1 の migration は 0050 から採番する。既存の cash_entries の行と集計結果 (cashToDeal / cashToTx) を変えない。論理削除の列を足した後、全ての読み取り経路が deleted_at IS NULL で絞る。
- C3 運用: 夜間の scheduled 処理 (0 18 * * *) の予算内に完全消去を相乗りさせる。単一利用者の運用で、マルチテナントは対象外。
- C4 品質: 初期 JS 予算・verify:full・skills:test を緑のまま保つ。税務上の正本は freee であり、本画面は税務判断をしない。

## U9 具体的にやりたいこと (concrete_intents)

| ID | やりたいこと | 資するゴール |
|---|---|---|
| I1 | Cash.tsx を pages/cash/ 配下へ分割し、問いの見出し・対象期間カード・タブ・入力 2 枚・一覧・下部固定バーの構成に作り直す。選択中のタブ・月・絞り込み・ページを URL に保つ。 | G1 |
| I2 | core に cash-screen を新設し、合計 (収入・支出・差額)、絞り込み (キーワード・収支・カテゴリ・名義・入力経路・金額と日付の範囲)、ページング、入力経路、交通費合計を純関数で導く。 | G3 |
| I3 | cash_entries に owner・transit_purpose・deleted_at を足す追加のみの migration 0050 (入力経路は列を持たず交通費の区間の有無から導く) と、削除・復元・一括削除・一括復元の API、削除中の行を読まない条件を cash_entries を読む全経路 5 本 (loadCashEntries・BACKUP_SNAPSHOT_SQL・loadImportRestoreSettingsSnapshot・loadCategoryUsageContext・PUT の既存行取得) に掛けること、夜間の完全消去を実装する。 JSON 復元の『空か』判定だけは削除中の行も数え、削除中の行が残る間は現金明細を復元しない (qa-cash-decision-009)。 | G2, G4 |
| I4 | 入力途中の内容をブラウザ内に自動保存し、保存時刻を表示し、復元する。『入力をクリア』で下書きも消す。 | G2 |
| I5 | 削除をインライン確認にし、削除完了トーストの『元に戻す』で同じ行を復活させる。空状態では画面内だけのサンプル表示と『はじめての明細を入力』を出す。 | G1, G2 |
| I6 | 入力検証 (名義・業務の目的・カテゴリの候補、文字数、金額の範囲) を core と API の zod で揃え、他の利用者の行を 404 にする。 | G4 |

## 確定の接地根拠 (承認)

> 上の `status` を確定たらしめている利用者承認の実体。承認範囲がここに現れない項目は、本章の確定内容ではない。

### 承認: `appr-foundation-cash-004`

現金入力画面サイクルの要件定義について、appr-foundation-cash-003 で縮めた形で示した U4 の O1〜O4 と各測定方法、U7 scope.in の 7 項目を、今回は spec-state.json に保存済みの文面のまま (逐語・省略なし) 示し、利用者が『この逐語で承認』を選択。同時に JSON 復元の件数の例外 (qa-cash-decision-009) を決定し、I3 に 1 文足した。U1〜U3・U5・U6・U8・U9 のその他の文面は appr-foundation-cash-002 / 003 から変えていない。承認の受領直後に実測した時刻 2026-09-21T22:44:32Z (承認時刻の上界)。basis=user-decision。

#### この承認を名指ししている質疑: `qa-cash-backend-web-005`

**問**

削除中の行を読まない条件と一括復元を含めて、API は何を返し何を拒否するか。

**答**

core の cash-screen.ts が合計・絞り込み・ページング・入力経路・交通費の合計・入力検証を導き、API は JSON に写すだけにする。DELETE /api/cash-entries/:id は論理削除 (deleted_at を付けて同じ batch で取引と集計を作り直す)、POST /api/cash-entries/:id/restore は同じ id を戻し、POST /api/cash-entries/bulk-delete と POST /api/cash-entries/bulk-restore は 100 件までの id 配列を 1 batch で処理し、他の利用者の id や完全消去済みの id を 1 件でも含めば全体を 404 にする。削除中の行を読まない条件 (deleted_at IS NULL) を cash_entries を読む全経路 5 本 — loadCashEntries (store.ts。一覧と loadDataset が使う)、バックアップの BACKUP_SNAPSHOT_SQL (store.ts。エクスポートと夜間バックアップが共有)、取込時の設定スナップショット loadImportRestoreSettingsSnapshot (store.ts)、科目使用状況 loadCategoryUsageContext (routes/settings.ts)、PUT の既存行取得 (routes/cash.ts) — に掛け、PUT は削除中の行を 404 にする。新しい restore / bulk-delete / bulk-restore の経路は canonical-mutation-fence に登録し、既存の POST / PUT / DELETE と同じ書込の順序保証に乗せる。POST / PUT は owner と transit_purpose を受ける。例外は 1 つだけで、JSON 復元の『移行先の現金明細が 0 件か』の判定だけは削除中の行も数える (loadImportRestoreSettingsSnapshot の destination_counts に、削除中を含む現金明細の件数を 1 つ足す)。削除中の行が残っている間は現金明細を復元せず、理由を表示する。バックアップの id をそのまま INSERT して主キーが衝突し、復元全体が失敗することを防ぐためである。件数のほかに、削除中の行の中身はどの出力にも出さない (qa-cash-decision-009)。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: 利用者の承認 (appr-foundation-cash-004、qa-cash-decision-010) と、決定 qa-cash-decision-006 (一括復元) / 009 (JSON 復元の件数の例外) の範囲に収まる確定内容。前回の確定 (qa-cash-backend-web-004) に例外の記述を足した。JSON 復元の判定は routes/imports.ts と store.ts の現物で確認した。 / 回答時刻: 2026-09-21T22:45:23Z)

#### この承認を名指ししている質疑: `qa-cash-database-web-005`

**問**

現金明細の名義・業務の目的・論理削除を D1 にどう持ち、どの読み取り経路で削除中の行を外すか。

**答**

追加のみの migration 0050 で cash_entries に owner (TEXT NULL、business / spouse / family の CHECK)、transit_purpose (TEXT NULL)、deleted_at (TEXT NULL) を足し、(user_id, deleted_at) の索引を張る。既存行は書き換えない。削除中の行を読まない条件 (deleted_at IS NULL) は cash_entries を読む全経路 5 本 — loadCashEntries (store.ts。一覧と loadDataset が使う)、バックアップの BACKUP_SNAPSHOT_SQL (store.ts。エクスポートと夜間バックアップが共有)、取込時の設定スナップショット loadImportRestoreSettingsSnapshot (store.ts)、科目使用状況 loadCategoryUsageContext (routes/settings.ts)、PUT の既存行取得 (routes/cash.ts) — に掛け、集計・取引の導出、バックアップ、取込時の設定スナップショットは削除中の行を一切読まない。JSON 復元の INSERT は新しい列を持つ形に合わせる。schema-guard.ts の EXPECTED_D1_MIGRATION を 0050 の migration ファイル名へ進め、migration 前の D1 では Worker が論理削除の経路を動かさないようにする。例外は 1 つだけで、JSON 復元の『移行先の現金明細が 0 件か』の判定だけは削除中の行も数える (loadImportRestoreSettingsSnapshot の destination_counts に、削除中を含む現金明細の件数を 1 つ足す)。削除中の行が残っている間は現金明細を復元せず、理由を表示する。バックアップの id をそのまま INSERT して主キーが衝突し、復元全体が失敗することを防ぐためである。件数のほかに、削除中の行の中身はどの出力にも出さない (qa-cash-decision-009)。夜間 cron の完全消去 job は /api/* に掛かる schema guard の外で動くため、migration 0050 の適用 (Migrate) を Worker の配備 (Deploy) より先に行う既存の順序で守る。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: 利用者の承認 (appr-foundation-cash-004、qa-cash-decision-010) と、決定 qa-cash-decision-009 (JSON 復元の件数の例外) の範囲に収まる確定内容。前回の確定 (qa-cash-database-web-004) に例外の記述を足した。JSON 復元の判定は routes/imports.ts と store.ts の現物で確認した。 / 回答時刻: 2026-09-21T22:45:23Z)

#### この承認を名指ししている質疑: `qa-cash-security-web-005`

**問**

現金明細の入力・削除・復元・一括操作で何を拒否し、何を守るか。

**答**

API の zod で名義・業務の目的・収支・事業 / 個人を候補に限り、実在しない日付、金額の範囲外、長すぎる文字列 (内容 60 字・メモ 200 字・駅名 40 字・その他の目的 40 字) を 400 で拒否する。一括削除と一括復元の id 配列は 100 件までで、他の利用者の id を 1 件でも含めば全体を 404 にして何も変えない。削除中の行は PUT でも 404 にし、編集で復活させない。新しい restore / bulk-delete / bulk-restore は canonical-mutation-fence に登録する。削除中の行が一覧・合計・取引・集計・バックアップ (BACKUP_SNAPSHOT_SQL)・取込時の設定スナップショット (loadImportRestoreSettingsSnapshot)・科目使用状況のどこにも出ない不変条件を API テストで固定する。下書きはブラウザ内だけに置きサーバーへ送らない。領収書ファイルは受け取らない。例外は 1 つだけで、JSON 復元の『移行先の現金明細が 0 件か』の判定だけは削除中の行も数える (loadImportRestoreSettingsSnapshot の destination_counts に、削除中を含む現金明細の件数を 1 つ足す)。削除中の行が残っている間は現金明細を復元せず、理由を表示する。バックアップの id をそのまま INSERT して主キーが衝突し、復元全体が失敗することを防ぐためである。件数のほかに、削除中の行の中身はどの出力にも出さない (qa-cash-decision-009)。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: 利用者の承認 (appr-foundation-cash-004、qa-cash-decision-010) と、決定 qa-cash-decision-006 (一括復元) / 009 (JSON 復元の件数の例外) の範囲に収まる確定内容。前回の確定 (qa-cash-security-web-004) に例外の記述を足した。JSON 復元の判定は routes/imports.ts と store.ts の現物で確認した。 / 回答時刻: 2026-09-21T22:45:23Z)


## 意思決定支援 (decisions)

- (意思決定支援の記録なし)
