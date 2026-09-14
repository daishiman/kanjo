---
status: confirmed
category: database
aggregate: 確定
spec_cells: [database.web, database.mobile, database.tablet, database.desktop-windows, database.desktop-linux, database.desktop-macos]
serves_goals: [G1]
---

# データベース (database)

- カテゴリ集約状態: **確定**
- 章確定マーカー: `status: confirmed`

## カテゴリ別収集状態

| プラットフォーム | 状態 | 根拠 |
|---|---|---|
| Web (web) | 確定 | 確定質疑: qa-database-web-ds-observed-001。資するゴール: G1 |
| モバイル (mobile) | 対象外 | 理由: スマートフォン向け専用アプリ (iOS/Android)を提供していたなら、本カテゴリでは端末内に表示設定 (テーマ・期間選択の保持) を保存するローカルストアを持つか、D1 と同期するかを決める必要があった。本サイクルでは D1 のスキーマ・マイグレーションに変更を加えない。対象を web のみとする利用者決定 (qa-target-platforms-ds-001 / appr-foundation-design-system-001、2026-09-13) によりその検討は発生しない。 |
| タブレット (tablet) | 対象外 | 理由: タブレット向け専用アプリを提供していたなら、本カテゴリでは端末内に表示設定 (テーマ・期間選択の保持) を保存するローカルストアを持つか、D1 と同期するかを決める必要があった。本サイクルでは D1 のスキーマ・マイグレーションに変更を加えない。対象を web のみとする利用者決定 (qa-target-platforms-ds-001 / appr-foundation-design-system-001、2026-09-13) によりその検討は発生しない。 |
| デスクトップ (Windows) (desktop-windows) | 対象外 | 理由: Windows 向けデスクトップアプリを提供していたなら、本カテゴリでは端末内に表示設定 (テーマ・期間選択の保持) を保存するローカルストアを持つか、D1 と同期するかを決める必要があった。本サイクルでは D1 のスキーマ・マイグレーションに変更を加えない。対象を web のみとする利用者決定 (qa-target-platforms-ds-001 / appr-foundation-design-system-001、2026-09-13) によりその検討は発生しない。 |
| デスクトップ (Linux) (desktop-linux) | 対象外 | 理由: Linux 向けデスクトップアプリを提供していたなら、本カテゴリでは端末内に表示設定 (テーマ・期間選択の保持) を保存するローカルストアを持つか、D1 と同期するかを決める必要があった。本サイクルでは D1 のスキーマ・マイグレーションに変更を加えない。対象を web のみとする利用者決定 (qa-target-platforms-ds-001 / appr-foundation-design-system-001、2026-09-13) によりその検討は発生しない。 |
| デスクトップ (macOS) (desktop-macos) | 対象外 | 理由: macOS 向けデスクトップアプリを提供していたなら、本カテゴリでは端末内に表示設定 (テーマ・期間選択の保持) を保存するローカルストアを持つか、D1 と同期するかを決める必要があった。本サイクルでは D1 のスキーマ・マイグレーションに変更を加えない。対象を web のみとする利用者決定 (qa-target-platforms-ds-001 / appr-foundation-design-system-001、2026-09-13) によりその検討は発生しない。 |

## 上流指針 (doctrine anchors)

> 本章の設計判断が従う上流の正本 (1 concern 1 authority)。具体技術ではなく上流工程を導く規範であり、下位の技術選定は本節と矛盾してはならない。正本: `ref-system-design-knowledge/references/doctrine-anchor-registry.json`

| 設計 concern | 上流の正本 (authority) | 導く範囲 | 出典 | 最終確認 | 本章の確定セルへの反映 |
|---|---|---|---|---|---|
| data-access | Robert C. Martin — Clean Architecture | 永続化を境界の外側へ追い出し interface adapter で隔離する | Clean Architecture — gateways/repositories boundary | 2026-07-12 | データアクセスの責務をドメイン状態の永続化に限る原則を、トークンを D1 に置かないという確定内容に反映した。 |
| reliability | Google SRE | SLO/エラーバジェット・冗長性・スケーリング・監視の上流指針 | https://sre.google/books/ | 2026-07-12 | Google SRE の変更リスク最小化を、スキーマ・マイグレーションを伴わないサイクルにする判断に反映した。見た目の変更で夜間バックアップ (D1→R2) と復元手順に影響を出さない。 |

## 確定内容 (質疑録)

> 本章の各確定セルが何を根拠に確定したかの実体。`qa_ref` が主たる接地根拠、`qa_refs` がそれを支える裏付け質疑であり、いずれも qa_log (spec-state.json) の逐語である。ここに現れない主張は本章の確定内容ではない。

### Web (web)

- 資するゴール: G1

#### 主たる接地根拠: `qa-database-web-ds-observed-001`

**問**

本サイクルで永続化の変更は発生するか。全体期間の選択など、表示に関わる保持はどこにあるか。

**答**

発生しない。トークンはビルド時の TypeScript 定数で、D1 (kanjo-db) のスキーマ・migrations・R2 (kanjo-files) には手を入れない。全体期間 (1年/2年/3年/任意) の全ページ保持は PR #45 で実装済みの既存の仕組みをそのまま使い、本サイクルでは見た目だけを共通部品へ寄せる。

- (根拠の性質: コード・設定・公式文書で検証できる観測事実 / 出所: packages/api/wrangler.jsonc の d1_databases / r2_buckets と migrations/、git log の PR #45 をアシスタントが確認した観測事実。 / 回答時刻: 2026-09-13T05:03:11Z)

## To-Be / Delta

> 本章の**規範**。上位概念 (要件定義書 U3 ゴール / U4 目標 / U9 具体的やりたいこと) を本章の serves_goals で絞り込んだ射影であり、設計知識 card (非規範の参考資料) とは役割が異なる。As-Is (現行実装の姿) は spec-state.json の管轄外のため本節では断定せず、到達点と、その到達を判定する観測点だけを規範として置く。

### 到達すべき状態 (To-Be)

- **G1**: 色・文字サイズ・行高・余白・角丸・影・動き・寸法 (シェル幅/高さ/タップ領域) のデザイントークンを、packages/core に置く依存ゼロの TypeScript 定義 1 か所へ集約し、CSS 変数とチャート色はそこから導出する。和文は OS の system-ui、金額・数値は自己配信する IBM Plex Mono Latin 400/600 だけを使い、全非 test source・dependencies・外部フォントURLの検査でこの配信契約を固定する。

### 受入条件 (Delta の判定点)

| 目標 | 到達点 | 達成の観測点 (measure) |
|---|---|---|
| O1 | packages/core/src/design-tokens.ts に色・文字・余白・角丸・影・動き・寸法のトークンを定義し、値の唯一の実装正本とする。 | 単体テストは schema・役割集合・alias・コントラストに必要な関係不変条件を値の転記なしで検査する。表示に影響する全トークン値は、版・承認参照・由来ファイルを持つ `docs/design-system/token-approval.json` の SHA-256 fingerprint と lint で照合し、未承認の値変更を拒否する。 |
| O2 | styles.css の :root トークンと charts.ts の COLORS を design-tokens.ts から導出した写しに置き換え、写しのずれを検出する lint を lint スクリプトへ組み込む。 | pnpm lint が写しの不一致で exit 非 0 になり、一致時に exit 0 になる。charts.ts から 6 桁 hex の直書きが 0 件になる。 |

### 本章がかなえる具体的やりたいこと (U9)

- **I1**: 新しい画面をつくるとき、色・余白・角丸・文字サイズを design-tokens から選ぶだけで FINAL-UI と同じ見た目になる。

### 本章に効く確定意思決定

- **dec-design-token-source**: デザイントークンの正本をどこに置くか
  - 採択: packages/core の design-tokens.ts を正本にし、CSS 変数とチャートの予備値を生成する (`core-ts`)
  - 目的適合: G1 の『依存ゼロの TypeScript 1 か所』に直接合う。テスト (O1・O4) が CSS を解析せず値を import でき、次サイクルでレポート側からも同じ値を import できる
- **dec-border-color-roles**: 境界色 #D7E0E2 (白に 1.34:1) を、WCAG 2.2 の 1.4.11 とどう両立させるか
  - 採択: 装飾罫線は #D7E0E2、部品を見分ける枠は 3:1 の派生色 (`split-roles`)
  - 目的適合: G5 の役割分離を境界へ広げ、画像の淡い罫線と部品の枠の 1.4.11 を両立する

## 適用された設計知識

> 以下の deep knowledge card は設計判断を支援する**非規範の参考資料**であり、実装済み・検証済みの証拠ではない。カード内の `採否: applied` は設計採用を意味し、実装状態は意味しない。規範となる差分は本章の To-Be / Delta 節と参照先仕様で管理する。

### 本章での適用

DDD card の『永続化するのはドメインの状態であって表示の都合ではない』を、本章で永続化の変更をしない判断に適用した。トークンはビルド時の定数で、利用者ごとに変わる状態ではないため D1 に置かない。全体期間の選択は既存の保持の仕組み (PR #45) が利用者の状態として既に扱っており、見た目の共通化はその保持場所を変える理由にならない。

- (根拠の性質: アシスタントの推定 (利用者確認も検証可能な出典も経ていない) / 記録時刻: 2026-09-13T05:07:52Z)

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

- (このカテゴリに割り当てた取得済みドキュメントなし。全体出典は index.md 参照)
