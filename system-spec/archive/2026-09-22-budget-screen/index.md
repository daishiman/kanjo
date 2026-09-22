---
kind: index
---

# システム構築仕様書 index

収集マトリクス (カテゴリ×プラットフォーム) の各章と集約状態の相互参照。
集約状態は 未着手 / 収集中 / 確定 / 対象外 の 4 値 (真理値表導出)。

## 要件定義書 (上位概念・憲法)

- [要件定義書](./00-requirements-definition.md) — 上位概念 U1-U9 の正本 (確定マーカー: `confirmed`)。各技術章は serves_goals でここのゴールへトレース (anchor) する。
- **本質的目的 (U1)**: 予算画面を、『実績に合う予算へ、どこを調整しますか？』という問いに 1 画面で答え切る場にする。利用者が実績の期間 (1年 / 2年 / 3年 / 任意) と予算対象の 12 か月を選ぶと、年間収入予算・年間支出予算・予算純収支・防衛ライン余裕を最初に掴み、月次の実績・予算・見通しのグラフと今後の見通し (累計) で来期の姿を確かめ、予算一覧で科目ごとに前期実績・来期予算・自動提案・差額・見通しを見比べ、右のパネルで自動提案の根拠 (前期実績・増減率・季節性補正・計画による調整) と月別の実績推移を読んだうえで来期予算を入力できる。過不足が見込まれる科目と、入力内容が自動提案に比べて年間の収支をどう動かすかをその場で示し、入力中の下書きは画面を離れても失われず、未保存の項目数を見ながらまとめて保存できる。予算は予算対象の 12 か月ごとに科目別の年額で保存し、他の画面 (診断の予算カバー率・予算の着地見込み) も同じ core の 1 か所から導く。取込データは外部へ送信しない。
- **ゴール (U3)**: G1=/budget を 14-budget.png どおりの画面にする。パンくず『計画 / 予算』、期間タブ (usePeriod の 1年 / 2年 / 3年 / 任意と期間送り)、見出し『予算』と問い『実績に合う予算へ、どこを調整しますか？』と説明文、予算対象 (12 か月の開始月の選択と『来期の12か月の予算を編集できます。』)、KPI 4 枚 (年間収入予算・年間支出予算・予算純収支・防衛ライン余裕と説明の ? )、月次の実績・予算・見通しのグラフ (収入 実績 / 収入 予算 / 支出 実績 / 支出 予算の棒と見通し (収支) の折れ線、実績と見通しの境目の縦線と期間の注記)、今後の見通し (累計収入・累計支出・累計純収支と見通しコメント)、予算一覧 (カテゴリ検索 Ctrl+K・実績から提案・すべてリセット・選択チェック・# ・カテゴリ・前期実績・来期予算・自動提案・差額・見通し・来期予算 (入力))、右の科目パネル (提案の根拠 / 関連データのタブ、自動提案の値と前期差、この値を適用、推奨の根拠、計算の詳細 (前期実績・増減率・計画による調整・季節性補正・推奨値)、月別の実績推移 (過去 12 か月)、主な根拠データ、適用前の値、この行を元に戻す、閉じる)、予算の過不足カテゴリ (支出の増加が見込まれる / 支出の減少が見込まれる のタブと件数、# ・カテゴリ・見通し・差額・要因)、調整によるインパクト (自動提案と比べた年間の支出差・予算純収支・増加要因の科目と注意書き)、下部の保存バー (未保存 N 項目・最終保存時刻と下書きの自動保存・リセット・予算を保存) を、既存のデザイントークン・共通部品 (PageHeader・KpiCard・Button・ConfirmDialog・PeriodPicker) の上に組み、画面専用の部品は pages/budget/ に置く。画像の『AI・統計推奨』は外部推論をしないため『自動提案』と表示する。読込・空 (実績 0 か月)・失敗の各状態を持つ。, G2=予算画面の数値を core の純関数 1 か所 (budget-screen) から導く。前期実績は選択した実績期間の科目別合計を 12 か月あたりに換算した額、自動提案は 前期実績 × (1 + 過去 12 か月の増減率) + 季節性補正 + 計画による調整 を千円に丸めた額で、各項を根拠として返す。見通しは実績のある月は実績、無い月は自動提案の月割 (季節性を反映) とし、今後の見通しの累計・過不足カテゴリ (見通し − 来期予算) ・調整によるインパクト (来期予算 − 自動提案) を同じ関数から出す。KPI は 年間収入予算 = 収入行の来期予算の和、年間支出予算 = 支出行の来期予算の和、予算純収支 = 収入予算 − 支出予算、防衛ライン余裕 = 年間収入予算 − 防衛ライン (既存 core の defenseLine の月額) × 12 とし、一覧の合計・KPI・グラフの年合計が一致することをテストで固定する。収入の行は取込データにある『売上高』と、現行の集計に系列が無いため実績 0 の手入力行として置く『その他収入』、支出の行は事業の経費科目 (data.biz.categories) とする。外部の LLM は呼ばない。, G3=予算を予算対象の 12 か月 (開始月 YYYY-MM) ごとに科目別の年額・計画による調整額・調整の理由で保存する表を D1 に追加のみの migration で設け、同じ期間は上書きし版は持たない。保存済みの行が無い期間を開いたときは既存 budgets の月額 × 12 を初期値として示す (既存行は書き換えない)。GET /api/budget-plans?start=YYYY-MM と PUT /api/budget-plans を設け、PUT は canonicalMutationFence に登録する。診断の予算カバー率と予算の着地見込みなど既存の budgets の読み手は、今月を含む予算対象の年額 ÷ 12 を返す core の関数を経由して同じ値を読む。, G4=予算の編集作業を失わない。来期予算の入力・この値を適用・実績から提案 (全行に自動提案を入れる)・計画による調整の入力は下書きとして端末の localStorage に予算対象の期間単位で自動保存し、下書きを自動保存した時刻と最終保存時刻を示し、保存に成功したら消し、次回に復元できる。未保存の項目数を保存バーに出し、この行を元に戻す (保存済みの値へ) ・すべてリセット / リセット (全行を保存済みの値へ、確認つき) を持ち、未保存のまま離れるときは確認する。, G5=予算の数値が他画面とずれない。ヘッダの防衛ラインと防衛ライン余裕は同じ defenseLine、診断の予算カバー率と予算画面の設定済み科目は同じ予算の読み出し関数から導き、既存の診断・概要・家計収支・総収支・決算書の数値テストが緑のままである。

## 章一覧と集約状態

| カテゴリ | 章 | 集約状態 | 確定マーカー | 資するゴール | 対応セル |
|---|---|---|---|---|---|
| データベース (database) | [database.md](./database.md) | 確定 | `confirmed` | G3 G5 | database.web database.mobile database.tablet database.desktop-windows database.desktop-linux database.desktop-macos |
| 認証(ログイン) (auth) | [auth.md](./auth.md) | 確定 | `confirmed` | G3 | auth.web auth.mobile auth.tablet auth.desktop-windows auth.desktop-linux auth.desktop-macos |
| UI-UX (ui-ux) | [ui-ux.md](./ui-ux.md) | 確定 | `confirmed` | G1 G2 G4 | ui-ux.web ui-ux.mobile ui-ux.tablet ui-ux.desktop-windows ui-ux.desktop-linux ui-ux.desktop-macos |
| セキュリティ (security) | [security.md](./security.md) | 確定 | `confirmed` | G2 G3 G4 | security.web security.mobile security.tablet security.desktop-windows security.desktop-linux security.desktop-macos |
| インフラ (infrastructure) | [infrastructure.md](./infrastructure.md) | 確定 | `confirmed` | G3 | infrastructure.web infrastructure.mobile infrastructure.tablet infrastructure.desktop-windows infrastructure.desktop-linux infrastructure.desktop-macos |
| バックエンド (backend) | [backend.md](./backend.md) | 確定 | `confirmed` | G2 G3 G5 | backend.web backend.mobile backend.tablet backend.desktop-windows backend.desktop-linux backend.desktop-macos |
| フロントエンド (frontend) | [frontend.md](./frontend.md) | 確定 | `confirmed` | G1 G4 | frontend.web frontend.mobile frontend.tablet frontend.desktop-windows frontend.desktop-linux frontend.desktop-macos |
| 保守運用管理 (maintenance-ops) | [maintenance-ops.md](./maintenance-ops.md) | 確定 | `confirmed` | G2 G4 G5 | maintenance-ops.web maintenance-ops.mobile maintenance-ops.tablet maintenance-ops.desktop-windows maintenance-ops.desktop-linux maintenance-ops.desktop-macos |

## 集約状態サマリ

- **未着手**: —
- **収集中**: —
- **確定**: database, auth, ui-ux, security, infrastructure, backend, frontend, maintenance-ops
- **対象外**: —

## 全体ドキュメント出典 (未割当参照)

- (全ての取得済みドキュメントは各章へ割り当て済み)
