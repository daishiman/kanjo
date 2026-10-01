---
status: confirmed
category: security
aggregate: 確定
spec_cells: [security.web, security.mobile, security.tablet, security.desktop-windows, security.desktop-linux, security.desktop-macos]
serves_goals: [G4]
---

# セキュリティ (security)

- カテゴリ集約状態: **確定**
- 章確定マーカー: `status: confirmed`

## カテゴリ別収集状態

| プラットフォーム | 状態 | 根拠 |
|---|---|---|
| Web (web) | 確定 | 確定質疑: qa-guide-security-web-001。裏付け質疑 (`qa_refs`): `qa-guide-security-web-evidence-001`, `qa-guide-security-web-003` — 本章の「確定内容 (質疑録)」へ接地根拠として併記。資するゴール: G4 |
| モバイル (mobile) | 対象外 | 理由: スマートフォン向け専用アプリを提供していたなら、security では端末内に残るガイドの数値 (総収支) の保護と端末紛失時の消去を決める必要があった。対象を web のみとする利用者決定 (qa-guide-target-platforms-001) によりその検討は発生しない。 |
| タブレット (tablet) | 対象外 | 理由: タブレット向け専用アプリを提供していたなら、security では端末内に残るガイドの数値 (総収支) の保護と端末紛失時の消去を決める必要があった。対象を web のみとする利用者決定 (qa-guide-target-platforms-001) によりその検討は発生しない。 |
| デスクトップ (Windows) (desktop-windows) | 対象外 | 理由: Windows 向けデスクトップアプリを提供していたなら、security では端末内に残るガイドの数値 (総収支) の保護と端末紛失時の消去を決める必要があった。対象を web のみとする利用者決定 (qa-guide-target-platforms-001) によりその検討は発生しない。 |
| デスクトップ (Linux) (desktop-linux) | 対象外 | 理由: Linux 向けデスクトップアプリを提供していたなら、security では端末内に残るガイドの数値 (総収支) の保護と端末紛失時の消去を決める必要があった。対象を web のみとする利用者決定 (qa-guide-target-platforms-001) によりその検討は発生しない。 |
| デスクトップ (macOS) (desktop-macos) | 対象外 | 理由: macOS 向けデスクトップアプリを提供していたなら、security では端末内に残るガイドの数値 (総収支) の保護と端末紛失時の消去を決める必要があった。対象を web のみとする利用者決定 (qa-guide-target-platforms-001) によりその検討は発生しない。 |

## 上流指針 (doctrine anchors)

> 本章の設計判断が従う上流の正本 (1 concern 1 authority)。具体技術ではなく上流工程を導く規範であり、下位の技術選定は本節と矛盾してはならない。正本: `ref-system-design-knowledge/references/doctrine-anchor-registry.json`

| 設計 concern | 上流の正本 (authority) | 導く範囲 | 出典 | 最終確認 | 本章の確定セルへの反映 |
|---|---|---|---|---|---|
| security | OWASP ASVS + Secrets Management Cheat Sheet | 脅威モデル・入力検証・暗号化・監査ログの上流指針 | https://owasp.org/www-project-application-security-verification-standard/ | 2026-07-12 | フッタ 1 文目を『取込データは外部送信しません』と明細を送らない事実に限り、AI 実行時に確認した集計データを選択した AI へ渡す事実を title・プライバシー欄・使い方画面の 3 か所に必ず残す形へ反映した。CSP (default-src 'self'・connect-src 'self') は変えない。 |

## 確定内容 (質疑録)

> 本章の各確定セルが何を根拠に確定したかの実体。`qa_ref` が主たる接地根拠、`qa_refs` がそれを支える裏付け質疑であり、いずれも qa_log (spec-state.json) の逐語である。ここに現れない主張は本章の確定内容ではない。

### Web (web)

- 資するゴール: G4

#### 主たる接地根拠: `qa-guide-security-web-001`

**問**

使い方画面と共通シェルの変更で何を守るか。

**答**

/api/guide は authGuard 配下で userId の Dataset だけを読み、期間クエリは既存の resolvePeriodQuery に通して壊れた指定を全期間に倒す (400 にしない既存方針)。ガイド内検索は画面内の定数だけを対象にしてサーバへ送らない。フッタは『取込データは外部送信しません』と明細を送らない事実に限定し、AI 実行時に確認した集計データを選択した AI へ渡す事実を 3 か所で必ず読めるようにする (表示を事実どおりに保つ)。CSP は変えない。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: 利用者承認 (appr-foundation-guide-001) と決定 qa-guide-decision-001〜007 の範囲に収まる確定内容。利用者が決めていない具体値は除き、同カテゴリの -003 (agent-inference) に分けた。 / 回答時刻: 2026-09-23T12:37:28Z)

#### 裏付け質疑: `qa-guide-security-web-evidence-001`

**問**

security 章の裏付けとして、現行実装について何を観測したか。

**答**

全応答に secureHeaders の CSP (default-src 'self'、frame-ancestors 'none'、connect-src 'self') が掛かる (packages/api/src/index.ts:58-75)。業務 API は authGuard 配下で userId を条件に読む (loadScoped が c.get('userId') を渡す、analytics.ts:105)。AI 分析は外部 AI エージェントが使い捨てトークンで集計データを取得する経路で、フッタの現行文言はこの事実を 1 文目に書いている (Layout.tsx:497)。

- (根拠の性質: コード・設定・公式文書で検証できる観測事実 / 出所: リポジトリの現物 (ファイルと行) を読んで記録した観測。answered_at は観測後に実測した時刻。 / 回答時刻: 2026-09-23T12:37:28Z)

#### 裏付け質疑: `qa-guide-security-web-003`

**問**

使い方画面の検索・URL 保持で、利用者が決めていない具体を何にするか。

**答**

URL の topic は既知の節 id の列挙だけを受け、未知の値は『月次の流れ』に倒す。検索語 q は 100 字で切り、描画は React のテキストとして出して HTML として解釈しない。 これは agent の推定で、利用者は未確認である。

- (根拠の性質: アシスタントの推定 (利用者確認も検証可能な出典も経ていない) / 出所: agent が仕様を決定論にするため補った値。利用者の確認は受けていない。 / 回答時刻: 2026-09-23T12:37:28Z)

## To-Be / Delta

> 本章の**規範**。上位概念 (要件定義書 U3 ゴール / U4 目標 / U9 具体的やりたいこと) を本章の serves_goals で絞り込んだ射影であり、設計知識 card (非規範の参考資料) とは役割が異なる。As-Is (現行実装の姿) は spec-state.json の管轄外のため本節では断定せず、到達点と、その到達を判定する観測点だけを規範として置く。

### 到達すべき状態 (To-Be)

- **G4**: 共通シェルのフッタを画像に合わせつつ、表示を事実どおりに保つ。ヘッダは『防衛ライン』のまま (画像の『取引ライン』には合わせない)、フッタ 1 文目は『取込データは外部送信しません』とし、AI 実行時に集計データを渡す事実を補足で必ず見せる。ガイドの API は利用者ごとに分離し、他人の数値を返さない。

### 受入条件 (Delta の判定点)

| 目標 | 到達点 | 達成の観測点 (measure) |
|---|---|---|
| O4 | 既存の品質ゲートを緑のまま保つ。 | pnpm lint・typecheck・test・skills:test・初期 JS 予算・verify:full が全て exit 0。 |
| O5 | 使い方の API が利用者ごとに分離され、AI 送信の補足が 3 か所で読める。 | 他の利用者のセッションで /api/guide がこの利用者の数値を 1 つも返さないことを API テストで確かめ、AI 実行時に集計データを渡す補足がフッタの title・プライバシー欄・使い方画面の 3 か所にあることを DOM テストで確かめ、いずれも通る。 |

### 本章がかなえる具体的やりたいこと (U9)

- **I3**: GET /api/guide を追加し、選択期間の総収入・総支出・純収支 (振替除外)・最終更新・データの出所を core の guide-screen で JSON に写す。利用者ごとに分離し期間クエリを検証する。
- **I6**: 共通シェルのフッタ 1 文目を『取込データは外部送信しません』に変え、AI 送信の補足を 3 か所に置く。ヘッダの『防衛ライン』は変えない。common-shell のテストを更新する。

### 本章に効く確定意思決定

- (本章ゴールに効く確定 decision なし)

## 適用された設計知識

> 以下の deep knowledge card は設計判断を支援する**非規範の参考資料**であり、実装済み・検証済みの証拠ではない。カード内の `採否: applied` は設計採用を意味し、実装状態は意味しない。規範となる差分は本章の To-Be / Delta 節と参照先仕様で管理する。

### 本章での適用

Secure by Design card の『入力の境界を許可リストで閉じる』を、使い方画面の URL と検索に適用した。topic は既知の節 id の列挙だけを受け、q は 100 字で切ってテキストとして描き、期間は既存の resolvePeriodQuery に通して壊れた指定を全期間に倒す。検索はサーバへ送らないので、検索語が記録に残る経路を持たない。

- (根拠の性質: アシスタントの推定 (利用者確認も検証可能な出典も経ていない) / 記録時刻: 2026-09-23T12:41:26Z)

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
| owasp-asvs | 5.0.0 | OWASP Foundation (github.com) | https://github.com/OWASP/ASVS/blob/master/README.md | 2026-09-23T12:39:53Z | 2026-09-23T12:39:53Z |
