---
kind: index
---

# システム構築仕様書 index

収集マトリクス (カテゴリ×プラットフォーム) の各章と集約状態の相互参照。
集約状態は 未着手 / 収集中 / 確定 / 対象外 の 4 値 (真理値表導出)。

## 要件定義書 (上位概念・憲法)

- [要件定義書](./00-requirements-definition.md) — 上位概念 U1-U9 の正本 (確定マーカー: `confirmed`)。各技術章は serves_goals でここのゴールへトレース (anchor) する。
- **本質的目的 (U1)**: 決算書画面を、『損益・資金・残高は、整合していますか？』という問いに 1 画面で答え、整合していない箇所 (集計できない資金、未入力の負債) をその場で決着 (原因の把握と取引データへの移動、負債残高の入力と保存) まで進められる場にする。利用者が損益計算書・キャッシュフロー計算書・貸借対照表を前期比・出典・対象期間つきで読み、数字の根拠 (計算式・内訳の勘定科目・月別の推移・データの出典) を辿り、『0円』と『未入力』を取り違えずに負債残高を入れられる状態にする。
- **ゴール (U3)**: G1=/statements を 11-statements.png どおりの画面にする。問いの見出し『損益・資金・残高は、整合していますか？』と説明文、期間の範囲表示と前後移動、KPI 4 枚 (売上高・営業利益は前期比の金額と %、現金増減は前期比の金額のみ (画像どおり)、負債残高は前月末比の金額と % で減少を良化色。各々 出典と対象期間または基準日)、3 計算書の節へ移動するページ内ナビ (画像のタブの見た目。3 節は縦にすべて描画)、PL 表 (勘定科目・当期・前期・差額・構成比、行の展開、エクスポート)、右の『項目の詳細』パネル (金額・計算式・主な内訳の勘定科目・月別の推移・データの出典・明細を開く)、月別の損益推移グラフ (売上高・売上原価の棒と営業利益の線)、月次の損益計算書表 (万円・合計列) を、既存のデザイントークン・共通 Button・PageShell・期間 (usePeriod) の上に組む。読込・空・失敗の各状態を持つ。, G2=決算書の数値を core の純関数 1 か所で算出し、GET /api/statements がその screen だけを返す。勘定科目→区分 (売上高 / 売上原価 / 販管費) の固定対応表 (青色申告決算書の区分に合わせ、仕入高など仕入系の科目だけを売上原価、ほかの経費を販管費とする) から段階損益 (売上高・売上原価・売上総利益・販管費・営業利益) を月別と期間合計で出し、直前の同じ長さの期間との前期比 (金額と %)・構成比・各行の計算式と主な内訳科目を出す。KPI の現金増減と負債残高、各数値の出典と対象期間 / 基準日も同じ関数から出す。対応表と計算式は docs とテストで固定する。, G3=キャッシュフロー計算書が集計できないときは、画像の表示 (『キャッシュフロー計算書は、現在集計できていません』・主な原因・解決方法の 3 手順・取引データを確認) に切り替え、表とグラフを出さない。原因は core が判定し、未仕訳の取引件数・現金口座データの欠け・勘定科目が未設定の取引件数を件数つきで示す。集計できるときは既存の営業 CF 概算 (表とグラフ) を出す。, G4=貸借対照表の負債残高を、基準月ごと・項目ごとに『未入力 / 0円 / 金額』の 3 状態で入力・保存できるようにする。借入金・未払金・クレジット未払の 3 項目は状態の選択を必須とし、その他の負債は任意項目として残す。保存済みの値を読み込んで初期表示し、保存は項目単位で上書きして他の項目を消さない。基準月は期間内の任意の月を選べる。入力中の値はブラウザ内に利用者ごとの下書きとして自動保存し保存時刻を示し、リセットで保存済みの値へ戻し、未保存の項目数を画面下部の固定バーに出す。未入力の項目がある月は BS にデータ不足の表示を出し、純資産を出さない。, G5=負債の保存経路と画面の安全性を整える。既存の認証・セッション・CSRF 相当の防御 (SameSite=Strict の Cookie と JSON の Content-Type 検証) と取込との直列化を保ったまま、金額の上限、リクエストの大きさの上限、保存操作の監査ログを加える。下書きには利用者の識別子をキーに含め、ログアウトで消す。取込データや下書きを外部へ送らない。

## 章一覧と集約状態

| カテゴリ | 章 | 集約状態 | 確定マーカー | 資するゴール | 対応セル |
|---|---|---|---|---|---|
| データベース (database) | [database.md](./database.md) | 確定 | `confirmed` | G4 G5 | database.web database.mobile database.tablet database.desktop-windows database.desktop-linux database.desktop-macos |
| 認証(ログイン) (auth) | [auth.md](./auth.md) | 確定 | `confirmed` | G4 G5 | auth.web auth.mobile auth.tablet auth.desktop-windows auth.desktop-linux auth.desktop-macos |
| UI-UX (ui-ux) | [ui-ux.md](./ui-ux.md) | 確定 | `confirmed` | G1 G3 G4 | ui-ux.web ui-ux.mobile ui-ux.tablet ui-ux.desktop-windows ui-ux.desktop-linux ui-ux.desktop-macos |
| セキュリティ (security) | [security.md](./security.md) | 確定 | `confirmed` | G5 | security.web security.mobile security.tablet security.desktop-windows security.desktop-linux security.desktop-macos |
| インフラ (infrastructure) | [infrastructure.md](./infrastructure.md) | 確定 | `confirmed` | G1 G4 | infrastructure.web infrastructure.mobile infrastructure.tablet infrastructure.desktop-windows infrastructure.desktop-linux infrastructure.desktop-macos |
| バックエンド (backend) | [backend.md](./backend.md) | 確定 | `confirmed` | G2 G3 G4 G5 | backend.web backend.mobile backend.tablet backend.desktop-windows backend.desktop-linux backend.desktop-macos |
| フロントエンド (frontend) | [frontend.md](./frontend.md) | 確定 | `confirmed` | G1 G3 G4 | frontend.web frontend.mobile frontend.tablet frontend.desktop-windows frontend.desktop-linux frontend.desktop-macos |
| 保守運用管理 (maintenance-ops) | [maintenance-ops.md](./maintenance-ops.md) | 確定 | `confirmed` | G1 G2 G5 | maintenance-ops.web maintenance-ops.mobile maintenance-ops.tablet maintenance-ops.desktop-windows maintenance-ops.desktop-linux maintenance-ops.desktop-macos |

## 集約状態サマリ

- **未着手**: —
- **収集中**: —
- **確定**: database, auth, ui-ux, security, infrastructure, backend, frontend, maintenance-ops
- **対象外**: —

## 全体ドキュメント出典 (未割当参照)

- (全ての取得済みドキュメントは各章へ割り当て済み)
