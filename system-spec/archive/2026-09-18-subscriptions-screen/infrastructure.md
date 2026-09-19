---
status: confirmed
category: infrastructure
aggregate: 確定
spec_cells: [infrastructure.web, infrastructure.mobile, infrastructure.tablet, infrastructure.desktop-windows, infrastructure.desktop-linux, infrastructure.desktop-macos]
serves_goals: [G4]
---

# インフラ (infrastructure)

- カテゴリ集約状態: **確定**
- 章確定マーカー: `status: confirmed`

## カテゴリ別収集状態

| プラットフォーム | 状態 | 根拠 |
|---|---|---|
| Web (web) | 確定 | 確定質疑: qa-subs-infrastructure-web-004。裏付け質疑 (`qa_refs`): `qa-subs-infrastructure-web-evidence-001`, `qa-subs-infrastructure-web-003` — 本章の「確定内容 (質疑録)」へ接地根拠として併記。資するゴール: G4 |
| モバイル (mobile) | 対象外 | 理由: スマートフォン向け専用アプリなら、ストアでの配布と審査、バックグラウンドでの取込同期の実行環境を決める必要があった。対象を web のみとする利用者決定 (qa-subs-target-platforms-001) によりその検討は発生しない。 |
| タブレット (tablet) | 対象外 | 理由: タブレット向け専用アプリなら、スマートフォン版と共通の配布経路にするか別ビルドにするかを決める必要があった。対象を web のみとする利用者決定 (qa-subs-target-platforms-001) によりその検討は発生しない。 |
| デスクトップ (Windows) (desktop-windows) | 対象外 | 理由: Windows 向けデスクトップアプリなら、インストーラの配布と自動更新の配信元を決める必要があった。対象を web のみとする利用者決定 (qa-subs-target-platforms-001) によりその検討は発生しない。 |
| デスクトップ (Linux) (desktop-linux) | 対象外 | 理由: Linux 向けデスクトップアプリなら、パッケージ形式 (AppImage・deb など) と配布先を決める必要があった。対象を web のみとする利用者決定 (qa-subs-target-platforms-001) によりその検討は発生しない。 |
| デスクトップ (macOS) (desktop-macos) | 対象外 | 理由: macOS 向けデスクトップアプリなら、署名と公証を含む配布と自動更新を決める必要があった。対象を web のみとする利用者決定 (qa-subs-target-platforms-001) によりその検討は発生しない。 |

## 上流指針 (doctrine anchors)

> 本章の設計判断が従う上流の正本 (1 concern 1 authority)。具体技術ではなく上流工程を導く規範であり、下位の技術選定は本節と矛盾してはならない。正本: `ref-system-design-knowledge/references/doctrine-anchor-registry.json`

| 設計 concern | 上流の正本 (authority) | 導く範囲 | 出典 | 最終確認 | 本章の確定セルへの反映 |
|---|---|---|---|---|---|
| reliability | Google SRE | SLO/エラーバジェット・冗長性・スケーリング・監視の上流指針 | https://sre.google/books/ | 2026-07-12 | サブスクの初回表示を、明細件数ではなくベンダー数 × 月数に比例する集計値の応答に限る形へ反映した。取引の実体は詳細パネルで選んだ 1 ベンダーぶんだけを上限つきで返すため、明細が増えても初回の応答サイズと Worker の CPU 時間が伸びにくい。集計に失敗した場合は画面全体を error にし、部分的に古い数字を混ぜて見せない。 |
| operations | Google SRE | 運用手順・障害対応・トイル削減・ポストモーテムの上流指針 | https://sre.google/workbook/ | 2026-07-12 | サブスクの変更に伴う運用手順を『migration 0043 を Migrate で適用してから Deploy する』の 1 本に絞る形へ反映した。新しい binding・secret・cron・外部サービスは追加しないため、環境変数や Cloudflare 側の設定変更は発生しない。適用後の確認は GET /api/subscriptions の応答に category と reviewCount が含まれることで行う。 |

> **未記入** の行は、上流の正本を掲げただけで本章の確定内容へ反映した箇所を示せていない。表への出現は反映の証拠ではない。

## 確定内容 (質疑録)

> 本章の各確定セルが何を根拠に確定したかの実体。`qa_ref` が主たる接地根拠、`qa_refs` がそれを支える裏付け質疑であり、いずれも qa_log (spec-state.json) の逐語である。ここに現れない主張は本章の確定内容ではない。

### Web (web)

- 資するゴール: G4

#### 主たる接地根拠: `qa-subs-infrastructure-web-004`

**問**

web のサブスク画面の infrastructure 要件は何か。(このうち利用者が実際に選んだ部分)

**答**

利用者の決定が実行環境へ及ぶのは次の 2 点である。(1) カテゴリと見直し候補の理由を AI で作らないため、外部の推論サービスを実行環境へ追加しない。(2) サービスのロゴを取得しないため、外部の画像取得やその保存先を追加しない。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: AskUserQuestion で選択された dec-subs-category / dec-subs-review-candidate と、最初の依頼文のロゴ不要の指示。 / 回答時刻: 2026-09-18T03:36:08Z)

#### 裏付け質疑: `qa-subs-infrastructure-web-evidence-001`

**問**

infrastructure 章の裏付けとして、サブスクの画面と API はどこで動いているか。

**答**

kanjo は 1 つの Cloudflare Worker が API (Hono) と web の静的配信 (Workers Assets) を兼ね、データは D1、バックアップは R2 に置いている。GET /api/subscriptions は期間の Dataset と freee の仕訳を D1 から読み、Worker 内の純関数で集計して返す。外部の推論サービスは本機能では使っていない。

- (根拠の性質: コード・設定・公式文書で検証できる観測事実 / 出所: packages/api の構成と routes/analytics.ts の読解 (2026-09-18)。 / 回答時刻: 2026-09-18T03:44:05Z)

#### 裏付け質疑: `qa-subs-infrastructure-web-003`

**問**

web のサブスク画面の infrastructure 要件のうち、agent が補完した設計判断は何か。

**答**

(1) 配信構成 (Worker・Workers Assets・D1・R2・cron) と binding は変えない。新設はすべて同じ Worker 内の route。(2) 初回表示の応答はベンダー数 × 月数に比例する集計値に限り、取引の実体は詳細パネルの選択後に 1 ベンダーぶんだけ返す (直近 3 件と件数、取引履歴タブは期間内を上限つきで返す)。これで Worker の CPU 時間とレスポンスの大きさを明細件数から切り離す。(3) migration 0043 は既存の Migrate → Deploy の手順で適用する。

- (根拠の性質: アシスタントの推定 (利用者確認も検証可能な出典も経ていない) / 出所: 既存の配信構成と Cloudflare Workers の上限の読解にもとづく agent の設計判断。 / 回答時刻: 2026-09-18T03:44:05Z)

## To-Be / Delta

> 本章の**規範**。上位概念 (要件定義書 U3 ゴール / U4 目標 / U9 具体的やりたいこと) を本章の serves_goals で絞り込んだ射影であり、設計知識 card (非規範の参考資料) とは役割が異なる。As-Is (現行実装の姿) は spec-state.json の管轄外のため本節では断定せず、到達点と、その到達を判定する観測点だけを規範として置く。

### 到達すべき状態 (To-Be)

- **G4**: サブスク画面の数値を core の純関数 1 か所で算出し、GET /subscriptions をその形へ拡張する。推定月額 (年額払いは 12 等分) とその合計・年換算・前期間比 (直前の同じ長さの期間の最新月時点との差)、直近 12 か月の支払額、売上比、正規化名→カテゴリの既定辞書と利用者上書き、口座名の手がかりによる 銀行 / カード / 電子マネー の 3 分類とカバー率 (取込済み口座数 / 口座数、期間の口座×月のうち取引がある割合)、カテゴリ別の月次推移と年換算比較、見直し候補を算出する。既存の sourceNeutralSubscriptions・サイドバーのバッジ件数・総収支 / 推移の数値と突き合わせて一致させる。

### 受入条件 (Delta の判定点)

| 目標 | 到達点 | 達成の観測点 (measure) |
|---|---|---|
| O4 | 画面の数値が core の 1 か所から出て既存と一致する。 | core 単体テストで推定月額・年換算・前期間比・カバー率・カテゴリ別集計の境界値が緑、API 統合テストで GET /subscriptions の新しい形が返り、合計行 = 行の和、カテゴリ別合計 = 一覧合計、直近 12 か月の支払額が既存 last12Total と一致する。 |

### 本章がかなえる具体的やりたいこと (U9)

- **I3**: core に見直し候補の判定関数と理由文テンプレートを置き、KPI・一覧・検出理由カード・サイドバーのバッジが同じ関数を使う。
- **I4**: core に推定月額・前期間比・カテゴリ辞書・口座 3 分類とカバー率・カテゴリ別集計の純関数を置き、GET /subscriptions がそれを返す。
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
- **dec-subs-fixture-authority**: 画像の数値 (一覧 8 行の月額の和 ¥9,778 に対し合計欄 ¥64,800 など、閉じていない) をテストの期待値にどう使うか。
  - 採択: 画像は構成・文言・配置の正本、数値は core が算出する検算済み fixture を正本とする (`opt-layout-from-image-numbers-from-fixture`)
  - 目的適合: 合計行 = 行の和、カテゴリ別合計 = 一覧合計 という G4 の一致条件を満たしたまま、画面は画像どおりに作れる。
- **dec-subs-kpi-definition**: KPI『月額のサブスク合計』『年換算の合計』と前期間比を何で定義するか。
  - 採択: 月額 = 最新月時点で継続中の各ベンダーの推定月額の和 (年額払いは 12 等分)。年換算 = 月額 ×12。前期間比 = 直前の同じ長さの期間の同じ定義の値との差 (`opt-sum-of-estimated-monthly`)
  - 目的適合: 一覧の『月額の推定』列の合計と KPI が同じ定義になり、合計行・カテゴリ別比較・KPI が一致する (G4)。

## 適用された設計知識

> 以下の deep knowledge card は設計判断を支援する**非規範の参考資料**であり、実装済み・検証済みの証拠ではない。カード内の `採否: applied` は設計採用を意味し、実装状態は意味しない。規範となる差分は本章の To-Be / Delta 節と参照先仕様で管理する。

### 本章での適用

infrastructure に対応する design card は C04 の resource-map に 0 件であり、card からの引用は行っていない。代わりに Cloudflare Workers の上限 (CPU 時間・応答サイズ) を設計の制約として扱い、初回表示の応答をベンダー数 × 月数の集計値に限って、取引の実体は詳細パネルで選んだ 1 ベンダーぶんだけ返す形にした。配信構成・binding・cron は変えず、migration 0043 は既存の Migrate → Deploy の順で適用する。

- (根拠の性質: アシスタントの推定 (利用者確認も検証可能な出典も経ていない) / 記録時刻: 2026-09-18T03:48:08Z)

- `ref-system-design-knowledge/references/resource-map.yaml` (本章へ引く card は 0 件。未着手ではなく、上の適用記述で0 件である理由を述べた上での確定である)

## 最新ドキュメント出典

| 対象 | バージョン | 公式発行元 | 出典URL | 取得 | 最新確認 |
|---|---|---|---|---|---|
| cloudflare-workers-limits | 2026-09-05 | Cloudflare (developers.cloudflare.com) | https://developers.cloudflare.com/workers/platform/limits/ | 2026-09-18T03:49:46Z | 2026-09-18T03:50:20Z |
| cloudflare-workers-ai-pricing | 2026-09-17 | Cloudflare (developers.cloudflare.com) | https://developers.cloudflare.com/workers-ai/platform/pricing/ | 2026-09-18T03:49:46Z | 2026-09-18T03:50:20Z |
