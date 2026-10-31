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
| Web (web) | 確定 | 確定質疑: qa-budget-auth-web-001。資するゴール: G3 |
| モバイル (mobile) | 対象外 | 理由: スマートフォン向け専用アプリを提供していたなら、認証・認可ではスマートフォンの生体認証やトークン保管をどう組み込むかを決める必要があった。対象を web のみとする利用者決定 (qa-budget-target-platforms-001) によりその検討は発生しない。 |
| タブレット (tablet) | 対象外 | 理由: タブレット向け専用アプリを提供していたなら、認証・認可では共有されがちなタブレットで利用者の切替えをどう扱うかを決める必要があった。対象を web のみとする利用者決定 (qa-budget-target-platforms-001) によりその検討は発生しない。 |
| デスクトップ (Windows) (desktop-windows) | 対象外 | 理由: Windows 向けデスクトップアプリを提供していたなら、認証・認可ではWindows の資格情報マネージャにセッションをどう保存するかを決める必要があった。対象を web のみとする利用者決定 (qa-budget-target-platforms-001) によりその検討は発生しない。 |
| デスクトップ (Linux) (desktop-linux) | 対象外 | 理由: Linux 向けデスクトップアプリを提供していたなら、認証・認可ではLinux のキーリングにセッションをどう保存するかを決める必要があった。対象を web のみとする利用者決定 (qa-budget-target-platforms-001) によりその検討は発生しない。 |
| デスクトップ (macOS) (desktop-macos) | 対象外 | 理由: macOS 向けデスクトップアプリを提供していたなら、認証・認可ではmacOS のキーチェーンにセッションをどう保存するかを決める必要があった。対象を web のみとする利用者決定 (qa-budget-target-platforms-001) によりその検討は発生しない。 |

## 上流指針 (doctrine anchors)

> 本章の設計判断が従う上流の正本 (1 concern 1 authority)。具体技術ではなく上流工程を導く規範であり、下位の技術選定は本節と矛盾してはならない。正本: `ref-system-design-knowledge/references/doctrine-anchor-registry.json`

| 設計 concern | 上流の正本 (authority) | 導く範囲 | 出典 | 最終確認 | 本章の確定セルへの反映 |
|---|---|---|---|---|---|
| authentication | OWASP ASVS + Secrets Management Cheat Sheet | 認証方式・セッション・資格情報/シークレット/API キーの取扱いの上流指針 | https://owasp.org/www-project-application-security-verification-standard/ | 2026-07-12 | 予算画面では新しいログイン経路を足さず、既存のセッション Cookie と session_generation による無効化にそのまま乗せる形へ反映した。パスワード変更が必要な利用者は mustChangePasswordFence で予算の保存に届かない。 |
| security | OWASP ASVS + Secrets Management Cheat Sheet | 脅威モデル・入力検証・暗号化・監査ログの上流指針 | https://owasp.org/www-project-application-security-verification-standard/ | 2026-07-12 | 予算画面の認可では、予算の取得と保存の全 SQL を利用者で区切り、利用者 id を要求の本文から受け取らない形へ反映した。ログアウトで端末の予算の下書きも消し、共有端末に他人の入力を残さない。 |

## 確定内容 (質疑録)

> 本章の各確定セルが何を根拠に確定したかの実体。`qa_ref` が主たる接地根拠、`qa_refs` がそれを支える裏付け質疑であり、いずれも qa_log (spec-state.json) の逐語である。ここに現れない主張は本章の確定内容ではない。

### Web (web)

- 資するゴール: G3

#### 主たる接地根拠: `qa-budget-auth-web-001`

**問**

web の予算画面の認証・認可要件は何か。

**答**

新しい認証方式は作らない。予算画面の取得と保存の API は /api/* の authGuard と mustChangePasswordFence の内側に置き、利用者 id はセッションから取り、要求の本文や URL からは受け取らない。予算の表は利用者で区切り、他の利用者の予算を読み書きできない。下書きは端末の localStorage に置くため、保存成功とログアウトで消す (qa-budget-decision-001)。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: 利用者が正本として指示した画像 design/FINAL-UI/images/14-budget.png と、利用者承認 (appr-foundation-budget-001) の U1-U9、決定 qa-budget-decision-001〜004 から、利用者が決めていない具体値を除いて書き起こした要件。除いた値は同じ章の -002 (agent-inference) に分けた。 / 回答時刻: 2026-09-21T13:35:48Z)

## To-Be / Delta

> 本章の**規範**。上位概念 (要件定義書 U3 ゴール / U4 目標 / U9 具体的やりたいこと) を本章の serves_goals で絞り込んだ射影であり、設計知識 card (非規範の参考資料) とは役割が異なる。As-Is (現行実装の姿) は spec-state.json の管轄外のため本節では断定せず、到達点と、その到達を判定する観測点だけを規範として置く。

### 到達すべき状態 (To-Be)

- **G3**: 予算を予算対象の 12 か月 (開始月 YYYY-MM) ごとに科目別の年額・計画による調整額・調整の理由で保存する表を D1 に追加のみの migration で設け、同じ期間は上書きし版は持たない。保存済みの行が無い期間を開いたときは既存 budgets の月額 × 12 を初期値として示す (既存行は書き換えない)。GET /api/budget-plans?start=YYYY-MM と PUT /api/budget-plans を設け、PUT は canonicalMutationFence に登録する。診断の予算カバー率と予算の着地見込みなど既存の budgets の読み手は、今月を含む予算対象の年額 ÷ 12 を返す core の関数を経由して同じ値を読む。

### 受入条件 (Delta の判定点)

| 目標 | 到達点 | 達成の観測点 (measure) |
|---|---|---|
| O3 | 予算が期間ごとに保存され、既存の読み手が同じ値を読む。 | API 統合テストで、PUT が期間ごとに保存し同じ期間は上書きされ、未認証 401・フェンス違反の拒否・不正値の 400 を確かめる。migration が既存行を 1 行も書き換えないことを検査し、保存行の無い期間で既存月額 × 12 が初期値になること、診断の予算カバー率が新しい表の値から出ることを確かめる。 |

### 本章がかなえる具体的やりたいこと (U9)

- **I3**: 予算対象の期間別の年額表を追加のみの migration で設け、GET / PUT /api/budget-plans と fence 登録を行い、診断の予算カバー率など既存の budgets の読み手を同じ読み出し関数へ寄せる。

### 本章に効く確定意思決定

- **dec-budget-storage-unit**: 予算の保存単位をどうするか (期間を持たない科目別の月額 1 つか、予算対象の 12 か月ごとの年額か)。
  - 採択: 期間別の年額表を追加 (`opt-period-annual-table`)
  - 目的適合: 画像の予算対象 12 か月・年額入力と一致し、既存の月額を初期値に引き継げる。

## 適用された設計知識

> 以下の deep knowledge card は設計判断を支援する**非規範の参考資料**であり、実装済み・検証済みの証拠ではない。カード内の `採否: applied` は設計採用を意味し、実装状態は意味しない。規範となる差分は本章の To-Be / Delta 節と参照先仕様で管理する。

### 本章での適用

Least privilege と resource ownership の card を予算画面に適用した。新しい表は利用者を主キーの先頭に持たせ、route は WHERE user_id = ? を必ず付ける。他の利用者の予算は存在しないものとして扱い、保存も自分の予算対象の行だけを置き換える。

- (根拠の性質: アシスタントの推定 (利用者確認も検証可能な出典も経ていない) / 記録時刻: 2026-09-21T13:35:48Z)

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
