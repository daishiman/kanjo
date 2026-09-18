---
status: confirmed
category: auth
aggregate: 確定
spec_cells: [auth.web, auth.mobile, auth.tablet, auth.desktop-windows, auth.desktop-linux, auth.desktop-macos]
serves_goals: [G2, G5]
---

# 認証(ログイン) (auth)

- カテゴリ集約状態: **確定**
- 章確定マーカー: `status: confirmed`

## カテゴリ別収集状態

| プラットフォーム | 状態 | 根拠 |
|---|---|---|
| Web (web) | 確定 | 確定質疑: qa-subs-auth-web-004。裏付け質疑 (`qa_refs`): `qa-subs-auth-web-evidence-001`, `qa-subs-auth-web-003`, `qa-subs-auth-web-005` — 本章の「確定内容 (質疑録)」へ接地根拠として併記。資するゴール: G2, G5 |
| モバイル (mobile) | 対象外 | 理由: スマートフォン向け専用アプリなら、名称の統合や候補の採用といった書込み操作の前に端末の生体認証で再確認するか、トークンをどこに保管するかを決める必要があった。対象を web のみとする利用者決定 (qa-subs-target-platforms-001) によりその検討は発生しない。 |
| タブレット (tablet) | 対象外 | 理由: タブレット向け専用アプリなら、家族と共用される端末での自動ログアウトの時間を決める必要があった。対象を web のみとする利用者決定 (qa-subs-target-platforms-001) によりその検討は発生しない。 |
| デスクトップ (Windows) (desktop-windows) | 対象外 | 理由: Windows 向けデスクトップアプリなら、資格情報を Windows の資格情報マネージャーへ保存するかを決める必要があった。対象を web のみとする利用者決定 (qa-subs-target-platforms-001) によりその検討は発生しない。 |
| デスクトップ (Linux) (desktop-linux) | 対象外 | 理由: Linux 向けデスクトップアプリなら、Secret Service などの鍵保管の有無に応じた資格情報の保存方法を決める必要があった。対象を web のみとする利用者決定 (qa-subs-target-platforms-001) によりその検討は発生しない。 |
| デスクトップ (macOS) (desktop-macos) | 対象外 | 理由: macOS 向けデスクトップアプリなら、キーチェーンへの保存と署名済みアプリからの読出しを決める必要があった。対象を web のみとする利用者決定 (qa-subs-target-platforms-001) によりその検討は発生しない。 |

## 上流指針 (doctrine anchors)

> 本章の設計判断が従う上流の正本 (1 concern 1 authority)。具体技術ではなく上流工程を導く規範であり、下位の技術選定は本節と矛盾してはならない。正本: `ref-system-design-knowledge/references/doctrine-anchor-registry.json`

| 設計 concern | 上流の正本 (authority) | 導く範囲 | 出典 | 最終確認 | 本章の確定セルへの反映 |
|---|---|---|---|---|---|
| authentication | OWASP ASVS + Secrets Management Cheat Sheet | 認証方式・セッション・資格情報/シークレット/API キーの取扱いの上流指針 | https://owasp.org/www-project-application-security-verification-standard/ | 2026-07-12 | OWASP ASVS の『全ての保護資源で認証を要求する』を、サブスクで新設する 4 経路が既存の authGuard の配下に入ることで満たす形へ反映した。新しい経路を /api の外や認証前のミドルウェアの手前に置かないことを、マウント位置のテスト (未ログインで 401、初期パスワード未変更で遮断) で固定する。パスワードの保存方式とセッションは変えない。 |
| security | OWASP ASVS + Secrets Management Cheat Sheet | 脅威モデル・入力検証・暗号化・監査ログの上流指針 | https://owasp.org/www-project-application-security-verification-standard/ | 2026-07-12 | サブスクの更新系 (カテゴリ変更・名称の統合・候補の採用 / 除外 / 確認と取消) は、いずれも対象を userId と組で引いてから書き換える形へ反映した。他の利用者のベンダー id や照合キーを指定された場合は 404 を返し、存在の有無も示さない。これを利用者を 2 人用意した API テストで確かめ、既存の subs-vendor-scope.test.ts の流儀に揃える。 |

> **未記入** の行は、上流の正本を掲げただけで本章の確定内容へ反映した箇所を示せていない。表への出現は反映の証拠ではない。

## 確定内容 (質疑録)

> 本章の各確定セルが何を根拠に確定したかの実体。`qa_ref` が主たる接地根拠、`qa_refs` がそれを支える裏付け質疑であり、いずれも qa_log (spec-state.json) の逐語である。ここに現れない主張は本章の確定内容ではない。

### Web (web)

- 資するゴール: G2, G5

#### 主たる接地根拠: `qa-subs-auth-web-004`

**問**

web のサブスク画面の auth 要件は何か。(このうち利用者が実際に選んだ部分)

**答**

利用者の決定は次の 1 点である。単独利用者の個人事業主向けという前提を本サイクルでも継続し、役割の分担や複数ユーザーの権限分離を導入しない。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: 前サイクルまでに利用者が確定した単独利用者前提 (U1-U9 の SH1『単独の個人事業主』) を、本サイクルでも変更しないという継続決定。本サイクルで新たな選択肢を提示していないため decision は起票していない。 / 回答時刻: 2026-09-18T03:36:08Z)

#### 裏付け質疑: `qa-subs-auth-web-evidence-001`

**問**

auth 章の裏付けとして、サブスクの API は認証の下にどう置かれているか。

**答**

packages/api/src/index.ts:102 と :104 で /api/* 全体に authGuard と mustChangePasswordFence を掛け、:114 で analyticsRoute、:118 で subsRoute を /api の下にマウントしている。したがって GET /api/subscriptions と /api/sub-vendors 系はすべてログイン済みで、初期パスワード変更後の利用者だけが到達できる。各 route は c.get('userId') で利用者を絞っている。パスワードは PBKDF2 (本番 Workers の上限に合わせた 100,000 回、password-hash-workerd.test.ts で検査) で保存している。

- (根拠の性質: コード・設定・公式文書で検証できる観測事実 / 出所: packages/api/src/index.ts・routes/subs.ts・routes/analytics.ts の読解 (2026-09-18)。 / 回答時刻: 2026-09-18T03:44:05Z)

#### 裏付け質疑: `qa-subs-auth-web-003`

**問**

web のサブスク画面の auth 要件のうち、agent が補完した設計判断は何か。

**答**

(1) 新設する GET /api/subscriptions/vendors/:key・POST /api/sub-vendors/:id/aliases・POST / DELETE /api/subscriptions/review-decisions は既存の subsRoute / analyticsRoute に足し、authGuard と mustChangePasswordFence の内側に置く。route の中で認証を再判定しない。(2) 利用者の識別は c.get('userId') だけから取り、パスやクエリの値を利用者の同定に使わない。:id と :key は必ず userId と組にして引き、他の利用者のベンダーを更新できないようにする。(3) 認証の方式 (PBKDF2・セッション Cookie) は変えない。

- (根拠の性質: アシスタントの推定 (利用者確認も検証可能な出典も経ていない) / 出所: 既存の認証配線の読解にもとづく agent の設計判断。既存方式の踏襲であり、利用者へ選択肢を提示していない。 / 回答時刻: 2026-09-18T03:44:05Z)

#### 裏付け質疑: `qa-subs-auth-web-005`

**問**

web のサブスク画面で単独利用者前提を継続する決定は、今サイクルのどの承認に遡れるか。

**答**

今サイクルの上位概念承認 appr-foundation-subscriptions-001 (2026-09-18T03:36:08Z) で、利用者は SH1 を『利用者 (単独の個人事業主)』として承認した。役割分担や複数ユーザーの権限分離は scope.in に無く、本サイクルでも導入しない。認証の主体と保存の境界 (userId と組で引く) は account-login サイクル (system-spec/archive/2026-09-14-account-login/) の確定を変えない。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: appr-foundation-subscriptions-001 の SH1 (利用者が承認した U1-U9 草案と同文)。qa-subs-auth-web-004 の継続決定の根拠をこの承認へ明示的に結び付ける。 / 回答時刻: 2026-09-18T03:36:08Z)

## To-Be / Delta

> 本章の**規範**。上位概念 (要件定義書 U3 ゴール / U4 目標 / U9 具体的やりたいこと) を本章の serves_goals で絞り込んだ射影であり、設計知識 card (非規範の参考資料) とは役割が異なる。As-Is (現行実装の姿) は spec-state.json の管轄外のため本節では断定せず、到達点と、その到達を判定する観測点だけを規範として置く。

### 到達すべき状態 (To-Be)

- **G2**: 一覧で選んだサブスクの『サブスクの詳細』パネルを実装する。正規化名・カテゴリ (変更可)・見直し候補バッジ、概要 / 取引履歴 / 関連データのタブ、正規化された名称 (編集可)、マッチした生の取引名 (チェックとソース種別)、月額の推定と年換算、直近の取引 3 件と『すべて見る (N件)』、データソース別件数、『名称を統合』『候補として確認』を出し、閉じるで解除できる。生の取引名を選ぶと画面下部に『N件の取引を選択中』バー (選択チップの解除・選択した N 件を統合・選択を解除) を出す。
- **G5**: 保存は既存表を再利用して拡張し、画像に無い旧 UI は画像の部品へ吸収して撤去する。名称の統合=既存ベンダーの aliases 追加、未登録候補の採用=sub_vendors 登録・除外=sub_vendor_exclusions、登録済みベンダーの見直し候補への判断 (確認 / 除外) とカテゴリは migration 0043 で足す。登録ベンダーの別名・対象科目の編集、四半期見直し、重複・急増アラート、未登録候補の各機能は失わず、詳細パネル・候補バッジ・検出理由・ステータス絞込へ移す。サイドバー・ヘッダー・フッター・月次クローズ進捗は既存実装をそのまま使う。

### 受入条件 (Delta の判定点)

| 目標 | 到達点 | 達成の観測点 (measure) |
|---|---|---|
| O2 | 行を選ぶと詳細パネルが開き、統合と確認の操作ができる。 | DOM テストで、行選択→詳細パネル (3 タブ・正規化名・生の取引名・月額推定・直近の取引・データソース・2 操作) 表示、生の取引名 2 件選択→下部バー『2件の取引を選択中』表示→統合 API 呼出し、閉じる / 選択を解除で状態が戻ることが緑である。 |
| O5 | 保存と旧機能の移設が壊れずに完了する。 | migration 0043 がローカル D1 に適用でき、統合・採用・除外・確認・カテゴリ変更の API 統合テストが緑、旧パネルのテストが新しい置き場所のテストへ移されて機能の欠落が 0 件、サイドバーのバッジ件数が画面の候補件数と一致する。 |

### 本章がかなえる具体的やりたいこと (U9)

- **I1**: Subscriptions.tsx を、問いの見出し・KPI 5 枚・カバー率カード・一覧 (検索 / ステータス絞込 / 候補バッジ / 合計行)・カテゴリ別推移・年換算比較・右の詳細パネル・検出理由カード・下部の選択バーの構成に作り直し、選択中のサブスクを URL に保つ。
- **I2**: 詳細パネルで正規化名とカテゴリを編集し、生の取引名を選んで『選択した N 件を統合』で既存ベンダーの aliases に加えられるようにする。
- **I5**: migration 0043 で sub_vendors に category を足し、登録済みベンダーの見直し候補への判断 (確認 / 除外) を保存する表を足して、既存の除外・見直し日時と一緒に扱う。
- **I6**: 旧 SubVendorsPanel / SubsCandidatesPanel / アラート / ベンダー別前年比較表を撤去し、その操作を詳細パネル・検出理由カード・ステータス絞込へ移したうえで、既存テストを新しい置き場所へ移す。

### 本章に効く確定意思決定

- **dec-subs-category**: サブスクのカテゴリ (エンタメ / クラウド / 仕事効率化 など) をどう決めるか。
  - 採択: core の既定辞書 (正規化名→カテゴリ、当たらなければ『その他』) + 利用者の変更を sub_vendors.category に保存 (`opt-dict-plus-override`)
  - 目的適合: G1 のカテゴリ列・カテゴリ別推移・年換算比較と G4 の集計を、取込直後から辞書で埋められる。辞書が外れても利用者が詳細パネルで直せば以後は上書きが勝つ。
- **dec-subs-persistence**: 名称の統合・候補の採用 / 除外・カテゴリ・見直し判断をどこに保存するか。
  - 採択: 既存表を再利用して拡張 — 統合=既存ベンダーの aliases 追加、採用=sub_vendors 登録、除外=sub_vendor_exclusions、category と見直し判断は migration 0043 で追加 (`opt-reuse-extend`)
  - 目的適合: 既存の照合 (matchSubVendor) と候補除外がそのまま新しい操作の保存先になり、G5 の『旧機能を失わない』と両立する。
- **dec-subs-legacy-ui**: 画像に無い既存の機能 (登録ベンダーの別名・対象科目の編集、四半期見直し、重複・急増アラート、ベンダー別前年比較表、未登録候補パネル) をどう扱うか。
  - 採択: 画像の部品 (詳細パネル・候補バッジ・検出理由カード・ステータス絞込) へ吸収し、旧 UI は撤去する (`opt-absorb-and-remove`)
  - 目的適合: 画面が画像どおりになり (G1)、旧機能の操作は詳細パネルと検出理由へ移って失われない (G5)。

## 適用された設計知識

> 以下の deep knowledge card は設計判断を支援する**非規範の参考資料**であり、実装済み・検証済みの証拠ではない。カード内の `採否: applied` は設計採用を意味し、実装状態は意味しない。規範となる差分は本章の To-Be / Delta 節と参照先仕様で管理する。

### 本章での適用

Secure by Design card の『既定で拒否し、境界で一度だけ判定する』を、サブスクで新設する 4 経路 (ベンダー詳細の取得・名称の統合・見直し判断の記録と取消) の配置に適用した。いずれも既存の subsRoute / analyticsRoute に足して /api/* の authGuard と mustChangePasswordFence の内側に置き、route の中で認証を再判定しない。更新系は :id / :key を c.get('userId') と組にして引くことで、他の利用者のベンダーや判断を指す値を受け取っても書き換えられない形にする。

- (根拠の性質: アシスタントの推定 (利用者確認も検証可能な出典も経ていない) / 記録時刻: 2026-09-18T03:48:08Z)

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
