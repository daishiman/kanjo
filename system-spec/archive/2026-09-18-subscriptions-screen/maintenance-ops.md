---
status: confirmed
category: maintenance-ops
aggregate: 確定
spec_cells: [maintenance-ops.web, maintenance-ops.mobile, maintenance-ops.tablet, maintenance-ops.desktop-windows, maintenance-ops.desktop-linux, maintenance-ops.desktop-macos]
serves_goals: [G3, G4, G5]
---

# 保守運用管理 (maintenance-ops)

- カテゴリ集約状態: **確定**
- 章確定マーカー: `status: confirmed`

## カテゴリ別収集状態

| プラットフォーム | 状態 | 根拠 |
|---|---|---|
| Web (web) | 確定 | 確定質疑: qa-subs-maintenance-ops-web-004。裏付け質疑 (`qa_refs`): `qa-subs-maintenance-ops-web-evidence-001`, `qa-subs-maintenance-ops-web-003` — 本章の「確定内容 (質疑録)」へ接地根拠として併記。資するゴール: G3, G4, G5 |
| モバイル (mobile) | 対象外 | 理由: スマートフォン向け専用アプリなら、OS 版ごとの実機テストと、ストア審査を含むリリース手順を運用する必要があった。対象を web のみとする利用者決定 (qa-subs-target-platforms-001) によりその検討は発生しない。 |
| タブレット (tablet) | 対象外 | 理由: タブレット向け専用アプリなら、画面サイズ別の見た目検査を追加で運用する必要があった。対象を web のみとする利用者決定 (qa-subs-target-platforms-001) によりその検討は発生しない。 |
| デスクトップ (Windows) (desktop-windows) | 対象外 | 理由: Windows 向けデスクトップアプリなら、インストーラのテストと更新の段階配信を運用する必要があった。対象を web のみとする利用者決定 (qa-subs-target-platforms-001) によりその検討は発生しない。 |
| デスクトップ (Linux) (desktop-linux) | 対象外 | 理由: Linux 向けデスクトップアプリなら、ディストリビューションごとの動作確認を運用する必要があった。対象を web のみとする利用者決定 (qa-subs-target-platforms-001) によりその検討は発生しない。 |
| デスクトップ (macOS) (desktop-macos) | 対象外 | 理由: macOS 向けデスクトップアプリなら、署名証明書の更新と公証の失敗対応を運用する必要があった。対象を web のみとする利用者決定 (qa-subs-target-platforms-001) によりその検討は発生しない。 |

## 上流指針 (doctrine anchors)

> 本章の設計判断が従う上流の正本 (1 concern 1 authority)。具体技術ではなく上流工程を導く規範であり、下位の技術選定は本節と矛盾してはならない。正本: `ref-system-design-knowledge/references/doctrine-anchor-registry.json`

| 設計 concern | 上流の正本 (authority) | 導く範囲 | 出典 | 最終確認 | 本章の確定セルへの反映 |
|---|---|---|---|---|---|
| operations | Google SRE | 運用手順・障害対応・トイル削減・ポストモーテムの上流指針 | https://sre.google/workbook/ | 2026-07-12 | サブスクの見直し規則・閾値・理由文テンプレートを docs/subscriptions-screen.md に表で書き、規則の変更は docs と core のテストを同じ変更で直す運用へ反映した。check-financial-visuals のモックを新しい応答の形へ更新し、図の数とロゴ画像要素 0 件を見た目検査に足す。旧 UI のテスト (subs-review.dom.test.tsx・SubVendors.dom.test.tsx) は移設先の部品テストへ移し、移した操作の対応表を PR に残す。 |

> **未記入** の行は、上流の正本を掲げただけで本章の確定内容へ反映した箇所を示せていない。表への出現は反映の証拠ではない。

## 確定内容 (質疑録)

> 本章の各確定セルが何を根拠に確定したかの実体。`qa_ref` が主たる接地根拠、`qa_refs` がそれを支える裏付け質疑であり、いずれも qa_log (spec-state.json) の逐語である。ここに現れない主張は本章の確定内容ではない。

### Web (web)

- 資するゴール: G3, G4, G5

#### 主たる接地根拠: `qa-subs-maintenance-ops-web-004`

**問**

web のサブスク画面の maintenance-ops 要件は何か。(このうち利用者が実際に選んだ部分)

**答**

利用者の決定が保守へ及ぶのは次の 2 点である。(1) 画像の数値は閉じていないため写さず、core が算出する検算済み fixture をテストの正本とする。(2) 見直し候補の規則と文テンプレートは docs とテストで固定する。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: AskUserQuestion で選択された dec-subs-fixture-authority と dec-subs-review-candidate。 / 回答時刻: 2026-09-18T03:36:08Z)

#### 裏付け質疑: `qa-subs-maintenance-ops-web-evidence-001`

**問**

maintenance-ops 章の裏付けとして、サブスクの既存テストと見た目検査は何を固定しているか。

**答**

core/test/subs-contract.test.ts と subs-review-contract.test.ts が照合・候補採点・四半期見直しを、api/src/subs-vendor-scope.test.ts が API の利用者の絞り込みを、web/src/subs-review.dom.test.tsx と components/SubVendors.dom.test.tsx が旧 UI の操作を固定している。packages/web/scripts/check-financial-visuals.mjs は /api/subscriptions をモックして Subscriptions 画面の図の数 (expectedFigures: 1) を検査している。参照画像の数値は閉じていない — 一覧 8 行の『月額の推定』の和は ¥9,778 だが合計行は ¥64,800 である。

- (根拠の性質: コード・設定・公式文書で検証できる観測事実 / 出所: テストと検査スクリプトの読解、および参照画像の数値の検算 (2026-09-18)。 / 回答時刻: 2026-09-18T03:44:05Z)

#### 裏付け質疑: `qa-subs-maintenance-ops-web-003`

**問**

web のサブスク画面の maintenance-ops 要件のうち、agent が補完した設計判断は何か。

**答**

(1) 検算済み fixture を core のテストに置き、推定月額・継続中・年額払い・前期間比・カテゴリ辞書と上書き・口座 3 分類とカバー率・見直し候補の 5 規則の境界値を固定する。金額は整数の toBe、割合は許容幅つきの toBeCloseTo で比べる。(2) 一覧の合計行 = 行の和、カテゴリ別比較の合計 = 一覧の合計、KPI の月額 = 一覧の合計、直近 12 か月の支払額 = 既存 last12Total を、同じ fixture で突き合わせるテストを置く。(3) 旧 UI のテストは新しい部品のテストへ移し、移した操作の一覧で欠落 0 件を確かめる。(4) check-financial-visuals のモックを新しい応答の形に更新し、ロゴ画像要素が 0 件であることを検査に足す。(5) 見直し候補の規則・閾値・文テンプレートは docs/subscriptions-screen.md に書き、規則を変えるときは docs とテストを同じ変更で直す。

- (根拠の性質: アシスタントの推定 (利用者確認も検証可能な出典も経ていない) / 出所: 既存のテスト構成と前サイクル (マトリックス・推移) の検査の書き方からの agent の設計判断。 / 回答時刻: 2026-09-18T03:44:05Z)

## To-Be / Delta

> 本章の**規範**。上位概念 (要件定義書 U3 ゴール / U4 目標 / U9 具体的やりたいこと) を本章の serves_goals で絞り込んだ射影であり、設計知識 card (非規範の参考資料) とは役割が異なる。As-Is (現行実装の姿) は spec-state.json の管轄外のため本節では断定せず、到達点と、その到達を判定する観測点だけを規範として置く。

### 到達すべき状態 (To-Be)

- **G3**: 『見直し候補』を core の純関数で決定論的に判定し、KPI の件数・一覧の候補バッジ・『サブスク候補の検出理由』カードに同じ結果を出す。理由は AI を呼ばず、同じカテゴリ内の重複 / 金額の急増 / 直近の値上げ / 四半期見直しの期限切れ などの規則を判定し、金額・件数・月数を差し込む定型文で生成する。カードから『候補を採用』『候補から除外』『この候補を詳しく見る』を操作できる。規則と文テンプレートを docs に明記しテストで固定する。
- **G4**: サブスク画面の数値を core の純関数 1 か所で算出し、GET /subscriptions をその形へ拡張する。推定月額 (年額払いは 12 等分) とその合計・年換算・前期間比 (直前の同じ長さの期間の最新月時点との差)、直近 12 か月の支払額、売上比、正規化名→カテゴリの既定辞書と利用者上書き、口座名の手がかりによる 銀行 / カード / 電子マネー の 3 分類とカバー率 (取込済み口座数 / 口座数、期間の口座×月のうち取引がある割合)、カテゴリ別の月次推移と年換算比較、見直し候補を算出する。既存の sourceNeutralSubscriptions・サイドバーのバッジ件数・総収支 / 推移の数値と突き合わせて一致させる。
- **G5**: 保存は既存表を再利用して拡張し、画像に無い旧 UI は画像の部品へ吸収して撤去する。名称の統合=既存ベンダーの aliases 追加、未登録候補の採用=sub_vendors 登録・除外=sub_vendor_exclusions、登録済みベンダーの見直し候補への判断 (確認 / 除外) とカテゴリは migration 0043 で足す。登録ベンダーの別名・対象科目の編集、四半期見直し、重複・急増アラート、未登録候補の各機能は失わず、詳細パネル・候補バッジ・検出理由・ステータス絞込へ移す。サイドバー・ヘッダー・フッター・月次クローズ進捗は既存実装をそのまま使う。

### 受入条件 (Delta の判定点)

| 目標 | 到達点 | 達成の観測点 (measure) |
|---|---|---|
| O3 | 見直し候補の判定と理由文が規則どおりに出る。 | core の単体テストで各規則の境界値と理由文テンプレートが固定され、KPI 件数・一覧バッジ・検出理由カードの件数が同一入力で一致する。 |
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

Clean Code card の『テストは仕様を名前で語る』をサブスクの検証設計に適用した。見直し候補の 5 規則・推定月額・継続中・年額払い・カバー率の境界値を、規則名をそのままテスト名にした core のテストで固定し、画像の数値ではなく検算済み fixture を期待値にする。一覧の合計行・カテゴリ別比較の合計・KPI の月額が同じ fixture で一致することを突き合わせるテストを置き、旧 UI のテストは移設した操作の一覧で欠落 0 件を確かめる。規則を変えるときは docs/subscriptions-screen.md とテストを同じ変更で直す。

- (根拠の性質: アシスタントの推定 (利用者確認も検証可能な出典も経ていない) / 記録時刻: 2026-09-18T03:48:08Z)

### Clean Code — deep knowledge card

- 出典カード: `ref-system-design-knowledge/references/clean-code.md`

#### 目的

codeを、次の変更者が意図・制約・failureを短時間で理解し、安全に変更・検証できる作業媒体にする。

#### 解決する問題

- 名前と抽象度が意図を表さず、readerが実装詳細からbusiness ruleを逆算する。
- 一つの変更理由が複数moduleへ散り、副作用とerror pathを予測できない。
- 重複したruleが別々に更新され、仕様のSSOTが崩れる。
- testがimplementation detailへ結合し、refactoringを妨げる。

#### 適用条件

- 複数人・長期保守・高変更頻度・重要ruleがあり、理解と変更の費用が支配的。
- test/lint/review/observabilityで改善効果をfeedbackできる。
- domain languageとcoding conventionをteamで合意・更新できる。

#### 非適用条件

- throwaway explorationでは全規則を先行適用せず、学習後に残すcodeだけを整理する。
- generated/vendor codeへ手動styleを強制しない。generation inputとboundaryを管理する。
- 短い関数、class化、DRY等を絶対値として扱い、局所的な明瞭さを悪化させる場合は適用しない。

#### トレードオフ・失敗モード

- naming/refactoring/testへ時間を使うため、寿命とriskが低いcodeでは投資超過になり得る。
- micro-function化でcontrol flowが多数fileへ散り、かえって読みにくくなる。
- DRYを急ぎ、異なるdomain conceptを一つの抽象へ結合して変更を難しくする。
- commentを全否定して、理由、trade-off、外部制約、security decisionまで消す。
- coverageやlint scoreを目的化し、重要behaviorの未検証を隠す。

#### goalへの寄与

- goalに関わるbusiness ruleを名前とtestで明示し、仕様→code→evidenceのtraceを短くする。
- maintenance objectiveには変更lead time、review指摘、escaped defect、rollback率などのoutcomeを使う。
- 無料toolの導入自体を成功とせず、teamが継続運用でき、重要riskを減らすかで判断する。

## 最新ドキュメント出典

| 対象 | バージョン | 公式発行元 | 出典URL | 取得 | 最新確認 |
|---|---|---|---|---|---|
| vitest-expect | 5.0.1 | Vitest (vitest.dev) | https://vitest.dev/api/expect.html | 2026-09-18T03:49:46Z | 2026-09-18T03:50:20Z |
