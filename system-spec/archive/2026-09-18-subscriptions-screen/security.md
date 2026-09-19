---
status: confirmed
category: security
aggregate: 確定
spec_cells: [security.web, security.mobile, security.tablet, security.desktop-windows, security.desktop-linux, security.desktop-macos]
serves_goals: [G4, G5]
---

# セキュリティ (security)

- カテゴリ集約状態: **確定**
- 章確定マーカー: `status: confirmed`

## カテゴリ別収集状態

| プラットフォーム | 状態 | 根拠 |
|---|---|---|
| Web (web) | 確定 | 確定質疑: qa-subs-security-web-004。裏付け質疑 (`qa_refs`): `qa-subs-security-web-evidence-001`, `qa-subs-review-decision-002`, `qa-subs-security-web-006` — 本章の「確定内容 (質疑録)」へ接地根拠として併記。資するゴール: G4, G5 |
| モバイル (mobile) | 対象外 | 理由: スマートフォン向け専用アプリなら、端末に残る取引名・金額の暗号化と、端末紛失時の遠隔消去を決める必要があった。対象を web のみとする利用者決定 (qa-subs-target-platforms-001) によりその検討は発生しない。 |
| タブレット (tablet) | 対象外 | 理由: タブレット向け専用アプリなら、共用端末で他人に支払い履歴が見える状態をどう防ぐかを決める必要があった。対象を web のみとする利用者決定 (qa-subs-target-platforms-001) によりその検討は発生しない。 |
| デスクトップ (Windows) (desktop-windows) | 対象外 | 理由: Windows 向けデスクトップアプリなら、ローカルに保存する明細の暗号化と、更新プログラムの署名検証を決める必要があった。対象を web のみとする利用者決定 (qa-subs-target-platforms-001) によりその検討は発生しない。 |
| デスクトップ (Linux) (desktop-linux) | 対象外 | 理由: Linux 向けデスクトップアプリなら、配布形式ごとの署名と、ローカル保存のファイル権限を決める必要があった。対象を web のみとする利用者決定 (qa-subs-target-platforms-001) によりその検討は発生しない。 |
| デスクトップ (macOS) (desktop-macos) | 対象外 | 理由: macOS 向けデスクトップアプリなら、公証 (notarization) とサンドボックスの権限を決める必要があった。対象を web のみとする利用者決定 (qa-subs-target-platforms-001) によりその検討は発生しない。 |

## 上流指針 (doctrine anchors)

> 本章の設計判断が従う上流の正本 (1 concern 1 authority)。具体技術ではなく上流工程を導く規範であり、下位の技術選定は本節と矛盾してはならない。正本: `ref-system-design-knowledge/references/doctrine-anchor-registry.json`

| 設計 concern | 上流の正本 (authority) | 導く範囲 | 出典 | 最終確認 | 本章の確定セルへの反映 |
|---|---|---|---|---|---|
| security | OWASP ASVS + Secrets Management Cheat Sheet | 脅威モデル・入力検証・暗号化・監査ログの上流指針 | https://owasp.org/www-project-application-security-verification-standard/ | 2026-07-12 | サブスクで外部由来の文字列が通る 2 か所 (取込明細の取引名と、利用者が入力する別名・カテゴリ名) に、入力側の許可リスト検証と出力側のテキスト描画を対で置く形へ反映した。カテゴリの判定と候補の理由文を AI に頼らないため、取引名・金額を外部の推論サービスへ送る経路は作らない。ロゴも取得しないため、サービス名から外部の画像 URL を組み立てて問い合わせる経路も作らない。 |

> **未記入** の行は、上流の正本を掲げただけで本章の確定内容へ反映した箇所を示せていない。表への出現は反映の証拠ではない。

## 確定内容 (質疑録)

> 本章の各確定セルが何を根拠に確定したかの実体。`qa_ref` が主たる接地根拠、`qa_refs` がそれを支える裏付け質疑であり、いずれも qa_log (spec-state.json) の逐語である。ここに現れない主張は本章の確定内容ではない。

### Web (web)

- 資するゴール: G4, G5

#### 主たる接地根拠: `qa-subs-security-web-004`

**問**

web のサブスク画面の security 要件は何か。(このうち利用者が実際に選んだ部分)

**答**

利用者の決定が機密面へ及ぶのは次の 1 点である。カテゴリの判定と見直し候補の理由文に AI を使わず、コード内の辞書と決定論ルールで作ると決めたため、取引名・金額を外部の推論サービスへ送る経路を本サイクルで作らない。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: AskUserQuestion で選択された dec-subs-category と dec-subs-review-candidate。選択時の比較で『取込データを外部へ送らない』ことが採用理由として提示されている。 / 回答時刻: 2026-09-18T03:36:08Z)

#### 裏付け質疑: `qa-subs-security-web-evidence-001`

**問**

security 章の裏付けとして、サブスクの API の入力検証と外部送信は現状どうか。

**答**

routes/subs.ts は POST / PUT /sub-vendors と POST /sub-vendors/exclusions の本文を zValidator (Zod) で検証している。GET /subscriptions は期間を loadScoped で受け取る。サブスクの検出・集計は core の純関数で完結し、外部の API を呼んでいない。kanjo の画面下部には『取込データは外部送信しません』と表示している。

- (根拠の性質: コード・設定・公式文書で検証できる観測事実 / 出所: packages/api/src/routes/subs.ts・analytics.ts の読解と、参照画像の下部表示の確認 (2026-09-18)。 / 回答時刻: 2026-09-18T03:44:05Z)

#### 裏付け質疑: `qa-subs-review-decision-002`

**問**

(AskUserQuestion で 3 問を選択肢つきで提示) (1) 登録済みのサブスクが見直し候補になったとき、検出理由カードの『候補を採用』は何を意味させるか。選択肢: 『候補として確認』と同じ (推奨) / 見直しを済ませた記録 (resolved) / 未登録の候補だけに出す。(2) 『見直し候補として確認』(confirmed) にした候補を画面でどう扱うか。選択肢: 一覧に残し件数から外す (推奨) / すべて残す / すべてから外す。(3) 複数の規則に同時に当たったとき、同じ理由では再び出さないための指紋をどう作るか。選択肢: 当たった全規則+基準金額 (推奨) / 最優先の規則+基準金額。

**答**

(1) 『候補として確認』と同じ — 登録済みベンダーの見直し候補では、検出理由カードの『候補を採用』と詳細パネルの『候補として確認』はどちらも confirmed (見直す対象として残す) を記録する。保存する値は confirmed / dismissed の 2 つだけ。(2) 一覧に残し件数から外す — confirmed の候補は一覧の候補バッジを『確認済み』に変えて残し、KPI の『見直し候補 N 件』とサイドバーのバッジはまだ判断していない候補だけを数える。(3) 当たった全規則+基準金額 — 指紋は当たった規則の種類すべてと判定時の基準金額から作り、月は含めない。新しい規則が加わるか金額が変わったときだけ再び候補に出す。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: AskUserQuestion への利用者の明示選択 (2026-09-18T06:51:17Z)。各問に 2〜3 の選択肢と説明を示し、利用者が 3 問とも推奨案を選んだ。qa-subs-review-decision-001 (『つづけて』からの推定の採用) を置き換える。 / 回答時刻: 2026-09-18T06:51:17Z)

#### 裏付け質疑: `qa-subs-security-web-006`

**問**

web のサブスク画面の security 要件のうち、agent が補完した設計判断は何か。

**答**

(1) 新設 API の入力はすべて Zod で許可リスト検証する — vendorKey は長さ上限つきの文字列、aliases は 1〜50 件・各 1〜100 文字の配列、decision は confirmed / dismissed の列挙、category は既定辞書のカテゴリ名の列挙か 1〜20 文字の自由記述。(2) 取引名・ベンダー名は利用者が取り込んだ外部由来の文字列なので、画面では React のテキストとしてだけ描き、HTML として挿入しない。(3) カテゴリ辞書と口座の手がかりはコード内の固定表で持ち、判定のために外部へ問い合わせない。(4) 更新系は :id / :key を userId と組にして引き、見つからなければ 404 を返して他の利用者の存在を示さない。

- (根拠の性質: アシスタントの推定 (利用者確認も検証可能な出典も経ていない) / 出所: 既存の検証の書き方と OWASP ASVS の入力検証・出力エンコードの指針からの agent の設計判断。 qa-subs-security-web-003 の改訂版。 2026-09-18 の完成度評価 2 回目の差し戻しを受け、利用者決定 qa-subs-review-decision-002 と上位概念改訂 appr-foundation-subscriptions-002 に合わせて agent が書き直した設計判断。 / 回答時刻: 2026-09-18T06:54:11Z)

## To-Be / Delta

> 本章の**規範**。上位概念 (要件定義書 U3 ゴール / U4 目標 / U9 具体的やりたいこと) を本章の serves_goals で絞り込んだ射影であり、設計知識 card (非規範の参考資料) とは役割が異なる。As-Is (現行実装の姿) は spec-state.json の管轄外のため本節では断定せず、到達点と、その到達を判定する観測点だけを規範として置く。

### 到達すべき状態 (To-Be)

- **G4**: サブスク画面の数値を core の純関数 1 か所で算出し、GET /subscriptions をその形へ拡張する。推定月額 (年額払いは 12 等分) とその合計・年換算・前期間比 (直前の同じ長さの期間の最新月時点との差)、直近 12 か月の支払額、売上比、正規化名→カテゴリの既定辞書と利用者上書き、口座名の手がかりによる 銀行 / カード / 電子マネー の 3 分類とカバー率 (取込済み口座数 / 口座数、期間の口座×月のうち取引がある割合)、カテゴリ別の月次推移と年換算比較、見直し候補を算出する。既存の sourceNeutralSubscriptions・サイドバーのバッジ件数・総収支 / 推移の数値と突き合わせて一致させる。
- **G5**: 保存は既存表を再利用して拡張し、画像に無い旧 UI は画像の部品へ吸収して撤去する。名称の統合=既存ベンダーの aliases 追加、未登録候補の採用=sub_vendors 登録・除外=sub_vendor_exclusions、登録済みベンダーの見直し候補への判断 (確認 / 除外) とカテゴリは migration 0043 で足す。登録ベンダーの別名・対象科目の編集、四半期見直し、重複・急増アラート、未登録候補の各機能は失わず、詳細パネル・候補バッジ・検出理由・ステータス絞込へ移す。サイドバー・ヘッダー・フッター・月次クローズ進捗は既存実装をそのまま使う。

### 受入条件 (Delta の判定点)

| 目標 | 到達点 | 達成の観測点 (measure) |
|---|---|---|
| O4 | 画面の数値が core の 1 か所から出て既存と一致する。 | core 単体テストで推定月額・年換算・前期間比・カバー率・カテゴリ別集計の境界値が緑、API 統合テストで GET /subscriptions の新しい形が返り、合計行 = 行の和、カテゴリ別合計 = 一覧合計、直近 12 か月の支払額が既存 last12Total と一致する。 |
| O5 | 保存と旧機能の移設が壊れずに完了する。 | migration 0043 がローカル D1 に適用でき、統合・採用・除外・確認・カテゴリ変更の API 統合テストが緑、旧パネルのテストが新しい置き場所のテストへ移されて機能の欠落が 0 件、サイドバーのバッジ件数が画面の候補件数と一致する。 |

### 本章がかなえる具体的やりたいこと (U9)

- **I2**: 詳細パネルで正規化名とカテゴリを編集し、生の取引名を選んで『選択した N 件を統合』で既存ベンダーの aliases に加えられるようにする。
- **I3**: core に見直し候補の判定関数と理由文テンプレートを置き、KPI・一覧・検出理由カード・サイドバーのバッジが同じ関数を使う。
- **I4**: core に推定月額・前期間比・カテゴリ辞書・口座 3 分類とカバー率・カテゴリ別集計の純関数を置き、GET /subscriptions がそれを返す。
- **I5**: migration 0043 で sub_vendors に category を足し、登録済みベンダーの見直し候補への判断 (確認 / 除外) を保存する表を足して、既存の除外・見直し日時と一緒に扱う。
- **I6**: 旧 SubVendorsPanel / SubsCandidatesPanel / アラート / ベンダー別前年比較表を撤去し、その操作を詳細パネル・検出理由カード・ステータス絞込へ移したうえで、既存テストを新しい置き場所へ移す。
- **I7**: 検算済み fixture と見た目検査 (check-financial-visuals) を新しい構成へ更新し、ロゴ画像が無いことも検査する。

### 本章に効く確定意思決定

- **dec-subs-category**: サブスクのカテゴリ (エンタメ / クラウド / 仕事効率化 など) をどう決めるか。
  - 採択: core の既定辞書 (正規化名→カテゴリ、当たらなければ『その他』) + 利用者の変更を sub_vendors.category に保存 (`opt-dict-plus-override`)
  - 目的適合: G1 のカテゴリ列・カテゴリ別推移・年換算比較と G4 の集計を、取込直後から辞書で埋められる。辞書が外れても利用者が詳細パネルで直せば以後は上書きが勝つ。
- **dec-subs-review-candidate**: 『見直し候補』を何で判定し、検出理由の文をどう作るか。
  - 採択: 決定論ルール (同カテゴリ内の重複 / 金額の急増 / 直近の値上げ / 四半期見直しの期限切れ など) + 定型文に金額・件数・月数を差し込む (`opt-rules-template`)
  - 目的適合: KPI の件数・一覧の候補バッジ・検出理由カード・サイドバーのバッジを同じ関数で出せ、G3 の『同じ結果を出す』を構造で満たす。
- **dec-subs-coverage**: 『データソースのカバー率』の 銀行口座 / クレジットカード / 電子マネー をどう分類し、% と (分子/分母) を何で定義するか。
  - 採択: 口座名の手がかりで 3 分類 (paymentMethodOf を拡張)。(分子/分母) = 最新月まで取込済みの口座数 / 口座数、% = 期間の (口座×月) のうち取引がある割合 (`opt-account-name-3way`)
  - 目的適合: 取込済みのデータだけで画像の 3 区分と 2 種の数値を出せ、利用者の追加入力なしに G1 のカードが成立する。
- **dec-subs-persistence**: 名称の統合・候補の採用 / 除外・カテゴリ・見直し判断をどこに保存するか。
  - 採択: 既存表を再利用して拡張 — 統合=既存ベンダーの aliases 追加、採用=sub_vendors 登録、除外=sub_vendor_exclusions、category と見直し判断は migration 0043 で追加 (`opt-reuse-extend`)
  - 目的適合: 既存の照合 (matchSubVendor) と候補除外がそのまま新しい操作の保存先になり、G5 の『旧機能を失わない』と両立する。
- **dec-subs-legacy-ui**: 画像に無い既存の機能 (登録ベンダーの別名・対象科目の編集、四半期見直し、重複・急増アラート、ベンダー別前年比較表、未登録候補パネル) をどう扱うか。
  - 採択: 画像の部品 (詳細パネル・候補バッジ・検出理由カード・ステータス絞込) へ吸収し、旧 UI は撤去する (`opt-absorb-and-remove`)
  - 目的適合: 画面が画像どおりになり (G1)、旧機能の操作は詳細パネルと検出理由へ移って失われない (G5)。
- **dec-subs-fixture-authority**: 画像の数値 (一覧 8 行の月額の和 ¥9,778 に対し合計欄 ¥64,800 など、閉じていない) をテストの期待値にどう使うか。
  - 採択: 画像は構成・文言・配置の正本、数値は core が算出する検算済み fixture を正本とする (`opt-layout-from-image-numbers-from-fixture`)
  - 目的適合: 合計行 = 行の和、カテゴリ別合計 = 一覧合計 という G4 の一致条件を満たしたまま、画面は画像どおりに作れる。
- **dec-subs-kpi-definition**: KPI『月額のサブスク合計』『年換算の合計』と前期間比を何で定義するか。
  - 採択: 月額 = 最新月時点で継続中の各ベンダーの推定月額の和 (年額払いは 12 等分)。年換算 = 月額 ×12。前期間比 = 直前の同じ長さの期間の同じ定義の値との差 (`opt-sum-of-estimated-monthly`)
  - 目的適合: 一覧の『月額の推定』列の合計と KPI が同じ定義になり、合計行・カテゴリ別比較・KPI が一致する (G4)。

## 適用された設計知識

> 以下の deep knowledge card は設計判断を支援する**非規範の参考資料**であり、実装済み・検証済みの証拠ではない。カード内の `採否: applied` は設計採用を意味し、実装状態は意味しない。規範となる差分は本章の To-Be / Delta 節と参照先仕様で管理する。

### 本章での適用

Secure by Design card の『入力を許可リストで検証する』を、サブスクで利用者が書き込める 3 種の値に適用した。見直し判断は confirmed / dismissed の列挙、統合する別名は件数と長さを上限つきで縛った文字列配列、カテゴリは既定辞書の名前か長さ上限つきの自由記述とし、いずれも Zod で境界検証する。取引名とベンダー名は取込元に由来する外部文字列なので、画面ではテキストとしてだけ描く。カテゴリ辞書と口座の手がかりはコード内の固定表で持ち、判定のために取引名を外部へ送らない。

- (根拠の性質: アシスタントの推定 (利用者確認も検証可能な出典も経ていない) / 記録時刻: 2026-09-18T06:54:11Z)

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
| owasp-asvs-encoding | 5.0.0 | OWASP Foundation (github.com) | https://github.com/OWASP/ASVS/blob/master/README.md | 2026-09-18T03:49:46Z | 2026-09-18T03:50:20Z |
