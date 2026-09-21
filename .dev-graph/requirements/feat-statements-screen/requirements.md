# 実装要件: feat-statements-screen

- Feature: `feat-statements-screen`
- Package: `.dev-graph/plans/feature-package-feat-statements-screen`
- Handoff target: task-graph
- Snapshot: `sha256:b876c2be84bd04c8eb94bb534f844df79cdec90a30302138b120def569641d91`
- System plan: `sha256:b7b5463d81396f3733f71694ba174d935c886841941c232029b6574add8f6eb1`
- Readiness: **PASS**（missing sections 0、3 gate 同一 snapshot）

契約の正本は `specs/spec-statements-screen.md` と `system-spec/`、task の正本は `tasks/feat-statements-screen/` の frontmatter である。本書は両者を要件単位で結ぶ索引で、実装コードは含まない。

## 目的

決算書画面を、『損益・資金・残高は、整合していますか？』という問いに 1 画面で答え、月次クローズと確定申告の前に損益計算書・キャッシュフロー計算書・貸借対照表の数字と根拠を辿り、足りない負債残高をその場で入れて決着させられる場にする。段階損益・前期比・構成比・計算式・主な内訳科目を core の 1 か所で算出し、CF が集計できないときは原因を件数つきで示し、負債残高を『未入力 / 0円 / 金額』の 3 状態で値を失わずに保存できる状態にする。

## 到達状態

- S1 (G1): /statements で 11-statements.png の構成要素がすべて描画され、色・余白・部品はトークンと共通 Button / PageShell 経由で、直書き色の lint が 0 件である。ページ内ナビは nav と aria-current で role=tab が 0 件、負債 KPI は前月末比で減少が良化色、現金増減 KPI に % が無い。
- S2 (G2): 画面の KPI・PL 表・詳細パネル・月次表・グラフの数値が core の statementsScreen 1 関数の出力と一致し、段階損益の恒等式 (月別と合計)・前期比 (前期 0 で null)・未知科目は販管費・構成比の契約テストが検算済みフィクスチャで緑である。
- S3 (G3): CF が集計できない fixture で表とグラフが 0 件になり、原因 3 種の件数と解決方法 3 手順と取引データへのリンクが出る。原因が 1 つも無い fixture では available で営業 CF 概算の表とグラフが出て、settlementUnknown 単独でも unavailable になる。
- S4 (G4): 負債を 1 項目ずつ保存しても他項目の保存値が消えず、unset で行が消え、未入力と 0 円が保存後も区別されたまま BS と KPI に反映され、必須 3 項目の状態が未選択なら保存できず、下書きの復元・リセット・未保存件数の表示が緑である。
- S5 (G5): 負債保存で上限超過の金額と 8 KiB 超の本文が 400 / 413、未認証が 401、取込中が 409 になり、保存ごとに liability_audit_log へ金額を含まない 1 件が残り、ログアウトで下書きが消え、verify:full が緑である。

## 前提

- 確定意思決定 (qa-statements-decision-001〜007、appr-foundation-statements-001/002) を変更しない。変更が必要になったら spec を reopen してから着手する。
- 数値の正本は spec §6 の検算済みフィクスチャで、画像の月次表 (列見出しの重複・行の和が合計と不一致) の数値は写さない。
- OI-01: migration 番号 0045 の衝突有無は SYS-STMT-P05 の着手時に origin/main を取り直して確かめ、衝突すれば繰り下げて docs と spec の参照を揃える。
- OI-02: 仕様 low findings 6 件 (system-spec/completeness-findings.json) の扱いは SYS-STMT-P03 の独立レビューで決め、実装に影響するものは docs/statements-screen.md に記録する。
- system-spec/ 直下は並行サイクルと共有される。main 取込時に衝突したら archive/ への退避規則に従い、本サイクルの確定章を上書きしない。

## 実装要件

### REQ-ST-001 画面構成・見出し・期間バー・ページ内ナビ

/statements を 11-statements.png の構成で描く。問いの見出し『損益・資金・残高は、整合していますか？』と説明文、usePeriod の期間バーと範囲表示・同じ長さの前後移動 (全期間では無効)、3 計算書へのページ内ナビ (nav aria-label=計算書 のリンク #pl/#cf/#bs、選択項目だけ aria-current=location、?tab= を URL に保持、3 節は縦にすべて描画し見出しへフォーカス、role=tab は使わない)。色・余白・部品はトークンと共通 Button / PageShell だけを使い、外枠 (Layout.tsx) は変えない。

- 根拠: S1
- 担当 task: `SYS-STMT-P02`、`SYS-STMT-P04`、`SYS-STMT-P05`、`SYS-STMT-P07`、`SYS-STMT-P09`
- Source: §1.1、§1.2、§1.4（`specs/spec-statements-screen.md`）

### REQ-ST-002 KPI 4 枚と比較の向き

売上高・営業利益は前期比の金額と %、現金増減は前期比の金額だけ (CF 集計不能で —)、負債残高は基準月の合計を前月末比の金額と % で出し、減少を良化色・増加を注意色にする。各 KPI に ? の計算式説明・出典・対象期間 / 基準日を出す。前期 0 は % を —、前期データ無しは —、必須 3 項目に未入力があれば値は『未入力あり』で合計を出さない。符号と矢印を必ず併記する。

- 根拠: S1、S2、qa-statements-decision-005
- 担当 task: `SYS-STMT-P02`、`SYS-STMT-P04`、`SYS-STMT-P05`、`SYS-STMT-P07`
- Source: §1.3（`specs/spec-statements-screen.md`）

### REQ-ST-003 PL の区分・段階損益・前期比・構成比を core 1 か所で算出

新設 packages/core/src/statements-screen.ts の statementsScreen(input) が、固定の区分対応表 (仕入系は売上原価・期末棚卸は減算・外注工賃と未知科目は販管費・売上系は売上高) で 5 行を算出し、全月と合計で gross=sales−cogs・operating=gross−sga を満たす。diff=current−previous、diffRate=diff/|previous| (0 か null で null)、構成比は売上高比 (売上高 0 で null)。前期 Dataset は api が applyPeriod で切って渡す。§6 の検算済みフィクスチャを数値の正本とし、画像の数値は写さない。

- 根拠: S2
- 担当 task: `SYS-STMT-P02`、`SYS-STMT-P03`、`SYS-STMT-P04`、`SYS-STMT-P05`、`SYS-STMT-P06`
- Source: §3.1、§6（`specs/spec-statements-screen.md`）

### REQ-ST-004 PL 表・項目の詳細パネル・月別推移グラフ・月次 PL 表

PL 表は 5 行 × (勘定科目 / 当期 / 前期 / 差額 / 構成比) で、行の展開 (aria-expanded) と科目セルの選択ボタン (aria-pressed、?row=、既定 sales) を持つ。詳細パネルは計算式・主な内訳 3 科目・月別推移・データの出典・明細を開く (/classify?category=&month=、計算行は無効) を出し、× で閉じる。月別の損益推移グラフは chart-series-contract に乗せる。月次 PL 表は万円表示で合計列は円で合算してから丸め、表だけ横スクロールする。値はすべて screen の出力をそのまま描く。

- 根拠: S1、S2
- 担当 task: `SYS-STMT-P04`、`SYS-STMT-P05`、`SYS-STMT-P07`、`SYS-STMT-P09`
- Source: §1.5、§1.6、§1.7、§1.8（`specs/spec-statements-screen.md`）

### REQ-ST-005 CF の集計可否と原因件数

cf.status は原因 (unclassified>0 / missingCash.months>0 / missingCash.settlementUnknown / accountUnset>0) のどれかが立つときだけ unavailable とし、件数は core の 1 か所で数えて web は数え直さない。unavailable では情報バナー・該当する原因だけの件数表示・解決方法 3 手順・取引データを確認 (/classify) を出して表とグラフを描かない。available では既存の営業 CF 概算の表とグラフを出し、投資 CF・財務 CF は出さない。

- 根拠: S3
- 担当 task: `SYS-STMT-P02`、`SYS-STMT-P04`、`SYS-STMT-P05`、`SYS-STMT-P07`
- Source: §1.9、§3.1（`specs/spec-statements-screen.md`）

### REQ-ST-006 GET /api/statements の screen 追加 (後方互換)

既存の pl / cf / bs / liabilityCategoryOptions / balanceSheetSources / period を残したまま screen: StatementsScreen を足し、新画面は screen だけを読む。クエリ ref=YYYY-MM は期間外・不正を期間の最終月に丸め、丸めた月を bs.referenceMonth で返し、web は URL をその値に置き換える。

- 根拠: S2
- 担当 task: `SYS-STMT-P02`、`SYS-STMT-P04`、`SYS-STMT-P05`、`SYS-STMT-P08`
- Source: §3.2（`specs/spec-statements-screen.md`）

### REQ-ST-007 BS と負債残高の 3 状態入力

基準月に必須 3 項目 (借入金 / 未払金・買掛金 / クレジットカード未払金) のいずれかが未入力なら警告バナーと開閉できる入力フォームを出し、純資産は『データ不足』とする。各行は 未入力 / 0円 / 金額を入力 のラジオで、金額は整数・0 以上・上限以下。必須行の未選択は項目直下に role=alert のエラーを出して保存させない。表示名と保存カテゴリの対応は既存 LIABILITY_CATEGORIES を変えない。

- 根拠: S4
- 担当 task: `SYS-STMT-P04`、`SYS-STMT-P05`、`SYS-STMT-P07`、`SYS-STMT-P09`
- Source: §1.10（`specs/spec-statements-screen.md`）

### REQ-ST-008 PUT /api/balances/liabilities の項目単位 upsert と入力上限

本文を { month, lines[{category,status,amount?}] } の zod strict にし、送られた項目だけを upsert / 削除して送られていない項目と source=mf の行に触らない (月の manual 負債の全削除をやめる)。unset は行を消し、zero は amount=0 で保存する。amount 上限 1 兆円・本文 8 KiB (bodyLimit)・行数上限を持ち、超過は 400 / 413。authGuard・JSON Content-Type 検証・取込との直列化 (409) を通し、応答は保存後の bs。

- 根拠: S4、S5
- 担当 task: `SYS-STMT-P02`、`SYS-STMT-P03`、`SYS-STMT-P04`、`SYS-STMT-P05`、`SYS-STMT-P09`
- Source: §3.3、§5（`specs/spec-statements-screen.md`）

### REQ-ST-009 migration 0045 と liability_audit_log

migration 0045_liability_status.sql で balance_entries に status 列 (zero|amount、既定 amount) を ADD COLUMN し、新表 liability_audit_log を CREATE TABLE で足す。既存行は書き換えず backfill もしない。0045 以前の (amount, 0) 行は core が zero と同じ扱いで表示・完了判定する。監査は保存ごとに 1 件、状態遷移と件数だけを残し金額は残さない。番号が並行サイクルと衝突すれば次の番号へ繰り下げ、本番は Migrate を Deploy の前に適用する。

- 根拠: S5、C4
- 担当 task: `SYS-STMT-P02`、`SYS-STMT-P03`、`SYS-STMT-P05`、`SYS-STMT-P13`
- Source: §3.4（`specs/spec-statements-screen.md`）

### REQ-ST-010 下書き・未保存バー・ログアウト時の消去

下書きは localStorage のキー kanjo.statements.liabilityDraft.<userId>.<YYYY-MM> に入力から 800ms 後に保存し『下書きを自動保存しました HH:mm』を出す。サーバへは送らない。保存成功とリセットで消し、ログアウト時に同じ接頭辞のキーを全て消す (Layout.tsx)。保存値と違う項目が 1 件以上あれば下部固定の未保存バーに件数・リセット・保存を出し、離脱時は beforeunload で確認する。

- 根拠: S4、S5、C3
- 担当 task: `SYS-STMT-P04`、`SYS-STMT-P05`、`SYS-STMT-P07`、`SYS-STMT-P09`
- Source: §4、§1.11（`specs/spec-statements-screen.md`）

### REQ-ST-011 エクスポート CSV の数式注入対策

PL のエクスポート (CSV) は、= + - @・タブ・NUL で始まる文字列セルの先頭に ' を付け、RFC 4180 に従い , " 改行を含むセルを二重引用符で囲んで " を "" にする。金額セルは数値のまま書き出し ' を付けない。科目名は利用者データ由来なので必ずこの処理を通す。

- 根拠: S5
- 担当 task: `SYS-STMT-P04`、`SYS-STMT-P05`、`SYS-STMT-P09`
- Source: §1.5、§5（`specs/spec-statements-screen.md`）

### REQ-ST-012 旧画面の置き換え・既存テスト更新・docs 化・配信

旧 Statements.tsx の UI と旧 PUT 本文形を撤去し、statements-balance-sheet.dom.test.tsx ほか既存テストを新しい文言と本文形へ更新する (契約を緩めず、旧実装で落ちることを確かめる)。§8 の画像との意図的な差を docs/ui-decisions.md に、区分表・計算式・状態列と監査表を docs/data-schema.md に記録し、verify:full と JS 予算を緑にして単一 PR で配信する。

- 根拠: S1〜S5、互換性・移行・リリース
- 担当 task: `SYS-STMT-P06`、`SYS-STMT-P08`、`SYS-STMT-P11`、`SYS-STMT-P12`、`SYS-STMT-P13`
- Source: §7、§8（`specs/spec-statements-screen.md`）

横断: `SYS-STMT-P01` が要件ベースラインと受入の対応表を確定し、`SYS-STMT-P10` が全要件を spec と突き合わせて最終レビューする。

## 実行グラフ

13 nodes、12 edges、1 root の直列依存。状態・資源・lineage は各 task frontmatter を正本とする。

| Task | 内容 | 依存 |
|---|---|---|
| SYS-STMT-P01 | 要件ベースライン確定と受入 O1-O5・S1-S5 の対応表 | — |
| SYS-STMT-P02 | statementsScreen・API 2 経路・migration 0045・部品分割の設計決定の記録 | SYS-STMT-P01 |
| SYS-STMT-P03 | 集計・保存・監査・URL の各契約の独立レビュー | SYS-STMT-P02 |
| SYS-STMT-P04 | 検算済みフィクスチャ・境界値・API・DOM の失敗テストの先行作成 | SYS-STMT-P03 |
| SYS-STMT-P05 | core statementsScreen・GET と PUT・migration 0045・決算書画面の実装 | SYS-STMT-P04 |
| SYS-STMT-P06 | テスト実行と緑化 | SYS-STMT-P05 |
| SYS-STMT-P07 | 成功基準 S1 から S5 と仕様 §7 の受入の判定 | SYS-STMT-P06 |
| SYS-STMT-P08 | 旧画面実装の整理・既存テストの更新・旧 PUT 本文形の撤去 | SYS-STMT-P07 |
| SYS-STMT-P09 | a11y・入力検証・本文上限・監査・CSV・JS 予算の品質保証 | SYS-STMT-P08 |
| SYS-STMT-P10 | 独立した最終レビュー | SYS-STMT-P09 |
| SYS-STMT-P11 | 受入と品質の証跡の集約 | SYS-STMT-P10 |
| SYS-STMT-P12 | docs と運用記述の同期 | SYS-STMT-P11 |
| SYS-STMT-P13 | 単一 PR での配信と migration 0045 の本番適用 | SYS-STMT-P12 |

## Readiness

| Gate | 結果 |
|---|---|
| C11 validate-graph-schema | valid、violations 0 (graph revision 4) |
| C02 saved state | spec + architecture 9、feature + 13 task が confirmed / pass / complete、registration expected 13 = applied 13 |
| validate-system-plan | pass、P01..P13、`sha256:b7b5463d81396f3733f71694ba174d935c886841941c232029b6574add8f6eb1` |
