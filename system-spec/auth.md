---
status: confirmed
category: auth
aggregate: 確定
spec_cells: [auth.web, auth.mobile, auth.tablet, auth.desktop-windows, auth.desktop-linux, auth.desktop-macos]
serves_goals: [G2]
---

# 認証(ログイン) (auth)

- カテゴリ集約状態: **確定**
- 章確定マーカー: `status: confirmed`

## カテゴリ別収集状態

| プラットフォーム | 状態 | 根拠 |
|---|---|---|
| Web (web) | 確定 | 確定質疑: qa-auth-web-ds-observed-001。資するゴール: G2 |
| モバイル (mobile) | 対象外 | 理由: スマートフォン向け専用アプリ (iOS/Android)を提供していたなら、本カテゴリではログイン画面の共通シェルを OS の認証 UI (生体認証・キーチェーン連携) とどう組み合わせるかを決める必要があった。本サイクルは既存 web のログイン画面をサイドバー・ヘッダーと同じ骨格に揃えるだけで、認証方式を変えない。対象を web のみとする利用者決定 (qa-target-platforms-ds-001 / appr-foundation-design-system-001、2026-09-13) によりその検討は発生しない。 |
| タブレット (tablet) | 対象外 | 理由: タブレット向け専用アプリを提供していたなら、本カテゴリではログイン画面の共通シェルを OS の認証 UI (生体認証・キーチェーン連携) とどう組み合わせるかを決める必要があった。本サイクルは既存 web のログイン画面をサイドバー・ヘッダーと同じ骨格に揃えるだけで、認証方式を変えない。対象を web のみとする利用者決定 (qa-target-platforms-ds-001 / appr-foundation-design-system-001、2026-09-13) によりその検討は発生しない。 |
| デスクトップ (Windows) (desktop-windows) | 対象外 | 理由: Windows 向けデスクトップアプリを提供していたなら、本カテゴリではログイン画面の共通シェルを OS の認証 UI (生体認証・キーチェーン連携) とどう組み合わせるかを決める必要があった。本サイクルは既存 web のログイン画面をサイドバー・ヘッダーと同じ骨格に揃えるだけで、認証方式を変えない。対象を web のみとする利用者決定 (qa-target-platforms-ds-001 / appr-foundation-design-system-001、2026-09-13) によりその検討は発生しない。 |
| デスクトップ (Linux) (desktop-linux) | 対象外 | 理由: Linux 向けデスクトップアプリを提供していたなら、本カテゴリではログイン画面の共通シェルを OS の認証 UI (生体認証・キーチェーン連携) とどう組み合わせるかを決める必要があった。本サイクルは既存 web のログイン画面をサイドバー・ヘッダーと同じ骨格に揃えるだけで、認証方式を変えない。対象を web のみとする利用者決定 (qa-target-platforms-ds-001 / appr-foundation-design-system-001、2026-09-13) によりその検討は発生しない。 |
| デスクトップ (macOS) (desktop-macos) | 対象外 | 理由: macOS 向けデスクトップアプリを提供していたなら、本カテゴリではログイン画面の共通シェルを OS の認証 UI (生体認証・キーチェーン連携) とどう組み合わせるかを決める必要があった。本サイクルは既存 web のログイン画面をサイドバー・ヘッダーと同じ骨格に揃えるだけで、認証方式を変えない。対象を web のみとする利用者決定 (qa-target-platforms-ds-001 / appr-foundation-design-system-001、2026-09-13) によりその検討は発生しない。 |

## 上流指針 (doctrine anchors)

> 本章の設計判断が従う上流の正本 (1 concern 1 authority)。具体技術ではなく上流工程を導く規範であり、下位の技術選定は本節と矛盾してはならない。正本: `ref-system-design-knowledge/references/doctrine-anchor-registry.json`

| 設計 concern | 上流の正本 (authority) | 導く範囲 | 出典 | 最終確認 | 本章の確定セルへの反映 |
|---|---|---|---|---|---|
| authentication | OWASP ASVS + Secrets Management Cheat Sheet | 認証方式・セッション・資格情報/シークレット/API キーの取扱いの上流指針 | https://owasp.org/www-project-application-security-verification-standard/ | 2026-07-12 | OWASP ASVS の認証要件を、既存の authGuard とセッション発行を変えないという確定内容に反映した。共通シェル化はログイン画面の見た目だけを揃える。 |
| security | OWASP ASVS + Secrets Management Cheat Sheet | 脅威モデル・入力検証・暗号化・監査ログの上流指針 | https://owasp.org/www-project-application-security-verification-standard/ | 2026-07-12 | OWASP ASVS のアクセス制御の原則 (サーバ側で強制する) を、未認証時のメニューのロック表示を案内に留め、保護は /api/* の authGuard が担うという区別に反映した。 |

## 確定内容 (質疑録)

> 本章の各確定セルが何を根拠に確定したかの実体。`qa_ref` が主たる接地根拠、`qa_refs` がそれを支える裏付け質疑であり、いずれも qa_log (spec-state.json) の逐語である。ここに現れない主張は本章の確定内容ではない。

### Web (web)

- 資するゴール: G2

#### 主たる接地根拠: `qa-auth-web-ds-observed-001`

**問**

認証の方式と、共通シェルとの関係はどうなっているか。本サイクルで変わるか。

**答**

認証は packages/api/src/index.ts の authGuard が /api/* を保護し、/api/auth/login でアプリ内セッションを発行する (Cloudflare Access 併用時は Access を使う)。wrangler の run_worker_first: /api/* により API は必ず Worker を通る。本サイクルで認証方式は変えない。DESIGN-SYSTEM.md はログイン画面にも同じ幅・配置のサイドバーを出し、未認証時は業務メニューをロック表示してヘルプ・プライバシー・ログインだけを使えるようにすると定める。共通シェル部品はこの未認証表示を持つ必要がある。

- (根拠の性質: コード・設定・公式文書で検証できる観測事実 / 出所: packages/api/src/index.ts・packages/api/wrangler.jsonc・design/FINAL-UI/spec/DESIGN-SYSTEM.md をアシスタントが読んだ観測事実。 / 回答時刻: 2026-09-13T05:03:11Z)

## To-Be / Delta

> 本章の**規範**。上位概念 (要件定義書 U3 ゴール / U4 目標 / U9 具体的やりたいこと) を本章の serves_goals で絞り込んだ射影であり、設計知識 card (非規範の参考資料) とは役割が異なる。As-Is (現行実装の姿) は spec-state.json の管轄外のため本節では断定せず、到達点と、その到達を判定する観測点だけを規範として置く。

### 到達すべき状態 (To-Be)

- **G2**: route registry由来の20ルートを共通Layout/PageShellで描画する。標準操作はButtonを通し、固定アクション群を持つ画面はPageActionsを使う。ARIA固有controlはnative buttonの明示例外とする。

### 受入条件 (Delta の判定点)

| 目標 | 到達点 | 達成の観測点 (measure) |
|---|---|---|
| O3 | Layout・PageShell・PageActions・Buttonを共通部品として定義する。route registry由来の20ルートは共通シェルとPageShellを経由し、標準操作はButtonを使う。ARIA固有controlはnative buttonの例外とする。 | route registry由来のDOMテストが全ルートのランドマークとPageShellを検査し、静的検査が標準variant/submitを直接所有するnative buttonを拒否する。 |

### 本章がかなえる具体的やりたいこと (U9)

- **I2**: どの画面を開いても、左に同じネイビーのサイドバー (220px)、上に同じヘッダー (64px・期間 1年/2年/3年/任意)、下に同じフッターが出る。

### 本章に効く確定意思決定

- (本章ゴールに効く確定 decision なし)

## 適用された設計知識

> 以下の deep knowledge card は設計判断を支援する**非規範の参考資料**であり、実装済み・検証済みの証拠ではない。カード内の `採否: applied` は設計採用を意味し、実装状態は意味しない。規範となる差分は本章の To-Be / Delta 節と参照先仕様で管理する。

### 本章での適用

Secure by Design card の『既定で安全・失敗時は閉じる』を、ログイン画面の共通シェルに適用した。DESIGN-SYSTEM.md はログイン画面にも同じサイドバーを出すと定めるが、未認証時の業務メニューはロック表示にし、実際の保護は authGuard が /api/* で担う。見た目の部品がリンクを表示しても、認可の判断を部品側へ移さない — 表示のロックは案内であって防御ではない、という区別を本章の確定内容にした。

- (根拠の性質: アシスタントの推定 (利用者確認も検証可能な出典も経ていない) / 記録時刻: 2026-09-13T05:07:52Z)

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
