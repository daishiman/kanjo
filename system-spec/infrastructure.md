---
status: confirmed
category: infrastructure
aggregate: 確定
spec_cells: [infrastructure.web, infrastructure.mobile, infrastructure.tablet, infrastructure.desktop-windows, infrastructure.desktop-linux, infrastructure.desktop-macos]
serves_goals: [G4]
---

# インフラ (infrastructure)

- カテゴリ集約状態: **確定**
- 章確定マーカー: `status: confirmed`

## カテゴリ別収集状態

| プラットフォーム | 状態 | 根拠 |
|---|---|---|
| Web (web) | 確定 | 確定質疑: qa-imp-infrastructure-web-001。裏付け質疑 (`qa_refs`): `qa-imp-infrastructure-web-evidence-001`, `qa-imp-decision-003`, `qa-imp-decision-008` — 本章の「確定内容 (質疑録)」へ接地根拠として併記。資するゴール: G4 |
| モバイル (mobile) | 対象外 | 理由: スマートフォン向け専用アプリを提供していたなら、infrastructure ではアプリの配布経路 (ストア・署名・自動更新) を決める必要があった。対象を web のみとする利用者決定 (qa-imp-decision-005) によりその検討は発生しない。 |
| タブレット (tablet) | 対象外 | 理由: タブレット向け専用アプリを提供していたなら、infrastructure ではアプリの配布経路 (ストア・署名・自動更新) を決める必要があった。対象を web のみとする利用者決定 (qa-imp-decision-005) によりその検討は発生しない。 |
| デスクトップ (Windows) (desktop-windows) | 対象外 | 理由: Windows 向けデスクトップアプリを提供していたなら、infrastructure ではアプリの配布経路 (ストア・署名・自動更新) を決める必要があった。対象を web のみとする利用者決定 (qa-imp-decision-005) によりその検討は発生しない。 |
| デスクトップ (Linux) (desktop-linux) | 対象外 | 理由: Linux 向けデスクトップアプリを提供していたなら、infrastructure ではアプリの配布経路 (ストア・署名・自動更新) を決める必要があった。対象を web のみとする利用者決定 (qa-imp-decision-005) によりその検討は発生しない。 |
| デスクトップ (macOS) (desktop-macos) | 対象外 | 理由: macOS 向けデスクトップアプリを提供していたなら、infrastructure ではアプリの配布経路 (ストア・署名・自動更新) を決める必要があった。対象を web のみとする利用者決定 (qa-imp-decision-005) によりその検討は発生しない。 |

## 上流指針 (doctrine anchors)

> 本章の設計判断が従う上流の正本 (1 concern 1 authority)。具体技術ではなく上流工程を導く規範であり、下位の技術選定は本節と矛盾してはならない。正本: `ref-system-design-knowledge/references/doctrine-anchor-registry.json`

| 設計 concern | 上流の正本 (authority) | 導く範囲 | 出典 | 最終確認 | 本章の確定セルへの反映 |
|---|---|---|---|---|---|
| reliability | Google SRE | SLO/エラーバジェット・冗長性・スケーリング・監視の上流指針 | https://sre.google/books/ | 2026-07-12 | 完全消去は他の夜間 job と Promise.allSettled で独立させ、失敗しても他の job とバックアップを止めない形へ反映した。R2 の削除に成功した行だけを D1 で消し、失敗した行は翌晩もう一度対象になる。1 晩に 500 件を超えた分は翌晩に続けて消す。 |
| operations | Google SRE | 運用手順・障害対応・トイル削減・ポストモーテムの上流指針 | https://sre.google/workbook/ | 2026-07-12 | 完全消去を、新しい cron を足さず既存の 0 18 * * * の improvement_retention に相乗りさせる形へ反映した。D1 クエリは improvement_retention を 3→4 本 (期限の検索・添付を消す UPDATE・削除中の行の DELETE・孤立画像の照合)、audit_header_retention を 3→2 本 (削除・削除後の件数と容量) にする。SCHEDULED_MAINTENANCE_D1_PLAN の合計 49 は変えない (qa-imp-decision-008)。 |

## 確定内容 (質疑録)

> 本章の各確定セルが何を根拠に確定したかの実体。`qa_ref` が主たる接地根拠、`qa_refs` がそれを支える裏付け質疑であり、いずれも qa_log (spec-state.json) の逐語である。ここに現れない主張は本章の確定内容ではない。

### Web (web)

- 資するゴール: G4

#### 主たる接地根拠: `qa-imp-infrastructure-web-001`

**問**

infrastructure の web の方針を次の内容で確定してよいか。

**答**

新しい Cron は足さず、夜間 0 18 * * * の improvement_retention に完全消去を相乗りさせる。予算は audit_header_retention の削除前の容量の読み取りを外して 3→2 本にし、improvement_retention を 3→4 本にする (合計 49 のまま)。R2 のキーの形は変えない。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: 8 カテゴリの web 方針を表で提示し、AskUserQuestion の選択肢『この8カテゴリで確定 (推奨) / 修正して再提示』から利用者が『この8カテゴリで確定』を選択。answered_at は回答受領直後に実測した時刻で、選択時刻の上界である。 / 回答時刻: 2026-09-23T13:16:38Z)

#### 裏付け質疑: `qa-imp-infrastructure-web-evidence-001`

**問**

infrastructure の web について、現行の実装と画像の差分は何か。

**答**

夜間の scheduledMaintenance (0 18 * * *) は 8 job を Promise.allSettled で並べ、scheduled-maintenance-budget.ts の SCHEDULED_MAINTENANCE_D1_PLAN が合計 49 本 (上限 50、SCHEDULED_D1_QUERY_PLAN_MAX 49) を宣言している。improvement_retention は 3 本で、完了から 30 日を過ぎた依頼の画像・診断・トークンを消し、本文と状態は残す。audit_header_retention は 3 本 (削除前の件数と容量・削除・削除後の件数と容量) である。画像は R2 (FILES) の improvements/<userId>/<requestId>.jpg に置かれる。

- (根拠の性質: コード・設定・公式文書で検証できる観測事実 / 出所: repo の現物 (該当ファイルと行) と design/FINAL-UI/images/20-improvement.png を読んで観測した事実。answered_at は記録直前に実測した時刻。 / 回答時刻: 2026-09-23T13:17:45Z)

#### 裏付け質疑: `qa-imp-decision-003`

**問**

詳細パネルの『削除』をどう扱うか (物理削除 / 論理削除)。

**答**

論理削除にし、完了トーストの『元に戻す』で同じ番号のまま戻す。削除から 30 日後に夜間処理で本文・画像・履歴を完全消去する。削除中の依頼は一覧・件数・agent 経路のどこからも読まない。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: AskUserQuestion / 選択肢と推奨案を提示し、利用者が『論理削除＋元に戻す (推奨)』を選択。answered_at は回答受領直後に実測した時刻で、選択時刻の上界である。 / 回答時刻: 2026-09-23T13:05:47Z)

#### 裏付け質疑: `qa-imp-decision-008`

**問**

夜間 scheduledMaintenance の D1 予算は 49/49 (Free の上限 50、1 本は必ず残す) で満杯。削除した依頼を 30 日後に行と履歴ごと消す DELETE を 1 本足すにはどうするか (DB トリガで既存 UPDATE に連動 / 他 job の枠を 1 本回す / 一覧を開いたときに消す)。

**答**

他 job の枠を 1 本回す。回す元は audit_header_retention とする。この job は削除の前後で件数と容量を 2 回読むが、読んだ値はログに書くだけで判定には使わない (容量上限を持つのは detail 層だけ)。そこで削除後の 1 回だけを読み、削除前の件数は削除後の件数と消した件数の和で出す。これで 3→2 本になり、improvement_retention を 3→4 本にする。合計は 49 のまま変えず、新しい Cron も足さない。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: AskUserQuestion / 選択肢 3 件 (DB トリガで連動 (推奨) / 他 job の枠を 1 本回す / 一覧を開いたときに消す) を提示し、利用者が『他 job の枠を 1 本回す』を選択。回す元の job (audit_header_retention の削除前の容量の読み取り) は、利用者の選択を受けて repo を調べ、判定に使っていない読み取りを特定したもの。answered_at は回答受領直後に実測した時刻で、選択時刻の上界である。 / 回答時刻: 2026-09-23T13:16:38Z)

## To-Be / Delta

> 本章の**規範**。上位概念 (要件定義書 U3 ゴール / U4 目標 / U9 具体的やりたいこと) を本章の serves_goals で絞り込んだ射影であり、設計知識 card (非規範の参考資料) とは役割が異なる。As-Is (現行実装の姿) は spec-state.json の管轄外のため本節では断定せず、到達点と、その到達を判定する観測点だけを規範として置く。

### 到達すべき状態 (To-Be)

- **G4**: 依頼と添付を安全に保つ。利用者ごとの分離、入力検証 (本文 1000 字・プライバシー確認 2 つ・画像の形式と大きさ)、削除は論理削除で『元に戻す』で戻し 30 日後に夜間処理で本文・画像・履歴を完全消去、使い捨てトークンの再発行、夜間バックアップへ添付を入れない不変条件を API と DB の両方で守る。

### 受入条件 (Delta の判定点)

| 目標 | 到達点 | 達成の観測点 (measure) |
|---|---|---|
| O4 | 削除・分離・保持期限・既存ゲートを守る。 | API テストで削除→元に戻すで同じ id と番号が戻ること、削除中の行が一覧と件数に 0 件、他の利用者の依頼が 404、30 日経過の完全消去で R2 の画像と履歴が消えること、BACKUP_SNAPSHOT_SQL に改善リクエストの表が無いことが通り、pnpm lint・typecheck・test・skills:test・初期 JS 予算・verify:full が全て exit 0。 |

### 本章がかなえる具体的やりたいこと (U9)

- **I4**: migration 0054 で状態の CHECK の張り替え (wontfix→done の移し替え)、利用者ごとの連番、論理削除の列、アクティビティの表を足し、削除・復元・状態変更・再発行で履歴を書く API と夜間の完全消去を実装する。
- **I6**: 入力検証 (本文 1000 字・プライバシー確認 2 つ・状態の候補・画像の形式と大きさ) を core と API の zod で揃え、他の利用者の依頼を 404 にする。

### 本章に効く確定意思決定

- **D-imp-008**: 夜間 scheduledMaintenance の D1 予算は 49/49 (Free の 1 invocation あたり 50 クエリ、1 本は必ず残す) で満杯。削除した改善リクエストを 30 日後に行と履歴ごと消す DELETE を 1 本足すにはどうするか。
  - 採択: 他 job の枠を 1 本回す (`borrow-slot`)
  - 目的適合: G4 の完全消去をアプリのコードとテストに明示したまま満たす。

## 適用された設計知識

> 以下の deep knowledge card は設計判断を支援する**非規範の参考資料**であり、実装済み・検証済みの証拠ではない。カード内の `採否: applied` は設計採用を意味し、実装状態は意味しない。規範となる差分は本章の To-Be / Delta 節と参照先仕様で管理する。

### 本章での適用

本章が引く design card は 0 件である (resource-map の read_when に infrastructure を名指す card が無い)。そのため、本章の設計判断は上流指針の Google SRE (reliability / operations) に接地させ、上流指針の節に記した。ここでは、その判断を card に帰属させないことだけを明記する。夜間の D1 予算 49/49 の配分は決定 D-imp-008 (他 job の枠を 1 本回す) による。

- (根拠の性質: アシスタントの推定 (利用者確認も検証可能な出典も経ていない) / 記録時刻: 2026-09-23T13:33:08Z)

- `ref-system-design-knowledge/references/resource-map.yaml` (本章へ引く card は 0 件。未着手ではなく、上の適用記述で0 件である理由を述べた上での確定である)

## 最新ドキュメント出典

| 対象 | バージョン | 公式発行元 | 出典URL | 取得 | 最新確認 |
|---|---|---|---|---|---|
| cloudflare-workers-cron-triggers | 2026-09-04 | Cloudflare (developers.cloudflare.com) | https://developers.cloudflare.com/workers/configuration/cron-triggers/ | 2026-09-23T13:21:22Z | 2026-09-23T13:21:22Z |
| cloudflare-d1-limits | 2026-04-21 | Cloudflare (developers.cloudflare.com) | https://developers.cloudflare.com/d1/platform/limits/ | 2026-09-23T13:21:40Z | 2026-09-23T13:21:40Z |
