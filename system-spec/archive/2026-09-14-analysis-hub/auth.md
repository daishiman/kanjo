---
status: confirmed
category: auth
aggregate: 確定
spec_cells: [auth.web, auth.mobile, auth.tablet, auth.desktop-windows, auth.desktop-linux, auth.desktop-macos]
serves_goals: [G3]
---

# 認証(ログイン) (auth)

- カテゴリ集約状態: **確定**
- 章確定マーカー: `status: confirmed`

## カテゴリ別収集状態

| プラットフォーム | 状態 | 根拠 |
|---|---|---|
| Web (web) | 確定 | 確定質疑: qa-auth-web-ah-observed-001。資するゴール: G3 |
| モバイル (mobile) | 対象外 | 理由: スマートフォン向け専用アプリ (iOS/Android)を提供していたなら、本カテゴリではOS の生体認証やキーチェーンと利用者セッションをどう結ぶかを決める必要があった。狭幅は既存 web のアイコンレールと下部タブのレスポンシブ表示の中で扱う。対象を web のみとする利用者決定 (qa-target-platforms-ah-001 / appr-foundation-analysis-hub-001、2026-09-14) によりその検討は発生しない。 |
| タブレット (tablet) | 対象外 | 理由: タブレット向け専用アプリ (iPadOS/Android)を提供していたなら、本カテゴリではOS の生体認証やキーチェーンと利用者セッションをどう結ぶかを決める必要があった。狭幅は既存 web のアイコンレールと下部タブのレスポンシブ表示の中で扱う。対象を web のみとする利用者決定 (qa-target-platforms-ah-001 / appr-foundation-analysis-hub-001、2026-09-14) によりその検討は発生しない。 |
| デスクトップ (Windows) (desktop-windows) | 対象外 | 理由: Windows デスクトップアプリを提供していたなら、本カテゴリではOS の生体認証やキーチェーンと利用者セッションをどう結ぶかを決める必要があった。狭幅は既存 web のアイコンレールと下部タブのレスポンシブ表示の中で扱う。対象を web のみとする利用者決定 (qa-target-platforms-ah-001 / appr-foundation-analysis-hub-001、2026-09-14) によりその検討は発生しない。 |
| デスクトップ (Linux) (desktop-linux) | 対象外 | 理由: Linux デスクトップアプリを提供していたなら、本カテゴリではOS の生体認証やキーチェーンと利用者セッションをどう結ぶかを決める必要があった。狭幅は既存 web のアイコンレールと下部タブのレスポンシブ表示の中で扱う。対象を web のみとする利用者決定 (qa-target-platforms-ah-001 / appr-foundation-analysis-hub-001、2026-09-14) によりその検討は発生しない。 |
| デスクトップ (macOS) (desktop-macos) | 対象外 | 理由: macOS デスクトップアプリを提供していたなら、本カテゴリではOS の生体認証やキーチェーンと利用者セッションをどう結ぶかを決める必要があった。狭幅は既存 web のアイコンレールと下部タブのレスポンシブ表示の中で扱う。対象を web のみとする利用者決定 (qa-target-platforms-ah-001 / appr-foundation-analysis-hub-001、2026-09-14) によりその検討は発生しない。 |

## 上流指針 (doctrine anchors)

> 本章の設計判断が従う上流の正本 (1 concern 1 authority)。具体技術ではなく上流工程を導く規範であり、下位の技術選定は本節と矛盾してはならない。正本: `ref-system-design-knowledge/references/doctrine-anchor-registry.json`

| 設計 concern | 上流の正本 (authority) | 導く範囲 | 出典 | 最終確認 | 本章の確定セルへの反映 |
|---|---|---|---|---|---|
| authentication | OWASP ASVS + Secrets Management Cheat Sheet | 認証方式・セッション・資格情報/シークレット/API キーの取扱いの上流指針 | https://owasp.org/www-project-application-security-verification-standard/ | 2026-07-12 | OWASP ASVS の『全ての保護資源で認証を強制する』を、ハブ API を既存 /api/* の authGuard 配下へマウントする確定内容に反映した。新しい認証経路・トークン・セッション方式は作らず、アカウントログイン (PR #47) のセッションをそのまま使う。 |
| security | OWASP ASVS + Secrets Management Cheat Sheet | 脅威モデル・入力検証・暗号化・監査ログの上流指針 | https://owasp.org/www-project-application-security-verification-standard/ | 2026-07-12 | OWASP ASVS のアクセス制御 (他利用者のデータに触れない) を、ハブ API の全ての読取りを userId で絞る確定内容に反映した。共有された ?focus= 付き URL を他人が開いても、認証を通った本人のデータしか集計されない。 |

> **未記入** の行は、上流の正本を掲げただけで本章の確定内容へ反映した箇所を示せていない。表への出現は反映の証拠ではない。

## 確定内容 (質疑録)

> 本章の各確定セルが何を根拠に確定したかの実体。`qa_ref` が主たる接地根拠、`qa_refs` がそれを支える裏付け質疑であり、いずれも qa_log (spec-state.json) の逐語である。ここに現れない主張は本章の確定内容ではない。

### Web (web)

- 資するゴール: G3

#### 主たる接地根拠: `qa-auth-web-ah-observed-001`

**問**

ハブ API とハブ画面の認証・認可はどうなるか。

**答**

利用者アカウント (メールアドレス + パスワード、PR #47) のセッションで認証する。packages/api/src/index.ts は /api/* に authGuard() と mustChangePasswordFence() を掛け、c.get('userId') で利用者を特定する。新設 GET /api/analysis/hub は analyticsRoute 等と同じくこのミドルウェアの後にマウントし、全ての読み取りを userId で絞る (他利用者のデータを返さない)。画面は AuthenticatedApp.tsx 配下で、未認証は既存どおりログインへ送られる。認証方式・セッション・レート制限の変更は無い。

- (根拠の性質: コード・設定・公式文書で検証できる観測事実 / 出所: アシスタントが 2026-09-14 にリポジトリ (HEAD 2162fd2) の該当ファイルを読んで確認した観測事実。answered_at は確認直後に date -u で実測した時刻。 対象: packages/api/src/{index.ts,auth.ts,users.ts}, packages/web/src/AuthenticatedApp.tsx。 / 回答時刻: 2026-09-14T11:38:26Z)

## To-Be / Delta

> 本章の**規範**。上位概念 (要件定義書 U3 ゴール / U4 目標 / U9 具体的やりたいこと) を本章の serves_goals で絞り込んだ射影であり、設計知識 card (非規範の参考資料) とは役割が異なる。As-Is (現行実装の姿) は spec-state.json の管轄外のため本節では断定せず、到達点と、その到達を判定する観測点だけを規範として置く。

### 到達すべき状態 (To-Be)

- **G3**: ハブに必要な集計を packages/core の純関数と、1 回で返す集約 API (GET /analysis/hub) に置く。期間の収支サマリーと前 12 か月比、5 視点それぞれの現在の状態 (照合の要確認件数・総収支の重複候補件数・マトリクスの正常判定・推移の支出前 12 か月比・診断の改善余地) と優先度を返し、ハブ表示中に 5 タブ分の既存 API を呼ばない。

### 受入条件 (Delta の判定点)

| 目標 | 到達点 | 達成の観測点 (measure) |
|---|---|---|
| O3 | core に analysisHub(dataset) 相当の純関数を置き、API に GET /analysis/hub を足す。 | core 単体テストが期間合計・前 12 か月比 (前期間データ無しは null)・5 視点の状態・優先度・改善余地を固定データで検証し、API 統合テストが認証付きで 200 と期間メタを返し、ハブ表示中の DOM テストで既存 5 API への呼出しが 0 件である。 |

### 本章がかなえる具体的やりたいこと (U9)

- **I3**: 期間の収支サマリーに総収入・総支出・純収支と前 12 か月比 (増減率と前期間の金額) を出し、純収支の説明パネルを右に置く。前期間データが無い場合は比較を『比較データなし』と表示する。
- **I4**: core にハブ集計関数を置き、GET /analysis/hub が期間メタ・サマリー・5 視点の状態・優先度を返す。前期間の計算は core へ移し AI 側もそれを使う。

### 本章に効く確定意思決定

- (本章ゴールに効く確定 decision なし)

## 適用された設計知識

> 以下の deep knowledge card は設計判断を支援する**非規範の参考資料**であり、実装済み・検証済みの証拠ではない。カード内の `採否: applied` は設計採用を意味し、実装状態は意味しない。規範となる差分は本章の To-Be / Delta 節と参照先仕様で管理する。

### 本章での適用

Secure by Design card の『既定で拒否し、境界で一度だけ判定する』を、ハブ API の認可に適用した。GET /api/analysis/hub は /api/* の authGuard と mustChangePasswordFence の後にマウントし、route 内では c.get('userId') で loadDataset と freee 系 3 テーブルを絞る以外の認可判断を持たない。サイドバーのバッジが全画面でこの API を呼んでも (qa-frontend-web-ah-decision-003)、未認証の画面ではバッジ用のクエリ自体を張らず、認証の判断を表示部品へ移さない。

- (根拠の性質: アシスタントの推定 (利用者確認も検証可能な出典も経ていない) / 記録時刻: 2026-09-14T11:57:54Z)

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

- (このカテゴリに割り当てた取得済みドキュメントなし。全体出典は index.md 参照)
