# 収支統合管理システム 要件定義書 兼 基本仕様書

- 版数: v1.1(根本目的・設計原則を反映)
- 作成日: 2026-08-24
- 対象: 収支管理ダッシュボード(HTML版)のWebシステム化
- 前提: HTML版の画面・計算ロジック・仕分けルールを正(リファレンス実装)とする

---

## 1. 背景と目的

### 1.1 背景

本システムの出発点は、UBM・北原氏から学んだ経営の原理原則——「収入と支出の管理は経営の当たり前の基本であり、まず守り(ディフェンス)を固める」——である。新しいものを構築する前に、いま発生している無駄を可視化し管理すること。これが根本目的であり、本システムはその実践のための仕組み化である。

これまで支出管理はExcelへの手集計で行ってきたが、「毎日整理する→面倒で週1回になる→それもできず月1回にまとめる→今月はもういいや、と放棄する」という挫折を繰り返してきた。少しでも手間があると続かない。したがって本システムの最重要要件は機能の多さではなく、**運用の手間を極限まで下げて継続できること**である。

また、収支の混在という構造問題がある。事業(個人事業・freeeで管理)と家計(マネーフォワードで管理)の収支が、口座・カードの共有により混在している。具体的には次の3つの構造問題があり、毎月の実態把握と改善判断ができない状態だった。

1. 事業売上が個人口座(JA)に入金され、家計側の収入に混入する
2. 事業経費が個人カード(楽天・三井住友)から支払われ、家計側の支出に混入する
3. カード引落が明細不明の1行で計上され、支出の6割超が「説明できない支出」になっている

HTML版ダッシュボードで、(1)重複排除した三面比較(個人/事業/合算)、(2)科目×月の増減マトリクス、(3)統計指標による自動診断、(4)明細単位の公私仕分け、(5)予算管理、(6)CSV/Excel取込、を実装済み。ただしHTML版はブラウザメモリ上で完結するため、保存がJSON手動書き出しに依存し、複数端末・継続運用に耐えない。

### 1.2 目的

本システムは、上記HTML版の機能を **永続化・自動化された月次運用システム** に発展させ、以下を実現する。

- 毎月のCSV/Excel投入だけで、公私分離済みの収支が自動で蓄積・比較される
- 「どの費用が増えているか / 削減できるか / 使うべきか」が統計指標と信号表示で判断できる
- **毎月これだけかかっている=これ以上稼がないといけない、という基準額(防衛ライン)が常に見える**
- **新しい支出をしたいとき(例: 1万円の買い物・月額サブスクの追加)、「どこで同額を削って捻出するか」が一目で分かる**
- 仕分けルール・手動判定・予算が永続化され、月を跨いで自動適用される
- 統計知識がなくても運用できる(基準レンジ・信号・ガイドを常設)

### 1.3 成功指標(KPI)

| KPI | 目標 | 現状(2026-07) |
|---|---|---|
| 支出の説明可能率(カテゴリ判明率) | 90%以上 | 37% |
| 月次締め作業時間 | 30分以内 | 数時間(手作業突合) |
| freee記帳とMF入金の差異検知 | 自動検知・当月内解消 | 検知不可(7月: 記帳11万 vs 入金74.8万) |
| データ取込〜全画面反映 | 1操作・1分以内 | HTML版で達成済(維持) |
| 月次運用の総作業時間(取込→確認→仕分け微調整) | 5分以内・12ヶ月連続で継続 | 挫折の繰り返し(毎日→週1→月1→放棄) |
| ランニングコスト(インフラ+外部API) | 0円(Cloudflare無料枠内) | Excel手作業(0円だが継続不能) |

### 1.4 設計原則(本システムの基礎・すべての判断に優先する)

| # | 原則 | 具体的な意味 |
|---|---|---|
| 原則1 | **守り優先(ディフェンスファースト)** | 新機能・新投資の検討より先に、現状の無駄の可視化と管理を成立させる。攻め(売上分析の高度化)は守りが回ってから |
| 原則2 | **手間ゼロに近づける** | 続かない仕組みは無価値。月次運用は「ファイルを投げ込む→結果を見る」の2アクション・5分以内。日々の入力作業を一切要求しない |
| 原則3 | **ランニングコストゼロ** | freee/MFのAPI連携は費用が発生するため使わない。CSV/Excelの手動取込で代替し、インフラはCloudflare無料枠内で運用する |
| 原則4 | **機能はシンプル、指標は一目** | 凝った機能は不要。「どこにお金がかかっているか」「新規支出ならどこを削るか」が開いた瞬間に分かることだけを磨く |
| 原則5 | **まず大まかに作り、随時ブラッシュアップ** | 完璧な要件を待たず、大枠の管理ができるMVPを最短で出す。細部は運用しながら改善する(HTML版→本システムもこの思想の実践) |

この5原則は機能追加の採否判断に用いる。原則2・3・4に反する提案(例: 毎日の入力を要求する機能、有料API連携、複雑な多機能化)は、明確な理由がない限り却下する。

---

## 2. スコープ

### 2.1 対象(In Scope)

- HTML版の全機能のWeb化: 概況 / 増減マトリクス / 統計診断 / サブスク分析 / 公私仕分け / 家計 / 予算管理 / データ取込 / 指標ガイド
- freee取引CSV・Excel、マネーフォワード収入支出詳細CSV・Excelの取込と月次正規化
- 明細・ルール・手動判定・予算のDB永続化
- 単一利用者の認証(将来の家族共有を考慮した設計)
- CI/CDによる自動デプロイ

### 2.2 対象外(Out of Scope / 将来検討)

- freee API・マネーフォワードAPIとの直接連携 — **設計原則3(コストゼロ)により意図的に除外**。API利用は費用が発生するため、無料のCSV/Excelエクスポート取込で代替する(将来、費用対効果が明確になった時点でv2として再検討)
- 複数事業・複数ユーザーのマルチテナント
- 確定申告書類の生成(freee側の責務とする)
- ネイティブアプリ(レスポンシブWebで代替)

---

## 3. 用語定義

| 用語 | 定義 |
|---|---|
| 明細(Transaction) | MFの1行(計算対象=1かつ振替=0のみ有効) |
| 仕訳(Deal) | freeeの1取引行 |
| 公私仕分け(Classification) | 明細を biz(事業)/per(個人) に判定すること。優先順位: 手動 > ルール > 既定(per) |
| 仕分けルール(Rule) | キーワード(内容・大項目・中項目に部分一致、大文字小文字無視)→ biz/per。並び順の先勝ち |
| 事業立替 | 個人口座・カードで支払われた事業支出。freeeへ記帳すべき金額 |
| 科目正規化 | freeeの「支払手数料」「通信費」を「サブスク・通信」へ統合する等、期間比較のための科目マッピング |
| 未記帳月 | freeeで経費/売上が入力されていない月。統計計算から除外する |
| 基準レンジ | 科目ごとの 平均±1σ。「いつも通り」の範囲 |
| 説明可能率 | (支出合計 − 未分類 − 明細不明のカード引落) ÷ 支出合計 |

---

## 4. 機能要件

「1ページ1タスク」を原則とし、全ページ共通でヘッダー+サイドバーを持つ。以下、ページ単位で定義する(FR-xx = 機能要件ID)。

### 4.1 画面一覧とルーティング

| # | ページ | パス | 1タスク(このページでやること) |
|---|---|---|---|
| P1 | 概況 | `/` | 今月の収支と全期間トレンドを俯瞰する |
| P2 | 増減マトリクス | `/matrix` | 科目×月で「増えた/減った」を特定する |
| P3 | 統計診断 | `/diagnosis` | 信号(判定)を見て対応すべき科目を決める |
| P4 | サブスク分析 | `/subscriptions` | ベンダー別推移と重複・急増を確認する |
| P5 | 公私仕分け | `/classify` | 明細を事業/個人に確定する |
| P6 | 家計 | `/household` | 個人分の月次比較を確認する |
| P7 | 予算管理 | `/budget` | 科目別予算の設定と予実確認 |
| P8 | データ取込 | `/import` | ファイル投入と取込履歴の確認 |
| P9 | 設定 | `/settings` | 科目正規化・未記帳月・エクスポート |
| P10 | 指標ガイド | `/guide` | 指標の意味とベンチマークを参照する |
| P11 | やりくり試算 | `/tradeoff` | 新規支出の捻出元(どこを削るか)を決める |

### 4.2 主要機能要件

**FR-01 ファイル取込(P8)**
- CSV(Shift-JIS / UTF-8自動判別)、Excel(.xlsx/.xls 先頭シート)をアップロードできる
- ヘッダーで形式を自動判定する: 「収支区分」列→freee仕訳、「計算対象」列→MF明細。判定不能はエラー表示し取り込まない
- 原本ファイルはR2へ保存し、取込履歴(ファイル名・種別・件数・対象月・実行日時・ステータス)をDBに記録する
- **月単位の洗い替え**: 取込ファイルに含まれる月は、その月の既存データを削除して置換する(HTML版と同一仕様)。手動判定(override)は明細IDが一致する限り維持する
- MF明細は 計算対象=1 かつ 振替=0 のみ有効化。金額の正=収入、負=支出
- freee仕訳は発生日から月を導出。科目正規化マップを適用する
- 取込完了時に該当月の集計を再計算し、全ページへ反映する

**FR-02 公私仕分け(P5)**
- 明細一覧: 月選択・判定フィルタ(すべて/事業/個人/手動のみ)・キーワード検索・金額降順
- 各明細に「個人/事業/自動」の3ボタン。自動=手動判定の解除
- ルールCRUD: キーワード+判定(biz/per)。表示順=評価順(先勝ち)、ドラッグまたは上へ追加で優先度を制御
- ルール・手動判定の変更は即時に再集計へ反映する
- 月別サマリー: 明細数 / 総収入 / 事業入金 / 個人収入 / 総支出 / 事業立替 / 個人支出
- 事業立替額を「freeeへ記帳すべき金額」として明示する(税務上はfreeeが正である旨の注意書きを常設)

**FR-03 集計・統計(P1〜P4, P6)**
- HTML版の計算式をそのまま移植する(§7に明文化)。サーバ側で月次集計テーブルを生成し、画面は集計結果を取得して描画する
- 増減マトリクス: 金額 / 前月比 / 前年同月比 の3モード、年計・前年比列、CSVダウンロード
- 統計診断: 科目別の平均・中央値・σ・CV・基準レンジ・傾き・zスコア・信号判定・費目分類(固定費/準変動/スポット)
- サブスク: ベンダー別月次積み上げ、重複検知(月額が中央値の1.8倍超かつ2万円超)、急増検知(3倍超かつ1.5万円超)
- 未記帳月は経費統計・売上統計から除外。銀行実測の補正値(cash override)を登録・表示できる

**FR-04 予算管理(P7)**
- 科目別月次予算の設定・クリア・推奨値セット(固定費=直近3ヶ月平均×95%、その他=全期間平均、千円丸め)
- 予実差異と判定(超過/範囲内/余裕: 実績が予算±10%基準)

**FR-05 エクスポート(P9)**
- 統合データJSON(全テーブル相当)のダウンロード/アップロード復元(HTML版JSONとの互換を維持し、初期移行に使用する)
- 増減マトリクスCSV(BOM付きUTF-8)

**FR-06 認証**
- Cloudflare Access(Zero Trust)によるメールOTP/IdP認証を第一候補とする。アプリ側はAccessのJWT(`Cf-Access-Jwt-Assertion`)を検証する
- 単一ユーザー運用だが、全テーブルに `user_id` を持たせ将来の共有に備える

**FR-07 指標ガイド(P10)**
- HTML版の解説文(実データ差し込み)とベンチマーク表、データ充足度チェック表を提供する

**FR-08 防衛ライン(最低稼得基準額)— 全ページ常時表示**
- 定義: 防衛ライン = 個人生活費の直近3ヶ月平均 + 事業固定費(CV<0.6科目)の直近3ヶ月平均。「毎月最低これだけ出ていく=これ以上稼がないといけない金額」
- ヘッダーに常時表示し、当月の収入見込み(給与+事業入金実績)との差を色で示す(下回りそうな月は警告)
- P1概況では防衛ラインを売上・経費トレンドグラフに水平線として重ね、割り込み月を強調する

**FR-09 やりくり試算(支出トレードオフ)(P11)**
- 目的: 「1万円の買い物をしたい→その1万円をどこで削って捻出するか」を即断できるようにする。新規支出は既存コストの削減とセットで判断する、という運用思想の実装
- 入力: 予定支出の金額と種別(単発 / 毎月発生)。毎月発生の場合は年間換算額(×12)を併記して意思決定させる
- 出力: 削減余地リスト(捻出候補)を効果額の大きい順に提示する
  - サブスク重複・急増検知額(FR-03の検知結果。例: Anthropic二重契約 月3.5万円)
  - 予算超過中の科目(予算との差額)
  - 基準レンジを上回っている科目(直近実績 − 平均の超過分)
  - 未分類・説明不能支出(精査による削減期待値)
- 候補を選択すると合計捻出額と予定支出額の差を表示し、「捻出できる/不足」を判定する。選択結果はメモとして保存し、翌月の実績と突合できるようにする(言いっぱなし防止)

---

## 5. 非機能要件

| 項目 | 要件 |
|---|---|
| 性能 | 各ページ初期表示 P95 1.5秒以内(集計はDB側で事前計算)。取込処理は5,000行/10秒以内 |
| 可用性 | Cloudflareマネージド範囲に準拠。個人利用のためSLA目標は設けないが、D1の自動バックアップ+日次エクスポート(R2)を行う |
| セキュリティ | 全経路HTTPS。Access認証必須。R2/D1へは Worker 経由のみアクセス(公開バケット禁止)。金融明細のためログに明細内容・金額を出力しない |
| プライバシー | 明細の外部送信なし。アナリティクスは導入しない(または自己ホストのみ) |
| 保守性 | 計算ロジックは純関数として `packages/core` に分離し、HTML版の数値と一致するスナップショットテストを持つ |
| 対応環境 | 最新版 Chrome / Safari / Edge。モバイルは閲覧+仕分け操作を最適化 |
| コスト | Cloudflare無料枠内で運用(Workers Free 10万req/日、D1 Free、R2 Free 10GB)。有料化が必要になる変更は原則3に照らして要承認 |
| 文字コード | 取込はShift-JIS/UTF-8自動判別。内部・出力はUTF-8 |
| 監査性 | 取込・ルール変更・手動判定は履歴を残す(いつ・何を・どう変えたか) |

---

## 6. システム構成(Cloudflare)

### 6.1 アーキテクチャ

```
[Browser SPA]
  React + Vite + TypeScript + Chart.js
        │ HTTPS (Cloudflare Access で保護)
        ▼
[Cloudflare Workers]  … Hono (TypeScript) による REST API + 静的アセット配信(Workers Assets)
        │
        ├── [D1] SQLite互換DB … 明細・仕訳・ルール・予算・集計・履歴
        ├── [R2] オブジェクトストレージ … アップロード原本、日次DBエクスポート
        └── [Queues](任意) … 大容量ファイルの非同期パース(v1は同期処理で可、閾値超で導入)
```

- フロントとAPIは単一Workerにまとめる(Workers Assets でSPA配信)。個人利用規模ではPages分離より運用が単純
- パース(papaparse / SheetJS)はWorker内で実行。CPU制限(既定30s/リクエストの範囲)を超える場合のみQueuesへ退避

### 6.2 技術スタック(確定事項)

| レイヤ | 技術 | 備考 |
|---|---|---|
| 言語 | TypeScript(strict) | フロント・バック共通 |
| パッケージ管理 | pnpm workspace | monorepo |
| API | Hono | Workers最適。zodバリデーション(`@hono/zod-validator`) |
| ORM/Migration | Drizzle ORM + drizzle-kit | D1公式対応 |
| フロント | React 18 + Vite + TanStack Query + Chart.js | HTML版のデザイントークンを移植 |
| パース | papaparse(CSV) / SheetJS(xlsx) | エンコード判別は自前(UTF-8 fatal→Shift-JIS) |
| テスト | Vitest(+ @cloudflare/vitest-pool-workers) | coreは通常Vitest |
| Lint/Format | Biome | |
| デプロイ | Wrangler | 環境: preview / production |

### 6.3 リポジトリ構成

```
finance-console/
├─ pnpm-workspace.yaml
├─ packages/
│  ├─ core/            # 純粋な計算・仕分け・正規化ロジック(依存ゼロ)
│  │   ├─ classify.ts      # classifyTx / applyClassification
│  │   ├─ stats.ts         # mean/median/std/cv/zscore/movingAvg/pareto/bep
│  │   ├─ normalize.ts     # 科目正規化・月導出・金額パース
│  │   └─ parsers/         # freee / mf の行→エンティティ変換
│  ├─ api/             # Hono Worker (REST + Assets)
│  │   ├─ src/routes/      # /api/* ハンドラ
│  │   ├─ src/db/schema.ts # Drizzle スキーマ
│  │   └─ wrangler.toml
│  └─ web/             # React SPA
│      └─ src/pages/       # P1..P10 (1ページ1タスク)
├─ migrations/         # drizzle-kit 生成SQL
└─ .github/workflows/  # CI/CD
```

---

## 7. データモデル(D1)

### 7.1 ER概要

```
users 1─n imports 1─n mf_transactions
users 1─n rules
users 1─n overrides (mf_transactions.tx_id に対応)
users 1─n freee_deals
users 1─n budgets
users 1─n cash_overrides
users 1─n monthly_agg (集計キャッシュ)
```

### 7.2 テーブル定義(主要列)

```sql
-- MF明細(公私仕分け対象)
CREATE TABLE mf_transactions (
  id INTEGER PRIMARY KEY,
  user_id TEXT NOT NULL,
  tx_id TEXT NOT NULL,            -- MFのID列。無ければ month_row_amount の合成キー
  month TEXT NOT NULL,            -- 'YYYY-MM'
  date TEXT NOT NULL,             -- 'YYYY-MM-DD'
  description TEXT NOT NULL,      -- 内容
  amount INTEGER NOT NULL,        -- 円。正=収入/負=支出
  category_major TEXT, category_mid TEXT,   -- 大項目/中項目
  institution TEXT,               -- 保有金融機関
  import_id INTEGER REFERENCES imports(id),
  UNIQUE(user_id, tx_id)
);
CREATE INDEX idx_mftx_month ON mf_transactions(user_id, month);

-- freee仕訳
CREATE TABLE freee_deals (
  id INTEGER PRIMARY KEY,
  user_id TEXT NOT NULL,
  month TEXT NOT NULL, date TEXT NOT NULL,
  io TEXT NOT NULL CHECK(io IN ('income','expense')),
  partner TEXT, account_raw TEXT, account_norm TEXT,  -- 勘定科目(原本/正規化後)
  amount INTEGER NOT NULL, memo TEXT,
  import_id INTEGER REFERENCES imports(id)
);
CREATE INDEX idx_deals_month ON freee_deals(user_id, month, io);

-- 仕分けルール(sort_order 昇順で先勝ち)
CREATE TABLE rules (
  id INTEGER PRIMARY KEY, user_id TEXT NOT NULL,
  keyword TEXT NOT NULL, cls TEXT NOT NULL CHECK(cls IN ('biz','per')),
  sort_order INTEGER NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

-- 手動判定
CREATE TABLE overrides (
  user_id TEXT NOT NULL, tx_id TEXT NOT NULL,
  cls TEXT NOT NULL CHECK(cls IN ('biz','per')),
  updated_at TEXT DEFAULT (datetime('now')),
  PRIMARY KEY(user_id, tx_id)
);

-- 予算 / 現金補正 / 未記帳月 / 科目正規化
CREATE TABLE budgets (user_id TEXT, account TEXT, monthly_amount INTEGER, PRIMARY KEY(user_id, account));
CREATE TABLE cash_overrides (user_id TEXT, month TEXT, revenue INTEGER, expense INTEGER, PRIMARY KEY(user_id, month));
CREATE TABLE unrecorded_months (user_id TEXT, month TEXT, kind TEXT CHECK(kind IN ('expense','revenue')), PRIMARY KEY(user_id, month, kind));
CREATE TABLE account_norm_map (user_id TEXT, raw TEXT, norm TEXT, PRIMARY KEY(user_id, raw));
  -- 初期値: 支払手数料→サブスク・通信 / 通信費→サブスク・通信

-- 取込履歴
CREATE TABLE imports (
  id INTEGER PRIMARY KEY, user_id TEXT NOT NULL,
  filename TEXT, kind TEXT CHECK(kind IN ('freee','mf','json')),
  months TEXT,                    -- 対象月CSV文字列
  row_count INTEGER, status TEXT, r2_key TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- 月次集計キャッシュ(取込・仕分け変更時に再生成)
CREATE TABLE monthly_agg (
  user_id TEXT, month TEXT, scope TEXT,   -- scope: biz_rev / biz_exp:{科目} / per_inc:{中項目} / per_exp:{大項目} / biz_personal_in / biz_personal_out
  amount INTEGER,
  PRIMARY KEY(user_id, month, scope)
);
```

### 7.3 集計再計算のトリガ

`imports 完了` / `rules 変更` / `overrides 変更` / `account_norm_map 変更` のいずれかで、影響ユーザーの `monthly_agg` を全再生成する(数千行規模のため全再生成で十分。将来増えたら月単位差分化)。

---

## 8. 計算仕様(HTML版から移植・変更禁止項目)

`packages/core` に実装し、HTML版と同一結果になることをテストで担保する。

1. **有効明細**: 計算対象=1 かつ 振替=0
2. **公私判定**: `overrides[tx_id]` → ルール先勝ち(内容|大項目|中項目 を大文字化して部分一致) → 既定 per
3. **個人集計**: per明細のみ。収入=中項目別 / 支出=大項目別(絶対値)
4. **事業立替**: biz明細の支出合計。**事業入金**: biz明細の収入合計
5. **科目正規化**: account_norm_map 適用後に集計(既定: 支払手数料/通信費→サブスク・通信)
6. **統計**(科目別、未記帳月除外): 平均・中央値・不偏標準偏差σ・CV=σ/平均・基準レンジ=[max(0,平均−σ), 平均+σ]
7. **費目分類**: CV<0.6 固定費 / 0.6–1.5 準変動 / >1.5 スポット
8. **傾き**: 直近3ヶ月平均 ÷ それ以前平均 − 1(上昇シグナル: >+30% かつ 直近平均>1万円)
9. **z判定**: z=(直近値−平均)/σ。z≥2 要確認 / 1≤z<2 やや高い / z≤−1 低め / その他 通常
10. **移動平均**: 単純3ヶ月
11. **前年同月比**: 同月が存在しゼロでない場合のみ算出
12. **年換算**: 2026年計 ÷ 記帳月数 × 12
13. **パレート**: 科目降順の累積構成比、82%以内を強調
14. **サブスク検知**: 重複疑い=月額が当該ベンダー中央値の1.8倍超かつ2万円超かつ中央値5千円超 / 急増=3倍超かつ1.5万円超
15. **BEP**: 損益分岐点=固定費分類科目の直近3ヶ月平均合計。安全余裕率=(平均月商−BEP)/平均月商
16. **予算推奨値**: 固定費=直近3ヶ月平均×0.95 / その他=全期間平均(千円丸め)。判定: 差異が予算の±10%超で超過/余裕

---

## 9. API仕様(REST, `/api` 配下, すべて認証必須)

| Method | Path | 概要 |
|---|---|---|
| POST | /imports | multipart。ファイル受領→R2保存→判定→パース→洗い替え→再集計。202/200で `{importId, kind, months, rows}` |
| GET | /imports | 取込履歴一覧 |
| GET | /summary?from&to | P1用: 月次の売上/経費計/利益/補正値/移動平均 |
| GET | /matrix?mode=val\|mom\|yoy | P2用: 科目×月+年計 |
| GET | /diagnosis | P3用: 科目別統計プロファイル+診断+BEP |
| GET | /subscriptions | P4用: ベンダー×月+アラート |
| GET | /transactions?month&cls&q&manual | P5用: 明細一覧(判定・根拠付き) |
| PUT | /transactions/:txId/class | body `{cls:'biz'\|'per'\|null}` (null=自動へ) |
| GET/POST/DELETE/PATCH | /rules | ルールCRUD+並び替え |
| GET | /household | P6用: 個人集計(仕分け反映後)+事業立替 |
| GET/PUT | /budgets | 予算取得/一括更新。POST /budgets/suggest で推奨値 |
| GET/PUT | /settings | 正規化マップ・未記帳月・cash_overrides |
| GET | /defense-line | FR-08用: 防衛ライン額と当月収入見込み・差分 |
| GET/POST | /tradeoff | FR-09用: 削減候補リスト取得 / 試算結果の保存 |
| GET | /export/json, /export/matrix.csv | エクスポート |
| POST | /restore | HTML版互換JSONの取込(初期移行) |

エラーは `{error:{code,message}}` 統一。バリデーションは全エンドポイントでzod。

---

## 10. UI/UX仕様

### 10.1 レイアウト

- **ヘッダー(全ページ共通)**: システム名 / 対象期間 / **防衛ライン(最低稼得基準額)と当月収入見込みの対比バッジ(FR-08)** / データ状態バッジ(最終取込日・未記帳警告) / エクスポートメニュー
- **サイドバー(全ページ共通)**: P1〜P10へのナビ。現在ページを強調。モバイルではドロワー化
- **メイン**: 1ページ1タスク。ページ先頭に「このページでやること」1文と、必要なら前後ページへの導線(例: 診断→仕分け→予算)

### 10.2 デザイントークン(HTML版を継承)

- 背景 `#F2F4F3` / 面 `#FFFFFF` / インク `#1D2A2C` / 罫線 `#DDE3E1`
- 事業 `#2F5DA8` / 個人 `#9C4257` / 警告 `#A8781C` / 危険(増加) `#B23A3A` / 良好(減少) `#2E7D5B`
- 見出し: Zen Kaku Gothic New(700/900) / 数値: IBM Plex Mono(tabular-nums)
- 増減の色は「増=赤・減=緑」で全画面統一(支出文脈)。信号ピル(通常/やや高い/要確認)の文言・色もHTML版どおり

### 10.3 主要インタラクション

- 仕分けページ: 行内3ボタン(個人/事業/自動)は楽観的更新+失敗時ロールバック。キーボード操作(J/K移動、B/P/A判定)を用意
- マトリクス: 先頭列固定・横スクロール。モード切替はセグメントコントロール
- 取込: ドラッグ&ドロップ+進捗表示+結果ログ(件数/対象月/スキップ理由)。同月洗い替えの旨を確認ダイアログで明示
- 空状態: データ未取込のページは「取込へ」導線を表示

---

## 11. CI/CD

GitHub Actions、ブランチ戦略は `main`(production)+PR(preview)。

```
PR:    lint(Biome) → typecheck → unit test(core/api) → build(web)
       → wrangler versions upload(previewデプロイ、URLをPRコメント)
main:  上記 → D1 migration 適用(wrangler d1 migrations apply --remote)
       → wrangler deploy(production)
夜間:  D1 export → R2 保存(バックアップ、30日保持)
```

- Secrets: `CLOUDFLARE_API_TOKEN` のみ(GitHub Environment で保護)
- migrationは前方互換のみ許可(列削除は2段階リリース)
- `packages/core` はHTML版の2026-07実測値によるスナップショットテストを必須ゲートとする(例: 事業入金750,180 / 事業立替56,993 / 個人支出704,667)

---

## 12. データ移行

1. HTML版の「統合データを書き出し(JSON)」を実行
2. 本システムの `POST /restore` に投入(months/biz/subs/personal/mfTx/rules/overrides/budgets/cashOverride/unrecordedExpMonths を各テーブルへ展開)
3. freee/MFの原本CSVを再取込し、restore値と集計一致を確認して切替完了

---

## 13. マイルストーン

| フェーズ | 内容 | 完了条件 |
|---|---|---|
| M1 基盤 | monorepo/CI/CD/認証/D1スキーマ/コア移植 | coreスナップショットテスト全緑・previewデプロイ |
| M2 取込と仕分け(MVP) | P8取込パイプライン+P5仕分け+**防衛ライン表示(FR-08)** | CSV/Excel投入→仕分け→防衛ラインが見える。**この時点で「毎月かかる額と稼ぐべき基準」の管理という根本目的は達成**。以降は原則5に従い運用しながら拡張 |
| M3 分析画面 | P1〜P4, P6の可視化 | HTML版と同一数値・同一判定を表示 |
| M4 予算・試算・移行 | P7/P9/P10/**P11(FR-09)**+restore | HTML版JSONから完全移行、二重運用終了 |
| M5 運用改善 | バックアップ・監査履歴・モバイル調整 | 月次運用1サイクル完走 |

---

## 14. リスクと対応

| リスク | 対応 |
|---|---|
| MFのID列欠落・重複でtx_idが不安定 → 手動判定が引き継げない | 合成キー(月+行+金額+内容ハッシュ)をフォールバック。取込時にID重複を検知し警告 |
| CSVフォーマット変更(freee/MF側) | ヘッダー名の部分一致マッチ+パーサをcoreに隔離し、フィクスチャ追加のみで追随 |
| Workers CPU制限(巨大Excel) | 5,000行超でQueuesへ非同期化。UIはポーリングで進捗表示 |
| D1障害・誤操作 | 夜間R2エクスポート+取込原本保持により全量再構築可能 |
| 仕分けルールの誤爆(広すぎるキーワード) | ルール追加時に「影響件数プレビュー」を表示(該当明細数と金額) |

---

## 付録A: 取込ファイル仕様(実データ準拠)

**マネーフォワード「収入・支出詳細」**: ヘッダー `計算対象,日付,内容,金額（円）,保有金融機関,大項目,中項目,メモ,振替,ID`。日付 `YYYY/MM/DD`。金額は符号付き整数。文字コードはShift-JISが既定。

**freee 取引エクスポート**: ヘッダーに `収支区分,発生日,取引先,勘定科目,金額`(ほか任意列)。発生日 `YYYY/MM/DD`。収支区分は 収入/支出。

**判定不能ファイル**: 上記キー列が見つからない場合は取り込まず、ヘッダー行を提示して理由を表示する。