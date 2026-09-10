# MF事業判定 — 公開証跡索引

本書は証跡の内容を複製せず、公開可能な所在と不変条件だけを示す。

## 許可する証跡

- `samples/` またはテスト内匿名 fixture
- 再現可能なコマンドと終了状態
- 入力件数と処理件数が一致し、skip がないという不変条件
- 内容を復元しない digest
- canonical spec とテスト名の対応

## 許可しない証跡

実データファイル、行データ、個別件数、個別金額、取引先名、個人ホームの絶対パス、秘密値は公開文書へ残さない。

## 参照

- 契約: `specs/spec-mf-business-classification.md`
- 実行記録: `docs/mf-business-classification/test-run.md`
- 受入対応: `docs/mf-business-classification/acceptance.md`
- 最終判定: `docs/mf-business-classification/final-review.md`

非公開の原本確認が必要な場合は、公開文書に場所や値を転記せず、ローカル限定証跡であることだけを記録する。
