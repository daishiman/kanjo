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

外出先や片手操作のモバイル環境でも、収支の変化・異常・次に確認すべきことをグラフと要約から即座に理解し、見落としや誤操作なく判断を完了できるようにする。

## U2 背景 (background)

現行Webアプリはナビゲーションや一部の表をモバイル対応済みだが、財務グラフ・比較図・高密度情報はデスクトップ前提が残り、モバイルでは表示欠落、狭幅での判読困難、横スクロール中の文脈喪失が起き得る。直前featureは現在地と画面探索を改善したため、今回は画面内の財務可視化と主要操作をAppleのモバイル設計原則に照らして見直す。

## U3 ゴール (goals)

| ID | ゴール |
|---|---|
| G1 | 本番D1のスキーマをコードが前提とする最新版へ復旧し、データ取込と取込履歴が正常に動作する状態へ戻す |
| G2 | Migrate の人間承認による適用と Deploy の fail-closed 検査を分離し、コード配信とスキーマ適用が乖離したまま本番へ到達しない状態を構造的に保証する |
| G3 | 万一乖離した場合でも、利用者と開発者が原因を即座に特定できる検知と説明可能なエラー応答を備える |
| G4 | 復旧作業を通じて本番の既存データを一件も失わない |
| G5 | モバイルでもデスクトップと同じ財務上の結論へ到達でき、グラフや重要状態が幅を理由に消えない |
| G6 | 情報の優先順位を利用頻度と失敗コストで整理し、片手・短時間でも主状態と次の操作を迷わず認識できる |
| G7 | iPhoneを含むタッチ端末で安全領域、可読性、44px以上の操作領域、ズーム、支援技術を一貫して満たす |
| G8 | 匿名fixtureによる実描画検査でモバイルとデスクトップの情報同等性を継続的に保証する |

## U4 目標 (objectives)

| ID | 目標 | 測定基準 |
|---|---|---|
| O1 | 作業開始時の remote list と repository head から確定した承認済み pending manifest を本番 D1 へ適用完了する | manifest の全項目が適用済みで、同じ repository head / ordered migrations digest に対する未適用が 0 件 |
| O2 | 取込実行と取込履歴のエンドポイントが正常応答へ戻る | POST /api/imports と GET /api/imports が本番で 5xx を返さず、画面のサーバーエラー表示が消える |
| O3 | CI/CD の Deploy が Worker 配信前に migration 状態を読み取り検査する | 未適用が 1 件以上、または判定不能なら非ゼロ終了し、Worker 配信へ進まない。Deploy は migration を適用しない |
| O4 | スキーマ版数の不一致を実行時に検知する | 期待版と実際の適用版が不一致のとき、原因を示す専用エラーコードで応答し、汎用のサーバーエラー表示にしない |
| O5 | 適用前バックアップから復元可能な状態を確保する | 適用直前のバックアップが取得済みで、行数比較により適用前後のデータ件数が保全されている |
| O6 | 全財務chart/figureを360px・375px・390pxで表示または意味等価な要約へフォールバックさせる | 対象figureの欠落0件、canvasまたは意味等価なtable/summaryが各対象に1件以上 |
| O7 | ページ全体の意図しない横スクロールをなくし、高密度表は文脈を保つ局所スクロールまたはカードへ変換する | document scrollWidthがviewport幅以下、例外は明示されたscroll container内のみ |
| O8 | モバイルの主要操作をタッチ・キーボード・読み上げで完了可能にする | coarse pointerの主要操作領域44×44 CSS px以上、focus-visible欠落0、色だけに依存する状態0 |
| O9 | 実Chromeのviewport/zoom検査へ財務グラフの可視性・寸法・legend/tooltip代替・情報同等性を追加する | 360/375/390px、tablet、desktop、200%相当の回帰検査がexit0 |

## U5 成功基準 (success_criteria)

- モバイル幅で主要な財務グラフ・比較図がCSSやレイアウト都合で非表示にならない
- グラフを操作しなくても見出し・要約・凡例・値の代替表から結論を理解できる
- グラフの軸・ラベル・凡例が狭幅で重なった場合は、表示密度を下げても意味情報を失わない
- safe-areaと下部タブバーに本文・操作・tooltipが隠れない
- ページ全体の横あふれ、44px未満の主要タップ領域、200%拡大時の情報欠落が0件
- 匿名データだけを使うunit/DOM/build/実描画回帰検査がすべてPASSする

## U6 ステークホルダー (stakeholders)

- {'id': 'S1', 'role': '個人事業の記帳・収支確認を行う本人', 'need': '移動中や短い空き時間に、今月の収支・異常・次の確認先を片手で判断したい'}
- {'id': 'S2', 'role': '会計に不慣れな利用者', 'need': 'グラフの読み方を覚えなくても、結論と次の行動を平易な日本語で理解したい'}
- {'id': 'S3', 'role': '開発兼運用者', 'need': '画面追加やChart.js更新でモバイルだけ情報が消える退行を自動検出したい'}
- {'id': 'S4', 'role': 'キーボード・ズーム・読み上げを利用する人', 'need': '視覚・ポインタ操作だけに依存せず同じ情報と操作へ到達したい'}

## U7 スコープ (scope)

- **対象 (in)**: packages/webの全routeにおけるモバイルUI監査, 財務グラフ、比較図、heatmap、高密度表、KPI、legend、tooltip、読み方ガイドのレスポンシブ表示, 情報優先度、段階表示、カード化・局所スクロール・要約の使い分け, safe-area、下部タブバー、dynamic viewport、200%拡大、coarse pointer、keyboard、screen reader、reduced-motion, 匿名fixtureによるunit/DOM/build/実Chrome回帰検査
- **対象外 (out)**: 会計計算・集計ロジック・永続データモデルの変更, API・認証・認可・テナント境界の変更, Cloudflare Workers/D1/R2の構成変更, 専用iOS/Androidネイティブアプリの開発, 実データを用いたfixture・スクリーンショット・ログの作成, 本番deploy、PR作成、worktree claim

## U8 制約 (constraints)

- React 18、Chart.js 4、react-chartjs-2、既存route metadataとCSS tokenを維持する
- モバイルは専用ネイティブアプリではなくレスポンシブWebとして提供する
- 情報を単にdisplay:noneで削除せず、優先度に応じて要約・段階表示・密度調整へ変換する
- 会計値の正確性を保ち、視覚簡略化で符号・期間・単位・比較基準を失わない
- public repositoryのため実データ・口座明細・秘密情報を成果物やテストへ含めない
- 外部UI/chart依存の追加は原則避け、bundle budgetとreduced-motionを維持する

## U9 具体的にやりたいこと (concrete_intents)

| ID | やりたいこと | 資するゴール |
|---|---|---|
| I1 | 本番D1の適用済みマイグレーションと migrations/ 配下の差分を機械的に列挙する | G1, G3 |
| I2 | 適用前バックアップの取得と、適用後の行数比較によるデータ保全確認を手順化する | G4 |
| I3 | remote list と repository head から作った承認済み pending manifest を順序どおり本番へ適用する手順を、dry-run と結果確認込みで提示する | G1, G4 |
| I4 | デプロイワークフローに読み取り専用の migration 検査ステップを追加し、未適用または判定不能なら Worker 配信へ進ませない | G2 |
| I5 | 期待スキーマ版と実適用版の不一致を実行時に検知し、専用エラーコードで返す | G3 |
| I6 | スキーマ不一致時の画面表示を、汎用サーバーエラーではなく次の行動が分かる文言にする | G3 |
| I7 | 適用後に取込実行と取込履歴が正常動作することを本番で確認する | G1 |
| I8 | 全routeとchart/figure inventoryを作り、モバイルで非表示・0寸法・重なり・文脈喪失する箇所を特定する | G5, G8 |
| I9 | 財務グラフをモバイルでも必ず描画し、見出し・結論要約・単位・期間・凡例・値の代替表を揃える | G5, G6 |
| I10 | ラベル密度、凡例配置、tooltip、canvas高さ、scroll/stack方針をviewportごとの一貫した契約にする | G5, G6, G7 |
| I11 | safe-areaと固定tabbarを考慮し、主操作・popover・tooltip・最終行が隠れないようにする | G7 |
| I12 | 主要操作を44px以上にし、keyboard、focus-visible、screen reader、200% zoom、contrast、reduced-motionを検証する | G7 |
| I13 | 匿名fixtureの実Chrome検査でモバイルとデスクトップのfigure数・可視性・寸法・意味情報の同等性を固定する | G8 |

## 意思決定支援 (decisions)

- (意思決定支援の記録なし)
