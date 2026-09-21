---
status: confirmed
category: auth
aggregate: 確定
spec_cells: [auth.web, auth.mobile, auth.tablet, auth.desktop-windows, auth.desktop-linux, auth.desktop-macos]
serves_goals: [G3, G5]
---

# 認証(ログイン) (auth)

- カテゴリ集約状態: **確定**
- 章確定マーカー: `status: confirmed`

## カテゴリ別収集状態

| プラットフォーム | 状態 | 根拠 |
|---|---|---|
| Web (web) | 確定 | 確定質疑: qa-classify-auth-web-001。裏付け質疑 (`qa_refs`): `qa-classify-auth-web-evidence-001`, `qa-classify-auth-web-002` — 本章の「確定内容 (質疑録)」へ接地根拠として併記。資するゴール: G3, G5 |
| モバイル (mobile) | 対象外 | 理由: スマートフォン向け専用アプリを提供していたなら、認証(ログイン)では生体認証やトークンの端末保存をどうするかを決める必要があった。対象を web のみとする利用者決定 (qa-classify-target-platforms-001) によりその検討は発生しない。 |
| タブレット (tablet) | 対象外 | 理由: タブレット向け専用アプリを提供していたなら、認証(ログイン)では共有されやすい家庭用タブレットでのセッションの寿命をどうするかを決める必要があった。対象を web のみとする利用者決定 (qa-classify-target-platforms-001) によりその検討は発生しない。 |
| デスクトップ (Windows) (desktop-windows) | 対象外 | 理由: Windows 向けデスクトップアプリを提供していたなら、認証(ログイン)ではWindows の資格情報マネージャーへのセッション保存をどうするかを決める必要があった。対象を web のみとする利用者決定 (qa-classify-target-platforms-001) によりその検討は発生しない。 |
| デスクトップ (Linux) (desktop-linux) | 対象外 | 理由: Linux 向けデスクトップアプリを提供していたなら、認証(ログイン)ではLinux の Secret Service へのセッション保存をどうするかを決める必要があった。対象を web のみとする利用者決定 (qa-classify-target-platforms-001) によりその検討は発生しない。 |
| デスクトップ (macOS) (desktop-macos) | 対象外 | 理由: macOS 向けデスクトップアプリを提供していたなら、認証(ログイン)ではmacOS のキーチェーンへのセッション保存をどうするかを決める必要があった。対象を web のみとする利用者決定 (qa-classify-target-platforms-001) によりその検討は発生しない。 |

## 上流指針 (doctrine anchors)

> 本章の設計判断が従う上流の正本 (1 concern 1 authority)。具体技術ではなく上流工程を導く規範であり、下位の技術選定は本節と矛盾してはならない。正本: `ref-system-design-knowledge/references/doctrine-anchor-registry.json`

| 設計 concern | 上流の正本 (authority) | 導く範囲 | 出典 | 最終確認 | 本章の確定セルへの反映 |
|---|---|---|---|---|---|
| authentication | OWASP ASVS + Secrets Management Cheat Sheet | 認証方式・セッション・資格情報/シークレット/API キーの取扱いの上流指針 | https://owasp.org/www-project-application-security-verification-standard/ | 2026-07-12 | 明細仕分けでは新しいログイン経路を足さず、既存のセッション Cookie と session_generation による無効化にそのまま乗せる形へ反映した。パスワード変更が必要な利用者は mustChangePasswordFence で一括保存やルール適用に届かない。 |
| security | OWASP ASVS + Secrets Management Cheat Sheet | 脅威モデル・入力検証・暗号化・監査ログの上流指針 | https://owasp.org/www-project-application-security-verification-standard/ | 2026-07-12 | 明細仕分けの認可では、一括保存・ルール適用・保存フィルタ・履歴の全 SQL を利用者で区切り、他人の明細 id を渡されても明細単位の not_found に落とす形へ反映した。利用者 id を要求の本文から受け取らない。 |

## 確定内容 (質疑録)

> 本章の各確定セルが何を根拠に確定したかの実体。`qa_ref` が主たる接地根拠、`qa_refs` がそれを支える裏付け質疑であり、いずれも qa_log (spec-state.json) の逐語である。ここに現れない主張は本章の確定内容ではない。

### Web (web)

- 資するゴール: G3, G5

#### 主たる接地根拠: `qa-classify-auth-web-001`

**問**

明細仕分けの新しい API と保存データに、認証と認可をどう適用するか。

**答**

新しい認証方式は作らない。新しい API (一括保存・ルールのプレビューと適用・保存フィルタ・履歴) はすべて /api/* の authGuard と mustChangePasswordFence の内側に置き、利用者 id はセッションから取り、要求の本文や URL からは受け取らない。保存したフィルタ・変更履歴・ルールは利用者で区切り、他の利用者の行を読み書きできない。下書きは端末の localStorage に置くため、共有端末に残らないよう保存成功で消す (qa-classify-decision-004)。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: 利用者が正本として指示した画像 design/FINAL-UI/images/13-classify.png と、利用者承認 (appr-foundation-classify-001) の U1-U9、決定 qa-classify-decision-001〜004 から、利用者が決めていない具体値を除いて書き起こした要件。除いた値は同じ章の -002 (agent-inference) に分けた。 / 回答時刻: 2026-09-19T13:24:40Z)

#### 裏付け質疑: `qa-classify-auth-web-evidence-001`

**問**

認証(ログイン) 章の裏付けとして、13-classify.png と現行実装の差分として何を観測したか。

**答**

packages/api/src/index.ts の 56〜106 行目で /api/* に authGuard・mustChangePasswordFence・runtimeSchemaGuard・canonicalMutationFence が順に掛かる。セッションは kanjo_session Cookie で、users 表の session_generation で無効化される。既存の classify route は c.get('userId') で利用者を取り、全ての SQL を user_id で絞っている。テナントは TENANT_ID='default' の単一。

- (根拠の性質: コード・設定・公式文書で検証できる観測事実 / 出所: リポジトリの現行実装 (main 0003cb4) の読取りによる観測。 / 回答時刻: 2026-09-19T13:24:40Z)

#### 裏付け質疑: `qa-classify-auth-web-002`

**問**

web の明細仕分け画面で、認証(ログイン) について利用者が決めていない具体値を何にするか。

**答**

他の利用者の保存フィルタや明細を id で指したときは、存在を漏らさないため 403 ではなく 404 を返す。一括保存では他の利用者の明細 id を明細単位の失敗 (not_found) として返し、要求全体は止めない。 これは agent の推定で、利用者は未確認である。画像・U1-U9・決定 001〜004 のどれにも値が無いため、実装で決定論を保つために置いた。

- (根拠の性質: アシスタントの推定 (利用者確認も検証可能な出典も経ていない) / 出所: agent の推定 (利用者未確認) / 回答時刻: 2026-09-19T13:24:40Z)

## To-Be / Delta

> 本章の**規範**。上位概念 (要件定義書 U3 ゴール / U4 目標 / U9 具体的やりたいこと) を本章の serves_goals で絞り込んだ射影であり、設計知識 card (非規範の参考資料) とは役割が異なる。As-Is (現行実装の姿) は spec-state.json の管轄外のため本節では断定せず、到達点と、その到達を判定する観測点だけを規範として置く。

### 到達すべき状態 (To-Be)

- **G3**: 選択した複数の明細を 1 回の要求で保存する一括保存を設ける。明細ごとの成否を返し、画面は『N 件のうち M 件を保存、K 件はエラー』と失敗した明細だけの再試行を示す。成功分は取り消されない。削除は既存の取消 (undo) で元に戻せる。一括保存・ルール作成・ルール適用・保存フィルタの変更は既存の canonicalMutationFence の内側に置く。
- **G5**: 仕分けの作業状態を失わない。保存したフィルタは D1 に新しい表を追加のみの migration で設け、名前付きで保存・呼出・削除できる。取引の履歴は D1 に明細の変更履歴表を追加のみで設け、いつ・何が (区分・カテゴリ・所有者・支払方法・メモ・分割)・どの由来 (自動提案 / 手動 / ルール / 一括保存) で変わったかを残し、編集パネルに新しい順で出す。編集パネルの下書きは端末の localStorage に明細単位で自動保存し、最終保存時刻を表示し、保存に成功したら消し、次回に『下書きを復元』できる。未保存のまま離れるときは確認する。

### 受入条件 (Delta の判定点)

| 目標 | 到達点 | 達成の観測点 (measure) |
|---|---|---|
| O3 | 一括保存の部分失敗が報告され、失敗分だけ再試行できる。 | API 統合テストで、3 件中 1 件が検証エラーの一括保存が 2 件を保存して明細ごとの結果を返し、再試行が失敗分だけを送ることを DOM テストで確かめる。未認証 401・変更系フェンス違反の拒否・上限件数超過の 400 を確かめる。 |
| O5 | 作業状態が失われない。 | API 統合テストで保存フィルタの作成・一覧・削除と、各変更経路で履歴が 1 件ずつ残ることを確かめ、migration が既存行を 1 行も書き換えないことを検査する。DOM テストで下書きの自動保存・復元・保存成功での消去・離脱確認を確かめる。 |

### 本章がかなえる具体的やりたいこと (U9)

- **I4**: 一括保存 API を新設し、明細ごとに検証と保存を行って成否の配列を返す。画面は部分失敗の通知と失敗分だけの再試行を出す。
- **I6**: 保存フィルタ表と明細の変更履歴表を追加のみで設け、全変更経路 (手動・一括・ルール・分割・削除と取消) で履歴を 1 件ずつ残す。
- **I7**: 編集パネルの下書きを localStorage に明細単位で自動保存し、保存時刻の表示・復元・保存成功での消去・未保存の離脱確認を行う。

### 本章に効く確定意思決定

- **dec-classify-state-storage**: 保存したフィルタ・下書き・取引の履歴の保存先をどうするか。
  - 採択: フィルタと履歴は D1、下書きは端末 (`opt-d1-and-local`)
  - 目的適合: 共有と監査が要るものは D1、頻繁に変わる下書きは端末に置き G5 を満たす。

## 適用された設計知識

> 以下の deep knowledge card は設計判断を支援する**非規範の参考資料**であり、実装済み・検証済みの証拠ではない。カード内の `採否: applied` は設計採用を意味し、実装状態は意味しない。規範となる差分は本章の To-Be / Delta 節と参照先仕様で管理する。

### 本章での適用

Least privilege と resource ownership の card を明細仕分けに適用した。新しい表はすべて user_id を主キーか索引の先頭に持たせ、route は WHERE user_id = ? を必ず付ける。所有していない行は存在しないものとして扱い、一括保存でも明細単位で同じ規則を当てる。

- (根拠の性質: アシスタントの推定 (利用者確認も検証可能な出典も経ていない) / 記録時刻: 2026-09-19T13:24:40Z)

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
