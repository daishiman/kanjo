---
kind: index
---

# システム構築仕様書 index

収集マトリクス (カテゴリ×プラットフォーム) の各章と集約状態の相互参照。
集約状態は 未着手 / 収集中 / 確定 / 対象外 の 4 値 (真理値表導出)。

## 要件定義書 (上位概念・憲法)

- [要件定義書](./00-requirements-definition.md) — 上位概念 U1-U9 の正本 (確定マーカー: `confirmed`)。各技術章は serves_goals でここのゴールへトレース (anchor) する。
- **本質的目的 (U1)**: 収支が『いつ・なぜ』変わったかを、推移画面の 1 画面で掴めるようにする。利用者が推移を開いた時点で、選んだ期間の収入・支出・純収支の月次推移と、前期間または前年との差が総合/事業/家計で読め、最も変化が大きい月の増減要因 (どのカテゴリのどの取引先がいくら動いたか) が根拠の明細まで辿れる状態にする。指標は登録制にして、収支以外の推移もあとから同じ画面の型で追えるようにする。
- **ゴール (U3)**: G1=/analysis/trends を 07-trends.png どおりの構成にする。期間タブ (1年/2年/3年/任意) と期間表示、問いの見出し『収支は、いつ・なぜ変わりましたか?』と説明、比較条件の帯 (分析の範囲 事業/家計/総合・表示する指標 支出/収入/純収支・比較対象 前期間/前年)、KPI 3 枚 (現在の値・前期間からの増減・最も変化が大きい月)、収支の推移チャート (収入/支出/純収支の今回の折れ線、比較期間の点線、月次差の棒、選択月の強調)、選択月の詳細パネル (収入/支出/純収支/比較期間の値、主な増減要因 上位 3、データの出典、該当明細を開く)、カテゴリ別の推移と増減の表 (12 か月の推移・今回合計・比較期間・増減額・増減率・構成比・寄与度、行を開くと取引先の内訳)、増減の要因のパレート図、増減が大きい項目の上位 3、下部の選択バー (選択中の月とカテゴリ、増減の明細を確認) を、共通シェル・トークン・Button・chart.js の共通設定の上に組む。既存の『手を打つ順番』は『傾向の判定を表示』で開閉できる根拠として下部に残す。, G2=推移の指標を登録制にする。指標定義 (id・表示名・月次系列の取り出し方・符号と良し悪しの向き・内訳の軸) を packages/core に置き、今回は収入・支出・純収支の 3 指標を登録する。画面・API・表は指標定義から描き、指標を足すときに画面と API の分岐を増やさない。, G3=推移に必要な集計を packages/core の純関数と API に置く。数値は総収支と同じ取引集合 (freee 取引と MF 明細を消し込んだ後、totalCashflowReport と同じ数え方) から数え、総合・事業・家計の値を概況と総収支画面に一致させる。範囲 (総合/事業/家計)・指標・比較対象 (前期間=直前の同じ長さ / 前年=前年の同じ月範囲) を受け取り、今回と比較期間の月次系列、月次差、KPI (現在値・増減額と率・最も変化が大きい月)、選択月の詳細 (各指標の値・増減要因 上位 3・出典の口座)、カテゴリ別の行 (直近 12 か月の系列・今回・比較・増減額・増減率・構成比・寄与度。カテゴリは MF 由来が大項目、freee 由来が勘定科目)、カテゴリ内の取引先別の行、パレート (増減額の降順と累計構成比) を返す。期間は既存の Dataset を切る設計 (sliceDataset) に従い、比較期間のデータは同じ方法で切り出す。全期間を選んだときは比較期間を作らず、KPI の増減は最も変化が大きい月の前月差で出す。要確認の MF 明細は総収支と同じく事業にも家計にも数えず、期間と選択月の要確認の件数と金額 (totalCashflowReport の月次 reviewCount・reviewAmount) を返す。開閉で残す傾向の判定は現行どおり MF 明細だけから trendsReport で計算し、どの基準で数えたかを返却に含める。, G4=推移から根拠の明細へ辿れるようにする。MF 由来の行の『該当明細を開く』『増減の明細を確認』は /classify へ月・範囲に加えてカテゴリと取引先 (専用の payee クエリ、明細の内容と完全一致、名寄せなし) の絞込クエリを渡して開き、明細画面はその絞込で表示する。freee 由来の行は MF 明細の画面に無いため、全体の期間選択を保ったまま総収支画面 (/analysis/total-cashflow) を開く。期間タブは全体の期間選択 (usePeriod) を操作し、範囲・指標・比較対象・選択月・選択カテゴリは URL に保持して再読込と共有で同じ表示に戻る。URL の値が形式違反なら既定値へ倒して画面を出す。, G5=増減の計算と要因の説明を単純で説明可能な規則として docs に明記しテストで固定する。増減額・増減率 (比較期間が 0 のときの表示)・構成比・寄与度・最も変化が大きい月の選び方・比較期間の定義・増減要因の説明文 (増減額が大きい取引先と件数から決まった形の文を作る。外部送信や AI 生成はしない) の規則を定め、境界値付きの core テストと DOM テストで固定する。数値の出所 (総収支と同じ取引集合)、全期間では比較を出さない規則、スパークラインを直近 12 か月とする規則も同じ docs に書く。要確認の明細を含めない規則と、傾向の判定だけは MF 明細を基準にする規則も同じ docs に書く。

## 章一覧と集約状態

| カテゴリ | 章 | 集約状態 | 確定マーカー | 資するゴール | 対応セル |
|---|---|---|---|---|---|
| データベース (database) | [database.md](./database.md) | 確定 | `confirmed` | G3 G4 | database.web database.mobile database.tablet database.desktop-windows database.desktop-linux database.desktop-macos |
| 認証(ログイン) (auth) | [auth.md](./auth.md) | 確定 | `confirmed` | G3 G4 | auth.web auth.mobile auth.tablet auth.desktop-windows auth.desktop-linux auth.desktop-macos |
| UI-UX (ui-ux) | [ui-ux.md](./ui-ux.md) | 確定 | `confirmed` | G1 G4 G5 | ui-ux.web ui-ux.mobile ui-ux.tablet ui-ux.desktop-windows ui-ux.desktop-linux ui-ux.desktop-macos |
| セキュリティ (security) | [security.md](./security.md) | 確定 | `confirmed` | G3 G4 | security.web security.mobile security.tablet security.desktop-windows security.desktop-linux security.desktop-macos |
| インフラ (infrastructure) | [infrastructure.md](./infrastructure.md) | 確定 | `confirmed` | G3 | infrastructure.web infrastructure.mobile infrastructure.tablet infrastructure.desktop-windows infrastructure.desktop-linux infrastructure.desktop-macos |
| バックエンド (backend) | [backend.md](./backend.md) | 確定 | `confirmed` | G2 G3 G5 | backend.web backend.mobile backend.tablet backend.desktop-windows backend.desktop-linux backend.desktop-macos |
| フロントエンド (frontend) | [frontend.md](./frontend.md) | 確定 | `confirmed` | G1 G2 G4 | frontend.web frontend.mobile frontend.tablet frontend.desktop-windows frontend.desktop-linux frontend.desktop-macos |
| 保守運用管理 (maintenance-ops) | [maintenance-ops.md](./maintenance-ops.md) | 確定 | `confirmed` | G5 | maintenance-ops.web maintenance-ops.mobile maintenance-ops.tablet maintenance-ops.desktop-windows maintenance-ops.desktop-linux maintenance-ops.desktop-macos |

## 集約状態サマリ

- **未着手**: —
- **収集中**: —
- **確定**: database, auth, ui-ux, security, infrastructure, backend, frontend, maintenance-ops
- **対象外**: —

## 全体ドキュメント出典 (未割当参照)

- (全ての取得済みドキュメントは各章へ割り当て済み)
