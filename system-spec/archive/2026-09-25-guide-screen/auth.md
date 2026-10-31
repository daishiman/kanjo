---
status: confirmed
category: auth
aggregate: 確定
spec_cells: [auth.web, auth.mobile, auth.tablet, auth.desktop-windows, auth.desktop-linux, auth.desktop-macos]
serves_goals: [G4]
---

# 認証(ログイン) (auth)

- カテゴリ集約状態: **確定**
- 章確定マーカー: `status: confirmed`

## カテゴリ別収集状態

| プラットフォーム | 状態 | 根拠 |
|---|---|---|
| Web (web) | 確定 | 確定質疑: qa-guide-auth-web-001。裏付け質疑 (`qa_refs`): `qa-guide-auth-web-evidence-001` — 本章の「確定内容 (質疑録)」へ接地根拠として併記。資するゴール: G4 |
| モバイル (mobile) | 対象外 | 理由: スマートフォン向け専用アプリを提供していたなら、auth では端末の生体認証やOSの資格情報ストアと既存セッションの結び付けを決める必要があった。対象を web のみとする利用者決定 (qa-guide-target-platforms-001) によりその検討は発生しない。 |
| タブレット (tablet) | 対象外 | 理由: タブレット向け専用アプリを提供していたなら、auth では端末の生体認証やOSの資格情報ストアと既存セッションの結び付けを決める必要があった。対象を web のみとする利用者決定 (qa-guide-target-platforms-001) によりその検討は発生しない。 |
| デスクトップ (Windows) (desktop-windows) | 対象外 | 理由: Windows 向けデスクトップアプリを提供していたなら、auth では端末の生体認証やOSの資格情報ストアと既存セッションの結び付けを決める必要があった。対象を web のみとする利用者決定 (qa-guide-target-platforms-001) によりその検討は発生しない。 |
| デスクトップ (Linux) (desktop-linux) | 対象外 | 理由: Linux 向けデスクトップアプリを提供していたなら、auth では端末の生体認証やOSの資格情報ストアと既存セッションの結び付けを決める必要があった。対象を web のみとする利用者決定 (qa-guide-target-platforms-001) によりその検討は発生しない。 |
| デスクトップ (macOS) (desktop-macos) | 対象外 | 理由: macOS 向けデスクトップアプリを提供していたなら、auth では端末の生体認証やOSの資格情報ストアと既存セッションの結び付けを決める必要があった。対象を web のみとする利用者決定 (qa-guide-target-platforms-001) によりその検討は発生しない。 |

## 上流指針 (doctrine anchors)

> 本章の設計判断が従う上流の正本 (1 concern 1 authority)。具体技術ではなく上流工程を導く規範であり、下位の技術選定は本節と矛盾してはならない。正本: `ref-system-design-knowledge/references/doctrine-anchor-registry.json`

| 設計 concern | 上流の正本 (authority) | 導く範囲 | 出典 | 最終確認 | 本章の確定セルへの反映 |
|---|---|---|---|---|---|
| authentication | OWASP ASVS + Secrets Management Cheat Sheet | 認証方式・セッション・資格情報/シークレット/API キーの取扱いの上流指針 | https://owasp.org/www-project-application-security-verification-standard/ | 2026-07-12 | /api/guide も既存のセッション Cookie (HttpOnly・Secure・SameSite=Strict) の認証だけで通す形へ反映した。使い方画面のために新しい資格情報やトークンを発行しない。 |
| security | OWASP ASVS + Secrets Management Cheat Sheet | 脅威モデル・入力検証・暗号化・監査ログの上流指針 | https://owasp.org/www-project-application-security-verification-standard/ | 2026-07-12 | 一時パスワードの利用者は mustChangePasswordFence で /api/guide にも届かず、未ログインの共通シェルは既存の locked 表示のままにする形へ反映した。 |

## 確定内容 (質疑録)

> 本章の各確定セルが何を根拠に確定したかの実体。`qa_ref` が主たる接地根拠、`qa_refs` がそれを支える裏付け質疑であり、いずれも qa_log (spec-state.json) の逐語である。ここに現れない主張は本章の確定内容ではない。

### Web (web)

- 資するゴール: G4

#### 主たる接地根拠: `qa-guide-auth-web-001`

**問**

新しい /api/guide を誰に許すか。

**答**

既存のセッション認証 (authGuard と mustChangePasswordFence の配下、HttpOnly・SameSite=Strict の Cookie) をそのまま使い、/api/guide も /api/* に置いて userId の Dataset だけを読む。未ログイン時の共通シェルは既存の locked 表示のまま。新しい権限や役割は作らない (単一利用者の運用)。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: 利用者承認 (appr-foundation-guide-001) と決定 qa-guide-decision-001〜007 の範囲に収まる確定内容。利用者が決めていない具体値は除き、同カテゴリの -003 (agent-inference) に分けた。 / 回答時刻: 2026-09-23T12:37:28Z)

#### 裏付け質疑: `qa-guide-auth-web-evidence-001`

**問**

auth 章の裏付けとして、現行実装について何を観測したか。

**答**

/api/* は packages/api/src/index.ts:106 の authGuard() 配下で、一時パスワードの利用者は mustChangePasswordFence で業務データに触れない (index.ts:108)。セッション Cookie は HttpOnly・Secure・SameSite=Strict (packages/api/src/auth.ts:129-131)。AI エージェントと改善要望のエージェントは依頼ごとの使い捨てトークンで別経路 (index.ts:100-103) に置かれる。

- (根拠の性質: コード・設定・公式文書で検証できる観測事実 / 出所: リポジトリの現物 (ファイルと行) を読んで記録した観測。answered_at は観測後に実測した時刻。 / 回答時刻: 2026-09-23T12:37:28Z)

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

Secure by Design card の『既定で拒否し、境界で一度だけ判定する』を、新しい /api/guide の置き場所に適用した。経路を authGuard と mustChangePasswordFence の配下の /api/* に置き、loadScoped が渡す userId の Dataset だけを読むので、経路の中で利用者の判定を書き直さない。

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
| mdn-set-cookie | 2026-09-01 | Mozilla (MDN Web Docs) (developer.mozilla.org) | https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Set-Cookie | 2026-09-23T12:39:53Z | 2026-09-23T12:39:53Z |
