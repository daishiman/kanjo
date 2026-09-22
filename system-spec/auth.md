---
status: confirmed
category: auth
aggregate: 確定
spec_cells: [auth.web, auth.mobile, auth.tablet, auth.desktop-windows, auth.desktop-linux, auth.desktop-macos]
serves_goals: [G5]
---

# 認証(ログイン) (auth)

- カテゴリ集約状態: **確定**
- 章確定マーカー: `status: confirmed`

## カテゴリ別収集状態

| プラットフォーム | 状態 | 根拠 |
|---|---|---|
| Web (web) | 確定 | 確定質疑: qa-tradeoff-auth-web-001。裏付け質疑 (`qa_refs`): `qa-tradeoff-auth-web-evidence-001` — 本章の「確定内容 (質疑録)」へ接地根拠として併記。資するゴール: G5 |
| モバイル (mobile) | 対象外 | 理由: スマートフォン向け専用アプリを提供していたなら、auth では端末の生体認証で試算を開く規則とトークンの保管場所を決める必要があった。対象を web のみとする利用者決定 (qa-tradeoff-target-platforms-001) によりその検討は発生しない。 |
| タブレット (tablet) | 対象外 | 理由: タブレット向け専用アプリを提供していたなら、auth では家族で共有するタブレットの利用者切替の規則を決める必要があった。対象を web のみとする利用者決定 (qa-tradeoff-target-platforms-001) によりその検討は発生しない。 |
| デスクトップ (Windows) (desktop-windows) | 対象外 | 理由: Windows 向けデスクトップアプリを提供していたなら、auth ではWindows の資格情報マネージャへのトークン保管を決める必要があった。対象を web のみとする利用者決定 (qa-tradeoff-target-platforms-001) によりその検討は発生しない。 |
| デスクトップ (Linux) (desktop-linux) | 対象外 | 理由: Linux 向けデスクトップアプリを提供していたなら、auth ではLinux の鍵束へのトークン保管を決める必要があった。対象を web のみとする利用者決定 (qa-tradeoff-target-platforms-001) によりその検討は発生しない。 |
| デスクトップ (macOS) (desktop-macos) | 対象外 | 理由: macOS 向けデスクトップアプリを提供していたなら、auth ではmacOS のキーチェーンへのトークン保管を決める必要があった。対象を web のみとする利用者決定 (qa-tradeoff-target-platforms-001) によりその検討は発生しない。 |

## 上流指針 (doctrine anchors)

> 本章の設計判断が従う上流の正本 (1 concern 1 authority)。具体技術ではなく上流工程を導く規範であり、下位の技術選定は本節と矛盾してはならない。正本: `ref-system-design-knowledge/references/doctrine-anchor-registry.json`

| 設計 concern | 上流の正本 (authority) | 導く範囲 | 出典 | 最終確認 | 本章の確定セルへの反映 |
|---|---|---|---|---|---|
| authentication | OWASP ASVS + Secrets Management Cheat Sheet | 認証方式・セッション・資格情報/シークレット/API キーの取扱いの上流指針 | https://owasp.org/www-project-application-security-verification-standard/ | 2026-07-12 | 上書きの保存経路を含む新しい経路をすべて authGuard と mustChangePasswordFence の内側に置く形へ反映した。パスワード変更が要る利用者は試算を保存できない。 |
| security | OWASP ASVS + Secrets Management Cheat Sheet | 脅威モデル・入力検証・暗号化・監査ログの上流指針 | https://owasp.org/www-project-application-security-verification-standard/ | 2026-07-12 | 認可を user_id の一致だけで判定し、上書きの行と試算の行はどちらも作成者の user_id を鍵に持つ形へ反映した。他人の candidate_key を指定しても自分の行としてしか保存されない。 |

## 確定内容 (質疑録)

> 本章の各確定セルが何を根拠に確定したかの実体。`qa_ref` が主たる接地根拠、`qa_refs` がそれを支える裏付け質疑であり、いずれも qa_log (spec-state.json) の逐語である。ここに現れない主張は本章の確定内容ではない。

### Web (web)

- 資するゴール: G5

#### 主たる接地根拠: `qa-tradeoff-auth-web-001`

**問**

web のトレードオフ画面の認証と認可をどうするか。

**答**

新しい認証方式は作らない。GET / POST /api/tradeoff と上書きの保存 API はすべて /api/* の authGuard・mustChangePasswordFence・runtimeSchemaGuard・canonicalMutationFence の内側に置き、利用者は Cookie のセッションで識別する。読み書きはすべて c.get('userId') の user_id に絞り、他の利用者の試算と上書きは読めず書けない。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: 利用者承認 (appr-foundation-tradeoff-001) と決定 qa-tradeoff-decision-001〜009 の範囲に収まる確定内容。利用者が決めていない具体値は除き、同カテゴリの -003 (agent-inference) に分けた。 / 回答時刻: 2026-09-21T15:19:22Z)

#### 裏付け質疑: `qa-tradeoff-auth-web-evidence-001`

**問**

auth 章の裏付けとして、現行のトレードオフ画面まわりについて何を観測したか。

**答**

packages/api/src/index.ts:104-108 で /api/* に authGuard → mustChangePasswordFence → runtimeSchemaGuard → canonicalMutationFence が掛かり、analyticsRoute (index.ts:116) はその内側にある。GET / POST /api/tradeoff (routes/analytics.ts:759-821) は c.get('userId') で user_id を取り、読み書きをその利用者に絞っている。

- (根拠の性質: コード・設定・公式文書で検証できる観測事実 / 出所: リポジトリの現物 (ファイルと行) を読んで記録した観測 / 回答時刻: 2026-09-21T15:19:22Z)

## To-Be / Delta

> 本章の**規範**。上位概念 (要件定義書 U3 ゴール / U4 目標 / U9 具体的やりたいこと) を本章の serves_goals で絞り込んだ射影であり、設計知識 card (非規範の参考資料) とは役割が異なる。As-Is (現行実装の姿) は spec-state.json の管轄外のため本節では断定せず、到達点と、その到達を判定する観測点だけを規範として置く。

### 到達すべき状態 (To-Be)

- **G5**: 試算条件と候補ごとの上書きを安全に記録する。『この条件で試算』を押すたびに条件 (支出名・金額・単発 / 毎月・開始月・メモ・選んだ候補・差額) を既存 tradeoff_plans へ履歴として追加し、画面は最新の 1 件を復元する。保存一覧と翌月の突合は画面から外すが、既存の行と突合の関数は消さない。列と表は追加のみの migration で足し、入力は zod で検証し文字数に上限を設け、利用者ごとに分離する。

### 受入条件 (Delta の判定点)

| 目標 | 到達点 | 達成の観測点 (measure) |
|---|---|---|
| O5 | 試算条件と上書きの記録が追加のみで安全に行われる。 | migration が CREATE TABLE / ALTER TABLE ADD COLUMN だけで、api テストで zod の上限・認証・利用者分離・最新 1 件の復元を検査し、既存の tradeoff_plans の行と tradeoffReview の契約テストが緑のままである。 |

### 本章がかなえる具体的やりたいこと (U9)

- **I3**: core に科目×取引先の候補集計・推移・必要度・自動の理由を新設し、上書きの新表と保存 API を足す。
- **I5**: tradeoff_plans に開始月・メモ列を足し、POST で履歴を追加、GET で最新 1 件を返して画面で復元する。保存一覧と突合の表示を外す。

### 本章に効く確定意思決定

- (本章ゴールに効く確定 decision なし)

## 適用された設計知識

> 以下の deep knowledge card は設計判断を支援する**非規範の参考資料**であり、実装済み・検証済みの証拠ではない。カード内の `採否: applied` は設計採用を意味し、実装状態は意味しない。規範となる差分は本章の To-Be / Delta 節と参照先仕様で管理する。

### 本章での適用

既存のセッション認証を再利用する原則を適用した。トレードオフ画面の新しい経路 (上書きの保存) も /api/* のガード連鎖の内側に置き、認証済みの user_id だけを鍵に読み書きする。新しい資格情報や共有リンクを作らないので、試算と上書きが他の利用者に漏れる経路が増えない。

- (根拠の性質: アシスタントの推定 (利用者確認も検証可能な出典も経ていない) / 記録時刻: 2026-09-21T15:19:22Z)

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
