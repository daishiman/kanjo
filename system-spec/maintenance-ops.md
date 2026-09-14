---
status: confirmed
category: maintenance-ops
aggregate: 確定
spec_cells: [maintenance-ops.web, maintenance-ops.mobile, maintenance-ops.tablet, maintenance-ops.desktop-windows, maintenance-ops.desktop-linux, maintenance-ops.desktop-macos]
serves_goals: [G3, G2]
---

# 保守運用管理 (maintenance-ops)

- カテゴリ集約状態: **確定**
- 章確定マーカー: `status: confirmed`

## カテゴリ別収集状態

| プラットフォーム | 状態 | 根拠 |
|---|---|---|
| Web (web) | 確定 | 確定質疑: qa-ops-web-001。資するゴール: G3, G2 |
| モバイル (mobile) | 対象外 | 理由: 配布物として web 以外の platform を提供しない (U7 scope out / C4)。運用手順はデプロイ 1 系統に対してのみ定義し、platform 別のリリース審査・強制アップデート・旧バージョン併存の運用を設けない。 |
| タブレット (tablet) | 対象外 | 理由: 配布物として web 以外の platform を提供しない (U7 scope out / C4)。運用手順はデプロイ 1 系統に対してのみ定義し、platform 別のリリース審査・強制アップデート・旧バージョン併存の運用を設けない。 |
| デスクトップ (Windows) (desktop-windows) | 対象外 | 理由: 配布物として web 以外の platform を提供しない (U7 scope out / C4)。運用手順はデプロイ 1 系統に対してのみ定義し、platform 別のリリース審査・強制アップデート・旧バージョン併存の運用を設けない。 |
| デスクトップ (Linux) (desktop-linux) | 対象外 | 理由: 配布物として web 以外の platform を提供しない (U7 scope out / C4)。運用手順はデプロイ 1 系統に対してのみ定義し、platform 別のリリース審査・強制アップデート・旧バージョン併存の運用を設けない。 |
| デスクトップ (macOS) (desktop-macos) | 対象外 | 理由: 配布物として web 以外の platform を提供しない (U7 scope out / C4)。運用手順はデプロイ 1 系統に対してのみ定義し、platform 別のリリース審査・強制アップデート・旧バージョン併存の運用を設けない。 |

## 上流指針 (doctrine anchors)

> 本章の設計判断が従う上流の正本 (1 concern 1 authority)。具体技術ではなく上流工程を導く規範であり、下位の技術選定は本節と矛盾してはならない。正本: `ref-system-design-knowledge/references/doctrine-anchor-registry.json`

| 設計 concern | 上流の正本 (authority) | 導く範囲 | 出典 | 最終確認 | 本章の確定セルへの反映 |
|---|---|---|---|---|---|
| operations | Google SRE | 運用手順・障害対応・トイル削減・ポストモーテムの上流指針 | https://sre.google/workbook/ | 2026-07-12 | Google SRE の runbook と break-glass の考え方を適用した: 通常運用 (招待・停止・一時パスワード再発行) は管理画面に閉じ、全 admin 喪失という例外時のみ wrangler d1 execute による直接復旧を最終手段として文書化する。ログイン失敗率とロックアウト件数を audit_log から確認できる状態にすることを監視の最小線とした。 |

> **未記入** の行は、上流の正本を掲げただけで本章の確定内容へ反映した箇所を示せていない。表への出現は反映の証拠ではない。

## 確定内容 (質疑録)

> 本章の各確定セルが何を根拠に確定したかの実体。`qa_ref` が主たる接地根拠、`qa_refs` がそれを支える裏付け質疑であり、いずれも qa_log (spec-state.json) の逐語である。ここに現れない主張は本章の確定内容ではない。

### Web (web)

- 資するゴール: G3, G2

#### 主たる接地根拠: `qa-ops-web-001`

**問**

運用手順 (web) を確定してください。初期管理者の作成、締め出し時の復旧、移行はどう行いますか。

**答**

(1) 移行: migration適用後、共有パスワードを撤去する前に単一bootstrap seedで初期管理者を1件作成し、その資格情報を運用者へ引き渡す。これらは1回の切替作業として連続実行し、定常的な併存期間を設けない。(2) 締め出し復旧: 最後の admin を失う操作はサーバ側が拒否するが、それでも全 admin がログイン不能になった場合は wrangler d1 execute による直接のパスワードハッシュ更新を最終手段の runbook として文書化する。(3) 日常運用: 利用者の招待・停止・一時パスワード再発行は管理画面から行い、監査は audit_log を参照する。(4) 監視: ログイン失敗率とロックアウト件数を audit_log から確認できる状態にする。(5) 秘密の取扱い: 一時パスワードは発行直後の 1 度だけ管理画面に表示し、再表示できない。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: 利用者決定 (初回管理者を 1 件作り共有パスワードは廃止する) と、上記 security/database の確定内容 / 回答時刻: 2026-09-13T01:49:08Z)

## To-Be / Delta

> 本章の**規範**。上位概念 (要件定義書 U3 ゴール / U4 目標 / U9 具体的やりたいこと) を本章の serves_goals で絞り込んだ射影であり、設計知識 card (非規範の参考資料) とは役割が異なる。As-Is (現行実装の姿) は spec-state.json の管轄外のため本節では断定せず、到達点と、その到達を判定する観測点だけを規範として置く。

### 到達すべき状態 (To-Be)

- **G3**: 管理者が設定画面から利用者の追加・停止・パスワード再発行を完結でき、共有パスワードの配り直しが不要になる
- **G2**: 認証情報が漏洩しても即座に全データが露出しない。パスワードは復元不能な形で保存し、セッションは利用者単位で失効できる

### 受入条件 (Delta の判定点)

| 目標 | 到達点 | 達成の観測点 (measure) |
|---|---|---|
| O1 | users テーブルを新設し、パスワードを鍵導出関数 (WebCrypto PBKDF2) で保存する | migration 適用後の schema に password_hash と salt と反復回数が存在し、平文パスワードを保持するカラムが0件 |
| O2 | セッション cookie に利用者識別子を含め、識別子を署名対象に含める | 利用者識別子を改ざんした cookie が /api/* で401になる契約テストが緑 |
| O3 | 「次回からもログイン状態を保持する」の選択でセッション有効期間を2段階に切り替える | 未選択時と選択時で Set-Cookie の maxAge が異なることを検査するテストが緑 |
| O4 | 管理者が設定画面から利用者の作成・停止・一時パスワード発行を行える | 3操作それぞれに API と画面操作が存在し、非管理者からの呼出しが403になる |
| O6 | 認証失敗時の応答が、メールアドレスの存在有無を区別しない | 未登録メールと誤パスワードで応答本文・ステータスが同一で、パスワード検証を常に実行して所要時間差を作らない |
| O7 | 既存のログイン rate limit をメールアドレス単位へ拡張する | 同一メールへの連続失敗で当該メールがロックされ、他メールのログインは阻害されないテストが緑 |
| O8 | migration適用後のbootstrap seedで初回管理者を1件作成し、共有パスワード認証経路を撤去する | active runtimeと必須設定に共有パスワード認証分岐が0件で、旧secretを外しても全機能が動作する |

### 本章がかなえる具体的やりたいこと (U9)

- **I5**: 認証失敗時は「メールアドレスまたはパスワードが正しくありません。」の単一文言をフィールド直下に出す
- **I8**: 「パスワードをお忘れの方」を管理者への問い合わせ導線として置く (メール送信は行わない)
- **I9**: users テーブルと、利用者ごとの salt を伴う鍵導出によるパスワード保存
- **I10**: セッションへの利用者識別子の埋め込みと、利用者単位でのセッション失効
- **I11**: 設定画面の管理者セクションで、利用者一覧の閲覧・追加・停止・一時パスワード発行を行う
- **I12**: ログイン rate limit をメールアドレス単位へ拡張する
- **I13**: migration適用後のbootstrap seedで初回管理者を作成し、共有パスワード認証経路を撤去する
- **I15**: 管理者が最後の管理者を停止・降格できないようにする

### 本章に効く確定意思決定

- (本章ゴールに効く確定 decision なし)

## 適用された設計知識

> 以下の deep knowledge card は設計判断を支援する**非規範の参考資料**であり、実装済み・検証済みの証拠ではない。カード内の `採否: applied` は設計採用を意味し、実装状態は意味しない。規範となる差分は本章の To-Be / Delta 節と参照先仕様で管理する。

### 本章での適用

secure-by-design の『fail closed を無差別適用せず break-glass を監査付きで用意する』を本章へ適用した: 最後の admin を失う操作はサーバが拒否する一方で、全 admin が失われた場合の直接復旧手順を runbook として明文化した。一時パスワードを発行直後の 1 度だけ表示し再表示しない運用も、短命の資格情報という原則の具体化である。

- (根拠の性質: アシスタントの推定 (利用者確認も検証可能な出典も経ていない) / 記録時刻: 2026-09-13T02:20:00Z)

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

- (このカテゴリに割り当てた取得済みドキュメントなし。全体出典は index.md 参照)
