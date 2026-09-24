---
status: confirmed
category: backend
aggregate: 確定
spec_cells: [backend.web, backend.mobile, backend.tablet, backend.desktop-windows, backend.desktop-linux, backend.desktop-macos]
serves_goals: [G1, G2, G3, G4, G5, G6]
---

# バックエンド (backend)

- カテゴリ集約状態: **確定**
- 章確定マーカー: `status: confirmed`

## カテゴリ別収集状態

| プラットフォーム | 状態 | 根拠 |
|---|---|---|
| Web (web) | 確定 | 確定質疑: qa-imp-decision-005。裏付け質疑 (`qa_refs`): `qa-imp-backend-web-evidence-001`, `qa-imp-backend-web-005`, `qa-imp-decision-001`, `qa-imp-decision-002`, `qa-imp-decision-003`, `qa-imp-decision-004`, `qa-imp-decision-007`, `qa-imp-decision-008`, `qa-imp-decision-011` — 本章の「確定内容 (質疑録)」へ接地根拠として併記。資するゴール: G1, G2, G3, G4, G5, G6 |
| モバイル (mobile) | 対象外 | 理由: スマートフォン向け専用アプリを提供していたなら、backend では回線が切れやすい端末向けに検査要求の再開 (分割アップロード) の契約を決める必要があった。対象を web のみとする利用者決定 (qa-imp-target-platforms-001) によりその検討は発生しない。 |
| タブレット (tablet) | 対象外 | 理由: タブレット向け専用アプリを提供していたなら、backend では端末ごとの取込セッションの識別と、複数端末から同じ検査 ID を確定する競合の扱いを決める必要があった。対象を web のみとする利用者決定 (qa-imp-target-platforms-001) によりその検討は発生しない。 |
| デスクトップ (Windows) (desktop-windows) | 対象外 | 理由: Windows 向けデスクトップアプリを提供していたなら、backend ではローカルで前処理したパース結果を受け取る別経路の契約を決める必要があった。対象を web のみとする利用者決定 (qa-imp-target-platforms-001) によりその検討は発生しない。 |
| デスクトップ (Linux) (desktop-linux) | 対象外 | 理由: Linux 向けデスクトップアプリを提供していたなら、backend ではコマンドラインからの一括取込を受ける API トークンの契約を決める必要があった。対象を web のみとする利用者決定 (qa-imp-target-platforms-001) によりその検討は発生しない。 |
| デスクトップ (macOS) (desktop-macos) | 対象外 | 理由: macOS 向けデスクトップアプリを提供していたなら、backend ではフォルダ監視による自動取込を受ける冪等な受付口を決める必要があった。対象を web のみとする利用者決定 (qa-imp-target-platforms-001) によりその検討は発生しない。 |

## 上流指針 (doctrine anchors)

> 本章の設計判断が従う上流の正本 (1 concern 1 authority)。具体技術ではなく上流工程を導く規範であり、下位の技術選定は本節と矛盾してはならない。正本: `ref-system-design-knowledge/references/doctrine-anchor-registry.json`

| 設計 concern | 上流の正本 (authority) | 導く範囲 | 出典 | 最終確認 | 本章の確定セルへの反映 |
|---|---|---|---|---|---|
| application-architecture | Robert C. Martin — Clean Architecture | レイヤ境界・依存方向 (内向き)・ユースケース中心設計 | Clean Architecture (2017), the Dependency Rule | 2026-07-12 | 依存方向を core (状態・検証の段階・取込可否・要約・結果の導出と、上限値 IMPORT_LIMITS と超過の判定) ← api (検査と確定の imports route) ← web (データ取込画面) の一方向へ反映した。api は core の純関数の結果を契約に載せて返すだけで、web は判定を持たない。送信前の上限判定と 413 の判定はどちらも core の同じ定数と関数を import する。 |
| data-access | Robert C. Martin — Clean Architecture | 永続化を境界の外側へ追い出し interface adapter で隔離する | Clean Architecture — gateways/repositories boundary | 2026-07-12 | データアクセスを route 側に閉じ、core の純関数は D1 と R2 を知らないパース結果と記録だけを受け取る形へ反映した。確定は検査 ID から仮置きを読み、既存の書込の直列化 (import_writer_claims) の内側で行う。 |

## 確定内容 (質疑録)

> 本章の各確定セルが何を根拠に確定したかの実体。`qa_ref` が主たる接地根拠、`qa_refs` がそれを支える裏付け質疑であり、いずれも qa_log (spec-state.json) の逐語である。ここに現れない主張は本章の確定内容ではない。

### Web (web)

- 資するゴール: G1, G2, G3, G4, G5, G6

#### 主たる接地根拠: `qa-imp-decision-005`

**問**

検査要求 1 回が何ファイルを運び、検査 ID を何の単位で発行するか。

**答**

複数ファイルを 1 要求で送る。1 要求に検査 ID を 1 つ発行し、その中にファイルごとの項目 (ファイル項目 ID と検査結果) を持つ。確定は検査 ID と、そのうち取り込むファイル項目 ID を送り、ファイルは再送しない。1 回の取込 = 1 つの検査 ID = 取込履歴の 1 行とする。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: AskUserQuestion / 選択肢と推奨案提示あり。完成度評価 (FAIL) の指摘を受けて本サイクル中に利用者へ確認し、利用者が選択した。 / 回答時刻: 2026-09-21T15:41:14Z)

#### 裏付け質疑: `qa-imp-backend-web-evidence-001`

**問**

backend 章の裏付けとして、現行の取込 API と処理の流れについて何を観測したか。

**答**

packages/api/src/routes/imports.ts の POST /imports (1381 行) は 1 ファイルを受け、force・keepOnShrink・resolutionPlan を読む。流れはパース → unitFingerprint → preflightWriteSetConflicts → keepOnShrink → MF の解決 → クエリ予算 → R2 保存 → activeDuplicateOf → 月単位の洗い替え。取込元はヘッダーで判定し (import-pipeline.ts classifyRows)、文字コードは UTF-8 から Shift-JIS へ落とす (core/csv.ts decodeBuf)。GET /imports (1785 行)、GET /imports/:id/original (1870 行)、POST /imports/diff (import-diff.ts)、取り消しと破棄の preflight (deletions.ts)。取込は import_writer_claims で直列化され、同時実行は 409 import_busy。重複候補は core/total-cashflow.ts の duplicateMatchScore と reconcileBizDuplicates、サブスク候補は core/subs.ts の subsCandidates と GET /sub-vendors/candidates。packages/core に import-screen.ts は無い。

- (根拠の性質: コード・設定・公式文書で検証できる観測事実 / 出所: リポジトリの現物 (ファイルと行) を読んで記録した観測 / 回答時刻: 2026-09-21T15:21:42Z)

#### 裏付け質疑: `qa-imp-backend-web-005`

**問**

データ取込の検査・確定・履歴の規則と上限値をどこに置き、どの契約で返すか (上限値を core へ寄せた版)。

**答**

ファイルの状態、検証の段階、取込可否、内容確認の要約 (対象ファイル数・取込可能数・予定明細数・対象期間・影響する取込元・重複の可能性・サブスク候補)、取込 1 回の結果 (全ファイル成功=成功、1 件以上成功かつ 1 件以上失敗=一部成功、全失敗=失敗) を packages/core の import-screen.ts の純関数に置く。上限値 (1 ファイル 25MB・10 ファイル・合計 30MB・展開後 1 ファイル 60MB・エントリ数 1,000 件) も同じ import-screen.ts の定数 IMPORT_LIMITS に 1 か所だけ置き、ファイルの大きさと数 (追加では既存の項目を含む) から超過の理由を返す判定関数を core に置く。web の送信前の判定と api の 413 の判定 (hono/body-limit の maxSize を含む) はどちらもこの定数と関数を import し、数値を書き写さない。POST /imports/inspections は 1〜10 ファイルを 1 要求で受け、ファイル数と 1 ファイルの大きさを本文を読んだ直後・パースの前に確かめてから、1 ファイルずつ順にパース・検査して原本を R2 に 24 時間仮置きし、1 つの検査 ID とファイルごとの項目 (ファイル項目 ID・取込元・対象期間・サイズ・重複・バリデーション・明細数) を返す。POST /imports/inspections/:id/files は同じ検査 ID へファイルを足し (再試行と追加)、上限は検査 ID ごとの累計で合わせて 10 ファイル・合計 30MB まで (既にある項目のサイズを import_inspection_files から合計して判定する)。この要求は検査のレート制限に数える。DELETE /imports/inspections/:id/files/:fileId は確定前の項目を外す。POST /imports/runs は検査 ID・取り込むファイル項目 ID・前回データを残す・強制再取込を受けて確定し、ファイルを再送させない。確定は既存の書込の直列化 (import_writer_claims) の内側でファイルを順に書き、先に全ファイルのクエリ予算を合算して上限を超えるなら 1 件も書かずに 409 を返す。前回データを残す=オンは MF 明細は mfStableKey、freee 取引は freeeDealKeys で既にある行を飛ばして新しい行だけを足し、オフは従来の月単位の入れ替え。行単位の追加の対象は MF 明細と freee 取引だけで、MF 資産推移と JSON 復元は従来の動作のまま。『重複の可能性』は既存の duplicateMatchScore による二重計上候補の件数、『サブスク候補』は取込後の subsCandidates の新規件数。取込済みと同一内容 (content_hash が一致) のファイルは取込可能から外し、強制再取込のときだけ含める。GET /imports/runs は取込 1 回を 1 行で返し、GET /imports/runs/:id は影響の 3 数値 (新規追加・重複スキップ・サブスク候補) と含まれるファイルを返す。再取込・取り消し (30 日)・原本の取得は既存の経路を取込単位へ束ねる。一括削除は履歴の記録だけを消す。対象は freee と マネーフォワードの CSV で、銀行・カードは扱わない。 これは agent がまとめた内容で、利用者が選んだ値は主根拠の決定 qa にある。

- (根拠の性質: アシスタントの推定 (利用者確認も検証可能な出典も経ていない) / 出所: agent が、利用者承認 (appr-foundation-import-screen-001 と -002) と利用者決定 qa-imp-decision-001〜011 の範囲で、この章の確定内容をまとめ直したもの。利用者が本文を 1 つずつ見て選んだものではない。利用者が選んだ値はその決定 qa を主根拠 (qa_ref) として別に引く。再評価 3 回目の指摘 (送信前の上限判定が web と api に二重実装されうる) に対し、承認済みの G3/S3 (判定は core の 1 か所・重複実装 0 件) を上限値にも当てはめた。上限の数値そのものは decision-006 と -009 で利用者が選んだ値のままで、新しい具体値は足していない。 / 回答時刻: 2026-09-21T22:40:55Z)

#### 裏付け質疑: `qa-imp-decision-001`

**問**

画像の対応サービス案内 (マネーフォワード・銀行・freee) のうち、銀行・クレジットカードの明細を直接取り込む対象にするか。

**答**

対象にしない。銀行とクレジットカードの明細詳細は不要で、今回取り込むのは freee と マネーフォワードの CSV だけ。既存の ZIP・JSON 復元・MF 資産推移の受け付けは維持する。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: AskUserQuestion / 選択肢と推奨案提示あり / 回答時刻: 2026-09-21T15:16:46Z)

#### 裏付け質疑: `qa-imp-decision-002`

**問**

画像の詳細設定『前回データを残す』(既定で checked) をどう解釈するか。

**答**

行単位で追加する。既定はオン。オンのときは既存の行を消さず、同一性の鍵で既にある行を飛ばして新しい行だけを足す。オフのときは従来どおり月単位で入れ替える。強制再取込は維持する。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: AskUserQuestion / 選択肢と推奨案提示あり / 回答時刻: 2026-09-21T15:16:46Z)

#### 裏付け質疑: `qa-imp-decision-003`

**問**

画像の 3 段 (ファイル選択 / 内容確認 / 取込結果) を、1 ファイルずつ即時に書き込む現行の流れにどう対応させるか。

**答**

サーバに仮置きする。選んだファイルをまず検査用に送ってサーバ (R2) に一時保存し、検査結果 (重複・バリデーション・件数・対象期間) を返す。利用者が内容を確認して『取り込む』を押したら、検査 ID で確定し、ファイルは再送しない。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: AskUserQuestion / 選択肢と推奨案提示あり / 回答時刻: 2026-09-21T15:16:46Z)

#### 裏付け質疑: `qa-imp-decision-004`

**問**

画像の取込履歴 (取込元・ファイル数・取込明細数・結果、選択した履歴の一括削除) の 1 行の単位と、一括削除の意味をどうするか。

**答**

1 回の取込で 1 行にする。複数ファイルをまとめた取込を 1 行で見せ、詳細ペインに含まれるファイルと影響の数を出す。一括削除は履歴の記録だけを消し、取り込んだ明細は残す。明細ごと戻したいときは各行の『取り消し』を使う。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: AskUserQuestion / 選択肢と推奨案提示あり / 回答時刻: 2026-09-21T15:16:46Z)

#### 裏付け質疑: `qa-imp-decision-007`

**問**

Worker のメモリ上限 (128MB) に対し、複数ファイル 1 要求のまま上限をどう調整するか。

**答**

複数ファイル 1 要求のまま上限を下げる。1 回の取込の合計を 30MB、xlsx / ZIP の展開後を 1 ファイル 60MB にする。サーバは 1 ファイルずつ順に検査して R2 へ置き、同時に展開するのは 1 ファイルだけにする (ピーク約 90MB)。1 ファイル 25MB・10 ファイル・検査 30 回/分・確定 5 回/分は維持する。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: AskUserQuestion / 選択肢と推奨案提示あり。完成度評価 (FAIL) の指摘を受けて本サイクル中に利用者へ確認し、利用者が選択した。 / 回答時刻: 2026-09-21T15:41:14Z)

#### 裏付け質疑: `qa-imp-decision-008`

**問**

取込不可のファイルの再試行や後からのファイル追加を、同じ検査 ID に足す経路 (POST /imports/inspections/:id/files) で行うか。

**答**

残す。同じ検査 ID へファイルを足せるようにし、上限は検査 ID ごとの累計で数える (合わせて 10 ファイル・合計 30MB)。この追加の要求は検査のレート制限 (30 回/分) に数える。1 回の取込 = 1 つの検査 ID の形を保つ。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: AskUserQuestion / 再評価 (FAIL) の指摘を受けて本サイクル中に利用者へ確認し、利用者が選択した。提示した選択肢と推奨: (1) 残す・累計で上限 [推奨。理由: 再試行でも全ファイルを送り直さずに済み、1 回の取込 = 1 検査 ID を保てる] (2) やめる・全体を送り直す [経路は減るが、再試行のたびに全ファイルを再アップロードする]。利用者は (1) を選択。 / 回答時刻: 2026-09-21T22:27:38Z)

#### 裏付け質疑: `qa-imp-decision-011`

**問**

承認済みの O6 は『上限を超える body・ファイル数・合計サイズを本文を読む前に 413 で拒否する』とするが、multipart のファイル数は本文を読まないと分からない。どう扱うか。

**答**

O6 を直して再承認する。上限を超える body (合計サイズ) は本文を読む前に 413、ファイル数と 1 ファイルの大きさは本文を読んだ直後・パースの前に 413 とする。この回答を上位概念の再承認 (appr-foundation-import-screen-002) として記録する。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: AskUserQuestion / 再評価 (FAIL) の指摘を受けて本サイクル中に利用者へ確認し、利用者が選択した。提示した選択肢と推奨: (1) O6 を直して再承認 [推奨。理由: 目標の測り方を実現できる判定順に合わせる] (2) O6 は据え置き、security とテストの節に読み方を注記する [上位概念は変えない]。利用者は (1) を選択。 / 回答時刻: 2026-09-21T22:27:38Z)

## To-Be / Delta

> 本章の**規範**。上位概念 (要件定義書 U3 ゴール / U4 目標 / U9 具体的やりたいこと) を本章の serves_goals で絞り込んだ射影であり、設計知識 card (非規範の参考資料) とは役割が異なる。As-Is (現行実装の姿) は spec-state.json の管轄外のため本節では断定せず、到達点と、その到達を判定する観測点だけを規範として置く。

### 到達すべき状態 (To-Be)

- **G1**: /import を 16-import.png どおりの画面にする。問いの見出し『複数の明細ファイルを、安全に取り込みますか？』と説明文、共通の期間タブ、対象期間 (グローバル) のカード、3 段のステッパー (ファイル選択 / 内容確認 / 取込結果)、1.ファイルを選択 (ドラッグ&ドロップと選択ボタン、対応形式の説明、対応サービス (マネーフォワード・freee) の取得方法の案内、詳細設定の強制再取込と前回データを残す)、2.取込ファイル一覧の表、3.取込内容の確認の要約、4.取込結果の 4 枚のカード、5.取込履歴の表と履歴の詳細ペイン、下部の選択件数バーを、既存のデザイントークン・共通 Button・PageShell の上に組む。読込・空・失敗の各状態を持つ。
- **G2**: 確定の前に検査する 2 段階の取込にする。選んだファイルを一度だけアップロードしてサーバに期限付き (24 時間) で仮置きし、ファイルごとに取込元・対象期間・明細数・重複 (取込済みと同一の内容 / 重複の可能性)・検証 (問題なし / 警告あり / エラー) を返す。確定は検査 ID を指定するだけでファイルを再送せず、エラーのファイルは確定から自動で外す。未確定の仮置きは期限後に夜間保守で消す。
- **G3**: ファイルの状態・検証の段階・取り込めるか否か・要約の数え方・取込 1 回の結果 (成功 / 一部成功 / 失敗) を core の純関数 1 か所で導き、api と web はその結果を読むだけにする。
- **G4**: 『前回データを残す』を画像の意味 (同一期間の既存明細を残し、まだ無い行だけ追加する。同一の行は重複スキップとして数える) に改め、既定をオンにする。オフのときは従来どおり月単位で入れ替える。強制再取込は同じ内容のファイルでも再適用する。
- **G5**: 取込履歴を 1 回の取込ごとの 1 行にまとめ、詳細ペインで取込日時・取込元・対象期間・ファイル数・取込明細数・結果とこの取込による影響 (新規追加・重複スキップ・サブスク候補) を示し、原本のダウンロード・再取込・取り消し (30 日以内は元に戻せる) を決着できるようにする。一括削除は取り消し済み・失敗の履歴の記録を片づけるだけで明細は消さない。
- **G6**: 取込の入口を守る。検査・確定・原本取得の経路に body の大きさの上限 (読み込む前に判定)・ファイル数と合計サイズの上限・取込専用のレート制限・同一オリジンの検査を置き、ファイル名や明細の文字列は HTML として解釈せずに描画する。取り込んだデータは外部へ送らない。

### 受入条件 (Delta の判定点)

| 目標 | 到達点 | 達成の観測点 (measure) |
|---|---|---|
| O1 | データ取込画面が画像の全構成要素を描画する。 | DOM テストで、問いの見出し・期間タブ・対象期間カード・ステッパー 3 段・1.ファイルを選択 (ドロップ領域・選択ボタン・対応サービス 2 件・詳細設定 2 項目)・2.一覧の 9 列・3.要約の 6 項目と除外の注記・4.結果の 4 枚のカード・5.履歴の 7 列と詳細ペイン・下部の選択件数バーが描画され、読込・空・失敗の状態テストが緑である。 |
| O2 | 検査と確定が分かれ、確定時にファイルを再送しない。 | API テストで、検査が明細を 1 行も書かずに仮置きと検査結果だけを残すこと、確定が検査 ID だけで取り込むこと、期限切れ・他人の・確定済みの検査 ID が拒否されること、エラーのファイルが確定から外れることを確かめる。 |
| O3 | ファイルの状態と要約が記録から一意に決まる。 | core の単体テストで、ファイルの状態 (アップロード中 / チェック中 / 取込準備完了 / 取込不可 / 取込済み / 失敗) と検証の段階、要約の件数、取込 1 回の結果 (成功 / 一部成功 / 失敗) が入力の組合せから toBe で導かれ、境界ケースが固定される。 |
| O4 | 『前回データを残す』が行単位の追加として効く。 | API テストで、オンでは同一期間の既存明細が残りまだ無い行だけが追加され同一の行が重複スキップに数えられること、オフでは月単位で入れ替わること、強制再取込で同じ内容が再適用されることを確かめる。 |
| O5 | 取込履歴が 1 回ごとにまとまり、影響と操作が詳細で決着する。 | API と DOM のテストで、履歴が 1 回の取込ごとに 1 行となり、詳細の影響 3 数値 (新規追加・重複スキップ・サブスク候補) が確定時の記録と一致し、取り消しと元に戻す・原本の取得・一括削除 (明細は残る) が規則どおりに効くことを確かめる。 |
| O6 | 入口の上限と拒否が効く。 | API テストで、上限を超える body (合計サイズ) が本文を読む前に、ファイル数と 1 ファイルの大きさが本文を読んだ直後・パースの前に 413 で拒否され、別オリジンの変更要求が 403、短時間の連続要求が 429 になり、ファイル名に含めた HTML がテキストとして描画されることを確かめる。 |

### 本章がかなえる具体的やりたいこと (U9)

- **I1**: Import.tsx を pages/import/ 配下へ分割し、問いの見出し・期間タブ・対象期間カード・ステッパー・1〜5 の各節・履歴の詳細ペイン・下部の選択件数バーの構成に作り直す。選択中の履歴を URL に保つ。
- **I2**: 検査 API (複数ファイルを一度だけ受け取り R2 に仮置きし、ファイルごとの検査結果と検査 ID を返す) と確定 API (検査 ID と選んだファイルと詳細設定を受け取る) を足し、アップロードの進捗を画面に出す。夜間保守で期限切れの仮置きを消す。
- **I3**: core にファイルの状態・検証の段階・取り込めるか否か・要約・取込 1 回の結果を導く純関数を新設し、api の判定と web の表示をこれに寄せる。
- **I4**: 『前回データを残す』を行単位の追加にし、既存の行の同一性 (mfStableKey / freeeDealKeys) で重複スキップを数える。オフは従来の月単位の入れ替えとする。
- **I5**: 取込履歴を import_runs 単位にまとめ、確定時に影響の数値 (新規追加・重複スキップ・サブスク候補) を記録し、詳細ペインと原本のダウンロード・再取込・取り消し・記録だけの一括削除を置く。
- **I6**: 検査・確定・原本取得の経路に body の上限・ファイル数と合計サイズの上限・レート制限・同一オリジンの検査を足す。
- **I7**: 取込結果の 4 枚のカードから、重複の可能性は総収支の要確認へ、サブスク候補はサブスク画面へ、エラーのファイルは再試行へ進める導線を置く。

### 本章に効く確定意思決定

- (本章ゴールに効く確定 decision なし)

## 適用された設計知識

> 以下の deep knowledge card は設計判断を支援する**非規範の参考資料**であり、実装済み・検証済みの証拠ではない。カード内の `採否: applied` は設計採用を意味し、実装状態は意味しない。規範となる差分は本章の To-Be / Delta 節と参照先仕様で管理する。

### 本章での適用

Clean Architecture card の Dependency Rule を、取込の規則の置き場所に適用した。ファイルの状態・検証の段階・取込可否・内容確認の要約・取込 1 回の結果 (成功 / 一部成功 / 失敗) は packages/core の import-screen.ts の純関数に置き、D1 も R2 も知らない入力 (パース結果・検査の記録・既存の同一性の鍵) だけを受け取る。api は検査 (POST /imports/inspections) と確定 (POST /imports/runs) の 2 経路でこの純関数を呼ぶだけにし、web は返った値を描くだけにする。行単位の追加の判定も mfStableKey / freeeDealKeys という既存の core の鍵に寄せ、api 側に同一性の規則を新しく書かない。

- (根拠の性質: アシスタントの推定 (利用者確認も検証可能な出典も経ていない) / 記録時刻: 2026-09-21T15:24:56Z)

### Clean Architecture — deep knowledge card

- 出典カード: `ref-system-design-knowledge/references/clean-architecture.md`

#### 目的

変化しやすいUI、DB、framework、外部サービスから、長く保持したい業務ルールとuse caseを隔離し、技術交換やテストを目的達成の阻害要因にしない。

#### 解決する問題

- 業務ルールがcontroller/ORM/UI lifecycleへ埋まり、単体で検証できない。
- 外部技術変更が内側のuse caseまで波及し、置換費用を予測できない。
- 入出力形式やvendor型が境界を越え、責務と所有者が曖昧になる。

#### 適用条件

- business ruleが外部I/Oより長寿命で、UI/DB/providerの変更可能性がある。
- 複数delivery channelや外部integrationから同じuse caseを再利用する。
- 重要なpolicyを高速・決定論的にテストする価値が、境界導入費を上回る。

#### 非適用条件

- 寿命の短い検証用prototypeで、交換可能性より学習速度が明確に優先される。
- domain ruleがほぼ無い単純変換scriptで、port/adapterが実質的な抽象を生まない。
- 外部製品そのものがsystemの目的で、抽象化すると必要機能が失われる。ただしsecurity/audit boundaryは別途必要。

#### トレードオフ・失敗モード

- 境界、DTO、mapping、dependency injectionの量が増え、小規模systemでは認知負荷が先行する。
- 「4層を作ること」が目的化すると、変化軸のないinterfaceやpass-through use caseが増える。
- domain modelを万能化してdelivery固有の制約を隠すと、現実のlatency/transaction/error semanticsを見失う。
- portを外側が定義したりinner layerがORM型を返したりすると、名前だけcleanな依存逆転になる。

#### goalへの寄与

- `essential_purpose`に直結するpolicyを外部詳細から守り、goal達成ロジックの検証を速くする。
- 制約に「vendor lock-in低減」「複数platform」「高い変更頻度」がある場合、変更範囲と移行riskを局所化する。
- 適用判断は「何層あるか」でなく、守るgoal、予想される変更、boundary testで観測する。

---

### API Design Patterns — deep knowledge card

- 出典カード: `ref-system-design-knowledge/references/api-design-patterns.md`

#### 目的

consumerとproviderの独立変更を支える安定した契約を作り、再試行、失敗、並行更新、pagination、evolutionを予測可能にする。

#### 解決する問題

- resource/operationの意味、error、null、time、identifierがendpointごとに揺れる。
- timeout後の再試行で二重処理が起き、clientが成功/失敗を判断できない。
- collection増大や並行更新でoffset paginationと全件responseが破綻する。
- version/evolution方針がなく、provider変更がconsumerを突然壊す。

#### 適用条件

- 複数client/team/organizationが独立releaseで同じservice boundaryを利用する。
- network failureとretryが通常事象で、operation結果の重複や不明状態を制御する必要がある。
- contractの長期互換性とobservabilityが局所的な実装簡潔性より重要。

#### 非適用条件

- 同一process内のprivate callで、network boundaryや独立versioningが存在しない。
- hard real-time stream、双方向session、巨大event flowなど、request/response RESTが問題形状に合わない。
- 単純CRUD表面化がdomain invariantを迂回させる場合。use-case operationまたは別interaction modelを選ぶ。

#### トレードオフ・失敗モード

- version、idempotency ledger、schema governance、compatibility testに運用費がかかる。
- 「名詞URL」だけ守ってtransaction、authorization、error semanticsを設計しない表層RESTになる。
- offset paginationは簡単だが大規模/更新中datasetで遅延・重複・欠落を起こす。
- idempotency keyのscope/TTL/payload bindingが曖昧だと、別requestを誤って同一視する。
- breaking changeを新versionで逃がし続けると、複数version保守とsecurity patch負担が増える。

#### goalへの寄与

- mobile/web/desktop間で一貫したbusiness capabilityを共有し、platform別再実装を減らす。
- reliability goalにはretry-safe operationと明示的error、delivery goalにはcontract testとadditive evolutionを結ぶ。
- 選択はAPI様式の流行でなく、consumer、latency、consistency、offline、security、cost constraintsへの適合で評価する。

---

### Domain-Driven Design — deep knowledge card

- 出典カード: `ref-system-design-knowledge/references/ddd.md`

#### 目的

businessの重要なruleと用語をmodel/code/会話で一致させ、複雑性を適切な境界へ閉じ込め、継続的な学習をsoftwareへ反映する。

#### 解決する問題

- 仕様語、画面語、DB列、code名がずれ、変更時に意味を再解釈する。
- 異なる業務文脈の同名概念を一modelへ押し込み、巨大で矛盾したmodelになる。
- invariantとtransaction ownerが不明で、どこからでもdataを変更できる。
- legacy codeのtechnical構造がbusiness capabilityを隠し、改善順を決められない。

#### 適用条件

- rule、例外、用語、状態遷移が多く、domain expertとの継続的なmodel学習が価値を持つ。
- team/部門ごとに言葉やownershipが異なり、integrationで翻訳が必要。
- core domainの差別化がsystemの本質的目的に直結する。

#### 非適用条件

- 単純CRUD、汎用supporting機能、既製serviceで十分なgeneric subdomain。
- domain expertへアクセスできず、用語とruleを検証するfeedback loopを作れない段階。
- bounded contextをservice数へ機械変換する目的。monolith内moduleでも境界は成立する。

#### トレードオフ・失敗モード

- workshop、model、mapping、専門語彙の維持に継続的な時間が必要。
- aggregateを大きくしすぎてlock/latencyを増やす、細かくしすぎてinvariantをeventual consistencyへ漏らす。
- 「Repository/Entity」等のpattern名だけ採用したanemic modelになり、business ruleがserviceへ散る。
- bounded contextを組織図やDB tableから決め、実際の言語・capability境界を検証しない。
- eventを事実でなくcommandとして命名し、ordering/idempotency/failure recoveryを設計しない。

#### goalへの寄与

- U1-U9の語彙をmodelへ接続し、goalがどのcontext/capability/invariantで実現されるかを示す。
- core domainへ設計投資を集中し、generic領域は無料/低コストserviceや標準実装も比較対象にできる。
- refactoringは一括rewriteでなく、重要なbusiness rule周辺からstrangler/bubble context等で境界を育てる。

## 最新ドキュメント出典

| 対象 | バージョン | 公式発行元 | 出典URL | 取得 | 最新確認 |
|---|---|---|---|---|---|
| hono-zod-validator | 0.9.1 | Hono (honojs) (github.com) | https://github.com/honojs/middleware/blob/main/packages/zod-validator/CHANGELOG.md | 2026-09-21T15:22:57Z | 2026-09-21T15:22:57Z |
