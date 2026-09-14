---
status: confirmed
category: auth
aggregate: 確定
spec_cells: [auth.web, auth.mobile, auth.tablet, auth.desktop-windows, auth.desktop-linux, auth.desktop-macos]
serves_goals: [G1, G2]
---

# 認証(ログイン) (auth)

- カテゴリ集約状態: **確定**
- 章確定マーカー: `status: confirmed`

## カテゴリ別収集状態

| プラットフォーム | 状態 | 根拠 |
|---|---|---|
| Web (web) | 確定 | 確定質疑: qa-auth-web-001。裏付け質疑 (`qa_refs`): `qa-auth-web-002`, `qa-security-web-003` — 本章の「確定内容 (質疑録)」へ接地根拠として併記。資するゴール: G1, G2 |
| モバイル (mobile) | 対象外 | 理由: 配布物として web 以外の platform を提供しない (U7 scope out / C4)。セッションは HttpOnly Cookie に載せるブラウザ前提の方式のみを採り、ネイティブの secure storage・生体認証・OS キーチェーン連携は本サイクルで設計しない。 |
| タブレット (tablet) | 対象外 | 理由: 配布物として web 以外の platform を提供しない (U7 scope out / C4)。セッションは HttpOnly Cookie に載せるブラウザ前提の方式のみを採り、ネイティブの secure storage・生体認証・OS キーチェーン連携は本サイクルで設計しない。 |
| デスクトップ (Windows) (desktop-windows) | 対象外 | 理由: 配布物として web 以外の platform を提供しない (U7 scope out / C4)。セッションは HttpOnly Cookie に載せるブラウザ前提の方式のみを採り、ネイティブの secure storage・生体認証・OS キーチェーン連携は本サイクルで設計しない。 |
| デスクトップ (Linux) (desktop-linux) | 対象外 | 理由: 配布物として web 以外の platform を提供しない (U7 scope out / C4)。セッションは HttpOnly Cookie に載せるブラウザ前提の方式のみを採り、ネイティブの secure storage・生体認証・OS キーチェーン連携は本サイクルで設計しない。 |
| デスクトップ (macOS) (desktop-macos) | 対象外 | 理由: 配布物として web 以外の platform を提供しない (U7 scope out / C4)。セッションは HttpOnly Cookie に載せるブラウザ前提の方式のみを採り、ネイティブの secure storage・生体認証・OS キーチェーン連携は本サイクルで設計しない。 |

## 上流指針 (doctrine anchors)

> 本章の設計判断が従う上流の正本 (1 concern 1 authority)。具体技術ではなく上流工程を導く規範であり、下位の技術選定は本節と矛盾してはならない。正本: `ref-system-design-knowledge/references/doctrine-anchor-registry.json`

| 設計 concern | 上流の正本 (authority) | 導く範囲 | 出典 | 最終確認 | 本章の確定セルへの反映 |
|---|---|---|---|---|---|
| authentication | OWASP ASVS + Secrets Management Cheat Sheet | 認証方式・セッション・資格情報/シークレット/API キーの取扱いの上流指針 | https://owasp.org/www-project-application-security-verification-standard/ | 2026-07-12 | OWASP ASVS 5.0.0 の認証・セッション管理要件を本章の確定へ適用した: 資格情報は鍵導出関数で保存し (PBKDF2-HMAC-SHA256 / 反復 210,000 以上 / 16 byte 以上の salt)、セッションは利用者単位で即時失効でき (session_generation)、Cookie は HttpOnly + Secure + SameSite=Strict とする。 |
| security | OWASP ASVS + Secrets Management Cheat Sheet | 脅威モデル・入力検証・暗号化・監査ログの上流指針 | https://owasp.org/www-project-application-security-verification-standard/ | 2026-07-12 | OWASP Secrets Management の原則から、共有パスワード (AUTH_PASSWORD) という長期・共有の秘密を撤去し、秘密を SESSION_SECRET に一本化した。一時パスワードは短命 (72 時間) かつハッシュ保存で、使用後に変更を強制する。 |

> **未記入** の行は、上流の正本を掲げただけで本章の確定内容へ反映した箇所を示せていない。表への出現は反映の証拠ではない。

## 確定内容 (質疑録)

> 本章の各確定セルが何を根拠に確定したかの実体。`qa_ref` が主たる接地根拠、`qa_refs` がそれを支える裏付け質疑であり、いずれも qa_log (spec-state.json) の逐語である。ここに現れない主張は本章の確定内容ではない。

### Web (web)

- 資するゴール: G1, G2

#### 主たる接地根拠: `qa-auth-web-001`

**問**

認証モデル (web) を確定してください。誰が主体で、資格情報は何で、セッションはどう保持し、どう失効しますか。

**答**

認証主体を共有パスワードから利用者アカウントへ移す。資格情報はメールアドレス (正規化: 前後空白除去 + 小文字化 + 一意制約) とパスワードの組。パスワードは PBKDF2-HMAC-SHA256 (WebCrypto、反復 210,000 以上、16 byte 以上のランダム salt、アルゴリズム/反復/salt を含む自己記述フォーマットで保存) とし、平文および 可逆暗号での保存を禁じる。既存の AUTH_PASSWORD による共有パスワード経路は廃止する。セッションは HttpOnly + Secure + SameSite=Strict の Cookie に『利用者 ID と有効期限と発行世代』を載せ HMAC-SHA256 で署名する。有効期限は 2 段: 『保持しない』= 12 時間、『次回もログイン状態を保持する』= 30 日。authGuard は共有業務データのテナントキー `userId='default'` を維持し、認証した実利用者を `actor` として別contextへ設定する。失効は (a) ログアウト、(b) パスワード変更/再発行、(c) 管理者による停止 のいずれでも即時に効くよう、利用者ごとの世代番号 (session_generation) を DB に持ち、署名 payload の世代と一致しない Cookie を無効とする。新規アカウントは自己登録させず管理者招待制のみとする。パスワード再発行はメール送信基盤が無いため 管理者が72時間有効な一時パスワードを発行し、次回ログイン時に変更を強制する方式とする。Cloudflare Access 経路はサーバ側の実装を残すが、ログイン画面の UI からは除去する。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: 利用者の明示指示 (メール+パスワードのみ / 招待制 / メール送信を使わない / 保持 / Access は UI から消しサーバは残す) と、packages/api/src/auth.ts の現行実装 (userId='default'・平文比較・exp のみ署名) の観測 / 回答時刻: 2026-09-13T01:49:08Z)

#### 裏付け質疑: `qa-auth-web-002`

**問**

切替時点で既に配布済みの旧形式セッション Cookie (exp のみを署名した payload) をどう扱うか。

**答**

旧形式 Cookie は移行後、無条件に不正として扱い、全利用者へ再ログインを求める。二段で担保する: (a) 署名 payload を『利用者 ID . 有効期限 . 世代』の3要素へ変更し、要素数・形式が一致しない Cookie は署名検証に進む前に拒否する。(b) デプロイ時に SESSION_SECRET をローテーションし、旧 secret で作られた署名を全て無効化する。(a) だけでは実装の分岐ミスで旧形式を受理する余地が残り、(b) だけでは payload 形式の混在が続くため、両方を課す。切替直後に全利用者が再ログインになるのは意図した挙動であり、共有パスワードで発行された『誰のものか特定できないセッション』が利用者単位の新体系へ持ち越されないことを保証する。

- (根拠の性質: コード・設定・公式文書で検証できる観測事実 / 出所: packages/api/src/auth.ts の verifySessionCookie (L82-92) が exp のみを署名対象とし利用者を識別しない実装であることの観測と、qa-auth-web-001 が確定した新 payload 形式との差分 / 回答時刻: 2026-09-13T02:07:56Z)

#### 裏付け質疑: `qa-security-web-003`

**問**

qa-security-web-002 で agent-inference として記録した2点 — (8) パスワード再利用の扱い、(9) 同時セッション数の上限 — を、利用者確認のうえ確定してください。再利用は『現行と同一値のみ拒否・履歴は保持しない』か『過去N世代も拒否』か。同時セッションは『上限なし』か『1利用者1セッション』か。

**答**

利用者が両案の比較を見たうえで次を選択した。(8) パスワード再利用: 変更・再発行時に現行パスワードと同一の値のみを拒否し、過去世代のパスワード履歴は保存しない。履歴を持つこと自体が漏洩時の資産になり、利用者の他サービスでの資格情報を推測させる材料になるため、履歴照合ではなく『12文字以上 + 明白な弱パスワードの拒否 + session_generation による失効』で代替する。(9) 同時セッション数: 上限を設けない。同一利用者が複数端末・複数ブラウザで並行利用するのは正当な利用形態であり、上限を課すと正規利用者が締め出される一方、攻撃者は先に張ったセッションを維持できるため防御として非対称に弱い。異常時の封じ込めは session_generation による一括失効 (ログアウト・パスワード変更・管理者による停止) で行う。本 entry は qa-security-web-002 の内容を利用者確認により追認するものであり、方針そのものは変わらない。変わるのは根拠の性質 (推論 → 利用者決定) である。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: 利用者が2論点それぞれについて2案 (再利用: 同一値のみ拒否 / 過去N世代も拒否、同時セッション: 上限なし / 1利用者1セッション) の帰結を見たうえで明示選択 (2026-09-13)。独立監査 (system-spec-matrix-auditor 再監査) の LOW-2『セキュリティポリシー上重要な2点が利用者未提示のまま確定セルへ追加されている』を受けて確認した / 回答時刻: 2026-09-13T04:55:11Z)

## To-Be / Delta

> 本章の**規範**。上位概念 (要件定義書 U3 ゴール / U4 目標 / U9 具体的やりたいこと) を本章の serves_goals で絞り込んだ射影であり、設計知識 card (非規範の参考資料) とは役割が異なる。As-Is (現行実装の姿) は spec-state.json の管轄外のため本節では断定せず、到達点と、その到達を判定する観測点だけを規範として置く。

### 到達すべき状態 (To-Be)

- **G1**: 利用者がメールアドレスとパスワードで本人として認証でき、セッションが誰のものかシステム側で特定できる
- **G2**: 認証情報が漏洩しても即座に全データが露出しない。パスワードは復元不能な形で保存し、セッションは利用者単位で失効できる

### 受入条件 (Delta の判定点)

| 目標 | 到達点 | 達成の観測点 (measure) |
|---|---|---|
| O1 | users テーブルを新設し、パスワードを鍵導出関数 (WebCrypto PBKDF2) で保存する | migration 適用後の schema に password_hash と salt と反復回数が存在し、平文パスワードを保持するカラムが0件 |
| O2 | セッション cookie に利用者識別子を含め、識別子を署名対象に含める | 利用者識別子を改ざんした cookie が /api/* で401になる契約テストが緑 |
| O3 | 「次回からもログイン状態を保持する」の選択でセッション有効期間を2段階に切り替える | 未選択時と選択時で Set-Cookie の maxAge が異なることを検査するテストが緑 |
| O6 | 認証失敗時の応答が、メールアドレスの存在有無を区別しない | 未登録メールと誤パスワードで応答本文・ステータスが同一で、パスワード検証を常に実行して所要時間差を作らない |
| O7 | 既存のログイン rate limit をメールアドレス単位へ拡張する | 同一メールへの連続失敗で当該メールがロックされ、他メールのログインは阻害されないテストが緑 |

### 本章がかなえる具体的やりたいこと (U9)

- **I1**: メールアドレスとパスワードの2入力によるログインフォーム
- **I3**: 「次回からもログイン状態を保持する」チェックボックス
- **I5**: 認証失敗時は「メールアドレスまたはパスワードが正しくありません。」の単一文言をフィールド直下に出す
- **I9**: users テーブルと、利用者ごとの salt を伴う鍵導出によるパスワード保存
- **I10**: セッションへの利用者識別子の埋め込みと、利用者単位でのセッション失効
- **I12**: ログイン rate limit をメールアドレス単位へ拡張する
- **I13**: migration適用後のbootstrap seedで初回管理者を作成し、共有パスワード認証経路を撤去する

### 本章に効く確定意思決定

- (本章ゴールに効く確定 decision なし)

## 適用された設計知識

> 以下の deep knowledge card は設計判断を支援する**非規範の参考資料**であり、実装済み・検証済みの証拠ではない。カード内の `採否: applied` は設計採用を意味し、実装状態は意味しない。規範となる差分は本章の To-Be / Delta 節と参照先仕様で管理する。

### 本章での適用

secure-by-design の『既定を安全にし、利用者の設定に安全性を依存させない』を本章の確定内容へ適用した: パスワードは PBKDF2-HMAC-SHA256 で保存し平文経路を残さない、セッションは利用者単位の世代番号で即時失効できる、共有パスワード経路は併存させず撤去する、の 3 点はいずれも『運用で気を付ける』に委ねない既定側の設計である。

- (根拠の性質: アシスタントの推定 (利用者確認も検証可能な出典も経ていない) / 記録時刻: 2026-09-13T02:20:00Z)

### Secure by Design — deep knowledge card

- 出典カード: `ref-system-design-knowledge/references/secure-by-design.md`

#### 目的

利用者の注意や運用後のpatchへ安全性を押し付けず、systemのdefault、architecture、development lifecycleに安全な結果を組み込み、被害可能性と復旧費を下げる。

#### 解決する問題

- 認証・認可・data protectionが後付けで、business flowと矛盾する。
- defaultが過大権限/公開状態で、利用者の完全な設定に安全性が依存する。
- 単一防御の突破で全面侵害になり、検知・封じ込め・復旧の証拠が無い。
- dependency、secret、build、releaseの供給chain riskが製品境界外として放置される。

#### 適用条件

- identity、個人/機密data、金銭、外部入力、admin操作、multi-tenant boundaryを扱う全system。
- compromise時の影響がgoal、法規、信頼、運用継続を損なう。
- vendor/serviceを使う場合も、共有責任とfailure/exit planを明示できる。

#### 非適用条件

- security自体が不要なsystemは原則ない。asset/threatが極小ならcontrolを軽量化できるが、根拠付きrisk acceptanceが必要。
- controlがthreatを減らさず、accessibility/availability/safetyを重大に損なう場合はそのcontrolを採用しない。代替・補償統制を設計する。
- checklist準拠だけでproject固有のtrust boundaryとabuse caseを置き換えない。

#### トレードオフ・失敗モード

- friction、latency、delivery費、運用負荷が増えるため、risk reductionと明示的に釣り合わせる。
- security theaterとしてcontrol数だけ増やし、owner、evidence、responseを持たない。
- fail closedを無差別適用してavailability/safety incidentを起こす。degraded modeとbreak-glass監査が必要。
- secretを隠しても過大権限や長期credentialを残す、暗号化してもkey lifecycleを設計しない等の局所最適。
- free tier製品を価格だけで選び、audit、export、retention、MFA、incident support不足を見落とす。

#### goalへの寄与

- stakeholderの安全・信頼・継続性をsuccess criteriaへ変換し、threat/control/evidenceをgoalへトレースする。
- security controlは「導入済み」ではなく、阻止/検知/復旧時間、権限範囲、data exposureで効果を測る。
- 予算0制約でも、secure default、最小data、短命credential、標準機能、open-source検査を優先し、残余riskを隠さない。

## 最新ドキュメント出典

| 対象 | バージョン | 公式発行元 | 出典URL | 取得 | 最新確認 |
|---|---|---|---|---|---|
| web-crypto-api | Level 2 First Public Working Draft | W3C (www.w3.org) | https://www.w3.org/TR/WebCryptoAPI/ | 2026-09-13T01:55:58Z | 2026-09-13T01:55:58Z |
