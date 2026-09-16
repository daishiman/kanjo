---
status: confirmed
category: auth
aggregate: 確定
spec_cells: [auth.web, auth.mobile, auth.tablet, auth.desktop-windows, auth.desktop-linux, auth.desktop-macos]
serves_goals: [G2, G4]
---

# 認証(ログイン) (auth)

- カテゴリ集約状態: **確定**
- 章確定マーカー: `status: confirmed`

## カテゴリ別収集状態

| プラットフォーム | 状態 | 根拠 |
|---|---|---|
| Web (web) | 確定 | 確定質疑: qa-auth-web-tc-observed-001。裏付け質疑 (`qa_refs`): `qa-total-cashflow-decision-004` — 本章の「確定内容 (質疑録)」へ接地根拠として併記。資するゴール: G2, G4 |
| モバイル (mobile) | 対象外 | 理由: スマートフォン向け専用アプリ (iOS/Android)を提供していたなら、本カテゴリでは端末に保存するセッションや生体認証で判定・取消の書込を許可する方式を決める必要があった。狭幅は既存 web のアイコンレールと下部タブのレスポンシブ表示の中で扱う。対象を web のみとする利用者承認 (qa-target-platforms-tc-002 / appr-foundation-total-cashflow-001、2026-09-15) によりその検討は発生しない。 |
| タブレット (tablet) | 対象外 | 理由: タブレット向け専用アプリ (iPadOS/Android)を提供していたなら、本カテゴリでは端末に保存するセッションや生体認証で判定・取消の書込を許可する方式を決める必要があった。狭幅は既存 web のアイコンレールと下部タブのレスポンシブ表示の中で扱う。対象を web のみとする利用者承認 (qa-target-platforms-tc-002 / appr-foundation-total-cashflow-001、2026-09-15) によりその検討は発生しない。 |
| デスクトップ (Windows) (desktop-windows) | 対象外 | 理由: Windows デスクトップアプリを提供していたなら、本カテゴリでは端末に保存するセッションや生体認証で判定・取消の書込を許可する方式を決める必要があった。狭幅は既存 web のアイコンレールと下部タブのレスポンシブ表示の中で扱う。対象を web のみとする利用者承認 (qa-target-platforms-tc-002 / appr-foundation-total-cashflow-001、2026-09-15) によりその検討は発生しない。 |
| デスクトップ (Linux) (desktop-linux) | 対象外 | 理由: Linux デスクトップアプリを提供していたなら、本カテゴリでは端末に保存するセッションや生体認証で判定・取消の書込を許可する方式を決める必要があった。狭幅は既存 web のアイコンレールと下部タブのレスポンシブ表示の中で扱う。対象を web のみとする利用者承認 (qa-target-platforms-tc-002 / appr-foundation-total-cashflow-001、2026-09-15) によりその検討は発生しない。 |
| デスクトップ (macOS) (desktop-macos) | 対象外 | 理由: macOS デスクトップアプリを提供していたなら、本カテゴリでは端末に保存するセッションや生体認証で判定・取消の書込を許可する方式を決める必要があった。狭幅は既存 web のアイコンレールと下部タブのレスポンシブ表示の中で扱う。対象を web のみとする利用者承認 (qa-target-platforms-tc-002 / appr-foundation-total-cashflow-001、2026-09-15) によりその検討は発生しない。 |

## 上流指針 (doctrine anchors)

> 本章の設計判断が従う上流の正本 (1 concern 1 authority)。具体技術ではなく上流工程を導く規範であり、下位の技術選定は本節と矛盾してはならない。正本: `ref-system-design-knowledge/references/doctrine-anchor-registry.json`

| 設計 concern | 上流の正本 (authority) | 導く範囲 | 出典 | 最終確認 | 本章の確定セルへの反映 |
|---|---|---|---|---|---|
| authentication | OWASP ASVS + Secrets Management Cheat Sheet | 認証方式・セッション・資格情報/シークレット/API キーの取扱いの上流指針 | https://owasp.org/www-project-application-security-verification-standard/ | 2026-07-12 | 総収支の新しい書込み API も既存のセッション認証 (authGuard) と初回パスワード変更の柵を通す位置にマウントし、総収支専用の認証経路を作らない形に反映した。 |
| security | OWASP ASVS + Secrets Management Cheat Sheet | 脅威モデル・入力検証・暗号化・監査ログの上流指針 | https://owasp.org/www-project-application-security-verification-standard/ | 2026-07-12 | 認可の単位を user_id に固定し、操作履歴の取消も user_id と id の組でしか引けない形に反映した。他人の操作 id を送った場合は存在の有無を返さず 404 にする。 |

> **未記入** の行は、上流の正本を掲げただけで本章の確定内容へ反映した箇所を示せていない。表への出現は反映の証拠ではない。

## 確定内容 (質疑録)

> 本章の各確定セルが何を根拠に確定したかの実体。`qa_ref` が主たる接地根拠、`qa_refs` がそれを支える裏付け質疑であり、いずれも qa_log (spec-state.json) の逐語である。ここに現れない主張は本章の確定内容ではない。

### Web (web)

- 資するゴール: G2, G4

#### 主たる接地根拠: `qa-auth-web-tc-observed-001`

**問**

総収支 API (読取・一括判定・除外・取消) と総収支画面の認証・認可はどうなるか。

**答**

利用者アカウント (メールアドレス + パスワード、PR #47、PBKDF2 は PR #52 で 100,000 回) のセッションで認証する。packages/api/src/index.ts は /api/* に authGuard() と mustChangePasswordFence() を掛け、route は c.get('userId') で利用者を特定する。既存の総収支 route は全ての読取・書込を userId で絞る。新設・拡張する一括判定・除外理由・操作履歴の取得と取消も同じ route に置き、userId で絞る (他利用者の判定や履歴を取り消せない)。書込 (POST/DELETE) は canonicalMutationFence の対象になる。画面は AuthenticatedApp.tsx 配下で、未認証は既存どおりログインへ送られる。認証方式・セッション・レート制限の変更は無い。

- (根拠の性質: コード・設定・公式文書で検証できる観測事実 / 出所: アシスタントが 2026-09-15 にリポジトリ (HEAD 1b16825) の該当ファイルを読んで確認した観測事実。answered_at は確認直後に date -u で実測した時刻。 対象: packages/api/src/{index.ts,auth.ts,canonical-mutation-fence.ts,routes/total-cashflow.ts}, packages/web/src/AuthenticatedApp.tsx。 / 回答時刻: 2026-09-15T12:00:44Z)

#### 裏付け質疑: `qa-total-cashflow-decision-004`

**問**

画像の右ペインは『直前の操作 2026/09/10 10:12 1件の判定を元に戻しました / 元に戻す』を持つ。現行は判定を取り消す API が無く、戻せるのは freee 除外の DELETE だけである。元に戻すをどう実現するか。選択肢: (A) 判定・除外・戻すを 1 件ずつ D1 の操作履歴に残し、直前の操作を取り消せる。再読込後も直前の操作が表示される (推奨) / (B) 画面のメモリ上だけで直前 1 件を保持し、再読込で消える。

**答**

(A) 操作履歴を D1 に残す を選択した。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: 利用者が 2026-09-15 に AskUserQuestion で推奨案を選択した。answered_at は回答直後に date -u で実測した時刻で、実際の選択時刻の上限値である。 / 回答時刻: 2026-09-15T11:48:28Z)

## To-Be / Delta

> 本章の**規範**。上位概念 (要件定義書 U3 ゴール / U4 目標 / U9 具体的やりたいこと) を本章の serves_goals で絞り込んだ射影であり、設計知識 card (非規範の参考資料) とは役割が異なる。As-Is (現行実装の姿) は spec-state.json の管轄外のため本節では断定せず、到達点と、その到達を判定する観測点だけを規範として置く。

### 到達すべき状態 (To-Be)

- **G2**: 重複・除外の判定作業を 3 ペインにする。左に 重複候補/freee除外/要確認 の件数付きナビ、中央にソース/判定フィルタ・検索・チェック選択付きの明細表、右に選択明細の MF 明細と freee 対応候補の並列詳細・一致度・『同じ取引/別の取引/集計から除外』・直前の操作と元に戻す を置き、複数選択と下部の選択バーで一括判定できるようにする。
- **G4**: 判定と除外の操作を D1 に記録し元に戻せるようにする。freee 除外は理由区分 (振替/内部移動/帳簿のみ/二重登録/その他) とメモに分けて一括設定でき、既存の自由記述理由は失わずに移行する。判定・除外・戻すの操作履歴を残し、画面を開いてから行った操作を新しい順に取り消すと総額が操作前と一致し、同じ取消の再送や古い表示からの取消で意図しない操作を戻さない。再読込後は取り消せない (操作履歴は残る)。判定・除外・操作履歴はバックアップに含め、復元しても戻る。

### 受入条件 (Delta の判定点)

| 目標 | 到達点 | 達成の観測点 (measure) |
|---|---|---|
| O3 | 3 ペインの判定作業で単票・一括の同じ/別/除外ができる。 | DOM テストで区分切替・フィルタ・検索・選択・右詳細・一括判定が動き、API 統合テストで判定後の総額が不変条件どおりになる。 |
| O4 | 除外理由区分とメモ、操作履歴と取消が永続化される。 | migration 適用後に既存除外の理由がメモへ保持され、取消 API の統合テストで操作前後の総額が一致し、同じ取消の再送や古い表示からの取消で意図しない操作が戻らず、再取込後も判定が再適用され、バックアップから復元すると判定・除外・操作履歴が復元時点に戻る。 |

### 本章がかなえる具体的やりたいこと (U9)

- **I4**: 判定作業の左ナビに 重複候補/freee除外/要確認 の件数を出し、中央表にソース/判定フィルタ・検索・チェック選択、右に MF 明細と freee 対応候補の並列詳細・一致度・同じ取引/別の取引/集計から除外 を置く。
- **I5**: freee から除外した明細一覧に理由区分バッジ・メモ・集計へ戻す・全選択/選択クリア/一括で理由を設定 を置く。
- **I6**: 自動一致の候補 (日付と金額の一致で自動に寄せた組) 一覧にソースフィルタ・全選択・一致度・『選択した取引を同じ取引にする』を置き、確定は same の記録だけで総額を変えない。
- **I7**: 複数選択時に下部固定の選択バー (件数・選択をクリア・選択した取引を同じ取引にする) を出し、判定完了で『N件中M件の判定が完了しました』を通知する。
- **I8**: core に総収支のセグメント別集計・前期比較・判定作業の区分・一致度関数を追加し、API が 1 回で返す。一括判定と取消の API を足す。
- **I9**: D1 に freee 除外の reason_code と memo を足し既存 reason を memo と『その他』へ移し、判定・除外・戻すの操作履歴テーブルを作って画面を開いてから行った操作の取消を、同じ取消の再送や古い表示から意図しない操作を戻さない形で実装する。判定・除外・操作履歴の 3 表をバックアップと復元の対象に加える。

### 本章に効く確定意思決定

- (本章ゴールに効く確定 decision なし)

## 適用された設計知識

> 以下の deep knowledge card は設計判断を支援する**非規範の参考資料**であり、実装済み・検証済みの証拠ではない。カード内の `採否: applied` は設計採用を意味し、実装状態は意味しない。規範となる差分は本章の To-Be / Delta 節と参照先仕様で管理する。

### 本章での適用

Secure by Design card の『既定で拒否し、境界で一度だけ判定する』を、総収支に足す書込み API の認可に適用した。除外の一括設定・集計へ戻す・判定・取消はすべて /api/* の authGuard → mustChangePasswordFence → runtimeSchemaGuard → canonicalMutationFence の後にマウントし、route 内では認証済み user_id だけを条件に読み書きする。取消は操作履歴を user_id と id の両方で引くので、他人の操作 id を送っても 404 になり、存在の有無も漏らさない (qa-total-cashflow-decision-004)。新しい権限区分や共有機能は作らない。

- (根拠の性質: アシスタントの推定 (利用者確認も検証可能な出典も経ていない) / 記録時刻: 2026-09-15T12:08:50Z)

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
