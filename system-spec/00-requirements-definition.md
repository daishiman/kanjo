---
status: confirmed
category: requirements-definition
---

# 要件定義書 (上位概念)

> 本章は spec-state.json の requirements_foundation を正本とする、システム構築の憲法。
> 以降の各技術章は frontmatter の serves_goals でここ (ゴール) へトレース (anchor) する。
> 上位概念がブレなければ、仕様が整った後もブレない。

- 確定マーカー: `status: confirmed`

## U1 本質的目的 (essential_purpose)

支出分析の入口を、5 つの分析 (照合・総収支・マトリクス・推移・診断) のどこから見ればよいかを 1 画面で判断できるハブにする。利用者が支出分析を開いた時点で、期間の収支の結論と、各分析の要確認件数・変化・改善余地と優先度を見比べ、課題の発見から改善行動まで決まった読み順 (差異を消す→全体を掴む→偏りを見る→変化を追う→行動を決める) で迷わず進める状態にする。

## U2 背景 (background)

kanjo の支出分析 (packages/web/src/pages/Analysis.tsx) は /analysis/:tab の 5 タブ (支出照合・トータル収支・増減マトリクス・支出トレンド・統計診断) を持つが、/analysis を開くと先頭の照合タブへ Navigate で転送され (Analysis.tsx 39 行目)、全体を見渡す入口が無い。どのタブに要確認が溜まっているか、期間の収支がどうなっているかは各タブを開いて回らないと分からない。FINAL-UI の監査 (design/FINAL-UI/spec/AUDIT.md) は 03 支出分析を『要改善。実装の5タブ構造が弱い。親ナビ＋固定タブ＋URL保持を明示』と判定し、FUNCTION-MATRIX は主目的を『5分析を同じ文脈で移動』、必須を 5 タブ・URL 保持・各タブの要約・未処理件数としている。PR #49 (2026-09-14 マージ) でデザインシステム基盤 (トークン正本・共通 Button・チャート系列色・共通シェル) が入り、各画面の中身を FINAL-UI どおりに作り直すのは次サイクルとされた。利用者は 2026-09-14 に 03-analysis-hub.png を示し、この画面の UI/UX 改善と必要なバックエンド改善を依頼した。現行 API には、期間合計の総収入・総支出・純収支、前 12 か月比、改善余地の金額、優先度、マトリクスの正常判定を返す仕組みが無く (前期間の計算は packages/api/src/ai/dataset.ts の previousPeriod/yearAgoPeriod に AI 用として閉じている)、ハブを既存 5 API の同時呼出しで作ると『表示していないタブの API は呼ばない』既存方針 (analysis-tabs.dom.test.tsx) と衝突する。

## U3 ゴール (goals)

| ID | ゴール |
|---|---|
| G1 | /analysis を 03-analysis-hub.png どおりのハブ画面にする。短い問いの見出し・URL コピー・5 タブ・期間の収支サマリー (総収入/総支出/純収支と前 12 か月比、総収支の説明パネル)・分析ルート一覧 (# / 分析の視点 / 目的 / 現在の状態 / 要確認の優先度 / 次の操作)・右の選択中の分析パネル (わかること / 主なデータソース / 対象外のデータ / 開く)・分析の読み順 5 ステップ・下部の選択中分析バーを、共通シェル・トークン・Button の上に組む。 |
| G2 | 選択中の分析を URL (?focus=<tab id>) で保持し、URL コピー・再読込・戻る操作でも同じ分析が選ばれた状態を再現する。既存の /analysis/:tab 詳細と旧 URL の転送は壊さない。 |
| G3 | ハブに必要な集計を packages/core の純関数と、1 回で返す集約 API (GET /analysis/hub) に置く。期間の収支サマリーと前 12 か月比、5 視点それぞれの現在の状態 (照合の要確認件数・総収支の重複候補件数・マトリクスの正常判定・推移の支出前 12 か月比・診断の改善余地) と優先度を返し、ハブ表示中に 5 タブ分の既存 API を呼ばない。 |
| G4 | 優先度・マトリクスの正常判定・改善余地を単純で説明可能な規則として定義し、規則を docs に明記してテストで固定する。優先度は照合と総収支が要確認 1 件以上なら高・0 件なら中、他の 3 視点は中。マトリクスは未記録月 0 なら正常。改善余地は tradeoffCandidates の月額合計 × 12 の年額。 |
| G5 | 支出分析まわりの文言を画像に揃える。5 タブ名を 照合/総収支/マトリクス/推移/診断 の短縮形にし、サイドバーの支出分析の子行に要確認件数バッジを付ける。他画面のサイドバー文言と月次クローズ進捗の形は対象外とする。 |

## U4 目標 (objectives)

| ID | 目標 | 測定基準 |
|---|---|---|
| O1 | /analysis がハブを描画し、/analysis/:tab と旧 URL の転送は既存どおり動く。 | DOM テストで /analysis がハブの見出し・サマリー・ルート一覧 5 行・読み順 5 ステップ・選択中の分析パネルを描画し、/analysis/reconciliation 等の既存 5 タブと旧 URL のテストが緑のままである。 |
| O2 | ?focus=<tab id> の読み書きと URL コピーを実装する。 | DOM テストで ?focus=total-cashflow を開くと総収支行と右パネルと下部バーが選択状態になり、行を選ぶと URL が置き換わり、不正な focus 値は既定値に落ち、URL コピーが現在の URL をクリップボードへ書く。 |
| O3 | core に analysisHub(dataset) 相当の純関数を置き、API に GET /analysis/hub を足す。 | core 単体テストが期間合計・前 12 か月比 (前期間データ無しは null)・5 視点の状態・優先度・改善余地を固定データで検証し、API 統合テストが認証付きで 200 と期間メタを返し、ハブ表示中の DOM テストで既存 5 API への呼出しが 0 件である。 |
| O4 | 判定規則を docs に書き、境界値をテストで固定する。 | 要確認 0 件/1 件、未記録月 0/1、tradeoff 候補 0 件の境界でテストが規則どおりの値を返し、規則を変えるとテストが落ちる。 |
| O5 | 5 タブ名の短縮とサイドバー子行の件数バッジを入れる。 | routeMetadata の ANALYSIS_TABS label が短縮形になり、関連 DOM テスト (analysis-tabs / navigation-ux / common-shell-routes) を新しい文言で更新して緑、子行バッジは要確認 1 件以上の視点だけに件数を表示する。 |

## U5 成功基準 (success_criteria)

- S1 (G1): /analysis で 03-analysis-hub.png の構成要素 (問いの見出し・URL コピー・5 タブ・収支サマリー・分析ルート一覧・選択中の分析パネル・読み順・下部バー) がすべて描画され、色・余白・部品はトークンと共通 Button/PageShell 経由で、直書き色の lint が 0 件である。
- S2 (G2): ?focus= の値でハブの選択状態が再現され、/analysis/:tab と旧 URL 転送の既存テストが緑である。
- S3 (G3): ハブ表示中のネットワーク呼出しは GET /analysis/hub の 1 本で、既存 5 API の呼出しが 0 件である。
- S4 (G3, G4): core テストが前 12 か月比・優先度・正常判定・改善余地を境界値付きで検証し、規則が docs に明記されている。
- S5 (G5): 5 タブ名が短縮形で表示され、サイドバー子行の件数バッジが要確認件数と一致する。
- S6 (G1-G5): 既存の pnpm test / typecheck / lint と packages/web の check 系スクリプト (thead / mobile-layout / financial-figure / financial-routes) が全て緑のままで、狭幅 (68px アイコンレール・下部タブ) でもハブが横スクロールしない。

## U6 ステークホルダー (stakeholders)

- SH1 利用者 (単独の個人事業主): 月次クローズで支出分析を開いたとき、どの分析から確認すべきか (要確認が溜まっているのはどこか、収支は前年よりどうか、どこに改善余地があるか) を 1 画面で判断し、決まった読み順で改善行動までたどり着きたい。
- SH2 保守者 (同一人物、および Claude Code などのコーディングエージェント): ハブの判定規則が docs とテストで固定され、各タブの集計を二重実装せず core の純関数から得られること。

## U7 スコープ (scope)

- **対象 (in)**: /analysis のハブ画面 (03-analysis-hub.png の全構成要素) の新設と、/analysis から照合タブへの転送の廃止, 選択中の分析の URL 保持 (?focus=) と URL コピー, packages/core のハブ集計純関数 (期間合計・前 12 か月比・5 視点の状態・優先度・改善余地) と、前期間計算の api/ai/dataset.ts から core への移設, packages/api の集約エンドポイント GET /analysis/hub, 判定規則の docs 記載とテスト, 5 タブ名の短縮形化とサイドバー支出分析子行の件数バッジ、それに伴う既存 DOM テストの文言更新
- **対象外 (out)**: 5 タブ各詳細画面 (照合・総収支・マトリクス・推移・診断) の中身の作り直し: それぞれの画面サイクルで扱う, 支出分析以外のサイドバー文言 (明細仕分け・累計収支など) と月次クローズ進捗 3/4 チェックリストの形: 各画面のサイクルで扱う, 期間選択の保存先の変更: 期間は既存どおり localStorage で全画面共有し URL に載せない (docs/ui-decisions.md の既存判断を維持), D1 スキーマ・migration の変更: ハブは既存データからの集計だけで作る, スマートフォン・タブレット・デスクトップ専用アプリ: web SPA 1 系統のレスポンシブで扱う

## U8 制約 (constraints)

- C1 技術: pnpm monorepo (core は依存ゼロの純関数、api は Hono の Cloudflare Worker と D1、web は React 18 + react-router-dom 7 + TanStack Query 5)。集計は core に置き api/web へ重複実装しない。
- C2 デザイン: docs/design-system.md に従い、色は design-tokens.ts 由来のトークンだけを使い、ボタンは共通 Button (遷移は Link className=btn)、本文は PageShell、右パネルは --aside-panel-w 320px を使う。WCAG 2.2 AA (文字 4.5:1、部品 3:1) を維持する。
- C3 既存方針: 表示していないタブの API は呼ばない、タブ状態は URL (リンク) で持ち role=tab を手組みしない、現在地はサイドバー子行 1 件だけ (docs/ui-decisions.md)。
- C4 データ: 総収支は freee を正本とした消し込み済みの値を使い、未判断の重複候補は 4 区分の合計に入れない (feat-total-cashflow の不変条件を維持)。
- C5 体制: 利用者 1 名が保守し、コーディングエージェントが実装する。予算は既存の Cloudflare 無料/現行プランの範囲。

## U9 具体的にやりたいこと (concrete_intents)

| ID | やりたいこと | 資するゴール |
|---|---|---|
| I1 | /analysis の転送をやめ、ハブ画面 (AnalysisHub) を描画する。5 タブのリンクは既存 /analysis/:tab へ進む。 | G1 |
| I2 | 分析ルート一覧の行選択で ?focus= を置き換え、右パネルと下部バーの内容を切り替える。URL コピーは現在の URL をクリップボードへ書き、成否を知らせる。 | G1, G2 |
| I3 | 期間の収支サマリーに総収入・総支出・純収支と前 12 か月比 (増減率と前期間の金額) を出し、純収支の説明パネルを右に置く。前期間データが無い場合は比較を『比較データなし』と表示する。 | G1, G3 |
| I4 | core にハブ集計関数を置き、GET /analysis/hub が期間メタ・サマリー・5 視点の状態・優先度を返す。前期間の計算は core へ移し AI 側もそれを使う。 | G3 |
| I5 | 優先度・マトリクス正常判定・改善余地の規則を docs/ui-decisions.md (または docs 配下の分析ハブ文書) に書き、境界値テストで固定する。 | G4 |
| I6 | ANALYSIS_TABS の label を 照合/総収支/マトリクス/推移/診断 にし、サイドバー子行に要確認件数バッジを付ける。 | G5 |
| I7 | 各視点の『わかること・主なデータソース・対象外のデータ』を routeMetadata の静的定義として構造化し、右パネルがそれを表示する。 | G1 |

## 確定の接地根拠 (承認)

> 上の `status` を確定たらしめている利用者承認の実体。承認範囲がここに現れない項目は、本章の確定内容ではない。

### 承認: `appr-foundation-analysis-hub-001`

利用者が 2026-09-14 に AskUserQuestion で、上位概念 U1-U9 の要約 (U1=支出分析の入口を 5 分析のどこから見るか 1 画面で判断できるハブにし読み順で改善行動まで進める / G1 /analysis を画像どおりのハブに・G2 ?focus= の URL 保持と URL コピー・G3 core 純関数と GET /analysis/hub・G4 優先度/正常判定/改善余地 (tradeoff 月額合計×12) を docs とテストで固定・G5 タブ名短縮とサイドバー子行の件数バッジ / U7 対象外=5 タブ詳細の中身・他画面のサイドバー文言と月次進捗・期間保存先・D1 スキーマ変更・専用アプリ、platform=web のみ / U8=集計は core・トークンと共通部品・非表示タブの API は呼ばない・総収支の消し込み不変条件 / 注意=件数バッジのためハブ API を全画面で 1 本呼ぶ) に対し『この内容で承認』を選択した。選択肢には『バッジは支出分析内だけ』『修正が必要』もあった。承認時刻の上限は回答直後に date -u で実測した 2026-09-14T11:36:12Z。basis=user-decision。

#### この承認を名指ししている質疑: `qa-target-platforms-ah-001`

**問**

本サイクル (支出分析ハブ 03-analysis-hub の UI/UX 改善と必要なバックエンド改善) の対象プラットフォームはどれか。対象外は理由を述べる。

**答**

web のみを対象とする。解決する課題 (JTBD) は『月次クローズで支出分析を開いたとき、5 つの分析のどこから確認すべきかを 1 画面で判断し、読み順どおりに改善行動まで進みたい』である。対象ユーザーは単独の個人事業主 1 名 (唯一の利用者・保守者) と、その保守を手伝うコーディングエージェント。配信は Cloudflare Workers 上の React SPA 1 系統で、狭幅は既存のレスポンシブ (68px アイコンレール・下部タブ) の中でハブを縦積みにして扱う。スマートフォン・タブレット・デスクトップの専用アプリは上位概念 U7 のスコープ外として対象外とする。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: 対象ユーザーと JTBD は利用者の依頼文 (2026-09-14『03-analysis-hub.png … 画面の改善を行ってほしい。これに伴って UI、UX の改善と、バックエンドも改善が必要であれば整えてほしい』) に由来する。platform を web に限る点は上位概念の承認 appr-foundation-analysis-hub-001 で利用者が承認した。answered_at は承認直後に date -u で実測した時刻で、選択時刻の上限値。 / 回答時刻: 2026-09-14T11:36:12Z)

#### この承認を名指ししている質疑: `qa-database-web-ah-observed-001`

**問**

ハブの集計はどのデータを読み、D1 スキーマや migration の変更は要るか。

**答**

D1 (binding DB、drizzle-orm)。loadDataset(db, userId) は monthly_agg・restored_monthly_agg ほか取引系テーブルを userId で読み Dataset を組む (packages/api/src/store.ts)。総収支は加えて freee_deals・duplicate_verdicts・freee_deal_exclusions を userId で読む (routes/total-cashflow.ts)。ハブの 5 視点の状態・収支サマリー・前期間比はいずれもこれら既存テーブルからの集計で出せるため、新しいテーブル・列・migration は不要 (最新 migration は 0039_account_login.sql のまま)。書込は発生せず読み取りだけで、ハブ API は canonicalMutationFence の対象外 (GET)。

- (根拠の性質: コード・設定・公式文書で検証できる観測事実 / 出所: アシスタントが 2026-09-14 にリポジトリ (HEAD 2162fd2) の該当ファイルを読んで確認した観測事実。answered_at は確認直後に date -u で実測した時刻。 対象: packages/api/src/store.ts, packages/api/src/routes/total-cashflow.ts, migrations/。スキーマ変更をしない点は上位概念 U7 (appr-foundation-analysis-hub-001) でも利用者が承認した。 / 回答時刻: 2026-09-14T11:38:26Z)

#### この承認を名指ししている質疑: `qa-security-web-ah-observed-001`

**問**

ハブで扱う情報のセキュリティ上の前提 (公開範囲・共有 URL・ヘッダー・外部送信) は何か。

**答**

index.ts は secureHeaders と requestId を全体に掛け、/api/* は認証と runtimeSchemaGuard の後にある。ハブ API は利用者本人の集計値だけを返し、外部サービスへ送らない (画像フッター『取込データは外部送信しません』と一致)。URL コピーが書く URL は /analysis?focus=<tab id> で、金額・取引・期間などの財務情報をクエリに含めない (期間は localStorage のまま)。共有された URL を他人が開いても認証が要り、自分のデータしか見えない。focus 値は ANALYSIS_TABS の id の許可リストで検証し、不正値は既定値に落とす (任意文字列を DOM へ反映しない)。クリップボード書込は利用者の明示クリック時だけ行う。

- (根拠の性質: コード・設定・公式文書で検証できる観測事実 / 出所: アシスタントが 2026-09-14 にリポジトリ (HEAD 2162fd2) の該当ファイルを読んで確認した観測事実。answered_at は確認直後に date -u で実測した時刻。 対象: packages/api/src/index.ts, design/FINAL-UI/images/03-analysis-hub.png のフッター。focus を URL に持ち期間を URL に載せない点は利用者決定 qa-analysis-hub-decision-001 と承認 appr-foundation-analysis-hub-001 に基づく。 / 回答時刻: 2026-09-14T11:38:26Z)

## 意思決定支援 (decisions)

- (意思決定支援の記録なし)
