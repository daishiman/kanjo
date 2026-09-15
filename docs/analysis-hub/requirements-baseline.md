# 支出分析ハブ 要件ベースライン (SYS-ANHUB-P01)

- 対象 feature: `feat-analysis-hub` (Beads epic `kanjo-lci`)
- 写し元 (正本): `specs/spec-analysis-hub.md` (confirmation_status=confirmed / evaluation_status=pass)、`features/feat-analysis-hub.md`
- source_feature_digest: `sha256:dacba5d1016d278f40dd8d70ea86621422af0addaa4362cc639a6cb2713a711f` (本書は変更しない)
- 本書の役割: P02..P13 が参照する要件の固定点。要件の文言を変えるときは本書ではなく正本 (system-spec → specs) を直し、本書を写し直す。

## 目的 (U1)

支出分析の入口を、5 つの分析 (照合・総収支・マトリクス・推移・診断) のどこから見ればよいかを 1 画面で判断できるハブにする。期間の収支の結論と、各分析の要確認件数・変化・改善余地と優先度を見比べ、差異を消す → 全体を掴む → 偏りを見る → 変化を追う → 行動を決める の読み順で改善行動まで進める。

## 機能要件

| ID | 要件 | 判定 |
|---|---|---|
| FR-001 | /analysis がハブ (見出し・サマリー・ルート一覧 5 行・読み順 5 ステップ・選択中の分析パネル) を描画し、/analysis/:tab と旧 URL の転送は既存どおり動く | DOM テストでハブ要素の描画と、既存 5 タブ・旧 URL テストの緑 |
| FR-002 | ?focus= の読み書きと URL コピー | ?focus=total-cashflow で総収支行・右パネル・下部バーが選択状態、行選択で URL が置き換わる、不正な focus は既定値、URL コピーが現在の URL をクリップボードへ書く |
| FR-003 | core に analysisHub 相当の純関数、GET /api/analysis/hub が期間メタ・収支サマリー (前期間比)・5 視点の状態・優先度を返す。前期間計算は core へ移し AI 側もそれを使う | core 単体テスト、認証付き API 統合テストの 200 と期間メタ、ハブ表示中の既存 5 API 呼出し 0 件 |
| FR-004 | 優先度・マトリクス正常判定・改善余地の規則を docs に書き境界値テストで固定する | 要確認 0/1 件、未記録月 0/1、tradeoff 候補 0 件の境界で規則どおり。規則を変えるとテストが落ちる |
| FR-005 | ANALYSIS_TABS の label を 照合/総収支/マトリクス/推移/診断 にし、サイドバー子行に件数バッジ | analysis-tabs / navigation-ux / common-shell-routes の DOM テストを新文言で緑、バッジは要確認 1 件以上の視点だけ |
| FR-006 | 各視点の『わかること・主なデータソース・対象外のデータ』を routeMetadata の静的定義にし、右パネルが表示する | FR-001 の DOM テストで右パネルの 3 項目が描画される |

## ビジネスルール

| ID | 規則 |
|---|---|
| BR-001 | 優先度は照合と総収支が要確認 1 件以上なら高・0 件なら中。マトリクス・推移・診断は中 |
| BR-002 | マトリクスは未記録月 0 なら正常 |
| BR-003 | 改善余地は tradeoffCandidates の月額合計 × 12 の年額 |
| BR-004 | 前期間比の比較先は previousPeriod(p)。ラベルは『前 N か月』(1 年選択時は『前12か月』)。前期間の月が 1 か月でも欠ければ null |
| BR-005 | 総収支は freee を正本とした消し込み済みの値を使い、未判断の重複候補は 4 区分の合計に入れない (C4)。件数は totalCashflowReport を再利用し数え直さない |

## 受入条件

| ID | 条件 |
|---|---|
| AC-001 | /analysis で画像の構成要素がすべて描画され、トークン・共通 Button/PageShell 経由で直書き色 lint 0 件 |
| AC-002 | ?focus= で選択状態が再現され、/analysis/:tab と旧 URL 転送の既存テストが緑 |
| AC-003 | ハブ表示中の呼出しは GET /api/analysis/hub の 1 本で、既存 5 API は 0 件 |
| AC-004 | core テストが前期間比・優先度・正常判定・改善余地を境界値付きで検証し、規則が docs に明記されている |
| AC-005 | 5 タブ名が短縮形で、サイドバー子行の件数バッジが要確認件数と一致する |
| AC-006 | 既存 test / typecheck / lint と check 系が緑で、狭幅でハブが横スクロールしない |

## 非機能要件

- Performance: ハブ表示中の API は GET /api/analysis/hub の 1 本。サイドバーとハブは queryKey `['analysis-hub', 期間 key]` を共有する。1 リクエストの D1 読取りは既存 /total-cashflow と同程度。
- Availability: Worker・binding・cron・デプロイ経路を変えず、GET ルートを 1 本足すだけ。
- Accessibility: WCAG 2.2 AA。増減は符号と色、優先度は文字のバッジで示し色だけに頼らない。狭幅で横スクロールしない。
- Security/Privacy: 認証ゲート配下・userId で絞り込み・外部送信なし。コピーする URL に金額・取引・期間を載せない。
- Maintainability: 集計は core に置き api/web へ重複実装しない (C1)。判定規則は docs とテストで固定する。

## スコープ外

- 5 タブ詳細画面の中身の作り直し
- 支出分析以外のサイドバー文言と月次クローズ進捗の形
- 期間選択の保存先の変更 (localStorage のまま URL に載せない)
- D1 スキーマ・migration の変更
- 専用アプリ (web SPA 1 系統のレスポンシブで扱う)

## 未決事項 (正本から写し、ここでは決めない)

- `staleTime`: 『設ける』ことだけが決まり、値も算定基準も無い。
- invalidate の対象範囲 (`qa-frontend-web-ah-decision-003` に束ねられた論点)。
- 純収支説明パネルの狭幅折りたたみ・金額の等幅数字など inference 由来の細部 (利用者確定ではない)。

## 確定意思決定

| ID | 決定 |
|---|---|
| qa-analysis-hub-decision-001 | /analysis をハブにし、『開く』で既存 /analysis/:tab へ進み、選択中の分析を ?focus= で URL に持つ |
| qa-analysis-hub-decision-002 | core 純関数 + GET /analysis/hub の集約 API を新設し、前期間計算を core へ移す |
| qa-analysis-hub-decision-003 | 優先度・正常判定・改善余地を単純な規則で定義し docs とテストで固定する |
| qa-analysis-hub-decision-004 | 支出分析の 5 タブ名とサイドバー子行 (件数バッジ含む) だけ短縮形に揃える |
| qa-backend-web-ah-decision-003 | 前期間は直前の同じ長さ、ラベル『前 N か月』、1 か月でも欠けたら比較データなし |
| qa-frontend-web-ah-decision-003 | Layout とハブで queryKey を共有し、ハブ API を C3 の例外として docs に明記、更新成功で invalidate、staleTime を設ける |
| qa-ui-ux-web-ah-decision-005 | 情報の優先順位 ①ルート一覧 ②収支サマリー ③選択中パネル ④読み順。画像の縦の並びは保つ |

## 突合結果

FR-001..006 / BR-001..005 / AC-001..006 の各コードと文言を `specs/spec-analysis-hub.md` の「機能要件」「業務ルール」「テストと受入条件」節と 1 行ずつ突き合わせ、欠落・追加・言い換えによる意味の変化が無いことを確認した (AC の S 番号と G 番号は表から省いた)。
