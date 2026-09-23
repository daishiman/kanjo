---
graph_node_id: "spec-cash-screen"
artifact_kind: "specification"
artifact_subtypes: ["frontend", "api"]
title: "現金入力画面 再現仕様 (17-cash.png)"
project_id: "kanjo"
domain: "cash"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: []
tags: ["cash", "ledger"]
file_path: "specs/spec-cash-screen.md"
template_id: "specification"
template_version: "1.0.0"
source_image: "design/FINAL-UI/images/17-cash.png"
route: "/cash"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluator": "system-spec-harness:assign-system-spec-completeness-evaluator", "evidence_ref": "system-spec/completeness-findings.json", "evaluated_digest": "1221f8ca97807d3e6c114b97768bd0b8a92ceba1ada8a80325cbdfffb8152c5b"}
source_lineage: {"origin_kind": "system-spec-harness", "source_plugin": "system-spec-harness", "source_path": "system-spec/00-requirements-definition.md", "source_version": "0.1.14", "source_digest": "1221f8ca97807d3e6c114b97768bd0b8a92ceba1ada8a80325cbdfffb8152c5b", "imported_at": "2026-09-21T22:58:36Z"}
created_at: "2026-09-21T22:58:36Z"
updated_at: "2026-09-21T22:58:36Z"
depends_on: []
related_nodes: ["arch-cash-ui-ux", "arch-cash-frontend", "arch-cash-backend", "arch-cash-database", "arch-cash-auth", "arch-cash-security", "arch-cash-infrastructure", "arch-cash-maintenance-ops"]
resource_scope: ["packages/core/src", "packages/api/src", "packages/web/src", "packages/web/scripts", "packages/api/wrangler.jsonc", "migrations", "package.json", "design/FINAL-UI/images/17-cash.png"]
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
classification_reason: "design/FINAL-UI/images/17-cash.png と利用者決定 qa-cash-decision-001〜010 (上位概念の承認は最新が qa-cash-decision-010 / appr-foundation-cash-004。先行する appr-foundation-cash-002・003) から確定した現金入力画面の再現仕様。利用者が決めていない値は agent の推定として本文で個別に注記した。"
classification_candidates: [{"artifact_kind":"specification","confidence":1.0,"candidate_path":"specs/spec-cash-screen.md"}]
tracker_binding: "none"
beads_linkage: null
github_publication: {"mode":"local_only","project_aliases":[],"labels":[],"milestone":null}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"policy":"manual","status":"not_applicable","source":null,"completed_at":null,"reconciled_at":null,"evidence_refs":[]}
implementation_readiness: {"status": "complete", "missing_sections": [], "checked_at": "2026-09-21T22:58:36Z"}
serves_goals: ["G1", "G2", "G3", "G4"]
---

# 現金入力画面 再現仕様

正本の画像は `design/FINAL-UI/images/17-cash.png`、経路は `/cash`。上位の要件は `system-spec/00-requirements-definition.md` (U1-U9。利用者決定 qa-cash-decision-001〜010。上位概念の承認は最新が appr-foundation-cash-004 (qa-cash-decision-010、U4 と scope.in の逐語承認) で、先行する appr-foundation-cash-002 (全文、qa-cash-decision-005)・appr-foundation-cash-003 (U2・U4・scope.in、qa-cash-decision-007) を引き継ぐ) とカテゴリ別の章 (ui-ux / frontend / backend / database / auth / security / infrastructure / maintenance-ops) にある。本書はそれらを 1 画面の実装単位へ落とした仕様で、画像のどの文言をそのまま再現し、どの値を期待値にしないかを明示する。

注記の約束: 利用者が決めた値は決定 ID (qa-cash-decision-00N、または user-decision の質疑 ID) を添える。system-spec の agent 推定 (qa-cash-*-web-003、basis=agent-inference) から引いた値と、画像にも決定にも値が無く実装の決定論のために本書で置いた値は **「agent 推定・利用者未確認」** と明記する。

行番号は 2026-09-22 時点の現物で確かめた値である。

## 目的と成功状態

目的: 利用者 (個人事業主とその家族の家計を 1 人で管理する本人) が、銀行・カードの取込に乗らない現金の支払い・受け取りと交通費を、外出から戻ったその場で入力し、同じ画面で一覧と合計を見て訂正まで済ませられるようにする。入力途中の離脱と誤削除で記録が欠けないこと (下書きの自動保存と、論理削除による元に戻す) を通じて、集計・月次クローズ・AI分析の入力である台帳から現金の欠けを無くす (U1)。

成功状態:

- `/cash` が 問いの見出し・対象期間カード・通常入力 / 交通費入力のタブ・入力 2 枚・現金明細の一覧・インラインの削除確認・元に戻すトースト・空状態・下部固定の追加バー で描画され、領収書欄だけを除いて画像の構成要素が揃う (G1、S1、qa-cash-decision-001)。
- 入力途中の内容が再読込後に復元され、削除した明細が『元に戻す』で同じ id のまま一覧に戻り、削除中は一覧・合計・取引・集計・バックアップ (BACKUP_SNAPSHOT_SQL)・取込時の設定スナップショット (loadImportRestoreSettingsSnapshot)・科目使用状況 (loadCategoryUsageContext) のどこにも現れない (JSON 復元の件数の例外は qa-cash-decision-009)。30 日後に夜間処理で完全に消える (G2、S2、qa-cash-decision-003 / 006)。
- 合計・絞り込み・ページング・入力経路・交通費合計・入力検証が `packages/core/src/cash-screen.ts` だけで計算され、API と web はその結果を写すだけである (G3、S3)。
- 他の利用者の明細の取得・変更・削除・復元が 404、不正な入力が 400 になる (G4、S4)。

## スコープ

対象 (in):

- 現金入力画面の作り直し。`packages/web/src/pages/Cash.tsx` (現行 724 行の 1 ファイル) を `packages/web/src/pages/cash/` 配下 (画面本体・view-model・下書き・通常入力・交通費入力・一覧・削除確認・ResultNotices・空状態・下部固定バー) へ分割する (I1、qa-cash-frontend-web-001)。
- 通常入力と交通費入力の 2 タブ。交通費は出発駅・到着駅の入替、往復の自動計算、業務の目的 (固定選択肢＋その他)。
- 一覧の月送り (共通の期間の範囲内)、キーワード検索、収支・カテゴリ・担当者・取込元 (入力経路) の絞り込み、詳細検索 (金額と日付の範囲)、収入 / 支出 / 差額の合計、選択と一括削除、ページング。
- インラインの削除確認と、削除完了トーストの『元に戻す』。
- `packages/core/src/cash-screen.ts` の純関数 (合計・絞り込み・ページング・入力経路・交通費合計・入力検証) (I2)。
- 追加のみの migration `0052` (cash_entries への owner・transit_purpose・deleted_at と索引) (I3)。
- API: `DELETE /api/cash-entries/:id` の論理削除化、`POST /api/cash-entries/:id/restore`・`POST /api/cash-entries/bulk-delete`・`POST /api/cash-entries/bulk-restore` の新設、`GET` / `POST` / `PUT` の変更、cash_entries を読む全経路への `deleted_at IS NULL` (I3、qa-cash-backend-web-002)。
- 夜間 scheduled 処理 (`0 18 * * *`) への完全消去 job の相乗り (qa-cash-infrastructure-web-001)。
- 下書きのブラウザ内自動保存と保存時刻の表示、画面内だけのサンプル表示、下部固定の追加バー (I4 / I5)。
- core・API・DOM テストと、web の `check:cash-screen` の verify:full への組み込み (qa-cash-maintenance-ops-web-001)。

対象外 (out):

- 領収書ファイルの保存。以前の廃止決定を維持し、欄の代わりに freee への保管を案内する (qa-cash-decision-001)。
- 取込 (MF / freee) の現金明細を一覧に混ぜること (qa-cash-decision-004)。
- 共通シェル (パンくず・取引ライン・最終更新・検索・サイドバーの月次クローズ・フッター) の変更。既存の PageShell / Layout のまま使う。
- 担当者の自由登録と管理画面 (qa-cash-decision-002)。担当者の表示名は既存の名義ラベル (owner_labels) の設定に従う。
- モバイル・タブレット・デスクトップ専用アプリ (qa-cash-target-platforms-001)。外出先からの入力は既存 web のレスポンシブ規約の中で扱う。
- 既存の cash_entries の行と、集計結果 (cashToDeal / cashToTx) の書き換え (C2)。
- 税務判断。税務上の正本は freee である (C4)。

## 用語と主体

| 用語 | 意味 |
| --- | --- |
| 現金明細 | `cash_entries` の 1 行。事業分 (`side='biz'`) は freee 仕訳と同じ形で科目別集計へ、個人分 (`side='per'`) は口座「現金」の MF 明細 (`cash:<id>`) として家計集計へ合流する (既存の `cashToDeal` / `cashToTx`)。 |
| 担当者 | 明細の名義。既存の名義の語彙 `business` / `spouse` / `family` を `cash_entries.owner` に持つ。表示名は利用者が設定した名義ラベル (画像の「社内」は事業名義のラベル) (qa-cash-decision-002)。 |
| 入力経路 (取込元) | 通常入力 / 交通費入力。列を持たず、交通費の区間 (`transit_from`) があれば交通費入力、無ければ通常入力と導く (qa-cash-decision-004、導き方は qa-cash-database-web-003 の agent 推定)。画面の見出しは画像どおり「取込元」。 |
| 業務の目的 | 交通費の用途。`cash_entries.transit_purpose` に持つ。 |
| 論理削除 | `deleted_at` に時刻を入れ、一覧・合計・取引・集計から外した状態。『元に戻す』で同じ id のまま戻せる (qa-cash-decision-003)。 |
| 削除中の行 | `deleted_at IS NOT NULL` の行。 |
| 完全消去 | 削除から 30 日を過ぎた行を夜間処理で物理削除すること (qa-cash-decision-003、qa-cash-infrastructure-web-001)。完全消去済みの id は戻せない。 |
| 下書き | 入力欄の途中の値。ブラウザの localStorage にだけ置き、サーバーへ送らない (qa-cash-security-web-002)。 |
| 対象期間 | 共通の期間 (`usePeriod`、1年 / 2年 / 3年 / 任意)。サイト全体で共通。 |
| 選択中の月 | 一覧が表示する 1 か月。対象期間の中だけを送れる。 |

主体:

- 利用者: セッション cookie で認証された本人。画面の全操作を行う (SH1)。
- 家族: 利用者が担当者 (名義) を付けて記録することで、誰の支出かが集計で区別される (SH2)。画面は操作しない。
- 夜間処理: `scheduledMaintenance` の job。削除から 30 日を過ぎた行を消す。
- 保守者: 同一人物とコーディングエージェント。規則を core とテストで読む。

## ユースケースとユーザーフロー

1. 現金を記録する: 通常入力タブで 日付・事業/個人・収支・金額・内容・カテゴリ・担当者 (必要ならメモ) を入れる → 入力のたびに下書きが保存され「下書きを自動保存しました YYYY/MM/DD HH:MM」が出る → 「現金明細を追加」(または下部固定バーの「この内容で現金明細を追加」) → 一覧の該当月に行が出て、合計が変わり、入力欄と下書きが空になる (日付・事業/個人・担当者は残す)。
2. 交通費を記録する: 交通費入力タブ (または交通費カード) で 出発駅・到着駅 (必要なら入替)・片道運賃・往復・業務の目的 (必要ならメモ) を入れる → 合計金額が自動で出る → 「交通費として追加」→ 取込元「交通費入力」の支出行が一覧に出る。
3. 途中で離れる: 入力の途中で別の画面へ移る、または再読込する → 戻ると入力欄が下書きから復元され、保存時刻が出ている。
4. 確かめる: 月送りで月を選ぶ → キーワード・収支・カテゴリ・担当者・取込元・詳細検索 (金額と日付の範囲) で絞る → 収入合計・支出合計・収支差額が同じ条件で出る → ページを送る。条件は URL に残り、再読込や共有で同じ表示に戻る。
5. 直す: 行の「編集」→ その行の値が入力欄に入る (交通費の行は交通費カード) → 「変更を保存」→ 行と合計が変わる。
6. 消す: 行の「削除」→ 一覧の下にインラインの確認「この明細を削除しますか？」が対象の明細と金額つきで出る → 「削除する」→ 行が一覧と合計から消え、トースト「明細を削除しました。」と『元に戻す』が出る。
7. 戻す: トーストの『元に戻す』→ 同じ id の行が一覧と合計へ戻る。
8. まとめて消す / 戻す: 行を選ぶ → 選んだ明細の削除 → インライン確認 → 削除 → トーストの『元に戻す』で選んだ全件が戻る (qa-cash-decision-006)。
9. 初めて使う: 明細が無い月では空状態「現金・交通費の明細がありません」が出る → 「はじめての明細を入力」で通常入力の日付欄へ移る。「サンプルデータを表示」で画面内だけのサンプル行を見られる (保存も集計もされない)。
10. 30 日後: 削除したまま 30 日を過ぎた行は夜間処理で完全に消え、以後は戻せない。

## 機能要件

- FR-1 期間: 共通の期間タブ (1年 / 2年 / 3年 / 任意) と範囲の送り、右上の対象期間カード「対象期間（グローバル）」「{開始}年{月}月 - {終了}年{月}月（{N}年）」「サイト全体で共通の分析期間です。」は `usePeriod` の値をそのまま出す。一覧 API へ渡す `from` / `to` は同じ値である。
- FR-2 タブ: 「通常入力 / 現金の支払いや受け取りを入力」「交通費入力 / 電車・バス・タクシーなどの交通費を入力」の 2 つ。選択は URL の `tab` に持つ (qa-cash-frontend-web-001)。
- FR-3 通常入力: 日付 (必須)・事業 / 個人のラジオ (必須)・収支 (収入 / 支出の切替、必須)・金額（円）(必須)・内容・摘要 (必須、例示「例：会議費、備品購入、売上金 など」)・カテゴリ (必須)・担当者 (必須)・メモ (字数 `N/200`)・「両方の入力をクリア」「現金明細を追加」。事業 / 個人と収支は画像どおりラジオ / 切替で出す (現行の select から変える、qa-cash-ui-ux-web-001)。
- FR-4 領収書: 画像の領収書欄 (ファイルを選択 / ドラッグ＆ドロップ) は出さず、同じ位置に「領収書は freee に保管してください」と案内する。ファイルは受け取らない (qa-cash-decision-001)。
- FR-5 交通費入力: 出発駅 (必須)・到着駅 (必須)・入替ボタン・片道運賃（円）(必須)・往復・合計金額（円）(自動計算、読み取り専用)・業務の目的 (必須)・メモ (字数 `N/200`)・「交通費として追加」。見出しの横に「通常入力に切り替え」を置く。
- FR-6 業務の目的: 選択肢は「客先訪問」「打ち合わせ」「仕入れ・買い出し」「研修・セミナー」「その他」。その他を選ぶと 40 字までの自由記述欄が出る (選択肢の語は **agent 推定・利用者未確認**、qa-cash-ui-ux-web-003。40 字の上限は qa-cash-security-web-002)。
- FR-7 担当者: 選択肢は名義 business / spouse / family の 3 つで、表示名は名義ラベル (`resolveOwnerLabels`) に従う。新規入力の既定は事業なら business、個人なら未選択 (**agent 推定・利用者未確認**、qa-cash-database-web-003)。既存行の owner は NULL のままで、一覧は「未設定」と出す (同)。
- FR-8 下書き: 入力途中の値を localStorage に自動保存し、入力欄の下に「下書きを自動保存しました YYYY/MM/DD HH:MM」、下部固定バーに「下書きが保存されています YYYY/MM/DD HH:MM」を出す。画面を開き直すと復元する。追加に成功したとき、および「両方の入力をクリア」で通常入力・交通費入力の両方と下書きを消す (I4、qa-cash-frontend-web-001)。
- FR-9 一覧: 見出し「現金明細の一覧」と説明「登録した現金・交通費の明細を確認・編集・削除できます。」。月送り (前月 / 翌月と「{年}年{月}月」)、キーワード欄 (placeholder「キーワードで検索（内容・メモ・カテゴリなど）」) と「検索」、絞り込み 4 つ (「すべての収支」「すべてのカテゴリ」「すべての担当者」「すべての取込元」)、「詳細検索」(金額の下限・上限、日付の開始・終了)。
- FR-10 合計: 絞り込み後の全件 (ページに関わらない) の「収入合計」「支出合計」「収支差額」を 3 枚のカードに出す。差額は 収入 − 支出 で、正負を符号でも示す。
- FR-11 表: 列は 選択 / 日付 / 区分 / カテゴリ / 内容・摘要 / 担当者 / 金額（円）/ 取込元 / 操作。区分は「収入」「支出」の文字つきバッジ。取込元は「通常入力」「交通費入力」の文字 (qa-cash-decision-004)。操作は「編集」「削除」。
- FR-12 ページング: 1 ページ 20 件 (**agent 推定・利用者未確認**、qa-cash-ui-ux-web-003)。「{始}-{終}件 / {総数}件」と前後の送り・ページ番号。
- FR-13 選択と一括削除: 行の選択欄と、見出し行の「このページをすべて選択」。1 件以上選ぶと表の上に「選択した {N} 件を削除」を出す。選択は 100 件までで、超えるとボタンを無効にして「一度に削除できるのは100件までです」を出す (100 件は qa-cash-decision-006。ボタンの位置と文言は **agent 推定・利用者未確認**)。
- FR-14 削除確認: 削除は行内 (一覧の直下) のインライン確認で行い、モーダルを使わない。確認欄に「この明細を削除しますか？」「削除すると、このデータは一覧から取り除かれます。」、対象の明細 (日付・内容・カテゴリ) と金額、「キャンセル」「削除する」を出す。
- FR-15 元に戻す: 削除の完了後にトースト「明細を削除しました。」と『元に戻す』と閉じるボタンを出す。『元に戻す』は 1 件なら restore、一括なら bulk-restore に削除した id をそのまま渡す (qa-cash-decision-003 / 006)。
- FR-16 空状態: 選択中の月に削除中でない明細が 0 件のとき、「現金・交通費の明細がありません」「上のフォームから現金明細を入力して、記録を始めましょう。」「はじめての明細を入力」「サンプルデータを表示」を出す。サンプルは画面内だけで、保存されず集計にも入らない (I5、qa-cash-ui-ux-web-003)。
- FR-17 下部固定バー: 画面下に固定し、左に下書きの保存時刻、右に「この内容で現金明細を追加」。交通費入力タブのときは「この内容で交通費を追加」(交通費タブでの文言は **agent 推定・利用者未確認**)。
- FR-18 URL: タブ・月・キーワード・4 つの絞り込み・詳細検索・ページを URL の検索パラメータに持ち、再読込と共有で同じ表示に戻す (I1)。キー名は「UI・状態遷移」の表のとおり。
- FR-19 編集: 「編集」でその行の値を入力欄へ入れ、主ボタンを「変更を保存」、副ボタンを「編集をやめる」に替える。交通費入力の行は交通費カードに入れる。編集中は下書きを保存しない (**agent 推定・利用者未確認**)。

## 非機能要件

- 性能: 画面は既存どおり遅延読み込みする。初期 JS 予算 (`check:js-budget`) を超えない (O4)。一覧 API は対象期間で絞った読み取りだけで作り、絞り込み・合計・ページングはブラウザ内で core の純関数が行う (1 か月の現金明細は数十〜数百件の規模を想定)。
- 可用性: migration 0052 の適用前に新しい Worker が動いても壊れないよう、`runtimeSchemaGuard` の期待 head を 0052 に進める。0052 は列と索引の追加だけで、既存行を 1 行も書き換えない。
- 記録の保全: 削除は論理削除で、30 日間は同じ id で戻せる。入力途中の値はブラウザ内に残る (G2)。
- アクセシビリティ: 状態と区分を色だけで伝えない。収支は「収入」「支出」の文字、取込元は「通常入力」「交通費入力」の文字、差額は符号、必須は「必須」の文字、削除の確認と元に戻すは文で結果を伝える (WCAG 2.2 SC 1.4.1、ui-ux 章の上流指針)。入替ボタンと選択欄にはアクセシブルな名前を付ける。
- レスポンシブ: 狭い画面では入力 2 枚と一覧を縦に積み、表は横スクロールの容器に入れ、下部固定バーに安全領域の余白を足す (frontend 章の上流指針)。
- 保守性: 規則 (入力経路の導き方・合計・絞り込み・ページング・交通費合計・入力の上限) を core の 1 か所に置き、web と api に同じ計算を重複させない (O3: grep で 0 件)。
- 見た目: 直書き色 0。色はデザイントークン、ボタンは共通 Button、ページは PageShell。

## UI・状態遷移

### 画面骨格

`/cash` の 1 経路。上から次の順に並べる (qa-cash-ui-ux-web-001)。

1. 共通の期間タブ: 「1年 / 2年 / 3年 / 任意」と、前後の送りつきの範囲表示。
2. タイトル「現金入力」、問いの見出し「現金と交通費を、漏れなく記録しますか？」、説明 2 行「日々の現金の支払いや受け取り、交通費を記録します。」「適切に分類することで、正確な会計データを作成できます。」。右に対象期間カード。
3. タブ: 通常入力 / 交通費入力。
4. 入力: 左に「現金明細の入力」、右に「交通費の入力」。
5. 一覧: 「現金明細の一覧」。
6. インラインの削除確認 (削除を押したときだけ)。
7. 削除完了のトースト (削除の後だけ)。
8. 空状態 (選択中の月が 0 件のときだけ、表の代わり)。
9. 下部固定の追加バー。

タブと 2 枚のカードの関係: 画像は通常入力タブを選んだ状態で 2 枚を左右に並べている。広い画面では 2 枚を常に並べ、タブは「主にする入力」を選ぶ (選んだカードを強調し、下部固定バーの追加先にする)。狭い画面 (1 列) では選んだタブのカードだけを出す。交通費カードの「通常入力に切り替え」はタブを通常入力へ移す。この関係は画像から読んだ解釈で、**agent 推定・利用者未確認** である。

### 通常入力 (現金明細の入力)

- 見出し「現金明細の入力」、右に「下書きを自動保存しました YYYY/MM/DD HH:MM」(下書きがあるときだけ)。
- 1 段目: 日付 (日付入力、必須)・事業 / 個人 (ラジオ「事業」「個人」、必須)・収支 (切替「収入」「支出」、必須)・金額（円）(右寄せの整数、必須)。
- 2 段目: 内容・摘要 (必須、例示「例：会議費、備品購入、売上金 など」、60 字まで)・カテゴリ (必須)・担当者 (必須)。
- 3 段目: メモ (200 字まで、右下に `N/200`)、領収書の案内「領収書は freee に保管してください」。
- ボタン: 「両方の入力をクリア」(副、通常入力・交通費入力の両方が対象)・「現金明細を追加 →」(主)。
- カテゴリの候補は既存どおり、事業 = freee 勘定科目、個人 = MF 大項目・中項目 (既存の `CategoryPicker` と `loadCandidates`)。事業 / 個人を切り替えるとカテゴリを空に戻す。

### 交通費入力 (交通費の入力)

- 見出し「交通費の入力」、右に「通常入力に切り替え」。
- 出発駅 (必須、40 字まで)・入替ボタン (⇅、アクセシブルな名前「出発駅と到着駅を入れ替える」)・到着駅 (必須、40 字まで)。
- 片道運賃（円）(必須)・往復 (チェック)・合計金額（円）(片道 × 往復なら 2、読み取り専用)。
- 業務の目的 (必須、選択肢は FR-6)。その他のとき自由記述 (40 字まで)。
- メモ (200 字まで、`N/200`)。
- ボタン「交通費として追加 →」。
- 交通費の明細は常に支出で、内容は既存の `buildTransitEntry` が「電車代 {出発}→{到着}(往復|片道)」と組み立て、`receiptWaived = true` で保存する (現行と同じ)。
- 画像の交通費カードには 日付・事業 / 個人・担当者・カテゴリの欄が無い。交通費の明細はこれらを通常入力カードの 日付・事業 / 個人・担当者 から取る。カテゴリは事業なら「旅費交通費」(既存の `TRANSIT_CATEGORY`)、個人なら通常入力カードのカテゴリ欄の値を使い、空なら「交通費として追加」を無効にして「個人の交通費はカテゴリを選んでください」を出す。この共有の仕方は **agent 推定・利用者未確認** である。

### 一覧

| 部品 | 表示 |
| --- | --- |
| 月送り | 「<」「{年}年{月}月」「>」。対象期間の最初の月と最後の月で、それぞれ前 / 次を無効にする (qa-cash-ui-ux-web-003、agent 推定・利用者未確認)。 |
| キーワード | 入力して「検索」または Enter で確定し URL に載せる。 |
| 絞り込み | 収支 (すべて / 収入 / 支出)、カテゴリ (すべて / 選択中の月に現れるカテゴリ)、担当者 (すべて / 各名義 / 未設定)、取込元 (すべて / 通常入力 / 交通費入力)。 |
| 詳細検索 | 押すと 金額の下限・上限、日付の開始・終了 の欄を開閉する。 |
| 合計 | 収入合計 (↑)・支出合計 (↓)・収支差額 (＝)。金額は 3 桁区切りと「円」。 |
| 表 | FR-11 の列。日付は `YYYY/MM/DD`、金額は 3 桁区切り。 |
| ページング | 「{始}-{終}件 / {総数}件」と送り。 |

並び順は日付の新しい順、同日は id の新しい順 (既存の `loadCashEntries` と同じ)。

URL の検索パラメータ (キー名は **agent 推定・利用者未確認**):

| キー | 値 | 既定 (既定のときは付けない) |
| --- | --- | --- |
| `tab` | `normal` / `transit` | `normal` |
| `month` | `YYYY-MM` | 既定の月 (下の「既定の値」) |
| `q` | キーワード | 空 |
| `io` | `income` / `expense` | すべて |
| `category` | カテゴリの表示文字列 | すべて |
| `owner` | `business` / `spouse` / `family` / `unset` | すべて |
| `route` | `normal` / `transit` | すべて |
| `min` / `max` | 金額の整数 | 空 |
| `from` / `to` | `YYYY-MM-DD` | 空 |
| `page` | 1 始まりの整数 | 1 |

不正な値 (形式違い・候補外) は既定として扱い、URL から落とす。絞り込みを変えたら `page` を 1 に戻す。

### 削除確認と元に戻す

| 状態 | 表示 | 操作 |
| --- | --- | --- |
| 確認 (1 件) | 「この明細を削除しますか？」「削除すると、このデータは一覧から取り除かれます。」、対象の明細 (日付・内容 (カテゴリ)) と金額 | キャンセル / 削除する |
| 確認 (一括) | 「選択した {N} 件の明細を削除しますか？」と同じ説明、件数と金額の合計 | キャンセル / 削除する |
| 削除中 | 「削除する」を無効にし、処理中の表示 | - |
| 完了 | トースト「明細を削除しました。」(一括は「{N} 件の明細を削除しました。」) | 元に戻す / × |
| 戻し完了 | トースト「明細を元に戻しました。」 | × |
| 失敗 | 確認欄に失敗の文を出し、確認を開いたまま | 再度「削除する」/ キャンセル |

- 一括削除も 1 つのトーストの『元に戻す』で選んだ全件を戻す (qa-cash-decision-006。1 つのトーストに束ねることは qa-cash-ui-ux-web-003 の agent 推定)。
- トーストの表示時間は既存の明細仕分けの ResultNotices の既定に従う (qa-cash-ui-ux-web-003、agent 推定・利用者未確認)。現物の ResultNotices は時間で消さず、閉じるか次の操作まで出たままである。
- 一括の確認文・戻し完了の文・失敗の扱いは **agent 推定・利用者未確認** である。

### 空状態とサンプル表示

- 空状態: 選択中の月に削除中でない明細が 0 件で、絞り込みが既定のとき。文言は FR-16。
- 絞り込みの結果だけが 0 件のとき (月には行がある) は空状態を出さず、表の位置に「条件に合う明細がありません」と「条件をクリア」を出す (**agent 推定・利用者未確認**)。
- 「サンプルデータを表示」: 画面内だけの固定のサンプル 5 行を、各行に「サンプル」の文字を添えて表に出し、合計カードは 0 のまま「サンプルは合計に含まれません」を添える。サンプル行の編集・削除・選択は無効。もう一度押すと消える (サンプルが保存されず集計に入らないことは qa-cash-ui-ux-web-003 の agent 推定。行数と表示の仕方は本書の **agent 推定・利用者未確認**)。
- 「はじめての明細を入力」: タブを通常入力にして日付欄へ焦点を移す。

### 既定の値

- 選択中の月の既定: 今日の月が対象期間の中ならその月、外なら対象期間の最後の月 (**agent 推定・利用者未確認**)。
- 入力欄の既定: 日付 = 今日、事業 / 個人 = 事業、収支 = 支出、担当者 = 事業なら business・個人なら未選択 (担当者の既定は qa-cash-database-web-003、ほかは **agent 推定・利用者未確認**)。往復の既定は現行 (交通費へ切り替えたとき往復) に合わせて入れた状態。
- 追加に成功した後: 日付・事業 / 個人・担当者は残し、それ以外を空に戻す (現行の `resetCashEntryAfterCreate` と同じ考え方)。
- 追加した明細の日付が選択中の月と違うとき: 一覧はその月へ移らず、トーストに「{年}年{月}月に追加しました」と、その月へ移るリンクを出す。対象期間の外なら「選択中の期間の外に追加しました」と出す (**agent 推定・利用者未確認**)。
- キーワードの一致: 内容・メモ・カテゴリ (大・中)・出発駅・到着駅・業務の目的に対する部分一致。Unicode の NFKC で正規化し、英字の大小を区別しない (**agent 推定・利用者未確認**)。
- 詳細検索の日付範囲は選択中の月の中をさらに絞る。金額は両端を含む (**agent 推定・利用者未確認**)。
- 範囲外のページ番号は最後のページへ寄せる (**agent 推定・利用者未確認**)。

### 読込・空・失敗の状態

| 段 | 読込 | 空 | 失敗 |
| --- | --- | --- | --- |
| 一覧・合計 | 表と合計カードの位置に読込表示 | 上の空状態 | 「現金明細を読み込めませんでした」と再読込 |
| カテゴリの候補 | 選択欄を無効にして読込表示 | 「候補がありません」 | 一覧と同じ失敗表示 (同じ応答で返るため) |
| 追加・変更 | 主ボタンを無効にして処理中 | - | 400 は API の文をボタンの上に出し、入力を保持する |
| 削除・戻し | 「削除する」/『元に戻す』を無効にして処理中 | - | 文を出し、確認欄またはトーストを残す |

空と失敗の文言は **agent 推定・利用者未確認** である。

### 画像の値のうち期待値にしないもの

画像の数値と固有の文は見本であり、テストの期待値にしない。期待値は API とフィクスチャから導く。

- 共通シェルの値: 「最終更新 2026年9月10日 10:24」「取引ライン：正常」、サイドバーの件数バッジ (3 / 12 / 2 / 5) と「月次クローズの進捗 3/4」、フッターの文言。
- 期間の表示「2025年9月 - 2026年8月（1年）」と一覧の月「2026年9月」。画像はこの 2 つが食い違っている (月が期間の外) が、月送りは期間を越えない規則 (qa-cash-ui-ux-web-003) なので、画像の月は再現しない。
- 入力欄の値 (2026/09/10、事業、支出、12,000、事務用品の購入、消耗品費、社内、「新しいノートを購入しました。」) と交通費の値 (東京、新宿、220、往復、440、打ち合わせ、「顧客との定例打ち合わせのため。」)。
- 担当者の「社内」。表示は利用者の名義ラベルに従う (既定は「本人」)。
- 取込元の「手入力」。qa-cash-decision-004 に従い「通常入力」「交通費入力」に置き換える。
- 一覧の 5 行と合計 50,000 / 12,450 / 37,550。画像の支出行の合計 (12,000 + 440 + 8,500 + 680 = 21,620) は支出合計 12,450 と一致しないので、画像の合計は計算の期待値として使えない。
- 一覧の内容の文「東京→新宿（往復）」。交通費の内容は `buildTransitEntry` の「電車代 東京→新宿(往復)」の形で作る。
- 削除確認の対象「2026/09/10 事務用品の購入（消耗品費）12,000 円」と、下書きの時刻「2026/09/10 14:25」。
- 領収書欄の「ファイルを選択 / またはドラッグ＆ドロップ / PDF, JPG, PNG（最大10MB）」(欄そのものを出さない、qa-cash-decision-001)。
- 空状態と一覧が同時に描かれていること。画像は状態の一覧であり、実際には排他である。

## ビジネスルールと検証

### 入力経路 (qa-cash-decision-004)

`transitFrom !== null` なら交通費入力、それ以外は通常入力。列は持たない。既存行を書き換えずに全行へ経路が付く (導き方は qa-cash-database-web-003 の **agent 推定・利用者未確認**)。表示語は「通常入力」「交通費入力」。

### 合計

入力は絞り込み後の明細の配列。収入合計 = `io='income'` の金額の和、支出合計 = `io='expense'` の金額の和、収支差額 = 収入合計 − 支出合計。サンプル行と削除中の行は入力に入らない (削除中の行は API の時点で除かれている)。

### 絞り込み

キーワード・収支・カテゴリ・担当者 (`unset` は owner が NULL の行)・入力経路・金額の範囲・日付の範囲の積 (AND)。選択中の月は API の応答から切り出す段で掛ける。キーワードの一致規則は「既定の値」のとおり。

### ページング

1 ページ 20 件 (qa-cash-ui-ux-web-003、agent 推定・利用者未確認)。総数 0 のとき `page=1`、表示「0件」。返す値は 行・現在のページ・ページ数・始・終・総数。

### 交通費の合計

片道運賃 × (往復なら 2、片道なら 1) (qa-cash-backend-web-001)。既存の `buildTransitEntry` と `transitInputError` を core の cash-screen から使い、合計が 1,000,000,000 円を超えたら入力エラー (既存の上限)。

### 入力検証 (core と API の zod で同じ上限、qa-cash-security-web-002)

| 項目 | 規則 |
| --- | --- |
| 日付 | `YYYY-MM-DD` で実在する日付 |
| 事業 / 個人 | `biz` / `per` |
| 収支 | `income` / `expense`。交通費は `expense` だけ |
| 金額 | 整数、1 以上 1,000,000,000 以下 |
| 内容・摘要 | 前後の空白を除いて 1〜60 字 |
| カテゴリ | 候補に含まれる (事業 = freee 勘定科目、個人 = MF 大項目・中項目)。事業は中項目なし (既存の `checkCategory`) |
| 担当者 | `business` / `spouse` / `family` のいずれか (必須。画像の「必須」印) |
| メモ | 200 字まで。空は NULL |
| 出発駅・到着駅 | 各 1〜40 字。両方入るか両方空 (既存の refine) |
| 往復 | 区間があるときだけ |
| 業務の目的 | 区間があるときは必須で、固定の 4 つか「その他」。区間が無いときは NULL でなければ 400 (NULL 以外を拒むことは **agent 推定・利用者未確認**) |
| その他の目的 | 「その他」のとき 1〜40 字 |

字数はコードポイント数で数える (**agent 推定・利用者未確認**。既存の名義ラベルの上限と同じ数え方)。

### 業務の目的の保存形 (agent 推定・利用者未確認)

migration 0052 が持つのは `transit_purpose` 1 列なので、固定の 4 つはその表示語 (「客先訪問」など) をそのまま入れ、その他は `その他:` に続けて自由記述を入れる。読むときは完全一致で固定の 4 つに振り分け、`その他:` で始まれば その他 と記述に分ける。どちらにも当たらない値は その他 の記述として扱う。書式と読み分けは core の `formatTransitPurpose` / `parseTransitPurpose` 1 か所に置く。

### 論理削除と完全消去 (qa-cash-decision-003)

- 削除は `deleted_at` に現在時刻 (ISO 8601) を入れる。削除中の行は一覧・合計・取引・集計・バックアップ (BACKUP_SNAPSHOT_SQL)・取込時の設定スナップショット (loadImportRestoreSettingsSnapshot)・科目使用状況 (loadCategoryUsageContext) のどこにも出さない。例外は JSON 復元の「移行先の現金明細が 0 件か」の件数 1 つだけ (qa-cash-decision-009、下の「削除中の行を読まない条件」節)。
- 戻しは `deleted_at` を NULL に戻す。id・本文・`created_at` は変えない。
- 削除中の行は PUT でも 404 とし、編集で復活させない (qa-cash-security-web-002)。
- 完全消去は `deleted_at` が 30 日より前の行を、1 晩あたり最大 500 行、物理削除する (30 日は qa-cash-decision-003 / qa-cash-infrastructure-web-001。500 行は qa-cash-database-web-003 の **agent 推定・利用者未確認**)。境界: 削除から 29 日の行は残し、31 日の行は消す (maintenance-ops 章)。30 日ちょうどの扱いは「30 日より前 (`deleted_at < now − 30日`)」とし、ちょうどは残す (**agent 推定・利用者未確認**)。
- 論理削除では `tx_edits` (個人分の `cash:<id>` への手動の仕分け) を消さず、戻したときに同じ仕分けで戻る。完全消去で同じ batch の中で消す (**agent 推定・利用者未確認**。現行の物理削除は同じ batch で消している)。
- 戻した行のカテゴリが科目表から消えていても行は戻し、カテゴリの検証は次の編集時に行う (qa-cash-backend-web-003、agent 推定・利用者未確認)。科目の名称変更 (settings の category-options PUT) は削除中の行を書き換えない (科目使用状況が削除中の行を読まないため)。

### 下書き (qa-cash-security-web-003、agent 推定・利用者未確認)

- キーに利用者 id を含め (`kanjo:cash-draft:v1:{userId}`、キーの書式は本書の agent 推定)、他の利用者と混ざらないようにする。ログアウト時に消す。
- 保存するのは入力途中の項目値 (通常入力と交通費入力の各欄、選択中のタブ) と保存時刻だけで、一覧の内容やサーバーの応答は保存しない。
- 保存は入力の変化から 500 ミリ秒後にまとめて行う (**agent 推定・利用者未確認**)。
- localStorage の読み書きの例外は握って画面を止めない。読めない・壊れた値は捨てて空の入力から始め、保存時刻を出さない (**agent 推定・利用者未確認**)。
- 上限を超える値 (メモ 200 字超など) は上限で切って保存しない。保存時の形は core の入力検証の上限と同じ (**agent 推定・利用者未確認**)。

## API契約

共通: 経路はすべて `/api/*` のセッション認証 (authGuard) のフェンスの内側に載り、各クエリは `c.get('userId')` で絞る。他の利用者の id と完全消去済みの id には存在を明かさず 404 を返す (qa-cash-auth-web-001)。エラーの形は既存どおり `{ "error": { "code": string, "message": string } }`。書き込み経路は `canonical-mutation-fence` に登録し、取込と同じ writer lease で直列化する (qa-cash-backend-web-002)。

### POST /api/cash-entries/:id/restore

#### 識別と目的

論理削除した現金明細 1 件を、同じ id のまま一覧と集計へ戻す (qa-cash-decision-003)。削除完了トーストの『元に戻す』(1 件) が呼ぶ。

#### 認証・認可

セッション cookie。`user_id` の一致する行だけ。新しい権限や役割は作らない。

#### Request

path `id` (正の整数、既存の `idParam`)。body なし、または空の JSON `{}`。

#### Response

200 `{ "entry": CashEntry }`。`CashEntry` は GET の要素と同じ形 (owner・transitPurpose を含む)。

#### Validation・ビジネスルール

- 対象は `user_id` が一致し、行が残っているもの (削除中、または削除中でない)。
- すでに削除中でない行には何も書かず 200 で現在の行を返す (冪等。**agent 推定・利用者未確認**)。
- 戻した行のカテゴリは検証しない (qa-cash-backend-web-003)。

#### Error contract

| HTTP | Code | Condition | Retryable | Client action |
| --- | --- | --- | --- | --- |
| 400 | invalid_input | `id` が正の整数でない | no | 画面を読み直す |
| 404 | not_found | 行が無い、他の利用者の行、完全消去済み | no | 一覧を取り直す。トーストに「この明細はもう戻せません」 |
| 503 | schema_unavailable | migration 0052 が未適用 | yes | 時間をおいて再試行 |

完全消去済みの id を 404 にすることは qa-cash-backend-web-003 (agent 推定・利用者未確認) である。

#### 実行セマンティクス

`planRecomputeFromDeals` で戻した後の明細集合から取引と集計の作り直しを先に計画し、`[UPDATE cash_entries SET deleted_at = NULL, updated_at = 現在 WHERE user_id = ? AND id = ? AND deleted_at IS NOT NULL, JSON pointer の無効化 (invalidateJsonSnapshotQuery 'cash_entries'), ...作り直しの query]` を 1 つの D1 batch で確定する。query 数は既存の `CASH_PARENT_DELETE_QUERY_LEDGER` と同じ形の台帳で宣言し、Free 上限 50 未満を確かめてから書く。

#### キャッシュ・ページング

N/A: 単一行の更新で一覧を返さない。成功後、画面は現金明細と集計の query を無効化する。

#### 可観測性と監査

失敗は既存の API エラーログの流儀で code を残す。内容・メモ・金額はログに出さない。

#### セキュリティ確認

他の利用者の id を 404 にし、存在を明かさない。canonical-mutation-fence に登録し、JSON 復元・取込と重ならない。

#### Contract tests

削除中の行が 200 で同じ id のまま GET に戻る、戻した後の集計 (cashToDeal / cashToTx の入力) に行が現れる、`tx_edits` の手動の仕分けが戻った行に効いている、削除中でない行の restore が 200 で `updated_at` 不変、他の利用者の id が 404、完全消去後の id が 404、fence が POST `/api/cash-entries/1/restore` を canonical-mutation と判定する。

### POST /api/cash-entries/bulk-delete

#### 識別と目的

一覧で選んだ現金明細をまとめて論理削除する (qa-cash-backend-web-001 / 002)。

#### 認証・認可

セッション cookie。配列の全 id が `user_id` の一致する削除中でない行であること。

#### Request

JSON `{ "ids": number[] }`。1〜100 件の正の整数。重複は 400 (**agent 推定・利用者未確認**)。

#### Response

200 `{ "ok": true, "ids": number[], "deletedAt": string }`。`ids` は受けた順。応答の形は **agent 推定・利用者未確認**。

#### Validation・ビジネスルール

- 100 件まで (qa-cash-decision-006)。
- 他の利用者の id、存在しない id、削除中の id を 1 件でも含めば全体を 404 にして何も変えない (qa-cash-security-web-002。削除中の id を含む場合を 404 にすることは **agent 推定・利用者未確認**)。
- 全件に同じ `deleted_at` を入れる。

#### Error contract

| HTTP | Code | Condition | Retryable | Client action |
| --- | --- | --- | --- | --- |
| 400 | invalid_input | `ids` が空・101 件以上・整数でない・重複 | no | 選択を直す |
| 404 | not_found | 1 件でも他の利用者・存在しない・削除中 | no | 一覧を取り直す |
| 503 | schema_unavailable | migration 0052 が未適用 | yes | 時間をおいて再試行 |

#### 実行セマンティクス

対象行を `WHERE user_id = ? AND id IN (SELECT value FROM json_each(?)) AND deleted_at IS NULL` で読み、件数が `ids` の件数と違えば 404。一致すれば `planRecomputeFromDeals` で削除後の集合から作り直しを計画し、`[UPDATE ... SET deleted_at = ?, updated_at = ? WHERE 同じ条件, JSON pointer の無効化, ...作り直しの query]` を 1 つの D1 batch で確定する。id 配列は 1 つの JSON 文字列として束縛する (D1 の 1 文あたりの束縛数の上限 100 に、`user_id` と 100 件の id が収まらないため。**agent 推定・利用者未確認**)。事前の読みと batch のあいだは canonical-mutation-fence の lease が他の書込を止め、UPDATE の条件が最後の守りになる。

#### キャッシュ・ページング

N/A。成功後、画面は現金明細と集計の query を無効化する。

#### 可観測性と監査

失敗の code と件数だけを残す。

#### セキュリティ確認

件数の上限で入力面を閉じる。他人の id を 1 件でも含めば何も変えない。

#### Contract tests

3 件の削除で 3 件とも GET と集計から消える、100 件が通り 101 件が 400、他の利用者の id を 1 件混ぜると 404 で自分の行も消えない、削除中の id を混ぜると 404、空配列と重複が 400、fence が canonical-mutation と判定する。

### POST /api/cash-entries/bulk-restore

#### 識別と目的

一括削除した現金明細を、トーストの『元に戻す』でまとめて戻す (qa-cash-decision-006)。

#### 認証・認可

セッション cookie。配列の全 id が `user_id` の一致する残っている行であること。

#### Request

JSON `{ "ids": number[] }`。1〜100 件の正の整数。重複は 400 (**agent 推定・利用者未確認**)。トーストは一括削除した id をそのまま渡す。

#### Response

200 `{ "entries": CashEntry[] }`。受けた順。応答の形は **agent 推定・利用者未確認**。

#### Validation・ビジネスルール

- 100 件まで。
- 他の利用者の id や完全消去済みの id を 1 件でも含めば全体を 404 にして何も戻さない (qa-cash-decision-006)。
- 削除中でない id は何もしない (冪等。**agent 推定・利用者未確認**)。
- カテゴリは検証しない (qa-cash-backend-web-003)。

#### Error contract

| HTTP | Code | Condition | Retryable | Client action |
| --- | --- | --- | --- | --- |
| 400 | invalid_input | `ids` が空・101 件以上・整数でない・重複 | no | 画面を読み直す |
| 404 | not_found | 1 件でも他の利用者・存在しない・完全消去済み | no | 一覧を取り直す。トーストに「この明細はもう戻せません」 |
| 503 | schema_unavailable | migration 0052 が未適用 | yes | 時間をおいて再試行 |

#### 実行セマンティクス

全件を 1 つの D1 batch で `deleted_at` を外し、同じ batch で取引と集計を作り直す (qa-cash-decision-006)。読みと束縛の仕方は bulk-delete と同じ。

#### キャッシュ・ページング

N/A。成功後、画面は現金明細と集計の query を無効化する。

#### 可観測性と監査

失敗の code と件数だけを残す。

#### セキュリティ確認

bulk-delete と同じ。

#### Contract tests

bulk-delete した 3 件が bulk-restore で同じ id のまま GET と集計へ戻る、他の利用者の id を 1 件混ぜると 404 で何も戻らない、完全消去済みの id を混ぜると 404、101 件が 400、fence が canonical-mutation と判定する。

### 既存経路の変更

| 経路 | 変更 |
| --- | --- |
| `GET /api/cash-entries` | query `from` / `to` (`YYYY-MM`、既存の期間検証と同じ) を受け、その期間の削除中でない明細を返す。`from` / `to` が無ければ全期間 (現行どおり。**agent 推定・利用者未確認**)。応答の `entries` の各要素に `owner` (`business` / `spouse` / `family` / null) と `transitPurpose` (string / null) を加える。`candidates` / `months` / `duplicates` は変えない。合計・絞り込み・ページングは返さない (画面が core で導く)。 |
| `POST /api/cash-entries` | body に `owner` (必須) と `transitPurpose` / `transitPurposeNote` を受ける (qa-cash-backend-web-002)。上限は「入力検証」の表。 |
| `PUT /api/cash-entries/:id` | POST と同じ body。既存行の取得 (`routes/cash.ts:219-222`) と UPDATE の条件に `deleted_at IS NULL` を足し、削除中の行を 404 にする。 |
| `DELETE /api/cash-entries/:id` | 物理削除 (`routes/cash.ts:250-276`) をやめ、`deleted_at` を入れる論理削除にする。同じ batch で JSON pointer の無効化と取引・集計の作り直しを行う (qa-cash-backend-web-002)。`tx_edits` は消さない (上の agent 推定)。応答は 200 `{ "ok": true, "id": number, "deletedAt": string }` (`id` と `deletedAt` を足すことは **agent 推定・利用者未確認**)。削除中の行と他の利用者の行は 404。 |
| `CANONICAL_MUTATION_ROUTES` (`canonical-mutation-fence.ts:42-48`) | POST `^/api/cash-entries/[^/]+/restore$` (consumers `cash_entries`)、POST `^/api/cash-entries/bulk-delete$` (同)、POST `^/api/cash-entries/bulk-restore$` (同) を足す。既存の POST / PUT / DELETE の行は変えない。 |
| `runtimeSchemaGuard` (`schema-guard.ts:4`) | `EXPECTED_D1_MIGRATION` を 0052 の migration ファイル名へ進める。guard は列の一覧ではなく適用済み migration の名前で判定する (system-spec と一致)。 |

POST / PUT の body の追加項目:

| キー | 型 | 規則 |
| --- | --- | --- |
| `owner` | `"business" \| "spouse" \| "family"` | 必須 |
| `transitPurpose` | `"客先訪問" \| "打ち合わせ" \| "仕入れ・買い出し" \| "研修・セミナー" \| "その他" \| null` | 区間があるとき必須、無いとき null |
| `transitPurposeNote` | `string \| null` | `transitPurpose` が「その他」のとき 1〜40 字、それ以外は null |

保存時は「業務の目的の保存形」で 1 列にまとめる。キー名の分け方は **agent 推定・利用者未確認** である。

### 削除中の行を読まない条件 (`deleted_at IS NULL`) を掛ける経路

cash_entries を読む全経路 5 本に同じ条件を掛ける (qa-cash-backend-web-002 / qa-cash-database-web-002)。経路名は system-spec と一致する:

| 経路 | 現物 | 変更 |
| --- | --- | --- |
| loadCashEntries (一覧と loadDataset が使う) | `store.ts:521-528` `loadCashEntries` | WHERE に `isNull(deleted_at)`。`loadDataset` (`store.ts:358`、現金は `:396` でこの関数を呼ぶ)・`planRecomputeFromDeals` 系 (`store.ts:1537-1539`)・GET / DELETE の読みはこれを通る。 |
| BACKUP_SNAPSHOT_SQL (エクスポートと夜間バックアップが共有) | `store.ts:740` `BACKUP_SNAPSHOT_SQL` の `'cash'` 行 (`store.ts:792-795`)。`loadBackupSourceSnapshot` (`:841`) → `loadBackupPayload` (`:1307`、JSON エクスポートと夜間バックアップ) が使う | `FROM cash_entries WHERE user_id = ? AND deleted_at IS NULL`。空いている値の列に `owner` と `transit_purpose` を載せ、`:952` 付近の読み戻しで `CashEntry` に入れる。 |
| loadImportRestoreSettingsSnapshot (取込時の設定スナップショット) | `store.ts:1070` `loadImportRestoreSettingsSnapshot` の cash 節 (`store.ts:1098-1103`、JSON 復元の計画が使う) | `WHERE user_id=? AND deleted_at IS NULL`。`json_object` に `'owner'` と `'transitPurpose'` を足す。 |
| loadCategoryUsageContext (科目使用状況) | `routes/settings.ts:374` `loadCategoryUsageContext` (cash の select は `:379`) | `and(eq(userId), isNull(deletedAt))`。使用件数と科目の名称変更 (`:604-613`) は削除中の行を数えず書き換えない。 |
| PUT の既存行取得 | `routes/cash.ts:219-222` | `isNull(deletedAt)` を足し、無ければ 404。 |

JSON 復元の件数の例外 (利用者決定 qa-cash-decision-009):

- JSON 復元の「移行先に記帳が 1 件も無いときだけ現金明細を入れる」判定 (`routes/imports.ts:434-442` `restorableCashEntries`) は、削除中の行が条件で見えなくなると、削除中の行だけが残る移行先へバックアップの id をそのまま INSERT して主キーが衝突する。そこで「移行先の現金明細が 0 件か」の判定だけは削除中の行も数える。`loadImportRestoreSettingsSnapshot` の `destination_counts` (`store.ts:1128-1139`) に削除中を含む現金明細の件数を 1 つ足し、判定はその件数で行う (束縛数は 19 → 20。予算画面の件数と合わせて merge 後は 21 で、束縛数は SQL の `?` から数える)。削除中の行が残る間は現金明細を復元せず、その理由を表示する。削除中の行を読まない不変条件の例外はこの件数 1 つだけで、削除中の行の中身はどの出力にも出さない。

削除中の行を読まない条件に付随して直す箇所 (**agent 推定・利用者未確認**):

- `BACKUP_SNAPSHOT_SQL` の `tx_edits` 行 (`store.ts:765`) から、削除中の現金明細 (`cash:<id>`) を指す行を外す。外さないと、削除中の明細の手動の仕分けだけがバックアップに残り、復元先で同じ id を採番し直した新しい明細にその仕分けが当たり得る。

JSON 復元の INSERT (qa-cash-database-web-002):

- `import-lifecycle.ts:1552` `restoreCashEntryStatements` の列 (`:1561-1575`) に `owner` と `transit_purpose` を足す。`deleted_at` は入れない (バックアップは削除中の行を含まないので、復元した行は常に削除中でない)。
- `routes/imports.ts:100-118` `restoredCashEntrySchema` (`.strict()`) に `owner` (3 値か null、既定 null) と `transitPurpose` (40 字 + 接頭辞まで、既定 null) を足す。旧バックアップ (項目なし) は既定で通り、新バックアップが `.strict()` で落ちない。

変えない経路:

- `deletion-lifecycle.ts:248` `loadManualRecords` は現金明細を対象集合に入れない (`cashEntries: []`、DR-6)。データの削除は現金明細に触れないので変えない。
- `import-active.ts:11` と `import-lifecycle.ts:1561` の `'cash_entries'` は JSON pointer と復元の対象表の宣言で、読み取りの条件ではない。

## データモデル

migration `migrations/0052_cash_entry_owner_soft_delete.sql` (追加のみ)。既存の最新は `0051_tradeoff_notes.sql`(計画時の予定番号 0050 は予算画面と、繰り上げ先の 0051 はトレードオフ画面と衝突したため 0052 へ繰り上げた)。ファイル名の後半は **agent 推定・利用者未確認**。

| 列 (cash_entries) | 型 | 既定 | 制約 | 書く経路 |
| --- | --- | --- | --- | --- |
| `owner` | TEXT | NULL | `CHECK (owner IS NULL OR owner IN ('business', 'spouse', 'family'))` | POST・PUT |
| `transit_purpose` | TEXT | NULL | なし (上限は API と core) | POST・PUT |
| `deleted_at` | TEXT (ISO 8601) | NULL | なし | DELETE・bulk-delete で入れ、restore・bulk-restore でだけ外す。夜間の完全消去は読んで行ごと消す |

- 索引 `idx_cash_user_deleted` を `(user_id, deleted_at)` に張る (索引名は **agent 推定・利用者未確認**)。
- 既存行は書き換えない (更新 0 件)。既存行の owner・transit_purpose・deleted_at は NULL。
- 入力経路・合計・件数は導出できるので保存しない (database 章の本章での適用)。
- `packages/api/src/db/schema.ts:438-464` の `cashEntries` に `owner` (enum 3 値、null 可)・`transitPurpose`・`deletedAt` と索引を足す。
- `packages/core/src/cash.ts:12` の `CashEntry` に `owner: Owner | null` と `transitPurpose: string | null` を足す。`deletedAt` は `CashEntry` に入れない (削除中の行は core の入力に来ない)。`store.ts:503` `cashFromRow` も同じ 2 つを写す。
- `CHECK` の NULL 許容は、既存行を書き換えずに列を足すための条件である。

## 認証・認可

- 新しい経路もすべて `/api/*` の authGuard 配下 (HttpOnly・Secure・SameSite=Strict のセッション Cookie) に置き、route の中で個別の認可判定を書かない。各クエリの条件に `user_id` を必ず含める (qa-cash-auth-web-001)。
- 他の利用者の明細の取得・変更・削除・復元・一括削除・一括復元は、存在を明かさず 404 にそろえる。一括は 1 件でも含めば何も変えない。
- 新しい資格情報・トークン・権限・役割は作らない (単一利用者の運用)。
- 夜間の完全消去は利用者の要求を経ない scheduled 処理で、全利用者の期限切れの行を対象にする。

## エラー・例外・回復

- 追加・変更の 400 (invalid_input / invalid_category / biz_has_no_mid): API の最初の 1 件の文を主ボタンの上に出し、入力と下書きを保持する。
- 変更の 404 (削除中・他の利用者): 「この明細は削除されたか、見つかりません」を出し、編集をやめて一覧を取り直す (**agent 推定・利用者未確認**)。
- 削除の失敗: 確認欄を開いたまま文を出す。一覧は変えない。
- 元に戻すの 404 (完全消去済み・他の利用者): トーストに「この明細はもう戻せません」を出し、一覧を取り直す。
- 一括の 404: 何も変わっていないので、一覧を取り直して選択を消す。
- 503 schema_unavailable: 既存の共通表示。
- localStorage の例外: 下書きの保存時刻を出さず、入力は続けられる。
- ネットワーク失敗: 一覧は失敗表示と再読込。書き込みは入力を保持して再度押せる。
- 夜間の完全消去の失敗: 他の夜間 job とバックアップを止めない (`Promise.allSettled` で独立させる)。消し残しは翌晩に続けて消す (infrastructure 章)。

## イベント・非同期処理

- 夜間 scheduled 処理 (`packages/api/wrangler.jsonc:31` の `0 18 * * *`、`index.ts:196` の `scheduledMaintenance`) に独立 job `cash_soft_delete_purge` を 1 本足す (qa-cash-infrastructure-web-001)。新しい binding・cron・外部サービスは足さない。
- job は 1 つの D1 batch で「`tx_edits` のうち、消す対象の現金明細 (`cash:<id>`) を指す行の削除」と「`deleted_at < 現在 − 30日` の行を `deleted_at, id` の古い順に最大 500 件選んで削除」を行う。対象の選び方は 2 文で同じ副問い合わせを使い、同じ batch (同じトランザクション) で確定する (**agent 推定・利用者未確認**)。削除中の行は集計に入っていないので、完全消去で集計の作り直しと JSON pointer の無効化は要らない。
- D1 query 予算: `scheduled-maintenance-budget.ts` の `SCHEDULED_MAINTENANCE_JOB_NAMES` に `cash_soft_delete_purge` を足し、`SCHEDULED_MAINTENANCE_D1_PLAN` に 2 (batch 内の 2 文) を宣言して型で結ぶ (qa-cash-infrastructure-web-001)。計画の合計は 47 → 49 になり、計画上限 `SCHEDULED_D1_QUERY_PLAN_MAX` (`scheduled-maintenance-budget.ts:14`) を 47 → 49 に上げる (利用者決定 qa-cash-decision-008)。受理上限 `SCHEDULED_D1_QUERY_ACCEPTED_MAX` (49) の内側に収まり、ハード上限 `SCHEDULED_D1_QUERY_LIMIT` (50) まで 1 本の余裕を残す。既存 job の枠は変えず、cron も足さない。
- 画面の非同期: 追加・変更・削除・戻し・一括の成功後、TanStack Query の現金明細の query と、集計を読む query を無効化する (qa-cash-frontend-web-001)。現行の `refreshAll` (全 query の無効化) と同じ範囲を保つ。
- 下書きの保存は入力の変化から 500 ミリ秒後 (上の agent 推定)。

## 可観測性

- 夜間の完全消去は、消した現金明細の件数を JSON ログ `{ "level": "info", "event": "cash_soft_delete_purge", "deleted": n }` に出す。1 晩の上限 500 行に達したら `level: "warn"` と `limitReached: true` を出し、翌晩に続きを消す (qa-cash-maintenance-ops-web-001、500 行と warn は qa-cash-maintenance-ops-web-003 の **agent 推定・利用者未確認**)。
- ログに利用者の内容 (内容・メモ・駅名・業務の目的・金額) と利用者 id を出さない。
- API のエラーは既存の流儀で code を残す。
- 新しい計測基盤やダッシュボードは足さない。

## 互換性・移行・リリース

- 反映の順序は既存の Migrate → Deploy。夜間 cron の完全消去 job は `/api/*` に掛かる `runtimeSchemaGuard` の外で動くので、0052 の適用を Worker の配備より先に行うこの順序で守る。0052 は列と索引の追加だけなので、適用後に旧 Worker が動いても新しい列を読まないだけで壊れない。
- 新しい Worker は `EXPECTED_D1_MIGRATION` で 0052 未適用の DB を 503 で止める (fail-closed)。
- **巻き戻しは対称でない。** 旧 Worker は `deleted_at` を読まないので、巻き戻すと削除中の行が一覧と集計に戻って見え、旧 DELETE は物理削除に戻る。巻き戻す前に削除中の行が無いことを確かめるか、戻って見えることを受け入れる。0052 の列そのものは残してよい。
- 既存行の owner は NULL (一覧は「未設定」)、入力経路は区間の有無から全行に付く。既存行の集計結果は変わらない (削除中の行が無い限り、読む集合が同じ)。
- JSON バックアップ: 新しいバックアップは cash の各要素に `owner` と `transitPurpose` を持つ。旧バックアップは既定の null で復元できる。削除中の行はバックアップに含まれない。
- 既存の DOM テストが import する `pages/Cash.tsx` の部品名 (`setCashTransitInput` / `changeCashEntryMode` / `resetCashEntryAfterCreate` など) は、`pages/cash/` から再エクスポートするか、テストを新しい構成へ書き直す。
- 新しい secret・binding・外部サービスの登録は発生しない。

## テストと受入条件

core 単体テスト (vitest、`packages/core/src/cash-screen.test.ts`):

- 入力経路: 区間ありが交通費入力、区間なし (null) が通常入力。
- 合計: 収入 2 件・支出 3 件のフィクスチャで 収入合計・支出合計・差額を `toBe` で固定。差額が負になる例も 1 件。
- 絞り込み: キーワード (全角英数・大小の違い・メモ・駅名で当たる)、収支、カテゴリ、担当者 (`unset` が owner null の行だけ)、入力経路、金額の両端、日付の両端、全条件の AND を `toEqual` で固定。
- ページング: 0 件、20 件ちょうど、21 件 (2 ページ目が 1 件)、範囲外のページ。
- 交通費合計: 片道 220 の往復で 440、片道で 220、上限超えでエラー。
- 業務の目的: 固定 4 つ・その他の書式と読み分けの往復、その他の 41 字がエラー。
- 入力検証: 各上限の境界 (60 / 61 字、200 / 201 字、40 / 41 字、1 円 / 0 円、1,000,000,000 / 1,000,000,001 円)、実在しない日付。
- 月送り: 期間の最初と最後で前 / 次が無い。

API テスト:

- restore / bulk-delete / bulk-restore の Contract tests (各節に列挙したもの)。
- DELETE が論理削除になり、同じ id が restore で戻る (O2)。
- 削除中の行を読まない条件を経路ごとに 1 件ずつ固定する (maintenance-ops 章): 削除 → GET の `entries`・集計 (cashToDeal / cashToTx の入力、`loadDataset`)・`loadBackupPayload` の `cashEntries` と `tx_edits`・`loadImportRestoreSettingsSnapshot`・科目使用状況の件数・PUT の 404 のそれぞれで行が 0 件 → restore → 同じ確認で行が戻る。条件を 1 経路だけ外すとその経路のテストだけが落ちることを、実装前に一度検算する。
- 他の利用者の id が GET / PUT / DELETE / restore / bulk-delete / bulk-restore のすべてで 404 (S4)。
- 不正な入力 (実在しない日付、範囲外の金額、候補外の名義・カテゴリ・業務の目的、長すぎる文字列) が 400 (S4)。
- 削除中の行だけが残る移行先への JSON 復元が主キーで衝突せず、現金明細を入れず、理由を表示する。削除中の行の中身は復元の計画・応答に出ない (qa-cash-decision-009)。
- 夜間の完全消去: 削除から 29 日の行は残り 31 日の行は消える、`tx_edits` も同じ batch で消える、501 件で 500 件消えて warn が出る、失敗しても他の job が走る。
- `SCHEDULED_MAINTENANCE_D1_PLAN` の job 集合と合計を固定し、合計が `SCHEDULED_D1_QUERY_PLAN_MAX` と等しい 49 であること (`total === PLAN_MAX`) を `scheduled-maintenance-budget.test.ts` で確かめる (qa-cash-decision-008)。
- migration 0052 の適用で既存行の更新が 0 件、既存行の新しい列が NULL、owner の CHECK が候補外を拒み NULL を通す。
- fence: 新しい 3 経路が canonical-mutation に分類され、`CANONICAL_MUTATION_ROUTES` の件数の固定 (`import-lifecycle-pure.test.ts`) を更新する。
- `schema-guard.test.ts` の期待 head が 0052。

DOM テスト (`packages/web/src/pages/cash/cash-screen.dom.test.tsx`):

- 問いの見出し・対象期間カード・2 つのタブ・通常入力の全項目とメモの字数・交通費入力の全項目と入替・合計金額の自動計算・一覧の月送り / 検索 / 4 種の絞り込み / 合計 3 枚 / 表 / ページング・インライン削除確認・元に戻すトースト・空状態・下部固定バーの存在 (O1)。
- 領収書のファイル入力が無く、freee への案内がある。
- 入力 → 再描画で下書きが復元され、保存時刻が出る。「両方の入力をクリア」で通常入力・交通費入力と下書きが消える。localStorage が例外を投げても画面が描ける (O2)。
- 入替で出発駅と到着駅が入れ替わる。往復の切り替えで合計金額が変わる。
- URL の `tab` / `month` / 絞り込み / `page` から同じ表示が復元される。
- 削除 → 確認 → 削除する → トースト → 元に戻す で restore が呼ばれる。一括では bulk-delete と bulk-restore に同じ id 配列が渡る。
- 取込元が「通常入力」「交通費入力」の文字で出る。収支が文字つきで出る。
- 読込・空・絞り込み 0 件・失敗の各状態。サンプル表示が合計を変えない。
- 直書き色 0、共通 Button の使用。

画面の描画検査:

- `packages/web/package.json` に `check:cash-screen` (`KANJO_VISUAL_SCOPE=cash node scripts/check-financial-visuals.mjs`) を足し、ルートの `verify:full` に組み込む (qa-cash-maintenance-ops-web-001、スクリプトの渡し方は qa-cash-maintenance-ops-web-003 の **agent 推定・利用者未確認**)。

grep による検査 (O3):

- web と api に、現金明細の合計・絞り込み・ページング・入力経路の計算 (金額の reduce、`transitFrom` による経路の分岐など) が cash-screen 以外に 0 件。

全体:

- `pnpm lint`・`typecheck`・`test`・`skills:test`・初期 JS 予算・`verify:full` が全て exit 0 (O4)。
- 受入は実行済みの最新のテスト証跡だけで判定する。未実施、一部適合、または既知の逸脱が 1 件でも残る項目は PASS にしない。

## 未決事項

決着済み (本文の該当箇所へ統合した):

- 夜間の D1 query 予算: 計画上限 `SCHEDULED_D1_QUERY_PLAN_MAX` を 47 → 49 に上げ、完全消去 job の 2 本を宣言する (利用者決定 qa-cash-decision-008。「イベント・非同期処理」節)。
- JSON 復元の判定に削除中を含む件数を使うこと: 「移行先の現金明細が 0 件か」の判定だけは削除中の行も数え、残る間は現金明細を復元せず理由を表示する (利用者決定 qa-cash-decision-009。「削除中の行を読まない条件」節)。

未決 (agent 推定・利用者未確認のまま):

- 名義が NULL の既存行の表示: qa-cash-database-web-003 (agent 推定) は「未設定」と表示するとするが、core の `ownerLabel(null)` は名義 `unset` の表示名 (既定「その他」、利用者が変えられる) を返す。現金入力画面だけ「未設定」と出すか、`unset` の表示名に合わせるかは利用者未確認である。本書は system-spec に合わせて「未設定」とした。
- 交通費カードに 日付・事業 / 個人・担当者・カテゴリが無いことの扱い (通常入力カードの値を共有する案) と、タブと 2 枚のカードの関係は画像からの解釈で、利用者未確認である。
- 業務の目的を 1 列に入れる保存形 (`その他:` の接頭辞) と、API の `transitPurpose` / `transitPurposeNote` の分け方は利用者未確認である。
- 論理削除で `tx_edits` を残し完全消去で消すこと、バックアップの `tx_edits` から削除中の現金明細を指す行を外すことは、承認済みの読み取り経路の一覧 (qa-cash-backend-web-002) の外にある付随の変更で、利用者未確認である。
- 本文で「agent 推定・利用者未確認」と注記した値 (1 ページ 20 件、業務の目的の選択肢、一括のトースト、トーストの表示時間、サンプル表示の中身、月送りの範囲、選択中の月の既定、入力欄の既定、担当者の既定、完全消去の 1 晩 500 行と warn、30 日ちょうどの扱い、完全消去済みの 404、戻した行のカテゴリを検証しないこと、restore と bulk-restore の冪等、一括の重複 id の 400 と削除中 id の 404、応答の形、DELETE の応答への項目追加、GET の期間の省略時、キーワードの一致規則、詳細検索の範囲、範囲外のページ、字数の数え方、下書きのキー・保存の間隔・例外・上限・ログアウト時の消去、URL のキー名、交通費タブでのバーの文言、編集中の下書き、空と失敗の文言、migration と索引の名前、`check:cash-screen` の渡し方) は、利用者の確認で変わり得る。変わった場合は core のテストの期待値と本書を同時に直す。
