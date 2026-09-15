---
status: confirmed
category: security
aggregate: 確定
spec_cells: [security.web, security.mobile, security.tablet, security.desktop-windows, security.desktop-linux, security.desktop-macos]
serves_goals: [G1, G5]
---

# セキュリティ (security)

- カテゴリ集約状態: **確定**
- 章確定マーカー: `status: confirmed`

## カテゴリ別収集状態

| プラットフォーム | 状態 | 根拠 |
|---|---|---|
| Web (web) | 確定 | 確定質疑: qa-security-web-ds-observed-001。裏付け質疑 (`qa_refs`): `qa-ui-ux-web-ds-decision-005` — 本章の「確定内容 (質疑録)」へ接地根拠として併記。資するゴール: G1, G5 |
| モバイル (mobile) | 対象外 | 理由: スマートフォン向け専用アプリ (iOS/Android)を提供していたなら、本カテゴリではアプリ内に同梱するフォント・画像資産の署名とストア審査上の扱い、および WebView を使う場合の CSP 相当の制限を決める必要があった。本サイクルは既存 web の CSP (_headers) の範囲で完結し、外部フォントを読み込まない。対象を web のみとする利用者決定 (qa-target-platforms-ds-001 / appr-foundation-design-system-001、2026-09-13) によりその検討は発生しない。 |
| タブレット (tablet) | 対象外 | 理由: タブレット向け専用アプリを提供していたなら、本カテゴリではアプリ内に同梱するフォント・画像資産の署名とストア審査上の扱い、および WebView を使う場合の CSP 相当の制限を決める必要があった。本サイクルは既存 web の CSP (_headers) の範囲で完結し、外部フォントを読み込まない。対象を web のみとする利用者決定 (qa-target-platforms-ds-001 / appr-foundation-design-system-001、2026-09-13) によりその検討は発生しない。 |
| デスクトップ (Windows) (desktop-windows) | 対象外 | 理由: Windows 向けデスクトップアプリを提供していたなら、本カテゴリではアプリ内に同梱するフォント・画像資産の署名とストア審査上の扱い、および WebView を使う場合の CSP 相当の制限を決める必要があった。本サイクルは既存 web の CSP (_headers) の範囲で完結し、外部フォントを読み込まない。対象を web のみとする利用者決定 (qa-target-platforms-ds-001 / appr-foundation-design-system-001、2026-09-13) によりその検討は発生しない。 |
| デスクトップ (Linux) (desktop-linux) | 対象外 | 理由: Linux 向けデスクトップアプリを提供していたなら、本カテゴリではアプリ内に同梱するフォント・画像資産の署名とストア審査上の扱い、および WebView を使う場合の CSP 相当の制限を決める必要があった。本サイクルは既存 web の CSP (_headers) の範囲で完結し、外部フォントを読み込まない。対象を web のみとする利用者決定 (qa-target-platforms-ds-001 / appr-foundation-design-system-001、2026-09-13) によりその検討は発生しない。 |
| デスクトップ (macOS) (desktop-macos) | 対象外 | 理由: macOS 向けデスクトップアプリを提供していたなら、本カテゴリではアプリ内に同梱するフォント・画像資産の署名とストア審査上の扱い、および WebView を使う場合の CSP 相当の制限を決める必要があった。本サイクルは既存 web の CSP (_headers) の範囲で完結し、外部フォントを読み込まない。対象を web のみとする利用者決定 (qa-target-platforms-ds-001 / appr-foundation-design-system-001、2026-09-13) によりその検討は発生しない。 |

## 上流指針 (doctrine anchors)

> 本章の設計判断が従う上流の正本 (1 concern 1 authority)。具体技術ではなく上流工程を導く規範であり、下位の技術選定は本節と矛盾してはならない。正本: `ref-system-design-knowledge/references/doctrine-anchor-registry.json`

| 設計 concern | 上流の正本 (authority) | 導く範囲 | 出典 | 最終確認 | 本章の確定セルへの反映 |
|---|---|---|---|---|---|
| security | OWASP ASVS + Secrets Management Cheat Sheet | 脅威モデル・入力検証・暗号化・監査ログの上流指針 | https://owasp.org/www-project-application-security-verification-standard/ | 2026-07-12 | OWASP ASVS の構成要件 (CSP など安全なヘッダー) を、_headers の CSP を広げずに済む範囲で共通化するという確定内容に反映した。外部フォント・CDN を追加しない。 |

## 確定内容 (質疑録)

> 本章の各確定セルが何を根拠に確定したかの実体。`qa_ref` が主たる接地根拠、`qa_refs` がそれを支える裏付け質疑であり、いずれも qa_log (spec-state.json) の逐語である。ここに現れない主張は本章の確定内容ではない。

### Web (web)

- 資するゴール: G1, G5

#### 主たる接地根拠: `qa-security-web-ds-observed-001`

**問**

見た目の共通化は既存のセキュリティ方針 (CSP・外部資源・実データの扱い) と衝突しないか。

**答**

衝突しない。packages/web/public/_headers の CSP は default-src 'self'・script-src 'self'・style-src 'self' 'unsafe-inline'・font-src 'self' data: で、外部フォントや CDN を許していない。Web フォントを追加しない利用者決定 (qa-ui-ux-web-ds-decision-002) とトークンのビルド時同梱はこの CSP の範囲で完結し、実行時に外部から色やフォントを取得しない。チャートの色は canvas への描画値で、CSS 注入経路を増やさない。画面例やテストの表示値には匿名・架空のサンプルだけを使い、pnpm lint の security:content (guard-real-data) が公開文書の実データ混入を検査する。

- (根拠の性質: コード・設定・公式文書で検証できる観測事実 / 出所: packages/web/public/_headers と package.json の lint / security:content をアシスタントが読んだ観測事実。 / 回答時刻: 2026-09-13T05:03:11Z)

#### 裏付け質疑: `qa-ui-ux-web-ds-decision-005`

**問**

文字フォントはどうしますか？画像は日本語ゴシック体に見えます。現行は system-ui（端末標準）＋金額用の IBM Plex Mono（等幅）です。

**答**

『現行を維持し規約化 (Recommended)』を選択。和文は system-ui 系ゴシック、金額は自己配信する既存の IBM Plex Mono Latin 400/600。新規の外部Webフォントや CDN は追加せず、未読込時は ui-monospace / monospace へ落ちる。 提示した選択肢: 『現行を維持し規約化 (Recommended)』(system-ui 系和文ゴシック+既存の自己配信等幅数字。外部追加読込なし) / 『Noto Sans JP を同梱』(端末差なく画像に近いが、フォント読込で初回表示が重くなる)。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: 利用者が AskUserQuestion の選択肢から明示選択した。回答後の全非 test source と dependencies の実装確認で `main.tsx` の `@fontsource/ibm-plex-mono/latin-400.css` / `latin-600.css` と package dependency を確認したため、誤っていた過去の観測だけを訂正した。 / 回答時刻: 2026-09-13T04:36:20Z)

## To-Be / Delta

> 本章の**規範**。上位概念 (要件定義書 U3 ゴール / U4 目標 / U9 具体的やりたいこと) を本章の serves_goals で絞り込んだ射影であり、設計知識 card (非規範の参考資料) とは役割が異なる。As-Is (現行実装の姿) は spec-state.json の管轄外のため本節では断定せず、到達点と、その到達を判定する観測点だけを規範として置く。

### 到達すべき状態 (To-Be)

- **G1**: 色・文字サイズ・行高・余白・角丸・影・動き・寸法 (シェル幅/高さ/タップ領域) のデザイントークンを、packages/core に置く依存ゼロの TypeScript 定義 1 か所へ集約し、CSS 変数とチャート色はそこから導出する。和文は OS の system-ui、金額・数値は自己配信する IBM Plex Mono Latin 400/600 だけを使い、全非 test source・dependencies・外部フォントURLの検査でこの配信契約を固定する。
- **G5**: 文字と部品は WCAG 2.2 AA のコントラスト (文字 4.5:1、部品を見分ける境界・図形 3:1) を維持する。FINAL-UI の値がこれを満たさない場合は役割を分けて両立させる: 塗り・アイコン・バッジ面には画像どおりの値、文字にはその色相で 4.5:1 を満たす派生色を使う。境界は、カード区切りや表の罫線などの装飾罫線には画像どおり #D7E0E2 (1.4.11 の対象外)、入力欄・チェックボックスなど部品を見分ける枠には同じ色相で 3:1 を満たす派生色を使う。

### 受入条件 (Delta の判定点)

| 目標 | 到達点 | 達成の観測点 (measure) |
|---|---|---|
| O1 | packages/core/src/design-tokens.ts に色・文字・余白・角丸・影・動き・寸法のトークンを定義し、値の唯一の実装正本とする。 | 単体テストは schema・役割集合・alias・コントラストに必要な関係不変条件を値の転記なしで検査する。表示に影響する全トークン値は、版・承認参照・由来ファイルを持つ `docs/design-system/token-approval.json` の SHA-256 fingerprint と lint で照合し、未承認の値変更を拒否する。 |
| O2 | styles.css の :root トークンと charts.ts の COLORS を design-tokens.ts から導出した写しに置き換え、写しのずれを検出する lint を lint スクリプトへ組み込む。 | pnpm lint が写しの不一致で exit 非 0 になり、一致時に exit 0 になる。charts.ts から 6 桁 hex の直書きが 0 件になる。 |
| O4 | 文字・部品の枠・チャート系列に使う全トークンの、背景/面に対するコントラストを計算するテストを置く。 | 文字用トークンは背景 #F6F8F9 と面 #FFFFFF の双方に対し 4.5:1 以上、部品を見分ける枠のトークンとチャート系列色は 3:1 以上であることをテストが検証し、基準未満の値を入れると落ちる。装飾罫線トークン (#D7E0E2) は 1.4.11 の対象外として検査から外し、入力欄・チェックボックスの枠が装飾罫線トークンを参照していないことを同じテストで確かめる。 |

### 本章がかなえる具体的やりたいこと (U9)

- **I1**: 新しい画面をつくるとき、色・余白・角丸・文字サイズを design-tokens から選ぶだけで FINAL-UI と同じ見た目になる。
- **I5**: 注意 (アンバー) の表示は、バッジやアイコンの塗りは画像どおりの色で、文字は読みやすい濃さで出る。表の罫線は画像どおり淡く、入力欄の枠は見分けられる濃さで出る。

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

Secure by Design card の『攻撃面を増やさない』を、新規の外部Webフォント/CDNを追加しない利用者決定 (qa-ui-ux-web-ds-decision-005) と CSP の維持に結び付けた。和文は system-ui 系ゴシック、金額は既存の IBM Plex Mono Latin 400/600 をアプリ資産として自己配信するため、外部通信や CSP 拡張は発生しない。トークンもビルド時に同梱し、実行時に色や寸法を外部から取得しない。

- (根拠の性質: アシスタントの推定 (利用者確認も検証可能な出典も経ていない) / 記録時刻: 2026-09-13T07:54:32Z)

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
| cloudflare-workers-static-assets-headers | 2026-08-25 | Cloudflare (developers.cloudflare.com) | https://developers.cloudflare.com/workers/static-assets/headers/ | 2026-09-13T05:06:15Z | 2026-09-13T05:06:15Z |
