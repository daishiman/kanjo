---
status: confirmed
category: infrastructure
aggregate: 確定
spec_cells: [infrastructure.web, infrastructure.mobile, infrastructure.tablet, infrastructure.desktop-windows, infrastructure.desktop-linux, infrastructure.desktop-macos]
serves_goals: [G2, G4]
---

# インフラ (infrastructure)

- カテゴリ集約状態: **確定**
- 章確定マーカー: `status: confirmed`

## カテゴリ別収集状態

| プラットフォーム | 状態 | 根拠 |
|---|---|---|
| Web (web) | 確定 | 確定質疑: qa-household-infrastructure-web-001。裏付け質疑 (`qa_refs`): `qa-household-infrastructure-web-evidence-001` — 本章の「確定内容 (質疑録)」へ接地根拠として併記。資するゴール: G2, G4 |
| モバイル (mobile) | 対象外 | 理由: スマートフォン向け専用アプリを提供していたなら、インフラではアプリストアへの配布と、プッシュ通知で月次の家計の変化を知らせる基盤を持つかを決める必要があった。対象を web のみとする利用者決定 (qa-household-target-platforms-001) によりその検討は発生しない。 |
| タブレット (tablet) | 対象外 | 理由: タブレット向け専用アプリを提供していたなら、インフラではタブレット向けの別ビルドと配布経路を持つかを決める必要があった。対象を web のみとする利用者決定 (qa-household-target-platforms-001) によりその検討は発生しない。 |
| デスクトップ (Windows) (desktop-windows) | 対象外 | 理由: Windows 向けデスクトップアプリを提供していたなら、インフラでは Windows 向けインストーラのビルドと更新配信の基盤を決める必要があった。対象を web のみとする利用者決定 (qa-household-target-platforms-001) によりその検討は発生しない。 |
| デスクトップ (Linux) (desktop-linux) | 対象外 | 理由: Linux 向けデスクトップアプリを提供していたなら、インフラでは Linux 向けパッケージのビルドとリポジトリ配信を決める必要があった。対象を web のみとする利用者決定 (qa-household-target-platforms-001) によりその検討は発生しない。 |
| デスクトップ (macOS) (desktop-macos) | 対象外 | 理由: macOS 向けデスクトップアプリを提供していたなら、インフラでは macOS 向けのビルド・公証・更新配信の基盤を決める必要があった。対象を web のみとする利用者決定 (qa-household-target-platforms-001) によりその検討は発生しない。 |

## 上流指針 (doctrine anchors)

> 本章の設計判断が従う上流の正本 (1 concern 1 authority)。具体技術ではなく上流工程を導く規範であり、下位の技術選定は本節と矛盾してはならない。正本: `ref-system-design-knowledge/references/doctrine-anchor-registry.json`

| 設計 concern | 上流の正本 (authority) | 導く範囲 | 出典 | 最終確認 | 本章の確定セルへの反映 |
|---|---|---|---|---|---|
| reliability | Google SRE | SLO/エラーバジェット・冗長性・スケーリング・監視の上流指針 | https://sre.google/books/ | 2026-07-12 | 家計集計を要求ごとに導出しても Worker の CPU 時間に収まる範囲に反映した。入力は最大 3 年分の台帳で、集計は行数に比例する 1 回の走査と振替の対推定 (同額でまとめてから日付差で照合) で済むため、キャッシュ層やキューを足さない。migration の反映は既存の Migrate ワークフローのゲートを通す。 |
| operations | Google SRE | 運用手順・障害対応・トイル削減・ポストモーテムの上流指針 | https://sre.google/workbook/ | 2026-07-12 | 既存の CI と Deploy の手順をそのまま使う形へ反映した。ci.yml の lint・typecheck・test・初期 JS 予算の検査に家計画面も含め、migrate.yml で owner_labels を反映してから deploy.yml で Worker を出す順序を守る。新しい監視や通知は設けない。 |

## 確定内容 (質疑録)

> 本章の各確定セルが何を根拠に確定したかの実体。`qa_ref` が主たる接地根拠、`qa_refs` がそれを支える裏付け質疑であり、いずれも qa_log (spec-state.json) の逐語である。ここに現れない主張は本章の確定内容ではない。

### Web (web)

- 資するゴール: G2, G4

#### 主たる接地根拠: `qa-household-infrastructure-web-001`

**問**

家計収支画面のために配信・実行・DB 反映の基盤をどう変えるか。

**答**

基盤は変えない。既存の Cloudflare Workers (Hono) と D1、静的資産の配信をそのまま使い、家計画面は既存と同じく遅延読み込みのルートとして配信する。集計は要求のたびに core の純関数で導出し、新しいキャッシュ層・キュー・外部サービスを足さない (Workers の CPU 時間の範囲内。期間は最大 3 年分の台帳)。owner_labels の migration は既存の Migrate ワークフロー (.github/workflows/migrate.yml) と Deploy ワークフローの手順とゲートで反映し、行を書き換えない追加のみなので巻き戻しは表の不使用で足りる。初期 JS 予算は CI の実測値で守る。

> **訂正あり** — 直上の答は凍結された記録であり、後から次の訂正が入っている。
> 本文中の記述と食い違う場合は、訂正側が正である。
>
> - `2026-09-18T12:02:30Z` — answered_at に承認時刻 2026-09-18T11:25:37Z を写していた。この回答は利用者の承認と決定 001〜007 を agent が具体化した文で、実際に記録したのは R2 の chunk を適用した 2026-09-18T11:36:56Z である。
>   - 変更: `answered_at` `'2026-09-18T11:25:37Z'` → `'2026-09-18T11:36:56Z'` (フィールドは訂正後の値。旧値はこの行にのみ残る)
> - `2026-09-18T12:02:30Z` — answered_at の訂正を記録した。本文の値は利用者の決定 001〜007 と承認の範囲に収まり、agent が補った値は含まない。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: 利用者承認 (appr-foundation-household-cashflow-001) と利用者決定 qa-household-decision-001〜007 を、specs/spec-household-cashflow-screen.md へ具体化した回答 / 回答時刻: 2026-09-18T11:36:56Z)

#### 裏付け質疑: `qa-household-infrastructure-web-evidence-001`

**問**

infrastructure 章の裏付けとして、既存の配信と反映の仕組みについて何を観測したか。

**答**

.github/workflows には ci.yml・deploy.yml・migrate.yml がある。ルートの package.json は build (web の build と wrangler deploy --dry-run)、deploy (build:artifact と api の deploy)、db:migrate:local / db:migrate:remote (wrangler d1 migrations apply kanjo-db) を持つ。api は packages/api/wrangler.jsonc の Worker で、D1 を DB binding として使う。直近の #58 で初期 JS 予算の CI 実測値を記録している。

- (根拠の性質: コード・設定・公式文書で検証できる観測事実 / 出所: リポジトリの現物 (ファイルと行) を読んで記録した観測 / 回答時刻: 2026-09-18T11:33:59Z)

## To-Be / Delta

> 本章の**規範**。上位概念 (要件定義書 U3 ゴール / U4 目標 / U9 具体的やりたいこと) を本章の serves_goals で絞り込んだ射影であり、設計知識 card (非規範の参考資料) とは役割が異なる。As-Is (現行実装の姿) は spec-state.json の管轄外のため本節では断定せず、到達点と、その到達を判定する観測点だけを規範として置く。

### 到達すべき状態 (To-Be)

- **G2**: 家計の集計を core の純関数 1 か所に集め、総収支の台帳 (totalCashflowLedger) を正本にする。総収入・総支出・純収支と月平均・年換算、事業と個人の分解 (和が家計全体に一致)、前年同期間との比較 (前年に欠けた月があれば比較不能として null)、月別の収入・支出・純収支と前年系列、生活費カテゴリ 6 区分の集計と構成比・前年差、名義別の収入と前年差を同じ関数から算出し、GET /api/household をこの形へ拡張する。総収支画面の『総合』と家計画面の『家計全体』が同じ期間で同じ数字になることをテストで固定する。
- **G4**: 名義を『本人 / パートナー / 子ども / その他』で扱えるようにする。内部値 (business / spouse / family と未設定) は変えず、名義ラベル表を追加する追加のみの migration と、表示名の取得・更新 API を設ける。初期表示名は business→本人、spouse→パートナー、family→子ども、未設定→その他。『名義ラベルを編集』から表示名だけを変更でき、家計画面・設定画面・明細画面の名義表示がすべてこの表示名を参照する。更新 API は既存の authGuard・パスワード変更フェンス・スキーマガード・変更系フェンスの内側に置き、入力は zod で長さと文字種を検証する。

### 受入条件 (Delta の判定点)

| 目標 | 到達点 | 達成の観測点 (measure) |
|---|---|---|
| O2 | 家計の数字が総収支画面と一致し、等式が閉じる。 | core の単体テストで、同じ Dataset と期間に対し家計全体の総収入・総支出・純収支が totalCashflowLedger の総合と toBe で一致し、事業 + 個人 = 家計全体が全月で成り立ち、前年欠損月があるとき前年差が null になる。 |
| O4 | 名義ラベルの編集が安全に保存され全画面に反映される。 | API 統合テストで、未認証 401・変更系フェンス違反の拒否・長さ超過と制御文字の 400・正常更新の 200 と再取得での反映を確認し、migration が既存行を 1 行も書き換えないことを検査する。 |

### 本章がかなえる具体的やりたいこと (U9)

- **I3**: core に household-summary (仮称) を新設し、totalCashflowLedger の行集合から家計全体・事業・個人の総額と月別系列、前年比較、生活費 6 区分、名義別収入を 1 か所で算出する。旧 household() の独自定義は置き換える。
- **I4**: 生活費 6 区分 (住居費 / 食費 / 光熱費 / 教育費 / 交通費 / その他) と MF 大項目の対応表を core に 1 か所だけ置き、docs に同じ表を載せる。
- **I6**: owner_labels 表と GET / PUT の表示名 API、名義ラベル編集ダイアログを作り、家計・設定・明細の名義表示を表示名の取得関数 1 つへ寄せる。

### 本章に効く確定意思決定

- **dec-household-figure-source**: 画像の数値が算術で閉じない欄をどう扱うか。収入・支出を正本に差を計算するか、画像の純収支を正本にして前年の総支出を調整するか。
  - 採択: 収入・支出を正本に差を計算する (−¥80,000) (`opt-compute-from-income-expense`)
  - 目的適合: G2 の『数字は台帳の行から作る』と一致し、どの欄も算術で閉じる。見た目の数値は一部画像と変わる。
- **dec-household-ledger-source**: 家計収支の数字を何から作るか。総収支画面の台帳を正本にするか、現行の household() を拡張するか。
  - 採択: 総収支の台帳を正本にする (`opt-ledger-source`)
  - 目的適合: G2 の『家計の集計を 1 か所に集め、総収支と同じ行から作る』に直接答える。総収支の総合と家計全体が同じ行集合から出るため、両画面の数字が一致する。
- **dec-household-owner-model**: 名義を『本人 / パートナー / 子ども / その他』で扱うとき、内部値を移行するか、内部値を残して表示名だけを編集可能にするか。
  - 採択: 内部値は残し表示名を編集可能にする (`opt-owner-display-label`)
  - 目的適合: G4 の表示名の要件を満たし、既存の business / spouse / family / unset を使う規則・明細を壊さない。

## 適用された設計知識

> 以下の deep knowledge card は設計判断を支援する**非規範の参考資料**であり、実装済み・検証済みの証拠ではない。カード内の `採否: applied` は設計採用を意味し、実装状態は意味しない。規範となる差分は本章の To-Be / Delta 節と参照先仕様で管理する。

### 本章での適用

本章へ引く card は 0 件である。配信構成 (Worker・Workers Assets・D1) と binding を変えず、新設するのは同一 Worker 内の 3 経路 (家計の区分詳細・名義ラベルの取得と更新) と追加のみの owner_labels 表だけであるため、infrastructure 固有の設計判断が生じない。migration は既存の Migrate ワークフローで反映し、Deploy の前に表の存在を runtimeSchemaGuard で確かめる。

- (根拠の性質: アシスタントの推定 (利用者確認も検証可能な出典も経ていない) / 記録時刻: 2026-09-18T11:37:52Z)

- `ref-system-design-knowledge/references/resource-map.yaml` (本章へ引く card は 0 件。未着手ではなく、上の適用記述で0 件である理由を述べた上での確定である)

## 最新ドキュメント出典

| 対象 | バージョン | 公式発行元 | 出典URL | 取得 | 最新確認 |
|---|---|---|---|---|---|
| cloudflare-workers-limits | 2026-09-05 | Cloudflare (developers.cloudflare.com) | https://developers.cloudflare.com/workers/platform/limits/ | 2026-09-18T11:39:30Z | 2026-09-18T11:39:30Z |
