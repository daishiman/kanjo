---
status: confirmed
category: infrastructure
aggregate: 確定
spec_cells: [infrastructure.web, infrastructure.mobile, infrastructure.tablet, infrastructure.desktop-windows, infrastructure.desktop-linux, infrastructure.desktop-macos]
serves_goals: [G5, G2]
---

# インフラ (infrastructure)

- カテゴリ集約状態: **確定**
- 章確定マーカー: `status: confirmed`

## カテゴリ別収集状態

| プラットフォーム | 状態 | 根拠 |
|---|---|---|
| Web (web) | 確定 | 確定質疑: qa-infra-web-001。資するゴール: G5, G2 |
| モバイル (mobile) | 対象外 | 理由: 配布物として web 以外の platform を提供しない (U7 scope out / C4)。配信は Cloudflare Workers の static assets 一系統のみで、App Store / Google Play / インストーラ配布のチャネルと署名鍵の管理を持たない。 |
| タブレット (tablet) | 対象外 | 理由: 配布物として web 以外の platform を提供しない (U7 scope out / C4)。配信は Cloudflare Workers の static assets 一系統のみで、App Store / Google Play / インストーラ配布のチャネルと署名鍵の管理を持たない。 |
| デスクトップ (Windows) (desktop-windows) | 対象外 | 理由: 配布物として web 以外の platform を提供しない (U7 scope out / C4)。配信は Cloudflare Workers の static assets 一系統のみで、App Store / Google Play / インストーラ配布のチャネルと署名鍵の管理を持たない。 |
| デスクトップ (Linux) (desktop-linux) | 対象外 | 理由: 配布物として web 以外の platform を提供しない (U7 scope out / C4)。配信は Cloudflare Workers の static assets 一系統のみで、App Store / Google Play / インストーラ配布のチャネルと署名鍵の管理を持たない。 |
| デスクトップ (macOS) (desktop-macos) | 対象外 | 理由: 配布物として web 以外の platform を提供しない (U7 scope out / C4)。配信は Cloudflare Workers の static assets 一系統のみで、App Store / Google Play / インストーラ配布のチャネルと署名鍵の管理を持たない。 |

## 上流指針 (doctrine anchors)

> 本章の設計判断が従う上流の正本 (1 concern 1 authority)。具体技術ではなく上流工程を導く規範であり、下位の技術選定は本節と矛盾してはならない。正本: `ref-system-design-knowledge/references/doctrine-anchor-registry.json`

| 設計 concern | 上流の正本 (authority) | 導く範囲 | 出典 | 最終確認 | 本章の確定セルへの反映 |
|---|---|---|---|---|---|
| reliability | Google SRE | SLO/エラーバジェット・冗長性・スケーリング・監視の上流指針 | https://sre.google/books/ | 2026-07-12 | Google SRE の『変更点を増やさない』に従い、新しい binding・cron・外部依存を増やさず、掃除処理を既存 cron (0 18 * * *) へ相乗りさせると本章で確定した。 |
| operations | Google SRE | 運用手順・障害対応・トイル削減・ポストモーテムの上流指針 | https://sre.google/workbook/ | 2026-07-12 | Google SRE の運用観点から、SESSION_SECRET のローテーションが全セッション失効を意味することを構成上の帰結として明示し、手順化の対象とした。 |

> **未記入** の行は、上流の正本を掲げただけで本章の確定内容へ反映した箇所を示せていない。表への出現は反映の証拠ではない。

## 確定内容 (質疑録)

> 本章の各確定セルが何を根拠に確定したかの実体。`qa_ref` が主たる接地根拠、`qa_refs` がそれを支える裏付け質疑であり、いずれも qa_log (spec-state.json) の逐語である。ここに現れない主張は本章の確定内容ではない。

### Web (web)

- 資するゴール: G5, G2

#### 主たる接地根拠: `qa-infra-web-001`

**問**

インフラ構成 (web) を確定してください。新しい binding や secret は要りますか。

**答**

配信構成は現行のまま維持する: Cloudflare Workers (kanjo-console) + D1 (DB) + R2 (FILES) + static assets で、assets の run_worker_first は /api/* のまま。新しい binding は追加しない (メール送信基盤を導入しないため Email binding も外部 API キーも増やさない)。secret は SESSION_SECRET を必須のまま維持し、AUTH_PASSWORD を required から外して廃止する。SESSION_SECRET のローテーションは全セッションの失効を意味するため、運用手順として明示する。既存の cron (0 18 * * *) に相乗りして、期限切れの一時パスワードと レート制限行の掃除を行う (新しい cron を増やさない)。

- (根拠の性質: コード・設定・公式文書で検証できる観測事実 / 出所: packages/api/wrangler.jsonc の観測 (binding・secrets.required・triggers.crons) と、メール送信を使わないという利用者決定 / 回答時刻: 2026-09-13T01:49:08Z)

## To-Be / Delta

> 本章の**規範**。上位概念 (要件定義書 U3 ゴール / U4 目標 / U9 具体的やりたいこと) を本章の serves_goals で絞り込んだ射影であり、設計知識 card (非規範の参考資料) とは役割が異なる。As-Is (現行実装の姿) は spec-state.json の管轄外のため本節では断定せず、到達点と、その到達を判定する観測点だけを規範として置く。

### 到達すべき状態 (To-Be)

- **G5**: 既存20画面と /api/* 認証ガードの契約を壊さずに認証主体を差し替える
- **G2**: 認証情報が漏洩しても即座に全データが露出しない。パスワードは復元不能な形で保存し、セッションは利用者単位で失効できる

### 受入条件 (Delta の判定点)

| 目標 | 到達点 | 達成の観測点 (measure) |
|---|---|---|
| O1 | users テーブルを新設し、パスワードを鍵導出関数 (WebCrypto PBKDF2) で保存する | migration 適用後の schema に password_hash と salt と反復回数が存在し、平文パスワードを保持するカラムが0件 |
| O2 | セッション cookie に利用者識別子を含め、識別子を署名対象に含める | 利用者識別子を改ざんした cookie が /api/* で401になる契約テストが緑 |
| O3 | 「次回からもログイン状態を保持する」の選択でセッション有効期間を2段階に切り替える | 未選択時と選択時で Set-Cookie の maxAge が異なることを検査するテストが緑 |
| O6 | 認証失敗時の応答が、メールアドレスの存在有無を区別しない | 未登録メールと誤パスワードで応答本文・ステータスが同一で、パスワード検証を常に実行して所要時間差を作らない |
| O7 | 既存のログイン rate limit をメールアドレス単位へ拡張する | 同一メールへの連続失敗で当該メールがロックされ、他メールのログインは阻害されないテストが緑 |
| O8 | migration適用後のbootstrap seedで初回管理者を1件作成し、共有パスワード認証経路を撤去する | active runtimeと必須設定に共有パスワード認証分岐が0件で、旧secretを外しても全機能が動作する |

### 本章がかなえる具体的やりたいこと (U9)

- **I5**: 認証失敗時は「メールアドレスまたはパスワードが正しくありません。」の単一文言をフィールド直下に出す
- **I9**: users テーブルと、利用者ごとの salt を伴う鍵導出によるパスワード保存
- **I10**: セッションへの利用者識別子の埋め込みと、利用者単位でのセッション失効
- **I12**: ログイン rate limit をメールアドレス単位へ拡張する
- **I13**: migration適用後のbootstrap seedで初回管理者を作成し、共有パスワード認証経路を撤去する
- **I14**: 既存 /api/* 認証ガードの mount 順序と契約を維持したまま主体を差し替える

### 本章に効く確定意思決定

- (本章ゴールに効く確定 decision なし)

## 適用された設計知識

> 以下の deep knowledge card は設計判断を支援する**非規範の参考資料**であり、実装済み・検証済みの証拠ではない。カード内の `採否: applied` は設計採用を意味し、実装状態は意味しない。規範となる差分は本章の To-Be / Delta 節と参照先仕様で管理する。

### 本章での適用

secure-by-design の『攻撃面と秘密を増やさない』を構成判断に適用した: メール送信を採らない決定の帰結として 新しい binding も外部 API キーも増やさず、secret は SESSION_SECRET のみに絞り AUTH_PASSWORD を撤去する、と本章で確定した。掃除処理を既存 cron へ相乗りさせ新規トリガを増やさない判断も、運用面の増設を避ける同じ原則から来ている。

- (根拠の性質: アシスタントの推定 (利用者確認も検証可能な出典も経ていない) / 記録時刻: 2026-09-13T02:20:00Z)

- `ref-system-design-knowledge/references/resource-map.yaml` (本章へ引く card は 0 件。未着手ではなく、上の適用記述で0 件である理由を述べた上での確定である)

## 最新ドキュメント出典

| 対象 | バージョン | 公式発行元 | 出典URL | 取得 | 最新確認 |
|---|---|---|---|---|---|
| cloudflare-workers | 2026-04-23 | Cloudflare (developers.cloudflare.com) | https://developers.cloudflare.com/workers/runtime-apis/web-crypto/ | 2026-09-13T01:55:58Z | 2026-09-13T01:55:58Z |
