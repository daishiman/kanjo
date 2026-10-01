---
status: confirmed
category: requirements-definition
---

# 要件定義書 (上位概念)

質疑録・承認記録は当時の文面を保持する。現行の数値契約は [specの確定節](../specs/spec-subscriptions-merge.md#推定月額の契約確定) を参照する。

## 現行契約への入口

本章の質疑・承認・出典は収集時の凍結記録として保持する。過去の回答の具体値と現行契約が異なる場合は [spec-subscriptions-merge](../specs/spec-subscriptions-merge.md) の「確定した実装契約」を適用する。過去の記録を現行契約の別正本にはしない。

上位の目的・ゴール・承認記録は本章に保持する。具体的な型・API・batch・復元・表示の現行契約は spec に集約し、凍結回答のSet・8文・未登録時の既定値を現行の実装指示に使わない。

推定月額は統合後の明細から再計算し、各月の実支払額を保存する。2026-10-01の完了指示を受け、既存計算規則を採用して現行specへ反映した。統合元完全一致保持と科目互換の共通化はcoreの現行コードを確認してspecへ反映した。API最終完了報告に合わせ、kind/commandのreplay照合、leaseを取得しないGET前後stamp検査、サブスクJSON復元だけのundo barrier、optional保存metadataの往復をspecへ反映した。一般settings restoreはundoを阻害しない。現行契約・互換性・検証結果はspecとdocsの検証索引を参照する。ローカル全体suiteの結果は検証レポートを参照。CIは未確認。


> 本章は spec-state.json の requirements_foundation を正本とする、システム構築の憲法。
> 以降の各技術章は frontmatter の serves_goals でここ (ゴール) へトレース (anchor) する。
> 上位概念がブレなければ、仕様が整った後もブレない。

- 確定マーカー: `status: confirmed`

## U1 本質的目的 (essential_purpose)

サブスクの名寄せ (統合) を一度決めたら、その結果がサブスク画面の一覧・KPI・月次推移・年換算の比較・詳細パネルと、他画面のサブスク集計まで、1つの正本から一貫して反映されるようにし、利用者が固定費を正しい単位で見直せる状態にする。あわせて、統合・登録・変更・見直し判断を続けて・同時に行っても操作が失われたり失敗で止まったりせず、どの操作が待機中・処理中・完了・失敗かを利用者が把握できるようにする。(5 Whys: 統合しても行が消えない → 同じサービスが複数行に分かれて合計と見直し候補が二重に見える → 統合結果が行の構成と他画面の集計に同じ経路で届いていない → 固定費の実額と見直し判断を信頼できる数字で行えない)

## U2 背景 (background)

本番の /subscriptions?vendor=aquavoice で統合を行っても一覧から行が消えないと利用者が報告した (qa-subsmerge-request-origin-001)。観測事実: (1) 登録済みの行を開いて統合すると統合先が開いている行そのもの (Subscriptions.tsx の mergeTargetId) になり、API は結合後の別名が前と同じなら何もせず返す (routes/subs.ts の aliases POST)。登録済みの行を別の行へまとめる手段が画面に無い。(2) デザイン 09-subscriptions は一覧に行チェックを持つが、実装の一覧には行チェックが無い。(3) 他画面の subs:* 集計 (monthly_agg) は freee 仕訳だけから別経路 (dataset.ts) で作られ、照合順序と対象科目の絞り方がサブスク画面と食い違う。(4) 書込みと再集計 (recomputeFromDeals) は別の batch で一体でなく、再集計が失敗した後の再試行は早期 return で集計が古いまま残る。(5) 「サーバー側で処理に失敗しました」は 5xx でだけ出る文言で、書込みの取り合い (canonical_write_busy) は 409 の別文言になる。サブスクの書込みには revision・冪等キー・操作履歴が無く、PUT は画面が持つ古い値で丸ごと上書きする。一方、照合 (reconciliation_actions)・総収支 (total_cashflow_operations)・設定 (settings_change_log) には条件付き書込み・409・取り消しの前例がある。

## U3 ゴール (goals)

| ID | ゴール |
|---|---|
| G1 | 統合した取引名・ベンダーは統合先の1行にまとまり、統合元の行は一覧から消え、KPI・月次推移・年換算の比較・詳細パネル・他画面のサブスク集計が同じ名寄せ結果を示す。 |
| G2 | 統合・登録・変更・見直し判断を連続・同時に行っても、操作が失われたり「サーバー側で処理に失敗しました」で止まったりせず、各操作の状態 (待機中・処理中・完了・失敗と再試行) を利用者が把握できる。 |
| G3 | サブスク画面が添付画像 (デザイン 09-subscriptions) の構成と操作どおりになる (一覧の行チェックと全選択、選択バーからの複数件統合、詳細パネル 概要/取引履歴/関連データ、マッチした生の取引名、検出理由、年換算の比較、カバー率)。 |
| G4 | 統合と操作の管理が安全である (ログインした利用者だけが、全利用者で共通の共有テナントのデータだけを変更できる、統合を取り消して統合前へ戻せる、古い画面からの上書きを防ぐ、操作の記録に実データを外部へ出さない)。 |

## U4 目標 (objectives)

| ID | 目標 | 測定基準 |
|---|---|---|
| O1 | 統合後の再取得で、統合元の正規化名を持つ行が一覧に0件、統合先の推定月額を統合後の明細から再計算し、同一期間の各月の実支払額を保存し、他画面の subs:* 集計の名寄せ (どのサブスクに属するか) がサブスク画面と一致する。 | core の契約テストと api の統合テストで、統合元の行0件・各月の実支払額の保存・再推定の期待値・両経路の名寄せ一致を検査して緑 |
| O2 | 同じテナントへ統合を5件連続・2件同時に送っても (同じ利用者の別タブからと、別の利用者からの両方)、全操作が完了か明示的な 409 (再読込の案内) で終わり、500 が0件、最終の集計が最後に完了した操作の状態と一致する。 | api の統合テストで連続送信と同時送信を再現し、ステータスと集計を検査して緑 |
| O3 | 画像の要素 (行チェック、全選択、選択バー、統合先の選択、操作状態の表示、取り消し) の DOM テストが全件緑。 | web の subscriptions-screen DOM テストで要素と操作を検査して緑 |
| O4 | 他テナントのベンダー id への操作は 404、統合の取り消しで統合前と同じ一覧に戻る、古い revision からの更新は 409。 | api の統合テストで所有者・取り消し・revision 競合を検査して緑 |

## U5 成功基準 (success_criteria)

- 本番相当のデータで aquavoice 型のケース (登録済みの行を別の行へ統合) を行うと、統合元の行が一覧から消え、KPI と他画面のサブスク集計が同じ名寄せ結果を示す。
- 連続・同時の操作が原因で「サーバー側で処理に失敗しました」(5xx) が出ない。取り合いは原因と次の行動が分かる文言で示され、再試行で必ず最新の状態へ収束する。
- pnpm verify:full と CI が緑である。

## U6 ステークホルダー (stakeholders)

- 利用者 (admin と member。全員が同じ共有テナントの業務データを扱い、個人事業と家計の収支を管理する): 月次の見直しで、同じサービスが別名で複数行に並ぶ状況で、1つにまとめて固定費の実額と見直し候補を正しく判断したい (JTBD)。
- 運用者 (admin。利用者と同じ人物のこともある): 操作が失敗したときに、どの操作が何の理由で止まったかを画面と記録から辿り、再試行で収束させたい。

## U7 スコープ (scope)

- **対象 (in)**: 統合の意味の是正: 登録済みの行を別の行へ統合でき、統合元の登録・別名・見直し判断を統合先へ吸収し、統合元の行を一覧から消す, 一覧の行チェックと全選択、詳細パネルの取引名チェック、選択バーで統合先 (代表) を選ぶ複数件統合, 統合の取り消し (統合前へ戻す) と操作履歴, 名寄せ (どのサブスクに属するか) を全画面で1つの照合関数から導く。金額の母集団は各画面の定義を保ち、差は注記する, サブスクの書込みの並行制御: 操作の記録・冪等キー・revision による 409・書込みと再集計の原子化、画面の待ち行列と操作状態の表示, 画像との差分の UI 反映と、それに伴う API・D1 migration (0058 以降)・テスト・文書
- **対象外 (out)**: 他画面 (概要・総収支・推移など) の画面デザインの作り直し (名寄せの共通化による集計の一致だけを行う), freee / マネーフォワードの取込方式の変更, 他画面の合計へのカード・銀行の未照合明細の算入 (利用者決定 qa-subsmerge-decision-002 により母集団は各画面の定義を保つ), AI による自動統合 (候補の提示と検出理由は出すが、統合の確定は利用者の操作だけで行う), Web 以外の専用アプリ (mobile / tablet / desktop)

## U8 制約 (constraints)

- 対象 platform は web のみ (利用者決定 qa-subsmerge-target-platforms-002、承認 appr-platforms-subsmerge-002)。
- 既存の Cloudflare Workers + D1 + R2 の範囲で作り、新しい有料サービスや Durable Objects を前提にしない (利用者決定 qa-subsmerge-decision-004、decision-subsmerge-003)。
- public リポジトリであり、実データ (data/、freee/MF エクスポート、口座明細) をコミットしない。テストとサンプルは匿名化済みの samples だけを使う。
- 色・文字・余白は docs/design-system.md と design-tokens に従い、web に色の hex を直書きしない。
- D1 migration は追加のみ。破壊的 migration は PR 上で承認 (migration-approvals.json) する。

## U9 具体的にやりたいこと (concrete_intents)

| ID | やりたいこと | 資するゴール |
|---|---|---|
| I1 | 登録済みの行でも統合先を選べるようにし、統合元の取引名と別名を統合先の別名へ移し、統合元の登録と見直し判断を統合先へ吸収する。 | G1 |
| I2 | 一覧の行チェックと全選択で複数行を選び、選択バーから代表 (統合先) を決めて統合する。詳細パネルの取引名チェックとも同じ選択バーを使う。 | G1, G3 |
| I3 | 他画面のサブスク集計 (monthly_agg の subs:*) を、サブスク画面と同じ照合関数 (名前・別名・統合・対象科目) で導く。 | G1 |
| I4 | サブスクの書込みを操作として D1 に記録し (冪等キー・期待 revision)、書込みと再集計を同じ原子単位で適用する。古い revision からの更新は 409 で止める。 | G2, G4 |
| I5 | 画面は連続操作を待ち行列に積んで1件ずつ送り、処理中・完了・失敗 (再試行) を操作状態として表示する。失敗の文言は原因と次の行動を示す。 | G2, G3 |
| I6 | 統合の取り消しで統合前の登録・別名・判断を復元し、操作履歴から直近の統合を辿れるようにする。 | G4, G1 |
| I7 | 画像との差分 (行チェック、全選択、選択バーの統合先選択、操作状態) を design tokens に沿って反映する。 | G3 |
| I8 | 全ての書込み API で業務データの所有者 (user_id = 共有テナント id) を検査し、入力を検証し、操作記録には取引名など業務上必要な最小限だけを保存する。 | G4 |

## 確定の接地根拠 (承認)

> 上の `status` を確定たらしめている利用者承認の実体。承認範囲がここに現れない項目は、本章の確定内容ではない。

### 承認: `appr-foundation-subsmerge-002`

上位概念 U1〜U9 の全文を逐語で示し、1 論点の問い (qa-subsmerge-foundation-002) で利用者が「承認して確定」を選択した。 appr-foundation-subsmerge-001 の後に書き足した具体と、共有テナントの事実に合わせた修正を含む現在の文面に対する承認。 回答の記録時刻 2026-09-30T12:05:58Z。basis=user-decision。

#### この承認を名指ししている質疑: `qa-subsmerge-foundation-002`

**問**

上に示した U1〜U9 の全文（承認後に書き足した具体 A と、共有テナントの事実などの修正 B を含む）を、今回の上位概念として確定してよいですか？

**答**

承認して確定 (Recommended) — 表示した文面をそのまま requirements_foundation に書き込み、新しい承認 appr-foundation-subsmerge-002 を付けて確定する。その後、章を再コンパイルして完成度評価をやり直す。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: AskUserQuestion (提示 2026-09-30T12:05:48.704Z、回答の記録 2026-09-30T12:05:58.291Z) / 選択肢提示あり (承認して確定 (Recommended) / 修正が必要)。 直前の発言で、requirements_foundation へ書き込む文面の全文 (U1〜U9) を逐語で示し、前回の承認 appr-foundation-subsmerge-001 からの変更点を A (承認後にアシスタントが書き足した具体: U6 の運用者、O2 の最終集計の一致、O4 の 404・409、I8、U7 の対象外 2 項目) と B (共有テナントの事実に合わせた G4・O2・O4・U6・I8 の修正、U5 の『原因で…(5xx)』、U2 の本番ホスト名の除外と出典、U8 の参照 id の付け替え) に分けて明示した。 提示した文面は scratchpad の foundation-002.md (sha256 152b0c9a6afbe8c79100625d736c5353612a78135548f219ef63e07e92e6be56)、書き込んだ JSON は foundation-002.json (sha256 969f2ee2c38097ce3dd74f2268c76db8939e7bf3e928823e1db54476b7c181f3) で、同じ script から生成した。 起案の原文は qa-subsmerge-foundation-draft-001、最初の依頼は qa-subsmerge-request-origin-001。 / 回答時刻: 2026-09-30T12:05:58Z)

#### この承認を名指ししている質疑: `qa-subsmerge-foundation-shown-002`

**問**

qa-subsmerge-foundation-002 の再承認で、利用者へ提示した U1〜U9 の全文と A・B の変更点は何か (逐語)。

**答**

Q1 と Q2 の回答は記録済みです。foundation の再承認をお願いします。以下は `spec-state.json` に書き込む予定の文面そのものです（案の JSON の sha256 は `969f2ee2…`）。前回の承認（`appr-foundation-subsmerge-001`、07:57Z）から変わった点は次の 2 種類です。

**A. 承認後にアシスタントが書き足していた具体（未承認だったもの）**
- U6 の「運用者」
- O2 の「最終の集計が最後に完了した操作の状態と一致」
- O4 の「404・409」
- I8
- U7 の対象外 2 項目（未照合明細の算入、Web 以外の専用アプリ）

**B. 今回の修正**
- **共有テナントの事実を反映**: 現物では、ログインできる利用者（admin と member）の全員が、同じ共有テナントの業務データを扱います。これに合わせて G4、O2、O4、U6、I8 を直しました。
  - 「本人のデータだけ」は「共有テナントのデータだけ」に変わります。
  - 同時操作は別の利用者からも起こりえます。
- **U5**: 「連続・同時の操作が**原因で**…(5xx) が出ない」に絞りました。本当のサーバー障害まで禁じる意味に読めないようにするためです。
- **U2**: 本番のホスト名を外し、出典として `qa-subsmerge-request-origin-001` を付けました。
- **U8**: 参照先を、今回の回答の id（`qa-subsmerge-target-platforms-002`、`qa-subsmerge-decision-004`）に付け替えました。

---

**U1 本質的目的**
サブスクの名寄せ (統合) を一度決めたら、その結果がサブスク画面の一覧・KPI・月次推移・年換算の比較・詳細パネルと、他画面のサブスク集計まで、1つの正本から一貫して反映されるようにし、利用者が固定費を正しい単位で見直せる状態にする。あわせて、統合・登録・変更・見直し判断を続けて・同時に行っても操作が失われたり失敗で止まったりせず、どの操作が待機中・処理中・完了・失敗かを利用者が把握できるようにする。(5 Whys: 統合しても行が消えない → 同じサービスが複数行に分かれて合計と見直し候補が二重に見える → 統合結果が行の構成と他画面の集計に同じ経路で届いていない → 固定費の実額と見直し判断を信頼できる数字で行えない)

**U2 背景**
本番の /subscriptions?vendor=aquavoice で統合を行っても一覧から行が消えないと利用者が報告した (qa-subsmerge-request-origin-001)。観測事実: (1) 登録済みの行を開いて統合すると統合先が開いている行そのもの (Subscriptions.tsx の mergeTargetId) になり、API は結合後の別名が前と同じなら何もせず返す (routes/subs.ts の aliases POST)。登録済みの行を別の行へまとめる手段が画面に無い。(2) デザイン 09-subscriptions は一覧に行チェックを持つが、実装の一覧には行チェックが無い。(3) 他画面の subs:* 集計 (monthly_agg) は freee 仕訳だけから別経路 (dataset.ts) で作られ、照合順序と対象科目の絞り方がサブスク画面と食い違う。(4) 書込みと再集計 (recomputeFromDeals) は別の batch で一体でなく、再集計が失敗した後の再試行は早期 return で集計が古いまま残る。(5) 「サーバー側で処理に失敗しました」は 5xx でだけ出る文言で、書込みの取り合い (canonical_write_busy) は 409 の別文言になる。サブスクの書込みには revision・冪等キー・操作履歴が無く、PUT は画面が持つ古い値で丸ごと上書きする。一方、照合 (reconciliation_actions)・総収支 (total_cashflow_operations)・設定 (settings_change_log) には条件付き書込み・409・取り消しの前例がある。

**U3 ゴール**
- G1: 統合した取引名・ベンダーは統合先の1行にまとまり、統合元の行は一覧から消え、KPI・月次推移・年換算の比較・詳細パネル・他画面のサブスク集計が同じ名寄せ結果を示す。
- G2: 統合・登録・変更・見直し判断を連続・同時に行っても、操作が失われたり「サーバー側で処理に失敗しました」で止まったりせず、各操作の状態 (待機中・処理中・完了・失敗と再試行) を利用者が把握できる。
- G3: サブスク画面が添付画像 (デザイン 09-subscriptions) の構成と操作どおりになる (一覧の行チェックと全選択、選択バーからの複数件統合、詳細パネル 概要/取引履歴/関連データ、マッチした生の取引名、検出理由、年換算の比較、カバー率)。
- G4: 統合と操作の管理が安全である (ログインした利用者だけが、全利用者で共通の共有テナントのデータだけを変更できる、統合を取り消して統合前へ戻せる、古い画面からの上書きを防ぐ、操作の記録に実データを外部へ出さない)。

**U4 目標**
- O1: 統合後の再取得で、統合元の正規化名を持つ行が一覧に0件、統合先の月額が同一期間の統合前の両者の和と一致し、他画面の subs:* 集計の名寄せ (どのサブスクに属するか) がサブスク画面と一致する。（測り方: core の契約テストと api の統合テストで、統合元の行0件・金額の和の一致・両経路の名寄せ一致を検査して緑／資する: G1）
- O2: 同じテナントへ統合を5件連続・2件同時に送っても (同じ利用者の別タブからと、別の利用者からの両方)、全操作が完了か明示的な 409 (再読込の案内) で終わり、500 が0件、最終の集計が最後に完了した操作の状態と一致する。（測り方: api の統合テストで連続送信と同時送信を再現し、ステータスと集計を検査して緑／資する: G2）
- O3: 画像の要素 (行チェック、全選択、選択バー、統合先の選択、操作状態の表示、取り消し) の DOM テストが全件緑。（測り方: web の subscriptions-screen DOM テストで要素と操作を検査して緑／資する: G3）
- O4: 他テナントのベンダー id への操作は 404、統合の取り消しで統合前と同じ一覧に戻る、古い revision からの更新は 409。（測り方: api の統合テストで所有者・取り消し・revision 競合を検査して緑／資する: G4）

**U5 成功基準**
- 本番相当のデータで aquavoice 型のケース (登録済みの行を別の行へ統合) を行うと、統合元の行が一覧から消え、KPI と他画面のサブスク集計が同じ名寄せ結果を示す。
- 連続・同時の操作が原因で「サーバー側で処理に失敗しました」(5xx) が出ない。取り合いは原因と次の行動が分かる文言で示され、再試行で必ず最新の状態へ収束する。
- pnpm verify:full と CI が緑である。

**U6 利用者**
- 利用者 (admin と member。全員が同じ共有テナントの業務データを扱い、個人事業と家計の収支を管理する): 月次の見直しで、同じサービスが別名で複数行に並ぶ状況で、1つにまとめて固定費の実額と見直し候補を正しく判断したい (JTBD)。
- 運用者 (admin。利用者と同じ人物のこともある): 操作が失敗したときに、どの操作が何の理由で止まったかを画面と記録から辿り、再試行で収束させたい。

**U7 範囲**
- 対象:
  - 統合の意味の是正: 登録済みの行を別の行へ統合でき、統合元の登録・別名・見直し判断を統合先へ吸収し、統合元の行を一覧から消す
  - 一覧の行チェックと全選択、詳細パネルの取引名チェック、選択バーで統合先 (代表) を選ぶ複数件統合
  - 統合の取り消し (統合前へ戻す) と操作履歴
  - 名寄せ (どのサブスクに属するか) を全画面で1つの照合関数から導く。金額の母集団は各画面の定義を保ち、差は注記する
  - サブスクの書込みの並行制御: 操作の記録・冪等キー・revision による 409・書込みと再集計の原子化、画面の待ち行列と操作状態の表示
  - 画像との差分の UI 反映と、それに伴う API・D1 migration (0058 以降)・テスト・文書
- 対象外:
  - 他画面 (概要・総収支・推移など) の画面デザインの作り直し (名寄せの共通化による集計の一致だけを行う)
  - freee / マネーフォワードの取込方式の変更
  - 他画面の合計へのカード・銀行の未照合明細の算入 (利用者決定 qa-subsmerge-decision-002 により母集団は各画面の定義を保つ)
  - AI による自動統合 (候補の提示と検出理由は出すが、統合の確定は利用者の操作だけで行う)
  - Web 以外の専用アプリ (mobile / tablet / desktop)

**U8 制約**
- 対象 platform は web のみ (利用者決定 qa-subsmerge-target-platforms-002、承認 appr-platforms-subsmerge-002)。
- 既存の Cloudflare Workers + D1 + R2 の範囲で作り、新しい有料サービスや Durable Objects を前提にしない (利用者決定 qa-subsmerge-decision-004、decision-subsmerge-003)。
- public リポジトリであり、実データ (data/、freee/MF エクスポート、口座明細) をコミットしない。テストとサンプルは匿名化済みの samples だけを使う。
- 色・文字・余白は docs/design-system.md と design-tokens に従い、web に色の hex を直書きしない。
- D1 migration は追加のみ。破壊的 migration は PR 上で承認 (migration-approvals.json) する。

**U9 具体的意図**
- I1: 登録済みの行でも統合先を選べるようにし、統合元の取引名と別名を統合先の別名へ移し、統合元の登録と見直し判断を統合先へ吸収する。（資する: G1）
- I2: 一覧の行チェックと全選択で複数行を選び、選択バーから代表 (統合先) を決めて統合する。詳細パネルの取引名チェックとも同じ選択バーを使う。（資する: G1, G3）
- I3: 他画面のサブスク集計 (monthly_agg の subs:*) を、サブスク画面と同じ照合関数 (名前・別名・統合・対象科目) で導く。（資する: G1）
- I4: サブスクの書込みを操作として D1 に記録し (冪等キー・期待 revision)、書込みと再集計を同じ原子単位で適用する。古い revision からの更新は 409 で止める。（資する: G2, G4）
- I5: 画面は連続操作を待ち行列に積んで1件ずつ送り、処理中・完了・失敗 (再試行) を操作状態として表示する。失敗の文言は原因と次の行動を示す。（資する: G2, G3）
- I6: 統合の取り消しで統合前の登録・別名・判断を復元し、操作履歴から直近の統合を辿れるようにする。（資する: G4, G1）
- I7: 画像との差分 (行チェック、全選択、選択バーの統合先選択、操作状態) を design tokens に沿って反映する。（資する: G3）
- I8: 全ての書込み API で業務データの所有者 (user_id = 共有テナント id) を検査し、入力を検証し、操作記録には取引名など業務上必要な最小限だけを保存する。（資する: G4）

- (根拠の性質: コード・設定・公式文書で検証できる観測事実 / 出所: 本セッションの会話記録 (transcript jsonl) のアシスタント発言 (記録時刻 2026-09-30T12:05:36.244Z) の text block を script で逐語抽出した (5162 文字、sha256 12981ccf65c593ddab89ead8c9939317ac0eee979c90bbe8ca0bd07e48422752)。本番 URL のホスト名と URL は含まれていないことを確かめた。answered_at はこの発言の記録時刻 (提示の時刻) で、利用者の承認 (qa-subsmerge-foundation-002、12:05:58Z) より前。qa-subsmerge-foundation-002 と appr-foundation-subsmerge-002 は書き換えず、何を見せて承認を得たかの証跡を本 entry で補う。 / 回答時刻: 2026-09-30T12:05:36Z)

#### この承認を名指ししている質疑: `qa-subsmerge-database-web-003`

**問**

共有テナントと利用者決定 (qa-subsmerge-undo-scope-001・actor-record-001・decision-005・retention-001) の下で、統合関係・操作の記録・revision・保持期間を D1 にどう持つか (利用者が決めていない具体値)。

**答**

migrations/0058_subscription_merge_operations.sql を追加だけで足す (ALTER TABLE ADD COLUMN・CREATE TABLE・CREATE INDEX のみ)。(1) sub_vendors に merged_into_id INTEGER NULL を足す。統合先の sub_vendors.id を指し (同じ user_id の行だけ)、NULL は統合されていない行。(2) subscription_operations (id TEXT PRIMARY KEY, user_id TEXT NOT NULL — 共有テナントのキー TENANT_ID, actor_user_id TEXT NOT NULL — 操作した利用者の users.id。外部キーは付けない (0046 liability_audit_log と同じ。users の行が無くなっても記録を残す), idempotency_key TEXT NOT NULL, kind TEXT NOT NULL CHECK (kind IN ('merge','unmerge','vendor_create','vendor_update','vendor_delete','review','review_decision','exclusion')), target_vendor_id INTEGER, payload_json TEXT NULL, before_json TEXT NULL, base_revision INTEGER NOT NULL, undoes_id TEXT, undone_at TEXT, created_at TEXT NOT NULL, UNIQUE (user_id, actor_user_id, idempotency_key), UNIQUE (user_id, base_revision)) と INDEX (user_id, created_at)。(3) subscription_revisions (user_id TEXT PRIMARY KEY, revision INTEGER NOT NULL, updated_at TEXT NOT NULL)。revision は共有テナントに 1 本だけ持ち、別の利用者の同時の操作も同じ revision で検出する。成功した操作ごとに 1 つ進め、UNIQUE (user_id, base_revision) が同じ revision からの 2 つ目の書込みを制約違反で落とす。before_json は操作前の統合元・統合先の name・aliases・merged_into_id・見直し判断だけで、取引の金額・日付・口座は持たない。取り消しは元の行の undone_at を埋めて kind='unmerge' の行を actor_user_id 付きで足す (0042 total_cashflow_operations の前例)。保持 (qa-subsmerge-retention-001): created_at から 30 日を過ぎた行は payload_json と before_json を NULL にし (取り消せなくなる)、400 日を過ぎた行を削除する。夜間保守の D1 query 予算は 49/49 で埋まっているため (scheduled-maintenance-budget.ts:21)、掃除は新しい書込みの batch に UPDATE … WHERE id IN (SELECT id … LIMIT 50) と DELETE … WHERE id IN (SELECT id … LIMIT 50) の 2 文を足して行う (UPDATE/DELETE の直接の LIMIT は SQLite の compile option に依存するので使わない)。payload_json を NULL にした後で同じ Idempotency-Key が再送されたら、最初の結果と本文を照合できないので 422 idempotency_key_expired にする。schema-guard.ts の EXPECTED_D1_MIGRATION を 0058 へ進める。monthly_agg の subs:<vendor> と subs_other は統合先の名前でだけ書く。

- (根拠の性質: アシスタントの推定 (利用者確認も検証可能な出典も経ていない) / 出所: 利用者決定 qa-subsmerge-undo-scope-001・actor-record-001・decision-005・retention-001 と再承認 appr-foundation-subsmerge-002 (G4: 全利用者で共通の共有テナントのデータだけを変更できる) を満たすための具体値としてエージェントが推定した設計。旧 G4 の承認 appr-foundation-subsmerge-001 を出所とする qa-subsmerge-database-web-002 を置き換える。利用者は表名・列名・制約の形・掃除の件数を決めていない。answered_at は本 entry の記録直前に実測した記録時刻。 / 回答時刻: 2026-09-30T13:35:08Z)

#### この承認を名指ししている質疑: `qa-subsmerge-backend-web-003`

**問**

共有テナントと利用者決定 (qa-subsmerge-undo-scope-001・actor-record-001・decision-005・retention-001) の下で、統合・取り消し・操作履歴の API と core の分担をどうするか (利用者が決めていない具体値)。

**答**

core に resolveVendorMerges(vendors) を足す (merged_into_id の連鎖を推移的にたどって各行の最終的な統合先を決め、統合元の name と aliases を統合先の照合対象へ展開し、統合元を単独の照合対象から外す純関数。循環と自己統合は例外)。matchSubVendor はこの一覧だけを受け、dataset.ts の applyFreeeDeals とサブスク画面の行の組み立ての両方が同じ一覧を通す (他の画面も同じ名寄せになる)。api は 3 本を足す: POST /api/sub-vendors/merge (本文 {targetId, sourceVendorIds, rawNames, baseRevision}、ヘッダ Idempotency-Key)、POST /api/subscription-operations/:id/undo (本文 {baseRevision}、ヘッダ Idempotency-Key)、GET /api/subscription-operations?limit=20 (最大 20。各行に kind・対象の vendor 名・created_at・操作者の email (users に行が無ければ「削除された利用者」)・undoable と取り消せない理由を返し、before_json・payload_json・Idempotency-Key は返さない)。GET /api/subscriptions と各書込みの応答に revision を含める。業務データは c.get('userId') (= TENANT_ID) で絞り、操作者は c.get('actor').id から取る。取り消しの範囲はテナント全体で、操作者では絞らない (qa-subsmerge-undo-scope-001。既存の deletions.ts と total-cashflow-operations.ts の取り消しと同じ)。取り消しの結果: テナントに無い操作 id は 404 not_found、取り消し済みは 409 already_undone、後続の操作がある統合は 409 undo_blocked_by_later_operation、created_at から 30 日を過ぎたものは 410 undo_expired (deletions.ts:327 の『無いではなくもう戻せない』と同じ区別)。取り消しも revision を 1 つ進め、kind='unmerge' の行に actor を残す。既存の sub-vendors の作成・更新・別名・削除・review、review-decisions、exclusions も baseRevision を受け (省略時は現在値として扱い、移行期間の古い画面を壊さない)、subscription_operations に actor 付きで記録する。書込みは 1 つの db.batch に次の 8 文を並べる: (a) 操作の行の挿入 (INSERT … SELECT … WHERE 現在の revision = baseRevision。不一致なら 0 行になり、以降の文は全て『この操作の行が在る』ことを条件にするので何も変わらない)、(b) sub_vendors の変更 (統合元の merged_into_id と統合先の aliases を json_each(?) で)、(c) subscription_revisions の +1、(d) monthly_agg の subs:* と subs_other の削除、(e) json_each(?) による 1 文での再挿入、(f) JSON snapshot の無効化、(g) 30 日を過ぎた行の NULL 化 (50 件まで)、(h) 400 日を過ぎた行の削除 (50 件まで)。(a) の変更行数が 0 なら未適用として 409 subscription_revision_conflict を返す。統合・取り消しは全 Dataset の再計算 (recomputeFromDeals) を呼ばない。エラー: revision 不一致と UNIQUE (user_id, base_revision) 違反は 409 subscription_revision_conflict (未適用)、lease の取り合いは 409 canonical_write_busy (未適用)、D1 の overloaded は 503 d1_overloaded (retryable: true、未適用)。同じ Idempotency-Key と同じ本文の再送は最初の結果 (操作 id と適用後の revision) を返し、別の本文なら 422 idempotency_key_reused、30 日を過ぎて payload_json を消した key の再送は 422 idempotency_key_expired。

- (根拠の性質: アシスタントの推定 (利用者確認も検証可能な出典も経ていない) / 出所: 利用者決定 qa-subsmerge-undo-scope-001・actor-record-001・decision-005・retention-001 と再承認 appr-foundation-subsmerge-002 (G4: 全利用者で共通の共有テナントのデータだけを変更できる) を満たすための具体値としてエージェントが推定した設計。旧 G4 の承認 appr-foundation-subsmerge-001 を出所とする qa-subsmerge-backend-web-002 を置き換える。利用者は関数名・API の path・本文の形・エラーコードを決めていない。answered_at は本 entry の記録直前に実測した記録時刻。 / 回答時刻: 2026-09-30T13:35:08Z)

#### この承認を名指ししている質疑: `qa-subsmerge-frontend-web-003`

**問**

共有テナントと利用者決定 (qa-subsmerge-undo-scope-001・actor-record-001・decision-005・retention-001) の下で、連続・同時の操作を画面でどう待たせ、再試行・送り直し・状態をどう持つか (利用者が決めていない具体値)。

**答**

サブスク画面の書込みは全て 1 つの書込み用フックを通し、TanStack Query v5 の useMutation に scope: { id: 'subscriptions-write' } を付けて同じ scope の mutation を 1 件ずつ実行する (後から押した操作は待機中として積む)。操作ごとに crypto.randomUUID() で Idempotency-Key を 1 つ発行する。自動の再送は 2 種類に分ける。(1) 409 canonical_write_busy と 503 d1_overloaded は未適用なので、同じ key のまま 1 秒・2 秒・4 秒の間隔で最大 3 回再送する。(2) 409 subscription_revision_conflict は、別の利用者や別タブの操作が先に入ったことを示す。subscriptions を取り直し、操作の前提 (統合先と統合元がまだ在り、統合されていない) が保たれていれば、新しい baseRevision と新しい key で最大 3 回送り直す。409 の要求は操作の行を作らない (未適用) ので二重には反映されず、本文が変わるので同じ key の再利用 (422) を避けて key を替える。前提が崩れていれば送らず、理由 (例: 統合元が他の操作で統合済み) を示す。5xx と通信の失敗は適用されたか分からないので自動では送らず、同じ key で送る「再試行」ボタンを出す (適用済みなら最初の結果が返り二重にならない)。取り消しの 404・409 already_undone・409 undo_blocked_by_later_operation・410 undo_expired は再試行せず理由を示す。操作状態は useMutationState (この画面の待機中・処理中・失敗) と GET /api/subscription-operations (他の利用者を含む完了済み) を合わせて直近 5 件を出し、操作者の email と、取り消せる行には「元に戻す」を付ける。一覧の選択は vendorKey の Set として Subscriptions.tsx に持ち、詳細パネルの取引名選択と同じ選択バーへ渡す。統合が完了したら選択を消し、URL の ?vendor= が統合元を指していれば統合先へ置き換える。処理中は行チェック・全選択・取引名チェックを無効にする。既定の統合先 (選択中の登録済み行のうち推定月額が最大の行、無ければ最初に選んだ行) は core の純関数で決める。

- (根拠の性質: アシスタントの推定 (利用者確認も検証可能な出典も経ていない) / 出所: 利用者決定 qa-subsmerge-undo-scope-001・actor-record-001・decision-005・retention-001 と再承認 appr-foundation-subsmerge-002 (G4: 全利用者で共通の共有テナントのデータだけを変更できる) を満たすための具体値としてエージェントが推定した設計。旧 G4 の承認 appr-foundation-subsmerge-001 を出所とする qa-subsmerge-frontend-web-002 を置き換える。利用者はscope 名・再試行の回数と間隔・送り直しの条件・表示件数を決めていない。answered_at は本 entry の記録直前に実測した記録時刻。 / 回答時刻: 2026-09-30T13:35:08Z)

#### この承認を名指ししている質疑: `qa-subsmerge-ui-ux-web-003`

**問**

共有テナントと利用者決定 (qa-subsmerge-undo-scope-001・actor-record-001・decision-005・retention-001) の下で、画像 09-subscriptions との差分・操作状態・操作者の表示を、画面のどこにどの文言で置くか (利用者が決めていない具体値)。

**答**

画像どおりの要素はそのまま置く: 一覧の先頭列の行チェック、一部だけ選ばれているとき mixed (indeterminate) を示すヘッダの全選択、一覧の直上の選択バー (「N件の取引を選択中」、選択した行・取引名のチップ (× で個別に外す)、統合先 (代表) の選択欄、「選択したN件を統合」「選択を解除」)、詳細パネルの主操作「名称を統合」「候補として確認」、検出理由カードの「候補を採用」「候補から除外」。統合先の既定は選択中の登録済み行のうち推定月額が最も大きい行で、登録済みが無ければ最初に選んだ行とする。操作状態は選択バーの下に「操作」として直近 5 件を 1 行ずつ出し、各行に操作者の email (停止中の利用者も email で示し、users に行が無いときだけ「削除された利用者」) と、待機中・処理中・完了・失敗を文字と design tokens の状態色で示す (色だけに頼らない)。API には利用者を消す経路が無いので「削除された利用者」は手作業の運用などで行が無くなった例外時の表示に留まり、通常は停止中の利用者も email で出る。取り消された行は「(email) が元に戻しました」と示し、統合の完了行で取り消せるものに「元に戻す」を付ける。失敗の文言は原因と次の行動を 1 文ずつにする: 409 canonical_write_busy と 503 は「別の操作を処理中です。自動で再試行します (n/3)」、revision の不一致で自動で送り直すときは「他の利用者の操作が先に反映されました。最新の状態で送り直しています (n/3)」、前提が崩れたときは「(統合元の名前) は他の操作で変更されたため、統合しませんでした。一覧を確認してもう一度選んでください」、5xx と通信の失敗は「サーバー側で処理に失敗しました。同じ操作を再試行しても二重には反映されません」に「再試行」ボタン、410 は「統合から 30 日を過ぎたため元に戻せません」、already_undone は「すでに元に戻されています」(誰が戻したかは同じ欄の行で示す)、blocked は「この統合の後に別の操作があるため元に戻せません。後の操作から順に戻してください」。情報の優先度は 一覧の行 > 選択バー > 操作状態 > 詳細パネル > 年換算の比較・月次推移 の順で、狭い幅 (スマートフォンとタブレットのブラウザ) でもこの順に縦へ積む。

- (根拠の性質: アシスタントの推定 (利用者確認も検証可能な出典も経ていない) / 出所: 利用者決定 qa-subsmerge-undo-scope-001・actor-record-001・decision-005・retention-001 と再承認 appr-foundation-subsmerge-002 (G4: 全利用者で共通の共有テナントのデータだけを変更できる) を満たすための具体値としてエージェントが推定した設計。旧 G4 の承認 appr-foundation-subsmerge-001 を出所とする qa-subsmerge-ui-ux-web-002 を置き換える。利用者は既定の統合先・文言・表示件数・優先度の順を決めていない。answered_at は本 entry の記録直前に実測した記録時刻。 / 回答時刻: 2026-09-30T13:35:08Z)

#### この承認を名指ししている質疑: `qa-subsmerge-security-web-003`

**問**

共有テナントと利用者決定 (qa-subsmerge-undo-scope-001・actor-record-001・decision-005・retention-001) の下で、統合・取り消し・操作履歴の API で、テナントの境界・入力・記録とログの中身をどう守るか (利用者が決めていない具体値)。

**答**

脅威を 5 つに分けて扱う。(1) 誰が統合・取り消しをしたか辿れない: subscription_operations に actor_user_id (認証済みセッションの c.get('actor').id) を必ず書き、GET で操作者の email を返す (ASVS 5.0 V16.2.1 の who・what・when)。(2) 古い画面や別の利用者の操作による静かな上書き: revision の照合と UNIQUE (user_id, base_revision) で 409 にし、未適用を保証する。(3) 記録やログからの漏れ: before_json と payload_json は 30 日で NULL にし、GET は中身を返さない。observability のログには操作 id・kind・結果・所要 ms・actor の id だけを出し、取引名・別名・email・金額を出さない (V16.2.5)。(4) 共有テナントの外の id: targetId と sourceVendorIds の全件をテナントの sub_vendors から 1 回の問い合わせで引き、1 件でも無ければ 404 not_found。操作 id もテナントに無ければ 404。(5) Idempotency-Key を別の本文で使い回す: 最初の結果を返さず 422 idempotency_key_reused。自己統合と循環は 422 merge_cycle。本文は zod で sourceVendorIds 0〜50 件、rawNames 0〜50 件・各 1〜200 文字・制御文字なし、両方が空なら 400。Idempotency-Key は 8〜64 文字の [A-Za-z0-9-] で、(user_id, actor_user_id, key) の組で一意にする (別の利用者の key と衝突しても干渉しない)。取り消しはテナントの全利用者に許す (qa-subsmerge-undo-scope-001) ので、防ぐのではなく、操作者を残して辿れるようにする。新しい 3 つの path は canonical-mutation-fence と mustChangePasswordFence の対象表に登録し、パスワード変更前と lease 保持中の書込みを既存と同じく止める。認証・認可の検査 (authGuard・mustChangePasswordFence) が拒否した要求は path・理由・actor の id でログに残す (V16.3.2)。

- (根拠の性質: アシスタントの推定 (利用者確認も検証可能な出典も経ていない) / 出所: 利用者決定 qa-subsmerge-undo-scope-001・actor-record-001・decision-005・retention-001 と再承認 appr-foundation-subsmerge-002 (G4: 全利用者で共通の共有テナントのデータだけを変更できる) を満たすための具体値としてエージェントが推定した設計。旧 G4 の承認 appr-foundation-subsmerge-001 を出所とする qa-subsmerge-security-web-002 を置き換える。利用者は件数上限・文字種・ステータスコード・ログの項目を決めていない。answered_at は本 entry の記録直前に実測した記録時刻。 / 回答時刻: 2026-09-30T13:35:08Z)

#### この承認を名指ししている質疑: `qa-subsmerge-infrastructure-web-003`

**問**

共有テナントと利用者決定 (qa-subsmerge-undo-scope-001・actor-record-001・decision-005・retention-001) の下で、既存の Workers + D1 の上限の中で、統合・並行操作・操作表の掃除をどう収めるか (利用者が決めていない具体値)。

**答**

wrangler.jsonc の binding (D1 kanjo-db・R2 kanjo-files) は変えず、Durable Objects・Queues・新しい有料機能を足さない (qa-subsmerge-decision-005)。統合・取り消しの 1 回の要求で発行する D1 の問い合わせは、テナントの検査・現在の revision の読み取り・freee 仕訳のサブスク対象分の読み取り・db.batch 1 回 (8 文)・lease の取得と解放を合わせて 20 文未満にし、Worker の 1 invocation の上限 50 (Workers Free) を超えない。monthly_agg の再挿入は json_each(?) の 1 文にし、1 文の bound parameter の上限 100 を避ける。canonical mutation の lease は取込の 15 分 (IMPORT_CLAIM_TTL_MS) と分け、サブスク等は 2 分 (CANONICAL_MUTATION_CLAIM_TTL_MS) にして、強制終了で解放されなかった lease が後続を止める時間を縮める。D1 が overloaded を返したら 500 ではなく 503 d1_overloaded (retryable) で返す。夜間保守の D1 query 予算は 49/49 で埋まっている (scheduled-maintenance-budget.ts:21) ので新しい job を足さず、操作表の掃除は書込みの batch のついでに 50 件ずつ行う (routes/imports.ts:2905-2917 の purgeExpiredImportRows と同じ型)。migration 0058 は ALTER TABLE ADD COLUMN・CREATE TABLE・CREATE INDEX だけの追加型なので migration-approvals.json の承認は要らず、main への merge で既存の deploy が本番 D1 へ適用する。実装の着手時に origin/main を取り直し、0058 の番号が空いていることを確かめる。

- (根拠の性質: アシスタントの推定 (利用者確認も検証可能な出典も経ていない) / 出所: 利用者決定 qa-subsmerge-undo-scope-001・actor-record-001・decision-005・retention-001 と再承認 appr-foundation-subsmerge-002 (G4: 全利用者で共通の共有テナントのデータだけを変更できる) を満たすための具体値としてエージェントが推定した設計。旧 G4 の承認 appr-foundation-subsmerge-001 を出所とする qa-subsmerge-infrastructure-web-002 を置き換える。利用者はTTL の長さ・問い合わせ数の配分・掃除の置き場所を決めていない。answered_at は本 entry の記録直前に実測した記録時刻。 / 回答時刻: 2026-09-30T13:35:08Z)

#### この承認を名指ししている質疑: `qa-subsmerge-maintenance-ops-web-003`

**問**

共有テナントと利用者決定 (qa-subsmerge-undo-scope-001・actor-record-001・decision-005・retention-001) の下で、統合・取り消し・並行制御・保持をどのテストで守り、失敗をどう運用で辿るか (利用者が決めていない具体値)。

**答**

core の契約テスト (subs-contract / subs-screen-contract に追加): resolveVendorMerges の連鎖・循環・取り消し、統合元の完全一致が統合先に吸収されること、applyFreeeDeals とサブスク画面が同じ名寄せを返すこと。api の統合テスト (subs-screen.integration.test.ts と新しい subs-merge-operations.integration.test.ts): aquavoice 型 (登録済みの行を別の登録済み行へ統合) で統合元の行 0 件と月額の和の一致、5 件連続と 2 件同時の送信で 500 が 0 件・409 と最終の集計の一致、別の利用者が統合を取り消せて両方の actor_user_id が残ること、テナントに無い id は 404、取り消し済みは 409 already_undone、31 日前の created_at の fixture で 410 undo_expired、同じ key を別の本文で送ると 422、掃除 (30 日で NULL・400 日で削除・1 回 50 件まで)、GET が before_json と payload_json を返さないこと、ログに取引名・別名・email が出ないこと。web の DOM テスト (subscriptions-screen.dom.test.tsx): 行チェック・全選択の mixed・選択バー・統合先の選択・操作状態の 4 状態・操作者の email と「削除された利用者」・元に戻す・処理中の無効化・409 busy は自動で再送し 5xx は自動で再送せず再試行ボタンを出すこと。テストのデータは匿名化済みの samples と fixture だけを使い、samples/*.csv は seed-local.mjs の生成物なので直接編集しない。運用は docs/subscriptions-screen.md に、止まった操作を辿る 3 段の手順 (画面の操作状態 → GET /api/subscription-operations → Workers の observability を操作 id で検索)、保持期間 (取り消しは 30 日・記録は 400 日)、注意 (書込みが無い期間は期限を過ぎた行が残るが、取り消せるかは created_at で判定するので 30 日を過ぎたものは戻せない) を書く。pnpm verify:full と CI を緑にしてから merge する。

- (根拠の性質: アシスタントの推定 (利用者確認も検証可能な出典も経ていない) / 出所: 利用者決定 qa-subsmerge-undo-scope-001・actor-record-001・decision-005・retention-001 と再承認 appr-foundation-subsmerge-002 (G4: 全利用者で共通の共有テナントのデータだけを変更できる) を満たすための具体値としてエージェントが推定した設計。旧 G4 の承認 appr-foundation-subsmerge-001 を出所とする qa-subsmerge-maintenance-ops-web-002 を置き換える。利用者はテストの配置と名前・運用手順の書き先を決めていない。answered_at は本 entry の記録直前に実測した記録時刻。 / 回答時刻: 2026-09-30T13:35:08Z)

#### この承認を名指ししている質疑: `qa-subsmerge-auth-web-003`

**問**

共有テナントと利用者決定 (qa-subsmerge-undo-scope-001・actor-record-001・decision-005・retention-001) の下で、統合・取り消し・操作履歴の API で、認証・業務データのキー・操作者をどう扱うか (利用者が決めていない具体値)。

**答**

認証方式は変えない。新しい POST /api/sub-vendors/merge・POST /api/subscription-operations/:id/undo・GET /api/subscription-operations は、既存の /api/* と同じく authGuard・mustChangePasswordFence・canonicalMutationFence の配下に置く。業務データのキー c.get('userId') は全利用者で同じ TENANT_ID (auth.ts:36、:257-258、:276-277) で、利用者を特定しない。操作した利用者は、認証後のミドルウェアが httpOnly・secure・SameSite=Strict のセッション cookie から設定する c.get('actor') の id を使う。user_id と actor は本文・クエリ・ヘッダ (Idempotency-Key を含む) から受け取らない。取り消しと操作履歴はテナント全体を対象にし、role (admin | member) で分けない (qa-subsmerge-undo-scope-001)。テナントに無い操作 id は 404。

- (根拠の性質: アシスタントの推定 (利用者確認も検証可能な出典も経ていない) / 出所: 利用者決定 qa-subsmerge-undo-scope-001・actor-record-001・decision-005・retention-001 と再承認 appr-foundation-subsmerge-002 (G4: 全利用者で共通の共有テナントのデータだけを変更できる) を満たすための具体値としてエージェントが推定した設計。旧 G4 の承認 appr-foundation-subsmerge-001 を出所とする qa-subsmerge-auth-web-002 を置き換える。利用者は新しい API をどの guard の配下に置くかを決めていない。answered_at は本 entry の記録直前に実測した記録時刻。 / 回答時刻: 2026-09-30T13:35:08Z)

## 意思決定支援 (decisions)

| ID | 論点 | 状態 | 選択肢 (費用・適合・注意点) | AI推奨 | ユーザー決定 | 資するゴール |
|---|---|---|---|---|---|---|
| decision-subsmerge-003 | 統合・登録・変更・見直し判断を連続・同時に行ったときの書込みを、どの仕組みで管理するか (「サーバー側で処理に失敗しました」で止まらないようにする) | confirmed | d1-operation-log:操作ログで順次処理 (既存の Workers + D1 だけ) / cost={'category': 'free', 'amount': 0, 'currency': 'USD', 'billing_period': 'month', 'tco': '追加の利用料は 0 (D1 Free の枠内で行の読み書きが増えるだけ)。構築: 操作表と revision 列の追加 migration、api の書込み経路を 1 回の db.batch (照合・変更・操作の記録・revision +1・再集計・snapshot 無効化) へ書き換え、画面の待ち行列と操作状態の表示。運用: 操作表の保持期間と lease の掃除。撤退: 表を残して参照を外すだけで、データの移し替えは要らない。'} / free=D1 Free: rows read 5 million/day、rows written 100,000/day、storage 5 GB。日次上限を超えると日次のリセットまでクエリがエラーを返す。 / fit=G1: 書込みと再集計を 1 回の db.batch (transaction) にまとめ、統合元の行が一覧に残らない。G2: 冪等キーで重複送信を最初の結果に畳み、revision の照合で古い画面からの上書きと、別の利用者・別タブとの同時操作の 2 件目を 409 にして、500 を出さない。画面は連続操作を待ち行列に積んで順に送り、409 は自動で読み直して再試行する。G4: 操作の記録から取り消せる。 / pros=新しい構成要素や課金対象が増えない, 既存の D1 migration と deploy の流れにそのまま乗る, db.batch が途中の 1 文の失敗で全体を巻き戻すため、一部だけ反映された状態が残らない / cons=D1 は auto-commit で動き、transaction にまとめられるのは 1 回の batch() に並べた文だけである。照合と書込みを別の問い合わせに分けると、その間に別の要求が割り込める。そのため revision の照合は batch の中の条件付きの書込みで行い、別の利用者・別タブとの同時操作の 2 件目は待たせずに 409 にして、画面の自動再試行で順に通す, lease と操作表の掃除を自前で持つ / risks=処理の途中で Worker が止まると lease が TTL まで残り、その間の次の操作が待たされる, 再集計の書込み行数が増えると D1 Free の rows written 100,000/day に近づく, 要求が集中して D1 の待ち行列が満杯になると overloaded のエラーが返るため、API はこれを再試行できる失敗として返し、画面が自動で再試行する必要がある / lock-in=低 (D1 は SQLite 互換で、表と SQL をそのまま移せる) / ops=低 (lease の TTL と操作表の保持期間の見張りだけ) / evidence=https://developers.cloudflare.com/d1/worker-api/d1-database/, https://developers.cloudflare.com/d1/platform/limits/, https://developers.cloudflare.com/d1/platform/pricing/<br>durable-objects-sqlite:Durable Objects で直列化 (共有テナントに 1 つ、SQLite backend) / cost={'category': 'free', 'amount': 0, 'currency': 'USD', 'billing_period': 'month', 'tco': 'Workers Free なら SQLite backend の無料枠内で利用料 0。Workers Paid では、公式の計算例は従量分に最低 $5/月 の利用料を加えており、含まれる枠を超えると従量。構築: Durable Object class・binding・wrangler の migration の追加、書込み経路を DO 経由へ移す、DO の中の待ち行列、miniflare でのテスト環境の追加。運用: DO と D1 の二つの状態の整合を見る。撤退: DO 経由の経路を D1 直の経路へ戻す改修が要る。'} / free=Workers Free: SQLite backend の Durable Objects のみ。requests 100,000/day、duration 13,000 GB-s/day、rows read 5 million/day、rows written 100,000/day、stored 5 GB。 / fit=G2 に最も強い: 共有テナントのキーから名前を導いた 1 つの DO に書込みを集めれば、別の利用者どうしの同時の書込みも拒否せず待たせて順に処理でき、409 と再試行が要らない。ただし業務データは D1 にあり、DO から D1 への書込みは DO の storage の操作ではないので input gate が効かず、その間は他の要求が割り込める。順に処理するには DO の中に 1 件ずつ await する待ち行列を自前で作る必要がある。G1・G4 は D1 に書く処理として操作ログ案と同じ作りが別に要る。 / pros=同時の操作を 409 にせず、待たせて順に処理できる (DO の中の待ち行列を正しく作った場合), lease と TTL の管理が要らない / cons=Cloudflare の構成要素が増え (DO class・binding・wrangler migration)、移行と運用の手間が増える, DO から D1 への書込みは input gate の保護の外なので、DO の中の待ち行列を自前で作る必要がある。blockConcurrencyWhile() でも止められるが、公式は初期化以外に使うと処理量が大きく落ちるとしている, DO から D1 への書込みが途中で失敗した場合の整合を別に設計する必要がある / risks=Workers Free の日次上限を超えると DO へのリクエストが失敗する, Cloudflare 固有の API に書込み経路が依存する, 全利用者の書込みが 1 つの DO に集まり、公式が bottleneck になるとする形になる (1 回 約 5ms なら 約 200 requests/second が上限。現在の利用規模では届かない) / lock-in=中〜高 (Durable Objects は Cloudflare 固有の API) / ops=中 (DO と D1 の二重の状態とテスト環境) / evidence=https://developers.cloudflare.com/durable-objects/platform/pricing/, https://developers.cloudflare.com/durable-objects/concepts/what-are-durable-objects/, https://developers.cloudflare.com/durable-objects/best-practices/rules-of-durable-objects/<br>client-serial-only:画面側で 1 件ずつ送るだけ / cost={'category': 'free', 'amount': 0, 'currency': 'USD', 'billing_period': 'month', 'tco': '追加の利用料は 0。構築は画面の送信を直列にするだけで最小。ただしサーバー側の整合は変わらないため、別の利用者・別タブ・別端末の同時操作と、書込みと再集計が別処理のままの失敗について、調査と手当ての運用費が残る。'} / free=追加の課金対象なし (既存の D1 Free の枠内)。 / fit=G2 のうち同じ画面からの連続操作にしか効かない。別の利用者・別タブとの同時操作、G1 の統合元が一覧に残る問題、G4 の取り消しと古い画面からの上書きは解決しない。 / pros=変更が最小で、新しい表も migration も要らない / cons=別の利用者・別タブ・別端末からの同時操作を防げない, 書込みと再集計が別の処理のままで、再集計の失敗が残る / risks=一部だけ反映された状態が残り、一覧と集計がずれたままになる / lock-in=低 / ops=低 (ただし障害の調査と手当てが残る) / evidence=https://tanstack.com/query/latest/docs/framework/react/guides/mutations | d1-operation-log — G1〜G4 を既存の Workers + D1 だけで満たせ、利用料 0・構成要素の追加なし・撤退が容易。ログインできる利用者 (admin と member) は全員が同じ共有テナントのデータを扱うので、同時操作は別の利用者・別タブ・連打のどれからも起こりうる。それを待たせて並べられる点では DO 案が勝る。操作ログ案では同時の 2 件目が 409 になるが、画面が自動で読み直して再試行するため利用者には失敗として見えず、G2 の「500 が 0 件」を満たせる。 (注意: 別の利用者・別タブからの同時の 2 件目は、待たされずに revision 不一致の 409 になり、画面の自動再試行で順に通す (DO のように待たせて並べるのではない)。再試行の上限を超えたときだけ、利用者に失敗と再試行ボタンを見せる, D1 で transaction にできるのは 1 回の batch() だけなので、revision を batch の外で先に読んで判断すると、その間に別の要求が割り込む。照合は batch の中の条件付きの書込みで行う, 処理の途中で Worker が止まると lease が TTL まで残り、その間の次の操作が待たされる, D1 Free の rows written 100,000/day を超えると日次のリセットまでクエリが失敗するため、再集計で書き換える行を統合に関わる範囲に絞る, 要求が集中して D1 が overloaded を返したときは、500 ではなく再試行できる失敗として返す, 同時操作が常態になり 409 の再試行が目立つようになったら、DO 案へ移す判断をやり直す; confidence=medium; checked=2026-09-30T12:47:12Z) | d1-operation-log @ 2026-09-30T13:05:44Z | G1, G2, G4 |
