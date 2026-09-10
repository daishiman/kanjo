# 実装要件ハンドオフ: feature-retire-tax-receipt-and-clarify-freee-only

- 生成時刻: 2026-09-09T16:29:21Z
- handoff target: `task-graph`
- graph snapshot digest: `sha256:ddcff4153360a42e21edec52560c5d08469e4c387354ddffaf1564bda10fd24a`
- package canonical digest: `sha256:439c9ab04b9d7fa966af0bd72ee253f033cece7cff06028fa4060bb153805810`
- feature context digest: `sha256:691ce012422589ceca63ba89fdbe45493adcf0acf81b1001a4dea6e044a9213c`

## 目的

使わない機能が残っているせいで、画面にも保守にも「判断しなくてよいこと」が増え続けている。確定申告の準備と領収書/証憑の取り込みは U1 の本質的目的に一切資さないため取り除く。あわせて freeeOnly 一覧が二重登録候補に見える表示を、実際の意味である全分割の残余へ合わせる。

## ゴール

確定申告・領収書/証憑に関する画面・API・保存・専用定義が active runtime から消え、TotalCashflow 画面の freeeOnly 一覧が「二重登録として外す」入口を持たず、恒等式 matched + freeeOnly + excluded === deals.length を保ったまま、その一覧が取込の抜け漏れを件数で確かめるための内訳であると画面から読み取れる状態。

## 実装に渡す範囲

- 確定申告の準備機能 (/tax) の全廃。画面・route 定義・API・core モジュール・専用テストを含む
- 領収書/証憑の取り込みと保管機能の全廃。証憑の登録・保管・取得・ZIP 出力・残数表示・取込元プロファイルと上書き・維持ジョブと予算枠・監査対象宣言・mutation fence 定義まで含む
- Release A として migration head を 0038 に進め、R2 削除 intent を共通 outbox へ退避する。旧専用6テーブルは runtime / API / Drizzle から退役させるが、物理削除は将来の別変更である Release B へ分離する
- 証憑機能にのみ紐づく R2 オブジェクトの利用終了。FILES バインディング自体は改善リクエストのスクリーンショットと夜間バックアップが使用中のため残す
- 他機能に残る証憑への参照の除去。現金の記帳の添付列、取込明細の添付件数表示、バックアップ snapshot の証憑項目、core の re-export、削除・取込ライフサイクルに組み込まれた添付の親収束処理を含む
- 削除対象のテストに埋もれている無関係な保証の退避。夜間バックアップが R2 へ書けることの唯一の実行証跡が証憑のテスト内にあるため、削除の前に独立したテストへ切り出す
- scheduled maintenance の D1 クエリ予算表を、専用の証憑維持ジョブを共通 `r2_cleanup` へ統合した構成で再宣言する
- 削除対象にのみ紐づくテストの削除と、残る機能のテストが緑であることの維持
- TotalCashflow の freeeOnly 一覧から「二重登録として外す」操作を外し、見出しと説明を全分割の残余として読める表現へ変更

## 渡さない範囲

- excluded (freee 内部で同じ支払が2件入っている場合の除外) の機能そのもの。対象が freee 内部の重複であり MF 重複とは別問題のため残す
- matched 行の「二重登録として外す」と、その既定理由が消し込み理由で埋まること。利用者の指摘は freeeOnly 一覧に限られており、matched 行の是非は別途判断を要する
- 消し込み規則・合算・トレンド判定のロジック変更
- 現金の記帳・取込明細・未決済の機能本体
- system-spec の確定章の変更。差分ヒアリング結果は no_spec_delta で R4-reopen を要さない
- R2 バケットと FILES バインディングの廃止。改善リクエストのスクリーンショット保存と D1 の夜間バックアップ先として継続利用する
- 取込原本の R2 保管と共通 retention cleanup の廃止。active・30日以内・処理中の原本を保護し、期限超過した inactive 原本だけを削除する現行ライフサイクルを維持する
- 旧専用6テーブルの物理削除と 0039 の追加。cleanup の pending / retry / dead と旧 attachments・attachment_cleanup_jobs の残件0を機械ゲートで確認する将来の Release B 変更が担う

## 受入条件 (feature)

1. 確定申告・領収書・証憑・添付に対応する route / API / 画面 / Drizzle 定義が active runtime に0件である。Release A で物理 D1 に残り得る互換テーブルは対象外とする
2. 現行 repository の migration head・schema guard・local preview 適用上限が 0038 であり、将来の 0039 を配布物に含めていない
3. /tax と /tax/receipts への遷移入口がサイドバーにも routeMetadata にも存在しない
4. TotalCashflow の freeeOnly 行に「二重登録として外す」操作が0件である
5. matched 行の「二重登録として外す」は従来どおり動作し、既存の除外テストが緑のままである
6. matched + freeeOnly + excluded === deals.length が全期間で成立する契約テストが緑である
7. R2 の FILES バインディングが残り、改善リクエストのスクリーンショットの既存テストが緑である
8. 夜間バックアップが scheduled 経由で backups/YYYY-MM-DD.json を書き 30 日超を削除することを、証憑機能に依存しない独立したテストが検証しており緑である
9. scheduled maintenance の D1 クエリ予算表が共通 `r2_cleanup` の active 原本 guard を含む7 job・46 queriesで再宣言され、実装とテストが一致する
10. 型検査・lint・全テストが緑で、削除により参照不能となったシンボルが0件である
11. 取込原本の active・recent・processing 保護と期限超過 inactive 削除、現金記帳、交通費記帳が、それぞれ証憑機能に依存しない独立した回帰テストで検証され緑である

## readiness matrix

| task | phase | 表題 | readiness | 不足節 |
|---|---|---|---|---|
| SYS-RTR-P01 | P01 | 廃止範囲と保持範囲の要件確定 | complete | なし |
| SYS-RTR-P02 | P02 | 削除後の依存グラフと層境界の設計 | complete | なし |
| SYS-RTR-P03 | P03 | 独立設計レビュー | complete | なし |
| SYS-RTR-P04 | P04 | 退避テストと受入テストの設計 | complete | なし |
| SYS-RTR-P05 | P05 | 証憑機能の削除と freeeOnly 行の操作除去 | complete | なし |
| SYS-RTR-P06 | P06 | テスト実行 | complete | なし |
| SYS-RTR-P07 | P07 | 受入判定 | complete | なし |
| SYS-RTR-P08 | P08 | 残存参照の整理とデータ移行 | complete | なし |
| SYS-RTR-P09 | P09 | 型検査と静的検査と運用予算の整合 | complete | なし |
| SYS-RTR-P10 | P10 | 独立最終レビュー | complete | なし |
| SYS-RTR-P11 | P11 | 再現可能な証跡の収集 | complete | なし |
| SYS-RTR-P12 | P12 | 文書と運用手順の更新 | complete | なし |
| SYS-RTR-P13 | P13 | 反映と反映後の確認 | complete | なし |

## gate 結果

- C11 graph schema: valid=True / readiness=complete / violations=0
- C02 登録済み source digest: `sha256:439c9ab04b9d7fa966af0bd72ee253f033cece7cff06028fa4060bb153805810` (promotion receipt の published_digest と一致)
- validate-system-plan: pass

## 境界

この文書は実装コードを持たない。13 task の仕様書の正本は promoted package 内にあり、
`tasks/feature-retire-tax-receipt-and-clarify-freee-only/` の各ファイルはその入口である。実装は task-graph build が担う。
