---
status: confirmed
category: database
aggregate: 確定
spec_cells: [database.web, database.mobile, database.tablet, database.desktop-windows, database.desktop-linux, database.desktop-macos]
serves_goals: [G4]
---

# データベース (database)

- カテゴリ集約状態: **確定**
- 章確定マーカー: `status: confirmed`

## カテゴリ別収集状態

| プラットフォーム | 状態 | 根拠 |
|---|---|---|
| Web (web) | 確定 | 確定質疑: qa-diagnosis-database-web-001。資するゴール: G4 |
| モバイル (mobile) | 対象外 | 理由: スマートフォン向け専用アプリ (iOS / Android)を提供していたなら、診断画面の本カテゴリでは端末内に明細と診断結果の写しを置き、対応状況の変更をオフラインで保持して後から同期する保存方式を決める必要があった。本サイクルの対象は既存 Web アプリ (packages/web、ブラウザ配信) の /analysis/diagnosis 画面だけであり、専用アプリは作らない。対象 platform を web のみとする利用者承認 (appr-foundation-diagnosis-001、qa-target-platforms-diagnosis-001) により、この検討は発生しない。 |
| タブレット (tablet) | 対象外 | 理由: タブレット向け専用アプリ (iPadOS / Android)を提供していたなら、診断画面の本カテゴリでは端末内に明細と診断結果の写しを置き、対応状況の変更をオフラインで保持して後から同期する保存方式を決める必要があった。本サイクルの対象は既存 Web アプリ (packages/web、ブラウザ配信) の /analysis/diagnosis 画面だけであり、専用アプリは作らない。対象 platform を web のみとする利用者承認 (appr-foundation-diagnosis-001、qa-target-platforms-diagnosis-001) により、この検討は発生しない。 |
| デスクトップ (Windows) (desktop-windows) | 対象外 | 理由: Windows デスクトップアプリを提供していたなら、診断画面の本カテゴリでは端末内に明細と診断結果の写しを置き、対応状況の変更をオフラインで保持して後から同期する保存方式を決める必要があった。本サイクルの対象は既存 Web アプリ (packages/web、ブラウザ配信) の /analysis/diagnosis 画面だけであり、専用アプリは作らない。対象 platform を web のみとする利用者承認 (appr-foundation-diagnosis-001、qa-target-platforms-diagnosis-001) により、この検討は発生しない。 |
| デスクトップ (Linux) (desktop-linux) | 対象外 | 理由: Linux デスクトップアプリを提供していたなら、診断画面の本カテゴリでは端末内に明細と診断結果の写しを置き、対応状況の変更をオフラインで保持して後から同期する保存方式を決める必要があった。本サイクルの対象は既存 Web アプリ (packages/web、ブラウザ配信) の /analysis/diagnosis 画面だけであり、専用アプリは作らない。対象 platform を web のみとする利用者承認 (appr-foundation-diagnosis-001、qa-target-platforms-diagnosis-001) により、この検討は発生しない。 |
| デスクトップ (macOS) (desktop-macos) | 対象外 | 理由: macOS デスクトップアプリを提供していたなら、診断画面の本カテゴリでは端末内に明細と診断結果の写しを置き、対応状況の変更をオフラインで保持して後から同期する保存方式を決める必要があった。本サイクルの対象は既存 Web アプリ (packages/web、ブラウザ配信) の /analysis/diagnosis 画面だけであり、専用アプリは作らない。対象 platform を web のみとする利用者承認 (appr-foundation-diagnosis-001、qa-target-platforms-diagnosis-001) により、この検討は発生しない。 |

## 対象外の承認範囲

> 本章の対象外セルが引用している承認の実体。状態表の「承認: <id>」だけでは、その承認が何をどこまで認めたものかを章から辿れない。

### 承認: `appr-foundation-diagnosis-001`

2026-09-17T21:57:21Z (回答直後の date -u 実測、選択時刻の上限値) 利用者が AskUserQuestion で診断画面サイクルの foundation (U1・G1-G6・対象外・制約) を『この内容で承認』と回答した。先行する利用者決定 (同日 2026-09-17T21:51:23Z より前の同一セッション): 健全性スコア=固定費比率30%・貯蓄率30%・収支の安定性25%・データカバー率15%の重みで 0-100 へ合成する規則ベースの指標とし内訳を開閉表示する、改善アクションの対応状況=D1 の新表 (照合の reconciliation_actions と同じ型) へ保存して期間切替と再取込をまたいで引き継ぐ。指標切替 (支出/収入/純収支) と旧統計表の開閉保持も承認に含まれる。

#### この承認を名指ししている質疑: `qa-target-platforms-diagnosis-001`

**問**

診断画面 (08-diagnosis) の作り直しは、どの platform を対象にしますか。web / mobile / tablet / desktop-windows / desktop-linux / desktop-macos の6 種それぞれについて、対象に含めるか外すかを決めてください。

**答**

対象は web のみとする。mobile / tablet / desktop-windows / desktop-linux / desktop-macos の 5 種は本サイクルの対象外とする。

理由: 本プロダクト kanjo は Cloudflare Workers 上の API (packages/api) と、ブラウザへ配信する SPA (packages/web、React 18 + react-router-dom 7) の 2 つだけで構成されており、専用アプリの成果物・配布経路・ビルド設定はリポジトリに存在しない。直前の総収支画面 (PR #55)・照合画面 (PR #54)・推移画面 (PR #56) の各サイクルも同じ理由で web のみを対象としており、本サイクルで方針を変える理由がない。上位概念の対象外 (scope.out) にも『web 以外の platform』を明記して利用者承認済み (appr-foundation-diagnosis-001)。

なお web はレスポンシブで提供するため、スマートフォンのブラウザからも閲覧できる。ここで対象外にしたのは『専用アプリという成果物』であって『小さい画面』ではない。小さい画面での表示は ui-ux / frontend の web セルで扱う。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: 利用者承認 (上位概念 scope.out) + リポジトリ構成の観測 (packages/ 配下は api / core / web のみ) / 回答時刻: 2026-09-17T22:01:23Z)

## 上流指針 (doctrine anchors)

> 本章の設計判断が従う上流の正本 (1 concern 1 authority)。具体技術ではなく上流工程を導く規範であり、下位の技術選定は本節と矛盾してはならない。正本: `ref-system-design-knowledge/references/doctrine-anchor-registry.json`

| 設計 concern | 上流の正本 (authority) | 導く範囲 | 出典 | 最終確認 | 本章の確定セルへの反映 |
|---|---|---|---|---|---|
| data-access | Robert C. Martin — Clean Architecture | 永続化を境界の外側へ追い出し interface adapter で隔離する | Clean Architecture — gateways/repositories boundary | 2026-07-12 | `(user_id, action_key)` を主キーに置き、利用者ごと・課題ごとに 1 行だけが対応する形にした。status は D1 (SQLite) の CHECK 制約で 4 語に限定する。判断は行の削除ではなく状態で表し、見送りも記録として残す。 |
| reliability | Google SRE | SLO/エラーバジェット・冗長性・スケーリング・監視の上流指針 | https://sre.google/books/ | 2026-07-12 | 本サイクルの migration は新表の作成のみとし、既存表の行書き換えを含めない。番号は origin/main を取り直して既存最大 + 1 を確認してから付ける (他ブランチとの衝突は git の差分に出ないため)。表が残っていても既存機能に影響しない構造なので、問題時は画面と API の変更を戻すだけで復旧できる。 |

> **未記入** の行は、上流の正本を掲げただけで本章の確定内容へ反映した箇所を示せていない。表への出現は反映の証拠ではない。

## 確定内容 (質疑録)

> 本章の各確定セルが何を根拠に確定したかの実体。`qa_ref` が主たる接地根拠、`qa_refs` がそれを支える裏付け質疑であり、いずれも qa_log (spec-state.json) の逐語である。ここに現れない主張は本章の確定内容ではない。

### Web (web)

- 資するゴール: G4

#### 主たる接地根拠: `qa-diagnosis-database-web-001`

**問**

改善アクションの対応状況はどこにどう保存しますか。表の形・状態の語彙・既存表との関係・migration の扱いを決めてください。

**答**

Cloudflare D1 に新表 `diagnosis_action_states` を作って保存する (画面ローカルや localStorage には置かない。判断の履歴が端末に閉じると『いまどこまで対応したか』を引き継げないため)。

**列**: user_id TEXT NOT NULL / action_key TEXT NOT NULL (検知器 id + 対象キーで決まる安定キー) / status TEXT NOT NULL (未着手 / 対応中 / 対応済み / 見送り) / note TEXT / decided_at TEXT (状態を最後に決めた時刻、RFC3339) / created_at TEXT NOT NULL / updated_at TEXT NOT NULL。PRIMARY KEY は `(user_id, action_key)`、status は CHECK 制約で 4 語に限定する。API は user_id を入力として受け取らず、認証済みセッションから得て全 SELECT / UPSERT に束縛する。

**設計の型**: 既存の照合画面が持つ reconciliation_actions と同じ型にそろえる (キー 1 件につき 1 行・状態 + メモ + 決定時刻・行を消さない)。見送りも『判断した』という記録なので削除せず状態として残す。

**検知結果は保存しない**: 改善余地そのもの (金額・根拠) は毎回データから計算する導出値であり、保存しない。保存するのは利用者の判断だけとする。これにより、明細が更新されて金額が変わっても判断が残り、逆に古い金額が正本として残り続けることもない。

**検知器が消えた行の扱い**: 明細が変わって検知されなくなった action_key の行は削除せず残し、画面には出さない (再び検知されたら以前の判断が復帰する)。

**migration**: repository 直下の `migrations/` に、既存最大番号 + 1 の連番で新規ファイルを 1 つ足す。既存表の行書き換えは行わず、新表の作成のみとする。適用は manifest → Migrate APPLY → Deploy の順で、既存の本番反映手順に従う。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: 利用者決定 (D1 へ保存する・状態 4 語・reconciliation_actions と同型) + 既存 migration 運用の観測 + G4 / 回答時刻: 2026-09-17T22:01:23Z)

## To-Be / Delta

> 本章の**規範**。上位概念 (要件定義書 U3 ゴール / U4 目標 / U9 具体的やりたいこと) を本章の serves_goals で絞り込んだ射影であり、設計知識 card (非規範の参考資料) とは役割が異なる。As-Is (現行実装の姿) は spec-state.json の管轄外のため本節では断定せず、到達点と、その到達を判定する観測点だけを規範として置く。

### 到達すべき状態 (To-Be)

- **G4**: 改善アクションの対応状況を D1 に保存して引き継ぐ。`(user_id, action_key)` を主キーにし、API がセッションの user_id で全読み書きを絞る。利用者が選んだ状態 (未着手・対応中・対応済み・見送り) と任意のメモ・決定時刻を保存する。期間の切替・再取込・再ログインをまたいで同じ判断が復元され、対応済みと見送りは既定では一覧から畳まれて改善余地の合計にも入らない。検知結果が消えた action_key の記録は消さず、再発時に前回の判断を復元する。

### 受入条件 (Delta の判定点)

| 目標 | 到達点 | 達成の観測点 (measure) |
|---|---|---|
| O4 | 対応状況が期間と再取込をまたいで引き継がれる。 | 対応中に変更 → 期間切替 → 再取込 → 再取得の順で API を叩く統合テストで、同じ action_key の状態・メモ・決定時刻が保持され、対応済みと見送りが既定の一覧から畳まれ改善余地の合計から除かれ、畳んだ件数と金額が注記に現れることを確認する。 |

### 本章がかなえる具体的やりたいこと (U9)

- **I6**: 改善アクションの優先順位の表を、# ・優先度 (高/中/低)・課題・年間改善インパクト・対応の手間 (高/中/低)・ステータス (未着手/対応中/対応済み/見送り、要確認は判断待ちの検知)・次のアクション の列で出し、行を選ぶと詳細パネルと選択バーが連動する。
- **I12**: 改善アクションのステータスを画面から変更でき、変更は D1 の新表へ保存される。対応済みと見送りは既定で畳まれ、注記から再表示できる。

### 本章に効く確定意思決定

- (本章ゴールに効く確定 decision なし)

## 適用された設計知識

> 以下の deep knowledge card は設計判断を支援する**非規範の参考資料**であり、実装済み・検証済みの証拠ではない。カード内の `採否: applied` は設計採用を意味し、実装状態は意味しない。規範となる差分は本章の To-Be / Delta 節と参照先仕様で管理する。

### 本章での適用

データ設計の『導出値を保存しない・判断は保存する』を、diagnosis_action_states の列の取捨に当てた。改善余地の金額・根拠・順位は毎回データから計算し直せる導出値なので保存しない。保存するのは利用者が決めたこと (状態 4 語・メモ・決定時刻) だけとする。この切り分けにより、明細が更新されて金額が動いても判断が残り、逆に古い金額が正本として居座ることもない。検知されなくなった action_key の行を消さずに残すのも同じ考えで、行の存在は『判断があった』という事実であって『いま課題がある』ことではない。

- (根拠の性質: アシスタントの推定 (利用者確認も検証可能な出典も経ていない) / 記録時刻: 2026-09-17T23:25:04Z)

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
| cloudflare-d1-sql-statements | 2026-04-21 | Cloudflare (developers.cloudflare.com) | https://developers.cloudflare.com/d1/sql-api/sql-statements/ | 2026-09-17T22:05:46Z | 2026-09-17T22:05:46Z |
