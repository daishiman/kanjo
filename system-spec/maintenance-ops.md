---
status: confirmed
category: maintenance-ops
aggregate: 確定
spec_cells: [maintenance-ops.web, maintenance-ops.mobile, maintenance-ops.tablet, maintenance-ops.desktop-windows, maintenance-ops.desktop-linux, maintenance-ops.desktop-macos]
serves_goals: [G1, G2, G3, G4]
---

# 保守運用管理 (maintenance-ops)

質疑録・承認記録は当時の文面を保持する。現行の数値契約は [specの確定節](../specs/spec-subscriptions-merge.md#推定月額の契約確定) を参照する。

## 現行契約への入口

本章の質疑・承認・出典は収集時の凍結記録として保持する。過去の回答の具体値と現行契約が異なる場合は [spec-subscriptions-merge](../specs/spec-subscriptions-merge.md) の「確定した実装契約」を適用する。過去の記録を現行契約の別正本にはしない。

実行結果は docs の検証索引を参照する。CI・本番確認は未確認のまま記録し、ローカルの成功をCI成功に置き換えない。

推定月額は統合後の明細から再計算し、各月の実支払額を保存する。2026-10-01の完了指示を受け、既存計算規則を採用して現行specへ反映した。統合元完全一致保持と科目互換の共通化はcoreの現行コードを確認してspecへ反映した。API最終完了報告に合わせ、kind/commandのreplay照合、leaseを取得しないGET前後stamp検査、サブスクJSON復元だけのundo barrier、optional保存metadataの往復をspecへ反映した。一般settings restoreはundoを阻害しない。現行契約・互換性・検証結果はspecとdocsの検証索引を参照する。ローカル全体suiteの結果は検証レポートを参照。CIは未確認。


- カテゴリ集約状態: **確定**
- 章確定マーカー: `status: confirmed`

## カテゴリ別収集状態

| プラットフォーム | 状態 | 根拠 |
|---|---|---|
| Web (web) | 確定 | 確定質疑: qa-subsmerge-retention-001。裏付け質疑 (`qa_refs`): `qa-subsmerge-maintenance-ops-web-evidence-001`, `qa-subsmerge-maintenance-ops-web-evidence-002`, `qa-subsmerge-maintenance-ops-web-003`, `qa-subsmerge-undo-scope-001`, `qa-subsmerge-actor-record-001`, `qa-subsmerge-decision-005`, `qa-subsmerge-presented-options-007` — 本章の「確定内容 (質疑録)」へ接地根拠として併記。資するゴール: G1, G2, G3, G4 |
| モバイル (mobile) | 対象外 | 理由: スマートフォン向け専用アプリを提供していたなら、maintenance-ops では端末の種類ごとの動作確認とストア審査を含むリリース手順を決める必要があった。対象を web のみとする利用者決定 (qa-subsmerge-target-platforms-002) によりその検討は発生しない。 |
| タブレット (tablet) | 対象外 | 理由: タブレット向け専用アプリを提供していたなら、maintenance-ops では端末の種類ごとの動作確認とストア審査を含むリリース手順を決める必要があった。対象を web のみとする利用者決定 (qa-subsmerge-target-platforms-002) によりその検討は発生しない。 |
| デスクトップ (Windows) (desktop-windows) | 対象外 | 理由: Windows 向けデスクトップアプリを提供していたなら、maintenance-ops では端末の種類ごとの動作確認とストア審査を含むリリース手順を決める必要があった。対象を web のみとする利用者決定 (qa-subsmerge-target-platforms-002) によりその検討は発生しない。 |
| デスクトップ (Linux) (desktop-linux) | 対象外 | 理由: Linux 向けデスクトップアプリを提供していたなら、maintenance-ops では配布形式 (パッケージ) ごとの動作確認とパッケージ配布を含むリリース手順を決める必要があった。対象を web のみとする利用者決定 (qa-subsmerge-target-platforms-002) によりその検討は発生しない。 |
| デスクトップ (macOS) (desktop-macos) | 対象外 | 理由: macOS 向けデスクトップアプリを提供していたなら、maintenance-ops では端末の種類ごとの動作確認とストア審査を含むリリース手順を決める必要があった。対象を web のみとする利用者決定 (qa-subsmerge-target-platforms-002) によりその検討は発生しない。 |

## 対象外の承認範囲

> 本章の対象外セルが引用している承認の実体。状態表の「承認: <id>」だけでは、その承認が何をどこまで認めたものかを章から辿れない。

### 承認: `appr-platforms-subsmerge-002`

対象 platform を 1 論点の独立した問い (qa-subsmerge-target-platforms-002) で聞き直し、利用者が「web のみ (Recommended)」を選択した。mobile / tablet / desktop-windows / desktop-linux / desktop-macos の 5 platform × 8 カテゴリ = 40 セルを対象外とすることの一括承認。回答の記録時刻 2026-09-30T12:01:17Z。basis=user-decision。

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

## 上流指針 (doctrine anchors)

> 本章の設計判断が従う上流の正本 (1 concern 1 authority)。具体技術ではなく上流工程を導く規範であり、下位の技術選定は本節と矛盾してはならない。正本: `ref-system-design-knowledge/references/doctrine-anchor-registry.json`

| 設計 concern | 上流の正本 (authority) | 導く範囲 | 出典 | 最終確認 | 本章の確定セルへの反映 |
|---|---|---|---|---|---|
| operations | Google SRE | 運用手順・障害対応・トイル削減・ポストモーテムの上流指針 | https://sre.google/workbook/ | 2026-07-12 | 統合が止まったときの辿り方を「画面の操作状態 → GET /api/subscription-operations → Workers の observability を操作 id で検索」の 3 段の手順として docs/subscriptions-screen.md に書く形へ反映した。完了の条件を pnpm verify:full と CI の緑に置き、本番の再現ケース (aquavoice 型) を api の統合テストとして残す。 |

## 確定内容 (質疑録)

> 本章の各確定セルが何を根拠に確定したかの実体。`qa_ref` が主たる接地根拠、`qa_refs` がそれを支える裏付け質疑であり、いずれも qa_log (spec-state.json) の逐語である。ここに現れない主張は本章の確定内容ではない。

### Web (web)

- 資するゴール: G1, G2, G3, G4

#### 主たる接地根拠: `qa-subsmerge-retention-001`

**問**

(d) 操作の記録と、取り消し用データの保持期間はどうしますか？

**答**

取消30日・記録400日 (Recommended)（選択肢の説明: 既存の期間（削除の取り消しは 30 日、監査ログの見出しは 400 日）にそろえます。30 日を過ぎたら、変更前の内容を消して見出しだけ残します。注意: 夜間の予算は 49/49 で使い切っているため、期限切れの行は新しい操作の batch のついでに消します。）

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: 利用者が AskUserQuestion (記録時刻 2026-09-30T12:58:28.555Z、提示の全文と選択肢の説明は qa-subsmerge-presented-options-006) で注意点付きの選択肢から選んだ回答。回答は 2026-09-30T13:05:44.372Z の tool_result に逐語で『"(d) 操作の記録と、取り消し用データの保持期間はどうしますか？"="取消30日・記録400日 (Recommended)"』と記録されている。answered_at は回答の記録時刻で、利用者が選んだ時刻の上界 (提示 12:58:28Z より後)。reopen (12:54:40Z) より後に取り直した回答。 / 回答時刻: 2026-09-30T13:05:44Z)

#### 裏付け質疑: `qa-subsmerge-maintenance-ops-web-evidence-001`

**問**

maintenance-ops 章の裏付けとして、サブスクの統合と並行操作を守る既存のテストと文書について何を観測したか。

**答**

既存テストは packages/core/test/subs-contract.test.ts・subs-screen-contract.test.ts・subs-review-contract.test.ts (core の契約)、packages/api/src/subs-screen.integration.test.ts・subs-vendor-scope.test.ts (api)、packages/web/src/subscriptions-screen.dom.test.tsx (web の DOM) で、登録済みの行を別の行へ統合するケース、同時・連続送信、統合の取り消し、他画面の集計との名寄せ一致を検査するものは無い。e2e のサブスク統合テストも無い。総収支の操作履歴には packages/api/test/total-cashflow-operations.integration.test.ts がある。文書は features/feat-subscriptions-screen.md (と .context.json)・specs/spec-subscriptions-screen.md・architecture/subscriptions-*.md (8 章)・docs/subscriptions-screen.md。

- (根拠の性質: コード・設定・公式文書で検証できる観測事実 / 出所: リポジトリの現物 (ファイル一覧とテストの内容) を読んで記録した観測。answered_at は観測後に実測した時刻。 / 回答時刻: 2026-09-30T08:06:00Z)

#### 裏付け質疑: `qa-subsmerge-maintenance-ops-web-evidence-002`

**問**

保持期間と操作者の記録を決めるために、既存コードの取り消しの結果の分け方・夜間保守の D1 予算・要求のついでの掃除・利用者の表と操作者の列・migration の番号はどうなっているか (観測)。

**答**

(1) 既存の取り消しの結果の分け方: packages/api/src/routes/deletions.ts:324 は操作が無ければ 404 not_found、:326 は取り消し済みなら 409 already_undone、:327-336 は期限切れを 410 undo_expired で返し、:327 のコメントは『期限切れは「無い」ではなく「もう戻せない」。404 と区別して 410 を返す』とする。 (2) 夜間保守の D1 query 予算: packages/api/src/scheduled-maintenance-budget.ts:13 は SCHEDULED_D1_QUERY_LIMIT = 50、:21 は SCHEDULED_D1_QUERY_PLAN_MAX = 49 で、:24-31 に 8 つの job (nightly_backup・r2_cleanup・password_login_rate_limit_cleanup・improvement_retention・deletion_undo_retention・audit_header_retention・audit_detail_retention・cash_soft_delete_purge) を並べ、:17 のコメントは『新規 job は既存枠を再配分しない限り追加できない』とする。 (3) 要求のついでの掃除: packages/api/src/routes/imports.ts:2905-2910 のコメントは『期限切れの検査と古い時間枠は、夜間保守ではなくこの要求のついでに消す。夜間の D1 query 予算 (1 invocation 50 本) は既存 8 job で埋まっており…』とし、:2912 で purgeExpiredImportRows を呼び、失敗は :2917 の job 'import_expired_rows_purge' としてログに残すだけで要求は落とさない。 (4) 利用者と操作者の列: migrations/0039_account_login.sql:7 の users は id・email (NOT NULL UNIQUE、小文字)・password_hash・role (admin | member)・status (active | suspended) などを持ち、表示名の列は無い。users の行を消す SQL (DELETE FROM users) は packages/api/src と migrations に 0 件で、scripts/seed-admin.test.mjs:22 は初期 admin の生成 SQL に DELETE FROM users が含まれないことを検査している。利用者は routes/admin-users.ts の status 更新 (:110 の action 'admin_user_suspend') で停止する。migrations/0046_liability_status.sql:19 の liability_audit_log.actor_user_id は TEXT NOT NULL で、外部キー (REFERENCES) は付いていない。 (5) migration の番号: migrations/ の最新は 0057_improvement_request_screen.sql で、次の番号は 0058。

- (根拠の性質: コード・設定・公式文書で検証できる観測事実 / 出所: 本セッション中 (本 entry の記録直前まで) に、リポジトリの現物 (packages/api/src/routes/deletions.ts、scheduled-maintenance-budget.ts、routes/imports.ts、routes/admin-users.ts、scripts/seed-admin.test.mjs、migrations/0039_account_login.sql・0046_liability_status.sql と migrations/ の一覧) を grep と sed で確かめた観測。answered_at は本 entry の記録直前に実測した記録時刻で、観測の時刻の上界。 / 回答時刻: 2026-09-30T13:35:08Z)

#### 裏付け質疑: `qa-subsmerge-maintenance-ops-web-003`

**問**

共有テナントと利用者決定 (qa-subsmerge-undo-scope-001・actor-record-001・decision-005・retention-001) の下で、統合・取り消し・並行制御・保持をどのテストで守り、失敗をどう運用で辿るか (利用者が決めていない具体値)。

**答**

core の契約テスト (subs-contract / subs-screen-contract に追加): resolveVendorMerges の連鎖・循環・取り消し、統合元の完全一致が統合先に吸収されること、applyFreeeDeals とサブスク画面が同じ名寄せを返すこと。api の統合テスト (subs-screen.integration.test.ts と新しい subs-merge-operations.integration.test.ts): aquavoice 型 (登録済みの行を別の登録済み行へ統合) で統合元の行 0 件と月額の和の一致、5 件連続と 2 件同時の送信で 500 が 0 件・409 と最終の集計の一致、別の利用者が統合を取り消せて両方の actor_user_id が残ること、テナントに無い id は 404、取り消し済みは 409 already_undone、31 日前の created_at の fixture で 410 undo_expired、同じ key を別の本文で送ると 422、掃除 (30 日で NULL・400 日で削除・1 回 50 件まで)、GET が before_json と payload_json を返さないこと、ログに取引名・別名・email が出ないこと。web の DOM テスト (subscriptions-screen.dom.test.tsx): 行チェック・全選択の mixed・選択バー・統合先の選択・操作状態の 4 状態・操作者の email と「削除された利用者」・元に戻す・処理中の無効化・409 busy は自動で再送し 5xx は自動で再送せず再試行ボタンを出すこと。テストのデータは匿名化済みの samples と fixture だけを使い、samples/*.csv は seed-local.mjs の生成物なので直接編集しない。運用は docs/subscriptions-screen.md に、止まった操作を辿る 3 段の手順 (画面の操作状態 → GET /api/subscription-operations → Workers の observability を操作 id で検索)、保持期間 (取り消しは 30 日・記録は 400 日)、注意 (書込みが無い期間は期限を過ぎた行が残るが、取り消せるかは created_at で判定するので 30 日を過ぎたものは戻せない) を書く。pnpm verify:full と CI を緑にしてから merge する。

- (根拠の性質: アシスタントの推定 (利用者確認も検証可能な出典も経ていない) / 出所: 利用者決定 qa-subsmerge-undo-scope-001・actor-record-001・decision-005・retention-001 と再承認 appr-foundation-subsmerge-002 (G4: 全利用者で共通の共有テナントのデータだけを変更できる) を満たすための具体値としてエージェントが推定した設計。旧 G4 の承認 appr-foundation-subsmerge-001 を出所とする qa-subsmerge-maintenance-ops-web-002 を置き換える。利用者はテストの配置と名前・運用手順の書き先を決めていない。answered_at は本 entry の記録直前に実測した記録時刻。 / 回答時刻: 2026-09-30T13:35:08Z)

#### 裏付け質疑: `qa-subsmerge-undo-scope-001`

**問**

(a) サブスクの統合を、誰が取り消せるようにしますか？

**答**

テナントの全利用者 (Recommended)（選択肢の説明: admin も member も、誰の統合でも取り消せます。既存の取り消し 2 つと同じ範囲です。注意: 他の人の作業を戻せてしまうため、画面に操作者を表示する必要があります（(b) で記録を残すことが前提）。）

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: 利用者が AskUserQuestion (記録時刻 2026-09-30T12:58:28.555Z、提示の全文と選択肢の説明は qa-subsmerge-presented-options-006) で注意点付きの選択肢から選んだ回答。回答は 2026-09-30T13:05:44.372Z の tool_result に逐語で『"(a) サブスクの統合を、誰が取り消せるようにしますか？"="テナントの全利用者 (Recommended)"』と記録されている。answered_at は回答の記録時刻で、利用者が選んだ時刻の上界 (提示 12:58:28Z より後)。reopen (12:54:40Z) より後に取り直した回答。 / 回答時刻: 2026-09-30T13:05:44Z)

#### 裏付け質疑: `qa-subsmerge-actor-record-001`

**問**

(b) 統合と取り消しを「誰が行ったか」を記録しますか？

**答**

操作表に残す (Recommended)（選択肢の説明: 0058 で新しく作る操作表に actor_user_id NOT NULL を持たせ、同じ batch で書きます（0046 と同じ作りで、既存の表を変えない migration です）。注意: 利用者を削除しても id は残るので、表示は「削除された利用者」にします。）

> **訂正あり** — 直上の答は凍結された記録であり、後から次の訂正が入っている。
> 本文中の記述と食い違う場合は、訂正側が正である。
>
> - `2026-09-30T14:09:17Z` — 本 entry の答にある選択肢の説明『利用者を削除しても id は残るので、表示は「削除された利用者」にします』は、利用者を削除する経路があると読める書き方だった。実際には API と migrations に users の行を消す SQL は無く、利用者は status='suspended' で停止する (qa-subsmerge-maintenance-ops-web-evidence-002)。操作表に actor_user_id を外部キーなしで残すという選択の中身はこの前提に依らない。停止中の利用者も email で示し、「削除された利用者」の表示は、手作業の運用などで users に行が見つからない例外時だけに使う。同じ訂正は qa-subsmerge-presented-options-006 に 2026-09-30T13:35:08Z で付いている。利用者の回答そのもの (逐語) は正しく記録されている。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: 利用者が AskUserQuestion (記録時刻 2026-09-30T12:58:28.555Z、提示の全文と選択肢の説明は qa-subsmerge-presented-options-006) で注意点付きの選択肢から選んだ回答。回答は 2026-09-30T13:05:44.372Z の tool_result に逐語で『"(b) 統合と取り消しを「誰が行ったか」を記録しますか？"="操作表に残す (Recommended)"』と記録されている。answered_at は回答の記録時刻で、利用者が選んだ時刻の上界 (提示 12:58:28Z より後)。reopen (12:54:40Z) より後に取り直した回答。 / 回答時刻: 2026-09-30T13:05:44Z)

#### 裏付け質疑: `qa-subsmerge-decision-005`

**問**

(c) 同時処理の仕組み（decision-subsmerge-003）は、推奨の「操作ログで順次処理」で確定してよいですか？

**答**

操作ログで順次処理 (Recommended)（選択肢の説明: 既存の Workers と D1 だけで実現します。同時の 2 件目は 409 になり、画面が自動で再試行します。注意: 待たせて並べるのではありません。再試行の上限を超えたときだけ失敗を表示します。）

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: 利用者が AskUserQuestion (記録時刻 2026-09-30T12:58:28.555Z、提示の全文と選択肢の説明は qa-subsmerge-presented-options-006) で注意点付きの選択肢から選んだ回答。回答は 2026-09-30T13:05:44.372Z の tool_result に逐語で『"(c) 同時処理の仕組み（decision-subsmerge-003）は、推奨の「操作ログで順次処理」で確定してよいですか？"="操作ログで順次処理 (Recommended)"』と記録されている。answered_at は回答の記録時刻で、利用者が選んだ時刻の上界 (提示 12:58:28Z より後)。reopen (12:54:40Z) より後に取り直した回答。 / 回答時刻: 2026-09-30T13:05:44Z)

#### 裏付け質疑: `qa-subsmerge-presented-options-007`

**問**

取り消しの範囲・操作者の記録・同時処理の仕組み (decision-subsmerge-003) の再確認・保持期間について、利用者へ提示した本文と選択肢 (各選択肢の説明を含む) は何か (逐語)。

**答**

~~~text
[提示本文 2026-09-30T12:58:16.401Z]
質問の準備ができました。その過程で、保持期間 (d) の決め方に関わる新しい事実が 1 つ見つかりました。

- 夜間の掃除（`scheduledMaintenance`）で使える D1 の問い合わせ予算は、49 本の上限をすでに使い切っています（`packages/api/src/scheduled-maintenance-budget.ts:13-21`）。
- 夜間の掃除に新しい処理を足すには、既存の枠を削る必要があります。
- データ取込画面はこの制約を避けるため、期限切れの行を夜間ではなく、その要求のついでに消しています（`packages/api/src/routes/imports.ts:2905`）。

以下、R5 の順で全文を示します。

---

## 1. 決まっていないこと（4 つ）

- **(a)** 統合を誰が取り消せるか
- **(b)** 統合と取り消しを誰が行ったかを記録するか
- **(c)** 同時処理の仕組み（decision-subsmerge-003）の再確認
- **(d)** 操作の記録と、取り消し用データの保持期間

**前提（コードで確かめた事実）**
- ログインできる利用者（admin と member）は、全員が同じ共有テナント（`TENANT_ID='default'`）のデータを扱います。
  - `c.get('userId')` は全員で同じ値です。
  - 操作した人は `c.get('actor').id` で分かります（`auth.ts:36`、`:257-258`、`:276-277`）。
- 既存の取り消し 2 つ（データ削除の取り消しと、総収支の操作の取り消し）は、テナントで絞り込んでいます。操作した人では絞っていません。
- 保持期間は次のとおりです。
  - 削除の取り消しは 30 日。
  - audit_log は、見出しが 400 日、詳細が 90 日。
- audit_log の action は CHECK 制約で列挙されています。種類を増やすには表を作り直す必要があり、破壊的な migration になります。
  - そのため 0046 では別の表を作り、`actor_user_id TEXT NOT NULL` を持たせています。
  - 0042 の操作表には、操作者の列がありません。
- 次の migration 番号は 0058 です。

**影響する範囲**: web の 8 カテゴリ（auth、security、maintenance-ops、database、backend、frontend、infrastructure、ui-ux）です。12:54:40Z に reopen 済みで、今回の回答をもとに作り直します。

## 2. 比較の観点

G1〜G4 への適合 / TCO（利用料、構築、運用、撤退）/ security / operations / lock-in

## 3. 3 案の比較（(c) 同時処理の仕組み）

| 観点 | 操作ログで順次処理 | DO（共有テナントに 1 つ） | 画面側で 1 件ずつ送るだけ |
|---|---|---|---|
| 目標への適合 | G1〜G4 を全て満たします。同時の 2 件目は 409 になり、画面が自動で再試行します | G2 には最も強く、同時の要求を拒否せずに待たせて順に処理できます。ただし、DO から D1 への書込み中は input gate が効かないため、待ち行列を自前で作る必要があります | G1 と G4 は満たしません。G2 も、同じ画面での連打にしか効きません |
| TCO | 利用料は 0 です。migration と、書込みを 1 回の `batch()` にまとめる作業が要ります | Workers Free なら 0 です（Paid では、公式の計算例が最低 $5/月を加えています）。構成要素、テスト環境、状態の二重管理が増えます | 最小です。ただし障害の調査と手当ての手間が残ります |
| security | テナント境界、revision の照合、操作の記録を D1 の 1 か所で扱えます | 同じことを DO と D1 の 2 か所で扱います | 古い画面や別の利用者からの上書きを防げません |
| operations | 見張るのは lease の TTL と、操作表の保持だけです | DO と D1 の整合、1 つの DO への集中を監視する必要があります | 見張るものは少ないですが、ずれが残ります |
| lock-in | 低（SQLite 互換です） | 中〜高（Cloudflare 固有の API です） | 低 |

## 4. AI の推奨

- **(c)** 操作ログで順次処理
- **(a)** 同じテナントの全利用者が取り消せる
- **(b)** 操作表に `actor_user_id` を残す
- **(d)** 取り消し用データは 30 日、記録は 400 日。期限切れの行は、新しい操作を書く `batch()` のついでに消す

## 5. 推奨の理由

- **(c)**: 既存の Workers と D1 だけで G1〜G4 を満たせます。利用料は 0 で、構成要素も増えず、撤退も簡単です。
  - 同時操作は、別の利用者、別のタブ、連打のどれからも起こり得ます。待たせて順に並べる点では DO 案が上です。
  - それでも、2 件目を 409 にして画面が自動で再試行すれば、利用者には失敗として見えず、「500 が 0 件」を満たせます。
- **(a)**: 既存の取り消し 2 つと同じ範囲にそろいます。全員が同じデータを共有しているため、「本人だけ」にすると、本人がいないときに誰も直せません。
- **(b)**: 0058 で新しく作る表に列を足すだけなので、既存の表を変えない migration で済みます。0046 と同じ作りです。(a) で他の人の操作も取り消せるようにするなら、誰が操作したかを後から追える必要があります。
- **(d)**: 既存の保持期間（取り消しは 30 日、見出しは 400 日）にそろいます。夜間の予算は使い切っているため、データ取込画面と同じく要求のついでに消します。

## 6. 注意点

1. 同時の 2 件目は待たされず、409 になって自動で再試行されます。再試行の上限を超えたときだけ、失敗と再試行ボタンを表示します。
2. D1 で transaction にまとめられるのは、1 回の `batch()` に並べた文だけです。revision の照合は、その `batch()` の中の条件付き書込みで行います。
3. 途中で Worker が止まると、lease が TTL まで残ります。その間、次の操作は待たされます。
4. D1 Free には rows written 100,000/day の上限があります。再集計で書き換える行は、統合に関わる範囲に絞ります。
5. D1 が overloaded を返したときは、500 ではなく「再試行できる失敗」として返します。
6. 同時操作が常態になり 409 が目立つようになったら、DO 案への切り替えを検討し直します。
7. **(a)** 他の人の統合も取り消せるため、誰の操作かを画面に表示する必要があります。
8. **(b)** 利用者が削除された後も id は残ります（0046 と同じく外部キーは付けません）。表示は「削除された利用者」とします。
9. **(d)** 取り消しの期限は、API 側でも作成日時を見て判定します。掃除の遅れで古い操作が戻せてしまうことはありません。

## 7. 信頼度: medium

同時操作の頻度と、409 の再試行がどれくらい起きるかは、まだ測っていません。実装後に測る必要があります。

## 8. 確認日時と出典（公式、2026-09-30 UTC）

- D1 の `batch()`（auto-commit、1 回の batch だけが transaction）: https://developers.cloudflare.com/d1/worker-api/d1-database/ — 12:42:26Z
- D1 の制限（single-threaded、満杯になると overloaded）: https://developers.cloudflare.com/d1/platform/limits/ — 12:44:55Z
- D1 の料金: https://developers.cloudflare.com/d1/platform/pricing/ — 12:39:30Z
- DO の料金: https://developers.cloudflare.com/durable-objects/platform/pricing/ — 12:44:55Z
- DO の概念: https://developers.cloudflare.com/durable-objects/concepts/what-are-durable-objects/ — 12:39:30Z
- DO の規則（input gate、`blockConcurrencyWhile`、bottleneck）: https://developers.cloudflare.com/durable-objects/best-practices/rules-of-durable-objects/ — 12:47:12Z
- Idempotency-Key（draft-07）: https://datatracker.ietf.org/doc/html/draft-ietf-httpapi-idempotency-key-header-07 — 08:14:02Z
- TanStack Query の mutations: https://tanstack.com/query/latest/docs/framework/react/guides/mutations — 08:11:36Z

## 9. 確認のお願い

推奨をそのまま採用しても、別の案を選んでも構いません。「追加で比較してほしい」「保留したい」といった答えもできます（Other に書いてください）。

[AskUserQuestion の入力 2026-09-30T12:58:28.555Z]
[
  {
    "question": "(a) サブスクの統合を、誰が取り消せるようにしますか？",
    "header": "取消の範囲",
    "multiSelect": false,
    "options": [
      {
        "label": "テナントの全利用者 (Recommended)",
        "description": "admin も member も、誰の統合でも取り消せます。既存の取り消し 2 つと同じ範囲です。注意: 他の人の作業を戻せてしまうため、画面に操作者を表示する必要があります（(b) で記録を残すことが前提）。"
      },
      {
        "label": "操作した本人だけ",
        "description": "他の人の作業を誤って戻す事故が起きません。注意: 既存の取り消しと挙動が変わります。本人がいないときは誰も直せません。操作者の記録が必須です。"
      },
      {
        "label": "本人と admin",
        "description": "member は自分の統合だけ、admin は全員の統合を取り消せます。注意: 権限の分かれ目が増えるので、検査と画面の出し分けも増えます。"
      },
      {
        "label": "admin だけ",
        "description": "取り消しを admin に限ります。注意: member は自分の誤操作を自分で直せません。"
      }
    ]
  },
  {
    "question": "(b) 統合と取り消しを「誰が行ったか」を記録しますか？",
    "header": "操作者",
    "multiSelect": false,
    "options": [
      {
        "label": "操作表に残す (Recommended)",
        "description": "0058 で新しく作る操作表に actor_user_id NOT NULL を持たせ、同じ batch で書きます（0046 と同じ作りで、既存の表を変えない migration です）。注意: 利用者を削除しても id は残るので、表示は「削除された利用者」にします。"
      },
      {
        "label": "audit_log にも書く",
        "description": "監査ログの画面でも統合が見えるようになります。注意: audit_log の action の CHECK を広げるため、表を作り直す破壊的な migration になります。migration-approvals.json に sha256 を足して、PR で承認を得る必要があります。"
      },
      {
        "label": "残さない",
        "description": "変更が最も少なくて済みます。注意: 全利用者が取り消せる場合、誰の操作を誰が戻したのかが後から分かりません。"
      }
    ]
  },
  {
    "question": "(c) 同時処理の仕組み（decision-subsmerge-003）は、推奨の「操作ログで順次処理」で確定してよいですか？",
    "header": "同時処理",
    "multiSelect": false,
    "options": [
      {
        "label": "操作ログで順次処理 (Recommended)",
        "description": "既存の Workers と D1 だけで実現します。同時の 2 件目は 409 になり、画面が自動で再試行します。注意: 待たせて並べるのではありません。再試行の上限を超えたときだけ失敗を表示します。"
      },
      {
        "label": "DO（テナントに 1 つ）",
        "description": "同時の操作を拒否せず、待たせて順に処理します。注意: DO から D1 への書込み中は input gate が効かないため、待ち行列を自前で作る必要があります。構成要素が増え、lock-in は中〜高です。"
      },
      {
        "label": "画面側で 1 件ずつ送るだけ",
        "description": "変更は最小です。注意: 統合元が一覧に残る問題（G1）と、取り消し（G4）は解決しません。別の利用者やタブからの同時操作も防げません。"
      }
    ]
  },
  {
    "question": "(d) 操作の記録と、取り消し用データの保持期間はどうしますか？",
    "header": "保持期間",
    "multiSelect": false,
    "options": [
      {
        "label": "取消30日・記録400日 (Recommended)",
        "description": "既存の期間（削除の取り消しは 30 日、監査ログの見出しは 400 日）にそろえます。30 日を過ぎたら、変更前の内容を消して見出しだけ残します。注意: 夜間の予算は 49/49 で使い切っているため、期限切れの行は新しい操作の batch のついでに消します。"
      },
      {
        "label": "両方 400 日",
        "description": "400 日前の統合まで取り消せます。注意: 変更前の内容（name と aliases）を長く持ち続けます。時間が経つほど、戻したときに今の状態と食い違いやすくなります。"
      },
      {
        "label": "消さない",
        "description": "掃除の仕組みが要りません。注意: 表が際限なく増えます（D1 Free の保存容量は 5 GB）。ずっと昔の状態へ戻す操作まで許すことになります。"
      }
    ]
  }
]
~~~

> **訂正あり** — 直上の答は凍結された記録であり、後から次の訂正が入っている。
> 本文中の記述と食い違う場合は、訂正側が正である。
>
> - `2026-09-30T14:09:17Z` — 本 entry の答にある選択肢の説明『利用者を削除しても id は残るので、表示は「削除された利用者」にします』は、利用者を削除する経路があると読める書き方だった。実際には API と migrations に users の行を消す SQL は無く、利用者は status='suspended' で停止する (qa-subsmerge-maintenance-ops-web-evidence-002)。操作表に actor_user_id を外部キーなしで残すという選択の中身はこの前提に依らない。停止中の利用者も email で示し、「削除された利用者」の表示は、手作業の運用などで users に行が見つからない例外時だけに使う。同じ訂正は qa-subsmerge-presented-options-006 に 2026-09-30T13:35:08Z で付いている。利用者の回答そのもの (逐語) は正しく記録されている。

- (根拠の性質: コード・設定・公式文書で検証できる観測事実 / 出所: qa-subsmerge-presented-options-006 の答と同じ逐語 (sha256 2954aeb07dc594fb46a634a701bd6b17b690f7a3cab6dddc0d622936821c5f10、7217 文字) を、~~~text の囲みに入れて記録し直したもの。囲みの内側は qa-subsmerge-presented-options-006 の答と 1 文字も違わない。提示本文の Markdown 見出し (## 1.〜## 9.) が章の見出しと混ざらないようにするための記録の書式の差し替えで、提示した内容・利用者の回答・判断の中身は変わらない。answered_at は qa-subsmerge-presented-options-006 と同じく利用者の回答の記録時刻 (2026-09-30T13:05:44.372Z) で、提示はそれより前。 / 回答時刻: 2026-09-30T13:05:44Z)

## To-Be / Delta

> 本章の**目標の射影**。具体的な現行契約とACは spec-subscriptions-merge を正とする。上位概念 (要件定義書 U3 ゴール / U4 目標 / U9 具体的やりたいこと) を本章の serves_goals で絞り込んだ射影であり、設計知識 card (非規範の参考資料) とは役割が異なる。As-Is (現行実装の姿) は spec-state.json の管轄外のため本節では断定せず、到達点と、その到達を判定する観測点だけを規範として置く。

### 到達すべき状態 (To-Be)

- **G1**: 統合した取引名・ベンダーは統合先の1行にまとまり、統合元の行は一覧から消え、KPI・月次推移・年換算の比較・詳細パネル・他画面のサブスク集計が同じ名寄せ結果を示す。
- **G2**: 統合・登録・変更・見直し判断を連続・同時に行っても、操作が失われたり「サーバー側で処理に失敗しました」で止まったりせず、各操作の状態 (待機中・処理中・完了・失敗と再試行) を利用者が把握できる。
- **G3**: サブスク画面が添付画像 (デザイン 09-subscriptions) の構成と操作どおりになる (一覧の行チェックと全選択、選択バーからの複数件統合、詳細パネル 概要/取引履歴/関連データ、マッチした生の取引名、検出理由、年換算の比較、カバー率)。
- **G4**: 統合と操作の管理が安全である (ログインした利用者だけが、全利用者で共通の共有テナントのデータだけを変更できる、統合を取り消して統合前へ戻せる、古い画面からの上書きを防ぐ、操作の記録に実データを外部へ出さない)。

### 受入条件 (Delta の判定点)

| 目標 | 到達点 | 達成の観測点 (measure) |
|---|---|---|
| O1 | 統合後の再取得で、統合元の正規化名を持つ行が一覧に0件、統合先の推定月額を統合後の明細から再計算し、同一期間の各月の実支払額を保存し、他画面の subs:* 集計の名寄せ (どのサブスクに属するか) がサブスク画面と一致する。 | core の契約テストと api の統合テストで、統合元の行0件・各月の実支払額の保存・再推定の期待値・両経路の名寄せ一致を検査して緑 |
| O2 | 同じテナントへ統合を5件連続・2件同時に送っても (同じ利用者の別タブからと、別の利用者からの両方)、全操作が完了か明示的な 409 (再読込の案内) で終わり、500 が0件、最終の集計が最後に完了した操作の状態と一致する。 | api の統合テストで連続送信と同時送信を再現し、ステータスと集計を検査して緑 |
| O3 | 画像の要素 (行チェック、全選択、選択バー、統合先の選択、操作状態の表示、取り消し) の DOM テストが全件緑。 | web の subscriptions-screen DOM テストで要素と操作を検査して緑 |
| O4 | 他テナントのベンダー id への操作は 404、統合の取り消しで統合前と同じ一覧に戻る、古い revision からの更新は 409。 | api の統合テストで所有者・取り消し・revision 競合を検査して緑 |

### 本章がかなえる具体的やりたいこと (U9)

- **I1**: 登録済みの行でも統合先を選べるようにし、統合元の取引名と別名を統合先の別名へ移し、統合元の登録と見直し判断を統合先へ吸収する。
- **I2**: 一覧の行チェックと全選択で複数行を選び、選択バーから代表 (統合先) を決めて統合する。詳細パネルの取引名チェックとも同じ選択バーを使う。
- **I3**: 他画面のサブスク集計 (monthly_agg の subs:*) を、サブスク画面と同じ照合関数 (名前・別名・統合・対象科目) で導く。
- **I4**: サブスクの書込みを操作として D1 に記録し (冪等キー・期待 revision)、書込みと再集計を同じ原子単位で適用する。古い revision からの更新は 409 で止める。
- **I5**: 画面は連続操作を待ち行列に積んで1件ずつ送り、処理中・完了・失敗 (再試行) を操作状態として表示する。失敗の文言は原因と次の行動を示す。
- **I6**: 統合の取り消しで統合前の登録・別名・判断を復元し、操作履歴から直近の統合を辿れるようにする。
- **I7**: 画像との差分 (行チェック、全選択、選択バーの統合先選択、操作状態) を design tokens に沿って反映する。
- **I8**: 全ての書込み API で業務データの所有者 (user_id = 共有テナント id) を検査し、入力を検証し、操作記録には取引名など業務上必要な最小限だけを保存する。

### 本章に効く確定意思決定

- **decision-subsmerge-003**: 統合・登録・変更・見直し判断を連続・同時に行ったときの書込みを、どの仕組みで管理するか (「サーバー側で処理に失敗しました」で止まらないようにする)
  - 採択: 操作ログで順次処理 (既存の Workers + D1 だけ) (`d1-operation-log`)
  - 目的適合: G1: 書込みと再集計を 1 回の db.batch (transaction) にまとめ、統合元の行が一覧に残らない。G2: 冪等キーで重複送信を最初の結果に畳み、revision の照合で古い画面からの上書きと、別の利用者・別タブとの同時操作の 2 件目を 409 にして、500 を出さない。画面は連続操作を待ち行列に積んで順に送り、409 は自動で読み直して再試行する。G4: 操作の記録から取り消せる。

## 適用された設計知識

> 以下の deep knowledge card は設計判断を支援する**非規範の参考資料**であり、実装済み・検証済みの証拠ではない。カード内の `採否: applied` は設計採用を意味し、実装状態は意味しない。規範となる差分は本章の To-Be / Delta 節と参照先仕様で管理する。

### 本章での適用

Clean Code card の「名前で意図を示す」と「1 つのテストは 1 つの振る舞い」を、統合と並行制御のテストと定数に当てた。lease の TTL・再試行の回数と間隔・操作状態の表示件数・保持の 30 日と 400 日は CANONICAL_MUTATION_CLAIM_TTL_MS などの名前付き定数にし、テスト名は「登録済みの行を別の登録済み行へ統合すると統合元の行が一覧から消える」「別の利用者が統合を元に戻すと両方の操作者が記録に残る」のように利用者の言葉で書く。連続送信と同時送信は別のテストに分け、どちらが壊れたかを名前で分かるようにする (qa-subsmerge-retention-001・undo-scope-001)。

- (根拠の性質: アシスタントの推定 (利用者確認も検証可能な出典も経ていない) / 記録時刻: 2026-09-30T13:35:13Z)

### Clean Code — deep knowledge card

- 出典カード: `ref-system-design-knowledge/references/clean-code.md`

#### 目的

codeを、次の変更者が意図・制約・failureを短時間で理解し、安全に変更・検証できる作業媒体にする。

#### 解決する問題

- 名前と抽象度が意図を表さず、readerが実装詳細からbusiness ruleを逆算する。
- 一つの変更理由が複数moduleへ散り、副作用とerror pathを予測できない。
- 重複したruleが別々に更新され、仕様のSSOTが崩れる。
- testがimplementation detailへ結合し、refactoringを妨げる。

#### 適用条件

- 複数人・長期保守・高変更頻度・重要ruleがあり、理解と変更の費用が支配的。
- test/lint/review/observabilityで改善効果をfeedbackできる。
- domain languageとcoding conventionをteamで合意・更新できる。

#### 非適用条件

- throwaway explorationでは全規則を先行適用せず、学習後に残すcodeだけを整理する。
- generated/vendor codeへ手動styleを強制しない。generation inputとboundaryを管理する。
- 短い関数、class化、DRY等を絶対値として扱い、局所的な明瞭さを悪化させる場合は適用しない。

#### トレードオフ・失敗モード

- naming/refactoring/testへ時間を使うため、寿命とriskが低いcodeでは投資超過になり得る。
- micro-function化でcontrol flowが多数fileへ散り、かえって読みにくくなる。
- DRYを急ぎ、異なるdomain conceptを一つの抽象へ結合して変更を難しくする。
- commentを全否定して、理由、trade-off、外部制約、security decisionまで消す。
- coverageやlint scoreを目的化し、重要behaviorの未検証を隠す。

#### goalへの寄与

- goalに関わるbusiness ruleを名前とtestで明示し、仕様→code→evidenceのtraceを短くする。
- maintenance objectiveには変更lead time、review指摘、escaped defect、rollback率などのoutcomeを使う。
- 無料toolの導入自体を成功とせず、teamが継続運用でき、重要riskを減らすかで判断する。

## 最新ドキュメント出典

| 対象 | バージョン | 公式発行元 | 出典URL | 取得 | 最新確認 |
|---|---|---|---|---|---|
| vitest-expect | 5.0.3 | Vitest (VoidZero) (vitest.dev) | https://vitest.dev/api/expect | 2026-09-30T14:08:20Z | 2026-09-30T14:08:20Z |
